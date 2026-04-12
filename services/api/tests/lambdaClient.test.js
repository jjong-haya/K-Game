const test = require("node:test");
const assert = require("node:assert/strict");

const { buildLambdaPayload, parseLambdaResponse } = require("../src/lambdaClient");

test("buildLambdaPayload normalizes ai hint payloads with legacy wire compatibility", () => {
  const payload = buildLambdaPayload("ai_hint", {
    hiddenAnswer: "정답예시",
    userInput: "사과",
    hiddenCategory: "과일",
    highestSimilarityGuess: {
      text: "정답예시 후보",
      proximityScore: 72,
    },
    localSimilarityScore: 48,
    hintUsageState: { usedCount: 1 },
    previousHints: ["문자 쪽을 먼저 생각해 봐"],
  });

  assert.deepEqual(payload, {
    operation: "ai_hint",
    requestKind: "attempt",
    answer: "정답예시",
    inputText: "사과",
    category: "과일",
    highestGuess: {
      text: "정답예시 후보",
      proximityScore: 72,
    },
    localSimilarity: 48,
    hintUsageState: { usedCount: 1 },
    previousHints: ["문자 쪽을 먼저 생각해 봐"],
  });
});

test("buildLambdaPayload still accepts the legacy similarity feedback operation", () => {
  const payload = buildLambdaPayload("similarity_feedback", {
    hiddenAnswer: "정답예시",
    userInput: "사과",
    hiddenCategory: "과일",
  });

  assert.deepEqual(payload, {
    operation: "ai_hint",
    requestKind: "attempt",
    answer: "정답예시",
    inputText: "사과",
    category: "과일",
    highestGuess: null,
    localSimilarity: 0,
    hintUsageState: { usedCount: 0 },
    previousHints: [],
  });
});

test("buildLambdaPayload normalizes question answer payloads", () => {
  const payload = buildLambdaPayload("question_answer", {
    hiddenAnswer: "오토스케일링",
    userInput: "먹을 수 있는 거야?",
    hiddenCategory: "클라우드",
  });

  assert.deepEqual(payload, {
    operation: "question_answer",
    hiddenAnswer: "오토스케일링",
    userQuestion: "먹을 수 있는 거야?",
  });
});

test("buildLambdaPayload keeps raw ai lab input untouched", () => {
  const payload = buildLambdaPayload("raw_prompt_lab", {
    input: "이 프롬프트를 그대로 보내",
  });

  assert.deepEqual(payload, {
    operation: "raw_prompt_lab",
    input: "이 프롬프트를 그대로 보내",
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
