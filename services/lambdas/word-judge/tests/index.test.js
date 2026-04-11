const test = require("node:test");
const assert = require("node:assert/strict");

const lambda = require("../src");

test("sanitizeMentionableSubject removes answer leaks", () => {
  assert.equal(lambda.__private.sanitizeMentionableSubject("coffee", "coffee"), null);
  assert.equal(lambda.__private.sanitizeMentionableSubject("food category", "coffee"), "food category");
});

test("normalizeJudgeOutput forces direct guesses into the non-binary flow", () => {
  const normalized = lambda.__private.normalizeJudgeOutput(
    {
      analysis: {
        inputType: "direct_guess",
        questionQuality: "weak",
        mood: "teasing",
      },
      judge: {
        verdict: "O",
        confidence: 0.93,
        reasonType: "binary_judgment",
      },
      safeContext: {
        replyMode: "affirm",
        mentionableSubject: "coffee",
      },
    },
    "coffee",
  );

  assert.deepEqual(normalized, {
    analysis: {
      inputType: "direct_guess",
      questionQuality: "weak",
      mood: "teasing",
    },
    judge: {
      verdict: "?",
      confidence: 0.93,
      reasonType: "non_binary_question",
    },
    safeContext: {
      replyMode: "reject_guess",
      mentionableSubject: null,
    },
  });
});

test("normalizeJudgeOutput preserves a stable property judgment", () => {
  const normalized = lambda.__private.normalizeJudgeOutput(
    {
      analysis: {
        inputType: "property_question",
        questionQuality: "good",
        mood: "impressed",
      },
      judge: {
        verdict: "X",
        confidence: 0.88,
        reasonType: "binary_judgment",
      },
      safeContext: {
        replyMode: "deny",
        mentionableSubject: "food category",
      },
    },
    "coffee",
  );

  assert.equal(normalized.analysis.inputType, "property_question");
  assert.equal(normalized.judge.verdict, "X");
  assert.equal(normalized.judge.reasonType, "binary_judgment");
  assert.equal(normalized.safeContext.replyMode, "deny");
  assert.equal(normalized.safeContext.mentionableSubject, "food category");
});

test("handler returns HTTP 400 when operation is missing", async () => {
  const response = await lambda.handler({
    requestContext: { http: {} },
    body: JSON.stringify({ question: "Is it a living thing?" }),
  });

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).ok, false);
});
