require("dotenv").config();

const config = require("./src/config");
const { getPool } = require("./src/db");
const { createApp } = require("./src/app");

const pool = getPool();

async function bootstrap() {
  await pool.query("SELECT 1");

  const app = createApp({ pool });
  app.listen(config.port, () => {
    console.log(
      JSON.stringify({
        level: "info",
        event: "server_started",
        port: config.port,
        promptLambdaConfigured: Boolean(config.gameLambda.prompt.functionName || config.gameLambda.prompt.url),
        wordHintLambdaConfigured: Boolean(
          config.gameLambda.wordHint.functionName || config.gameLambda.wordHint.url,
        ),
        geminiLambdaConfigured: Boolean(config.gameLambda.gemini.functionName || config.gameLambda.gemini.url),
      }),
    );
  });
}

bootstrap().catch((error) => {
  console.error("server bootstrap failed", error);
  process.exit(1);
});
