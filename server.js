const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const url = require("node:url");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data", "annotations");
const DEFAULT_PORT = Number(process.env.PORT || 5176);
const SCHEMA_VERSION = "ad_face_annotation_v2";
const EXPERT_MODE = process.argv.includes("--expert") ||
  /^(1|true|yes|on)$/i.test(String(process.env.ANNOTATION_EXPERT_MODE || ""));

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".md": "text/markdown; charset=utf-8",
    ".yaml": "text/yaml; charset=utf-8",
    ".yml": "text/yaml; charset=utf-8"
  }[ext] || "application/octet-stream";
}

function sendText(res, status, text, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": type,
    "content-length": Buffer.byteLength(text)
  });
  res.end(text);
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function readBody(req, limitBytes = 20 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function slugify(value, fallback = "item") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return slug || fallback;
}

function sanitizeSessionId(value) {
  return slugify(value, "");
}

function sanitizeImageId(value) {
  return slugify(value, "image");
}

function sessionDir(sessionId) {
  const safe = sanitizeSessionId(sessionId);
  if (!safe) {
    throw new Error("A valid session id is required.");
  }
  return path.join(DATA_DIR, safe);
}

function annotationPath(sessionId, imageId) {
  return path.join(sessionDir(sessionId), `${sanitizeImageId(imageId)}.json`);
}

function normalizeManifestImage(item, index) {
  const imagePath = String(item.path || item.absolute_path || "").trim();
  if (!imagePath) {
    throw new Error(`Manifest image ${index + 1} is missing path.`);
  }
  if (!path.isAbsolute(imagePath)) {
    throw new Error(`Manifest image ${index + 1} path must be absolute: ${imagePath}`);
  }
  const filename = String(item.filename || path.basename(imagePath));
  const imageId = String(item.image_id || item.id || filename.replace(/\.[^.]+$/, ""));
  return {
    image_id: imageId,
    filename,
    path: imagePath,
    page_type: item.page_type || item.pageType || "unknown",
    metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : {},
    index,
    total: null
  };
}

async function readManifest(manifestPath) {
  const resolved = String(manifestPath || "").trim();
  if (!resolved) {
    throw new Error("Manifest path is required.");
  }
  if (!path.isAbsolute(resolved)) {
    throw new Error("Manifest path must be absolute.");
  }
  const raw = await fs.readFile(resolved, "utf-8");
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
  if (!Array.isArray(parsed.images)) {
    throw new Error("Manifest requires an images array.");
  }
  if (!parsed.images.length) {
    throw new Error("Manifest requires at least one image.");
  }
  const images = parsed.images.map(normalizeManifestImage);
  const seenImageIds = new Set();
  for (const image of images) {
    if (seenImageIds.has(image.image_id)) {
      throw new Error(`Manifest image_id must be unique: ${image.image_id}`);
    }
    seenImageIds.add(image.image_id);
    try {
      await fs.access(image.path);
    } catch {
      throw new Error(`Manifest image file not found: ${image.path}`);
    }
    image.total = images.length;
  }
  return {
    task_id: parsed.task_id || parsed.taskId || path.basename(resolved, path.extname(resolved)),
    manifest_path: resolved,
    images,
    metadata: parsed.metadata && typeof parsed.metadata === "object" ? parsed.metadata : {}
  };
}

async function readAnnotation(sessionId, imageId) {
  try {
    const raw = await fs.readFile(annotationPath(sessionId, imageId), "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readSessionFile(sessionId) {
  try {
    const raw = await fs.readFile(path.join(sessionDir(sessionId), "session.json"), "utf-8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function pathKey(value) {
  return path.normalize(path.resolve(String(value || ""))).toLowerCase();
}

function pathsMatch(left, right) {
  return Boolean(left && right && pathKey(left) === pathKey(right));
}

async function sessionAnnotationFiles(sessionId) {
  const dir = sessionDir(sessionId);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "session.json")
    .map((entry) => entry.name)
    .sort();
}

async function inferSessionFromAnnotations(sessionId) {
  const dir = sessionDir(sessionId);
  const files = await sessionAnnotationFiles(sessionId);
  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(dir, file), "utf-8");
      const annotation = JSON.parse(raw.replace(/^\uFEFF/, ""));
      const savedSession = annotation.session || {};
      return {
        schema_version: annotation.schema_version || SCHEMA_VERSION,
        session_id: sessionId,
        session_code: savedSession.session_code || (/^\d{8}$/.test(sessionId) ? sessionId : null),
        created_at: savedSession.session_created_at || annotation.created_at || null,
        manifest_path: annotation.task?.manifest_path || null,
        task_id: annotation.task?.task_id || null
      };
    } catch {
      // Continue until a valid legacy page annotation is found.
    }
  }
  return null;
}

async function readSessionCandidate(sessionId) {
  try {
    return await readSessionFile(sessionId) || await inferSessionFromAnnotations(sessionId);
  } catch {
    return inferSessionFromAnnotations(sessionId);
  }
}

async function inferSessionTask(session) {
  if (session.manifest_path) {
    return {
      manifest_path: session.manifest_path,
      task_id: session.task_id || null
    };
  }
  const dir = sessionDir(session.session_id);
  const files = await sessionAnnotationFiles(session.session_id);
  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(dir, file), "utf-8");
      const annotation = JSON.parse(raw.replace(/^\uFEFF/, ""));
      if (annotation.task?.manifest_path) {
        return {
          manifest_path: annotation.task.manifest_path,
          task_id: annotation.task.task_id || null
        };
      }
    } catch {
      // A malformed page file should not hide other resumable sessions.
    }
  }
  return { manifest_path: null, task_id: null };
}

async function createRandomSession({ createdAt, manifestPath, taskId }) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const sessionCode = String(crypto.randomInt(10_000_000, 100_000_000));
    const dir = sessionDir(sessionCode);
    try {
      await fs.mkdir(dir);
    } catch (error) {
      if (error.code === "EEXIST") continue;
      throw error;
    }
    const session = {
      schema_version: SCHEMA_VERSION,
      session_id: sessionCode,
      session_code: sessionCode,
      created_at: createdAt || new Date().toISOString(),
      manifest_path: manifestPath || null,
      task_id: taskId || null
    };
    await fs.writeFile(path.join(dir, "session.json"), JSON.stringify(session, null, 2), "utf-8");
    return session;
  }
  throw new Error("Could not allocate a unique eight-digit session number.");
}

async function regenerateJsonl(sessionId) {
  const dir = sessionDir(sessionId);
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "session.json")
    .map((entry) => entry.name)
    .sort();
  const lines = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(dir, file), "utf-8");
    lines.push(JSON.stringify(JSON.parse(raw)));
  }
  const output = path.join(dir, "annotations.jsonl");
  await fs.writeFile(output, `${lines.join("\n")}${lines.length ? "\n" : ""}`, "utf-8");
  return output;
}

async function writeAnnotation(sessionId, imageId, annotation) {
  const dir = sessionDir(sessionId);
  await fs.mkdir(dir, { recursive: true });
  const now = new Date().toISOString();
  const out = {
    ...annotation,
    schema_version: annotation.schema_version || SCHEMA_VERSION,
    server_saved_at: now
  };
  const filePath = annotationPath(sessionId, imageId);
  await fs.writeFile(filePath, JSON.stringify(out, null, 2), "utf-8");
  const jsonlPath = await regenerateJsonl(sessionId);
  return { filePath, jsonlPath, annotation: out };
}

async function statusesForManifest(sessionId, manifest) {
  const pairs = await Promise.all(manifest.images.map(async (image) => {
    const saved = await readAnnotation(sessionId, image.image_id);
    return [image.image_id, saved ? {
      status: saved.status || "draft",
      updated_at: saved.updated_at || saved.server_saved_at || null,
      finished_at: saved.finished_at || null
    } : null];
  }));
  return Object.fromEntries(pairs);
}

async function sessionProgress(sessionId, manifestPath) {
  const manifest = await readManifest(manifestPath);
  const statuses = await statusesForManifest(sessionId, manifest);
  return {
    task_id: manifest.task_id,
    total: manifest.images.length,
    statuses
  };
}

function isDoneStatus(status) {
  return ["complete", "ineligible", "needs_review"].includes(status);
}

async function listSavedSessions(manifestPath = null) {
  const requestedManifestPath = String(manifestPath || "").trim();
  const filteredManifest = requestedManifestPath ? await readManifest(requestedManifestPath) : null;
  let entries;
  try {
    entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const manifestCache = new Map();
  const getManifest = async (candidatePath) => {
    if (!candidatePath) return null;
    if (filteredManifest) {
      return pathsMatch(candidatePath, filteredManifest.manifest_path) ? filteredManifest : null;
    }
    const key = pathKey(candidatePath);
    if (!manifestCache.has(key)) {
      manifestCache.set(key, readManifest(candidatePath).catch(() => null));
    }
    return manifestCache.get(key);
  };
  const sessions = await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
    const session = await readSessionCandidate(entry.name);
    if (!session?.session_id) return null;
    const task = await inferSessionTask(session);
    const manifest = await getManifest(task.manifest_path);
    if (!manifest) return null;
    const statuses = await statusesForManifest(session.session_id, manifest);
    const ordered = manifest.images.map((image) => statuses[image.image_id]);
    const done = ordered.filter((item) => isDoneStatus(item?.status)).length;
    const started = ordered.filter((item) => item && !isDoneStatus(item.status)).length;
    const notStarted = ordered.length - done - started;
    let resumeIndex = ordered.findIndex((item) => item && !isDoneStatus(item.status));
    if (resumeIndex < 0) resumeIndex = ordered.findIndex((item) => !item);
    if (resumeIndex < 0) resumeIndex = Math.max(ordered.length - 1, 0);
    const timestamps = ordered
      .flatMap((item) => item ? [item.updated_at, item.finished_at] : [])
      .filter(Boolean);
    const updatedAt = timestamps.sort().at(-1) || session.created_at || null;
    return {
      session_id: session.session_id,
      session_code: session.session_code || session.session_id,
      created_at: session.created_at || null,
      updated_at: updatedAt,
      task_id: task.task_id || manifest.task_id,
      manifest_path: manifest.manifest_path,
      total: ordered.length,
      done,
      started,
      not_started: notStarted,
      resume_index: resumeIndex,
      resume_image_id: manifest.images[resumeIndex]?.image_id || null
    };
  }));
  return sessions
    .filter(Boolean)
    .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
}

async function serveFile(res, filePath) {
  try {
    const body = await fs.readFile(filePath);
    res.writeHead(200, { "content-type": contentType(filePath) });
    res.end(body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      sendText(res, 404, "Not found");
      return;
    }
    throw error;
  }
}

async function streamImage(res, imagePath) {
  const resolved = String(imagePath || "").trim();
  if (!resolved || !path.isAbsolute(resolved)) {
    sendJson(res, 400, { error: "Image path must be absolute." });
    return;
  }
  try {
    const body = await fs.readFile(resolved);
    res.writeHead(200, {
      "content-type": contentType(resolved),
      "cache-control": "no-store"
    });
    res.end(body);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(res, 404, { error: "Image file not found." });
      return;
    }
    throw error;
  }
}

async function handleApi(req, res, pathname, parsedUrl) {
  if (req.method === "GET" && pathname === "/api/config") {
    return sendJson(res, 200, {
      ok: true,
      config: { expert_mode: EXPERT_MODE }
    });
  }

  if (req.method === "GET" && pathname === "/api/sessions") {
    const sessions = await listSavedSessions(parsedUrl.searchParams.get("manifest_path"));
    return sendJson(res, 200, { ok: true, sessions });
  }

  if (req.method === "POST" && pathname === "/api/session") {
    const body = JSON.parse(await readBody(req));
    const existing = sanitizeSessionId(body.session_id);
    const requestedManifestPath = String(body.manifest_path || "").trim();
    if (requestedManifestPath && !path.isAbsolute(requestedManifestPath)) {
      throw new Error("Manifest path must be absolute.");
    }
    if (existing) {
      const stored = await readSessionCandidate(existing);
      if (!stored) {
        throw new Error("The selected saved session no longer exists.");
      }
      const task = await inferSessionTask(stored);
      if (requestedManifestPath && task.manifest_path && !pathsMatch(requestedManifestPath, task.manifest_path)) {
        throw new Error("The selected saved session uses a different manifest.");
      }
      return sendJson(res, 200, {
        ok: true,
        resumed: true,
        session: {
          ...stored,
          session_code: stored.session_code || stored.session_id,
          manifest_path: stored.manifest_path || task.manifest_path || requestedManifestPath || null,
          task_id: stored.task_id || task.task_id || body.task_id || null
        }
      });
    }
    const session = await createRandomSession({
      createdAt: body.created_at,
      manifestPath: requestedManifestPath,
      taskId: body.task_id
    });
    return sendJson(res, 200, { ok: true, resumed: false, session });
  }

  if (req.method === "GET" && pathname === "/api/manifest") {
    const manifest = await readManifest(parsedUrl.searchParams.get("path"));
    return sendJson(res, 200, { ok: true, manifest });
  }

  if (req.method === "GET" && pathname === "/api/progress") {
    const progress = await sessionProgress(
      parsedUrl.searchParams.get("session_id"),
      parsedUrl.searchParams.get("manifest_path")
    );
    return sendJson(res, 200, { ok: true, progress });
  }

  if (req.method === "GET" && pathname === "/api/image") {
    return streamImage(res, parsedUrl.searchParams.get("path"));
  }

  if (req.method === "GET" && pathname === "/api/annotation") {
    const annotation = await readAnnotation(
      parsedUrl.searchParams.get("session_id"),
      parsedUrl.searchParams.get("image_id")
    );
    return sendJson(res, 200, { ok: true, annotation });
  }

  if (req.method === "POST" && pathname === "/api/annotation") {
    const body = JSON.parse(await readBody(req));
    const sessionId = body.session_id;
    const imageId = body.image_id;
    if (!sessionId || !imageId || !body.annotation) {
      return sendJson(res, 400, { error: "session_id, image_id, and annotation are required." });
    }
    const saved = await writeAnnotation(sessionId, imageId, body.annotation);
    return sendJson(res, 200, {
      ok: true,
      saved_to: saved.filePath,
      jsonl: saved.jsonlPath,
      annotation: saved.annotation
    });
  }

  return sendJson(res, 404, { error: "Unknown API route." });
}

async function handler(req, res) {
  try {
    const parsedUrl = new url.URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname, parsedUrl);
      return;
    }

    if (req.method !== "GET") {
      sendText(res, 405, "Method not allowed");
      return;
    }

    if (pathname === "/") {
      await serveFile(res, path.join(PUBLIC_DIR, "index.html"));
      return;
    }

    const requested = path.normalize(path.join(PUBLIC_DIR, pathname));
    if (!requested.startsWith(PUBLIC_DIR)) {
      sendText(res, 403, "Forbidden");
      return;
    }
    await serveFile(res, requested);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: error.message || "Server error" });
  }
}

function listen(port) {
  const server = http.createServer(handler);
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      listen(port + 1);
      return;
    }
    throw error;
  });
  server.listen(port, () => {
    const mode = EXPERT_MODE ? " (expert mode)" : "";
    console.log(`Annotation App V2${mode}: http://localhost:${port}`);
  });
}

listen(DEFAULT_PORT);
