const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);
const COOKIE_NAME = "annotation_app_session";

function secureEqual(left, right) {
  const leftDigest = crypto.createHash("sha256").update(String(left)).digest();
  const rightDigest = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

async function hashPassword(password, options = {}) {
  const cost = options.cost || 16384;
  const blockSize = options.blockSize || 8;
  const parallelization = options.parallelization || 1;
  const salt = options.salt || crypto.randomBytes(16);
  const derived = await scrypt(String(password), salt, 32, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 64 * 1024 * 1024
  });
  return [
    "scrypt",
    cost,
    blockSize,
    parallelization,
    Buffer.from(salt).toString("base64url"),
    Buffer.from(derived).toString("base64url")
  ].join("$");
}

async function verifyPassword(password, encoded, plaintext = "") {
  if (encoded) {
    const parts = String(encoded).split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, cost, blockSize, parallelization, saltText, expectedText] = parts;
    const expected = Buffer.from(expectedText, "base64url");
    const actual = await scrypt(String(password), Buffer.from(saltText, "base64url"), expected.length, {
      N: Number(cost),
      r: Number(blockSize),
      p: Number(parallelization),
      maxmem: 64 * 1024 * 1024
    });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
  return Boolean(plaintext) && secureEqual(password, plaintext);
}

function newSessionToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return {
    token,
    hash: crypto.createHash("sha256").update(token).digest("hex")
  };
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function parseCookies(header) {
  const cookies = {};
  for (const item of String(header || "").split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function sessionCookie(token, config) {
  const maxAge = config.sessionHours * 60 * 60;
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    config.secureCookies ? "Secure" : "",
    `Max-Age=${maxAge}`
  ].filter(Boolean).join("; ");
}

function clearSessionCookie(config) {
  return [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    config.secureCookies ? "Secure" : "",
    "Max-Age=0"
  ].filter(Boolean).join("; ");
}

function sessionTokenFromRequest(req) {
  return parseCookies(req.headers.cookie)[COOKIE_NAME] || "";
}

module.exports = {
  COOKIE_NAME,
  clearSessionCookie,
  hashPassword,
  newSessionToken,
  secureEqual,
  sessionCookie,
  sessionTokenFromRequest,
  tokenHash,
  verifyPassword
};
