const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

test("scheduled backup executable parses", () => {
  const filename = path.join(__dirname, "..", "scripts", "backup-exports.js");
  const source = fs.readFileSync(filename, "utf8");
  assert.doesNotThrow(() => new vm.Script(source, { filename }));
});
