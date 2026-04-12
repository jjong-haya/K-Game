const DEFAULT_PUBLIC_TITLE = "오늘의 단어";
const VALID_STATUS = new Set(["active", "inactive"]);

const DAILY_WORD_CANDIDATES = [
  {
    categorySlug: "hunminjeongeum",
    publicTitle: "오늘의 단어",
    hiddenAnswerText: "훈민정음",
    fixedHintText: "세종이 만든 문자 체계와 바로 이어지는 단어입니다.",
    synonyms: ["훈민정음", "훈민정음해례"],
  },
  {
    categorySlug: "physics",
    publicTitle: "오늘의 단어",
    hiddenAnswerText: "관성",
    fixedHintText: "힘이 없으면 운동 상태를 그대로 유지하려는 성질입니다.",
    synonyms: ["관성", "관성의 법칙"],
  },
  {
    categorySlug: "math",
    publicTitle: "오늘의 단어",
    hiddenAnswerText: "미분",
    fixedHintText: "변화율을 계산할 때 가장 먼저 떠오르는 수학 개념입니다.",
    synonyms: ["미분", "도함수"],
  },
  {
    categorySlug: "biology",
    publicTitle: "오늘의 단어",
    hiddenAnswerText: "광합성",
    fixedHintText: "빛을 이용해 양분을 만드는 생명과학 개념입니다.",
    synonyms: ["광합성"],
  },
  {
    categorySlug: "world-history",
    publicTitle: "오늘의 단어",
    hiddenAnswerText: "르네상스",
    fixedHintText: "유럽에서 예술과 인간 중심 사고가 크게 살아난 시기입니다.",
    synonyms: ["르네상스"],
  },
  {
    categorySlug: "economics",
    publicTitle: "오늘의 단어",
    hiddenAnswerText: "인플레이션",
    fixedHintText: "물가가 전반적으로 오르는 경제 현상입니다.",
    synonyms: ["인플레이션", "물가상승"],
  },
  {
    categorySlug: "network",
    publicTitle: "오늘의 단어",
    hiddenAnswerText: "패킷",
    fixedHintText: "네트워크에서 데이터를 잘게 나눠 보내는 기본 단위입니다.",
    synonyms: ["패킷"],
  },
  {
    categorySlug: "security",
    publicTitle: "오늘의 단어",
    hiddenAnswerText: "방화벽",
    fixedHintText: "허용된 트래픽만 통과시키도록 앞단에서 막아주는 보안 장치입니다.",
    synonyms: ["방화벽", "firewall"],
  },
  {
    categorySlug: "aws-cloud",
    publicTitle: "오늘의 단어",
    hiddenAnswerText: "오토스케일링",
    fixedHintText: "트래픽에 맞춰 서버 수를 자동으로 늘리거나 줄이는 기능입니다.",
    synonyms: ["오토스케일링", "auto scaling", "autoscaling"],
  },
  {
    categorySlug: "game",
    publicTitle: "오늘의 단어",
    hiddenAnswerText: "레벨디자인",
    fixedHintText: "플레이 흐름과 재미가 살아나도록 스테이지를 설계하는 일입니다.",
    synonyms: ["레벨디자인", "레벨 디자인"],
  },
  {
    categorySlug: "astronomy",
    publicTitle: "오늘의 단어",
    hiddenAnswerText: "은하수",
    fixedHintText: "밤하늘에 길처럼 보이는 우리 은하의 띠입니다.",
    synonyms: ["은하수", "밀키웨이"],
  },
  {
    categorySlug: "korean-history",
    publicTitle: "오늘의 단어",
    hiddenAnswerText: "한양",
    fixedHintText: "조선의 수도 이름으로 자주 등장하는 역사 용어입니다.",
    synonyms: ["한양", "서울"],
  },
];

function trimText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function formatDateOnly(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || "").slice(0, 10);
  }

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeChallengeDate(challengeDate, fallbackDate) {
  const normalized = String(challengeDate || fallbackDate || "")
    .trim()
    .slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const error = new Error("날짜 형식은 YYYY-MM-DD 여야 합니다.");
    error.status = 400;
    throw error;
  }

  return normalized;
}

function normalizeStatus(status) {
  const normalized = trimText(status, 20).toLowerCase();
  return VALID_STATUS.has(normalized) ? normalized : "active";
}

function canonicalizeListValue(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeSynonyms(rawSynonyms) {
  const source = Array.isArray(rawSynonyms)
    ? rawSynonyms
    : String(rawSynonyms || "")
        .split(/\r?\n|,/)
        .map((value) => value.trim());

  const seen = new Set();
  const normalized = [];

  for (const item of source) {
    const value = trimText(item, 160);
    if (!value) {
      continue;
    }

    const key = canonicalizeListValue(value);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(value);
  }

  return normalized.slice(0, 12);
}

function isDuplicateChallengeDateError(error) {
  if (error?.code !== "ER_DUP_ENTRY" && error?.errno !== 1062) {
    return false;
  }

  const message = String(error?.sqlMessage || error?.message || "");
  return message.includes("daily_word_challenges.challenge_date");
}

function listsEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => canonicalizeListValue(item) === canonicalizeListValue(right[index]));
}

function buildCandidateSeed(challengeDate) {
  return Number(String(challengeDate || "").replace(/-/g, "")) || 0;
}

function pickDailyWordCandidate(challengeDate, categorySlug = "") {
  const normalizedCategorySlug = trimText(categorySlug, 60);
  const candidatePool = normalizedCategorySlug
    ? DAILY_WORD_CANDIDATES.filter((candidate) => candidate.categorySlug === normalizedCategorySlug)
    : DAILY_WORD_CANDIDATES;

  if (!candidatePool.length) {
    const error = new Error("선택한 카테고리에는 자동 생성용 후보가 아직 없습니다.");
    error.status = 400;
    throw error;
  }

  const index = buildCandidateSeed(challengeDate) % candidatePool.length;
  return candidatePool[index];
}

async function fetchCategories(poolOrConnection) {
  const [rows] = await poolOrConnection.query(
    "SELECT id, slug, name, display_order FROM categories ORDER BY display_order ASC, id ASC",
  );

  return rows.map((row) => ({
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    displayOrder: Number(row.display_order || 0),
  }));
}

async function fetchDailyWordRow(poolOrConnection, challengeDate) {
  const [rows] = await poolOrConnection.query(
    `
      SELECT
        daily.*,
        categories.id AS category_id,
        categories.slug AS category_slug,
        categories.name AS category_name
      FROM daily_word_challenges AS daily
      INNER JOIN categories ON categories.id = daily.hidden_category_id
      WHERE daily.challenge_date = ?
      ORDER BY daily.id DESC
      LIMIT 1
    `,
    [challengeDate],
  );

  return rows[0] || null;
}

async function fetchSynonyms(poolOrConnection, challengeId) {
  const [rows] = await poolOrConnection.query(
    "SELECT synonym_text FROM daily_word_synonyms WHERE challenge_id = ? ORDER BY id ASC",
    [challengeId],
  );

  return rows.map((row) => row.synonym_text);
}

async function fetchChallengeStats(poolOrConnection, challengeId) {
  const [[row]] = await poolOrConnection.query(
    `
      SELECT
        (SELECT COUNT(*) FROM participants WHERE mode = 'word' AND target_id = ?) AS participant_count,
        (SELECT COUNT(*) FROM attempts WHERE mode = 'word' AND target_id = ?) AS attempt_count,
        (SELECT COUNT(*) FROM wins WHERE mode = 'word' AND target_id = ?) AS win_count
    `,
    [challengeId, challengeId, challengeId],
  );

  return {
    participantCount: Number(row?.participant_count || 0),
    attemptCount: Number(row?.attempt_count || 0),
    winCount: Number(row?.win_count || 0),
  };
}

async function resolveCategory(poolOrConnection, { categoryId, categorySlug } = {}) {
  if (Number.isFinite(Number(categoryId)) && Number(categoryId) > 0) {
    const [rows] = await poolOrConnection.query(
      "SELECT id, slug, name FROM categories WHERE id = ? LIMIT 1",
      [Number(categoryId)],
    );

    if (rows[0]) {
      return {
        id: Number(rows[0].id),
        slug: rows[0].slug,
        name: rows[0].name,
      };
    }
  }

  if (trimText(categorySlug, 60)) {
    const [rows] = await poolOrConnection.query(
      "SELECT id, slug, name FROM categories WHERE slug = ? LIMIT 1",
      [trimText(categorySlug, 60)],
    );

    if (rows[0]) {
      return {
        id: Number(rows[0].id),
        slug: rows[0].slug,
        name: rows[0].name,
      };
    }
  }

  const error = new Error("카테고리를 찾을 수 없습니다.");
  error.status = 400;
  throw error;
}

function normalizeChallengePayload(payload = {}) {
  const hiddenAnswerText = trimText(payload.hiddenAnswerText, 160);
  if (!hiddenAnswerText) {
    const error = new Error("정답 단어를 입력해 주세요.");
    error.status = 400;
    throw error;
  }

  return {
    publicTitle: trimText(payload.publicTitle, 120) || DEFAULT_PUBLIC_TITLE,
    hiddenAnswerText,
    fixedHintText: trimText(payload.fixedHintText, 255),
    status: normalizeStatus(payload.status),
    synonyms: normalizeSynonyms(payload.synonyms),
    categoryId: payload.categoryId,
    categorySlug: payload.categorySlug,
  };
}

async function hydrateChallenge(poolOrConnection, row) {
  if (!row) {
    return null;
  }

  const synonyms = await fetchSynonyms(poolOrConnection, Number(row.id));
  const stats = await fetchChallengeStats(poolOrConnection, Number(row.id));

  return {
    id: Number(row.id),
    challengeDate: formatDateOnly(row.challenge_date),
    publicTitle: row.public_title,
    hiddenAnswerText: row.hidden_answer_text,
    fixedHintText: row.fixed_hint_text || "",
    status: row.status,
    synonyms,
    stats,
    category: {
      id: Number(row.category_id),
      slug: row.category_slug,
      name: row.category_name,
    },
  };
}

function shouldResetProgress(existingChallenge, nextChallenge) {
  return (
    canonicalizeListValue(existingChallenge.hiddenAnswerText) !== canonicalizeListValue(nextChallenge.hiddenAnswerText)
    || Number(existingChallenge.category.id) !== Number(nextChallenge.category.id)
    || !listsEqual(existingChallenge.synonyms, nextChallenge.synonyms)
  );
}

function shouldClearSharedHints(existingChallenge, nextChallenge) {
  return (
    shouldResetProgress(existingChallenge, nextChallenge)
    || canonicalizeListValue(existingChallenge.fixedHintText) !== canonicalizeListValue(nextChallenge.fixedHintText)
  );
}

async function clearDailyWordProgress(poolOrConnection, challengeId) {
  await poolOrConnection.query(
    "DELETE FROM participants WHERE mode = 'word' AND target_id = ?",
    [challengeId],
  );
}

async function clearDailyWordHints(poolOrConnection, challengeId) {
  await poolOrConnection.query("DELETE FROM daily_word_ai_hints WHERE challenge_id = ?", [challengeId]);
}

async function replaceSynonyms(poolOrConnection, challengeId, synonyms) {
  await poolOrConnection.query("DELETE FROM daily_word_synonyms WHERE challenge_id = ?", [challengeId]);

  for (const synonym of synonyms) {
    await poolOrConnection.query(
      "INSERT INTO daily_word_synonyms (challenge_id, synonym_text) VALUES (?, ?)",
      [challengeId, synonym],
    );
  }
}

async function executeUpsertDailyWordChallenge({
  createOrUpdateDailyWord,
  getDailyWordChallengeByDate,
  normalizedDate,
  normalizedPayload,
  overwrite,
}) {
  try {
    return await createOrUpdateDailyWord(async (connection) => {
      const category = await resolveCategory(connection, normalizedPayload);
      const existingRow = await fetchDailyWordRow(connection, normalizedDate);
      const existingChallenge = await hydrateChallenge(connection, existingRow);

      if (existingChallenge && !overwrite) {
        return existingChallenge;
      }

      let challengeId = existingChallenge?.id || null;

      if (!challengeId) {
        const [insertResult] = await connection.query(
          `
            INSERT INTO daily_word_challenges (
              challenge_date,
              public_title,
              hidden_answer_text,
              hidden_category_id,
              fixed_hint_text,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            normalizedDate,
            normalizedPayload.publicTitle,
            normalizedPayload.hiddenAnswerText,
            category.id,
            normalizedPayload.fixedHintText || null,
            normalizedPayload.status,
          ],
        );

        challengeId = Number(insertResult.insertId);
      } else {
        const nextChallengeShape = {
          ...normalizedPayload,
          category,
        };

        if (shouldClearSharedHints(existingChallenge, nextChallengeShape)) {
          await clearDailyWordHints(connection, challengeId);
        }

        if (shouldResetProgress(existingChallenge, nextChallengeShape)) {
          await clearDailyWordProgress(connection, challengeId);
        }

        await connection.query(
          `
            UPDATE daily_word_challenges
            SET
              public_title = ?,
              hidden_answer_text = ?,
              hidden_category_id = ?,
              fixed_hint_text = ?,
              status = ?
            WHERE id = ?
          `,
          [
            normalizedPayload.publicTitle,
            normalizedPayload.hiddenAnswerText,
            category.id,
            normalizedPayload.fixedHintText || null,
            normalizedPayload.status,
            challengeId,
          ],
        );
      }

      await replaceSynonyms(connection, challengeId, normalizedPayload.synonyms);

      const updatedRow = await fetchDailyWordRow(connection, normalizedDate);
      return hydrateChallenge(connection, updatedRow);
    });
  } catch (error) {
    if (!isDuplicateChallengeDateError(error)) {
      throw error;
    }

    const existing = await getDailyWordChallengeByDate(normalizedDate);
    if (existing && !overwrite) {
      return existing;
    }

    return createOrUpdateDailyWord(async (connection) => {
      const category = await resolveCategory(connection, normalizedPayload);
      const existingRow = await fetchDailyWordRow(connection, normalizedDate);
      const existingChallenge = await hydrateChallenge(connection, existingRow);

      if (!existingChallenge) {
        throw error;
      }

      if (!overwrite) {
        return existingChallenge;
      }

      const nextChallengeShape = {
        ...normalizedPayload,
        category,
      };

      if (shouldClearSharedHints(existingChallenge, nextChallengeShape)) {
        await clearDailyWordHints(connection, existingChallenge.id);
      }

      if (shouldResetProgress(existingChallenge, nextChallengeShape)) {
        await clearDailyWordProgress(connection, existingChallenge.id);
      }

      await connection.query(
        `
          UPDATE daily_word_challenges
          SET
            public_title = ?,
            hidden_answer_text = ?,
            hidden_category_id = ?,
            fixed_hint_text = ?,
            status = ?
          WHERE id = ?
        `,
        [
          normalizedPayload.publicTitle,
          normalizedPayload.hiddenAnswerText,
          category.id,
          normalizedPayload.fixedHintText || null,
          normalizedPayload.status,
          existingChallenge.id,
        ],
      );

      await replaceSynonyms(connection, existingChallenge.id, normalizedPayload.synonyms);

      const updatedRow = await fetchDailyWordRow(connection, normalizedDate);
      return hydrateChallenge(connection, updatedRow);
    });
  }
}

function createDailyWordChallengeService({ pool, buildTodayDateString, timezone }) {
  const buildFallbackDate = () => buildTodayDateString(timezone);

  async function listCategories() {
    return fetchCategories(pool);
  }

  async function getDailyWordChallengeByDate(challengeDate, executor = pool) {
    const normalizedDate = normalizeChallengeDate(challengeDate, buildFallbackDate());
    const row = await fetchDailyWordRow(executor, normalizedDate);
    return hydrateChallenge(executor, row);
  }

  async function getTodayDailyWordChallenge(executor = pool) {
    return getDailyWordChallengeByDate(buildFallbackDate(), executor);
  }

  async function getDailySynonyms(challengeId, executor = pool) {
    return fetchSynonyms(executor, challengeId);
  }

  async function createOrUpdateDailyWord(work) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function upsertDailyWordChallenge(payload = {}, options = {}) {
    const normalizedDate = normalizeChallengeDate(payload.challengeDate, buildFallbackDate());
    const normalizedPayload = normalizeChallengePayload(payload);
    const overwrite = options.overwrite !== false;

    return executeUpsertDailyWordChallenge({
      createOrUpdateDailyWord,
      getDailyWordChallengeByDate,
      normalizedDate,
      normalizedPayload,
      overwrite,
    });
  }

  async function ensureGeneratedDailyWordChallenge({
    challengeDate,
    overwrite = false,
    categoryId,
    categorySlug,
  } = {}) {
    const normalizedDate = normalizeChallengeDate(challengeDate, buildFallbackDate());
    let resolvedCategorySlug = trimText(categorySlug, 60);

    if (!resolvedCategorySlug && Number.isFinite(Number(categoryId)) && Number(categoryId) > 0) {
      const category = await resolveCategory(pool, { categoryId });
      resolvedCategorySlug = category.slug;
    }

    if (!overwrite) {
      const existing = await getDailyWordChallengeByDate(normalizedDate);
      if (existing) {
        if (resolvedCategorySlug && existing.category?.slug !== resolvedCategorySlug) {
          const error = new Error(
            "이미 해당 날짜에 다른 카테고리의 오늘의 단어가 있습니다. 다시 생성으로 덮어쓰거나 날짜를 바꿔 주세요.",
          );
          error.status = 409;
          throw error;
        }
        return existing;
      }
    }

    const candidate = pickDailyWordCandidate(normalizedDate, resolvedCategorySlug);

    return upsertDailyWordChallenge(
      {
        challengeDate: normalizedDate,
        publicTitle: candidate.publicTitle || DEFAULT_PUBLIC_TITLE,
        hiddenAnswerText: candidate.hiddenAnswerText,
        categorySlug: candidate.categorySlug,
        fixedHintText: candidate.fixedHintText,
        status: "active",
        synonyms: candidate.synonyms,
      },
      { overwrite: true },
    );
  }

  async function getAdminDailyWordView(challengeDate) {
    const challenge = await getDailyWordChallengeByDate(challengeDate || buildFallbackDate());
    return {
      challenge,
      categories: await listCategories(),
    };
  }

  return {
    DAILY_WORD_CANDIDATES,
    ensureGeneratedDailyWordChallenge,
    getAdminDailyWordView,
    getDailySynonyms,
    getDailyWordChallengeByDate,
    getTodayDailyWordChallenge,
    listCategories,
    normalizeSynonyms,
    pickDailyWordCandidate,
    upsertDailyWordChallenge,
  };
}

module.exports = {
  DAILY_WORD_CANDIDATES,
  createDailyWordChallengeService,
  isDuplicateChallengeDateError,
  normalizeSynonyms,
  pickDailyWordCandidate,
};
