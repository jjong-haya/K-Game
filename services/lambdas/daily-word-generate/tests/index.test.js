const test = require("node:test");
const assert = require("node:assert/strict");

const lambda = require("../src");

test("normalizeGeneratedChallenge sanitizes leaked hints and keeps the answer in synonyms", () => {
  const normalized = lambda.__private.normalizeGeneratedChallenge(
    {
      publicTitle: "오늘의 단어",
      hiddenAnswerText: "오토스케일링",
      fixedHintText: "오토스케일링은 트래픽에 맞춰 서버를 늘리는 기능입니다.",
      synonyms: ["오토스케일링", "auto scaling", "autoscaling"],
    },
    {
      id: 1,
      slug: "aws-cloud",
      name: "AWS / Cloud",
    },
  );

  assert.equal(normalized.hiddenAnswerText, "오토스케일링");
  assert.equal(normalized.fixedHintText.includes("오토스케일링"), false);
  assert.deepEqual(normalized.synonyms, ["오토스케일링", "auto scaling", "autoscaling"]);
});

test("unwrapPayload maps an EventBridge event to daily_word_generate", () => {
  const payload = lambda.__private.unwrapPayload({
    source: "aws.events",
    "detail-type": "Scheduled Event",
    detail: {
      challengeDate: "2026-04-12",
      categorySlug: "math",
    },
  });

  assert.deepEqual(payload, {
    operation: "daily_word_generate",
    challengeDate: "2026-04-12",
    categorySlug: "math",
  });
});

test("handler returns HTTP 400 when operation is missing for HTTP requests", async () => {
  const response = await lambda.handler({
    requestContext: { http: {} },
    body: JSON.stringify({ challengeDate: "2026-04-12" }),
  });

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).ok, false);
});
