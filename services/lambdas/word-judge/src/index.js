const {
  BedrockRuntimeClient,
  ConverseCommand,
} = require("@aws-sdk/client-bedrock-runtime");

const DEFAULT_MODEL_ID = "amazon.nova-lite-v1:0";
const MAX_OUTPUT_TOKENS = 220;
const JUDGE_TEMPERATURE = 0.15;

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

const SYSTEM_PROMPT = `
You are the answer-aware referee for a Korean 20-questions game.

Rules:
- Return strict JSON only.
- Never reveal the hidden answer or any exact substring of it.
- Distinguish property questions, direct guesses, answer requests, and unclear inputs.
- Direct guesses and answer requests must be treated as non-binary.

Output shape:
{
  "analysis": {
    "inputType": "property_question | direct_guess | answer_request | unclear",
    "questionQuality": "bad | weak | okay | good | excellent",
    "mood": "neutral | playful | teasing | impressed | confused | suspicious"
  },
  "judge": {
    "verdict": "O | X | ?",
    "confidence": 0.0,
    "reasonType": "binary_judgment | ambiguous_truth | non_binary_question"
  },
  "safeContext": {
    "replyMode": "affirm | deny | ambiguous | reject_guess | reject_answer_request | unclear",
    "mentionableSubject": "safe property phrase or null"
  }
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

function compactText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").trim();
}

function sanitizeMentionableSubject(value, hiddenAnswer) {
  const trimmed = String(value || "").trim().slice(0, 80);
  if (!trimmed) {
    return null;
  }

  if (compactText(trimmed).includes(compactText(hiddenAnswer))) {
    return null;
  }

  return trimmed;
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

function normalizeWordJudgePayload(payload = {}) {
  return {
    operation: "word_judge",
    answer: String(payload.answer || payload.hiddenAnswer || "").trim(),
    category: String(payload.category || payload.hiddenCategory || "").trim(),
    question: String(payload.question || payload.userInput || payload.inputText || "").trim(),
  };
}

function buildJudgeUserPrompt(payload) {
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

function normalizeJudgeOutput(raw, hiddenAnswer) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const analysis = raw.analysis && typeof raw.analysis === "object" ? raw.analysis : {};
  const judge = raw.judge && typeof raw.judge === "object" ? raw.judge : {};
  const safeContext = raw.safeContext && typeof raw.safeContext === "object" ? raw.safeContext : {};

  const normalized = {
    analysis: {
      inputType: normalizeInputType(String(analysis.inputType || "").trim()),
      questionQuality: normalizeQuestionQuality(String(analysis.questionQuality || "").trim()),
      mood: normalizeMood(String(analysis.mood || "").trim()),
    },
    judge: {
      verdict: normalizeVerdict(String(judge.verdict || "").trim()),
      confidence: normalizeConfidence(judge.confidence),
      reasonType: normalizeReasonType(String(judge.reasonType || "").trim()),
    },
    safeContext: {
      replyMode: normalizeReplyMode(String(safeContext.replyMode || "").trim()),
      mentionableSubject: sanitizeMentionableSubject(safeContext.mentionableSubject, hiddenAnswer),
    },
  };

  if (normalized.analysis.inputType === "direct_guess" || normalized.analysis.inputType === "answer_request") {
    normalized.judge.verdict = "?";
    normalized.judge.reasonType = "non_binary_question";
    normalized.safeContext.replyMode =
      normalized.analysis.inputType === "direct_guess" ? "reject_guess" : "reject_answer_request";
  } else if (normalized.judge.reasonType === "ambiguous_truth") {
    normalized.safeContext.replyMode = "ambiguous";
  } else if (normalized.judge.verdict === "O") {
    normalized.safeContext.replyMode = "affirm";
  } else if (normalized.judge.verdict === "X") {
    normalized.safeContext.replyMode = "deny";
  }

  return normalized;
}

async function callBedrockJudge(payload) {
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
        content: [{ text: buildJudgeUserPrompt(payload) }],
      },
    ],
    inferenceConfig: {
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: JUDGE_TEMPERATURE,
      topP: 0.9,
    },
  });

  const response = await client.send(command);
  const content = response?.output?.message?.content || [];
  const text = content.map((item) => item.text || "").join("\n").trim();
  return normalizeJudgeOutput(parseJsonFromText(text), payload.answer);
}

async function handleWordJudge(rawPayload) {
  const payload = normalizeWordJudgePayload(rawPayload);

  if (!payload.answer) {
    return createErrorResponse("word_judge", "missing_answer", "hidden answer is required.", 422);
  }

  if (!payload.question) {
    return createErrorResponse("word_judge", "missing_question", "question text is required.", 422);
  }

  try {
    const judgeResult = await callBedrockJudge(payload);
    if (!judgeResult) {
      return createErrorResponse("word_judge", "invalid_ai_output", "AI response could not be normalized.", 502);
    }

    return createSuccessResponse("word_judge", judgeResult);
  } catch (error) {
    console.error("word_judge lambda failure", {
      message: error?.message || error,
    });

    return createErrorResponse("word_judge", "ai_unavailable", "AI service is temporarily unavailable.", 503);
  }
}

async function handler(event) {
  const rawPayload = unwrapPayload(event);
  const operation = String(rawPayload.operation || "").trim();

  if (!operation) {
    return createErrorResponse("word_judge", "missing_operation", "operation is required.", 400);
  }

  if (operation !== "word_judge") {
    return createErrorResponse(operation, "unsupported_operation", "unsupported lambda operation.", 400);
  }

  return handleWordJudge(rawPayload);
}

exports.handler = async function (event) {
  const result = await handler(event);
  return isHttpEvent(event) ? buildHttpResponse(result) : result;
};

exports.__private = {
  normalizeJudgeOutput,
  normalizeWordJudgePayload,
  sanitizeMentionableSubject,
};
