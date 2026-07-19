const EXPORT_SCHEMA_VERSION = "hosted_annotation_export_v1";

function annotationRecord(set, record) {
  return {
    export_schema_version: EXPORT_SCHEMA_VERSION,
    annotation_set_id: set.id,
    task_id: set.task_id,
    assignment_code: record.assignment_code,
    assignment_status: record.assignment_status,
    image_id: record.image_id,
    filename: record.filename,
    image_index: record.sort_order,
    annotation_status: record.status,
    revision: record.revision,
    server_created_at: record.created_at,
    server_updated_at: record.updated_at,
    server_completed_at: record.completed_at,
    annotation: record.payload
  };
}

function formatSetExport(exported, generatedAt = new Date().toISOString()) {
  const records = exported.records.filter((record) => record.payload);
  const jsonlRecords = records.map((record) => annotationRecord(exported.set, record));
  return {
    generatedAt,
    records,
    jsonl: `${jsonlRecords.map((record) => JSON.stringify(record)).join("\n")}${jsonlRecords.length ? "\n" : ""}`,
    json: JSON.stringify({
      export_schema_version: EXPORT_SCHEMA_VERSION,
      generated_at: generatedAt,
      annotation_set: exported.set,
      annotations: records
    }, null, 2)
  };
}

module.exports = { EXPORT_SCHEMA_VERSION, annotationRecord, formatSetExport };
