const test = require("node:test");
const assert = require("node:assert/strict");
const { formatSetExport } = require("../src/shared/export-format");

test("formats matching JSON and JSONL annotation exports", () => {
  const exported = {
    set: { id: "set-1", task_id: "pilot", name: "Pilot" },
    records: [
      {
        assignment_code: "12345678",
        assignment_status: "done",
        image_id: "page-1",
        filename: "page-1.jpg",
        sort_order: 0,
        status: "complete",
        revision: 2,
        created_at: "2026-07-19T10:00:00.000Z",
        updated_at: "2026-07-19T10:10:00.000Z",
        completed_at: "2026-07-19T10:10:00.000Z",
        payload: { status: "complete", people: [] }
      },
      { image_id: "page-2", payload: null }
    ]
  };

  const formatted = formatSetExport(exported, "2026-07-19T12:00:00.000Z");
  const json = JSON.parse(formatted.json);
  const jsonl = formatted.jsonl.trim().split("\n").map((line) => JSON.parse(line));

  assert.equal(formatted.records.length, 1);
  assert.equal(json.generated_at, "2026-07-19T12:00:00.000Z");
  assert.equal(json.annotations.length, 1);
  assert.equal(jsonl.length, 1);
  assert.equal(jsonl[0].annotation_set_id, "set-1");
  assert.equal(jsonl[0].server_created_at, "2026-07-19T10:00:00.000Z");
  assert.deepEqual(jsonl[0].annotation, json.annotations[0].payload);
});
