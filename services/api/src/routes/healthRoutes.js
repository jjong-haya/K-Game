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
        wordHint: Boolean(config.gameLambda.wordHint.functionName || config.gameLambda.wordHint.url),
        dailyWordGenerate: Boolean(
          config.gameLambda.dailyWordGenerate.functionName || config.gameLambda.dailyWordGenerate.url,
        ),
      },
      supabaseConfigured: Boolean(config.supabaseUrl),
      dailyWordChallengeId: daily?.id || null,
    });
  });
}

module.exports = {
  registerHealthRoutes,
};
