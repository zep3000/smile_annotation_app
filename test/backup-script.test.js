const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { EXPORT_PREFIX, pruneExpiredExports } = require("../scripts/backup-exports");

test("scheduled backup executable parses", () => {
  const filename = path.join(__dirname, "..", "scripts", "backup-exports.js");
  const source = fs.readFileSync(filename, "utf8");
  assert.doesNotThrow(() => new vm.Script(source, { filename }));
});

test("browser annotation executable parses", () => {
  const filename = path.join(__dirname, "..", "public", "app.js");
  const source = fs.readFileSync(filename, "utf8");
  assert.doesNotThrow(() => new vm.Script(source, { filename }));
});

test("scheduled backups delete only export objects older than retention", async () => {
  const deleted = [];
  const storage = {
    async listObjects(prefix) {
      assert.equal(prefix, EXPORT_PREFIX);
      return [
        { Key: `${EXPORT_PREFIX}old/set.json`, LastModified: new Date("2026-07-13T11:59:59Z") },
        { Key: `${EXPORT_PREFIX}boundary/set.jsonl`, LastModified: new Date("2026-07-14T12:00:00Z") },
        { Key: `${EXPORT_PREFIX}recent/set.json`, LastModified: new Date("2026-07-20T12:00:00Z") },
        { Key: "images/untouched.jpg", LastModified: new Date("2020-01-01T00:00:00Z") }
      ];
    },
    async deleteObjects(keys) {
      deleted.push(...keys);
    }
  };

  const count = await pruneExpiredExports(storage, {
    now: new Date("2026-07-21T12:00:00Z"),
    retentionDays: 7
  });

  assert.equal(count, 1);
  assert.deepEqual(deleted, [`${EXPORT_PREFIX}old/set.json`]);
});
