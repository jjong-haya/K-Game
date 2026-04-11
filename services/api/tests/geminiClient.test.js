const test = require("node:test");
const assert = require("node:assert/strict");

const { maskHiddenAnswerInMessage } = require("../src/geminiClient");

test("maskHiddenAnswerInMessage masks the exact hidden answer", () => {
  const masked = maskHiddenAnswerInMessage(
    "아니야, 훈민정음은 생물이 아니에요.",
    "훈민정음",
  );

  assert.equal(masked, "아니야, **은 생물이 아니에요.");
});

test("maskHiddenAnswerInMessage masks compact matches when the hidden answer has spaces", () => {
  const masked = maskHiddenAnswerInMessage(
    "맞아, 훈민정음해례본 쪽 이야기는 아니야.",
    "훈민정음 해례본",
  );

  assert.equal(masked, "맞아, ** 쪽 이야기는 아니야.");
});

test("maskHiddenAnswerInMessage leaves unrelated messages untouched", () => {
  const masked = maskHiddenAnswerInMessage(
    "아냐, 그건 생물은 아니야.",
    "훈민정음",
  );

  assert.equal(masked, "아냐, 그건 생물은 아니야.");
});
