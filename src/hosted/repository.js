const crypto = require("node:crypto");
const { normalizeHostedManifest, safeObjectFilename } = require("./manifest");

const DONE_STATUSES = new Set(["complete", "ineligible", "needs_review"]);

function jsonValue(value) {
  return JSON.stringify(value ?? {});
}

function assignmentCode() {
  return String(crypto.randomInt(10_000_000, 100_000_000));
}

class HostedRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async createAuthSession({ tokenHash, role, expiresAt, ipAddress, userAgent }) {
    await this.pool.query("DELETE FROM auth_sessions WHERE expires_at <= now()");
    await this.pool.query(
      `INSERT INTO auth_sessions(token_hash, role, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [tokenHash, role, expiresAt, ipAddress || null, userAgent || null]
    );
  }

  async authSession(tokenHash) {
    const result = await this.pool.query(
      `SELECT s.token_hash, s.role, s.assignment_id, s.expires_at,
              a.code AS assignment_code, a.status AS assignment_status,
              a.expert_mode, a.annotation_set_id, aset.status AS set_status
       FROM auth_sessions s
       LEFT JOIN assignments a ON a.id = s.assignment_id
       LEFT JOIN annotation_sets aset ON aset.id = a.annotation_set_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [tokenHash]
    );
    if (!result.rows[0]) return null;
    await this.pool.query(
      "UPDATE auth_sessions SET last_seen_at = now() WHERE token_hash = $1",
      [tokenHash]
    );
    return result.rows[0];
  }

  async deleteAuthSession(tokenHash) {
    await this.pool.query("DELETE FROM auth_sessions WHERE token_hash = $1", [tokenHash]);
  }

  async attachAssignment(tokenHash, assignmentId) {
    await this.pool.query(
      "UPDATE auth_sessions SET assignment_id = $2, last_seen_at = now() WHERE token_hash = $1",
      [tokenHash, assignmentId]
    );
  }

  async audit({ role, assignmentId = null, setId = null, eventType, details = {}, ipAddress = null }) {
    await this.pool.query(
      `INSERT INTO audit_events(actor_role, assignment_id, annotation_set_id, event_type, details, ip_address)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [role, assignmentId, setId, eventType, jsonValue(details), ipAddress]
    );
  }

  async createSet({ name, manifest, flowVersion }) {
    const normalized = normalizeHostedManifest(manifest);
    const setId = crypto.randomUUID();
    const setName = String(name || "").trim() || normalized.task_id;
    const version = String(flowVersion || "").trim();
    if (!version) throw new Error("flow_version is required.");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO annotation_sets(id, name, task_id, flow_version, manifest)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [setId, setName, normalized.task_id, version, jsonValue(normalized)]
      );
      for (let index = 0; index < normalized.images.length; index += 1) {
        const image = normalized.images[index];
        const imageUuid = crypto.randomUUID();
        const objectKey = `sets/${setId}/images/${String(index + 1).padStart(5, "0")}_${safeObjectFilename(image.filename)}`;
        await client.query(
          `INSERT INTO images(
             id, annotation_set_id, image_id, filename, object_key, sort_order, page_type, metadata
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
          [imageUuid, setId, image.image_id, image.filename, objectKey, index, image.page_type, jsonValue(image.metadata)]
        );
      }
      await client.query("COMMIT");
      return this.getSet(setId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getSet(setId) {
    const result = await this.pool.query(
      `SELECT s.*,
              COALESCE(ic.image_count, 0)::integer AS image_count,
              COALESCE(ic.uploaded_count, 0)::integer AS uploaded_count
       FROM annotation_sets s
       LEFT JOIN (
         SELECT annotation_set_id, count(*) AS image_count,
                sum(CASE WHEN uploaded THEN 1 ELSE 0 END) AS uploaded_count
         FROM images GROUP BY annotation_set_id
       ) ic ON ic.annotation_set_id = s.id
       WHERE s.id = $1`,
      [setId]
    );
    return result.rows[0] || null;
  }

  async listSets() {
    const result = await this.pool.query(
      `SELECT s.id, s.name, s.task_id, s.status, s.flow_version, s.created_at,
              s.updated_at, s.activated_at,
              COALESCE(ic.image_count, 0)::integer AS image_count,
              COALESCE(ic.uploaded_count, 0)::integer AS uploaded_count,
              COALESCE(ac.assignment_count, 0)::integer AS assignment_count,
              COALESCE(ac.not_started_count, 0)::integer AS not_started_count,
              COALESCE(ac.started_count, 0)::integer AS started_count,
              COALESCE(ac.done_count, 0)::integer AS done_count
       FROM annotation_sets s
       LEFT JOIN (
         SELECT annotation_set_id, count(*) AS image_count,
                sum(CASE WHEN uploaded THEN 1 ELSE 0 END) AS uploaded_count
         FROM images GROUP BY annotation_set_id
       ) ic ON ic.annotation_set_id = s.id
       LEFT JOIN (
         SELECT annotation_set_id, count(*) AS assignment_count,
                sum(CASE WHEN status = 'not_started' THEN 1 ELSE 0 END) AS not_started_count,
                sum(CASE WHEN status = 'started' THEN 1 ELSE 0 END) AS started_count,
                sum(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done_count
         FROM assignments GROUP BY annotation_set_id
       ) ac ON ac.annotation_set_id = s.id
       ORDER BY s.created_at DESC`
    );
    return result.rows;
  }

  async setImages(setId) {
    const result = await this.pool.query(
      `SELECT id, image_id, filename, object_key, sort_order, page_type, metadata,
              uploaded, byte_size, sha256, uploaded_at
       FROM images WHERE annotation_set_id = $1 ORDER BY sort_order`,
      [setId]
    );
    return result.rows;
  }

  async setAssignments(setId) {
    const result = await this.pool.query(
      `SELECT a.id, a.code, a.status, a.expert_mode, a.current_image_order,
              a.created_at, a.started_at, a.completed_at, a.last_seen_at, a.revoked_at,
              COALESCE(nc.pages_started, 0)::integer AS pages_started,
              COALESCE(nc.pages_done, 0)::integer AS pages_done
       FROM assignments a
       LEFT JOIN (
         SELECT assignment_id, count(*) AS pages_started,
                sum(CASE WHEN status IN ('complete', 'ineligible', 'needs_review') THEN 1 ELSE 0 END) AS pages_done
         FROM annotations GROUP BY assignment_id
       ) nc ON nc.assignment_id = a.id
       WHERE a.annotation_set_id = $1
       ORDER BY a.created_at, a.code`,
      [setId]
    );
    return result.rows;
  }

  async imageForUpload(setId, imageId) {
    const result = await this.pool.query(
      `SELECT * FROM images WHERE annotation_set_id = $1 AND image_id = $2`,
      [setId, imageId]
    );
    return result.rows[0] || null;
  }

  async markImageUploaded(imageUuid, { byteSize, sha256 }) {
    const result = await this.pool.query(
      `UPDATE images SET uploaded = true, byte_size = $2, sha256 = $3, uploaded_at = now()
       WHERE id = $1 RETURNING *`,
      [imageUuid, byteSize, sha256]
    );
    return result.rows[0] || null;
  }

  async setStatus(setId, status) {
    if (!new Set(["active", "inactive"]).has(status)) {
      const error = new Error("Invalid set status.");
      error.statusCode = 400;
      throw error;
    }
    if (status === "active") {
      const pending = await this.pool.query(
        "SELECT count(*)::integer AS count FROM images WHERE annotation_set_id = $1 AND NOT uploaded",
        [setId]
      );
      if (pending.rows[0].count > 0) {
        throw new Error(`${pending.rows[0].count} JPEG image(s) are still missing.`);
      }
    }
    const result = await this.pool.query(
      `UPDATE annotation_sets
       SET status = $2, updated_at = now(), activated_at = CASE WHEN $2 = 'active' THEN COALESCE(activated_at, now()) ELSE activated_at END
       WHERE id = $1 RETURNING *`,
      [setId, status]
    );
    return result.rows[0] || null;
  }

  async issueAssignments(setId, count, expertMode) {
    const set = await this.getSet(setId);
    if (!set) {
      const error = new Error("Annotation set not found.");
      error.statusCode = 404;
      throw error;
    }
    const created = [];
    for (let index = 0; index < count; index += 1) {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const id = crypto.randomUUID();
        const code = assignmentCode();
        try {
          const result = await this.pool.query(
            `INSERT INTO assignments(id, annotation_set_id, code, expert_mode)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [id, setId, code, Boolean(expertMode)]
          );
          created.push(result.rows[0]);
          break;
        } catch (error) {
          if (error.code === "23505" && attempt < 99) continue;
          throw error;
        }
      }
    }
    return created;
  }

  async updateAssignment(assignmentId, updates) {
    const fields = [];
    const values = [assignmentId];
    if (typeof updates.expertMode === "boolean") {
      values.push(updates.expertMode);
      fields.push(`expert_mode = $${values.length}`);
    }
    if (updates.revoked === true) {
      fields.push("status = 'revoked'", "revoked_at = now()");
    }
    if (updates.revoked === false) {
      fields.push("status = CASE WHEN started_at IS NULL THEN 'not_started' WHEN completed_at IS NULL THEN 'started' ELSE 'done' END", "revoked_at = NULL");
    }
    if (!fields.length) {
      const error = new Error("No assignment update supplied.");
      error.statusCode = 400;
      throw error;
    }
    const result = await this.pool.query(
      `UPDATE assignments SET ${fields.join(", ")} WHERE id = $1 RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async openAssignment(code) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `SELECT a.*, s.name AS set_name, s.task_id, s.status AS set_status, s.flow_version
         FROM assignments a JOIN annotation_sets s ON s.id = a.annotation_set_id
         WHERE a.code = $1 FOR UPDATE`,
        [code]
      );
      const assignment = result.rows[0];
      if (!assignment) {
        const error = new Error("Assignment code not found.");
        error.statusCode = 404;
        throw error;
      }
      if (assignment.status === "revoked") {
        const error = new Error("This assignment code has been revoked.");
        error.statusCode = 403;
        throw error;
      }
      if (assignment.set_status !== "active") {
        const error = new Error("This annotation set is not currently active.");
        error.statusCode = 403;
        throw error;
      }
      await client.query(
        `UPDATE assignments
         SET status = CASE WHEN status = 'not_started' THEN 'started' ELSE status END,
             started_at = COALESCE(started_at, now()), last_seen_at = now()
         WHERE id = $1`,
        [assignment.id]
      );
      await client.query("COMMIT");
      return { ...assignment, status: assignment.status === "not_started" ? "started" : assignment.status };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async assignmentManifest(assignmentId) {
    const assignmentResult = await this.pool.query(
      `SELECT a.id, a.code, a.expert_mode, a.status, a.created_at, a.annotation_set_id,
              s.task_id, s.name AS set_name, s.flow_version, s.manifest->'metadata' AS metadata
       FROM assignments a
       JOIN annotation_sets s ON s.id = a.annotation_set_id
       WHERE a.id = $1 AND a.status <> 'revoked' AND s.status = 'active'`,
      [assignmentId]
    );
    const assignment = assignmentResult.rows[0];
    if (!assignment) return null;
    const images = await this.setImages(assignment.annotation_set_id);
    return {
      assignment,
      manifest: {
        task_id: assignment.task_id,
        manifest_path: null,
        metadata: assignment.metadata || {},
        images: images.map((image, index) => ({
          image_id: image.image_id,
          filename: image.filename,
          path: null,
          page_type: image.page_type,
          metadata: image.metadata || {},
          index,
          total: images.length
        }))
      }
    };
  }

  async assignmentProgress(assignmentId) {
    const result = await this.pool.query(
      `SELECT i.image_id, n.status, n.updated_at, n.completed_at AS finished_at, n.revision
       FROM assignments a
       JOIN images i ON i.annotation_set_id = a.annotation_set_id
       LEFT JOIN annotations n ON n.assignment_id = a.id AND n.image_id = i.id
       WHERE a.id = $1 ORDER BY i.sort_order`,
      [assignmentId]
    );
    return Object.fromEntries(result.rows.map((row) => [row.image_id, row.status ? {
      status: row.status,
      updated_at: row.updated_at,
      finished_at: row.finished_at,
      revision: row.revision
    } : null]));
  }

  async imageForAssignment(assignmentId, externalImageId) {
    const result = await this.pool.query(
      `SELECT i.* FROM assignments a
       JOIN images i ON i.annotation_set_id = a.annotation_set_id
       JOIN annotation_sets s ON s.id = a.annotation_set_id
       WHERE a.id = $1 AND i.image_id = $2 AND i.uploaded
         AND a.status <> 'revoked' AND s.status = 'active'`,
      [assignmentId, externalImageId]
    );
    return result.rows[0] || null;
  }

  async annotation(assignmentId, externalImageId) {
    const result = await this.pool.query(
      `SELECT n.payload, n.revision
       FROM assignments a
       JOIN images i ON i.annotation_set_id = a.annotation_set_id AND i.image_id = $2
       LEFT JOIN annotations n ON n.assignment_id = a.id AND n.image_id = i.id
       WHERE a.id = $1`,
      [assignmentId, externalImageId]
    );
    return result.rows[0] || null;
  }

  async saveAnnotation({ assignmentId, externalImageId, payload, expectedRevision }) {
    const status = String(payload?.status || "draft");
    if (!new Set(["draft", "complete", "ineligible", "needs_review"]).has(status)) {
      const error = new Error("Invalid annotation status.");
      error.statusCode = 400;
      throw error;
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const imageResult = await client.query(
        `SELECT i.id, i.sort_order, a.annotation_set_id, a.status AS assignment_status,
                s.status AS set_status
         FROM assignments a
         JOIN images i ON i.annotation_set_id = a.annotation_set_id
         JOIN annotation_sets s ON s.id = a.annotation_set_id
         WHERE a.id = $1 AND i.image_id = $2 FOR UPDATE`,
        [assignmentId, externalImageId]
      );
      const image = imageResult.rows[0];
      if (!image) {
        const error = new Error("Image is not part of this assignment.");
        error.statusCode = 404;
        throw error;
      }
      if (image.assignment_status === "revoked") {
        const error = new Error("This assignment has been revoked.");
        error.statusCode = 403;
        throw error;
      }
      if (image.set_status !== "active") {
        const error = new Error("This annotation set is not currently active.");
        error.statusCode = 403;
        throw error;
      }
      const currentResult = await client.query(
        "SELECT revision FROM annotations WHERE assignment_id = $1 AND image_id = $2 FOR UPDATE",
        [assignmentId, image.id]
      );
      const currentRevision = currentResult.rows[0]?.revision || 0;
      if (Number(expectedRevision || 0) !== currentRevision) {
        const conflict = new Error("This page was changed in another browser or tab. Reload it before saving again.");
        conflict.statusCode = 409;
        conflict.code = "revision_conflict";
        conflict.currentRevision = currentRevision;
        throw conflict;
      }
      const nextRevision = currentRevision + 1;
      const now = new Date().toISOString();
      const storedPayload = { ...payload, server_saved_at: now };
      await client.query(
        `INSERT INTO annotations(assignment_id, image_id, status, payload, revision, completed_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, CASE WHEN $3 = 'draft' THEN NULL ELSE now() END)
         ON CONFLICT (assignment_id, image_id) DO UPDATE SET
           status = EXCLUDED.status,
           payload = EXCLUDED.payload,
           revision = EXCLUDED.revision,
           updated_at = now(),
           completed_at = CASE WHEN EXCLUDED.status = 'draft' THEN NULL ELSE COALESCE(annotations.completed_at, now()) END`,
        [assignmentId, image.id, status, jsonValue(storedPayload), nextRevision]
      );
      const counts = await client.query(
        `SELECT count(i.id)::integer AS total,
                count(n.image_id) FILTER (WHERE n.status IN ('complete', 'ineligible', 'needs_review'))::integer AS done
         FROM images i
         LEFT JOIN annotations n ON n.image_id = i.id AND n.assignment_id = $1
         WHERE i.annotation_set_id = $2`,
        [assignmentId, image.annotation_set_id]
      );
      const allDone = counts.rows[0].total > 0 && counts.rows[0].done === counts.rows[0].total;
      await client.query(
        `UPDATE assignments SET
           status = CASE WHEN status = 'revoked' THEN status WHEN $3 THEN 'done' ELSE 'started' END,
           current_image_order = GREATEST(current_image_order, $2),
           last_seen_at = now(),
           completed_at = CASE WHEN $3 THEN COALESCE(completed_at, now()) ELSE NULL END
         WHERE id = $1`,
        [assignmentId, image.sort_order, allDone]
      );
      await client.query("COMMIT");
      return { annotation: storedPayload, revision: nextRevision, allDone };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async exportSet(setId) {
    const set = await this.getSet(setId);
    if (!set) return null;
    const result = await this.pool.query(
      `SELECT a.code AS assignment_code, a.status AS assignment_status,
              i.image_id, i.filename, i.sort_order, n.status, n.revision,
              n.created_at, n.updated_at, n.completed_at, n.payload
       FROM assignments a
       JOIN images i ON i.annotation_set_id = a.annotation_set_id
       LEFT JOIN annotations n ON n.assignment_id = a.id AND n.image_id = i.id
       WHERE a.annotation_set_id = $1
       ORDER BY a.code, i.sort_order`,
      [setId]
    );
    return { set, records: result.rows };
  }

  async auditEvents(setId, limit = 500) {
    const result = await this.pool.query(
      `SELECT id, actor_role, assignment_id, annotation_set_id, event_type, details, ip_address, created_at
       FROM audit_events WHERE annotation_set_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [setId, limit]
    );
    return result.rows;
  }
}

module.exports = { DONE_STATUSES, HostedRepository };
