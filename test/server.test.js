const assert = require("node:assert/strict");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function availableTestPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await Promise.race([once(child, "exit"), sleep(2000)]);
  if (child.exitCode === null) child.kill();
}

async function startServer(overrides = {}) {
  const port = await availableTestPort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      APP_ENV: "test",
      HOST: "127.0.0.1",
      PORT: String(port),
      STAGING_AUTH_REQUIRED: "false",
      STAGING_USER: "",
      STAGING_PASSWORD: "",
      ...overrides
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before becoming healthy: ${stderr}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.status === 200) return { child, baseUrl };
    } catch {
      // The process may still be starting.
    }
    await sleep(50);
  }
  await stopServer(child);
  throw new Error(`Server did not become healthy: ${stderr}`);
}

function basicAuthorization(username, password) {
  const credentials = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${credentials}`;
}

test("health is public and the local app remains open when staging auth is disabled", async (t) => {
  const { child, baseUrl } = await startServer();
  t.after(() => stopServer(child));

  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");

  const home = await fetch(`${baseUrl}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Annotation App 2\.0/);
});

test("staging auth protects the app but never blocks the Railway healthcheck", async (t) => {
  const { child, baseUrl } = await startServer({
    STAGING_AUTH_REQUIRED: "true",
    STAGING_USER: "study-user",
    STAGING_PASSWORD: "correct horse battery staple"
  });
  t.after(() => stopServer(child));

  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);

  const anonymous = await fetch(`${baseUrl}/`);
  assert.equal(anonymous.status, 401);
  assert.match(anonymous.headers.get("www-authenticate"), /^Basic /);
  assert.equal(anonymous.headers.get("cache-control"), "no-store");

  const wrong = await fetch(`${baseUrl}/`, {
    headers: { authorization: basicAuthorization("study-user", "wrong") }
  });
  assert.equal(wrong.status, 401);

  const authorized = await fetch(`${baseUrl}/`, {
    headers: {
      authorization: basicAuthorization("study-user", "correct horse battery staple")
    }
  });
  assert.equal(authorized.status, 200);
  assert.match(await authorized.text(), /Annotation App 2\.0/);
});

test("staging auth fails closed when credentials are missing", async () => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      APP_ENV: "test",
      HOST: "127.0.0.1",
      PORT: String(await availableTestPort()),
      STAGING_AUTH_REQUIRED: "true",
      STAGING_USER: "",
      STAGING_PASSWORD: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const [exitCode] = await once(child, "exit");
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /STAGING_USER or STAGING_PASSWORD is missing/);
});
