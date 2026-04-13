const {
  BedrockRuntimeClient,
  ConverseCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const mysql = require("mysql2/promise");

const DEFAULT_MODEL_ID = "amazon.nova-lite-v1:0";
const DEFAULT_PUBLIC_TITLE = "오늘의 단어";
const MAX_OUTPUT_TOKENS = 320;
const GENERATION_TEMPERATURE = 0.5;
const VALID_STATUS = new Set(["active", "inactive"]);

let pool;

const SYSTEM_PROMPT = `
You generate one Korean "daily word" challenge for an educational guessing game.

Rules:
- Return strict JSON only.
- The answer must fit the selected category.
- Choose a wide variety: celebrities, historical figures, everyday objects, food, places, scientific terms, slang, etc.
- Difficulty should be easy to medium — something most Korean adults would recognize.
- Do not choose a full sentence, phone number, URL, or private information.
- publicTitle should usually stay short and generic.

Output shape:
{
  "publicTitle": "오늘의 단어",
  "hiddenAnswerText": "Korean answer"
}
`.trim();

function safeJsonParse(input, fallback = {}) {
  if (typeof input !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(input);
  } catch {
    return fallback;
  }
}

function buildTodayDateString(timezone = process.env.APP_TIMEZONE || "Asia/Seoul") {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function trimText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeChallengeDate(value, fallbackDate = buildTodayDateString()) {
  let raw = value;
  if (raw instanceof Date) {
    raw = raw.toISOString().slice(0, 10);
  }
  const normalized = String(raw || fallbackDate || "").trim().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const error = new Error("날짜 형식은 YYYY-MM-DD 여야 합니다.");
    error.status = 400;
    throw error;
  }

  return normalized;
}

function normalizeStatus(value) {
  const normalized = trimText(value, 20).toLowerCase();
  return VALID_STATUS.has(normalized) ? normalized : "active";
}

function canonicalizeListValue(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeSynonyms(rawSynonyms, hiddenAnswerText = "") {
  const source = Array.isArray(rawSynonyms)
    ? rawSynonyms
    : String(rawSynonyms || "")
        .split(/\r?\n|,/)
        .map((value) => value.trim());

  const seen = new Set();
  const normalized = [];
  const answerKey = canonicalizeListValue(hiddenAnswerText);

  if (answerKey) {
    seen.add(answerKey);
    normalized.push(trimText(hiddenAnswerText, 160));
  }

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

function listsEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => canonicalizeListValue(item) === canonicalizeListValue(right[index]));
}

function buildMaskCandidates(hiddenAnswer) {
  const trimmed = String(hiddenAnswer || "").trim();
  const collapsed = trimmed.replace(/\s+/g, " ");
  const compact = trimmed.replace(/\s+/g, "");

  return [...new Set([trimmed, collapsed, compact].filter(Boolean))].sort((left, right) => right.length - left.length);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function maskHiddenAnswerInMessage(message, hiddenAnswer) {
  let sanitized = String(message || "");

  for (const candidate of buildMaskCandidates(hiddenAnswer)) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(candidate), "gu"), "**");
  }

  return sanitized;
}

function sanitizeOutputText(value, hiddenAnswer, maxLength) {
  return maskHiddenAnswerInMessage(String(value || "").trim(), hiddenAnswer).slice(0, maxLength);
}

function isHttpEvent(event) {
  return Boolean(event?.requestContext?.http);
}

function isScheduledEvent(event) {
  return event?.source === "aws.events" || event?.["detail-type"] === "Scheduled Event";
}

function unwrapPayload(event) {
  if (!event) {
    return {};
  }

  if (typeof event === "string") {
    return safeJsonParse(event, {});
  }

  if (isScheduledEvent(event)) {
    return {
      operation: "daily_word_generate",
      ...(event.detail || {}),
    };
  }

  if (event.body) {
    if (typeof event.body === "string") {
      return safeJsonParse(event.body, {});
    }

    return event.body;
  }

  return event;
}

function buildHttpResponse(result) {
  return {
    statusCode: Number(result?.httpStatusCode || (result?.ok === false ? 400 : 200)),
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(result),
  };
}

function createSuccessResponse(operation, body = {}, httpStatusCode = 200) {
  return {
    ok: true,
    operation,
    date: buildTodayDateString(),
    httpStatusCode,
    ...body,
  };
}

function createErrorResponse(operation, code, message, httpStatusCode, extra = {}) {
  return {
    ok: false,
    operation,
    date: buildTodayDateString(),
    error: true,
    code,
    message,
    httpStatusCode,
    ...extra,
  };
}

function parseJsonFromText(text) {
  if (!text) {
    return {};
  }

  const trimmed = String(text).trim();
  if (!trimmed) {
    return {};
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return safeJsonParse(fenced[1], {});
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return safeJsonParse(trimmed.slice(firstBrace, lastBrace + 1), {});
  }

  return safeJsonParse(trimmed, {});
}

function buildBedrockClient() {
  if (!process.env.AWS_REGION) {
    return null;
  }

  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION,
  });
}

function buildPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "daily_prompt_game",
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 2),
      queueLimit: 0,
    });
  }

  return pool;
}

async function fetchCategories(executor) {
  const [rows] = await executor.query(
    "SELECT id, slug, name, display_order FROM categories ORDER BY display_order ASC, id ASC",
  );

  return rows.map((row) => ({
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    displayOrder: Number(row.display_order || 0),
  }));
}

async function fetchCategoryById(executor, categoryId) {
  const [rows] = await executor.query(
    "SELECT id, slug, name, display_order FROM categories WHERE id = ? LIMIT 1",
    [Number(categoryId)],
  );
  return rows[0] || null;
}

async function fetchCategoryBySlug(executor, categorySlug) {
  const [rows] = await executor.query(
    "SELECT id, slug, name, display_order FROM categories WHERE slug = ? LIMIT 1",
    [String(categorySlug || "").trim()],
  );
  return rows[0] || null;
}

function buildDateSeed(challengeDate) {
  return Number(String(challengeDate || "").replace(/-/g, "")) || 0;
}

async function resolveCategory(executor, payload = {}, challengeDate) {
  if (Number.isFinite(Number(payload.categoryId)) && Number(payload.categoryId) > 0) {
    const row = await fetchCategoryById(executor, payload.categoryId);
    if (!row) {
      const error = new Error("선택한 카테고리를 찾을 수 없습니다.");
      error.status = 400;
      throw error;
    }
    return {
      id: Number(row.id),
      slug: row.slug,
      name: row.name,
      displayOrder: Number(row.display_order || 0),
    };
  }

  if (trimText(payload.categorySlug, 60)) {
    const row = await fetchCategoryBySlug(executor, payload.categorySlug);
    if (!row) {
      const error = new Error("선택한 카테고리를 찾을 수 없습니다.");
      error.status = 400;
      throw error;
    }
    return {
      id: Number(row.id),
      slug: row.slug,
      name: row.name,
      displayOrder: Number(row.display_order || 0),
    };
  }

  const categories = await fetchCategories(executor);
  if (!categories.length) {
    const error = new Error("카테고리 데이터가 없어 오늘의 단어를 생성할 수 없습니다.");
    error.status = 400;
    throw error;
  }

  return categories[buildDateSeed(challengeDate) % categories.length];
}

async function fetchDailyWordRow(executor, challengeDate) {
  const [rows] = await executor.query(
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

async function fetchSynonyms(executor, challengeId) {
  const [rows] = await executor.query(
    "SELECT synonym_text FROM daily_word_synonyms WHERE challenge_id = ? ORDER BY id ASC",
    [challengeId],
  );

  return rows.map((row) => row.synonym_text);
}

async function hydrateChallenge(executor, row) {
  if (!row) {
    return null;
  }

  const synonyms = await fetchSynonyms(executor, Number(row.id));
  return {
    id: Number(row.id),
    challengeDate: normalizeChallengeDate(row.challenge_date),
    publicTitle: row.public_title,
    hiddenAnswerText: row.hidden_answer_text,
    fixedHintText: row.fixed_hint_text || "",
    status: row.status,
    synonyms,
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

async function clearDailyWordProgress(executor, challengeId) {
  await executor.query(
    "DELETE FROM participants WHERE mode = 'word' AND target_id = ?",
    [challengeId],
  );
}

async function clearDailyWordHints(executor, challengeId) {
  await executor.query("DELETE FROM daily_word_ai_hints WHERE challenge_id = ?", [challengeId]);
}

async function replaceSynonyms(executor, challengeId, synonyms) {
  await executor.query("DELETE FROM daily_word_synonyms WHERE challenge_id = ?", [challengeId]);

  for (const synonym of synonyms) {
    await executor.query(
      "INSERT INTO daily_word_synonyms (challenge_id, synonym_text) VALUES (?, ?)",
      [challengeId, synonym],
    );
  }
}

function normalizeGeneratedChallenge(raw, category) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const hiddenAnswerText = trimText(raw.hiddenAnswerText, 160);
  if (!hiddenAnswerText) {
    return null;
  }

  const publicTitle = trimText(raw.publicTitle, 120) || DEFAULT_PUBLIC_TITLE;
  const fixedHintText = sanitizeOutputText(raw.fixedHintText, hiddenAnswerText, 255);
  const synonyms = normalizeSynonyms(raw.synonyms, hiddenAnswerText);

  return {
    publicTitle,
    hiddenAnswerText,
    fixedHintText,
    status: normalizeStatus(raw.status),
    synonyms,
    category,
  };
}

function buildGeneratePrompt({ challengeDate, category, difficulty, extraInstruction }) {
  return JSON.stringify(
    {
      challengeDate,
      categorySlug: category.slug,
      categoryName: category.name,
      difficulty: difficulty || "normal",
      publicTitleGuide: DEFAULT_PUBLIC_TITLE,
      extraInstruction: trimText(extraInstruction, 400) || null,
    },
    null,
    2,
  );
}

async function generateChallengeViaBedrock(payload) {
  const client = buildBedrockClient();
  if (!client) {
    throw new Error("AWS_REGION is not configured.");
  }

  const command = new ConverseCommand({
    modelId: process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL_ID,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [
      {
        role: "user",
        content: [{ text: buildGeneratePrompt(payload) }],
      },
    ],
    inferenceConfig: {
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: GENERATION_TEMPERATURE,
      topP: 0.9,
    },
  });

  const response = await client.send(command);
  const content = response?.output?.message?.content || [];
  const text = content.map((item) => item.text || "").join("\n").trim();
  return parseJsonFromText(text);
}

async function createOrUpdateDailyWord(work) {
  const connection = await buildPool().getConnection();

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

async function upsertDailyWordChallenge(payload = {}) {
  const normalizedDate = normalizeChallengeDate(payload.challengeDate);
  const overwrite = Boolean(payload.overwrite);

  return createOrUpdateDailyWord(async (connection) => {
    const category = await resolveCategory(connection, payload, normalizedDate);
    const existingRow = await fetchDailyWordRow(connection, normalizedDate);
    const existingChallenge = await hydrateChallenge(connection, existingRow);

    if (existingChallenge && !overwrite) {
      if (payload.categorySlug && existingChallenge.category.slug !== payload.categorySlug) {
        const error = new Error("이미 해당 날짜에 다른 카테고리의 오늘의 단어가 있습니다. 다시 생성으로 덮어쓰거나 날짜를 바꿔 주세요.");
        error.status = 409;
        throw error;
      }

      return {
        challenge: existingChallenge,
        created: false,
        reused: true,
      };
    }

    const generatedRaw = await generateChallengeViaBedrock({
      challengeDate: normalizedDate,
      category,
      difficulty: payload.difficulty,
      extraInstruction: payload.extraInstruction,
    });
    const generated = normalizeGeneratedChallenge(generatedRaw, category);

    if (!generated) {
      const error = new Error("AI가 오늘의 단어를 정상 형식으로 생성하지 못했습니다.");
      error.status = 502;
      throw error;
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
          generated.publicTitle,
          generated.hiddenAnswerText,
          category.id,
          generated.fixedHintText || null,
          generated.status,
        ],
      );

      challengeId = Number(insertResult.insertId);
    } else {
      const nextChallengeShape = {
        ...generated,
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
          generated.publicTitle,
          generated.hiddenAnswerText,
          category.id,
          generated.fixedHintText || null,
          generated.status,
          challengeId,
        ],
      );
    }

    await replaceSynonyms(connection, challengeId, generated.synonyms);

    const updatedRow = await fetchDailyWordRow(connection, normalizedDate);
    return {
      challenge: await hydrateChallenge(connection, updatedRow),
      created: !existingChallenge,
      reused: false,
    };
  });
}

async function handleDailyWordGenerate(rawPayload) {
  const challengeDate = normalizeChallengeDate(rawPayload.challengeDate);

  try {
    const result = await upsertDailyWordChallenge({
      challengeDate,
      overwrite: Boolean(rawPayload.overwrite),
      categoryId: rawPayload.categoryId,
      categorySlug: rawPayload.categorySlug,
      difficulty: rawPayload.difficulty,
      extraInstruction: rawPayload.extraInstruction,
    });

    return createSuccessResponse(
      "daily_word_generate",
      {
        challengeDate,
        created: result.created,
        reused: result.reused,
        category: result.challenge?.category || null,
        challenge: result.challenge,
      },
      result.created ? 201 : 200,
    );
  } catch (error) {
    console.error("daily_word_generate lambda failure", {
      message: error?.message || error,
      challengeDate,
    });

    return createErrorResponse(
      "daily_word_generate",
      error?.code || "daily_word_generate_failed",
      error?.message || "오늘의 단어를 생성하지 못했습니다.",
      Number(error?.status || 500),
    );
  }
}

async function handler(event) {
  const rawPayload = unwrapPayload(event);
  const operation = String(rawPayload.operation || "").trim() || (isScheduledEvent(event) ? "daily_word_generate" : "");

  if (!operation) {
    return createErrorResponse("daily_word_generate", "missing_operation", "operation is required.", 400);
  }

  if (operation !== "daily_word_generate") {
    return createErrorResponse(operation, "unsupported_operation", "unsupported lambda operation.", 400);
  }

  return handleDailyWordGenerate(rawPayload);
}

exports.handler = async function (event) {
  const result = await handler(event);
  return isHttpEvent(event) ? buildHttpResponse(result) : result;
};

exports.__private = {
  buildGeneratePrompt,
  buildMaskCandidates,
  maskHiddenAnswerInMessage,
  normalizeChallengeDate,
  normalizeGeneratedChallenge,
  normalizeSynonyms,
  unwrapPayload,
};
