require("dotenv").config();

const config = require("../src/config");
const { getPool } = require("../src/db");
const { buildTodayDateString } = require("../src/gameLogic");
const { createDailyWordChallengeService } = require("../src/modules/daily-word/challengeService");

async function run() {
  const pool = getPool();
  const overwrite = process.argv.includes("--overwrite");
  const challengeDate = (process.argv[2] || buildTodayDateString(config.timezone)).toString().trim().slice(0, 10);
  const service = createDailyWordChallengeService({
    pool,
    buildTodayDateString,
    timezone: config.timezone,
  });

  try {
    const challenge = await service.ensureGeneratedDailyWordChallenge({
      challengeDate,
      overwrite,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          overwrite,
          challengeDate: challenge.challengeDate,
          category: challenge.category.slug,
          answer: challenge.hiddenAnswerText,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("daily word generation failed", error);
  process.exit(1);
});
