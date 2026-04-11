require("dotenv").config();
const fs = require("fs/promises");
const path = require("path");

const { createConnection, executeSqlFile } = require("./_sqlRunner");

async function ensureMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations(connection) {
  const [rows] = await connection.query("SELECT filename FROM schema_migrations");
  return new Set(rows.map((row) => row.filename));
}

async function applyMigration(connection, migrationsDir, filename) {
  const migrationPath = path.join(migrationsDir, filename);
  await executeSqlFile(connection, migrationPath);
  await connection.query("INSERT INTO schema_migrations (filename) VALUES (?)", [filename]);
}

async function run() {
  const connection = await createConnection();
  const sqlDir = path.resolve(__dirname, "..", "sql");
  const schemaPath = path.join(sqlDir, "schema.sql");
  const migrationsDir = path.join(sqlDir, "migrations");

  try {
    await executeSqlFile(connection, schemaPath);
    await ensureMigrationsTable(connection);

    let filenames = [];
    try {
      filenames = (await fs.readdir(migrationsDir)).filter((filename) => filename.endsWith(".sql")).sort();
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    const applied = await getAppliedMigrations(connection);
    for (const filename of filenames) {
      if (applied.has(filename)) {
        continue;
      }

      await applyMigration(connection, migrationsDir, filename);
      console.log(`applied migration: ${filename}`);
    }
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error("migration failed", error);
  process.exit(1);
});
