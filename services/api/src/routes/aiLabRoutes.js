const { requestLambdaOperation } = require("../integrations/aws/lambdaClient");

function registerAiLabRoutes(app) {
  app.post("/api/ai-lab/raw", async (req, res) => {
    const input = String(req.body?.input || "");

    if (!input.trim()) {
      res.status(400).json({ message: "input is required." });
      return;
    }

    try {
      const result = await requestLambdaOperation("raw_prompt_lab", { input });

      if (!result || result.ok === false || typeof result.output !== "string") {
        res.status(502).json({
          message: result?.message || "AI request failed.",
        });
        return;
      }

      res.type("text/plain; charset=utf-8").send(result.output);
    } catch (error) {
      res.status(502).json({
        message: error?.message || "AI request failed.",
      });
    }
  });
}

module.exports = {
  registerAiLabRoutes,
};
