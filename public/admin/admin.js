const state = { sets: [], selectedSetId: null, detail: null, files: [] };
const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function setStatus(selector, message, kind = "") {
  const element = $(selector);
  element.textContent = message;
  element.className = `status ${kind}`.trim();
}

function showView(id) {
  for (const selector of ["#emptyState", "#createSetView", "#setDetailView"]) {
    $(selector).classList.toggle("hidden", selector !== id);
  }
}

function formatDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString("en-GB");
}

async function login() {
  setStatus("#adminLoginStatus", "Signing in...");
  try {
    await jsonRequest("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "admin", password: $("#adminPassword").value })
    });
    $("#adminPassword").value = "";
    await openAdmin();
  } catch (error) {
    setStatus("#adminLoginStatus", error.message, "error");
  }
}

async function openAdmin() {
  $("#adminLogin").classList.add("hidden");
  $("#adminApp").classList.remove("hidden");
  await loadSets();
}

async function loadSets(preferredId = state.selectedSetId) {
  const data = await jsonRequest("/api/admin/sets");
  state.sets = data.sets;
  renderSetList();
  if (preferredId && state.sets.some((item) => item.id === preferredId)) {
    await selectSet(preferredId);
  } else if (!state.sets.length) {
    state.selectedSetId = null;
    showView("#emptyState");
  }
}

function renderSetList() {
  const list = $("#setList");
  list.innerHTML = "";
  for (const set of state.sets) {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.toggle("selected", set.id === state.selectedSetId);
    button.innerHTML = `<strong>${escapeHtml(set.name)}</strong><small>${escapeHtml(set.status)} | ${set.uploaded_count}/${set.image_count} images | ${set.done_count}/${set.assignment_count} done</small>`;
    button.addEventListener("click", () => void selectSet(set.id));
    list.appendChild(button);
  }
}

async function selectSet(setId) {
  state.selectedSetId = setId;
  renderSetList();
  showView("#setDetailView");
  const data = await jsonRequest(`/api/admin/sets/${setId}`);
  state.detail = data;
  renderDetail();
}

function renderDetail() {
  const { set, images, assignments, events } = state.detail;
  $("#setTitle").textContent = set.name;
  $("#setSubtitle").textContent = `${set.task_id} | flow ${set.flow_version}`;
  $("#setStatusBadge").textContent = set.status;
  $("#setStatusBadge").className = `status-badge ${set.status}`;
  $("#imageMetric").textContent = `${set.uploaded_count}/${set.image_count}`;
  $("#assignmentMetric").textContent = assignments.length;
  $("#startedMetric").textContent = assignments.filter((item) => item.status === "started").length;
  $("#doneMetric").textContent = assignments.filter((item) => item.status === "done").length;
  $("#uploadSummary").textContent = `${set.uploaded_count} of ${set.image_count} manifest images are stored.`;
  $("#activateSetButton").disabled = set.status === "active" || set.uploaded_count !== set.image_count;
  $("#deactivateSetButton").disabled = set.status !== "active";
  $("#createAssignmentsButton").disabled = set.status === "inactive";
  $("#jsonlExportLink").href = `/api/admin/sets/${set.id}/export.jsonl`;
  $("#jsonExportLink").href = `/api/admin/sets/${set.id}/export.json`;
  renderAssignments(assignments, set.image_count);
  renderAudit(events);
  updateUploadSelection();
}

function renderAssignments(assignments, imageCount) {
  const rows = $("#assignmentRows");
  rows.innerHTML = "";
  if (!assignments.length) {
    rows.innerHTML = '<tr><td colspan="6">No assignment codes generated.</td></tr>';
    return;
  }
  for (const assignment of assignments) {
    const row = document.createElement("tr");
    const revoked = assignment.status === "revoked";
    row.innerHTML = `
      <td><code>${escapeHtml(assignment.code)}</code></td>
      <td>${escapeHtml(assignment.status.replaceAll("_", " "))}</td>
      <td>${assignment.pages_done}/${imageCount} done, ${assignment.pages_started} opened</td>
      <td>${escapeHtml(formatDate(assignment.last_seen_at || assignment.started_at))}</td>
      <td><input class="inline-checkbox" type="checkbox" data-expert-id="${assignment.id}" ${assignment.expert_mode ? "checked" : ""} ${revoked ? "disabled" : ""}></td>
      <td><button type="button" data-revoke-id="${assignment.id}" data-revoked="${revoked}">${revoked ? "Restore" : "Revoke"}</button></td>
    `;
    rows.appendChild(row);
  }
  rows.querySelectorAll("[data-expert-id]").forEach((input) => {
    input.addEventListener("change", () => void updateAssignment(input.dataset.expertId, { expert_mode: input.checked }));
  });
  rows.querySelectorAll("[data-revoke-id]").forEach((button) => {
    button.addEventListener("click", () => void updateAssignment(button.dataset.revokeId, { revoked: button.dataset.revoked !== "true" }));
  });
}

function renderAudit(events) {
  const list = $("#auditList");
  list.innerHTML = events.length ? "" : "No activity recorded.";
  for (const event of events) {
    const item = document.createElement("div");
    item.className = "audit-item";
    item.innerHTML = `<span>${escapeHtml(formatDate(event.created_at))}</span><strong>${escapeHtml(event.event_type.replaceAll("_", " "))}</strong><span>${escapeHtml(JSON.stringify(event.details || {}))}</span>`;
    list.appendChild(item);
  }
}

async function createSet(event) {
  event.preventDefault();
  const file = $("#manifestFile").files[0];
  if (!file) return setStatus("#createSetStatus", "Choose a manifest JSON file.", "error");
  setStatus("#createSetStatus", "Validating manifest...");
  try {
    const manifest = JSON.parse(await file.text());
    const data = await jsonRequest("/api/admin/sets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: $("#setName").value.trim(),
        flow_version: $("#flowVersion").value.trim(),
        manifest
      })
    });
    $("#createSetForm").reset();
    $("#flowVersion").value = "1.11";
    await loadSets(data.set.id);
  } catch (error) {
    setStatus("#createSetStatus", error.message, "error");
  }
}

function updateUploadSelection() {
  if (!state.detail) return;
  const missing = new Set(state.detail.images.filter((item) => !item.uploaded).map((item) => item.filename.toLowerCase()));
  const selected = new Map(state.files.map((file) => [file.name.toLowerCase(), file]));
  const matched = [...missing].filter((filename) => selected.has(filename)).length;
  $("#uploadImagesButton").disabled = matched === 0;
  if (state.files.length) {
    setStatus("#uploadStatus", `${matched} missing manifest image(s) matched in the selected folder.${matched < missing.size ? ` ${missing.size - matched} still unmatched.` : ""}`);
  } else {
    setStatus("#uploadStatus", "");
  }
}

async function uploadImages() {
  const setId = state.detail.set.id;
  const selected = new Map(state.files.map((file) => [file.name.toLowerCase(), file]));
  const pending = state.detail.images.filter((item) => !item.uploaded && selected.has(item.filename.toLowerCase()));
  $("#uploadImagesButton").disabled = true;
  for (let index = 0; index < pending.length; index += 1) {
    const image = pending[index];
    setStatus("#uploadStatus", `Uploading ${index + 1}/${pending.length}: ${image.filename}`);
    $("#uploadProgress").value = Math.round((index / Math.max(pending.length, 1)) * 100);
    try {
      const response = await fetch(`/api/admin/sets/${setId}/images/${encodeURIComponent(image.image_id)}`, {
        method: "PUT",
        headers: { "content-type": "image/jpeg" },
        body: selected.get(image.filename.toLowerCase())
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`${image.filename}: ${data.error || `HTTP ${response.status}`}`);
    } catch (error) {
      setStatus("#uploadStatus", error.message, "error");
      await selectSet(setId);
      return;
    }
  }
  $("#uploadProgress").value = 100;
  setStatus("#uploadStatus", `${pending.length} JPEG image(s) uploaded.`, "success");
  state.files = [];
  $("#imageFiles").value = "";
  await loadSets(setId);
}

async function changeSetStatus(status) {
  setStatus("#uploadStatus", `${status === "active" ? "Activating" : "Deactivating"} set...`);
  try {
    await jsonRequest(`/api/admin/sets/${state.selectedSetId}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });
    await loadSets(state.selectedSetId);
  } catch (error) {
    setStatus("#uploadStatus", error.message, "error");
  }
}

async function createAssignments() {
  setStatus("#assignmentStatus", "Generating codes...");
  try {
    const data = await jsonRequest(`/api/admin/sets/${state.selectedSetId}/assignments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        count: Number($("#assignmentCount").value),
        expert_mode: $("#newAssignmentExpert").checked
      })
    });
    $("#generatedCodes").value = data.assignments.map((item) => item.code).join("\n");
    $("#codesDialog").showModal();
    await loadSets(state.selectedSetId);
  } catch (error) {
    setStatus("#assignmentStatus", error.message, "error");
  }
}

async function updateAssignment(id, changes) {
  try {
    await jsonRequest(`/api/admin/assignments/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(changes)
    });
    await selectSet(state.selectedSetId);
  } catch (error) {
    setStatus("#assignmentStatus", error.message, "error");
  }
}

function bindEvents() {
  $("#adminLoginButton").addEventListener("click", () => void login());
  $("#adminPassword").addEventListener("keydown", (event) => { if (event.key === "Enter") void login(); });
  $("#logoutButton").addEventListener("click", async () => { await jsonRequest("/api/auth/logout", { method: "POST" }); window.location.reload(); });
  $("#refreshButton").addEventListener("click", () => void loadSets());
  $("#newSetButton").addEventListener("click", () => { state.selectedSetId = null; renderSetList(); showView("#createSetView"); });
  $("#cancelCreateButton").addEventListener("click", () => showView(state.selectedSetId ? "#setDetailView" : "#emptyState"));
  $("#createSetForm").addEventListener("submit", (event) => void createSet(event));
  $("#imageFiles").addEventListener("change", (event) => { state.files = [...event.target.files].filter((file) => /\.jpe?g$/i.test(file.name)); updateUploadSelection(); });
  $("#uploadImagesButton").addEventListener("click", () => void uploadImages());
  $("#activateSetButton").addEventListener("click", () => void changeSetStatus("active"));
  $("#deactivateSetButton").addEventListener("click", () => void changeSetStatus("inactive"));
  $("#createAssignmentsButton").addEventListener("click", () => void createAssignments());
  $("#copyCodesButton").addEventListener("click", async () => { await navigator.clipboard.writeText($("#generatedCodes").value); $("#copyCodesButton").textContent = "Copied"; });
  $("#closeCodesButton").addEventListener("click", () => { $("#codesDialog").close(); $("#copyCodesButton").textContent = "Copy codes"; });
}

async function boot() {
  bindEvents();
  try {
    const auth = await jsonRequest("/api/auth/me");
    if (auth.authenticated && auth.role === "admin") await openAdmin();
  } catch {
    // The login form remains visible.
  }
}

void boot();
