const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");

function createPool(config) {
  const options = {
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  };
  if (config.databaseSsl) options.ssl = { rejectUnauthorized: false };
  return new Pool(options);
}

async function migrate(pool) {
  const sql = await fs.readFile(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query(sql);
}

async function ready(pool) {
  const result = await pool.query("SELECT 1 AS ready");
  return result.rows[0]?.ready === 1;
}

module.exports = { createPool, migrate, ready };
