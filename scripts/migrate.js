const { loadConfig } = require("../src/hosted/config");
const { createPool, migrate } = require("../src/hosted/database");

async function main() {
  if (String(process.env.APP_MODE || "local").toLowerCase() !== "hosted") {
    console.log("APP_MODE is not hosted; database migration skipped.");
    return;
  }
  const config = loadConfig();
  const pool = createPool(config);
  try {
    await migrate(pool);
    console.log("Database schema is current.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
