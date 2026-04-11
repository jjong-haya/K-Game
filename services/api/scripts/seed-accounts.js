require("dotenv").config();

const bcrypt = require("bcryptjs");

const { createConnection } = require("./_sqlRunner");

function buildSeedAccounts() {
  const accounts = [];

  const testUsername = (process.env.SEED_TEST_USERNAME || "").trim();
  const testPassword = (process.env.SEED_TEST_PASSWORD || "").trim();
  const testNickname = (process.env.SEED_TEST_NICKNAME || "테스트 사용자").trim();
  if (testUsername || testPassword) {
    if (!testUsername || !testPassword) {
      throw new Error("SEED_TEST_USERNAME과 SEED_TEST_PASSWORD는 함께 설정해야 합니다.");
    }

    accounts.push({
      username: testUsername,
      password: testPassword,
      nickname: testNickname,
      isAdmin: false,
    });
  }

  const adminUsername = (process.env.SEED_ADMIN_USERNAME || "").trim();
  const adminPassword = (process.env.SEED_ADMIN_PASSWORD || "").trim();
  const adminNickname = (process.env.SEED_ADMIN_NICKNAME || "관리자").trim();
  if (adminUsername || adminPassword) {
    if (!adminUsername || !adminPassword) {
      throw new Error("SEED_ADMIN_USERNAME과 SEED_ADMIN_PASSWORD는 함께 설정해야 합니다.");
    }

    accounts.push({
      username: adminUsername,
      password: adminPassword,
      nickname: adminNickname,
      isAdmin: true,
    });
  }

  return accounts;
}

async function seedAccounts() {
  if (process.env.ENABLE_ACCOUNT_SEED !== "1") {
    throw new Error("계정 시드를 실행하려면 ENABLE_ACCOUNT_SEED=1 이 필요합니다.");
  }

  const accounts = buildSeedAccounts();
  if (!accounts.length) {
    throw new Error("시드할 계정을 찾지 못했습니다. SEED_* 환경 변수를 설정해 주세요.");
  }

  const connection = await createConnection();

  try {
    const adminUserIds = [];

    for (const account of accounts) {
      const passwordHash = await bcrypt.hash(account.password, 10);
      await connection.query(
        `
          INSERT INTO users (
            auth_type,
            username,
            password_hash,
            nickname,
            is_temporary,
            is_active,
            created_at,
            updated_at,
            last_login_at
          )
          VALUES ('id', ?, ?, ?, 0, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())
          ON DUPLICATE KEY UPDATE
            password_hash = VALUES(password_hash),
            nickname = VALUES(nickname),
            updated_at = UTC_TIMESTAMP()
        `,
        [account.username, passwordHash, account.nickname],
      );

      const [rows] = await connection.query("SELECT id FROM users WHERE username = ? LIMIT 1", [
        account.username,
      ]);
      const userId = rows[0]?.id || null;

      console.log(`Seeded account: ${account.username} (${account.isAdmin ? "admin" : "user"})`);
      if (account.isAdmin && userId) {
        adminUserIds.push(userId);
      }
    }

    if (adminUserIds.length) {
      console.log(`\nADMIN_USER_IDS example: ${adminUserIds.join(",")}`);
    }
  } finally {
    await connection.end();
  }
}

seedAccounts()
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("seed-accounts failed:", error);
    process.exit(1);
  });
