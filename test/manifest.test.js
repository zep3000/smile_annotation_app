const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { isJpeg, normalizeHostedManifest } = require("../src/hosted/manifest");
const { validateManifest } = require("../scripts/validate-manifest");

test("hosted manifests retain identifiers but discard absolute paths", () => {
  const manifest = normalizeHostedManifest({
    task_id: "sample",
    block_size: 50,
    images: [{
      image_id: "page-1",
      filename: "page-1.jpg",
      path: "C:/private/page-1.jpg",
      page_type: "single",
      metadata: { year: 1964 }
    }]
  });
  assert.deepEqual(manifest, {
    task_id: "sample",
    block_size: 50,
    images: [{ image_id: "page-1", filename: "page-1.jpg", page_type: "single", metadata: { year: 1964 } }],
    metadata: {}
  });
  assert.equal("path" in manifest.images[0], false);
});

test("hosted manifests reject non-JPEGs and duplicate filenames", () => {
  assert.throws(() => normalizeHostedManifest({ task_id: "x", images: [{ filename: "page.png" }] }), /JPEG/);
  assert.throws(() => normalizeHostedManifest({
    task_id: "x",
    images: [{ image_id: "a", filename: "page.jpg" }, { image_id: "b", filename: "PAGE.JPG" }]
  }), /Duplicate filename/);
  assert.throws(() => normalizeHostedManifest({
    task_id: "x",
    block_size: 0,
    images: [{ filename: "page.jpg" }]
  }), /block_size/);
});

test("JPEG validation checks start and end markers", () => {
  assert.equal(isJpeg(Buffer.from([0xff, 0xd8, 0x00, 0xff, 0xd9])), true);
  assert.equal(isJpeg(Buffer.from([0xff, 0xd8, 0x00, 0x00])), false);
});

test("manifest validator accepts standard manifests and reports compatibility warnings", async () => {
  const valid = await validateManifest({
    task_id: "sample",
    block_size: 50,
    images: [{ image_id: "page-1", filename: "page-1.jpg", page_type: "single", metadata: {} }],
    metadata: {}
  }, { mode: "hosted" });
  assert.deepEqual(valid.errors, []);
  assert.deepEqual(valid.warnings, []);

  const alias = await validateManifest({
    taskId: "sample",
    blockSize: 50,
    images: [{ id: "page-1", filename: "page-1.jpg", pageType: "single" }]
  }, { mode: "generic" });
  assert.deepEqual(alias.errors, []);
  assert.ok(alias.warnings.some((warning) => warning.includes("task_id")));
  assert.ok(alias.warnings.some((warning) => warning.includes("block_size")));
  assert.ok(alias.warnings.some((warning) => warning.includes("image_id")));
});

test("manifest validator checks local paths and duplicates", async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "manifest-validator-"));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const imagePath = path.join(temp, "page-1.jpg");
  await fs.writeFile(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  const local = await validateManifest({
    task_id: "sample",
    images: [{ image_id: "page-1", filename: "page-1.jpg", path: imagePath }]
  }, { mode: "local" });
  assert.deepEqual(local.errors, []);

  const invalid = await validateManifest({
    task_id: "sample",
    images: [
      { image_id: "page-1", filename: "page-1.jpg", path: imagePath },
      { image_id: "page-1", filename: "PAGE-1.JPG", path: imagePath }
    ]
  }, { mode: "local" });
  assert.ok(invalid.errors.some((error) => error.includes("Duplicate image_id")));
  assert.ok(invalid.errors.some((error) => error.includes("Duplicate filename")));
});
