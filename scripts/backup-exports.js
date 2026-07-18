const { loadBackupConfig } = require("../src/hosted/config");
const { createPool } = require("../src/hosted/database");
const { HostedRepository } = require("../src/hosted/repository");
const { createStorage } = require("../src/hosted/storage");

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
      const records = exported.records.filter((record) => record.payload);
      const body = `${records.map((record) => JSON.stringify({
        export_schema_version: "hosted_annotation_export_v1",
        generated_at: new Date().toISOString(),
        annotation_set_id: set.id,
        task_id: set.task_id,
        assignment_code: record.assignment_code,
        assignment_status: record.assignment_status,
        image_id: record.image_id,
        filename: record.filename,
        image_index: record.sort_order,
        annotation_status: record.status,
        revision: record.revision,
        server_updated_at: record.updated_at,
        annotation: record.payload
      })).join("\n")}${records.length ? "\n" : ""}`;
      const key = `backups/annotation-exports/${stamp}/${set.id}.jsonl`;
      const sha256 = crypto.createHash("sha256").update(body).digest("hex");
      await storage.putObject(key, Buffer.from(body), "application/x-ndjson", {
        "annotation-set-id": set.id,
        "record-count": String(records.length),
        sha256
      });
      await repository.audit({
        role: "system",
        setId: set.id,
        eventType: "scheduled_export_created",
        details: { object_key: key, record_count: records.length, sha256 }
      });
      console.log(`${set.task_id}: ${records.length} annotations -> ${key}`);
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
