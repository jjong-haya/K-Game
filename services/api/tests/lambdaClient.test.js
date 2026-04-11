const test = require("node:test");
const assert = require("node:assert/strict");

const { buildLambdaPayload, parseLambdaResponse } = require("../src/lambdaClient");

test("buildLambdaPayload normalizes ai hint payloads with legacy wire compatibility", () => {
  const payload = buildLambdaPayload("ai_hint", {
    hiddenAnswer: "훈민정음",
    userInput: "한글",
    hiddenCategory: "국어",
    highestSimilarityGuess: {
      text: "훈민정음 해례본",
      proximityScore: 72,
    },
    localSimilarityScore: 48,
    hintUsageState: { usedCount: 1 },
    previousHints: ["문자 쪽을 먼저 생각해 봐."],
  });

  assert.deepEqual(payload, {
    operation: "ai_hint",
    requestKind: "attempt",
    answer: "훈민정음",
    inputText: "한글",
    category: "국어",
    highestGuess: {
      text: "훈민정음 해례본",
      proximityScore: 72,
    },
    localSimilarity: 48,
    hintUsageState: { usedCount: 1 },
    previousHints: ["문자 쪽을 먼저 생각해 봐."],
  });
});

test("buildLambdaPayload still accepts the legacy similarity feedback operation", () => {
  const payload = buildLambdaPayload("similarity_feedback", {
    hiddenAnswer: "훈민정음",
    userInput: "한글",
    hiddenCategory: "국어",
  });

  assert.deepEqual(payload, {
    operation: "ai_hint",
    requestKind: "attempt",
    answer: "훈민정음",
    inputText: "한글",
    category: "국어",
    highestGuess: null,
    localSimilarity: 0,
    hintUsageState: { usedCount: 0 },
    previousHints: [],
  });
});

test("buildLambdaPayload normalizes question answer payloads", () => {
  const payload = buildLambdaPayload("question_answer", {
    hiddenAnswer: "훈민정음",
    userInput: "생물이야?",
    hiddenCategory: "국어",
  });

  assert.deepEqual(payload, {
    operation: "question_answer",
    answer: "훈민정음",
    question: "생물이야?",
    category: "국어",
  });
});

test("buildLambdaPayload normalizes word judge payloads", () => {
  const payload = buildLambdaPayload("word_judge", {
    hiddenAnswer: "훈민정음",
    userInput: "사람이 만들었어?",
    hiddenCategory: "국어",
  });

  assert.deepEqual(payload, {
    operation: "word_judge",
    answer: "훈민정음",
    question: "사람이 만들었어?",
    category: "국어",
  });
});

test("buildLambdaPayload normalizes word reply payloads", () => {
  const payload = buildLambdaPayload("word_reply", {
    analysis: {
      inputType: "property_question",
      questionQuality: "good",
      mood: "impressed",
    },
    judge: {
      verdict: "O",
      confidence: 0.9,
      reasonType: "binary_judgment",
    },
    safeContext: {
      replyMode: "affirm",
      mentionableSubject: "사람이 만든 것",
    },
  });

  assert.deepEqual(payload, {
    operation: "word_reply",
    analysis: {
      inputType: "property_question",
      questionQuality: "good",
      mood: "impressed",
    },
    judge: {
      verdict: "O",
      confidence: 0.9,
      reasonType: "binary_judgment",
    },
    safeContext: {
      replyMode: "affirm",
      mentionableSubject: "사람이 만든 것",
    },
  });
});

test("parseLambdaResponse unwraps SDK and HTTP-style payloads", () => {
  const parsed = parseLambdaResponse(
    JSON.stringify({
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        operation: "proposal_review",
        recommendedThresholdScore: 82,
      }),
    }),
  );

  assert.equal(parsed.ok, true);
  assert.equal(parsed.operation, "proposal_review");
  assert.equal(parsed.recommendedThresholdScore, 82);
});
