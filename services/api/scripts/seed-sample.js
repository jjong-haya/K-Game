const path = require("path");

const { createConnection, executeSqlFile } = require("./_sqlRunner");

async function run() {
  const connection = await createConnection();
  const seedPath = path.resolve(__dirname, "..", "sql", "sample_seed.sql");

  try {
    await executeSqlFile(connection, seedPath);
    console.log(`seeded sample data from ${seedPath}`);
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error("sample seed failed", error);
  process.exit(1);
});
