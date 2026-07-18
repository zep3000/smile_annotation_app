const fs = require("node:fs/promises");
const path = require("node:path");

const SECURITY_HEADERS = {
  "content-security-policy": "default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()"
};

function responseHeaders(extra = {}) {
  return { ...SECURITY_HEADERS, ...extra };
}

function sendJson(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, responseHeaders({
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    ...extraHeaders
  }));
  res.end(body);
}

function sendText(res, status, body, contentType = "text/plain; charset=utf-8", extraHeaders = {}) {
  const text = String(body);
  res.writeHead(status, responseHeaders({
    "content-type": contentType,
    "content-length": Buffer.byteLength(text),
    ...extraHeaders
  }));
  res.end(text);
}

async function readBuffer(req, limitBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req, limitBytes = 5 * 1024 * 1024) {
  const buffer = await readBuffer(req, limitBytes);
  try {
    return JSON.parse(buffer.toString("utf-8").replace(/^\uFEFF/, ""));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function staticContentType(filePath) {
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml"
  }[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function serveStatic(res, publicDir, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const requested = path.resolve(publicDir, relative);
  if (!requested.startsWith(`${path.resolve(publicDir)}${path.sep}`)) {
    sendText(res, 403, "Forbidden");
    return;
  }
  try {
    const body = await fs.readFile(requested);
    res.writeHead(200, responseHeaders({
      "content-type": staticContentType(requested),
      "content-length": body.length,
      "cache-control": "no-cache"
    }));
    res.end(body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      sendText(res, 404, "Not found");
      return;
    }
    throw error;
  }
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || null;
}

function sameOriginRequest(req) {
  if (!new Set(["POST", "PUT", "PATCH", "DELETE"]).has(req.method)) return true;
  const fetchSite = String(req.headers["sec-fetch-site"] || "");
  if (fetchSite === "cross-site") return false;
  const origin = String(req.headers.origin || "");
  if (!origin) return true;
  try {
    return new URL(origin).host === String(req.headers.host || "");
  } catch {
    return false;
  }
}

module.exports = {
  SECURITY_HEADERS,
  clientIp,
  readBuffer,
  readJson,
  responseHeaders,
  sameOriginRequest,
  sendJson,
  sendText,
  serveStatic
};
