const DONE_STATUSES = new Set(["complete", "ineligible", "needs_review"]);

function annotationFromRecord(record) {
  return record?.payload || record?.annotation || record || null;
}

function finiteNonnegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function summarizeAnnotations(records, pageTotal = null) {
  const source = Array.isArray(records) ? records : [];
  const summary = {
    pages_total: Number.isInteger(pageTotal) && pageTotal >= 0 ? pageTotal : source.length,
    pages_annotated: 0,
    qualifying_advertisements: 0,
    face_depictions_boxed: 0,
    unique_face_identities_boxed: 0,
    groups_annotated: 0,
    focused_time_ms: 0
  };

  for (const record of source) {
    const annotation = annotationFromRecord(record);
    const status = record?.status || annotation?.status;
    if (!annotation || !DONE_STATUSES.has(status)) continue;
    summary.pages_annotated += 1;
    const advertisements = Array.isArray(annotation.advertisements) ? annotation.advertisements : [];
    summary.qualifying_advertisements += advertisements.length;
    for (const advertisement of advertisements) {
      const people = Array.isArray(advertisement.people) ? advertisement.people : [];
      const boxedPeople = people.filter((person) => Array.isArray(person?.face_bbox) && person.face_bbox.length === 4);
      summary.face_depictions_boxed += boxedPeople.length;
      summary.unique_face_identities_boxed += boxedPeople.filter((person) => !person.duplicate_of_person_id).length;
      summary.groups_annotated += Array.isArray(advertisement.groups) ? advertisement.groups.length : 0;
    }
    summary.focused_time_ms += finiteNonnegative(annotation.timing?.total_focused_ms);
  }

  return summary;
}

module.exports = { DONE_STATUSES, summarizeAnnotations };
