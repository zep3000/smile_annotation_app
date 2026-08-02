const path = require("node:path");

function cleanText(value, label, maxLength = 240) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) throw new Error(`${label} is too long.`);
  return text;
}

function normalizeBlockSize(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error("block_size must be a positive integer.");
  }
  return number;
}

function normalizeHostedManifest(input) {
  const source = input && typeof input === "object" ? input : {};
  if (!Array.isArray(source.images) || source.images.length === 0) {
    throw new Error("Manifest requires a non-empty images array.");
  }
  const taskId = cleanText(source.task_id || source.taskId, "task_id", 120);
  const seenIds = new Set();
  const seenFilenames = new Set();
  const images = source.images.map((item, index) => {
    const filename = cleanText(item?.filename || path.basename(String(item?.path || "")), `Image ${index + 1} filename`);
    if (filename !== path.basename(filename) || filename.includes("\\") || filename.includes("/")) {
      throw new Error(`Image ${index + 1} filename must not contain a directory path.`);
    }
    if (!/\.jpe?g$/i.test(filename)) {
      throw new Error(`Image ${index + 1} must be a JPEG (.jpg or .jpeg): ${filename}`);
    }
    const imageId = cleanText(
      item?.image_id || item?.id || filename.replace(/\.jpe?g$/i, ""),
      `Image ${index + 1} image_id`,
      160
    );
    const filenameKey = filename.toLowerCase();
    if (seenIds.has(imageId)) throw new Error(`Duplicate image_id: ${imageId}`);
    if (seenFilenames.has(filenameKey)) throw new Error(`Duplicate filename: ${filename}`);
    seenIds.add(imageId);
    seenFilenames.add(filenameKey);
    return {
      image_id: imageId,
      filename,
      page_type: String(item?.page_type || item?.pageType || "unknown"),
      metadata: item?.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
        ? item.metadata
        : {}
    };
  });
  const blockSize = normalizeBlockSize(source.block_size ?? source.blockSize);
  const manifest = {
    task_id: taskId,
    images,
    metadata: source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata)
      ? source.metadata
      : {}
  };
  if (blockSize) manifest.block_size = blockSize;
  return manifest;
}

function safeObjectFilename(filename) {
  return String(filename)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 220);
}

function isJpeg(buffer) {
  return Buffer.isBuffer(buffer) &&
    buffer.length >= 4 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[buffer.length - 2] === 0xff &&
    buffer[buffer.length - 1] === 0xd9;
}

module.exports = { isJpeg, normalizeHostedManifest, safeObjectFilename };
