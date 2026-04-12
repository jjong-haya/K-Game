function parseCsv(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstNonEmpty(...values) {
  return values.find((value) => String(value || "").trim()) || "";
}

function lambdaConfig(functionName, url, region) {
  return {
    functionName: String(functionName || "").trim(),
    url: String(url || "").trim(),
    region,
  };
}

const defaultLambdaRegion = process.env.GAME_LAMBDA_REGION || process.env.AWS_REGION || "us-east-1";

const config = {
  port: Number(process.env.PORT || 4000),
  corsOrigin:
    process.env.CORS_ORIGIN ||
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
  timezone: process.env.APP_TIMEZONE || "Asia/Seoul",
  supabaseUrl: process.env.SUPABASE_URL || "",
  admin: {
    emails: parseCsv(process.env.ADMIN_EMAILS),
    userIds: parseCsv(process.env.ADMIN_USER_IDS).map((value) => Number(value)).filter(Number.isFinite),
  },
  gameLambda: {
    prompt: lambdaConfig(
      firstNonEmpty(process.env.GAME_LAMBDA_NOVA_FUNCTION_NAME, process.env.GAME_LAMBDA_FUNCTION_NAME),
      firstNonEmpty(process.env.GAME_LAMBDA_NOVA_URL, process.env.GAME_LAMBDA_URL),
      defaultLambdaRegion,
    ),
    wordHint: lambdaConfig(
      firstNonEmpty(process.env.WORD_HINT_FUNCTION_NAME, process.env.GAME_LAMBDA_HINT_FUNCTION_NAME),
      firstNonEmpty(process.env.WORD_HINT_URL, process.env.GAME_LAMBDA_HINT_URL),
      process.env.WORD_HINT_REGION || process.env.GAME_LAMBDA_HINT_REGION || defaultLambdaRegion,
    ),
    dailyWordGenerate: lambdaConfig(
      process.env.DAILY_WORD_GENERATE_FUNCTION_NAME,
      process.env.DAILY_WORD_GENERATE_URL,
      process.env.DAILY_WORD_GENERATE_REGION || defaultLambdaRegion,
    ),
    gemini: lambdaConfig(
      process.env.GAME_LAMBDA_GEMINI_FUNCTION_NAME,
      process.env.GAME_LAMBDA_GEMINI_URL,
      defaultLambdaRegion,
    ),
  },
  auth: {
    guestSessionHours: Number(process.env.GUEST_SESSION_HOURS || 12),
    appSessionDays: Number(process.env.APP_SESSION_DAYS || 30),
    cookieName: process.env.AUTH_COOKIE_NAME || "k_game_session",
    secureCookies: String(process.env.AUTH_COOKIE_SECURE || "false").toLowerCase() === "true",
    sameSite: process.env.AUTH_COOKIE_SAMESITE || "lax",
  },
  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "daily_prompt_game",
  },
};

module.exports = config;
