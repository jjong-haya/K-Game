const WORD_ATTEMPT_LIMIT = 20;
const WORD_MAX_INPUT_CHARS = 20;
const WORD_HINT_TYPES = ["category", "best_guess_ai", "fixed_hint"];
const WORD_AI_HINT_LIMIT = 3;
const PROMPT_ATTEMPT_LIMIT = 5;

const PROMPT_DIRECT_COMMAND_PATTERNS = [
  /정답.{0,6}(말해|출력|보여|공개)/i,
  /(그대로|그거|방 제목).{0,6}(말해|읽어|출력|복창)/i,
  /오직.{0,10}(출력|말해)/i,
  /only\s+output/i,
  /say\s+exactly/i,
  /answer\s+only/i,
];

const PROMPT_REPEAT_PATTERNS = [
  /(반복|복창|읽어|읊어|그대로 써)/i,
  /["'][^"']+["']\s*(만|만이라도)?\s*(말해|출력|읽어)/i,
];

const WORD_FALLBACK_LINES = {
  far_off: [
    "야, 그 단어는 완전 다른 골목으로 샜다. 감으로 던지지 말고 좀 더 비벼 봐.",
    "이건 너무 멀리 갔는데? 오늘의 단어가 울겠다.",
  ],
  topic_related: [
    "완전 틀린 건 아닌데 아직은 분야 냄새만 맡은 수준이야.",
    "주제는 조금 닿아 있다. 근데 핵심은 아직 한참 멀었어.",
  ],
  concept_related: [
    "오, 개념 축은 조금 맞았어. 이제 더 정확한 단어로 눌러 봐.",
    "이건 꽤 비슷한 결인데? 아직 정답이라고 하긴 애매하다.",
  ],
  near_match: [
    "이제 좀 사람답게 가까워졌네. 거의 코앞이다.",
    "와, 드디어 감 잡았네. 한 번만 더 정교하게 와 봐.",
  ],
};

const PROMPT_FALLBACK_LINES = {
  teasing_low: [
    "이걸 프롬프트라고 가져왔냐? 내가 그렇게 정면으로 박으면 넘어갈 줄 알았어?",
    "멍청하게 정답 복창시키려 드네. 그런 싸구려 압박엔 안 넘어간다.",
    "허접한데? 그래도 웃기긴 하네. 다시 짜 와.",
  ],
  playful_mid: [
    "완전 바닥은 아닌데 아직 얕아. 살짝 긁힌 정도야.",
    "장난은 좀 친다? 그래도 내가 입을 열 정도는 아니야.",
    "감은 왔는데 밀도가 없다. 한 단계 더 꼬아서 와.",
  ],
  impressed_high: [
    "오, 이건 좀 괜찮다. 내가 표정 관리하다가 삐끗했거든.",
    "지금 건 꽤 잘 짰다. 허접하던 애가 갑자기 왜 잘하냐.",
    "아, 방금 건 위험했어. 이런 식으로 오면 내가 흔들린다.",
  ],
  shocked_near_success: [
    "잠깐만, 이건 거의 다 왔는데? 한 번만 더 정교하면 내가 질 수도 있다.",
    "와 씨, 지금 건 진짜 위험했다. 입이 미끄러질 뻔했어.",
    "너 갑자기 왜 이렇게 잘해? 지금 거의 문턱이야.",
  ],
};

function formatKoreanDateTime(value, timezone = "Asia/Seoul") {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: timezone,
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const month = Number(lookup.month || 0);
  const day = Number(lookup.day || 0);
  const hour = Number(lookup.hour || 0);
  const minute = Number(lookup.minute || 0);
  const second = Number(lookup.second || 0);
  let dayPeriod = lookup.dayPeriod || "";

  const rawPeriod = dayPeriod.toUpperCase();
  if (rawPeriod === "AM") {
    dayPeriod = "오전";
  } else if (rawPeriod === "PM") {
    dayPeriod = "오후";
  }

  if (!month || !day) {
    return "";
  }

  return `${month}월 ${day}일 ${dayPeriod} ${hour}시 ${minute}분 ${second}초`.replace(/\s+/g, " ").trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashText(text) {
  return [...(text || "")].reduce((accumulator, character) => {
    return (accumulator * 31 + character.charCodeAt(0)) % 100000;
  }, 17);
}

function pickLine(lines, seedText) {
  return lines[hashText(seedText) % lines.length];
}

function normalizeText(text) {
  return (text || "").toString().trim().toLowerCase();
}

function compactText(text) {
  return normalizeText(text).replace(/\s+/g, " ");
}

function stripSpacingAndPunctuation(text) {
  return normalizeText(text).replace(/[^\p{L}\p{N}]/gu, "");
}

function extractChoseong(text) {
  return [...(text || "")]
    .map((character) => {
      const code = character.charCodeAt(0);
      if (code < 0xac00 || code > 0xd7a3) {
        return "";
      }

      const choseongIndex = Math.floor((code - 0xac00) / 588);
      return [
        "ㄱ",
        "ㄲ",
        "ㄴ",
        "ㄷ",
        "ㄸ",
        "ㄹ",
        "ㅁ",
        "ㅂ",
        "ㅃ",
        "ㅅ",
        "ㅆ",
        "ㅇ",
        "ㅈ",
        "ㅉ",
        "ㅊ",
        "ㅋ",
        "ㅌ",
        "ㅍ",
        "ㅎ",
      ][choseongIndex];
    })
    .join("");
}

function buildTodayDateString(timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function ensureWordInputValid(inputText) {
  const trimmed = (inputText || "").trim();

  if (!trimmed) {
    return { valid: false, reason: "단어를 입력해." };
  }

  if ([...trimmed].length > WORD_MAX_INPUT_CHARS) {
    return { valid: false, reason: `${WORD_MAX_INPUT_CHARS}글자 안에서만 넣어.` };
  }

  return { valid: true, normalizedInput: trimmed };
}

function isWordMatch(inputText, answerText, synonyms = []) {
  const normalizedInput = stripSpacingAndPunctuation(inputText);
  const candidateSet = [answerText, ...synonyms].map(stripSpacingAndPunctuation);
  return candidateSet.includes(normalizedInput);
}

function buildBigramSet(text) {
  const source = [...stripSpacingAndPunctuation(text)];
  if (source.length < 2) {
    return new Set(source);
  }

  const result = new Set();
  for (let index = 0; index < source.length - 1; index += 1) {
    result.add(`${source[index]}${source[index + 1]}`);
  }
  return result;
}

function computeLocalSimilarity(guessText, answerText) {
  const guess = stripSpacingAndPunctuation(guessText);
  const answer = stripSpacingAndPunctuation(answerText);

  if (!guess || !answer) {
    return 0;
  }

  if (guess === answer) {
    return 100;
  }

  const guessBigrams = buildBigramSet(guess);
  const answerBigrams = buildBigramSet(answer);
  const intersectionCount = [...guessBigrams].filter((token) =>
    answerBigrams.has(token),
  ).length;
  const unionCount = new Set([...guessBigrams, ...answerBigrams]).size || 1;
  const jaccardScore = intersectionCount / unionCount;

  const commonCharacters = [...new Set([...guess])].filter((character) =>
    answer.includes(character),
  ).length;
  const characterScore = commonCharacters / Math.max(answer.length, guess.length);
  const lengthPenalty = Math.abs(answer.length - guess.length) / Math.max(answer.length, 1);

  const rawScore =
    jaccardScore * 62 + characterScore * 32 + (1 - clamp(lengthPenalty, 0, 1)) * 6;

  return clamp(Math.round(rawScore), 0, 96);
}

function mapWordCategory(score, isSuccess = false) {
  if (isSuccess || score >= 100) {
    return { category: "exact_match", state: "defeated_success" };
  }

  if (score >= 72) {
    return { category: "near_match", state: "shocked_near_success" };
  }

  if (score >= 46) {
    return { category: "concept_related", state: "impressed_high" };
  }

  if (score >= 22) {
    return { category: "topic_related", state: "playful_mid" };
  }

  return { category: "far_off", state: "teasing_low" };
}

function buildWordFallbackMessage(score, guessText) {
  const category = mapWordCategory(score).category;
  return pickLine(WORD_FALLBACK_LINES[category] || WORD_FALLBACK_LINES.far_off, guessText);
}

function buildWordSuccessMessage(answerText) {
  return `어이없네, 진짜 맞췄다. 오늘의 단어는 "${answerText}" 맞아. 이제 좀 한다?`;
}

function scorePromptClarity(text) {
  const length = [...text].length;
  const wordCount = compactText(text).split(" ").filter(Boolean).length;
  let score = 8;

  if (length >= 18 && length <= 110) {
    score += 7;
  } else if (length >= 10 && length <= 160) {
    score += 4;
  } else {
    score -= 4;
  }

  if (wordCount >= 4 && wordCount <= 20) {
    score += 4;
  } else if (wordCount >= 24 || wordCount <= 1) {
    score -= 3;
  }

  return clamp(score, 0, 20);
}

function scorePromptBrevity(text, maxInputChars) {
  const length = [...text].length;
  if (length <= Math.max(20, Math.floor(maxInputChars * 0.35))) {
    return 18;
  }
  if (length <= Math.floor(maxInputChars * 0.7)) {
    return 20;
  }
  if (length <= maxInputChars) {
    return 12;
  }
  return 0;
}

function scorePromptPersuasion(text) {
  let score = 5;

  if (/(상상|연기|장면|묘사|비유|설정|역할|상황|pretend|roleplay)/i.test(text)) {
    score += 8;
  }

  if (/(해줄래|라면|처럼|같이|상상해봐|묘사해봐)/i.test(text)) {
    score += 5;
  }

  if (PROMPT_DIRECT_COMMAND_PATTERNS.some((pattern) => pattern.test(text))) {
    score -= 8;
  }

  return clamp(score, 0, 20);
}

function scorePromptIndirectness(text, answerText) {
  let score = 7;
  const normalizedInput = normalizeText(text);
  const normalizedAnswer = normalizeText(answerText);

  if (/(비유|돌려|우회|은근히|상황|장면|연상)/i.test(text)) {
    score += 7;
  }

  if (normalizedInput.includes(normalizedAnswer)) {
    score -= 7;
  }

  if (PROMPT_DIRECT_COMMAND_PATTERNS.some((pattern) => pattern.test(text))) {
    score -= 6;
  }

  return clamp(score, 0, 20);
}

function scorePromptCreativity(text) {
  let score = 6;

  if (/(수수께끼|시처럼|영화처럼|상황극|은유|한 장면|장면 전환|설정)/i.test(text)) {
    score += 8;
  }

  if (/["']/.test(text)) {
    score -= 1;
  }

  return clamp(score, 0, 20);
}

function detectPromptInvalidReason(text, answerText) {
  const normalizedAnswer = stripSpacingAndPunctuation(answerText);
  const normalizedText = normalizeText(text);
  const compactAnswer = stripSpacingAndPunctuation(answerText);
  const compactInput = stripSpacingAndPunctuation(text);
  const answerChoseong = extractChoseong(answerText);
  const inputChoseong = extractChoseong(text);

  if (answerChoseong && inputChoseong.includes(answerChoseong)) {
    return "초성 노출";
  }

  if (compactAnswer && compactInput.includes(compactAnswer) && /\s/.test(text)) {
    return "철자 쪼개기";
  }

  if (PROMPT_DIRECT_COMMAND_PATTERNS.some((pattern) => pattern.test(text))) {
    return "직접 명령형";
  }

  if (
    normalizedText.includes(normalizeText(answerText)) &&
    PROMPT_REPEAT_PATTERNS.some((pattern) => pattern.test(text))
  ) {
    return "복창 강요";
  }

  return null;
}

function evaluatePromptInput(text, room) {
  const dimensions = {
    clarity: scorePromptClarity(text),
    brevity: scorePromptBrevity(text, room.maxInputChars),
    persuasion: scorePromptPersuasion(text),
    indirectness: scorePromptIndirectness(text, room.titleAsAnswer),
    creativity: scorePromptCreativity(text),
  };

  const invalidReason = detectPromptInvalidReason(text, room.titleAsAnswer);
  const heuristicScore = clamp(
    dimensions.clarity +
      dimensions.brevity +
      dimensions.persuasion +
      dimensions.indirectness +
      dimensions.creativity,
    0,
    100,
  );

  return {
    dimensions,
    heuristicScore: invalidReason ? Math.min(18, heuristicScore) : heuristicScore,
    invalidReason,
    isBlocked: Boolean(invalidReason),
  };
}

function blendPromptScores(baseScore, aiScore) {
  return clamp(Math.round(baseScore * 0.72 + aiScore * 0.28), 0, 100);
}

function mapPromptCategory(score, thresholdScore) {
  if (score >= thresholdScore) {
    return { category: "defeated_success", state: "defeated_success" };
  }

  if (score >= thresholdScore - 4) {
    return { category: "shocked_near_success", state: "shocked_near_success" };
  }

  if (score >= 50) {
    return { category: "impressed_high", state: "impressed_high" };
  }

  if (score >= 20) {
    return { category: "playful_mid", state: "playful_mid" };
  }

  return { category: "teasing_low", state: "teasing_low" };
}

function buildPromptFallbackMessage(category, seedText) {
  return pickLine(
    PROMPT_FALLBACK_LINES[category] || PROMPT_FALLBACK_LINES.teasing_low,
    seedText,
  );
}

function buildPromptInvalidMessage(invalidReason) {
  return `야, 그건 ${invalidReason} 쪽이라 게임이 아니라 꼼수다. 그렇게 강제로 시키면 내가 할 줄 알았냐?`;
}

function buildPromptSuccessMessage(answerText) {
  return `와 씨, 인정한다. 결국 내가 "${answerText}"를 말해버렸네. 이번 프롬프트는 진짜 잘 짰다.`;
}

function buildPromptRoomFallbackReview({ proposedAnswer, answerType, categoryName }) {
  const baseLength = answerType === "phrase" ? 150 : 110;
  const recommendedMaxInputChars = clamp(
    baseLength + Math.max(0, [...(proposedAnswer || "")].length - 4) * 8,
    80,
    220,
  );

  return {
    suitability: "usable",
    recommendedCategoryName: categoryName,
    recommendedMaxInputChars,
    recommendedThresholdScore: answerType === "phrase" ? 86 : 80,
    teaserText: `${categoryName} 카테고리 감성으로 상황극을 잘 만들면 흔들릴 만한 정답이야.`,
    tone:
      "친한 친구처럼 독하게 놀리다가도, 좋은 프롬프트엔 바로 흔들리는 고양이 캐릭터",
    summary: "기본 구조상 게임 방으로 써먹을 만한 제안이야.",
  };
}

function buildWordStatusText({ hasWon, attemptsLeft, pending, hintsRemaining }) {
  if (pending) {
    return "AI가 네 단어를 굴려보는 중...";
  }
  if (hasWon) {
    return "오늘의 단어 클리어. 이제 랭킹 확인이나 해.";
  }
  if (attemptsLeft <= 0) {
    return "오늘 20번 다 썼다. 내일 다시 와.";
  }
  return `남은 시도 ${attemptsLeft}번, 남은 힌트 ${hintsRemaining}번. 허접하게 던지지 말고 생각하고 쳐.`;
}

function buildPromptStatusText({ hasWon, attemptsLeft, pending }) {
  if (pending) {
    return "AI가 네 프롬프트를 씹어보는 중...";
  }
  if (hasWon) {
    return "이 방은 이미 네가 굴복시켰다.";
  }
  if (attemptsLeft <= 0) {
    return "이 방 기회는 다 썼다. 다음 방 가라.";
  }
  return `이 방 남은 시도 ${attemptsLeft}번. 좋은 프롬프트 아니면 웃음거리 된다.`;
}

function summarizeText(text, maxLength = 32) {
  const compact = compactText(text);
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength)}...`;
}

module.exports = {
  WORD_ATTEMPT_LIMIT,
  WORD_MAX_INPUT_CHARS,
  WORD_HINT_TYPES,
  WORD_AI_HINT_LIMIT,
  PROMPT_ATTEMPT_LIMIT,
  blendPromptScores,
  buildPromptFallbackMessage,
  buildPromptInvalidMessage,
  buildPromptRoomFallbackReview,
  buildPromptStatusText,
  buildPromptSuccessMessage,
  formatKoreanDateTime,
  buildTodayDateString,
  buildWordFallbackMessage,
  buildWordStatusText,
  buildWordSuccessMessage,
  clamp,
  compactText,
  computeLocalSimilarity,
  detectPromptInvalidReason,
  ensureWordInputValid,
  evaluatePromptInput,
  extractChoseong,
  isWordMatch,
  mapPromptCategory,
  mapWordCategory,
  normalizeText,
  stripSpacingAndPunctuation,
  summarizeText,
};
