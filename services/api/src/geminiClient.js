function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMaskCandidates(hiddenWord) {
  const trimmed = String(hiddenWord || "").trim();
  const collapsed = trimmed.replace(/\s+/g, " ");
  const compact = trimmed.replace(/\s+/g, "");

  return [...new Set([trimmed, collapsed, compact].filter(Boolean))].sort(
    (left, right) => right.length - left.length,
  );
}

function maskHiddenAnswerInMessage(message, hiddenWord) {
  let sanitized = String(message || "");
  const candidates = buildMaskCandidates(hiddenWord);

  for (const candidate of candidates) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(candidate), "gu"), "**");
  }

  return sanitized;
}

async function answerQuestion(hiddenWord, question, category, selectedModel = "nova") {
  // Gemini is not available yet
  if (selectedModel === "gemini") {
    return { message: "Gemini는 현재 불가능합니다.", tag: "?", error: true };
  }

  // Try Lambda (Nova via Bedrock)
  try {
    const { requestLambdaOperation } = require("./lambdaClient");
    const lambdaResult = await requestLambdaOperation("question_answer", {
      hiddenAnswer: hiddenWord,
      userQuestion: question,
    }, selectedModel);

    if (!lambdaResult || lambdaResult.error) {
      return {
        message: lambdaResult?.message || "AI 응답 생성에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
        error: true,
      };
    }

    const tag = (lambdaResult.verdict || lambdaResult.tag || lambdaResult.answer || "").toString().trim();
    const message = (lambdaResult.chatReply || lambdaResult.message || "").toString().trim();
    const reactionLine = (lambdaResult.characterLine || lambdaResult.reactionLine || lambdaResult.sideMessage || "").toString().trim();
    const reactionState = (lambdaResult.reactionState || lambdaResult.expressionState || "").toString().trim();
    const reactionEmoji = (lambdaResult.emotion || lambdaResult.reactionEmoji || lambdaResult.expressionEmoji || "").toString().trim();
    const reactionLabel = (lambdaResult.reactionLabel || lambdaResult.expressionLabel || "").toString().trim();
    const reasonType = (lambdaResult.reasonType || (tag === "?" ? "non_binary_question" : "binary_judgment")).toString().trim();

    if (["O", "X", "?"].includes(tag) && message) {
      return {
        message,
        tag,
        reasonType,
        reactionState,
        reactionEmoji,
        reactionLabel,
        reactionLine,
      };
    }
  } catch (err) {
    console.error("Lambda question_answer error:", err.message);
  }

  return { message: "AI 응답 생성에 실패했습니다. 잠시 뒤 다시 시도해 주세요.", error: true };
}

module.exports = {
  answerQuestion,
  maskHiddenAnswerInMessage,
};
