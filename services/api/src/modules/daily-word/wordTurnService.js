const { requestLambdaOperation } = require("../../lambdaClient");

const VALID_INPUT_TYPES = new Set(["property_question", "direct_guess", "answer_request", "unclear"]);
const VALID_QUESTION_QUALITIES = new Set(["bad", "weak", "okay", "good", "excellent"]);
const VALID_MOODS = new Set(["neutral", "playful", "teasing", "impressed", "confused", "suspicious"]);
const VALID_VERDICTS = new Set(["O", "X", "?"]);
const VALID_REASON_TYPES = new Set(["binary_judgment", "ambiguous_truth", "non_binary_question"]);
const VALID_REPLY_MODES = new Set([
  "affirm",
  "deny",
  "ambiguous",
  "reject_guess",
  "reject_answer_request",
  "unclear",
]);
const VALID_EMOJI_KEYS = new Set([
  "neutral",
  "smile",
  "tease",
  "thinking",
  "confused",
  "impressed",
  "suspicious",
  "shock",
]);

const VERDICT_SCORE_MAP = {
  O: 70,
  X: 20,
  "?": 45,
};
const MAX_AI_ATTEMPTS = 3;
const RETRY_EXHAUSTED_MESSAGE = "나 지금 머리가 좀 아파. 다시 질문해줘..";

function compactText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function trimText(value, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeInputType(value) {
  return VALID_INPUT_TYPES.has(value) ? value : "unclear";
}

function normalizeQuestionQuality(value) {
  return VALID_QUESTION_QUALITIES.has(value) ? value : "okay";
}

function normalizeMood(value) {
  return VALID_MOODS.has(value) ? value : "neutral";
}

function normalizeVerdict(value) {
  return VALID_VERDICTS.has(value) ? value : "?";
}

function normalizeReasonType(value) {
  return VALID_REASON_TYPES.has(value) ? value : "non_binary_question";
}

function normalizeReplyMode(value) {
  return VALID_REPLY_MODES.has(value) ? value : "unclear";
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(1, numeric));
}

function normalizeIntensity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0.45;
  }

  return Math.max(0, Math.min(1, numeric));
}

function hasQuestionAnswerFields(raw) {
  return Boolean(
    raw
      && typeof raw === "object"
      && trimText(raw.chatReply || raw.message, 200)
      && trimText(raw.characterLine || raw.friendReply || raw.reactionLine, 200)
      && trimText(raw.innerThought, 220)
      && VALID_VERDICTS.has(String(raw.verdict || raw.tag || raw.answer || "").trim())
      && trimText(raw.emotion || raw.reactionEmoji, 16),
  );
}

async function invokeWithRetries(invoke, validate) {
  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
    try {
      const raw = await invoke();
      if (validate(raw)) {
        return raw;
      }
    } catch (_error) {
      // Treat every Lambda/network/shape failure the same and retry.
    }
  }

  return null;
}

function hasAnswerLeak(value, hiddenAnswer) {
  const compactValue = compactText(value);
  const compactAnswer = compactText(hiddenAnswer);

  if (!compactValue || !compactAnswer) {
    return false;
  }

  return compactValue.includes(compactAnswer);
}

function hasWordTurnAnswerLeak(wordTurn, hiddenAnswer) {
  if (!wordTurn || typeof wordTurn !== "object") {
    return false;
  }

  return [
    wordTurn.chatReply,
    wordTurn.characterLine,
    wordTurn.friendReply,
    wordTurn.innerThought,
  ].some((value) => hasAnswerLeak(value, hiddenAnswer));
}

function mapMoodFromVerdict(verdict) {
  if (verdict === "O") {
    return "impressed";
  }

  if (verdict === "X") {
    return "teasing";
  }

  return "confused";
}

function mapReplyModeFromVerdict(verdict) {
  if (verdict === "O") {
    return "affirm";
  }

  if (verdict === "X") {
    return "deny";
  }

  return "ambiguous";
}

function mapEmojiKeyFromEmoji(emoji, fallback = "neutral") {
  const normalized = trimText(emoji, 16);
  const table = {
    "🙂": "neutral",
    "😄": "smile",
    "😅": "smile",
    "😏": "tease",
    "🙄": "tease",
    "🤔": "thinking",
    "😵": "confused",
    "😳": "impressed",
    "🧐": "suspicious",
    "🤯": "shock",
  };

  return table[normalized] || fallback;
}

function normalizeQuestionAnswerTurn(raw) {
  if (!hasQuestionAnswerFields(raw)) {
    return null;
  }

  const verdict = normalizeVerdict(String(raw.verdict || raw.tag || raw.answer || "").trim());
  const chatReply = trimText(raw.chatReply || raw.message, 200);
  const characterLine = trimText(raw.characterLine || raw.friendReply || raw.reactionLine, 200);
  const innerThought = trimText(raw.innerThought, 220);
  const rawEmoji = trimText(raw.emotion || raw.reactionEmoji, 16);

  if (!chatReply || !characterLine || !innerThought || !rawEmoji) {
    return null;
  }

  const mood = mapMoodFromVerdict(verdict);
  const fallbackEmotion = buildDefaultEmotion(mood, verdict, "okay");
  const emojiKey = mapEmojiKeyFromEmoji(rawEmoji, fallbackEmotion.emojiKey);

  return {
    analysis: {
      inputType: "property_question",
      questionQuality: "okay",
      mood,
    },
    judge: {
      verdict,
      confidence: verdict === "?" ? 0.45 : 0.85,
      reasonType: verdict === "?" ? "non_binary_question" : "binary_judgment",
    },
    safeContext: {
      replyMode: mapReplyModeFromVerdict(verdict),
      mentionableSubject: null,
    },
    chatReply,
    friendReply: characterLine,
    characterLine,
    emotion: {
      emojiKey,
      label: fallbackEmotion.label,
      intensity: fallbackEmotion.intensity,
      emoji: rawEmoji,
    },
    innerThought,
  };
}

function buildDefaultEmotion(mood, verdict, questionQuality = "okay") {
  const moodToEmoji = {
    neutral: "neutral",
    playful: "smile",
    teasing: "tease",
    impressed: verdict === "?" ? "shock" : "impressed",
    confused: "confused",
    suspicious: "suspicious",
  };
  const qualityBoost = {
    bad: 0.22,
    weak: 0.32,
    okay: 0.46,
    good: 0.6,
    excellent: 0.78,
  };
  const emojiKey = moodToEmoji[normalizeMood(mood)] || "neutral";
  const labelMap = {
    neutral: "차분",
    smile: "여유",
    tease: "놀리는 중",
    thinking: "생각 중",
    confused: "헷갈림",
    impressed: "감탄",
    suspicious: "수상함",
    shock: "깜짝",
  };

  return {
    emojiKey,
    label: labelMap[emojiKey] || "차분",
    intensity: qualityBoost[normalizeQuestionQuality(questionQuality)] ?? 0.45,
  };
}

function mapEmotionToLegacyState(emojiKey) {
  switch (emojiKey) {
    case "tease":
      return "teasing_low";
    case "smile":
      return "playful_mid";
    case "impressed":
      return "impressed_high";
    case "shock":
      return "shocked_near_success";
    case "thinking":
      return "cooldown_or_locked";
    default:
      return "idle";
  }
}

function buildTransientFailureTurn() {
  return {
    analysis: {
      inputType: "unclear",
      questionQuality: "okay",
      mood: "confused",
    },
    judge: {
      verdict: "?",
      confidence: 0,
      reasonType: "non_binary_question",
    },
    safeContext: {
      replyMode: "unclear",
      mentionableSubject: null,
    },
    chatReply: RETRY_EXHAUSTED_MESSAGE,
    friendReply: RETRY_EXHAUSTED_MESSAGE,
    characterLine: RETRY_EXHAUSTED_MESSAGE,
    emotion: {
      emojiKey: "confused",
      label: "재시도 종료",
      intensity: 0.64,
      emoji: "😵",
    },
    innerThought: "세 번 다시 생각해봤는데도 답이 안 섰다. 다시 질문을 받아야 한다.",
  };
}

function normalizeStoredWordTurn(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value.wordTurnV2 && typeof value.wordTurnV2 === "object" ? value.wordTurnV2 : value;
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const analysis = raw.analysis || {};
  const judge = raw.judge || {};
  const safeContext = raw.safeContext || {};
  const emotion = raw.emotion || {};
  const fallbackEmotion = buildDefaultEmotion(analysis.mood, judge.verdict, analysis.questionQuality);
  const emojiKey = VALID_EMOJI_KEYS.has(String(emotion.emojiKey || "").trim())
    ? String(emotion.emojiKey || "").trim()
    : fallbackEmotion.emojiKey;
  const characterLine = trimText(raw.characterLine || raw.friendReply, 200);

  if (!trimText(raw.chatReply, 200)) {
    return null;
  }

  return {
    analysis: {
      inputType: normalizeInputType(String(analysis.inputType || "").trim()),
      questionQuality: normalizeQuestionQuality(String(analysis.questionQuality || "").trim()),
      mood: normalizeMood(String(analysis.mood || "").trim()),
    },
    judge: {
      verdict: normalizeVerdict(String(judge.verdict || "").trim()),
      confidence: normalizeConfidence(judge.confidence),
      reasonType: normalizeReasonType(String(judge.reasonType || "").trim()),
    },
    safeContext: {
      replyMode: normalizeReplyMode(String(safeContext.replyMode || "").trim()),
      mentionableSubject: trimText(safeContext.mentionableSubject, 80) || null,
    },
    chatReply: trimText(raw.chatReply, 200),
    friendReply: characterLine,
    characterLine,
    emotion: {
      emojiKey,
      label: trimText(emotion.label, 32) || fallbackEmotion.label,
      intensity: normalizeIntensity(emotion.intensity ?? fallbackEmotion.intensity),
      emoji: trimText(emotion.emoji, 16) || null,
    },
    innerThought: trimText(raw.innerThought, 220),
  };
}

function createWordTurnService({
  pool,
  withTransaction,
  getParticipant,
  ensureParticipant,
  lockParticipantState,
  buildWordSnapshot,
  wordAttemptLimit,
}) {
  async function reserveAttempt({ challenge, auth, inputText }) {
    const participant =
      (await getParticipant("word", challenge.id, { userId: auth.user.id })) ||
      (await ensureParticipant("word", challenge.id, auth.user.id, auth.token, auth.user.nickname));

    if (!participant) {
      const error = new Error("먼저 로그인하고 입장해.");
      error.status = 400;
      throw error;
    }

    const reservedAttempt = await withTransaction(async (connection) => {
      const { attempts } = await lockParticipantState(connection, participant.id);

      if (attempts.some((attempt) => attempt.status === "pending")) {
        const error = new Error("AI가 아직 계산 중이야. 조금만 기다려.");
        error.status = 409;
        throw error;
      }
      if (attempts.some((attempt) => attempt.isSuccess)) {
        const error = new Error("오늘의 단어는 이미 맞혔어. 오늘은 여기까지.");
        error.status = 409;
        throw error;
      }
      if (attempts.length >= wordAttemptLimit) {
        const error = new Error("오늘 기회는 다 썼다. 이제 내일 와.");
        error.status = 409;
        throw error;
      }

      const attemptIndex = attempts.length + 1;
      const [insertResult] = await connection.query(
        `
          INSERT INTO attempts (
            mode,
            target_id,
            participant_id,
            attempt_index,
            input_text,
            normalized_input,
            status
          )
          VALUES ('word', ?, ?, ?, ?, ?, 'pending')
        `,
        [challenge.id, participant.id, attemptIndex, inputText, compactText(inputText)],
      );

      return {
        attemptId: Number(insertResult.insertId),
        attemptIndex,
        participant,
      };
    });

    return reservedAttempt;
  }

  async function dropPendingAttempt(attemptId) {
    await pool.query("DELETE FROM attempts WHERE id = ? AND status = 'pending'", [attemptId]);
  }

  async function persistCompletedAttempt({ attemptId, challenge, participantId, inputText, wordTurn }) {
    const finalScore = VERDICT_SCORE_MAP[wordTurn.judge.verdict] ?? VERDICT_SCORE_MAP["?"];
    const legacyState = mapEmotionToLegacyState(wordTurn.emotion.emojiKey);

    await withTransaction(async (connection) => {
      const [updateResult] = await connection.query(
        `
          UPDATE attempts
          SET
            status = 'completed',
            primary_score = ?,
            final_score = ?,
            dimension_json = ?,
            reaction_category = ?,
            character_state = ?,
            ai_message = ?,
            is_success = 0,
            responded_at = NOW()
          WHERE id = ? AND status = 'pending'
        `,
        [
          finalScore,
          finalScore,
          JSON.stringify({ wordTurnV2: wordTurn }),
          wordTurn.analysis.inputType,
          legacyState,
          wordTurn.chatReply,
          attemptId,
        ],
      );

      if (!updateResult.affectedRows) {
        const error = new Error("이미 처리된 시도입니다. 새로고침 후 다시 확인해 주세요.");
        error.status = 409;
        throw error;
      }

      await connection.query(
        `
          UPDATE participants
          SET updated_at = NOW()
          WHERE id = ?
        `,
        [participantId],
      );
    });

    return {
      id: attemptId,
      inputText,
      finalScore,
      aiMessage: wordTurn.chatReply,
      reactionCategory: wordTurn.analysis.inputType,
      characterState: legacyState,
      wordTurn,
      isSuccess: false,
      challengeId: challenge.id,
    };
  }

  async function submitAttempt({ challenge, auth, inputText, model = "nova" }) {
    const { attemptId, attemptIndex, participant } = await reserveAttempt({ challenge, auth, inputText });
    const finalizedTurn = await invokeWithRetries(
      async () => {
        const questionAnswerRaw = await requestLambdaOperation("question_answer", {
          hiddenAnswer: challenge.hiddenAnswerText,
          userQuestion: inputText,
        }, model);

        if (questionAnswerRaw?.error || !hasQuestionAnswerFields(questionAnswerRaw)) {
          return null;
        }

        const normalizedTurn = normalizeQuestionAnswerTurn(questionAnswerRaw);
        if (!normalizedTurn || hasWordTurnAnswerLeak(normalizedTurn, challenge.hiddenAnswerText)) {
          return null;
        }

        return normalizedTurn;
      },
      Boolean,
    );

    if (!finalizedTurn) {
      await dropPendingAttempt(attemptId);
      return {
        transientFailure: true,
        temporaryTurn: buildTransientFailureTurn(),
        snapshot: await buildWordSnapshot(auth.user.id),
      };
    }

    const attempt = await persistCompletedAttempt({
      attemptId,
      challenge,
      participantId: participant.id,
      inputText,
      wordTurn: finalizedTurn,
    });

    return {
      attempt: {
        ...attempt,
        attemptIndex,
      },
      snapshot: await buildWordSnapshot(auth.user.id),
    };
  }

  return {
    submitAttempt,
  };
}

module.exports = {
  VERDICT_SCORE_MAP,
  buildTransientFailureTurn,
  createWordTurnService,
  mapEmotionToLegacyState,
  normalizeQuestionAnswerTurn,
  normalizeStoredWordTurn,
  __private: {
    buildDefaultEmotion,
    hasQuestionAnswerFields,
    hasWordTurnAnswerLeak,
    mapEmojiKeyFromEmoji,
  },
};
