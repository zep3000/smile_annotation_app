const http = require("node:http");
const { DataType, newDb } = require("pg-mem");
const { migrate } = require("../src/hosted/database");
const { HostedRepository } = require("../src/hosted/repository");
const { createHostedServer } = require("../src/hosted/server");

async function main() {
  const memory = newDb({ autoCreateForeignKeyIndices: true });
  memory.public.registerOperator({
    operator: "~",
    left: DataType.text,
    right: DataType.text,
    returns: DataType.bool,
    implementation: (value, pattern) => new RegExp(pattern).test(value)
  });
  const adapter = memory.adapters.createPg();
  const pool = new adapter.Pool();
  await migrate(pool);
  const objects = new Map();
  const storage = {
    async putJpeg(key, body) { objects.set(key, Buffer.from(body)); },
    async putObject(key, body) { objects.set(key, Buffer.from(body)); },
    async getJpeg(key) {
      const body = objects.get(key);
      if (!body) throw new Error("Development object not found.");
      return { Body: body, ContentLength: body.length, ContentType: "image/jpeg" };
    },
    async exists(key) { return objects.has(key); }
  };
  const port = Number(process.env.PORT || 5180);
  const config = {
    appEnv: "development",
    host: "127.0.0.1",
    port,
    databaseUrl: "pg-mem",
    databaseSsl: false,
    sessionHours: 12,
    annotatorPassword: process.env.AUTH_ANNOTATOR_PASSWORD || "study-local-testing",
    annotatorPasswordHash: "",
    adminPassword: process.env.AUTH_ADMIN_PASSWORD || "admin-local-testing",
    adminPasswordHash: "",
    secureCookies: false,
    stagingAuthRequired: false,
    stagingUser: "",
    stagingPassword: "",
    bucket: "memory",
    bucketEndpoint: "memory",
    bucketRegion: "auto",
    bucketAccessKeyId: "memory",
    bucketSecretAccessKey: "memory",
    bucketForcePathStyle: false,
    maxJpegBytes: 60 * 1024 * 1024
  };
  const repository = new HostedRepository(pool);
  const app = createHostedServer({ config, pool, repository, storage });
  const server = http.createServer(app.handler);
  server.listen(port, config.host, () => {
    console.log(`Hosted development sandbox: http://${config.host}:${port}`);
    console.log("Admin password: admin-local-testing");
    console.log("Annotator password: study-local-testing");
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
