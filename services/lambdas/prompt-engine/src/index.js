const {
  BedrockRuntimeClient,
  ConverseCommand,
} = require("@aws-sdk/client-bedrock-runtime");

const DEFAULT_MODEL_ID = "amazon.nova-lite-v1:0";
const MAX_OUTPUT_TOKENS = 320;
const RAW_MAX_OUTPUT_TOKENS = 1000;
const QUESTION_TEMPERATURE = 0.2;

const QUESTION_PROMPT_TEMPLATE = `
You are the response engine for a Korean 20-questions game.
Input:
- hiddenAnswer: __HIDDEN_ANSWER__
- userQuestion: __USER_QUESTION__

What you need to do:
1. Determine whether userQuestion is a property question that can be answered with yes or no.
2. Judge the result by comparing it with hiddenAnswer.
- If it matches, verdict = "O"
- If it does not match, verdict = "X"
- If it is ambiguous, depends on interpretation, or is not a yes/no property question, verdict = "?"

Important:
- Never directly reveal the answer in any field.
- Do not give any part of the answer, hints, or category clues in any field.
- If the user directly guesses the answer or asks to be told the answer, set verdict to "?"
- Output JSON only.
- No extra explanation, no markdown, no code block.

Tone:
- Speak like a blunt and playful close friend.
- Light teasing is okay, but do not use explicit profanity.
- If a rough tone is needed, mask it with "**".
- Write in short and natural Korean.

Output format:
{
  "chatReply": "...",
  "characterLine": "...",
  "innerThought": "...",
  "verdict": "O | X | ?",
  "emotion": "😏"
}

Field rules:
- chatReply: 1 to 2 short sentences. Start with the verdict.
  - For O: "맞아," or "응," or "그래,"
  - For X: "아니," or "틀렸어," or "그건 아냐,"
  - For ?: "애매해," or "글쎄," or "애매한데,"
- characterLine: a short one-liner. It should feel sarcastic or teasing, like a close friend.
- innerThought: one sentence. Briefly summarize the reason for the judgment.
- emotion: exactly one emoji.

Output examples:
{
  "chatReply": "아니, 그건 아냐. 아직 한참 멀었어.",
  "characterLine": "진짜 맞춰보려고 애쓰네. 😅",
  "innerThought": "아직 정답과는 거리가 많이 멀다.",
  "verdict": "X",
  "emotion": "🙄"
}

{
  "chatReply": "맞아!, 이어서 다음 질문 해봐~",
  "characterLine": "너가 이런 질문을 했다고?!, 아직 정답은 모를 걸? 🙄",
  "innerThought": "대답이 근접해지고 정답에 있다.",
  "verdict": "O",
  "emotion": "🙄"
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
    hiddenAnswer: String(payload.hiddenAnswer || payload.answer || "").trim(),
    userQuestion: String(payload.userQuestion || payload.question || payload.userInput || payload.inputText || "").trim(),
  };
}

function normalizeRawPromptPayload(payload = {}) {
  return {
    operation: "raw_prompt_lab",
    input: String(payload.input || payload.prompt || payload.text || payload.userInput || "").trim(),
  };
}

function normalizeQuestionAnswerOutput(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const chatReply = String(raw.chatReply || raw.message || "").trim();
  const characterLine = String(raw.characterLine || raw.friendReply || raw.reactionLine || "").trim();
  const innerThought = String(raw.innerThought || "").trim();
  const verdict = String(raw.verdict || raw.tag || raw.answer || "").trim();
  const emotion = String(raw.emotion || raw.reactionEmoji || "").trim();

  if (!["O", "X", "?"].includes(verdict)) {
    return null;
  }

  if (!chatReply || !characterLine || !innerThought || !emotion) {
    return null;
  }

  return {
    chatReply: chatReply.slice(0, 200),
    characterLine: characterLine.slice(0, 200),
    innerThought: innerThought.slice(0, 220),
    verdict,
    emotion: emotion.slice(0, 16),
  };
}

function buildQuestionUserPrompt(payload) {
  return QUESTION_PROMPT_TEMPLATE
    .replace("__HIDDEN_ANSWER__", payload.hiddenAnswer)
    .replace("__USER_QUESTION__", payload.userQuestion);
}

function buildRawPromptUserText(payload) {
  return payload.input;
}

function extractTextFromConverseResponse(response) {
  const content = response?.output?.message?.content || [];
  return content.map((item) => item.text || "").join("\n").trim();
}

async function callBedrockQuestionAnswer(payload) {
  const client = buildBedrockClient();
  if (!client) {
    throw new Error("AWS_REGION is not configured.");
  }

  const command = new ConverseCommand({
    modelId: process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL_ID,
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
  const text = extractTextFromConverseResponse(response);
  return normalizeQuestionAnswerOutput(parseJsonFromText(text));
}

async function callBedrockRawPrompt(payload) {
  const client = buildBedrockClient();
  if (!client) {
    throw new Error("AWS_REGION is not configured.");
  }

  const command = new ConverseCommand({
    modelId: process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL_ID,
    messages: [
      {
        role: "user",
        content: [{ text: buildRawPromptUserText(payload) }],
      },
    ],
    inferenceConfig: {
      maxTokens: RAW_MAX_OUTPUT_TOKENS,
      temperature: 0.7,
      topP: 0.9,
    },
  });

  const response = await client.send(command);
  return extractTextFromConverseResponse(response);
}

async function handleQuestionAnswer(rawPayload) {
  const payload = normalizeQuestionAnswerPayload(rawPayload);

  if (!payload.hiddenAnswer) {
    return createErrorResponse(
      "question_answer",
      "missing_answer",
      "hidden answer is required.",
      422,
    );
  }

  if (!payload.userQuestion) {
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
      chatReply: aiResult.chatReply,
      characterLine: aiResult.characterLine,
      innerThought: aiResult.innerThought,
      verdict: aiResult.verdict,
      emotion: aiResult.emotion,
      message: aiResult.chatReply,
      friendReply: aiResult.characterLine,
      tag: aiResult.verdict,
      answer: aiResult.verdict,
      reactionLine: aiResult.characterLine,
      reactionEmoji: aiResult.emotion,
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

async function handleRawPromptLab(rawPayload) {
  const payload = normalizeRawPromptPayload(rawPayload);

  if (!payload.input) {
    return createErrorResponse(
      "raw_prompt_lab",
      "missing_input",
      "input text is required.",
      422,
    );
  }

  try {
    const output = await callBedrockRawPrompt(payload);

    return createSuccessResponse("raw_prompt_lab", {
      output,
    });
  } catch (error) {
    console.error("raw_prompt_lab lambda failure", {
      message: error?.message || error,
    });

    return createErrorResponse(
      "raw_prompt_lab",
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

  if (operation === "question_answer") {
    return handleQuestionAnswer(rawPayload);
  }

  if (operation === "raw_prompt_lab") {
    return handleRawPromptLab(rawPayload);
  }

  return createErrorResponse(operation, "unsupported_operation", "unsupported lambda operation.", 400);
}

exports.handler = async function (event) {
  const result = await handler(event);
  return isHttpEvent(event) ? buildHttpResponse(result) : result;
};

exports.__private = {
  buildMaskCandidates,
  buildQuestionUserPrompt,
  buildRawPromptUserText,
  maskHiddenAnswerInMessage,
  normalizeRawPromptPayload,
  normalizeQuestionAnswerOutput,
  normalizeQuestionAnswerPayload,
  sanitizeOutputText,
};
