const crypto = require("node:crypto");
const { loadBackupConfig } = require("../src/hosted/config");
const { createPool } = require("../src/hosted/database");
const { HostedRepository } = require("../src/hosted/repository");
const { createStorage } = require("../src/hosted/storage");
const { formatSetExport } = require("../src/shared/export-format");

async function main() {
  const config = loadBackupConfig();
  const pool = createPool(config);
  const repository = new HostedRepository(pool);
  const storage = createStorage(config);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  try {
    const sets = await repository.listSets();
    for (const set of sets) {
      const exported = await repository.exportSet(set.id);
      const formatted = formatSetExport(exported);
      const baseKey = `backups/annotation-exports/${stamp}/${set.id}`;
      const jsonlKey = `${baseKey}.jsonl`;
      const jsonKey = `${baseKey}.json`;
      const jsonlSha256 = crypto.createHash("sha256").update(formatted.jsonl).digest("hex");
      const jsonSha256 = crypto.createHash("sha256").update(formatted.json).digest("hex");
      await storage.putObject(jsonlKey, Buffer.from(formatted.jsonl), "application/x-ndjson", {
        "annotation-set-id": set.id,
        "record-count": String(formatted.records.length),
        sha256: jsonlSha256
      });
      await storage.putObject(jsonKey, Buffer.from(formatted.json), "application/json", {
        "annotation-set-id": set.id,
        "record-count": String(formatted.records.length),
        sha256: jsonSha256
      });
      await repository.audit({
        role: "system",
        setId: set.id,
        eventType: "scheduled_export_created",
        details: {
          object_keys: { json: jsonKey, jsonl: jsonlKey },
          record_count: formatted.records.length,
          sha256: { json: jsonSha256, jsonl: jsonlSha256 }
        }
      });
      console.log(`${set.task_id}: ${formatted.records.length} annotations -> ${jsonKey}, ${jsonlKey}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
const crypto = require("node:crypto");
