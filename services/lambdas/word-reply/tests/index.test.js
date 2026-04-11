const test = require("node:test");
const assert = require("node:assert/strict");

const lambda = require("../src");

test("normalizeReplyPayload keeps the judge frame intact", () => {
  const normalized = lambda.__private.normalizeReplyPayload({
    analysis: {
      inputType: "property_question",
      questionQuality: "good",
      mood: "impressed",
    },
    judge: {
      verdict: "O",
      confidence: 0.91,
      reasonType: "binary_judgment",
    },
    safeContext: {
      replyMode: "affirm",
      mentionableSubject: "food category",
    },
  });

  assert.equal(normalized.analysis.inputType, "property_question");
  assert.equal(normalized.judge.verdict, "O");
  assert.equal(normalized.safeContext.replyMode, "affirm");
});

test("normalizeReplyOutput preserves the judge frame and fills emotion defaults", () => {
  const normalized = lambda.__private.normalizeReplyOutput(
    {
      chatReply: "Yes, that sounds right.",
      friendReply: "Yep, that one is solid.",
      innerThought: "The question is sharp enough.",
    },
    lambda.__private.normalizeReplyPayload({
      analysis: {
        inputType: "property_question",
        questionQuality: "excellent",
        mood: "impressed",
      },
      judge: {
        verdict: "O",
        confidence: 0.96,
        reasonType: "binary_judgment",
      },
      safeContext: {
        replyMode: "affirm",
        mentionableSubject: "food category",
      },
    }),
  );

  assert.equal(normalized.judge.verdict, "O");
  assert.equal(normalized.chatReply, "Yes, that sounds right.");
  assert.equal(normalized.friendReply, "Yep, that one is solid.");
  assert.equal(normalized.emotion.emojiKey, "impressed");
});

test("normalizeReplyOutput rejects incomplete payloads", () => {
  const normalized = lambda.__private.normalizeReplyOutput(
    {
      chatReply: "Only one field is not enough.",
    },
    lambda.__private.normalizeReplyPayload({
      analysis: {
        inputType: "unclear",
        questionQuality: "weak",
        mood: "confused",
      },
      judge: {
        verdict: "?",
        confidence: 0.4,
        reasonType: "non_binary_question",
      },
      safeContext: {
        replyMode: "unclear",
        mentionableSubject: null,
      },
    }),
  );

  assert.equal(normalized, null);
});

test("handler returns HTTP 400 when operation is missing", async () => {
  const response = await lambda.handler({
    requestContext: { http: {} },
    body: JSON.stringify({}),
  });

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).ok, false);
});
