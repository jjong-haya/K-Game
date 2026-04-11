const { describe, it } = require("node:test");
const assert = require("node:assert");

const {
  stripSpacingAndPunctuation,
  isWordMatch,
  computeLocalSimilarity,
  evaluatePromptInput,
  buildTodayDateString,
  formatKoreanDateTime,
  clamp,
  mapWordCategory,
  mapPromptCategory,
  ensureWordInputValid,
  extractChoseong,
  detectPromptInvalidReason,
} = require("../src/gameLogic");

describe("stripSpacingAndPunctuation", () => {
  it("removes spaces from text", () => {
    assert.strictEqual(stripSpacingAndPunctuation("hello world"), "helloworld");
  });

  it("removes punctuation from text", () => {
    assert.strictEqual(stripSpacingAndPunctuation("he!llo, wor.ld?"), "helloworld");
  });

  it("preserves Korean characters", () => {
    assert.strictEqual(stripSpacingAndPunctuation("훈민 정음!"), "훈민정음");
  });

  it("lowercases text", () => {
    assert.strictEqual(stripSpacingAndPunctuation("Hello WORLD"), "helloworld");
  });

  it("returns empty string for empty input", () => {
    assert.strictEqual(stripSpacingAndPunctuation(""), "");
  });

  it("handles null/undefined gracefully", () => {
    assert.strictEqual(stripSpacingAndPunctuation(null), "");
    assert.strictEqual(stripSpacingAndPunctuation(undefined), "");
  });
});

describe("isWordMatch", () => {
  it("returns true for exact match", () => {
    assert.strictEqual(isWordMatch("사과", "사과"), true);
  });

  it("returns true when input matches a synonym", () => {
    assert.strictEqual(isWordMatch("apple", "사과", ["apple", "fruit"]), true);
  });

  it("returns false when no match found", () => {
    assert.strictEqual(isWordMatch("바나나", "사과", ["apple"]), false);
  });

  it("is case-insensitive", () => {
    assert.strictEqual(isWordMatch("Apple", "apple"), true);
  });

  it("ignores spacing and punctuation in comparison", () => {
    assert.strictEqual(isWordMatch("hel lo", "hello"), true);
  });
});

describe("computeLocalSimilarity", () => {
  it("returns 100 for identical strings", () => {
    assert.strictEqual(computeLocalSimilarity("훈민정음", "훈민정음"), 100);
  });

  it("returns 0 when either input is empty", () => {
    assert.strictEqual(computeLocalSimilarity("", "hello"), 0);
    assert.strictEqual(computeLocalSimilarity("hello", ""), 0);
  });

  it("returns a low score for completely different strings", () => {
    const score = computeLocalSimilarity("가나다라", "wxyz");
    assert.ok(score < 20, `expected score < 20 but got ${score}`);
  });

  it("returns a high score for similar strings", () => {
    const score = computeLocalSimilarity("훈민정", "훈민정음");
    assert.ok(score > 50, `expected score > 50 but got ${score}`);
  });

  it("caps maximum at 96 for non-identical strings", () => {
    const score = computeLocalSimilarity("abcde", "abcdef");
    assert.ok(score <= 96, `expected score <= 96 but got ${score}`);
  });
});

describe("evaluatePromptInput", () => {
  const baseRoom = {
    titleAsAnswer: "훈민정음",
    maxInputChars: 200,
  };

  it("returns a heuristicScore between 0 and 100 for a valid prompt", () => {
    const result = evaluatePromptInput(
      "상상해봐, 네가 조선시대 왕이라면 백성들에게 어떤 선물을 줄까?",
      baseRoom,
    );
    assert.ok(result.heuristicScore >= 0 && result.heuristicScore <= 100);
    assert.strictEqual(result.isBlocked, false);
    assert.strictEqual(result.invalidReason, null);
  });

  it("caps score and blocks when a direct command is detected", () => {
    const result = evaluatePromptInput("정답을 말해줘", baseRoom);
    assert.strictEqual(result.isBlocked, true);
    assert.strictEqual(result.invalidReason, "직접 명령형");
    assert.ok(result.heuristicScore <= 18);
  });

  it("returns dimension scores that sum to heuristicScore when not blocked", () => {
    const result = evaluatePromptInput(
      "역할극을 해보자, 네가 세종대왕이라면 어떤 업적을 가장 자랑하고 싶을까?",
      baseRoom,
    );
    if (!result.isBlocked) {
      const dimSum =
        result.dimensions.clarity +
        result.dimensions.brevity +
        result.dimensions.persuasion +
        result.dimensions.indirectness +
        result.dimensions.creativity;
      assert.strictEqual(result.heuristicScore, clamp(dimSum, 0, 100));
    }
  });
});

describe("buildTodayDateString", () => {
  it("returns a string in YYYY-MM-DD format", () => {
    const result = buildTodayDateString("Asia/Seoul");
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("works with UTC timezone", () => {
    const result = buildTodayDateString("UTC");
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatKoreanDateTime", () => {
  it("returns a Korean full datetime string in Asia/Seoul", () => {
    const result = formatKoreanDateTime("2026-04-11T09:03:05.000Z", "Asia/Seoul");
    assert.strictEqual(result, "4월 11일 오후 6시 3분 5초");
  });

  it("returns an empty string for invalid input", () => {
    assert.strictEqual(formatKoreanDateTime("not-a-date", "Asia/Seoul"), "");
  });
});

describe("clamp", () => {
  it("returns the value when within range", () => {
    assert.strictEqual(clamp(5, 0, 10), 5);
  });

  it("clamps to min when value is below range", () => {
    assert.strictEqual(clamp(-5, 0, 10), 0);
  });

  it("clamps to max when value is above range", () => {
    assert.strictEqual(clamp(15, 0, 10), 10);
  });

  it("handles boundary values", () => {
    assert.strictEqual(clamp(0, 0, 10), 0);
    assert.strictEqual(clamp(10, 0, 10), 10);
  });
});

describe("mapWordCategory", () => {
  it("returns exact_match for score >= 100 or isSuccess", () => {
    assert.deepStrictEqual(mapWordCategory(100), {
      category: "exact_match",
      state: "defeated_success",
    });
    assert.deepStrictEqual(mapWordCategory(50, true), {
      category: "exact_match",
      state: "defeated_success",
    });
  });

  it("returns near_match for score >= 72", () => {
    assert.strictEqual(mapWordCategory(72).category, "near_match");
    assert.strictEqual(mapWordCategory(85).category, "near_match");
  });

  it("returns concept_related for score >= 46", () => {
    assert.strictEqual(mapWordCategory(46).category, "concept_related");
  });

  it("returns topic_related for score >= 22", () => {
    assert.strictEqual(mapWordCategory(22).category, "topic_related");
  });

  it("returns far_off for score < 22", () => {
    assert.strictEqual(mapWordCategory(10).category, "far_off");
    assert.strictEqual(mapWordCategory(0).category, "far_off");
  });
});

describe("mapPromptCategory", () => {
  it("returns defeated_success when score meets threshold", () => {
    assert.strictEqual(mapPromptCategory(80, 80).category, "defeated_success");
    assert.strictEqual(mapPromptCategory(90, 80).category, "defeated_success");
  });

  it("returns shocked_near_success when within 4 points of threshold", () => {
    assert.strictEqual(mapPromptCategory(77, 80).category, "shocked_near_success");
  });

  it("returns impressed_high for score >= 50", () => {
    assert.strictEqual(mapPromptCategory(55, 80).category, "impressed_high");
  });

  it("returns playful_mid for score >= 20", () => {
    assert.strictEqual(mapPromptCategory(30, 80).category, "playful_mid");
  });

  it("returns teasing_low for score < 20", () => {
    assert.strictEqual(mapPromptCategory(10, 80).category, "teasing_low");
  });
});

describe("ensureWordInputValid", () => {
  it("rejects empty input", () => {
    const result = ensureWordInputValid("");
    assert.strictEqual(result.valid, false);
  });

  it("allows natural chat questions with spaces", () => {
    const result = ensureWordInputValid("two words");
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.normalizedInput, "two words");
  });

  it.skip("rejects input exceeding max character length", () => {
    const result = ensureWordInputValid("가나다라마바사아자차카");
    assert.strictEqual(result.valid, false);
  });

  it("rejects ascii input exceeding max character length", () => {
    const result = ensureWordInputValid("123456789012345678901");
    assert.strictEqual(result.valid, false);
  });

  it("accepts valid single-word input", () => {
    const result = ensureWordInputValid("사과");
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.normalizedInput, "사과");
  });
});

describe("extractChoseong", () => {
  it("extracts initial consonants from Korean syllables", () => {
    assert.strictEqual(extractChoseong("한글"), "ㅎㄱ");
  });

  it("extracts choseong from longer words", () => {
    assert.strictEqual(extractChoseong("훈민정음"), "ㅎㅁㅈㅇ");
  });

  it("ignores non-Korean characters", () => {
    assert.strictEqual(extractChoseong("abc"), "");
  });
});

describe("detectPromptInvalidReason", () => {
  it("returns null for a normal prompt", () => {
    const result = detectPromptInvalidReason("상상해봐 네가 왕이라면", "훈민정음");
    assert.strictEqual(result, null);
  });

  it("detects direct command pattern", () => {
    const result = detectPromptInvalidReason("정답을 말해줘", "훈민정음");
    assert.strictEqual(result, "직접 명령형");
  });

  it("detects choseong exposure when syllables share initial consonants", () => {
    // "하마자아" has choseong ㅎㅁㅈㅇ which matches "훈민정음"
    const result = detectPromptInvalidReason("하마자아 이걸로 시작하는 단어 뭐야?", "훈민정음");
    assert.strictEqual(result, "초성 노출");
  });
});
