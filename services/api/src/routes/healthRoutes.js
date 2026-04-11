function registerHealthRoutes(app, deps) {
  const { config, buildTodayDateString, getDailyWordChallenge } = deps;

  app.get("/api/health", async (req, res) => {
    const daily = await getDailyWordChallenge();
    res.json({
      ok: true,
      service: "prompt-duel-game",
      date: buildTodayDateString(config.timezone),
      lambdaConfigured: {
        prompt: Boolean(config.gameLambda.prompt.functionName || config.gameLambda.prompt.url),
        wordJudge: Boolean(config.gameLambda.wordJudge.functionName || config.gameLambda.wordJudge.url),
        wordReply: Boolean(config.gameLambda.wordReply.functionName || config.gameLambda.wordReply.url),
        wordHint: Boolean(config.gameLambda.wordHint.functionName || config.gameLambda.wordHint.url),
      },
      supabaseConfigured: Boolean(config.supabaseUrl),
      dailyWordChallengeId: daily?.id || null,
    });
  });
}

module.exports = {
  registerHealthRoutes,
};
