const {
  BedrockRuntimeClient,
  ConverseCommand,
} = require("@aws-sdk/client-bedrock-runtime");

const DEFAULT_MODEL_ID = "amazon.nova-lite-v1:0";
const MAX_OUTPUT_TOKENS = 180;
const QUESTION_TEMPERATURE = 0.2;
const NON_BINARY_MESSAGE = "이 질문은 게임 형식으로 답하기가 애매해요. 조금 더 분명하게 물어봐 주세요.";
const QUESTION_REACTION_STATES = new Set([
  "teasing_low",
  "playful_mid",
  "impressed_high",
  "shocked_near_success",
]);

const SYSTEM_PROMPT = `
You are the referee and reaction writer for a Korean 20-questions game.

Rules:
- Return strict JSON only.
- answer must be O, X, or ?.
- Use ? only when the question is truly ambiguous or not binary.
- Never reveal the hidden answer or any exact substring of it.
- Keep the main message short and Korean.
- Also return a separate reaction for the UI card.

Output shape:
{
  "answer": "O | X | ?",
  "message": "short Korean message",
  "reasonType": "binary_judgment | ambiguous_truth | non_binary_question",
  "reactionState": "teasing_low | playful_mid | impressed_high | shocked_near_success",
  "reactionEmoji": "single emoji",
  "reactionLabel": "short Korean label",
  "reactionLine": "short Korean reaction line"
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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMaskCandidates(hiddenAnswer) {
  const trimmed = String(hiddenAnswer || "").trim();
  const collapsed = trimmed.replace(/\s+/g, " ");
  const compact = trimmed.replace(/\s+/g, "");

  return [...new Set([trimmed, collapsed, compact].filter(Boolean))].sort((left, right) => right.length - left.length);
}

function maskHiddenAnswerInMessage(message, hiddenAnswer) {
  let sanitized = String(message || "");

  for (const candidate of buildMaskCandidates(hiddenAnswer)) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(candidate), "gu"), "**");
  }

  return sanitized;
}

function sanitizeOutputText(value, hiddenAnswer) {
  return maskHiddenAnswerInMessage(String(value || "").trim(), hiddenAnswer);
}

function normalizeQuestionAnswerPayload(payload = {}) {
  return {
    operation: "question_answer",
    answer: String(payload.answer || payload.hiddenAnswer || "").trim(),
    category: String(payload.category || payload.hiddenCategory || "").trim(),
    question: String(payload.question || payload.userInput || payload.inputText || "").trim(),
  };
}

function fallbackReactionState(tag) {
  if (tag === "O") {
    return "impressed_high";
  }

  if (tag === "?") {
    return "playful_mid";
  }

  return "teasing_low";
}

function fallbackReactionEmoji(reactionState) {
  if (reactionState === "shocked_near_success") {
    return "😳";
  }

  if (reactionState === "impressed_high") {
    return "👏";
  }

  if (reactionState === "playful_mid") {
    return "😏";
  }

  return "😒";
}

function fallbackReactionLabel(reactionState) {
  if (reactionState === "shocked_near_success") {
    return "거의 맞췄음";
  }

  if (reactionState === "impressed_high") {
    return "잘 짚었음";
  }

  if (reactionState === "playful_mid") {
    return "괜찮네";
  }

  return "별로";
}

function fallbackReactionLine(reactionState) {
  if (reactionState === "shocked_near_success") {
    return "와, 여기까지 왔으면 거의 다 왔네.";
  }

  if (reactionState === "impressed_high") {
    return "오, 질문이 꽤 날카로운데?";
  }

  if (reactionState === "playful_mid") {
    return "그래도 조금은 좁혀졌네.";
  }

  return "음, 이건 너무 넓게 물었어.";
}

function normalizeQuestionAnswerOutput(raw, hiddenAnswer = "") {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const tag = String(raw.answer || raw.tag || "").trim();
  const message = String(raw.message || "").trim();
  const reasonType = String(raw.reasonType || "").trim();
  const reactionStateRaw = String(raw.reactionState || raw.expressionState || "").trim();
  const reactionEmojiRaw = String(raw.reactionEmoji || raw.expressionEmoji || "").trim();
  const reactionLabelRaw = String(raw.reactionLabel || raw.expressionLabel || "").trim();
  const reactionLineRaw = String(raw.reactionLine || raw.sideMessage || "").trim();

  if (!["O", "X", "?"].includes(tag) || !message) {
    return null;
  }

  const normalizedReasonType =
    reasonType === "ambiguous_truth" || reasonType === "non_binary_question"
      ? reasonType
      : "binary_judgment";
  const reactionState = QUESTION_REACTION_STATES.has(reactionStateRaw)
    ? reactionStateRaw
    : fallbackReactionState(tag);
  const reactionEmoji = reactionEmojiRaw || fallbackReactionEmoji(reactionState);
  const reactionLabel = reactionLabelRaw || fallbackReactionLabel(reactionState);
  const reactionLine = reactionLineRaw || fallbackReactionLine(reactionState);
  const normalizedMessage =
    tag === "?" && normalizedReasonType === "non_binary_question" ? NON_BINARY_MESSAGE : message;

  return {
    answer: tag,
    tag,
    reasonType: normalizedReasonType,
    message: sanitizeOutputText(normalizedMessage, hiddenAnswer).slice(0, 200),
    reactionState,
    reactionEmoji,
    reactionLabel: sanitizeOutputText(reactionLabel, hiddenAnswer).slice(0, 80),
    reactionLine: sanitizeOutputText(reactionLine, hiddenAnswer).slice(0, 120),
  };
}

function buildQuestionUserPrompt(payload) {
  return JSON.stringify(
    {
      hiddenAnswer: payload.answer,
      hiddenCategory: payload.category || null,
      userQuestion: payload.question,
    },
    null,
    2,
  );
}

async function callBedrockQuestionAnswer(payload) {
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
        content: [{ text: buildQuestionUserPrompt(payload) }],
      },
    ],
    inferenceConfig: {
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: QUESTION_TEMPERATURE,
      topP: 0.9,
    },
  });

  const response = await client.send(command);
  const content = response?.output?.message?.content || [];
  const text = content.map((item) => item.text || "").join("\n").trim();
  return normalizeQuestionAnswerOutput(parseJsonFromText(text), payload.answer);
}

async function handleQuestionAnswer(rawPayload) {
  const payload = normalizeQuestionAnswerPayload(rawPayload);

  if (!payload.answer) {
    return createErrorResponse(
      "question_answer",
      "missing_answer",
      "hidden answer is required.",
      422,
    );
  }

  if (!payload.question) {
    return createErrorResponse(
      "question_answer",
      "missing_question",
      "question text is required.",
      422,
    );
  }

  try {
    const aiResult = await callBedrockQuestionAnswer(payload);
    if (!aiResult) {
      return createErrorResponse(
        "question_answer",
        "invalid_ai_output",
        "AI response could not be normalized.",
        502,
      );
    }

    return createSuccessResponse("question_answer", {
      answer: aiResult.answer,
      tag: aiResult.tag,
      message: aiResult.message,
      reasonType: aiResult.reasonType,
      reactionState: aiResult.reactionState,
      reactionEmoji: aiResult.reactionEmoji,
      reactionLabel: aiResult.reactionLabel,
      reactionLine: aiResult.reactionLine,
    });
  } catch (error) {
    console.error("question_answer lambda failure", {
      message: error?.message || error,
    });

    return createErrorResponse(
      "question_answer",
      "ai_unavailable",
      "AI service is temporarily unavailable.",
      503,
    );
  }
}

async function handler(event) {
  const rawPayload = unwrapPayload(event);
  const operation = String(rawPayload.operation || "").trim();

  if (!operation) {
    return createErrorResponse("question_answer", "missing_operation", "operation is required.", 400);
  }

  if (operation !== "question_answer") {
    return createErrorResponse(operation, "unsupported_operation", "unsupported lambda operation.", 400);
  }

  return handleQuestionAnswer(rawPayload);
}

exports.handler = async function (event) {
  const result = await handler(event);
  return isHttpEvent(event) ? buildHttpResponse(result) : result;
};

exports.__private = {
  buildMaskCandidates,
  maskHiddenAnswerInMessage,
  normalizeQuestionAnswerOutput,
  normalizeQuestionAnswerPayload,
  sanitizeOutputText,
};
