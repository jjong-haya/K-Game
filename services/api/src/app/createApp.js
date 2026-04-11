const cors = require("cors");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const { createAuthService } = require("../auth");
const config = require("../config");
const { requestLambdaOperation } = require("../lambdaClient");
const {
  createWordTurnService,
  mapEmotionToLegacyState,
  normalizeStoredWordTurn,
} = require("../wordTurnService");
const {
  PROMPT_ATTEMPT_LIMIT,
  WORD_ATTEMPT_LIMIT,
  WORD_AI_HINT_LIMIT,
  WORD_HINT_TYPES,
  WORD_MAX_INPUT_CHARS,
  blendPromptScores,
  buildPromptInvalidMessage,
  buildPromptStatusText,
  buildPromptSuccessMessage,
  buildTodayDateString,
  buildWordStatusText,
  buildWordSuccessMessage,
  clamp,
  computeLocalSimilarity,
  ensureWordInputValid,
  evaluatePromptInput,
  formatKoreanDateTime,
  isWordMatch,
  mapPromptCategory,
  mapWordCategory,
  stripSpacingAndPunctuation,
  summarizeText,
} = require("../gameLogic");
const { errorHandler } = require("../middleware/errorHandler");
const { notFoundHandler } = require("../middleware/notFound");
const { registerAdminRoutes } = require("../routes/adminRoutes");
const { registerAuthRoutes } = require("../routes/authRoutes");
const { registerHealthRoutes } = require("../routes/healthRoutes");
const { registerPromptRoutes } = require("../routes/promptRoutes");
const { registerProposalRoutes } = require("../routes/proposalRoutes");
const { registerWordRoutes } = require("../routes/wordRoutes");

function createApp({ pool }) {
  const app = express();
  const authService = createAuthService({ pool, config });
  app.disable("x-powered-by");

  const corsOrigins =
    config.corsOrigin === "*"
      ? true
      : config.corsOrigin
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean);

  const corsOptions =
    corsOrigins === true
      ? {
          origin: true,
          credentials: true,
          methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
          allowedHeaders: ["Content-Type", "Authorization", "x-player-token", "x-current-guest-token"],
        }
      : {
          origin(origin, callback) {
            if (!origin || corsOrigins.includes(origin)) {
              callback(null, true);
              return;
            }

            callback(new Error("Not allowed by CORS"));
          },
          credentials: true,
          methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
          allowedHeaders: ["Content-Type", "Authorization", "x-player-token", "x-current-guest-token"],
        };

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요." },
    })
  );

  const safeJsonParse = (value, fallback = null) => {
    if (!value) {
      return fallback;
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  };

  const formatDisplayDateTime = (value) => formatKoreanDateTime(value, config.timezone);
  const normalizeHintType = (hintType) =>
    String(hintType || "").startsWith("best_guess_ai") ? "best_guess_ai" : String(hintType || "");
  const buildStoredHintType = (hintType, hintUses) => {
    if (hintType !== "best_guess_ai") {
      return hintType;
    }

    const nextIndex =
      hintUses.filter((hint) => hint.hintType === "best_guess_ai").length + 1;
    return `best_guess_ai_${nextIndex}`;
  };
  const wordReactionStates = new Set([
    "idle",
    "teasing_low",
    "playful_mid",
    "impressed_high",
    "shocked_near_success",
    "defeated_success",
    "cooldown_or_locked",
  ]);
  const wordReactionDefaults = {
    teasing_low: { emoji: "😏", label: "비웃는 중", line: "ㅋㅋ 야 그걸 질문이라고 던진 거냐?" },
    playful_mid: { emoji: "😜", label: "빈정대는 중", line: "오, 막 던진 건 아닌데 아직도 웃기긴 하다." },
    impressed_high: { emoji: "😳", label: "어이없어하는 중", line: "뭐냐, 방금 건 생각보다 괜찮아서 더 짜치네." },
    shocked_near_success: { emoji: "😵", label: "멘붕 오는 중", line: "야 잠깐, 그건 너무 잘 찔렀는데? 기분 더럽네." },
    defeated_success: { emoji: "🤯", label: "정답 인정", line: "와, 그걸 진짜 맞혀버리네." },
    cooldown_or_locked: { emoji: "🤔", label: "머리 굴리는 중", line: "잠깐만, 네 질문 수준부터 정리하고 답할게." },
    idle: { emoji: "🙂", label: "덤벼 봐", line: "자, 어디 또 얼마나 이상한 질문하나 보자." },
  };

  const normalizeWordReactionState = (value, fallback = "idle") =>
    wordReactionStates.has(String(value || "").trim()) ? String(value || "").trim() : fallback;

  const buildWordReactionMeta = ({
    reactionState,
    reactionEmoji,
    reactionLabel,
    reactionLine,
    tag,
    reasonType,
  } = {}) => {
    const normalizedState = normalizeWordReactionState(reactionState, "idle");
    const defaults = wordReactionDefaults[normalizedState] || wordReactionDefaults.idle;

    return {
      reactionState: normalizedState,
      reactionEmoji: String(reactionEmoji || defaults.emoji).trim() || defaults.emoji,
      reactionLabel: String(reactionLabel || defaults.label).trim() || defaults.label,
      reactionLine: String(reactionLine || defaults.line).trim() || defaults.line,
      tag: String(tag || "").trim() || null,
      reasonType: String(reasonType || "").trim() || null,
    };
  };

  const wordEmotionEmojiMap = {
    neutral: "🙂",
    smile: "😄",
    tease: "😏",
    thinking: "🤔",
    confused: "😵",
    impressed: "😳",
    suspicious: "🧐",
    shock: "🤯",
  };

  const buildWordTurnEmotion = (wordTurn) => {
    const raw = wordTurn?.emotion && typeof wordTurn.emotion === "object" ? wordTurn.emotion : {};
    const emojiKey = String(raw.emojiKey || "").trim() || "neutral";
    const label = String(raw.label || "").trim() || "차분";
    const intensity = Number(raw.intensity);

    return {
      emojiKey,
      label,
      intensity: Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0.45,
      emoji: wordEmotionEmojiMap[emojiKey] || wordEmotionEmojiMap.neutral,
    };
  };

  const buildWordTurnAvatarReaction = (wordTurn, fallbackState = "idle", fallbackMessage = "") => {
    const emotion = buildWordTurnEmotion(wordTurn);
    return buildWordReactionMeta({
      reactionState: mapEmotionToLegacyState(emotion.emojiKey) || fallbackState,
      reactionEmoji: emotion.emoji,
      reactionLabel: emotion.label,
      reactionLine: wordTurn?.friendReply || fallbackMessage,
      tag: wordTurn?.judge?.verdict,
      reasonType: wordTurn?.judge?.reasonType,
    });
  };

  const extractWordReactionMeta = (dimensionJson, fallbackState = "idle", fallbackMessage = "") => {
    const storedWordTurn = normalizeStoredWordTurn(dimensionJson);
    if (storedWordTurn) {
      return buildWordTurnAvatarReaction(storedWordTurn, fallbackState, fallbackMessage);
    }

    const raw =
      dimensionJson?.wordReaction && typeof dimensionJson.wordReaction === "object"
        ? dimensionJson.wordReaction
        : dimensionJson?.avatarReaction && typeof dimensionJson.avatarReaction === "object"
          ? dimensionJson.avatarReaction
          : null;

    return buildWordReactionMeta({
      reactionState: raw?.reactionState || fallbackState,
      reactionEmoji: raw?.reactionEmoji,
      reactionLabel: raw?.reactionLabel,
      reactionLine: raw?.reactionLine || fallbackMessage,
      tag: raw?.tag,
      reasonType: raw?.reasonType,
    });
  };

  const parseBearerToken = (authorizationValue = "") => {
    const match = authorizationValue.toString().match(/^Bearer\s+(.+)$/i);
    return match?.[1] || "";
  };

  const getPlayerToken = (req) =>
    (
      parseBearerToken(req.header("authorization")) ||
      parseCookieHeader(req.header("cookie") || "")[config.auth.cookieName] ||
      req.header("x-player-token") ||
      ""
    )
      .toString()
      .trim()
      .slice(0, 80);

  const getNickname = (req) =>
    (req.header("x-player-nickname") || req.body?.nickname || req.query?.nickname || "")
      .toString()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[<>"'`;\\]/g, "")
      .slice(0, 40);

  const isAdminUser = (user) => {
    if (!user || user.authType === "guest" || !user.id) {
      return false;
    }

    if (config.admin.userIds.includes(Number(user.id))) {
      return true;
    }

    const email = (user.email || "").toString().trim().toLowerCase();
    return Boolean(email) && config.admin.emails.some((value) => value.toLowerCase() === email);
  };

  const buildPlayerPayload = (player) => ({
    id: player.id,
    authType: player.authType,
    nickname: player.nickname,
    email: player.email || null,
    isTemporary: Boolean(player.isTemporary),
    isAdmin: isAdminUser(player),
  });

  const parseCookieHeader = (headerValue = "") =>
    headerValue
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .reduce((accumulator, entry) => {
        const separatorIndex = entry.indexOf("=");
        if (separatorIndex === -1) {
          return accumulator;
        }

        const key = entry.slice(0, separatorIndex).trim();
        const value = entry.slice(separatorIndex + 1).trim();
        accumulator[key] = decodeURIComponent(value);
        return accumulator;
      }, {});

  const buildSessionCookieOptions = (expiresAt) => ({
    httpOnly: true,
    secure: Boolean(config.auth.secureCookies),
    sameSite: config.auth.sameSite,
    path: "/",
    expires: expiresAt ? new Date(expiresAt) : undefined,
  });

  const setSessionCookie = (res, token, expiresAt) => {
    if (!token) {
      return;
    }

    res.cookie(config.auth.cookieName, token, buildSessionCookieOptions(expiresAt));
  };

  const clearSessionCookie = (res) => {
    res.clearCookie(config.auth.cookieName, buildSessionCookieOptions(null));
  };

  const isDuplicateKeyError = (error) => error?.code === "ER_DUP_ENTRY" || error?.errno === 1062;

  async function withTransaction(work) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  function ensureDailyWordChallengeAvailable(res, challenge) {
    if (challenge) {
      return true;
    }

    res.status(503).json({
      message: "오늘의 단어가 아직 준비되지 않았습니다. 마이그레이션과 시드 작업을 먼저 확인해 주세요.",
    });
    return false;
  }

  async function getCurrentAuth(req, options = {}) {
    const { required = true, allowGuest = true } = options;
    const token = getPlayerToken(req);

    if (!token) {
      if (!required) {
        return null;
      }

      return {
        error: { status: 401, message: "로그인이 필요합니다." },
      };
    }

    const session = await authService.resolveSession(token);
    if (!session) {
      return {
        error: { status: 401, message: "세션이 만료되었거나 다시 로그인해야 합니다." },
      };
    }

    if (!allowGuest && session.user.authType === "guest") {
      return {
        error: { status: 403, message: "이 기능은 소셜 로그인 사용자만 사용할 수 있습니다." },
      };
    }

    return {
      token,
      session,
      user: session.user,
      player: buildPlayerPayload(session.user),
    };
  }

  async function requireAuth(req, res, options = {}) {
    const result = await getCurrentAuth(req, options);
    if (result?.error) {
      res.status(result.error.status).json({ message: result.error.message });
      return null;
    }

    return result;
  }

  async function requireAdmin(req, res) {
    const auth = await requireAuth(req, res, { allowGuest: false });
    if (!auth) {
      return null;
    }

    if (!isAdminUser(auth.user)) {
      res.status(403).json({ message: "관리자 권한이 필요한 요청입니다." });
      return null;
    }

    return auth;
  }

  const respondAuthError = (res, error, status = 400) => {
    res.status(status).json({
      message: error?.message || "인증 처리 중 오류가 났습니다.",
    });
  };

  async function listCategories() {
    const [rows] = await pool.query(
      "SELECT id, slug, name, display_order FROM categories ORDER BY display_order ASC, id ASC",
    );
    return rows.map((row) => ({
      id: Number(row.id),
      slug: row.slug,
      name: row.name,
      displayOrder: Number(row.display_order || 0),
    }));
  }

  async function getDailyWordChallenge() {
    const [rows] = await pool.query(
      `
        SELECT
          daily.*,
          categories.id AS category_id,
          categories.slug AS category_slug,
          categories.name AS category_name
        FROM daily_word_challenges AS daily
        INNER JOIN categories ON categories.id = daily.hidden_category_id
        WHERE daily.challenge_date = ?
        ORDER BY daily.id DESC
        LIMIT 1
      `,
      [buildTodayDateString(config.timezone)],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      challengeDate: row.challenge_date,
      publicTitle: row.public_title,
      hiddenAnswerText: row.hidden_answer_text,
      fixedHintText: row.fixed_hint_text || "",
      status: row.status,
      category: {
        id: Number(row.category_id),
        slug: row.category_slug,
        name: row.category_name,
      },
    };
  }

  async function getDailySynonyms(challengeId) {
    const [rows] = await pool.query(
      "SELECT synonym_text FROM daily_word_synonyms WHERE challenge_id = ? ORDER BY id ASC",
      [challengeId],
    );
    return rows.map((row) => row.synonym_text);
  }

  async function getPromptRoom(roomId, executor = pool) {
    const [rows] = await executor.query(
      `
        SELECT
          rooms.*,
          categories.id AS category_id,
          categories.slug AS category_slug,
          categories.name AS category_name
        FROM prompt_rooms AS rooms
        INNER JOIN categories ON categories.id = rooms.category_id
        WHERE rooms.id = ?
        LIMIT 1
      `,
      [roomId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      openDate: row.open_date,
      titleAsAnswer: row.title_as_answer,
      answerType: row.answer_type,
      maxInputChars: Number(row.max_input_chars),
      thresholdScore: Number(row.threshold_score),
      teaserText: row.teaser_text || "",
      tone: row.tone || "",
      status: row.status,
      category: {
        id: Number(row.category_id),
        slug: row.category_slug,
        name: row.category_name,
      },
      aiReview: safeJsonParse(row.ai_review_json, null),
    };
  }

  async function listPromptRooms(categorySlug, status) {
    const params = [status || "active", buildTodayDateString(config.timezone)];
    let where = "WHERE rooms.status = ? AND rooms.open_date <= ?";

    if (categorySlug) {
      where += " AND categories.slug = ?";
      params.push(categorySlug);
    }

    const [rows] = await pool.query(
      `
        SELECT
          rooms.*,
          categories.id AS category_id,
          categories.slug AS category_slug,
          categories.name AS category_name
        FROM prompt_rooms AS rooms
        INNER JOIN categories ON categories.id = rooms.category_id
        ${where}
        ORDER BY categories.display_order ASC, rooms.id ASC
      `,
      params,
    );

    return rows.map((row) => ({
      id: Number(row.id),
      openDate: row.open_date,
      publicTitle: row.title_as_answer,
      titleAsAnswer: row.title_as_answer,
      answerType: row.answer_type,
      maxInputChars: Number(row.max_input_chars),
      thresholdScore: Number(row.threshold_score),
      teaserText: row.teaser_text || "",
      tone: row.tone || "",
      status: row.status,
      categoryId: Number(row.category_id),
      categorySlug: row.category_slug,
      categoryName: row.category_name,
    }));
  }

  async function getParticipant(mode, targetId, identifier = {}, executor = pool) {
    const { userId = null, sessionId = null } = identifier;
    if (!userId && !sessionId) {
      return null;
    }

    const [rows] = userId
      ? await executor.query(
          "SELECT * FROM participants WHERE mode = ? AND target_id = ? AND user_id = ? LIMIT 1",
          [mode, targetId, userId],
        )
      : await executor.query(
          "SELECT * FROM participants WHERE mode = ? AND target_id = ? AND session_id = ? LIMIT 1",
          [mode, targetId, sessionId],
        );

    const row = rows[0];
    return row
      ? {
          id: Number(row.id),
          mode: row.mode,
          targetId: Number(row.target_id),
          userId: row.user_id ? Number(row.user_id) : null,
          sessionId: row.session_id,
          nickname: row.nickname,
          joinedAt: row.joined_at,
        }
      : null;
  }

  async function ensureParticipant(mode, targetId, userId, sessionId, nickname, executor = pool) {
    if (!sessionId || !nickname || !userId) {
      return null;
    }

    await executor.query(
      `
        INSERT INTO participants (mode, target_id, user_id, session_id, nickname)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          session_id = VALUES(session_id),
          nickname = VALUES(nickname)
      `,
      [mode, targetId, userId, sessionId, nickname],
    );

    return getParticipant(mode, targetId, { userId, sessionId }, executor);
  }

  async function getAttempts(mode, targetId, participantId, executor = pool) {
    if (!participantId) {
      return [];
    }

    const [rows] = await executor.query(
      `
        SELECT *
        FROM attempts
        WHERE mode = ? AND target_id = ? AND participant_id = ?
        ORDER BY created_at ASC, id ASC
      `,
      [mode, targetId, participantId],
    );

    return rows.map((row) => {
      const dimensions = safeJsonParse(row.dimension_json, null);
      const wordTurn = normalizeStoredWordTurn(dimensions);
      const characterState = row.character_state || "idle";
      const aiMessage = wordTurn?.chatReply || row.ai_message || "";

      return {
        id: Number(row.id),
        attemptIndex: Number(row.attempt_index),
        inputText: row.input_text,
        status: row.status,
        primaryScore: Number(row.primary_score || 0),
        finalScore: Number(row.final_score || 0),
        dimensions,
        reactionCategory: row.reaction_category || wordTurn?.analysis?.inputType || "idle",
        characterState,
        aiMessage,
        wordTurn,
        avatarReaction: extractWordReactionMeta(dimensions, characterState, aiMessage),
        invalidReason: row.invalid_reason || null,
        isSuccess: Boolean(row.is_success),
        createdAt: formatDisplayDateTime(row.created_at),
        respondedAt: formatDisplayDateTime(row.responded_at),
        rawCreatedAt: row.created_at,
        rawRespondedAt: row.responded_at,
      };
    });
  }

  async function getHintUses(participantId, executor = pool) {
    if (!participantId) {
      return [];
    }
    const [rows] = await executor.query(
      "SELECT hint_type, revealed_text, used_at FROM hint_uses WHERE participant_id = ? ORDER BY used_at ASC, id ASC",
      [participantId],
    );
    return rows.map((row) => ({
      hintType: normalizeHintType(row.hint_type),
      rawHintType: row.hint_type,
      revealedText: row.revealed_text,
      usedAt: formatDisplayDateTime(row.used_at),
      rawUsedAt: row.used_at,
    }));
  }

  async function getSharedWordAiHints(challengeId, executor = pool) {
    if (!challengeId) {
      return [];
    }

    const [rows] = await executor.query(
      `
        SELECT hint_index, revealed_text, created_at, updated_at
        FROM daily_word_ai_hints
        WHERE challenge_id = ?
        ORDER BY hint_index ASC
      `,
      [challengeId],
    );

    return rows.map((row) => ({
      hintIndex: Number(row.hint_index),
      revealedText: row.revealed_text,
      createdAt: formatDisplayDateTime(row.created_at),
      updatedAt: formatDisplayDateTime(row.updated_at),
      rawCreatedAt: row.created_at,
      rawUpdatedAt: row.updated_at,
    }));
  }

  async function lockParticipantState(connection, participantId) {
    await connection.query("SELECT id FROM participants WHERE id = ? FOR UPDATE", [participantId]);

    const [attemptRows] = await connection.query(
      `
        SELECT id, attempt_index, input_text, status, final_score, is_success
        FROM attempts
        WHERE participant_id = ?
        ORDER BY attempt_index ASC, id ASC
        FOR UPDATE
      `,
      [participantId],
    );

    const [hintRows] = await connection.query(
      `
        SELECT hint_type, revealed_text, used_at
        FROM hint_uses
        WHERE participant_id = ?
        ORDER BY used_at ASC, id ASC
        FOR UPDATE
      `,
      [participantId],
    );

    return {
      attempts: attemptRows.map((row) => ({
        id: Number(row.id),
        attemptIndex: Number(row.attempt_index),
        inputText: row.input_text,
        status: row.status,
        finalScore: Number(row.final_score || 0),
        isSuccess: Boolean(row.is_success),
      })),
      hintUses: hintRows.map((row) => ({
        hintType: normalizeHintType(row.hint_type),
        rawHintType: row.hint_type,
        revealedText: row.revealed_text,
        usedAt: row.used_at,
        rawUsedAt: row.used_at,
      })),
    };
  }

  async function getWordLeaderboards(challengeId) {
    const [successRows] = await pool.query(
      `
        SELECT participants.nickname, wins.created_at, attempts.attempt_index
        FROM wins
        INNER JOIN participants ON participants.id = wins.participant_id
        INNER JOIN attempts ON attempts.id = wins.winning_attempt_id
        WHERE wins.mode = 'word' AND wins.target_id = ?
        ORDER BY wins.created_at ASC, wins.id ASC
      `,
      [challengeId],
    );
    const [attemptRows] = await pool.query(
      `
        SELECT participants.nickname, wins.created_at, attempts.attempt_index
        FROM wins
        INNER JOIN participants ON participants.id = wins.participant_id
        INNER JOIN attempts ON attempts.id = wins.winning_attempt_id
        WHERE wins.mode = 'word' AND wins.target_id = ?
        ORDER BY attempts.attempt_index ASC, wins.created_at ASC, wins.id ASC
      `,
      [challengeId],
    );

    return {
      successOrder: successRows.map((row, index) => ({
        rank: index + 1,
        nickname: row.nickname,
        successTime: formatDisplayDateTime(row.created_at),
        attemptCount: Number(row.attempt_index),
      })),
      fewestAttempts: attemptRows.map((row, index) => ({
        rank: index + 1,
        nickname: row.nickname,
        successTime: formatDisplayDateTime(row.created_at),
        attemptCount: Number(row.attempt_index),
      })),
    };
  }

  async function getPromptLeaderboards(roomId) {
    const [successRows] = await pool.query(
      `
        SELECT participants.nickname, wins.created_at, attempts.attempt_index, attempts.final_score
        FROM wins
        INNER JOIN participants ON participants.id = wins.participant_id
        INNER JOIN attempts ON attempts.id = wins.winning_attempt_id
        WHERE wins.mode = 'prompt' AND wins.target_id = ?
        ORDER BY wins.created_at ASC, wins.id ASC
      `,
      [roomId],
    );
    const [scoreRows] = await pool.query(
      `
        SELECT participants.nickname, MAX(attempts.final_score) AS best_score, MIN(attempts.created_at) AS first_seen_at
        FROM attempts
        INNER JOIN participants ON participants.id = attempts.participant_id
        WHERE attempts.mode = 'prompt' AND attempts.target_id = ? AND attempts.status = 'completed'
        GROUP BY participants.id, participants.nickname
        ORDER BY best_score DESC, first_seen_at ASC
      `,
      [roomId],
    );

    return {
      successOrder: successRows.map((row, index) => ({
        rank: index + 1,
        nickname: row.nickname,
        successTime: formatDisplayDateTime(row.created_at),
        attemptCount: Number(row.attempt_index),
        finalScore: Number(row.final_score || 0),
      })),
      bestScores: scoreRows.map((row, index) => ({
        rank: index + 1,
        nickname: row.nickname,
        score: Number(row.best_score || 0),
        createdAt: formatDisplayDateTime(row.first_seen_at),
      })),
    };
  }

  async function getPromptHomeLeaderboards() {
    const today = buildTodayDateString(config.timezone);
    const [countRows] = await pool.query(
      `
        SELECT
          participants.user_id,
          COALESCE(NULLIF(users.nickname, ''), participants.nickname) AS nickname,
          COUNT(DISTINCT wins.target_id) AS solved_count,
          MIN(wins.created_at) AS first_solved_at
        FROM wins
        INNER JOIN participants ON participants.id = wins.participant_id
        INNER JOIN prompt_rooms ON prompt_rooms.id = wins.target_id
        LEFT JOIN users ON users.id = participants.user_id
        WHERE wins.mode = 'prompt' AND prompt_rooms.open_date = ?
        GROUP BY participants.user_id, COALESCE(NULLIF(users.nickname, ''), participants.nickname)
        ORDER BY solved_count DESC, first_solved_at ASC, nickname ASC
      `,
      [today],
    );

    return {
      mostSolved: countRows.map((row, index) => ({
        rank: index + 1,
        nickname: row.nickname,
        solvedCount: Number(row.solved_count || 0),
        firstSolvedAt: formatDisplayDateTime(row.first_solved_at),
      })),
    };
  }

  async function getRecentAttempts(mode, targetId) {
    const [rows] = await pool.query(
      `
        SELECT attempts.input_text, attempts.final_score, attempts.is_success, attempts.reaction_category, attempts.created_at, participants.nickname
        FROM attempts
        INNER JOIN participants ON participants.id = attempts.participant_id
        WHERE attempts.mode = ? AND attempts.target_id = ? AND attempts.status = 'completed'
        ORDER BY attempts.created_at DESC, attempts.id DESC
        LIMIT 6
      `,
      [mode, targetId],
    );

    return rows.map((row) => ({
      nickname: row.nickname,
      value: summarizeText(row.input_text, 24),
      finalScore: Number(row.final_score || 0),
      isSuccess: Boolean(row.is_success),
      reactionCategory: row.reaction_category,
      createdAt: formatDisplayDateTime(row.created_at),
    }));
  }

  function expandProposal(row) {
    const aiReview = safeJsonParse(row.ai_review_json, null);
    return {
      id: Number(row.id),
      proposerUserId: row.proposer_user_id ? Number(row.proposer_user_id) : null,
      proposerNickname: row.proposer_nickname,
      categoryId: Number(row.category_id),
      categorySlug: row.category_slug,
      categoryName: row.category_name,
      proposedAnswer: row.proposed_answer,
      answerType: row.answer_type,
      proposalNote: row.proposal_note || "",
      aiReview,
      recommendedMaxInputChars: aiReview?.recommendedMaxInputChars ?? null,
      recommendedThresholdScore: aiReview?.recommendedThresholdScore ?? null,
      teaserText: aiReview?.teaserText || "",
      tone: aiReview?.tone || "",
      summary: aiReview?.summary || "",
      status: row.status,
      reviewNote: row.review_note || "",
      reviewedAt: formatDisplayDateTime(row.reviewed_at),
      reviewedByUserId: row.reviewed_by_user_id ? Number(row.reviewed_by_user_id) : null,
      approvedRoomId: row.approved_room_id ? Number(row.approved_room_id) : null,
      createdAt: formatDisplayDateTime(row.created_at),
    };
  }

  function buildWordConversation(attempts, hints = []) {
    const intro = [
      {
        id: "word-intro",
        role: "assistant",
        content: "스무고개 시작! O/X로 대답해줄게. 질문해봐.",
        category: "idle",
      },
    ];

    const timeline = [
      ...attempts.flatMap((attempt) => [
        {
          sortAt: new Date(attempt.rawCreatedAt || attempt.rawRespondedAt || 0).getTime(),
          order: 0,
          message: {
            id: `word-user-${attempt.id}`,
            role: "user",
            content: attempt.inputText,
          },
        },
        {
          sortAt: new Date(attempt.rawRespondedAt || attempt.rawCreatedAt || 0).getTime(),
          order: 1,
          message: {
            id: `word-ai-${attempt.id}`,
            role: "assistant",
            content: attempt.aiMessage,
            score: attempt.finalScore,
            category: attempt.reactionCategory,
            meta: attempt.wordTurn?.judge?.verdict || null,
          },
        },
      ]),
      ...hints.flatMap((hint, index) => [
        {
          sortAt: new Date(hint.rawUsedAt || 0).getTime(),
          order: 2,
          message: {
            id: `word-hint-user-${hint.rawHintType || index}`,
            role: "user",
            content: "어려워 힌트좀 알려줘",
          },
        },
        {
          sortAt: new Date(hint.rawUsedAt || 0).getTime(),
          order: 3,
          message: {
            id: `word-hint-ai-${hint.rawHintType || index}`,
            role: "assistant",
            content: hint.revealedText,
            meta: "HINT",
          },
        },
      ]),
    ]
      .filter((item) => Number.isFinite(item.sortAt))
      .sort((left, right) => left.sortAt - right.sortAt || left.order - right.order)
      .map((item) => item.message);

    return intro.concat(timeline);
  }

  function buildPromptConversation(room, attempts) {
    const intro = [
      {
        id: `prompt-intro-${room.id}`,
        role: "assistant",
        content:
          room.teaserText || `${room.titleAsAnswer}을 직접 말하게 만들면 되는 방이야. 프롬프트를 잘 짜 봐.`,
        category: "idle",
      },
    ];

    return intro.concat(
      attempts.flatMap((attempt) => [
        {
          id: `prompt-user-${attempt.id}`,
          role: "user",
          content: attempt.inputText,
        },
        {
          id: `prompt-ai-${attempt.id}`,
          role: "assistant",
          content: attempt.aiMessage,
          score: attempt.finalScore,
          category: attempt.reactionCategory,
        },
      ]),
    );
  }

  async function buildWordSnapshot(userId = null) {
    const challenge = await getDailyWordChallenge();
    const participant = await getParticipant("word", challenge.id, { userId });
    const attempts = participant ? await getAttempts("word", challenge.id, participant.id) : [];
    const hints = participant ? await getHintUses(participant.id) : [];
    const sharedAiHints = await getSharedWordAiHints(challenge.id);
    const leaderboards = await getWordLeaderboards(challenge.id);
    const latestAttempt = attempts[attempts.length - 1] || null;
    const bestAttempt =
      attempts
        .slice()
        .sort((left, right) => right.finalScore - left.finalScore || left.attemptIndex - right.attemptIndex)[0] ||
      null;
    const attemptsLeft = Math.max(0, WORD_ATTEMPT_LIMIT - attempts.length);
    const aiHintUses = hints.filter((hint) => hint.hintType === "best_guess_ai").length;
    const hintsUsed = aiHintUses;
    const hasWon = attempts.some((attempt) => attempt.isSuccess);
    const hasPending = attempts.some((attempt) => attempt.status === "pending");
    const latestTurn = latestAttempt?.wordTurn || null;
    const currentEmotion = latestTurn
      ? buildWordTurnEmotion(latestTurn)
      : latestAttempt?.characterState === "defeated_success"
        ? {
            emojiKey: "shock",
            label: "정답 인정",
            intensity: 1,
            emoji: wordEmotionEmojiMap.shock,
          }
        : buildWordTurnEmotion(null);

    return {
      challenge: {
        id: challenge.id,
        challengeDate: challenge.challengeDate,
        publicTitle: "오늘의 단어",
        categoryName: challenge.category.name,
        hiddenCategoryName: challenge.category.name,
        highestSimilarityText: bestAttempt?.inputText || null,
        highestSimilarityScore: bestAttempt?.finalScore || 0,
        successCount: leaderboards.successOrder.length,
        sharedAiHintCount: sharedAiHints.length,
      },
      conversation: buildWordConversation(attempts, hints),
      hints: Object.fromEntries(
        WORD_HINT_TYPES.map((hintType) => {
          const found = hints
            .slice()
            .reverse()
            .find((hint) => hint.hintType === hintType);
          return [hintType, found ? found.revealedText : null];
        }),
      ),
      player: {
        participant,
        attemptsUsed: attempts.length,
        attemptsLeft,
        hintsUsed,
        hintsRemaining: Math.max(0, WORD_AI_HINT_LIMIT - hintsUsed),
        hasWon,
        hasPending,
        isLocked: hasWon || hasPending || attemptsLeft <= 0,
        characterState: hasPending
          ? "cooldown_or_locked"
          : latestAttempt?.characterState || "idle",
        latestTurn,
        currentEmotion,
        avatarReaction: hasPending
          ? buildWordReactionMeta({ reactionState: "cooldown_or_locked" })
          : latestAttempt?.avatarReaction || buildWordReactionMeta({ reactionState: "idle" }),
        statusText: buildWordStatusText({
          hasWon,
          attemptsLeft,
          pending: hasPending,
          hintsRemaining: Math.max(0, WORD_AI_HINT_LIMIT - hintsUsed),
        }),
        history: attempts.map((attempt) => ({
          id: attempt.id,
          inputText: attempt.inputText,
          finalScore: attempt.finalScore,
          aiMessage: attempt.aiMessage,
          reactionCategory: attempt.reactionCategory,
          characterState: attempt.characterState,
          avatarReaction: attempt.avatarReaction,
          wordTurn: attempt.wordTurn,
          createdAt: attempt.createdAt,
        })),
        hintUses: hints.map((hint) => hint.hintType),
      },
      stats: {
        recentAttempts: await getRecentAttempts("word", challenge.id),
      },
      leaderboards,
    };
  }

  const wordTurnService = createWordTurnService({
    pool,
    withTransaction,
    getParticipant,
    ensureParticipant,
    lockParticipantState,
    buildWordSnapshot,
    wordAttemptLimit: WORD_ATTEMPT_LIMIT,
  });

  async function buildPromptState(room, userId = null) {
    const participant = await getParticipant("prompt", room.id, { userId });
    const attempts = participant ? await getAttempts("prompt", room.id, participant.id) : [];
    const attemptsLeft = Math.max(0, PROMPT_ATTEMPT_LIMIT - attempts.length);
    const hasWon = attempts.some((attempt) => attempt.isSuccess);
    const hasPending = attempts.some((attempt) => attempt.status === "pending");
    const leaderboards = await getPromptLeaderboards(room.id);

    return {
      room: {
        id: room.id,
        publicTitle: room.titleAsAnswer,
        titleAsAnswer: room.titleAsAnswer,
        answerType: room.answerType,
        categoryName: room.category.name,
        categorySlug: room.category.slug,
        maxInputChars: room.maxInputChars,
        thresholdScore: room.thresholdScore,
        teaserText: room.teaserText,
        tone: room.tone,
        successCount: leaderboards.successOrder.length,
      },
      conversation: buildPromptConversation(room, attempts),
      player: {
        participant,
        attemptsUsed: attempts.length,
        attemptsLeft,
        hasWon,
        hasPending,
        isLocked: hasWon || hasPending || attemptsLeft <= 0,
        characterState: hasPending
          ? "cooldown_or_locked"
          : attempts[attempts.length - 1]?.characterState || "idle",
        statusText: buildPromptStatusText({
          hasWon,
          attemptsLeft,
          pending: hasPending,
        }),
        history: attempts.map((attempt) => ({
          id: attempt.id,
          inputText: attempt.inputText,
          finalScore: attempt.finalScore,
          aiMessage: attempt.aiMessage,
          reactionCategory: attempt.reactionCategory,
          createdAt: attempt.createdAt,
        })),
      },
      stats: {
        recentAttempts: await getRecentAttempts("prompt", room.id),
      },
      leaderboards,
    };
  }

  async function insertWin(mode, targetId, participantId, attemptId, executor = pool) {
    await executor.query(
      `
        INSERT INTO wins (mode, target_id, participant_id, winning_attempt_id)
        VALUES (?, ?, ?, ?)
      `,
      [mode, targetId, participantId, attemptId],
    );
  }

  const routeDeps = {
    PROMPT_ATTEMPT_LIMIT,
    WORD_AI_HINT_LIMIT,
    WORD_HINT_TYPES,
    authService,
    blendPromptScores,
    buildPlayerPayload,
    buildPromptInvalidMessage,
    buildPromptState,
    buildPromptSuccessMessage,
    buildStoredHintType,
    buildTodayDateString,
    buildWordReactionMeta,
    buildWordSnapshot,
    buildWordSuccessMessage,
    clamp,
    clearSessionCookie,
    config,
    ensureDailyWordChallengeAvailable,
    ensureParticipant,
    ensureWordInputValid,
    evaluatePromptInput,
    expandProposal,
    getDailySynonyms,
    getDailyWordChallenge,
    getNickname,
    getParticipant,
    getPlayerToken,
    getPromptHomeLeaderboards,
    getPromptLeaderboards,
    getPromptRoom,
    getSharedWordAiHints,
    getWordLeaderboards,
    insertWin,
    isDuplicateKeyError,
    isWordMatch,
    listCategories,
    listPromptRooms,
    lockParticipantState,
    mapPromptCategory,
    pool,
    requestLambdaOperation,
    requireAdmin,
    requireAuth,
    respondAuthError,
    safeJsonParse,
    setSessionCookie,
    stripSpacingAndPunctuation,
    withTransaction,
    wordTurnService,
  };

  registerHealthRoutes(app, routeDeps);
  registerAuthRoutes(app, routeDeps);
  registerWordRoutes(app, routeDeps);
  registerPromptRoutes(app, routeDeps);
  registerProposalRoutes(app, routeDeps);
  registerAdminRoutes(app, routeDeps);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};



