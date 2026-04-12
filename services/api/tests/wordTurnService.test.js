const test = require("node:test");
const assert = require("node:assert/strict");

const {
  VERDICT_SCORE_MAP,
  buildTransientFailureTurn,
  mapEmotionToLegacyState,
  normalizeQuestionAnswerTurn,
  normalizeStoredWordTurn,
  __private,
} = require("../src/wordTurnService");

test("normalizeQuestionAnswerTurn converts the single-stage lambda response into stored word turn shape", () => {
  const normalized = normalizeQuestionAnswerTurn({
    chatReply: "아니, 그건 아냐. 아직 한참 멀었어.",
    characterLine: "진짜 맞춰보려고 애쓰네. 😅",
    innerThought: "아직 정답과는 거리가 많이 멀다.",
    verdict: "X",
    emotion: "🙄",
  });

  assert.equal(normalized.judge.verdict, "X");
  assert.equal(normalized.chatReply, "아니, 그건 아냐. 아직 한참 멀었어.");
  assert.equal(normalized.friendReply, "진짜 맞춰보려고 애쓰네. 😅");
  assert.equal(normalized.characterLine, "진짜 맞춰보려고 애쓰네. 😅");
  assert.equal(normalized.innerThought, "아직 정답과는 거리가 많이 멀다.");
  assert.equal(normalized.emotion.emoji, "🙄");
  assert.equal(normalized.emotion.emojiKey, "tease");
});

test("hasWordTurnAnswerLeak detects hidden answer leakage in visible or internal copy", () => {
  const turn = normalizeQuestionAnswerTurn({
    chatReply: "아니, 오토스케일링은 먹는 게 아니야.",
    characterLine: "너 지금 정답을 그대로 말했네.",
    innerThought: "정답이 오토스케일링이라 바로 걸렸다.",
    verdict: "X",
    emotion: "🙄",
  });

  assert.equal(__private.hasWordTurnAnswerLeak(turn, "오토스케일링"), true);
});

test("normalizeStoredWordTurn preserves characterLine and raw emoji when already saved", () => {
  const normalized = normalizeStoredWordTurn({
    wordTurnV2: {
      analysis: {
        inputType: "property_question",
        questionQuality: "okay",
        mood: "teasing",
      },
      judge: {
        verdict: "X",
        confidence: 0.85,
        reasonType: "binary_judgment",
      },
      safeContext: {
        replyMode: "deny",
        mentionableSubject: null,
      },
      chatReply: "아니, 그건 아냐.",
      characterLine: "또 이상한 쪽으로 갔네. 🙄",
      emotion: {
        emojiKey: "tease",
        label: "놀리는 중",
        intensity: 0.46,
        emoji: "🙄",
      },
      innerThought: "정답과는 거리가 있다.",
    },
  });

  assert.equal(normalized.friendReply, "또 이상한 쪽으로 갔네. 🙄");
  assert.equal(normalized.characterLine, "또 이상한 쪽으로 갔네. 🙄");
  assert.equal(normalized.emotion.emoji, "🙄");
});

test("transient failure turn and verdict mapping stay consistent", () => {
  const transientTurn = buildTransientFailureTurn();

  assert.equal(transientTurn.judge.verdict, "?");
  assert.ok(transientTurn.chatReply);
  assert.equal(transientTurn.friendReply, transientTurn.chatReply);
  assert.equal(transientTurn.characterLine, transientTurn.chatReply);
  assert.equal(VERDICT_SCORE_MAP.O, 70);
  assert.equal(VERDICT_SCORE_MAP.X, 20);
  assert.equal(VERDICT_SCORE_MAP["?"], 45);
  assert.equal(mapEmotionToLegacyState("tease"), "teasing_low");
});

test("emoji mapping keeps common single-emoji responses stable", () => {
  assert.equal(__private.mapEmojiKeyFromEmoji("🙄"), "tease");
  assert.equal(__private.mapEmojiKeyFromEmoji("😳"), "impressed");
  assert.equal(__private.mapEmojiKeyFromEmoji("🤔"), "thinking");
});
