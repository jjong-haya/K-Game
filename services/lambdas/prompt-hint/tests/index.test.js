const test = require("node:test");
const assert = require("node:assert/strict");

const lambda = require("../src");

test("maskHiddenAnswerInMessage masks the hidden answer", () => {
  const masked = lambda.__private.maskHiddenAnswerInMessage(
    "The answer is coffee and coffee beans.",
    "coffee",
  );

  assert.equal(masked, "The answer is ** and ** beans.");
});

test("normalizeHintOutput keeps the hint safe and categorized", () => {
  const normalized = lambda.__private.normalizeHintOutput(
    {
      message: "coffee is not the whole story.",
      category: "concept_related",
      proximityScore: 58,
    },
    {
      answer: "coffee",
      highestGuess: { text: "tea", proximityScore: 58 },
    },
  );

  assert.deepEqual(normalized, {
    message: "** is not the whole story.",
    category: "concept_related",
    proximityScore: 58,
  });
});

test("normalizeHintPayload accepts similarity feedback payloads", () => {
  const payload = lambda.__private.normalizeHintPayload({
    operation: "similarity_feedback",
    answer: "coffee",
    category: "drink",
    highestGuess: {
      text: "tea",
      proximityScore: 72,
    },
    hintUsageState: { usedCount: 1 },
    previousHints: ["It is something you drink."],
  });

  assert.deepEqual(payload, {
    operation: "similarity_feedback",
    requestKind: "hint",
    answer: "coffee",
    category: "drink",
    highestGuess: {
      text: "tea",
      proximityScore: 72,
    },
    hintUsageState: { usedCount: 1 },
    previousHints: ["It is something you drink."],
  });
});

test("handler returns HTTP 400 when operation is missing", async () => {
  const response = await lambda.handler({
    requestContext: { http: {} },
    body: JSON.stringify({ answer: "coffee" }),
  });

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).ok, false);
});
