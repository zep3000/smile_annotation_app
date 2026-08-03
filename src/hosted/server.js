const crypto = require("node:crypto");
const http = require("node:http");
const path = require("node:path");
const url = require("node:url");
const { formatSetExport } = require("../shared/export-format");
const {
  clearSessionCookie,
  newSessionToken,
  secureEqual,
  sessionCookie,
  sessionTokenFromRequest,
  tokenHash,
  verifyPassword
} = require("./auth");
const { loadConfig } = require("./config");
const { createPool, migrate, ready } = require("./database");
const {
  clientIp,
  readBuffer,
  readJson,
  responseHeaders,
  sameOriginRequest,
  sendJson,
  sendText,
  serveStatic
} = require("./http");
const { isJpeg } = require("./manifest");
const { HostedRepository } = require("./repository");
const { createStorage } = require("./storage");
const { summarizeAnnotations } = require("../shared/annotation-summary");

const PUBLIC_DIR = path.resolve(__dirname, "..", "..", "public");
const DONE_STATUSES = new Set(["complete", "ineligible", "needs_review"]);

class LoginLimiter {
  constructor({ attempts = 8, windowMs = 15 * 60 * 1000 } = {}) {
    this.attempts = attempts;
    this.windowMs = windowMs;
    this.entries = new Map();
  }

  allowed(key) {
    const now = Date.now();
    const entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      this.entries.set(key, { count: 0, resetAt: now + this.windowMs });
      return true;
    }
    return entry.count < this.attempts;
  }

  fail(key) {
    const now = Date.now();
    const entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    entry.count += 1;
  }

  clear(key) {
    this.entries.delete(key);
  }
}

function basicAuthorized(req, config) {
  if (!config.stagingAuthRequired) return true;
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
  } catch {
    return false;
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;
  return secureEqual(decoded.slice(0, separator), config.stagingUser) &&
    secureEqual(decoded.slice(separator + 1), config.stagingPassword);
}

function sendBasicUnauthorized(res) {
  sendText(res, 401, "Authentication required.", "text/plain; charset=utf-8", {
    "www-authenticate": 'Basic realm="Annotation App Staging", charset="UTF-8"',
    "cache-control": "no-store"
  });
}

function sessionSummary(session) {
  if (!session) return { authenticated: false };
  return {
    authenticated: true,
    role: session.role,
    assignment: session.assignment_id ? {
      id: session.assignment_id,
      code: session.assignment_code,
      status: session.assignment_status,
      expert_mode: session.expert_mode
    } : null
  };
}

function contentDispositionFilename(value) {
  return String(value || "export").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function createHostedServer({ config, pool, repository, storage } = {}) {
  const activeConfig = config || loadConfig();
  const activePool = pool || createPool(activeConfig);
  const repo = repository || new HostedRepository(activePool);
  const objectStorage = storage || createStorage(activeConfig);
  const loginLimiter = new LoginLimiter();
  const assignmentLimiter = new LoginLimiter({ attempts: 12, windowMs: 15 * 60 * 1000 });

  async function requestSession(req) {
    const token = sessionTokenFromRequest(req);
    if (!token) return null;
    return repo.authSession(tokenHash(token));
  }

  async function requireRole(req, res, role, { assignment = false } = {}) {
    const session = await requestSession(req);
    if (!session || session.role !== role) {
      sendJson(res, 401, { error: "Sign in is required.", code: "authentication_required" });
      return null;
    }
    if (assignment && !session.assignment_id) {
      sendJson(res, 403, { error: "Open an assignment code first.", code: "assignment_required" });
      return null;
    }
    if (session.assignment_status === "revoked") {
      sendJson(res, 403, { error: "This assignment has been revoked.", code: "assignment_revoked" });
      return null;
    }
    if (session.assignment_id && session.set_status !== "active") {
      sendJson(res, 403, { error: "This annotation set is not currently active.", code: "set_inactive" });
      return null;
    }
    return session;
  }

  async function login(req, res) {
    const ip = clientIp(req);
    const body = await readJson(req, 16 * 1024);
    const role = body.role === "admin" ? "admin" : "annotator";
    const limiterKey = `${ip || "unknown"}:${role}`;
    if (!loginLimiter.allowed(limiterKey)) {
      sendJson(res, 429, { error: "Too many failed attempts. Try again later." });
      return;
    }
    const valid = role === "admin"
      ? await verifyPassword(body.password, activeConfig.adminPasswordHash, activeConfig.adminPassword)
      : await verifyPassword(body.password, activeConfig.annotatorPasswordHash, activeConfig.annotatorPassword);
    if (!valid) {
      loginLimiter.fail(limiterKey);
      await repo.audit({ role: "system", eventType: "login_failed", details: { requested_role: role }, ipAddress: ip });
      sendJson(res, 401, { error: "Incorrect password." });
      return;
    }
    loginLimiter.clear(limiterKey);
    const session = newSessionToken();
    const expiresAt = new Date(Date.now() + activeConfig.sessionHours * 60 * 60 * 1000);
    await repo.createAuthSession({
      tokenHash: session.hash,
      role,
      expiresAt,
      ipAddress: ip,
      userAgent: String(req.headers["user-agent"] || "").slice(0, 500)
    });
    await repo.audit({ role, eventType: "login_succeeded", ipAddress: ip });
    sendJson(res, 200, { ok: true, role }, { "set-cookie": sessionCookie(session.token, activeConfig) });
  }

  async function openAssignment(req, res, session) {
    const body = await readJson(req, 16 * 1024);
    const code = String(body.code || "").trim();
    if (!/^\d{8}$/.test(code)) {
      sendJson(res, 400, { error: "Enter the eight-digit assignment code." });
      return;
    }
    const limiterKey = `${clientIp(req) || "unknown"}:${session.token_hash}`;
    if (!assignmentLimiter.allowed(limiterKey)) {
      sendJson(res, 429, { error: "Too many incorrect assignment codes. Try again later." });
      return;
    }
    let assignment;
    try {
      assignment = await repo.openAssignment(code);
    } catch (error) {
      assignmentLimiter.fail(limiterKey);
      throw error;
    }
    assignmentLimiter.clear(limiterKey);
    const rawToken = sessionTokenFromRequest(req);
    await repo.attachAssignment(tokenHash(rawToken), assignment.id);
    await repo.audit({
      role: "annotator",
      assignmentId: assignment.id,
      setId: assignment.annotation_set_id,
      eventType: "assignment_opened",
      ipAddress: clientIp(req)
    });
    sendJson(res, 200, {
      ok: true,
      resumed: Boolean(assignment.started_at),
      session: {
        session_id: assignment.id,
        session_code: assignment.code,
        created_at: assignment.created_at,
        task_id: assignment.task_id,
        manifest_path: null
      }
    });
  }

  async function handleAnnotatorApi(req, res, pathname, parsedUrl) {
    const session = await requireRole(req, res, "annotator", { assignment: true });
    if (!session) return;

    if (req.method === "GET" && pathname === "/api/config") {
      sendJson(res, 200, { ok: true, config: { hosted_mode: true, expert_mode: Boolean(session.expert_mode) } });
      return;
    }
    if (req.method === "GET" && pathname === "/api/manifest") {
      const result = await repo.assignmentManifest(session.assignment_id);
      if (!result) return sendJson(res, 404, { error: "Assignment not found." });
      sendJson(res, 200, { ok: true, manifest: result.manifest });
      return;
    }
    if (req.method === "GET" && pathname === "/api/progress") {
      const statuses = await repo.assignmentProgress(session.assignment_id);
      sendJson(res, 200, { ok: true, progress: { statuses } });
      return;
    }
    if (req.method === "GET" && pathname === "/api/summary") {
      const hasRange = parsedUrl.searchParams.has("start") && parsedUrl.searchParams.has("end");
      const start = Number(parsedUrl.searchParams.get("start"));
      const end = Number(parsedUrl.searchParams.get("end"));
      const range = hasRange && Number.isInteger(start) && Number.isInteger(end)
        ? { start: Math.max(0, start), end: Math.max(0, end) }
        : null;
      const records = await repo.assignmentSummaryRecords(session.assignment_id, range);
      sendJson(res, 200, { ok: true, summary: summarizeAnnotations(records, records.length) });
      return;
    }
    if (req.method === "GET" && pathname === "/api/annotation") {
      const saved = await repo.annotation(session.assignment_id, parsedUrl.searchParams.get("image_id"));
      sendJson(res, 200, {
        ok: true,
        annotation: saved?.payload || null,
        revision: saved?.revision || 0
      });
      return;
    }
    if (req.method === "POST" && pathname === "/api/annotation") {
      const body = await readJson(req, 20 * 1024 * 1024);
      if (!body.image_id || !body.annotation) {
        return sendJson(res, 400, { error: "image_id and annotation are required." });
      }
      if (typeof body.annotation !== "object" || Array.isArray(body.annotation)) {
        return sendJson(res, 400, { error: "annotation must be a JSON object." });
      }
      if (body.annotation.schema_version !== "ad_face_annotation_v2") {
        return sendJson(res, 400, { error: "Unsupported annotation schema version." });
      }
      if (body.annotation.image?.image_id !== body.image_id) {
        return sendJson(res, 400, { error: "Annotation image_id does not match the requested page." });
      }
      const saved = await repo.saveAnnotation({
        assignmentId: session.assignment_id,
        externalImageId: body.image_id,
        payload: body.annotation,
        expectedRevision: body.revision
      });
      await repo.audit({
        role: "annotator",
        assignmentId: session.assignment_id,
        setId: session.annotation_set_id,
        eventType: "annotation_saved",
        details: { image_id: body.image_id, revision: saved.revision, status: saved.annotation.status },
        ipAddress: clientIp(req)
      });
      sendJson(res, 200, { ok: true, annotation: saved.annotation, revision: saved.revision });
      return;
    }
    if (req.method === "GET" && pathname === "/api/image") {
      const image = await repo.imageForAssignment(session.assignment_id, parsedUrl.searchParams.get("image_id"));
      if (!image) return sendJson(res, 404, { error: "Image not found." });
      const object = await objectStorage.getJpeg(image.object_key);
      const headers = responseHeaders({
        "content-type": "image/jpeg",
        "cache-control": "private, no-store, max-age=0",
        "content-disposition": `inline; filename="${contentDispositionFilename(image.filename)}"`
      });
      if (object.ContentLength !== undefined) headers["content-length"] = String(object.ContentLength);
      res.writeHead(200, headers);
      if (typeof object.Body?.pipe === "function") {
        object.Body.pipe(res);
      } else {
        const bytes = object.Body?.transformToByteArray
          ? await object.Body.transformToByteArray()
          : object.Body;
        res.end(Buffer.from(bytes || []));
      }
      return;
    }
    sendJson(res, 404, { error: "Unknown annotation API route." });
  }

  async function handleAdminApi(req, res, pathname, parsedUrl) {
    const session = await requireRole(req, res, "admin");
    if (!session) return;
    const ip = clientIp(req);

    if (req.method === "GET" && pathname === "/api/admin/sets") {
      return sendJson(res, 200, { ok: true, sets: await repo.listSets() });
    }
    if (req.method === "POST" && pathname === "/api/admin/sets") {
      const body = await readJson(req);
      let set;
      try {
        set = await repo.createSet({
          name: body.name,
          manifest: body.manifest,
          flowVersion: String(body.flow_version || "1.15")
        });
      } catch (error) {
        if (!error.statusCode) error.statusCode = error.code === "23505" ? 409 : 400;
        throw error;
      }
      await repo.audit({ role: "admin", setId: set.id, eventType: "set_created", details: { task_id: set.task_id }, ipAddress: ip });
      return sendJson(res, 201, { ok: true, set });
    }
    const setDetailMatch = pathname.match(/^\/api\/admin\/sets\/([0-9a-f-]+)$/i);
    if (req.method === "GET" && setDetailMatch) {
      const setId = setDetailMatch[1];
      const set = await repo.getSet(setId);
      if (!set) return sendJson(res, 404, { error: "Annotation set not found." });
      const [images, assignments, events] = await Promise.all([
        repo.setImages(setId),
        repo.setAssignments(setId),
        repo.auditEvents(setId, 200)
      ]);
      return sendJson(res, 200, { ok: true, set, images, assignments, events });
    }
    if (req.method === "DELETE" && setDetailMatch) {
      const set = await repo.deleteSetIfUnassigned(setDetailMatch[1]);
      if (!set) return sendJson(res, 404, { error: "Annotation set not found." });
      await repo.audit({
        role: "admin",
        eventType: "set_deleted",
        details: { deleted_set_id: set.id, task_id: set.task_id, name: set.name },
        ipAddress: ip
      });
      return sendJson(res, 200, { ok: true, set });
    }
    const uploadMatch = pathname.match(/^\/api\/admin\/sets\/([0-9a-f-]+)\/images\/([^/]+)$/i);
    if (req.method === "PUT" && uploadMatch) {
      if (!/^image\/jpeg(?:;|$)/i.test(String(req.headers["content-type"] || ""))) {
        return sendJson(res, 415, { error: "Only JPEG uploads are accepted." });
      }
      const setId = uploadMatch[1];
      const imageId = decodeURIComponent(uploadMatch[2]);
      const image = await repo.imageForUpload(setId, imageId);
      if (!image) return sendJson(res, 404, { error: "Manifest image not found." });
      const body = await readBuffer(req, activeConfig.maxJpegBytes);
      if (!isJpeg(body)) return sendJson(res, 415, { error: "The uploaded file is not a valid JPEG." });
      const sha256 = crypto.createHash("sha256").update(body).digest("hex");
      const reusable = await repo.reusableUploadedImageForUpload(image.id);
      let stored;
      let reused = false;
      if (reusable) {
        if (reusable.sha256 && reusable.sha256 !== sha256) {
          return sendJson(res, 409, {
            error: "A page with the same image ID or filename is already stored with different JPEG bytes."
          });
        }
        stored = await repo.markImageUploaded(image.id, {
          byteSize: reusable.byte_size || body.length,
          sha256,
          objectKey: reusable.object_key
        });
        reused = true;
      } else {
        await objectStorage.putJpeg(image.object_key, body, { sha256 });
        stored = await repo.markImageUploaded(image.id, { byteSize: body.length, sha256 });
      }
      await repo.audit({
        role: "admin",
        setId,
        eventType: reused ? "image_reused" : "image_uploaded",
        details: { image_id: image.image_id, byte_size: stored.byte_size, sha256, object_key: stored.object_key },
        ipAddress: ip
      });
      return sendJson(res, 200, { ok: true, image: stored });
    }
    const statusMatch = pathname.match(/^\/api\/admin\/sets\/([0-9a-f-]+)\/status$/i);
    if (req.method === "POST" && statusMatch) {
      const body = await readJson(req, 16 * 1024);
      const set = await repo.setStatus(statusMatch[1], body.status);
      if (!set) return sendJson(res, 404, { error: "Annotation set not found." });
      await repo.audit({ role: "admin", setId: set.id, eventType: `set_${set.status}`, ipAddress: ip });
      return sendJson(res, 200, { ok: true, set });
    }
    const assignmentsMatch = pathname.match(/^\/api\/admin\/sets\/([0-9a-f-]+)\/assignments$/i);
    if (req.method === "POST" && assignmentsMatch) {
      const body = await readJson(req, 16 * 1024);
      const count = Number(body.count);
      if (!Number.isInteger(count) || count < 1 || count > 500) {
        return sendJson(res, 400, { error: "Assignment count must be an integer from 1 to 500." });
      }
      const assignments = await repo.issueAssignments(assignmentsMatch[1], count, Boolean(body.expert_mode));
      await repo.audit({ role: "admin", setId: assignmentsMatch[1], eventType: "assignments_issued", details: { count, expert_mode: Boolean(body.expert_mode) }, ipAddress: ip });
      return sendJson(res, 201, { ok: true, assignments });
    }
    const copyMatch = pathname.match(/^\/api\/admin\/sets\/([0-9a-f-]+)\/copy-annotations$/i);
    if (req.method === "POST" && copyMatch) {
      const body = await readJson(req, 16 * 1024);
      const result = await repo.copyAnnotations({
        sourceAssignmentId: body.source_assignment_id,
        targetAssignmentId: body.target_assignment_id,
        targetSetId: copyMatch[1]
      });
      await repo.audit({
        role: "admin",
        setId: copyMatch[1],
        eventType: "annotations_copied",
        details: {
          source_assignment_id: body.source_assignment_id,
          target_assignment_id: body.target_assignment_id,
          copied: result.copied,
          skipped_existing: result.skipped_existing,
          skipped_no_match: result.skipped_no_match
        },
        ipAddress: ip
      });
      return sendJson(res, 200, { ok: true, result });
    }
    const assignmentMatch = pathname.match(/^\/api\/admin\/assignments\/([0-9a-f-]+)$/i);
    if (req.method === "PATCH" && assignmentMatch) {
      const body = await readJson(req, 16 * 1024);
      const assignment = await repo.updateAssignment(assignmentMatch[1], {
        expertMode: typeof body.expert_mode === "boolean" ? body.expert_mode : undefined,
        revoked: typeof body.revoked === "boolean" ? body.revoked : undefined
      });
      if (!assignment) return sendJson(res, 404, { error: "Assignment not found." });
      await repo.audit({ role: "admin", assignmentId: assignment.id, setId: assignment.annotation_set_id, eventType: "assignment_updated", details: body, ipAddress: ip });
      return sendJson(res, 200, { ok: true, assignment });
    }
    const assignmentExportMatch = pathname.match(/^\/api\/admin\/assignments\/([0-9a-f-]+)\/export\.(json|jsonl)$/i);
    if (req.method === "GET" && assignmentExportMatch) {
      const exported = await repo.exportAssignment(assignmentExportMatch[1]);
      if (!exported) return sendJson(res, 404, { error: "Assignment not found." });
      const format = assignmentExportMatch[2].toLowerCase();
      const generatedAt = new Date().toISOString();
      const assignmentCode = exported.assignment?.assignment_code || assignmentExportMatch[1];
      const filename = `${contentDispositionFilename(exported.set.task_id)}_${contentDispositionFilename(assignmentCode)}_${generatedAt.slice(0, 10)}.${format}`;
      const formatted = formatSetExport(exported, generatedAt);
      const body = formatted[format];
      await repo.audit({
        role: "admin",
        assignmentId: assignmentExportMatch[1],
        setId: exported.set.id,
        eventType: "assignment_exported",
        details: { format, record_count: formatted.records.length },
        ipAddress: ip
      });
      return sendText(res, 200, body, format === "jsonl" ? "application/x-ndjson; charset=utf-8" : "application/json; charset=utf-8", {
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store"
      });
    }
    const exportMatch = pathname.match(/^\/api\/admin\/sets\/([0-9a-f-]+)\/export\.(json|jsonl)$/i);
    if (req.method === "GET" && exportMatch) {
      const exported = await repo.exportSet(exportMatch[1]);
      if (!exported) return sendJson(res, 404, { error: "Annotation set not found." });
      const format = exportMatch[2].toLowerCase();
      const generatedAt = new Date().toISOString();
      const filename = `${contentDispositionFilename(exported.set.task_id)}_${generatedAt.slice(0, 10)}.${format}`;
      const formatted = formatSetExport(exported, generatedAt);
      const body = formatted[format];
      await repo.audit({ role: "admin", setId: exported.set.id, eventType: "set_exported", details: { format, record_count: formatted.records.length }, ipAddress: ip });
      return sendText(res, 200, body, format === "jsonl" ? "application/x-ndjson; charset=utf-8" : "application/json; charset=utf-8", {
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store"
      });
    }
    return sendJson(res, 404, { error: "Unknown admin API route." });
  }

  async function handler(req, res) {
    try {
      const parsedUrl = new url.URL(req.url, `http://${req.headers.host || "localhost"}`);
      const pathname = decodeURIComponent(parsedUrl.pathname);
      if (req.method === "GET" && pathname === "/health") {
        return sendJson(res, 200, { status: "ok", environment: activeConfig.appEnv, mode: "hosted", timestamp: new Date().toISOString() });
      }
      if (req.method === "GET" && pathname === "/ready") {
        try {
          const databaseReady = await ready(activePool);
          return sendJson(res, databaseReady ? 200 : 503, { status: databaseReady ? "ready" : "not_ready", database: databaseReady });
        } catch {
          return sendJson(res, 503, { status: "not_ready", database: false });
        }
      }
      if (!basicAuthorized(req, activeConfig)) return sendBasicUnauthorized(res);
      if (!sameOriginRequest(req)) return sendJson(res, 403, { error: "Cross-site request rejected." });

      if (req.method === "GET" && pathname === "/api/public-config") {
        return sendJson(res, 200, { ok: true, mode: "hosted" });
      }
      if (req.method === "POST" && pathname === "/api/auth/login") return await login(req, res);
      if (req.method === "GET" && pathname === "/api/auth/me") {
        return sendJson(res, 200, { ok: true, ...sessionSummary(await requestSession(req)) });
      }
      if (req.method === "POST" && pathname === "/api/auth/logout") {
        const token = sessionTokenFromRequest(req);
        if (token) await repo.deleteAuthSession(tokenHash(token));
        return sendJson(res, 200, { ok: true }, { "set-cookie": clearSessionCookie(activeConfig) });
      }
      if (req.method === "POST" && pathname === "/api/assignment/open") {
        const session = await requireRole(req, res, "annotator");
        if (!session) return;
        return await openAssignment(req, res, session);
      }
      if (pathname.startsWith("/api/admin/")) return await handleAdminApi(req, res, pathname, parsedUrl);
      if (pathname.startsWith("/api/")) return await handleAnnotatorApi(req, res, pathname, parsedUrl);

      if (req.method !== "GET") return sendText(res, 405, "Method not allowed");
      if (pathname === "/admin" || pathname === "/admin/") {
        return await serveStatic(res, PUBLIC_DIR, "/admin/index.html");
      }
      return await serveStatic(res, PUBLIC_DIR, pathname);
    } catch (error) {
      const status = Number(error.statusCode) || (error.message?.includes("not found") ? 404 : 500);
      if (status >= 500) console.error(error);
      sendJson(res, status, {
        error: status >= 500 ? "Server error." : error.message,
        code: error.code || undefined,
        current_revision: error.currentRevision
      });
    }
  }

  return { handler, pool: activePool, repository: repo, storage: objectStorage };
}

async function start() {
  const config = loadConfig();
  const pool = createPool(config);
  await migrate(pool);
  const app = createHostedServer({ config, pool });
  const server = http.createServer(app.handler);
  const shutdown = async () => {
    const forceClose = setTimeout(() => server.closeAllConnections(), 10_000);
    forceClose.unref();
    await new Promise((resolve) => server.close(resolve));
    clearTimeout(forceClose);
    await pool.end();
  };
  process.once("SIGTERM", () => {
    shutdown().catch(console.error);
  });
  process.once("SIGINT", () => {
    shutdown().catch(console.error);
  });
  server.listen(config.port, config.host, () => {
    console.log(`Annotation App V2 hosted: http://${config.host}:${config.port}`);
  });
  return server;
}

module.exports = { LoginLimiter, createHostedServer, start };
