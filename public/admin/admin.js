const state = {
  sets: [],
  selectedSetId: null,
  detail: null,
  files: [],
  copySourceDetail: null,
  copyTargetDetail: null,
};
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

function summarizeFilenames(images) {
  const names = images.map((item) => item.filename);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
}

function formatVerificationReport(report) {
  const lines = [
    `Checked ${report.total} manifest image(s).`,
    `OK: ${report.ok}`,
    `Problems: ${report.problems}`,
    `Warnings: ${report.warnings}`
  ];
  const notable = (report.results || []).filter((item) => item.problems?.length || item.warnings?.length);
  if (notable.length) {
    lines.push("", "Images needing attention:");
    for (const item of notable.slice(0, 80)) {
      const issues = [...(item.problems || []), ...(item.warnings || [])].join("; ");
      lines.push(`- ${item.filename}: ${issues}`);
    }
    if (notable.length > 80) lines.push(`- ... ${notable.length - 80} more`);
  }
  return lines.join("\n");
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
  const missingImages = images.filter((item) => !item.uploaded);
  $("#setTitle").textContent = set.name;
  $("#setSubtitle").textContent = `${set.task_id} | flow ${set.flow_version}`;
  $("#setStatusBadge").textContent = set.status;
  $("#setStatusBadge").className = `status-badge ${set.status}`;
  $("#imageMetric").textContent = `${set.uploaded_count}/${set.image_count}`;
  $("#assignmentMetric").textContent = assignments.length;
  $("#startedMetric").textContent = assignments.filter((item) => item.status === "started").length;
  $("#doneMetric").textContent = assignments.filter((item) => item.status === "done").length;
  $("#uploadSummary").textContent = missingImages.length
    ? `${set.uploaded_count} of ${set.image_count} manifest images are stored. Missing: ${summarizeFilenames(missingImages)}.`
    : `All ${set.image_count} manifest images are stored.`;
  $("#activateSetButton").disabled = set.status === "active" || set.uploaded_count !== set.image_count;
  $("#deactivateSetButton").disabled = set.status !== "active";
  $("#deleteSetButton").disabled = assignments.length !== 0;
  $("#deleteSetButton").title = assignments.length
    ? "Only sets with zero assignments can be deleted."
    : "Delete this set and its manifest image rows.";
  setStatus("#setActionStatus", "");
  $("#createAssignmentsButton").disabled = set.status === "inactive";
  $("#jsonlExportLink").href = `/api/admin/sets/${set.id}/export.jsonl`;
  $("#jsonExportLink").href = `/api/admin/sets/${set.id}/export.json`;
  $("#verifyImagesReport").classList.add("hidden");
  $("#verifyImagesReport").textContent = "";
  renderAssignments(assignments, set.image_count);
  renderCopyControls();
  renderAudit(events);
  updateUploadSelection();
}

function assignmentOptionLabel(assignment) {
  const name = String(assignment.assignee_name || "").trim();
  return `${assignment.code}${name ? ` | ${name}` : ""} | ${assignment.status.replaceAll("_", " ")} | ${assignment.pages_started} opened, ${assignment.pages_done} done`;
}

function fillSelect(select, options, placeholder) {
  select.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = placeholder;
  select.appendChild(empty);
  for (const option of options) {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    select.appendChild(item);
  }
}

function renderCopyControls() {
  if (!state.detail) return;
  if (!state.copyTargetDetail) state.copyTargetDetail = state.detail;
  fillSelect(
    $("#copySourceSet"),
    state.sets.map((set) => ({
      value: set.id,
      label: `${set.name} | ${set.task_id}`
    })),
    "Choose source set"
  );
  if (state.copySourceDetail?.set?.id) {
    $("#copySourceSet").value = state.copySourceDetail.set.id;
  }
  fillSelect(
    $("#copyTargetSet"),
    state.sets.map((set) => ({
      value: set.id,
      label: `${set.name} | ${set.task_id}`
    })),
    "Choose target set"
  );
  $("#copyTargetSet").value = state.copyTargetDetail?.set?.id || state.detail.set.id;
  renderCopyAssignmentControls();
}

function renderCopyAssignmentControls() {
  const sourceAssignments = state.copySourceDetail?.assignments || [];
  const targetAssignments = state.copyTargetDetail?.assignments || [];
  fillSelect(
    $("#copySourceAssignment"),
    sourceAssignments
      .filter((assignment) => assignment.pages_started > 0)
      .map((assignment) => ({
        value: assignment.id,
        label: assignmentOptionLabel(assignment)
      })),
    sourceAssignments.length ? "Choose source assignment" : "Choose source set first"
  );
  fillSelect(
    $("#copyTargetAssignment"),
    targetAssignments.map((assignment) => ({
      value: assignment.id,
      label: assignmentOptionLabel(assignment)
    })),
    targetAssignments.length ? "Choose target assignment" : "No target assignments"
  );
  updateCopyButton();
}

function updateCopyButton() {
  const sourceSetId = $("#copySourceSet").value;
  const targetSetId = $("#copyTargetSet").value;
  const sourceAssignmentId = $("#copySourceAssignment").value;
  const targetAssignmentId = $("#copyTargetAssignment").value;
  const canCopy = Boolean(
    sourceSetId &&
      targetSetId &&
      sourceSetId !== targetSetId &&
      sourceAssignmentId &&
      targetAssignmentId &&
      sourceAssignmentId !== targetAssignmentId
  );
  $("#copyAnnotationsButton").disabled = !canCopy;
}

function renderAssignments(assignments, imageCount) {
  const rows = $("#assignmentRows");
  rows.innerHTML = "";
  if (!assignments.length) {
    rows.innerHTML = '<tr><td colspan="8">No assignment codes generated.</td></tr>';
    return;
  }
  for (const assignment of assignments) {
    const row = document.createElement("tr");
    const revoked = assignment.status === "revoked";
    row.innerHTML = `
      <td><code>${escapeHtml(assignment.code)}</code></td>
      <td><input class="assignee-input" type="text" maxlength="120" value="${escapeHtml(assignment.assignee_name || "")}" placeholder="Name" data-assignee-id="${assignment.id}"></td>
      <td>${escapeHtml(assignment.status.replaceAll("_", " "))}</td>
      <td>${assignment.pages_done}/${imageCount} done, ${assignment.pages_started} opened</td>
      <td>${escapeHtml(formatDate(assignment.last_seen_at || assignment.started_at))}</td>
      <td><input class="inline-checkbox" type="checkbox" data-expert-id="${assignment.id}" ${assignment.expert_mode ? "checked" : ""} ${revoked ? "disabled" : ""}></td>
      <td>
        <a href="/api/admin/assignments/${encodeURIComponent(assignment.id)}/export.jsonl">JSONL</a>
        <span aria-hidden="true"> / </span>
        <a href="/api/admin/assignments/${encodeURIComponent(assignment.id)}/export.json">JSON</a>
      </td>
      <td><button type="button" data-revoke-id="${assignment.id}" data-revoked="${revoked}">${revoked ? "Restore" : "Revoke"}</button></td>
    `;
    rows.appendChild(row);
  }
  rows.querySelectorAll("[data-expert-id]").forEach((input) => {
    input.addEventListener("change", () => void updateAssignment(input.dataset.expertId, { expert_mode: input.checked }));
  });
  rows.querySelectorAll("[data-assignee-id]").forEach((input) => {
    input.addEventListener("change", () => void updateAssignment(input.dataset.assigneeId, { assignee_name: input.value }));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") input.blur();
    });
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
    $("#flowVersion").value = "1.15";
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
  let uploaded = 0;
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
      uploaded += 1;
      $("#uploadProgress").value = Math.round((uploaded / Math.max(pending.length, 1)) * 100);
    } catch (error) {
      await selectSet(setId);
      setStatus("#uploadStatus", `${error.message} Select the folder and retry; files already stored will be skipped.`, "error");
      return;
    }
  }
  await loadSets(setId);
  const remaining = state.detail.images.filter((item) => !item.uploaded);
  state.files = [];
  $("#imageFiles").value = "";
  $("#uploadImagesButton").disabled = true;
  if (remaining.length) {
    setStatus(
      "#uploadStatus",
      `${uploaded} JPEG image(s) uploaded. Still missing: ${summarizeFilenames(remaining)}. Select the folder and upload again.`,
      "error"
    );
  } else {
    setStatus("#uploadStatus", `${uploaded} JPEG image(s) uploaded. The set is complete.`, "success");
  }
}

async function verifyImages() {
  if (!state.detail) return;
  const setId = state.detail.set.id;
  const report = $("#verifyImagesReport");
  $("#verifyImagesButton").disabled = true;
  report.classList.remove("hidden");
  report.textContent = "Verifying stored images...";
  setStatus("#uploadStatus", "Verifying stored images. This can take a while for large sets...");
  try {
    const data = await jsonRequest(`/api/admin/sets/${setId}/verify-images`, { method: "POST" });
    report.textContent = formatVerificationReport(data.report);
    const hasProblems = Number(data.report.problems || 0) > 0;
    const hasWarnings = Number(data.report.warnings || 0) > 0;
    setStatus(
      "#uploadStatus",
      hasProblems
        ? "Verification found image problems. Review the report below."
        : hasWarnings
          ? "Verification passed, with warnings. Review the report below."
          : "Verification passed. All stored images look consistent.",
      hasProblems ? "error" : "success"
    );
  } catch (error) {
    report.textContent = "";
    report.classList.add("hidden");
    setStatus("#uploadStatus", error.message, "error");
  } finally {
    $("#verifyImagesButton").disabled = false;
  }
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

async function deleteSelectedSet() {
  if (!state.detail) return;
  const { set, assignments } = state.detail;
  if (assignments.length) {
    setStatus("#setActionStatus", "Only sets with zero assignments can be deleted.", "error");
    return;
  }
  const confirmed = window.confirm(`Delete annotation set "${set.name}" (${set.task_id})? This removes the set and its manifest image rows.`);
  if (!confirmed) return;
  $("#deleteSetButton").disabled = true;
  setStatus("#setActionStatus", "Deleting set...");
  try {
    await jsonRequest(`/api/admin/sets/${set.id}`, { method: "DELETE" });
    const data = await jsonRequest("/api/admin/sets");
    state.sets = data.sets;
    state.selectedSetId = null;
    state.detail = null;
    renderSetList();
    if (state.sets.length) {
      await selectSet(state.sets[0].id);
    } else {
      showView("#emptyState");
    }
  } catch (error) {
    setStatus("#setActionStatus", error.message, "error");
    renderDetail();
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

async function loadCopySourceSet(setId) {
  state.copySourceDetail = null;
  renderCopyAssignmentControls();
  if (!setId) return;
  setStatus("#copyAnnotationsStatus", "Loading source assignments...");
  try {
    const data = await jsonRequest(`/api/admin/sets/${setId}`);
    state.copySourceDetail = data;
    renderCopyAssignmentControls();
    setStatus("#copyAnnotationsStatus", "");
  } catch (error) {
    setStatus("#copyAnnotationsStatus", error.message, "error");
  }
}

async function loadCopyTargetSet(setId) {
  state.copyTargetDetail = null;
  renderCopyAssignmentControls();
  if (!setId) return;
  setStatus("#copyAnnotationsStatus", "Loading target assignments...");
  try {
    const data = await jsonRequest(`/api/admin/sets/${setId}`);
    state.copyTargetDetail = data;
    renderCopyAssignmentControls();
    setStatus("#copyAnnotationsStatus", "");
  } catch (error) {
    setStatus("#copyAnnotationsStatus", error.message, "error");
  }
}

async function copyAnnotations() {
  const sourceAssignmentId = $("#copySourceAssignment").value;
  const targetAssignmentId = $("#copyTargetAssignment").value;
  const targetSetId = $("#copyTargetSet").value;
  if (!sourceAssignmentId || !targetAssignmentId) return;
  $("#copyAnnotationsButton").disabled = true;
  setStatus("#copyAnnotationsStatus", "Copying missing page annotations...");
  try {
    const data = await jsonRequest(`/api/admin/sets/${targetSetId}/copy-annotations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source_assignment_id: sourceAssignmentId,
        target_assignment_id: targetAssignmentId
      })
    });
    const result = data.result;
    await loadSets(state.selectedSetId);
    if (targetSetId !== state.selectedSetId) await loadCopyTargetSet(targetSetId);
    setStatus(
      "#copyAnnotationsStatus",
      `Copied ${result.copied} page(s). Skipped ${result.skipped_existing} already started page(s) and ${result.skipped_no_match} page(s) without source match.`,
      "success"
    );
  } catch (error) {
    setStatus("#copyAnnotationsStatus", error.message, "error");
    updateCopyButton();
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
  $("#verifyImagesButton").addEventListener("click", () => void verifyImages());
  $("#activateSetButton").addEventListener("click", () => void changeSetStatus("active"));
  $("#deactivateSetButton").addEventListener("click", () => void changeSetStatus("inactive"));
  $("#deleteSetButton").addEventListener("click", () => void deleteSelectedSet());
  $("#createAssignmentsButton").addEventListener("click", () => void createAssignments());
  $("#copySourceSet").addEventListener("change", (event) => void loadCopySourceSet(event.target.value));
  $("#copySourceAssignment").addEventListener("change", updateCopyButton);
  $("#copyTargetSet").addEventListener("change", (event) => void loadCopyTargetSet(event.target.value));
  $("#copyTargetAssignment").addEventListener("change", updateCopyButton);
  $("#copyAnnotationsButton").addEventListener("click", () => void copyAnnotations());
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
