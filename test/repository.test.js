const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const { DataType, newDb } = require("pg-mem");
const { HostedRepository } = require("../src/hosted/repository");

async function testRepository() {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  memory.public.registerOperator({
    operator: "~",
    left: DataType.text,
    right: DataType.text,
    returns: DataType.bool,
    implementation: (value, pattern) => new RegExp(pattern).test(value)
  });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();
  const schema = await fs.readFile(path.resolve(__dirname, "..", "src", "hosted", "schema.sql"), "utf-8");
  await pool.query(schema);
  return { pool, repository: new HostedRepository(pool) };
}

test("repository supports a complete hosted assignment lifecycle", async (t) => {
  const { pool, repository } = await testRepository();
  t.after(() => pool.end());
  const set = await repository.createSet({
    name: "Test set",
    flowVersion: "1.12",
    manifest: {
      task_id: "test-task",
      metadata: { sample: true },
      images: [
        { image_id: "page-1", filename: "page-1.jpg", page_type: "single" },
        { image_id: "page-2", filename: "page-2.jpeg", page_type: "double" }
      ]
    }
  });
  assert.equal(set.image_count, 2);
  assert.equal(set.uploaded_count, 0);

  const images = await repository.setImages(set.id);
  for (const image of images) {
    await repository.markImageUploaded(image.id, { byteSize: 5, sha256: "a".repeat(64) });
  }
  const active = await repository.setStatus(set.id, "active");
  assert.equal(active.status, "active");

  const [issued] = await repository.issueAssignments(set.id, 1, false);
  assert.match(issued.code, /^\d{8}$/);
  const opened = await repository.openAssignment(issued.code);
  assert.equal(opened.status, "started");
  await repository.createAuthSession({
    tokenHash: "b".repeat(64),
    role: "annotator",
    expiresAt: new Date(Date.now() + 60_000),
    ipAddress: "127.0.0.1",
    userAgent: "test"
  });
  await repository.attachAssignment("b".repeat(64), issued.id);
  const authSession = await repository.authSession("b".repeat(64));
  assert.equal(authSession.assignment_code, issued.code);
  assert.equal(authSession.set_status, "active");

  const assignment = await repository.assignmentManifest(issued.id);
  assert.equal(assignment.manifest.images.length, 2);
  assert.equal(assignment.manifest.images[0].path, null);
  assert.deepEqual(assignment.manifest.metadata, { sample: true });

  const firstSave = await repository.saveAnnotation({
    assignmentId: issued.id,
    externalImageId: "page-1",
    expectedRevision: 0,
    payload: { status: "complete", page: { qualifying_ad_count: 1 } }
  });
  assert.equal(firstSave.revision, 1);
  assert.equal(firstSave.allDone, false);

  await assert.rejects(
    repository.saveAnnotation({
      assignmentId: issued.id,
      externalImageId: "page-1",
      expectedRevision: 0,
      payload: { status: "draft" }
    }),
    (error) => error.statusCode === 409 && error.code === "revision_conflict"
  );

  const finalSave = await repository.saveAnnotation({
    assignmentId: issued.id,
    externalImageId: "page-2",
    expectedRevision: 0,
    payload: { status: "ineligible", page: { qualifying_ad_count: 0 } }
  });
  assert.equal(finalSave.allDone, true);

  const progress = await repository.assignmentProgress(issued.id);
  assert.equal(progress["page-1"].status, "complete");
  assert.equal(progress["page-2"].status, "ineligible");
  const summaryRecords = await repository.assignmentSummaryRecords(issued.id);
  assert.equal(summaryRecords.length, 2);
  assert.equal(summaryRecords[0].payload.status, "complete");
  assert.equal(summaryRecords[1].payload.status, "ineligible");
  const exported = await repository.exportSet(set.id);
  assert.equal(exported.records.filter((record) => record.payload).length, 2);
  const assignments = await repository.setAssignments(set.id);
  assert.equal(assignments[0].status, "done");

  await repository.setStatus(set.id, "inactive");
  assert.equal(await repository.assignmentManifest(issued.id), null);
  await assert.rejects(
    repository.saveAnnotation({
      assignmentId: issued.id,
      externalImageId: "page-1",
      expectedRevision: 1,
      payload: { status: "complete" }
    }),
    (error) => error.statusCode === 403 && /not currently active/.test(error.message)
  );
});
