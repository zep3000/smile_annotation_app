const assert = require("node:assert/strict");
const test = require("node:test");
const { hashPassword, sessionCookie, verifyPassword } = require("../src/hosted/auth");
const { loadBackupConfig, loadConfig } = require("../src/hosted/config");

test("scrypt password hashes verify without storing plaintext", async () => {
  const encoded = await hashPassword("a sufficiently long password");
  assert.match(encoded, /^scrypt\$/);
  assert.equal(await verifyPassword("a sufficiently long password", encoded), true);
  assert.equal(await verifyPassword("wrong password", encoded), false);
});

test("hosted configuration fails closed when required secrets are absent", () => {
  assert.throws(() => loadConfig({ APP_ENV: "production" }), /DATABASE_URL/);
  assert.throws(() => loadBackupConfig({ DATABASE_URL: "postgres://example" }), /BACKUP_AWS/);
});

test("production session cookies are HttpOnly, Secure, and same-site", () => {
  const cookie = sessionCookie("secret-token", { sessionHours: 12, secureCookies: true });
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Max-Age=43200/);
});
