const fs = require("node:fs/promises");
const path = require("node:path");

function usage() {
  return [
    "Usage: npm run validate:manifest -- [--generic|--hosted|--local] <manifest.json>",
    "",
    "Modes:",
    "  --generic  Validate preferred manifest structure without checking files. Default.",
    "  --hosted   Also enforce hosted upload rules.",
    "  --local    Also require absolute existing image paths.",
  ].join("\n");
}

function optionValue(source, preferred, alias, warnings, label) {
  if (Object.hasOwn(source, preferred)) return source[preferred];
  if (Object.hasOwn(source, alias)) {
    warnings.push(`${label}: use ${preferred} instead of legacy alias ${alias}.`);
    return source[alias];
  }
  return undefined;
}

function textValue(value, label, errors, { required = true, maxLength = 240 } = {}) {
  const text = String(value ?? "").trim();
  if (!text) {
    if (required) errors.push(`${label} is required.`);
    return "";
  }
  if (text.length > maxLength) errors.push(`${label} is too long; max ${maxLength} characters.`);
  return text;
}

function validateBlockSize(value, errors) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    errors.push("block_size must be a positive integer.");
    return null;
  }
  return number;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function validateManifest(manifest, { mode = "generic" } = {}) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(manifest)) {
    return { errors: ["Manifest must be a JSON object."], warnings };
  }

  textValue(optionValue(manifest, "task_id", "taskId", warnings, "manifest"), "task_id", errors, { maxLength: 120 });
  validateBlockSize(optionValue(manifest, "block_size", "blockSize", warnings, "manifest"), errors);
  if (manifest.metadata !== undefined && !isPlainObject(manifest.metadata)) {
    errors.push("metadata must be an object when present.");
  }
  if (!Array.isArray(manifest.images) || manifest.images.length === 0) {
    errors.push("images must be a non-empty array.");
    return { errors, warnings };
  }

  const seenImageIds = new Set();
  const seenFilenames = new Set();
  for (let index = 0; index < manifest.images.length; index += 1) {
    const item = manifest.images[index];
    const label = `images[${index}]`;
    if (!isPlainObject(item)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    const rawPath = optionValue(item, "path", "absolute_path", warnings, label);
    const filename = textValue(item.filename || (rawPath ? path.basename(String(rawPath)) : ""), `${label}.filename`, errors);
    if (filename) {
      if (filename !== path.basename(filename) || filename.includes("/") || filename.includes("\\")) {
        errors.push(`${label}.filename must not contain a directory path.`);
      }
      if (!/\.jpe?g$/i.test(filename)) {
        errors.push(`${label}.filename must end in .jpg or .jpeg.`);
      }
      const filenameKey = filename.toLowerCase();
      if (seenFilenames.has(filenameKey)) errors.push(`Duplicate filename: ${filename}.`);
      seenFilenames.add(filenameKey);
    }

    const imageId = textValue(
      optionValue(item, "image_id", "id", warnings, label) || filename.replace(/\.jpe?g$/i, ""),
      `${label}.image_id`,
      errors,
      { maxLength: 160 }
    );
    if (imageId) {
      if (seenImageIds.has(imageId)) errors.push(`Duplicate image_id: ${imageId}.`);
      seenImageIds.add(imageId);
    }

    const pageType = optionValue(item, "page_type", "pageType", warnings, label);
    if (pageType !== undefined && !["single", "double", "unknown"].includes(String(pageType))) {
      warnings.push(`${label}.page_type should normally be single, double, or unknown.`);
    }
    if (item.metadata !== undefined && !isPlainObject(item.metadata)) {
      errors.push(`${label}.metadata must be an object when present.`);
    }

    if (mode === "local") {
      const imagePath = textValue(rawPath, `${label}.path`, errors);
      if (imagePath) {
        if (!path.isAbsolute(imagePath)) {
          errors.push(`${label}.path must be absolute for local mode: ${imagePath}`);
        } else {
          try {
            await fs.access(imagePath);
          } catch {
            errors.push(`${label}.path does not exist: ${imagePath}`);
          }
        }
      }
    }
    if (mode === "hosted" && rawPath && path.isAbsolute(String(rawPath))) {
      warnings.push(`${label}.path is ignored in hosted mode; upload matches by filename/image_id.`);
    }
  }
  return { errors, warnings };
}

async function main() {
  const args = process.argv.slice(2);
  let mode = "generic";
  const files = [];
  for (const arg of args) {
    if (arg === "--generic" || arg === "--hosted" || arg === "--local") {
      mode = arg.slice(2);
    } else if (arg === "-h" || arg === "--help") {
      console.log(usage());
      return;
    } else {
      files.push(arg);
    }
  }
  if (files.length !== 1) throw new Error(usage());
  const manifestPath = path.resolve(files[0]);
  const raw = await fs.readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const result = await validateManifest(manifest, { mode });
  for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
  if (result.errors.length) {
    for (const error of result.errors) console.error(`Error: ${error}`);
    throw new Error(`Manifest validation failed with ${result.errors.length} error(s).`);
  }
  console.log(`Manifest OK (${mode}): ${manifestPath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { validateManifest };
