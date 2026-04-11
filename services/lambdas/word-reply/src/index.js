const {
  BedrockRuntimeClient,
  ConverseCommand,
} = require("@aws-sdk/client-bedrock-runtime");

const DEFAULT_MODEL_ID = "amazon.nova-lite-v1:0";
const MAX_OUTPUT_TOKENS = 240;
const REPLY_TEMPERATURE = 0.45;

const VALID_INPUT_TYPES = new Set(["property_question", "direct_guess", "answer_request", "unclear"]);
const VALID_QUESTION_QUALITIES = new Set(["bad", "weak", "okay", "good", "excellent"]);
const VALID_MOODS = new Set(["neutral", "playful", "teasing", "impressed", "confused", "suspicious"]);
const VALID_VERDICTS = new Set(["O", "X", "?"]);
const VALID_REASON_TYPES = new Set(["binary_judgment", "ambiguous_truth", "non_binary_question"]);
const VALID_REPLY_MODES = new Set([
  "affirm",
  "deny",
  "ambiguous",
  "reject_guess",
  "reject_answer_request",
  "unclear",
]);
const VALID_EMOJI_KEYS = new Set([
  "neutral",
  "smile",
  "tease",
  "thinking",
  "confused",
  "impressed",
  "suspicious",
  "shock",
]);

const SYSTEM_PROMPT = `
You are the answer-blind character reply layer for a Korean 20-questions game.

Rules:
- Return strict JSON only.
- Do not reveal the hidden answer or any fragment of it.
- Keep Korean text short and natural.
- chatReply is for the player, friendReply is for a blunt close friend vibe, innerThought is the internal short thought, and emotion maps to the UI face.

Output shape:
{
  "judge": {
    "verdict": "O | X | ?",
    "confidence": 0.0,
    "reasonType": "binary_judgment | ambiguous_truth | non_binary_question"
  },
  "chatReply": "short Korean response",
  "friendReply": "short Korean close-friend response",
  "emotion": {
    "emojiKey": "neutral | smile | tease | thinking | confused | impressed | suspicious | shock",
    "label": "short Korean label",
    "intensity": 0.0
  },
  "innerThought": "short Korean internal thought"
}
`.trim();

function safeJsonParse(input, fallback = {}) {
  if (typeof input !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(input);
  } catch {
    return fallback;
  }
}

function unwrapPayload(event) {
  if (!event) {
    return {};
  }

  if (typeof event === "string") {
    return safeJsonParse(event, {});
  }

  if (event.body) {
    if (typeof event.body === "string") {
      return safeJsonParse(event.body, {});
    }

    return event.body;
  }

  return event;
}

function isHttpEvent(event) {
  return Boolean(event?.requestContext?.http);
}

function buildHttpResponse(result) {
  return {
    statusCode: Number(result?.httpStatusCode || (result?.ok === false ? 400 : 200)),
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(result),
  };
}

function createSuccessResponse(operation, body = {}, httpStatusCode = 200) {
  return {
    ok: true,
    operation,
    date: new Date().toISOString().slice(0, 10),
    httpStatusCode,
    ...body,
  };
}

function createErrorResponse(operation, code, message, httpStatusCode, extra = {}) {
  return {
    ok: false,
    operation,
    date: new Date().toISOString().slice(0, 10),
    error: true,
    code,
    message,
    httpStatusCode,
    ...extra,
  };
}

function parseJsonFromText(text) {
  if (!text) {
    return {};
  }

  const trimmed = String(text).trim();
  if (!trimmed) {
    return {};
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return safeJsonParse(fenced[1], {});
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return safeJsonParse(trimmed.slice(firstBrace, lastBrace + 1), {});
  }

  return safeJsonParse(trimmed, {});
}

function buildBedrockClient() {
  if (!process.env.AWS_REGION) {
    return null;
  }

  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION,
  });
}

function trimText(value, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeInputType(value) {
  return VALID_INPUT_TYPES.has(value) ? value : "unclear";
}

function normalizeQuestionQuality(value) {
  return VALID_QUESTION_QUALITIES.has(value) ? value : "okay";
}

function normalizeMood(value) {
  return VALID_MOODS.has(value) ? value : "neutral";
}

function normalizeVerdict(value) {
  return VALID_VERDICTS.has(value) ? value : "?";
}

function normalizeReasonType(value) {
  return VALID_REASON_TYPES.has(value) ? value : "non_binary_question";
}

function normalizeReplyMode(value) {
  return VALID_REPLY_MODES.has(value) ? value : "unclear";
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(1, numeric));
}

function normalizeIntensity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0.45;
  }

  return Math.max(0, Math.min(1, numeric));
}

function compactText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeText(value, hiddenText) {
  const trimmed = trimText(value, 200);
  const hidden = compactText(hiddenText);

  if (!trimmed || !hidden) {
    return trimmed;
  }

  return trimmed.replace(new RegExp(escapeRegExp(hiddenText), "gu"), "**");
}

function normalizeReplyPayload(payload = {}) {
  return {
    operation: "word_reply",
    analysis: {
      inputType: normalizeInputType(String(payload.analysis?.inputType || "").trim()),
      questionQuality: normalizeQuestionQuality(String(payload.analysis?.questionQuality || "").trim()),
      mood: normalizeMood(String(payload.analysis?.mood || "").trim()),
    },
    judge: {
      verdict: normalizeVerdict(String(payload.judge?.verdict || "").trim()),
      confidence: normalizeConfidence(payload.judge?.confidence),
      reasonType: normalizeReasonType(String(payload.judge?.reasonType || "").trim()),
    },
    safeContext: {
      replyMode: normalizeReplyMode(String(payload.safeContext?.replyMode || "").trim()),
      mentionableSubject: trimText(payload.safeContext?.mentionableSubject, 80) || null,
    },
  };
}

function buildDefaultEmotion(payload) {
  const mood = normalizeMood(payload.analysis?.mood);
  const verdict = normalizeVerdict(payload.judge?.verdict);
  const questionQuality = normalizeQuestionQuality(payload.analysis?.questionQuality);

  const emojiMap = {
    neutral: "neutral",
    playful: "smile",
    teasing: "tease",
    impressed: verdict === "?" ? "shock" : "impressed",
    confused: "confused",
    suspicious: "suspicious",
  };
  const labelMap = {
    neutral: "차분",
    smile: "가볍게 웃음",
    tease: "약 올림",
    thinking: "생각 중",
    confused: "헷갈림",
    impressed: "감탄",
    suspicious: "의심",
    shock: "충격",
  };
  const intensityMap = {
    bad: 0.22,
    weak: 0.32,
    okay: 0.46,
    good: 0.6,
    excellent: 0.78,
  };

  const emojiKey = emojiMap[mood] || "neutral";

  return {
    emojiKey,
    label: labelMap[emojiKey] || "차분",
    intensity: intensityMap[questionQuality] ?? 0.45,
  };
}

function mapEmotionToLegacyState(emojiKey) {
  switch (emojiKey) {
    case "tease":
      return "teasing_low";
    case "smile":
      return "playful_mid";
    case "impressed":
      return "impressed_high";
    case "shock":
      return "shocked_near_success";
    case "thinking":
      return "cooldown_or_locked";
    default:
      return "idle";
  }
}

function buildFallbackFriendReply(analysis, judge) {
  if (analysis.inputType === "direct_guess") {
    return "그건 너무 대놓고 찍었잖아.";
  }

  if (analysis.inputType === "answer_request") {
    return "정답 달라고 바로 묻는 건 좀 너무하네.";
  }

  if (judge.reasonType === "ambiguous_truth") {
    return "이건 애매해서 그렇게만은 못 말해.";
  }

  if (analysis.mood === "impressed") {
    return "오, 질문은 꽤 괜찮네.";
  }

  if (analysis.mood === "teasing") {
    return "그 정도로는 못 속여.";
  }

  if (analysis.mood === "suspicious") {
    return "음, 방금 질문은 좀 수상했는데?";
  }

  if (analysis.mood === "confused") {
    return "이건 나도 좀 헷갈리게 물었네.";
  }

  return "조금만 더 좁혀서 물어봐.";
}

function buildFallbackInnerThought(analysis, judge) {
  if (analysis.inputType === "direct_guess") {
    return "정답을 바로 찍고 있네.";
  }

  if (analysis.inputType === "answer_request") {
    return "게임 규칙을 그대로 깨고 있어.";
  }

  if (analysis.inputType === "unclear") {
    return "질문이 너무 넓어서 판단이 흐릿하다.";
  }

  if (judge.reasonType === "ambiguous_truth") {
    return "정의 차이 때문에 단정하기 어렵다.";
  }

  const qualityMap = {
    bad: "질문 방향이 거의 안 보인다.",
    weak: "조금 더 좁혀야 한다.",
    okay: "무난하지만 더 선명해질 수 있다.",
    good: "질문이 꽤 괜찮다.",
    excellent: "거의 핵심을 찔렀다.",
  };

  return qualityMap[analysis.questionQuality] || qualityMap.okay;
}

function buildFallbackChatReply(judgeFrame) {
  const { judge, safeContext } = judgeFrame;
  const replyMode = normalizeReplyMode(safeContext?.replyMode);
  const subject = trimText(safeContext?.mentionableSubject, 48);

  if (replyMode === "affirm") {
    return subject ? `응, ${subject} 쪽이 맞아.` : "응, 맞아.";
  }

  if (replyMode === "deny") {
    return subject ? `아니, ${subject} 쪽은 아니야.` : "아니, 그건 아니야.";
  }

  if (replyMode === "ambiguous") {
    return subject ? `${subject}라고 딱 잘라 말하긴 애매해.` : "그건 좀 애매해.";
  }

  if (replyMode === "reject_guess") {
    return "그건 질문이 아니라 정답 찍기야.";
  }

  if (replyMode === "reject_answer_request") {
    return "정답을 바로 달라고 하면 안 되지.";
  }

  if (normalizeReasonType(judge?.reasonType) === "ambiguous_truth") {
    return "그건 정의에 따라 달라질 수 있어.";
  }

  return "조금만 더 정확하게 물어봐.";
}

function buildWordReplyFallback(judgeFrame) {
  const analysis = judgeFrame.analysis || {};
  const judge = judgeFrame.judge || {};
  const emotion = buildDefaultEmotion(judgeFrame);

  return {
    analysis: {
      inputType: normalizeInputType(analysis.inputType),
      questionQuality: normalizeQuestionQuality(analysis.questionQuality),
      mood: normalizeMood(analysis.mood),
    },
    judge: {
      verdict: normalizeVerdict(judge.verdict),
      confidence: normalizeConfidence(judge.confidence),
      reasonType: normalizeReasonType(judge.reasonType),
    },
    safeContext: {
      replyMode: normalizeReplyMode(judgeFrame.safeContext?.replyMode),
      mentionableSubject: trimText(judgeFrame.safeContext?.mentionableSubject, 80) || null,
    },
    chatReply: buildFallbackChatReply(judgeFrame),
    friendReply: buildFallbackFriendReply(analysis, judge),
    emotion,
    innerThought: buildFallbackInnerThought(analysis, judge),
  };
}

function normalizeReplyOutput(raw, payload) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const emotion = raw.emotion && typeof raw.emotion === "object" ? raw.emotion : {};
  const fallbackEmotion = buildDefaultEmotion(payload);
  const emojiKey = VALID_EMOJI_KEYS.has(String(emotion.emojiKey || "").trim())
    ? String(emotion.emojiKey || "").trim()
    : fallbackEmotion.emojiKey;
  const subject = payload.safeContext?.mentionableSubject || "";

  const normalized = {
    analysis: {
      inputType: normalizeInputType(payload.analysis.inputType),
      questionQuality: normalizeQuestionQuality(payload.analysis.questionQuality),
      mood: normalizeMood(payload.analysis.mood),
    },
    judge: {
      verdict: normalizeVerdict(payload.judge.verdict),
      confidence: normalizeConfidence(payload.judge.confidence),
      reasonType: normalizeReasonType(payload.judge.reasonType),
    },
    safeContext: {
      replyMode: normalizeReplyMode(payload.safeContext.replyMode),
      mentionableSubject: payload.safeContext.mentionableSubject || null,
    },
    chatReply: sanitizeText(raw.chatReply, subject),
    friendReply: sanitizeText(raw.friendReply, subject),
    emotion: {
      emojiKey,
      label: trimText(emotion.label, 32) || fallbackEmotion.label,
      intensity: normalizeIntensity(emotion.intensity ?? fallbackEmotion.intensity),
    },
    innerThought: sanitizeText(raw.innerThought, subject),
  };

  if (!normalized.chatReply || !normalized.friendReply || !normalized.innerThought) {
    return null;
  }

  return normalized;
}

function buildReplyUserPrompt(payload) {
  return JSON.stringify(payload, null, 2);
}

async function callBedrockReply(payload) {
  const client = buildBedrockClient();
  if (!client) {
    throw new Error("AWS_REGION is not configured.");
  }

  const command = new ConverseCommand({
    modelId: process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL_ID,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [
      {
        role: "user",
        content: [{ text: buildReplyUserPrompt(payload) }],
      },
    ],
    inferenceConfig: {
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: REPLY_TEMPERATURE,
      topP: 0.9,
    },
  });

  const response = await client.send(command);
  const content = response?.output?.message?.content || [];
  const text = content.map((item) => item.text || "").join("\n").trim();
  return normalizeReplyOutput(parseJsonFromText(text), payload);
}

async function handleWordReply(rawPayload) {
  const payload = normalizeReplyPayload(rawPayload);

  try {
    const replyResult = await callBedrockReply(payload);
    if (!replyResult) {
      return createErrorResponse("word_reply", "invalid_ai_output", "AI response could not be normalized.", 502);
    }

    return createSuccessResponse("word_reply", replyResult);
  } catch (error) {
    console.error("word_reply lambda failure", {
      message: error?.message || error,
    });

    return createErrorResponse("word_reply", "ai_unavailable", "AI service is temporarily unavailable.", 503);
  }
}

async function handler(event) {
  const rawPayload = unwrapPayload(event);
  const operation = String(rawPayload.operation || "").trim();

  if (!operation) {
    return createErrorResponse("word_reply", "missing_operation", "operation is required.", 400);
  }

  if (operation !== "word_reply") {
    return createErrorResponse(operation, "unsupported_operation", "unsupported lambda operation.", 400);
  }

  return handleWordReply(rawPayload);
}

exports.handler = async function (event) {
  const result = await handler(event);
  return isHttpEvent(event) ? buildHttpResponse(result) : result;
};

exports.__private = {
  buildDefaultEmotion,
  buildFallbackChatReply,
  buildFallbackFriendReply,
  buildFallbackInnerThought,
  normalizeReplyOutput,
  normalizeReplyPayload,
};
