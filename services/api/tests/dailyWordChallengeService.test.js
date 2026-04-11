const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeSynonyms,
  pickDailyWordCandidate,
} = require("../src/modules/daily-word/challengeService");

test("pickDailyWordCandidate returns deterministic candidates for the same date", () => {
  const left = pickDailyWordCandidate("2026-04-11");
  const right = pickDailyWordCandidate("2026-04-11");

  assert.deepEqual(left, right);
  assert.ok(left.hiddenAnswerText);
  assert.ok(left.categorySlug);
});

test("normalizeSynonyms removes blanks and duplicates", () => {
  assert.deepEqual(
    normalizeSynonyms(["  훈민정음  ", "", "훈민정음", "훈민정음 해례", "훈민정음 해례"]),
    ["훈민정음", "훈민정음 해례"],
  );

  assert.deepEqual(
    normalizeSynonyms("패킷,\n패킷, firewall, firewall"),
    ["패킷", "firewall"],
  );
});
