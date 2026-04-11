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

function hasAnswerLeak(value, hiddenAnswer) {
  const compactValue = compactText(value);
  const compactAnswer = compactText(hiddenAnswer);

  if (!compactValue || !compactAnswer) {
    return false;
  }

  return compactValue.includes(compactAnswer);
}

function sanitizeMentionableSubject(value, hiddenAnswer) {
  const trimmed = trimText(value, 80);
  if (!trimmed || hasAnswerLeak(trimmed, hiddenAnswer)) {
    return null;
  }

  return trimmed;
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

function buildFallbackFriendReply(analysis, judge) {
  const mood = normalizeMood(analysis?.mood);
  const inputType = normalizeInputType(analysis?.inputType);
  const reasonType = normalizeReasonType(judge?.reasonType);

  if (inputType === "direct_guess") {
    return "ㅋㅋ 그건 질문이라기보다 그냥 찌르기잖아.";
  }

  if (inputType === "answer_request") {
    return "그걸 여기서 바로 까면 게임이 아니지.";
  }

  if (reasonType === "ambiguous_truth") {
    return "이건 내가 대충 끊어서 말하면 오히려 이상해져.";
  }

  if (mood === "impressed") {
    return "오, 그건 제법 잘 들어온 질문인데?";
  }

  if (mood === "teasing") {
    return "너 방금 좀 대충 던졌지? 티 난다.";
  }

  if (mood === "suspicious") {
    return "음, 방금은 좀 노골적으로 찔렀다.";
  }

  if (mood === "confused") {
    return "기준이 흐려서 내가 바로 끊어 말하긴 어렵다.";
  }

  return "좋아, 그렇게 하나씩 좁혀 가면 된다.";
}

function buildFallbackInnerThought(analysis, judge) {
  const inputType = normalizeInputType(analysis?.inputType);
  const quality = normalizeQuestionQuality(analysis?.questionQuality);
  const reasonType = normalizeReasonType(judge?.reasonType);

  if (inputType === "direct_guess") {
    return "이건 속성을 묻는 질문이 아니라 정답 후보를 직접 던진 것이다.";
  }

  if (inputType === "answer_request") {
    return "게임 규칙을 건너뛰고 정답 공개를 요구한 입력이다.";
  }

  if (inputType === "unclear") {
    return "무슨 기준을 묻는지 흐려서 안정적인 판정이 어렵다.";
  }

  if (reasonType === "ambiguous_truth") {
    return "질문은 유효하지만 정의 기준에 따라 답이 갈릴 수 있다.";
  }

  const qualityMap = {
    bad: "질문 방향이 거칠고 정보량이 적다.",
    weak: "나쁘진 않지만 범위를 줄이는 힘은 아직 약하다.",
    okay: "무난하다. 다음 질문에서 기준을 더 선명하게 잡으면 좋다.",
    good: "좋은 질문이다. 정답의 성격을 꽤 효율적으로 좁힌다.",
    excellent: "아주 날카롭다. 핵심 속성을 잘 건드렸다.",
  };

  return qualityMap[quality] || qualityMap.okay;
}

function buildFallbackChatReply(judgeFrame) {
  const { judge, safeContext } = judgeFrame;
  const replyMode = normalizeReplyMode(safeContext?.replyMode);
  const subject = trimText(safeContext?.mentionableSubject, 48);

  if (replyMode === "affirm") {
    return subject ? `응, ${subject} 쪽이 맞아.` : "응, 맞아.";
  }

  if (replyMode === "deny") {
    return subject ? `아니, ${subject} 쪽은 아니야.` : "아니, 그건 아니야.";
  }

  if (replyMode === "ambiguous") {
    return subject ? `그건 ${subject}라고 딱 잘라 말하긴 애매해.` : "그건 좀 애매해.";
  }

  if (replyMode === "reject_guess") {
    return "그건 질문이라기보다 정답 찍기잖아.";
  }

  if (replyMode === "reject_answer_request") {
    return "정답 자체는 말 못 해. 질문으로 와.";
  }

  if (normalizeReasonType(judge?.reasonType) === "ambiguous_truth") {
    return "그건 기준에 따라 답이 갈릴 수 있어.";
  }

  return "그 말은 판정하기가 좀 애매해. 다시 질문해줘.";
}

function buildWordReplyFallback(judgeFrame) {
  const analysis = judgeFrame.analysis || {};
  const judge = judgeFrame.judge || {};
  const emotion = buildDefaultEmotion(analysis.mood, judge.verdict, analysis.questionQuality);

  return {
    analysis: {
      inputType: normalizeInputType(analysis.inputType),
      questionQuality: normalizeQuestionQuality(analysis.questionQuality),
      mood: normalizeMood(analysis.mood),
    },
    judge: {
      verdict: normalizeVerdict(judge.verdict),
      confidence: normalizeConfidence(judge.confidence),
      reasonType: normalizeReasonType(judge.reasonType),
    },
    safeContext: {
      replyMode: normalizeReplyMode(judgeFrame.safeContext?.replyMode),
      mentionableSubject: trimText(judgeFrame.safeContext?.mentionableSubject, 80) || null,
    },
    chatReply: buildFallbackChatReply(judgeFrame),
    friendReply: buildFallbackFriendReply(analysis, judge),
    emotion,
    innerThought: buildFallbackInnerThought(analysis, judge),
  };
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
    chatReply: "잠깐만, 지금 판정기가 삐끗했어. 같은 질문 한 번만 다시 던져줘.",
    friendReply: "이번 건 네 탓 아니다. 내가 방금 잠깐 꼬였다.",
    emotion: {
      emojiKey: "confused",
      label: "오류",
      intensity: 0.64,
    },
    innerThought: "이번 입력은 처리 실패로 기록하지 않았다.",
  };
}

function normalizeWordJudgeResult(raw, hiddenAnswer) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const analysis = raw.analysis && typeof raw.analysis === "object" ? raw.analysis : {};
  const judge = raw.judge && typeof raw.judge === "object" ? raw.judge : {};
  const safeContext = raw.safeContext && typeof raw.safeContext === "object" ? raw.safeContext : {};

  const normalized = {
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
      mentionableSubject: sanitizeMentionableSubject(safeContext.mentionableSubject, hiddenAnswer),
    },
  };

  if (normalized.analysis.inputType === "direct_guess") {
    normalized.judge.verdict = "?";
    normalized.judge.reasonType = "non_binary_question";
    normalized.safeContext.replyMode = "reject_guess";
  } else if (normalized.analysis.inputType === "answer_request") {
    normalized.judge.verdict = "?";
    normalized.judge.reasonType = "non_binary_question";
    normalized.safeContext.replyMode = "reject_answer_request";
  }

  return normalized;
}

function normalizeWordReplyResult(raw, judgeFrame) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const emotion = raw.emotion && typeof raw.emotion === "object" ? raw.emotion : {};
  const analysis = judgeFrame.analysis || {};
  const judge = judgeFrame.judge || {};
  const safeContext = judgeFrame.safeContext || {};
  const fallbackEmotion = buildDefaultEmotion(analysis.mood, judge.verdict, analysis.questionQuality);
  const emojiKey = VALID_EMOJI_KEYS.has(String(emotion.emojiKey || "").trim())
    ? String(emotion.emojiKey || "").trim()
    : fallbackEmotion.emojiKey;
  const normalized = {
    analysis: {
      inputType: normalizeInputType(analysis.inputType),
      questionQuality: normalizeQuestionQuality(analysis.questionQuality),
      mood: normalizeMood(analysis.mood),
    },
    judge: {
      verdict: normalizeVerdict(judge.verdict),
      confidence: normalizeConfidence(judge.confidence),
      reasonType: normalizeReasonType(judge.reasonType),
    },
    safeContext: {
      replyMode: normalizeReplyMode(safeContext.replyMode),
      mentionableSubject: safeContext.mentionableSubject || null,
    },
    chatReply: trimText(raw.chatReply, 200),
    friendReply: trimText(raw.friendReply, 200),
    emotion: {
      emojiKey,
      label: trimText(emotion.label, 32) || fallbackEmotion.label,
      intensity: normalizeIntensity(emotion.intensity ?? fallbackEmotion.intensity),
    },
    innerThought: trimText(raw.innerThought, 220),
  };

  if (!normalized.chatReply || !normalized.friendReply || !normalized.innerThought) {
    return null;
  }

  return normalized;
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
    friendReply: trimText(raw.friendReply, 200),
    emotion: {
      emojiKey,
      label: trimText(emotion.label, 32) || fallbackEmotion.label,
      intensity: normalizeIntensity(emotion.intensity ?? fallbackEmotion.intensity),
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

    const judgeRaw = await requestLambdaOperation("word_judge", {
      hiddenAnswer: challenge.hiddenAnswerText,
      hiddenCategory: challenge.category.name,
      userInput: inputText,
    }, model);
    const judgeFrame =
      judgeRaw?.error ? null : normalizeWordJudgeResult(judgeRaw, challenge.hiddenAnswerText);

    if (!judgeFrame) {
      await dropPendingAttempt(attemptId);
      return {
        transientFailure: true,
        temporaryTurn: buildTransientFailureTurn(),
        snapshot: await buildWordSnapshot(auth.user.id),
      };
    }

    const replyRaw = await requestLambdaOperation("word_reply", {
      analysis: judgeFrame.analysis,
      judge: judgeFrame.judge,
      safeContext: judgeFrame.safeContext,
    }, model);
    const wordTurn =
      replyRaw?.error ? null : normalizeWordReplyResult(replyRaw, judgeFrame);
    const finalizedTurn = wordTurn || buildWordReplyFallback(judgeFrame);

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
  buildWordReplyFallback,
  createWordTurnService,
  mapEmotionToLegacyState,
  normalizeStoredWordTurn,
  normalizeWordJudgeResult,
  normalizeWordReplyResult,
  __private: {
    buildDefaultEmotion,
    buildFallbackChatReply,
    buildFallbackFriendReply,
    buildFallbackInnerThought,
    sanitizeMentionableSubject,
  },
};
