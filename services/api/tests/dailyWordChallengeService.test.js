const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createDailyWordChallengeService,
  isDuplicateChallengeDateError,
  normalizeSynonyms,
  pickDailyWordCandidate,
} = require("../src/modules/daily-word/challengeService");

test("pickDailyWordCandidate returns deterministic candidates for the same date", () => {
  const left = pickDailyWordCandidate("2026-04-11");
  const right = pickDailyWordCandidate("2026-04-11");

  assert.deepEqual(left, right);
  assert.ok(left.hiddenAnswerText);
  assert.ok(left.categorySlug);
});

test("pickDailyWordCandidate respects the selected category", () => {
  const candidate = pickDailyWordCandidate("2026-04-11", "physics");

  assert.equal(candidate.categorySlug, "physics");
});

test("pickDailyWordCandidate throws when the selected category has no candidate", () => {
  assert.throws(
    () => pickDailyWordCandidate("2026-04-11", "non-existent-category"),
    /자동 생성용 후보/,
  );
});

test("normalizeSynonyms removes blanks and duplicates", () => {
  assert.deepEqual(
    normalizeSynonyms(["  훈민정음  ", "", "훈민정음", "훈민정음 해례", "훈민정음 해례"]),
    ["훈민정음", "훈민정음 해례"],
  );

  assert.deepEqual(
    normalizeSynonyms("패킷,\n패킷, firewall, firewall"),
    ["패킷", "firewall"],
  );
});

test("isDuplicateChallengeDateError matches the daily challenge date unique-key error", () => {
  assert.equal(
    isDuplicateChallengeDateError({
      code: "ER_DUP_ENTRY",
      sqlMessage: "Duplicate entry '2026-04-13' for key 'daily_word_challenges.challenge_date'",
    }),
    true,
  );

  assert.equal(
    isDuplicateChallengeDateError({
      code: "ER_DUP_ENTRY",
      sqlMessage: "Duplicate entry '1-1' for key 'daily_word_synonyms.some_other_key'",
    }),
    false,
  );
});

test("upsertDailyWordChallenge recovers when the same day is inserted concurrently", async () => {
  const challengeRow = {
    id: 77,
    challenge_date: "2026-04-13",
    public_title: "오늘의 단어",
    hidden_answer_text: "오토스케일링",
    fixed_hint_text: "트래픽에 따라 서버 수를 조절하는 기능",
    status: "active",
    category_id: 30,
    category_slug: "aws-cloud",
    category_name: "AWS/Cloud",
  };

  const makeConnection = (handler) => ({
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    query(sql, params) {
      return handler(sql, params);
    },
  });

  let connectionIndex = 0;
  const pool = {
    async getConnection() {
      connectionIndex += 1;

      if (connectionIndex === 1) {
        return makeConnection(async (sql) => {
          if (sql.includes("SELECT id, slug, name FROM categories WHERE slug = ?")) {
            return [[{ id: 30, slug: "aws-cloud", name: "AWS/Cloud" }]];
          }

          if (sql.includes("FROM daily_word_challenges AS daily")) {
            return [[]];
          }

          if (sql.includes("INSERT INTO daily_word_challenges")) {
            const error = new Error(
              "Duplicate entry '2026-04-13' for key 'daily_word_challenges.challenge_date'",
            );
            error.code = "ER_DUP_ENTRY";
            error.errno = 1062;
            error.sqlMessage =
              "Duplicate entry '2026-04-13' for key 'daily_word_challenges.challenge_date'";
            throw error;
          }

          throw new Error(`unexpected first-connection query: ${sql}`);
        });
      }

      return makeConnection(async (sql) => {
        if (sql.includes("SELECT id, slug, name FROM categories WHERE slug = ?")) {
          return [[{ id: 30, slug: "aws-cloud", name: "AWS/Cloud" }]];
        }

        if (sql.includes("FROM daily_word_challenges AS daily")) {
          return [[challengeRow]];
        }

        if (sql.includes("UPDATE daily_word_challenges")) {
          return [{ affectedRows: 1 }];
        }

        if (sql.includes("DELETE FROM daily_word_synonyms")) {
          return [{ affectedRows: 0 }];
        }

        if (sql.includes("SELECT synonym_text FROM daily_word_synonyms")) {
          return [[]];
        }

        if (sql.includes("SELECT") && sql.includes("participant_count")) {
          return [[{ participant_count: 0, attempt_count: 0, win_count: 0 }]];
        }

        throw new Error(`unexpected retry query: ${sql}`);
      });
    },
    async query(sql) {
      if (sql.includes("FROM daily_word_challenges AS daily")) {
        return [[challengeRow]];
      }

      if (sql.includes("SELECT synonym_text FROM daily_word_synonyms")) {
        return [[]];
      }

      if (sql.includes("SELECT") && sql.includes("participant_count")) {
        return [[{ participant_count: 0, attempt_count: 0, win_count: 0 }]];
      }

      throw new Error(`unexpected pool query: ${sql}`);
    },
  };

  const service = createDailyWordChallengeService({
    pool,
    buildTodayDateString: () => "2026-04-13",
    timezone: "Asia/Seoul",
  });

  const result = await service.upsertDailyWordChallenge(
    {
      challengeDate: "2026-04-13",
      publicTitle: "오늘의 단어",
      hiddenAnswerText: "오토스케일링",
      categorySlug: "aws-cloud",
      fixedHintText: "트래픽에 따라 서버 수를 조절하는 기능",
      synonyms: [],
    },
    { overwrite: true },
  );

  assert.equal(result.id, 77);
  assert.equal(result.challengeDate, "2026-04-13");
  assert.equal(result.hiddenAnswerText, "오토스케일링");
  assert.equal(result.category.slug, "aws-cloud");
  assert.equal(connectionIndex, 2);
});
