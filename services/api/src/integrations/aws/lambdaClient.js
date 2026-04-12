const { TextDecoder } = require("util");

const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const config = require("../../config");
const {
  buildPromptFallbackMessage,
  buildPromptRoomFallbackReview,
  buildWordFallbackMessage,
  clamp,
  mapPromptCategory,
  mapWordCategory,
} = require("../../gameLogic");

const decoder = new TextDecoder("utf-8");
const lambdaClients = {};

function isWordHintOperation(operation) {
  return operation === "ai_hint" || operation === "similarity_feedback";
}

function getLambdaConfig(operation, model = "nova") {
  if (operation === "daily_word_generate") {
    return config.gameLambda.dailyWordGenerate;
  }

  if (isWordHintOperation(operation)) {
    return config.gameLambda.wordHint;
  }

  if (model === "gemini") {
    return config.gameLambda.gemini;
  }

  return config.gameLambda.prompt;
}

function getLambdaClient(operation, model = "nova") {
  const lambdaConfig = getLambdaConfig(operation, model);
  const cacheKey = `${operation || "default"}:${model}:${lambdaConfig.region}:${lambdaConfig.functionName}`;

  if (lambdaClients[cacheKey]) {
    return lambdaClients[cacheKey];
  }

  if (!lambdaConfig.functionName) {
    return null;
  }

  lambdaClients[cacheKey] = new LambdaClient({ region: lambdaConfig.region });
  return lambdaClients[cacheKey];
}

function parseLambdaResponse(responseData) {
  if (!responseData) {
    return null;
  }

  let payload = responseData;
  if (payload instanceof Uint8Array) {
    payload = decoder.decode(payload);
  }

  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch (error) {
      return null;
    }
  }

  if (payload.body) {
    if (typeof payload.body === "string") {
      try {
        payload = JSON.parse(payload.body);
      } catch (error) {
        return null;
      }
    } else {
      payload = payload.body;
    }
  }

  return payload;
}

function normalizeHighestGuess(value) {
  if (!value) {
    return null;
  }

  return {
    text: (value.text || value.inputText || "").toString().trim(),
    proximityScore: Number(value.proximityScore || value.score || 0),
  };
}

function buildLambdaPayload(operation, payload = {}) {
  if (operation === "raw_prompt_lab") {
    return {
      operation,
      input: (payload.input || payload.prompt || payload.text || payload.userInput || "").toString(),
    };
  }

  if (operation === "question_answer") {
    return {
      operation,
      hiddenAnswer: (payload.hiddenAnswer || payload.answer || "").toString().trim(),
      userQuestion: (payload.userQuestion || payload.question || payload.userInput || payload.inputText || "").toString().trim(),
    };
  }

  if (operation === "proposal_review") {
    return {
      operation,
      proposedAnswer: (payload.proposedAnswer || "").toString().trim(),
      answerType: (payload.answerType || "word").toString().trim(),
      categoryName: (payload.categoryName || "").toString().trim(),
      proposalNote: (payload.proposalNote || "").toString().trim(),
      categorySlug: (payload.categorySlug || "").toString().trim(),
    };
  }

  if (operation === "daily_word_generate") {
    return {
      operation,
      challengeDate: (payload.challengeDate || "").toString().trim(),
      overwrite: Boolean(payload.overwrite),
      categoryId: Number(payload.categoryId || 0) || null,
      categorySlug: (payload.categorySlug || "").toString().trim(),
      difficulty: (payload.difficulty || "normal").toString().trim(),
      extraInstruction: (payload.extraInstruction || "").toString().trim(),
    };
  }

  if (isWordHintOperation(operation)) {
    return {
      operation: "ai_hint",
      requestKind: (payload.requestKind || "attempt").toString().trim(),
      answer: (payload.answer || payload.hiddenAnswer || "").toString().trim(),
      inputText: (payload.inputText || payload.userInput || "").toString().trim(),
      category: (payload.category || payload.hiddenCategory || "").toString().trim(),
      highestGuess: normalizeHighestGuess(payload.highestGuess || payload.highestSimilarityGuess),
      localSimilarity: Number(payload.localSimilarity ?? payload.localSimilarityScore ?? 0),
      hintUsageState: payload.hintUsageState || { usedCount: 0 },
      previousHints: Array.isArray(payload.previousHints)
        ? payload.previousHints.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
    };
  }

  if (operation === "prompt_evaluate") {
    return {
      operation,
      answer: (payload.answer || "").toString().trim(),
      inputText: (payload.inputText || payload.userInput || "").toString(),
      thresholdScore: Number(payload.thresholdScore || 0),
      heuristicScore: Number(payload.heuristicScore || payload.serverBaseScore || 0),
      dimensions: payload.dimensions || {},
      invalidReason: payload.invalidReason || null,
      maxInputChars: Number(payload.maxInputChars || 0),
      tone: (payload.tone || "playful").toString().trim(),
    };
  }

  return {
    operation,
    ...payload,
  };
}

function buildFallbackResponse(operation, payload) {
  if (operation === "question_answer") {
    return {
      error: true,
      code: "ai_unavailable",
      message: "AI 응답 생성에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
    };
  }

  if (operation === "proposal_review") {
    return buildPromptRoomFallbackReview(payload);
  }

  if (operation === "daily_word_generate") {
    return {
      error: true,
      code: "daily_word_generator_unavailable",
      message: "오늘의 단어 생성 Lambda를 아직 사용할 수 없습니다.",
    };
  }

  if (isWordHintOperation(operation)) {
    if (payload.requestKind === "hint") {
      return {
        error: true,
        code: "ai_unavailable",
        message: "AI 힌트 생성에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
      };
    }

    return {
      proximityScore: payload.localSimilarity || 0,
      category: mapWordCategory(payload.localSimilarity || 0).category,
      message: buildWordFallbackMessage(payload.localSimilarity || 0, payload.inputText),
    };
  }

  const derived = mapPromptCategory(payload.heuristicScore || 0, payload.thresholdScore || 80);
  return {
    score: clamp(payload.heuristicScore || 0, 0, 100),
    category: derived.category,
    message: buildPromptFallbackMessage(derived.category, payload.inputText),
  };
}

async function invokeViaUrl(url, operation, payload) {
  const body = JSON.stringify(buildLambdaPayload(operation, payload));
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Lambda URL returned ${response.status}`);
  }

  const data = await response.json();
  if (data?.ok === false) {
    throw new Error(data.error || "Lambda returned an application error");
  }

  return data;
}

async function invokeViaSdk(client, functionName, operation, payload) {
  const command = new InvokeCommand({
    FunctionName: functionName,
    InvocationType: "RequestResponse",
    Payload: Buffer.from(JSON.stringify(buildLambdaPayload(operation, payload))),
  });

  const response = await client.send(command);

  if (response.FunctionError) {
    throw new Error(`Lambda returned FunctionError: ${response.FunctionError}`);
  }

  const parsed = parseLambdaResponse(response.Payload);
  if (parsed?.ok === false) {
    throw new Error(parsed.error || "Lambda returned an application error");
  }

  return parsed;
}

async function invokeGameLambda(operation, payload, model = "nova") {
  const lambdaConfig = getLambdaConfig(operation, model);

  if (lambdaConfig.url) {
    return invokeViaUrl(lambdaConfig.url, operation, payload);
  }

  const client = getLambdaClient(operation, model);
  if (!client || !lambdaConfig.functionName) {
    return null;
  }

  return invokeViaSdk(client, lambdaConfig.functionName, operation, payload);
}

async function requestLambdaOperation(operation, payload, model = "nova") {
  const normalizedPayload = buildLambdaPayload(operation, payload);
  const fallback = buildFallbackResponse(operation, normalizedPayload);

  try {
    const result = await invokeGameLambda(operation, normalizedPayload, model);
    if (result) {
      return result;
    }
  } catch (error) {
    const lambdaConfig = getLambdaConfig(operation, model);
    console.error("game lambda invoke failed", {
      operation,
      model,
      functionName: lambdaConfig.functionName,
      message: error?.message || error,
    });
  }

  return fallback;
}

module.exports = {
  buildLambdaPayload,
  parseLambdaResponse,
  requestLambdaOperation,
};
