const assert = require("node:assert/strict");
const test = require("node:test");
const { isJpeg, normalizeHostedManifest } = require("../src/hosted/manifest");

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
