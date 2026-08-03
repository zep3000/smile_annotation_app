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
      block_size: 50,
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
  assert.equal(assignment.manifest.block_size, 50);
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
    payload: {
      status: "ineligible",
      page: {
        qualifying_ad_count: 0,
        no_qualifying_ad_reason: "ads_present_no_visible_faces"
      }
    }
  });
  assert.equal(finalSave.allDone, true);

  const progress = await repository.assignmentProgress(issued.id);
  assert.equal(progress["page-1"].status, "complete");
  assert.equal(progress["page-2"].status, "ineligible");
  const summaryRecords = await repository.assignmentSummaryRecords(issued.id);
  assert.equal(summaryRecords.length, 2);
  assert.equal(summaryRecords[0].payload.status, "complete");
  assert.equal(summaryRecords[1].payload.status, "ineligible");
  const secondPageSummaryRecords = await repository.assignmentSummaryRecords(issued.id, { start: 1, end: 1 });
  assert.equal(secondPageSummaryRecords.length, 1);
  assert.equal(secondPageSummaryRecords[0].image_id, "page-2");
  const exported = await repository.exportSet(set.id);
  assert.equal(exported.records.filter((record) => record.payload).length, 2);
  const assignmentExport = await repository.exportAssignment(issued.id);
  assert.equal(assignmentExport.set.id, set.id);
  assert.equal(assignmentExport.assignment.assignment_code, issued.code);
  assert.equal(assignmentExport.records.length, 2);
  assert.equal(assignmentExport.records.filter((record) => record.payload).length, 2);
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

test("repository deletes only sets with zero assignments", async (t) => {
  const { pool, repository } = await testRepository();
  t.after(() => pool.end());
  const deletable = await repository.createSet({
    name: "Draft without assignments",
    flowVersion: "1.15",
    manifest: {
      task_id: "delete-ok",
      images: [{ image_id: "page-1", filename: "page-1.jpg", page_type: "single" }]
    }
  });
  const deleted = await repository.deleteSetIfUnassigned(deletable.id);
  assert.equal(deleted.id, deletable.id);
  assert.equal(await repository.getSet(deletable.id), null);

  const blocked = await repository.createSet({
    name: "Draft with assignment",
    flowVersion: "1.15",
    manifest: {
      task_id: "delete-blocked",
      images: [{ image_id: "page-1", filename: "page-1.jpg", page_type: "single" }]
    }
  });
  await repository.issueAssignments(blocked.id, 1, false);
  await assert.rejects(
    repository.deleteSetIfUnassigned(blocked.id),
    (error) => error.statusCode === 409 && error.code === "set_has_assignments"
  );
  assert.equal((await repository.getSet(blocked.id)).id, blocked.id);
});

test("legacy zero-count pages without a reason remain started", async (t) => {
  const { pool, repository } = await testRepository();
  t.after(() => pool.end());
  const set = await repository.createSet({
    name: "Legacy set",
    flowVersion: "1.13",
    manifest: {
      task_id: "legacy-task",
      images: [{ image_id: "page-1", filename: "page-1.jpg", page_type: "single" }]
    }
  });
  const [image] = await repository.setImages(set.id);
  await repository.markImageUploaded(image.id, { byteSize: 5, sha256: "c".repeat(64) });
  await repository.setStatus(set.id, "active");
  const [issued] = await repository.issueAssignments(set.id, 1, false);
  const save = await repository.saveAnnotation({
    assignmentId: issued.id,
    externalImageId: "page-1",
    expectedRevision: 0,
    payload: { status: "ineligible", page: { qualifying_ad_count: "0" } }
  });
  assert.equal(save.allDone, false);
  const progress = await repository.assignmentProgress(issued.id);
  assert.equal(progress["page-1"].status, "draft");
});

test("repository reuses uploaded page images across annotation sets", async (t) => {
  const { pool, repository } = await testRepository();
  t.after(() => pool.end());

  const sourceSet = await repository.createSet({
    name: "Uploaded image source",
    flowVersion: "1.15",
    manifest: {
      task_id: "source-upload",
      images: [{ image_id: "source-page", filename: "shared-page.jpg", page_type: "single" }]
    }
  });
  let [sourceImage] = await repository.setImages(sourceSet.id);
  assert.equal(sourceImage.uploaded, false);
  await repository.markImageUploaded(sourceImage.id, { byteSize: 123, sha256: "e".repeat(64) });
  [sourceImage] = await repository.setImages(sourceSet.id);

  const targetSet = await repository.createSet({
    name: "Uploaded image target",
    flowVersion: "1.15",
    manifest: {
      task_id: "target-upload",
      images: [{ image_id: "target-page", filename: "shared-page.jpg", page_type: "single" }]
    }
  });
  const [targetImage] = await repository.setImages(targetSet.id);
  assert.equal(targetImage.uploaded, true);
  assert.equal(targetImage.object_key, sourceImage.object_key);
  assert.equal(targetImage.byte_size, 123);
  assert.equal(targetImage.sha256, "e".repeat(64));
});

test("repository marks pending matching images uploaded when one copy is uploaded", async (t) => {
  const { pool, repository } = await testRepository();
  t.after(() => pool.end());

  const firstSet = await repository.createSet({
    name: "Pending first",
    flowVersion: "1.15",
    manifest: {
      task_id: "pending-first",
      images: [{ image_id: "same-page", filename: "same-page.jpg", page_type: "single" }]
    }
  });
  const secondSet = await repository.createSet({
    name: "Pending second",
    flowVersion: "1.15",
    manifest: {
      task_id: "pending-second",
      images: [{ image_id: "different-id", filename: "Same-Page.JPG", page_type: "single" }]
    }
  });
  const [firstImage] = await repository.setImages(firstSet.id);
  let [secondImage] = await repository.setImages(secondSet.id);
  assert.equal(secondImage.uploaded, false);

  await repository.markImageUploaded(firstImage.id, { byteSize: 456, sha256: "f".repeat(64) });
  [secondImage] = await repository.setImages(secondSet.id);
  assert.equal(secondImage.uploaded, true);
  assert.equal(secondImage.object_key, firstImage.object_key);
  assert.equal(secondImage.byte_size, 456);
  assert.equal(secondImage.sha256, "f".repeat(64));
});

test("repository copies missing annotations between assignments without overwrite", async (t) => {
  const { pool, repository } = await testRepository();
  t.after(() => pool.end());
  const sourceSet = await repository.createSet({
    name: "Source set",
    flowVersion: "1.14",
    manifest: {
      task_id: "source-task",
      images: [
        { image_id: "source-page-1", filename: "page-1.jpg", page_type: "single" },
        { image_id: "source-page-2", filename: "page-2.jpg", page_type: "single" }
      ]
    }
  });
  const targetSet = await repository.createSet({
    name: "Target set",
    flowVersion: "1.14",
    manifest: {
      task_id: "target-task",
      images: [
        { image_id: "target-page-1", filename: "page-1.jpg", page_type: "single" },
        { image_id: "target-page-2", filename: "page-2.jpg", page_type: "single" }
      ]
    }
  });
  for (const set of [sourceSet, targetSet]) {
    const images = await repository.setImages(set.id);
    for (const image of images) {
      await repository.markImageUploaded(image.id, { byteSize: 5, sha256: "d".repeat(64) });
    }
    await repository.setStatus(set.id, "active");
  }
  const [sourceAssignment] = await repository.issueAssignments(sourceSet.id, 1, false);
  const [targetAssignment] = await repository.issueAssignments(targetSet.id, 1, false);

  await repository.saveAnnotation({
    assignmentId: sourceAssignment.id,
    externalImageId: "source-page-1",
    expectedRevision: 0,
    payload: {
      schema_version: "ad_face_annotation_v2",
      status: "complete",
      page: { qualifying_ad_count: "1" },
      advertisements: []
    }
  });
  await repository.saveAnnotation({
    assignmentId: sourceAssignment.id,
    externalImageId: "source-page-2",
    expectedRevision: 0,
    payload: {
      schema_version: "ad_face_annotation_v2",
      status: "complete",
      page: { qualifying_ad_count: "1" },
      advertisements: []
    }
  });
  await repository.saveAnnotation({
    assignmentId: targetAssignment.id,
    externalImageId: "target-page-2",
    expectedRevision: 0,
    payload: {
      schema_version: "ad_face_annotation_v2",
      status: "draft",
      page: { qualifying_ad_count: "2" },
      advertisements: []
    }
  });

  const result = await repository.copyAnnotations({
    sourceAssignmentId: sourceAssignment.id,
    targetAssignmentId: targetAssignment.id,
    targetSetId: targetSet.id
  });
  assert.equal(result.copied, 1);
  assert.equal(result.skipped_existing, 1);
  assert.equal(result.skipped_no_match, 0);

  const first = await repository.annotation(targetAssignment.id, "target-page-1");
  const second = await repository.annotation(targetAssignment.id, "target-page-2");
  assert.equal(first.payload.status, "complete");
  assert.equal(first.payload.task.task_id, "target-task");
  assert.equal(first.payload.image.image_id, "target-page-1");
  assert.equal(first.payload.session.session_code, targetAssignment.code);
  assert.equal(second.payload.page.qualifying_ad_count, "2");

  const [sameSetTarget] = await repository.issueAssignments(sourceSet.id, 1, false);
  await assert.rejects(
    repository.copyAnnotations({
      sourceAssignmentId: sourceAssignment.id,
      targetAssignmentId: sameSetTarget.id,
      targetSetId: sourceSet.id
    }),
    (error) =>
      error.statusCode === 400 &&
      /different/.test(error.message)
  );
});
