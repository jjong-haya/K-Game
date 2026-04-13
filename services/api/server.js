require("dotenv").config();

const config = require("./src/config");
const { getPool } = require("./src/db");
const { createApp } = require("./src/app");

const pool = getPool();

async function cleanupExpiredGuests() {
  try {
    const [result] = await pool.query(
      `UPDATE users
       SET is_active = 0,
           deleted_at = COALESCE(deleted_at, UTC_TIMESTAMP()),
           updated_at = UTC_TIMESTAMP()
       WHERE auth_type = 'guest'
         AND is_active = 1
         AND id NOT IN (
           SELECT user_id FROM auth_sessions
           WHERE revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()
         )`
    );
    if (result.affectedRows > 0) {
      console.log(JSON.stringify({ level: "info", event: "guest_cleanup", removed: result.affectedRows }));
    }
  } catch (err) {
    console.error("guest cleanup failed", err.message);
  }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function bootstrap() {
  await pool.query("SELECT 1");

  await cleanupExpiredGuests();
  setInterval(cleanupExpiredGuests, ONE_DAY_MS);

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
