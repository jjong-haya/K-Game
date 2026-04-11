function buildMigrationError() {
  return new Error(
    "Runtime schema mutation is disabled. Use `npm run migrate` and `npm run seed:sample` instead.",
  );
}

async function ensureSchema() {
  throw buildMigrationError();
}

async function ensureSeedData() {
  throw buildMigrationError();
}

module.exports = {
  ensureSchema,
  ensureSeedData,
};
