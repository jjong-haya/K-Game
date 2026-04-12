require("dotenv").config();

const config = require("../src/config");
const { getPool } = require("../src/db");
const { buildTodayDateString } = require("../src/gameLogic");
const { requestLambdaOperation } = require("../src/lambdaClient");
const { createDailyWordChallengeService } = require("../src/modules/daily-word/challengeService");

async function run() {
  const pool = getPool();
  const overwrite = process.argv.includes("--overwrite");
  const challengeDate = (process.argv[2] || buildTodayDateString(config.timezone)).toString().trim().slice(0, 10);
  const configuredDailyWordLambda =
    config.gameLambda.dailyWordGenerate.functionName || config.gameLambda.dailyWordGenerate.url;
  const service = createDailyWordChallengeService({
    pool,
    buildTodayDateString,
    timezone: config.timezone,
  });

  try {
    let challenge;

    if (configuredDailyWordLambda) {
      const lambdaResult = await requestLambdaOperation("daily_word_generate", {
        challengeDate,
        overwrite,
      });

      if (lambdaResult?.error || lambdaResult?.ok === false) {
        throw new Error(lambdaResult?.message || "오늘의 단어 생성 Lambda 호출에 실패했습니다.");
      }

      challenge = await service.getDailyWordChallengeByDate(challengeDate);
    }

    if (!challenge) {
      challenge = await service.ensureGeneratedDailyWordChallenge({
        challengeDate,
        overwrite,
      });
    }

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
