const test = require("node:test");
const assert = require("node:assert/strict");

const lambda = require("../src");

test("maskHiddenAnswerInMessage masks the hidden answer", () => {
  const masked = lambda.__private.maskHiddenAnswerInMessage(
    "The hidden answer is coffee and coffee beans.",
    "coffee",
  );

  assert.equal(masked, "The hidden answer is ** and ** beans.");
});

test("normalizeQuestionAnswerOutput returns safe structured output", () => {
  const normalized = lambda.__private.normalizeQuestionAnswerOutput(
    {
      answer: "X",
      message: "coffee is not part of this answer.",
      reasonType: "binary_judgment",
      reactionState: "teasing_low",
      reactionEmoji: "😒",
      reactionLabel: "별로",
      reactionLine: "coffee? 너무 직접적이네.",
    },
    "coffee",
  );

  assert.deepEqual(normalized, {
    answer: "X",
    tag: "X",
    reasonType: "binary_judgment",
    message: "** is not part of this answer.",
    reactionState: "teasing_low",
    reactionEmoji: "😒",
    reactionLabel: "별로",
    reactionLine: "**? 너무 직접적이네.",
  });
});

test("normalizeQuestionAnswerOutput forces the fixed non-binary message", () => {
  const normalized = lambda.__private.normalizeQuestionAnswerOutput(
    {
      answer: "?",
      message: "anything else",
      reasonType: "non_binary_question",
    },
    "coffee",
  );

  assert.equal(normalized.message, "이 질문은 게임 형식으로 답하기가 애매해요. 조금 더 분명하게 물어봐 주세요.");
});

test("handler returns HTTP 400 when operation is missing", async () => {
  const response = await lambda.handler({
    requestContext: { http: {} },
    body: JSON.stringify({ question: "Is it edible?" }),
  });

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).ok, false);
});
