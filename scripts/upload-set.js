const fs = require("node:fs/promises");
const path = require("node:path");

function usage() {
  return "Usage: node scripts/upload-set.js <base-url> <manifest.json> <image-directory> [set-name]";
}

function outerAuthHeader() {
  if (!process.env.STAGING_USER || !process.env.STAGING_PASSWORD) return {};
  const encoded = Buffer.from(`${process.env.STAGING_USER}:${process.env.STAGING_PASSWORD}`).toString("base64");
  return { authorization: `Basic ${encoded}` };
}

async function responseJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function main() {
  const [baseUrlInput, manifestPath, imageDirectory, setName] = process.argv.slice(2);
  if (!baseUrlInput || !manifestPath || !imageDirectory) throw new Error(usage());
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  if (!adminPassword) throw new Error("Set ADMIN_PASSWORD in the environment for this command.");
  const baseUrl = baseUrlInput.replace(/\/+$/, "");
  const outer = outerAuthHeader();
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { ...outer, "content-type": "application/json" },
    body: JSON.stringify({ role: "admin", password: adminPassword })
  });
  await responseJson(login);
  const cookie = String(login.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie) throw new Error("Admin login did not return a session cookie.");
  const headers = { ...outer, cookie };
  const manifest = JSON.parse((await fs.readFile(path.resolve(manifestPath), "utf-8")).replace(/^\uFEFF/, ""));
  let setId = String(process.env.SET_ID || "").trim();
  let detail;
  if (!setId) {
    const created = await fetch(`${baseUrl}/api/admin/sets`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        name: setName || manifest.task_id || path.basename(manifestPath, path.extname(manifestPath)),
        manifest,
        flow_version: process.env.FLOW_VERSION || "1.11"
      })
    });
    const data = await responseJson(created);
    setId = data.set.id;
    console.log(`Created annotation set ${setId}.`);
  }
  detail = await responseJson(await fetch(`${baseUrl}/api/admin/sets/${setId}`, { headers }));
  const pending = detail.images.filter((image) => !image.uploaded);
  console.log(`${pending.length} of ${detail.images.length} JPEGs need uploading.`);
  for (let index = 0; index < pending.length; index += 1) {
    const image = pending[index];
    const filePath = path.resolve(imageDirectory, image.filename);
    const body = await fs.readFile(filePath);
    const response = await fetch(
      `${baseUrl}/api/admin/sets/${setId}/images/${encodeURIComponent(image.image_id)}`,
      { method: "PUT", headers: { ...headers, "content-type": "image/jpeg" }, body }
    );
    await responseJson(response);
    console.log(`[${index + 1}/${pending.length}] ${image.filename}`);
  }
  if (/^(1|true|yes|on)$/i.test(String(process.env.ACTIVATE || ""))) {
    await responseJson(await fetch(`${baseUrl}/api/admin/sets/${setId}/status`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ status: "active" })
    }));
    console.log("Annotation set activated.");
  }
  const assignmentCount = Number(process.env.ASSIGNMENT_COUNT || 0);
  if (Number.isInteger(assignmentCount) && assignmentCount > 0) {
    const data = await responseJson(await fetch(`${baseUrl}/api/admin/sets/${setId}/assignments`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        count: assignmentCount,
        expert_mode: /^(1|true|yes|on)$/i.test(String(process.env.ASSIGNMENT_EXPERT_MODE || ""))
      })
    }));
    console.log(`Assignment codes: ${data.assignments.map((item) => item.code).join(", ")}`);
  }
  console.log(`Set ID: ${setId}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
