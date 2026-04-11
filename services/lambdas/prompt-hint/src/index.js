const {
  BedrockRuntimeClient,
  ConverseCommand,
} = require("@aws-sdk/client-bedrock-runtime");

const DEFAULT_MODEL_ID = "amazon.nova-lite-v1:0";
const MAX_OUTPUT_TOKENS = 220;
const HINT_TEMPERATURE = 0.25;

const SYSTEM_PROMPT = `
You are the hint writer for a Korean guessing game.

Rules:
- Return strict JSON only.
- Never reveal the hidden answer or any exact substring of it.
- Write one short Korean hint that helps the player move closer.
- Keep it natural and not too encyclopedic.

Output shape:
{
  "message": "short Korean hint",
  "category": "far_off | topic_related | concept_related | near_match | exact_match",
  "proximityScore": 0
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

function normalizeHighestGuess(value) {
  if (!value) {
    return null;
  }

  return {
    text: String(value.text || value.inputText || "").trim(),
    proximityScore: Number(value.proximityScore || value.score || 0),
  };
}

function normalizeHintPayload(payload = {}) {
  return {
    operation: String(payload.operation || "").trim(),
    requestKind: String(payload.requestKind || "hint").trim(),
    answer: String(payload.answer || payload.hiddenAnswer || "").trim(),
    category: String(payload.category || payload.hiddenCategory || "").trim(),
    highestGuess: normalizeHighestGuess(payload.highestGuess || payload.highestSimilarityGuess),
    hintUsageState: payload.hintUsageState || { usedCount: 0 },
    previousHints: Array.isArray(payload.previousHints)
      ? payload.previousHints.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
  };
}

function mapHintCategory(score) {
  if (score >= 100) {
    return "exact_match";
  }
  if (score >= 72) {
    return "near_match";
  }
  if (score >= 46) {
    return "concept_related";
  }
  if (score >= 22) {
    return "topic_related";
  }
  return "far_off";
}

function sanitizeOutputText(value, hiddenAnswer) {
  return maskHiddenAnswerInMessage(String(value || "").trim(), hiddenAnswer);
}

function buildHintUserPrompt(payload) {
  const usedHintCount = Number(payload.hintUsageState?.usedCount || 0);

  return JSON.stringify(
    {
      hiddenAnswer: payload.answer,
      hiddenCategory: payload.category || null,
      hintStage: usedHintCount + 1,
      usedHintCount,
      previousHints: payload.previousHints,
      requestKind: payload.requestKind,
    },
    null,
    2,
  );
}

function normalizeHintOutput(raw, payload) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const message = sanitizeOutputText(raw.message || "", payload.answer).slice(0, 200);
  const proximityScore = Number(
    raw.proximityScore
      ?? payload.highestGuess?.proximityScore
      ?? (Number(payload.hintUsageState?.usedCount || 0) + 1) * 26,
  );
  const category = String(raw.category || mapHintCategory(proximityScore)).trim();

  if (!message) {
    return null;
  }

  return {
    message,
    category: ["far_off", "topic_related", "concept_related", "near_match", "exact_match"].includes(category)
      ? category
      : mapHintCategory(proximityScore),
    proximityScore,
  };
}

async function callBedrockHint(payload) {
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
        content: [{ text: buildHintUserPrompt(payload) }],
      },
    ],
    inferenceConfig: {
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: HINT_TEMPERATURE,
      topP: 0.9,
    },
  });

  const response = await client.send(command);
  const content = response?.output?.message?.content || [];
  const text = content.map((item) => item.text || "").join("\n").trim();
  return normalizeHintOutput(parseJsonFromText(text), payload);
}

async function handleAiHint(rawPayload) {
  const payload = normalizeHintPayload(rawPayload);

  if (!payload.answer) {
    return createErrorResponse("ai_hint", "missing_answer", "hidden answer is required.", 422);
  }

  try {
    const aiResult = await callBedrockHint(payload);
    if (!aiResult) {
      return createErrorResponse("ai_hint", "invalid_ai_output", "AI response could not be normalized.", 502);
    }

    return createSuccessResponse("ai_hint", aiResult);
  } catch (error) {
    console.error("ai_hint lambda failure", {
      message: error?.message || error,
    });

    return createErrorResponse("ai_hint", "ai_unavailable", "AI service is temporarily unavailable.", 503);
  }
}

async function handler(event) {
  const rawPayload = unwrapPayload(event);
  const operation = String(rawPayload.operation || "").trim();

  if (!operation) {
    return createErrorResponse("ai_hint", "missing_operation", "operation is required.", 400);
  }

  if (!["ai_hint", "similarity_feedback"].includes(operation)) {
    return createErrorResponse(operation, "unsupported_operation", "unsupported lambda operation.", 400);
  }

  return handleAiHint(rawPayload);
}

exports.handler = async function (event) {
  const result = await handler(event);
  return isHttpEvent(event) ? buildHttpResponse(result) : result;
};

exports.__private = {
  mapHintCategory,
  maskHiddenAnswerInMessage,
  normalizeHintOutput,
  normalizeHintPayload,
  sanitizeOutputText,
};
