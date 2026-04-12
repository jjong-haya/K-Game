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

test("buildQuestionUserPrompt injects hiddenAnswer and userQuestion into the fixed prompt", () => {
  const prompt = lambda.__private.buildQuestionUserPrompt({
    hiddenAnswer: "오토스케일링",
    userQuestion: "먹을 수 있는 거야?",
  });

  assert.match(prompt, /You are the response engine for a Korean 20-questions game\./);
  assert.match(prompt, /- hiddenAnswer: 오토스케일링/);
  assert.match(prompt, /- userQuestion: 먹을 수 있는 거야\?/);
});

test("normalizeQuestionAnswerOutput keeps the raw single-stage fields", () => {
  const normalized = lambda.__private.normalizeQuestionAnswerOutput({
    chatReply: "아니, 그건 아냐. 아직 한참 멀었어.",
    characterLine: "진짜 맞춰보려고 애쓰네. 😅",
    innerThought: "아직 정답과는 거리가 많이 멀다.",
    verdict: "X",
    emotion: "🙄",
  });

  assert.deepEqual(normalized, {
    chatReply: "아니, 그건 아냐. 아직 한참 멀었어.",
    characterLine: "진짜 맞춰보려고 애쓰네. 😅",
    innerThought: "아직 정답과는 거리가 많이 멀다.",
    verdict: "X",
    emotion: "🙄",
  });
});

test("handler returns HTTP 400 when operation is missing", async () => {
  const response = await lambda.handler({
    requestContext: { http: {} },
    body: JSON.stringify({ question: "Is it edible?" }),
  });

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).ok, false);
});

test("normalizeRawPromptPayload keeps raw input text", () => {
  const normalized = lambda.__private.normalizeRawPromptPayload({
    input: "이 프롬프트를 가공 없이 그대로 보내",
  });

  assert.deepEqual(normalized, {
    operation: "raw_prompt_lab",
    input: "이 프롬프트를 가공 없이 그대로 보내",
  });
});

test("handler returns HTTP 422 when raw prompt input is missing", async () => {
  const response = await lambda.handler({
    requestContext: { http: {} },
    body: JSON.stringify({ operation: "raw_prompt_lab", input: "" }),
  });

  assert.equal(response.statusCode, 422);
  assert.equal(JSON.parse(response.body).code, "missing_input");
});
