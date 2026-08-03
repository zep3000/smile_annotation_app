const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createHostedServer } = require("../src/hosted/server");
const { tokenHash } = require("../src/hosted/auth");

function config() {
  return {
    appEnv: "test",
    host: "127.0.0.1",
    port: 0,
    databaseUrl: "postgres://unused",
    databaseSsl: false,
    sessionHours: 12,
    annotatorPassword: "annotator-secret",
    annotatorPasswordHash: "",
    adminPassword: "admin-secret",
    adminPasswordHash: "",
    secureCookies: false,
    stagingAuthRequired: false,
    stagingUser: "",
    stagingPassword: "",
    bucket: "test",
    bucketEndpoint: "http://unused",
    bucketRegion: "auto",
    bucketAccessKeyId: "unused",
    bucketSecretAccessKey: "unused",
    bucketForcePathStyle: false,
    maxJpegBytes: 1024 * 1024
  };
}

class FakeRepository {
  constructor() {
    this.sessions = new Map();
    this.audits = [];
    this.revision = 0;
    this.saved = null;
    this.summaryRecords = null;
    this.uploaded = false;
  }

  async createAuthSession(item) {
    this.sessions.set(item.tokenHash, { token_hash: item.tokenHash, role: item.role, expires_at: item.expiresAt });
  }

  async authSession(hash) {
    return this.sessions.get(hash) || null;
  }

  async deleteAuthSession(hash) {
    this.sessions.delete(hash);
  }

  async attachAssignment(hash) {
    Object.assign(this.sessions.get(hash), {
      assignment_id: "10000000-0000-4000-8000-000000000001",
      assignment_code: "12345678",
      assignment_status: "started",
      expert_mode: false,
      annotation_set_id: "20000000-0000-4000-8000-000000000001",
      set_status: "active"
    });
  }

  async audit(event) { this.audits.push(event); }

  async openAssignment(code) {
    if (code !== "12345678") {
      const error = new Error("Assignment code not found.");
      error.statusCode = 404;
      throw error;
    }
    return {
      id: "10000000-0000-4000-8000-000000000001",
      code,
      status: "started",
      started_at: null,
      created_at: new Date().toISOString(),
      annotation_set_id: "20000000-0000-4000-8000-000000000001",
      task_id: "test-task"
    };
  }

  async assignmentManifest() {
    return {
      manifest: {
        task_id: "test-task",
        manifest_path: null,
        metadata: {},
        images: [{ image_id: "page-1", filename: "page-1.jpg", path: null, page_type: "single", metadata: {}, index: 0, total: 1 }]
      }
    };
  }

  async assignmentProgress() { return { "page-1": this.saved ? { status: this.saved.status, revision: this.revision } : null }; }
  async assignmentSummaryRecords(_assignmentId, range = null) {
    const records = this.summaryRecords || [
      { image_id: "page-1", status: this.saved?.status || null, payload: this.saved || null }
    ];
    if (!range) return records;
    return records.slice(range.start, range.end + 1);
  }
  async annotation() { return this.saved ? { payload: this.saved, revision: this.revision } : null; }
  async imageForAssignment() { return { filename: "page-1.jpg", object_key: "sets/test/page-1.jpg" }; }

  async saveAnnotation({ payload, expectedRevision }) {
    if (Number(expectedRevision || 0) !== this.revision) {
      const error = new Error("This page was changed in another browser or tab. Reload it before saving again.");
      error.statusCode = 409;
      error.code = "revision_conflict";
      error.currentRevision = this.revision;
      throw error;
    }
    this.revision += 1;
    this.saved = payload;
    return { annotation: payload, revision: this.revision };
  }

  async listSets() { return []; }
  async createSet() { return { id: "20000000-0000-4000-8000-000000000001", task_id: "test-task" }; }
  async getSet() { return null; }
  async imageForUpload() { return { id: "30000000-0000-4000-8000-000000000001", image_id: "page-1", object_key: "sets/test/page-1.jpg" }; }
  async reusableUploadedImageForUpload() { return null; }
  async markImageUploaded() { this.uploaded = true; return { image_id: "page-1", uploaded: true }; }
  async exportAssignment() {
    return {
      set: { id: "20000000-0000-4000-8000-000000000001", task_id: "test-task", name: "Test set" },
      assignment: { assignment_code: "12345678", assignment_status: "started" },
      records: [
        {
          assignment_code: "12345678",
          assignment_status: "started",
          image_id: "page-1",
          filename: "page-1.jpg",
          sort_order: 0,
          status: "complete",
          revision: 1,
          created_at: "2026-07-19T10:00:00.000Z",
          updated_at: "2026-07-19T10:10:00.000Z",
          completed_at: "2026-07-19T10:10:00.000Z",
          payload: { status: "complete" }
        },
        {
          assignment_code: "12345678",
          assignment_status: "started",
          image_id: "page-2",
          filename: "page-2.jpg",
          sort_order: 1,
          status: null,
          revision: null,
          created_at: null,
          updated_at: null,
          completed_at: null,
          payload: null
        }
      ]
    };
  }
}

function fakeStorage() {
  return {
    async getJpeg() { return { Body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), ContentLength: 4 }; },
    async putJpeg() {}
  };
}

async function startTestServer() {
  const repository = new FakeRepository();
  const pool = { async query() { return { rows: [{ ready: 1 }] }; } };
  const app = createHostedServer({ config: config(), pool, repository, storage: fakeStorage() });
  const server = http.createServer(app.handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    repository,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => {
      server.closeAllConnections();
      server.close(resolve);
    })
  };
}

async function login(baseUrl, role, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role, password })
  });
  return { response, cookie: String(response.headers.get("set-cookie") || "").split(";")[0] };
}

test("hosted annotator login protects assignment and image APIs", async (t) => {
  const app = await startTestServer();
  t.after(app.close);

  const anonymousImage = await fetch(`${app.baseUrl}/api/image?image_id=page-1`);
  assert.equal(anonymousImage.status, 401);
  const anonymousSummary = await fetch(`${app.baseUrl}/api/summary`);
  assert.equal(anonymousSummary.status, 401);

  const wrong = await login(app.baseUrl, "annotator", "wrong");
  assert.equal(wrong.response.status, 401);

  const signedIn = await login(app.baseUrl, "annotator", "annotator-secret");
  assert.equal(signedIn.response.status, 200);
  assert.match(signedIn.cookie, /^annotation_app_session=/);
  const rawToken = decodeURIComponent(signedIn.cookie.split("=")[1]);
  assert.ok(app.repository.sessions.has(tokenHash(rawToken)));

  const noAssignment = await fetch(`${app.baseUrl}/api/manifest`, { headers: { cookie: signedIn.cookie } });
  assert.equal(noAssignment.status, 403);

  const opened = await fetch(`${app.baseUrl}/api/assignment/open`, {
    method: "POST",
    headers: { cookie: signedIn.cookie, "content-type": "application/json" },
    body: JSON.stringify({ code: "12345678" })
  });
  assert.equal(opened.status, 200);

  const image = await fetch(`${app.baseUrl}/api/image?image_id=page-1`, { headers: { cookie: signedIn.cookie } });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

  app.repository.saved = {
    status: "complete",
    advertisements: [{ people: [{ face_bbox: [0, 0, 1, 1] }], groups: [] }],
    timing: { total_focused_ms: 60_000 }
  };
  const summaryResponse = await fetch(`${app.baseUrl}/api/summary`, { headers: { cookie: signedIn.cookie } });
  assert.equal(summaryResponse.status, 200);
  assert.deepEqual((await summaryResponse.json()).summary, {
    pages_total: 1,
    pages_annotated: 1,
    qualifying_advertisements: 1,
    face_depictions_boxed: 1,
    unique_face_identities_boxed: 1,
    groups_annotated: 0,
    focused_time_ms: 60_000
  });
});

test("hosted summary range is optional and only limits records when supplied", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const signedIn = await login(app.baseUrl, "annotator", "annotator-secret");
  await fetch(`${app.baseUrl}/api/assignment/open`, {
    method: "POST",
    headers: { cookie: signedIn.cookie, "content-type": "application/json" },
    body: JSON.stringify({ code: "12345678" })
  });
  app.repository.summaryRecords = [
    { image_id: "page-1", status: "complete", payload: { status: "complete", timing: { total_focused_ms: 60_000 } } },
    { image_id: "page-2", status: "ineligible", payload: { status: "ineligible", page: { qualifying_ad_count: 0, no_qualifying_ad_reason: "no_ads_on_page" }, timing: { total_focused_ms: 120_000 } } },
    { image_id: "page-3", status: null, payload: null }
  ];

  const totalResponse = await fetch(`${app.baseUrl}/api/summary`, { headers: { cookie: signedIn.cookie } });
  assert.equal(totalResponse.status, 200);
  const total = (await totalResponse.json()).summary;
  assert.equal(total.pages_total, 3);
  assert.equal(total.pages_annotated, 2);
  assert.equal(total.focused_time_ms, 180_000);

  const blockResponse = await fetch(`${app.baseUrl}/api/summary?start=0&end=1`, { headers: { cookie: signedIn.cookie } });
  assert.equal(blockResponse.status, 200);
  const block = (await blockResponse.json()).summary;
  assert.equal(block.pages_total, 2);
  assert.equal(block.pages_annotated, 2);
  assert.equal(block.focused_time_ms, 180_000);
});

test("hosted annotation saves reject stale revisions", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const signedIn = await login(app.baseUrl, "annotator", "annotator-secret");
  await fetch(`${app.baseUrl}/api/assignment/open`, {
    method: "POST",
    headers: { cookie: signedIn.cookie, "content-type": "application/json" },
    body: JSON.stringify({ code: "12345678" })
  });
  const first = await fetch(`${app.baseUrl}/api/annotation`, {
    method: "POST",
    headers: { cookie: signedIn.cookie, "content-type": "application/json" },
    body: JSON.stringify({
      image_id: "page-1",
      revision: 0,
      annotation: { schema_version: "ad_face_annotation_v2", image: { image_id: "page-1" }, status: "draft" }
    })
  });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).revision, 1);

  const stale = await fetch(`${app.baseUrl}/api/annotation`, {
    method: "POST",
    headers: { cookie: signedIn.cookie, "content-type": "application/json" },
    body: JSON.stringify({
      image_id: "page-1",
      revision: 0,
      annotation: { schema_version: "ad_face_annotation_v2", image: { image_id: "page-1" }, status: "complete" }
    })
  });
  assert.equal(stale.status, 409);
  const conflict = await stale.json();
  assert.equal(conflict.code, "revision_conflict");
  assert.equal(conflict.current_revision, 1);
});

test("admin upload accepts JPEG bytes and rejects other files", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const signedIn = await login(app.baseUrl, "admin", "admin-secret");

  const invalid = await fetch(`${app.baseUrl}/api/admin/sets/20000000-0000-4000-8000-000000000001/images/page-1`, {
    method: "PUT",
    headers: { cookie: signedIn.cookie, "content-type": "image/jpeg" },
    body: Buffer.from("not-jpeg")
  });
  assert.equal(invalid.status, 415);

  const valid = await fetch(`${app.baseUrl}/api/admin/sets/20000000-0000-4000-8000-000000000001/images/page-1`, {
    method: "PUT",
    headers: { cookie: signedIn.cookie, "content-type": "image/jpeg" },
    body: Buffer.from([0xff, 0xd8, 0x00, 0xff, 0xd9])
  });
  assert.equal(valid.status, 200);
  assert.equal(app.repository.uploaded, true);
});

test("admin can export one assignment as JSONL", async (t) => {
  const app = await startTestServer();
  t.after(app.close);
  const signedIn = await login(app.baseUrl, "admin", "admin-secret");

  const response = await fetch(`${app.baseUrl}/api/admin/assignments/10000000-0000-4000-8000-000000000001/export.jsonl`, {
    headers: { cookie: signedIn.cookie }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/x-ndjson; charset=utf-8");
  assert.match(response.headers.get("content-disposition"), /test-task_12345678_\d{4}-\d{2}-\d{2}\.jsonl/);
  const lines = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].assignment_code, "12345678");
  assert.equal(lines[0].image_id, "page-1");
  assert.deepEqual(lines[0].annotation, { status: "complete" });
  assert.ok(app.repository.audits.some((event) => event.eventType === "assignment_exported"));
});
