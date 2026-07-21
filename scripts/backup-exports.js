const crypto = require("node:crypto");
const { loadBackupConfig } = require("../src/hosted/config");
const { createPool } = require("../src/hosted/database");
const { HostedRepository } = require("../src/hosted/repository");
const { createStorage } = require("../src/hosted/storage");
const { formatSetExport } = require("../src/shared/export-format");

const EXPORT_PREFIX = "backups/annotation-exports/";
const DAY_MS = 24 * 60 * 60 * 1000;

async function pruneExpiredExports(storage, { now = new Date(), retentionDays = 7 } = {}) {
  const cutoff = now.getTime() - (retentionDays * DAY_MS);
  const objects = await storage.listObjects(EXPORT_PREFIX);
  const expiredKeys = objects
    .filter((object) => object.Key?.startsWith(EXPORT_PREFIX)
      && object.LastModified
      && new Date(object.LastModified).getTime() < cutoff)
    .map((object) => object.Key);
  await storage.deleteObjects(expiredKeys);
  return expiredKeys.length;
}

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
      const baseKey = `${EXPORT_PREFIX}${stamp}/${set.id}`;
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
    const deletedCount = await pruneExpiredExports(storage, {
      retentionDays: config.backupRetentionDays
    });
    console.log(`Retention cleanup: deleted ${deletedCount} export object(s) older than ${config.backupRetentionDays} days.`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { EXPORT_PREFIX, main, pruneExpiredExports };
