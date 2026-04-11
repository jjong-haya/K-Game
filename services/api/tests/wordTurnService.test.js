const test = require("node:test");
const assert = require("node:assert/strict");

const {
  VERDICT_SCORE_MAP,
  buildTransientFailureTurn,
  buildWordReplyFallback,
  mapEmotionToLegacyState,
  normalizeStoredWordTurn,
  normalizeWordJudgeResult,
  normalizeWordReplyResult,
} = require("../src/wordTurnService");

test("normalizeWordJudgeResult forces direct guesses into non-binary judgments", () => {
  const normalized = normalizeWordJudgeResult(
    {
      analysis: {
        inputType: "direct_guess",
        questionQuality: "weak",
        mood: "teasing",
      },
      judge: {
        verdict: "O",
        confidence: 0.91,
        reasonType: "binary_judgment",
      },
      safeContext: {
        replyMode: "affirm",
        mentionableSubject: "훈민정음",
      },
    },
    "훈민정음",
  );

  assert.equal(normalized.analysis.inputType, "direct_guess");
  assert.equal(normalized.judge.verdict, "?");
  assert.equal(normalized.judge.reasonType, "non_binary_question");
  assert.equal(normalized.safeContext.replyMode, "reject_guess");
  assert.equal(normalized.safeContext.mentionableSubject, null);
});

test("buildWordReplyFallback creates stable four-part UI payload", () => {
  const fallback = buildWordReplyFallback({
    analysis: {
      inputType: "property_question",
      questionQuality: "good",
      mood: "impressed",
    },
    judge: {
      verdict: "O",
      confidence: 0.88,
      reasonType: "binary_judgment",
    },
    safeContext: {
      replyMode: "affirm",
      mentionableSubject: "사람이 만든 것",
    },
  });

  assert.equal(fallback.chatReply, "응, 사람이 만든 것 쪽이 맞아.");
  assert.equal(fallback.friendReply.length > 0, true);
  assert.equal(fallback.innerThought.length > 0, true);
  assert.equal(fallback.emotion.emojiKey, "impressed");
});

test("normalizeWordReplyResult preserves judge frame and validates required fields", () => {
  const judgeFrame = {
    analysis: {
      inputType: "property_question",
      questionQuality: "excellent",
      mood: "impressed",
    },
    judge: {
      verdict: "O",
      confidence: 0.97,
      reasonType: "binary_judgment",
    },
    safeContext: {
      replyMode: "affirm",
      mentionableSubject: "사람이 만든 것",
    },
  };

  const normalized = normalizeWordReplyResult(
    {
      judge: {
        verdict: "X",
      },
      chatReply: "응, 사람이 만든 거야.",
      friendReply: "오, 그 질문은 꽤 괜찮았다.",
      emotion: {
        emojiKey: "impressed",
        label: "감탄",
        intensity: 0.58,
      },
      innerThought: "좋은 질문이다. 정답의 성격을 꽤 크게 좁힐 수 있다.",
    },
    judgeFrame,
  );

  assert.equal(normalized.judge.verdict, "O");
  assert.equal(normalized.emotion.emojiKey, "impressed");
  assert.equal(normalized.chatReply, "응, 사람이 만든 거야.");
});

test("normalizeStoredWordTurn reads dimension_json wordTurnV2 payloads", () => {
  const normalized = normalizeStoredWordTurn({
    wordTurnV2: {
      analysis: {
        inputType: "answer_request",
        questionQuality: "bad",
        mood: "teasing",
      },
      judge: {
        verdict: "?",
        confidence: 0.92,
        reasonType: "non_binary_question",
      },
      safeContext: {
        replyMode: "reject_answer_request",
        mentionableSubject: null,
      },
      chatReply: "정답 자체는 말 못 해. 질문으로 와.",
      friendReply: "그걸 여기서 바로 까면 게임이 아니지.",
      emotion: {
        emojiKey: "tease",
        label: "놀림",
        intensity: 0.8,
      },
      innerThought: "게임 규칙을 건너뛰고 정답 공개를 요구한 입력이다.",
    },
  });

  assert.equal(normalized.judge.reasonType, "non_binary_question");
  assert.equal(normalized.chatReply, "정답 자체는 말 못 해. 질문으로 와.");
});

test("transient failure turn and verdict mapping stay consistent", () => {
  const transientTurn = buildTransientFailureTurn();

  assert.equal(transientTurn.judge.verdict, "?");
  assert.equal(VERDICT_SCORE_MAP.O, 70);
  assert.equal(VERDICT_SCORE_MAP.X, 20);
  assert.equal(VERDICT_SCORE_MAP["?"], 45);
  assert.equal(mapEmotionToLegacyState("tease"), "teasing_low");
});
