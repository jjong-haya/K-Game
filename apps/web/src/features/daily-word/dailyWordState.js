function normalizeWordTurn(wordTurn = null) {
  if (!wordTurn || typeof wordTurn !== "object") {
    return null;
  }

  const analysis = wordTurn.analysis || {};
  const judge = wordTurn.judge || {};
  const emotion = wordTurn.emotion || {};

  return {
    analysis: {
      inputType: analysis.inputType || "unclear",
      questionQuality: analysis.questionQuality || "okay",
      mood: analysis.mood || "neutral",
    },
    judge: {
      verdict: judge.verdict || "?",
      confidence: Number.isFinite(Number(judge.confidence)) ? Number(judge.confidence) : 0,
      reasonType: judge.reasonType || "non_binary_question",
    },
    chatReply: wordTurn.chatReply || "",
    friendReply: wordTurn.friendReply || "",
    emotion: {
      emojiKey: emotion.emojiKey || "neutral",
      label: emotion.label || "차분",
      intensity: Number.isFinite(Number(emotion.intensity)) ? Number(emotion.intensity) : 0.45,
    },
    innerThought: wordTurn.innerThought || "",
  };
}

export function normalizeDailyState(payload) {
  const root = payload?.snapshot || payload || {};
  return {
    challenge: root.challenge || root.wordChallenge || root.dailyChallenge || {},
    player: root.player || root.participant || {},
    conversation: root.conversation || root.player?.conversation || root.messages || [],
    hints: root.hints || root.hintState || root.player?.hintState || {},
  };
}

export function normalizeLeaderboard(payload) {
  const root = payload?.leaderboards || payload?.leaderboard || payload || {};
  const successOrder = root.successOrder || root.successTime || root.firstSuccess || root.success || [];
  const fewestAttempts = root.fewestAttempts || root.bestAttempts || root.attemptOrder || root.attempts || [];

  return {
    successOrder: Array.isArray(successOrder) ? successOrder : [],
    fewestAttempts: Array.isArray(fewestAttempts) ? fewestAttempts : [],
  };
}

export function formatAttemptsLeft(player) {
  if (typeof player.attemptsLeft === "number") return player.attemptsLeft;
  if (typeof player.remainingAttempts === "number") return player.remainingAttempts;
  if (typeof player.attemptsUsed === "number") return Math.max(0, 20 - player.attemptsUsed);
  return 20;
}

export function buildConversation(conversation = [], player = {}) {
  if (Array.isArray(conversation) && conversation.length) {
    return conversation.map((message, index) => ({
      id: message.id || `${message.role || "msg"}-${index}`,
      role: message.role || message.sender || (message.isUser ? "user" : "assistant"),
      content: message.content || message.message || message.text || "",
      score: message.score ?? null,
      category: message.category || message.reactionCategory || null,
      meta: message.meta || null,
    }));
  }

  const attempts = Array.isArray(player.history) ? player.history : [];
  return attempts.flatMap((attempt, index) => {
    const wordTurn = normalizeWordTurn(attempt.wordTurn);

    return [
      {
        id: `${attempt.id || index}-user`,
        role: "user",
        content: attempt.inputText || attempt.promptPreview || "",
      },
      {
        id: `${attempt.id || index}-assistant`,
        role: "assistant",
        content: wordTurn?.chatReply || attempt.aiMessage || attempt.reactionText || attempt.summary || "응답을 준비하는 중입니다.",
        score: attempt.finalScore ?? attempt.score ?? null,
        category: attempt.reactionCategory || attempt.category || null,
        meta: wordTurn?.judge?.verdict || null,
      },
    ];
  });
}

export function mapWordAttempts(items = []) {
  return [...items]
    .reverse()
    .map((item, index) => {
      const wordTurn = normalizeWordTurn(item.wordTurn);
      const verdict = wordTurn?.judge?.verdict || (item.isSuccess ? "정답" : "?");
      return {
        id: item.id || `${index}-${item.createdAt || index}`,
        label: item.inputText || item.guess || item.value || "",
        value: item.isSuccess ? "🎉" : verdict,
        badge: item.isSuccess ? "정답" : null,
      };
    });
}

export function buildWordStats(challenge, player, leaderboard) {
  return [
    {
      label: "남은 질문",
      value: `${formatAttemptsLeft(player)}회`,
      hint: "",
    },
    {
      label: "힌트 사용",
      value: `${player.hintsUsed || 0}/3`,
      hint: "",
    },
    {
      label: "오늘 성공자",
      value: leaderboard.successOrder.length || challenge.successCount || 0,
      hint: "",
    },
  ];
}

export function buildWordVerdictCounts(history = []) {
  return history.reduce(
    (accumulator, item) => {
      const wordTurn = normalizeWordTurn(item.wordTurn);
      const verdict = wordTurn?.judge?.verdict;

      if (verdict === "O") {
        accumulator.O += 1;
      } else if (verdict === "X") {
        accumulator.X += 1;
      } else if (verdict === "?") {
        accumulator["?"] += 1;
      }

      return accumulator;
    },
    { O: 0, X: 0, "?": 0 },
  );
}

export function getLatestWordTurn(player, transientTurn = null) {
  if (transientTurn) {
    return normalizeWordTurn(transientTurn);
  }

  return normalizeWordTurn(player?.latestTurn) || null;
}
