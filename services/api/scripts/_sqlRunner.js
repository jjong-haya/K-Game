const fs = require("fs/promises");
const path = require("path");

const mysql = require("mysql2/promise");

const config = require("../src/config");

async function createConnection() {
  return mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    charset: "utf8mb4",
    multipleStatements: true,
  });
}

async function executeSqlFile(connection, filePath) {
  const absolutePath = path.resolve(filePath);
  const sql = await fs.readFile(absolutePath, "utf8");
  await connection.query(sql);
  return absolutePath;
}

module.exports = {
  createConnection,
  executeSqlFile,
};
