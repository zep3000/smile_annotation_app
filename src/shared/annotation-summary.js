const DONE_STATUSES = new Set(["complete", "ineligible", "needs_review"]);

function annotationFromRecord(record) {
  return record?.payload || record?.annotation || record || null;
}

function missingNoQualifyingAdReason(annotation) {
  return Boolean(
    annotation &&
      String(annotation.page?.qualifying_ad_count) === "0" &&
      !annotation.page?.no_qualifying_ad_reason,
  );
}

function hasLegacyAudienceCrowdGroupType(annotation) {
  return Boolean(
    annotation?.advertisements?.some((advertisement) =>
      advertisement?.groups?.some(
        (group) => group?.group_type === "audience_or_crowd",
      ),
    ),
  );
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function hasField(object, field) {
  return Object.prototype.hasOwnProperty.call(object || {}, field);
}

function presentFieldIsMissing(object, field) {
  return hasField(object, field) && !hasValue(object[field]);
}

function boxedPeople(advertisement) {
  return Array.isArray(advertisement?.people)
    ? advertisement.people.filter(
        (person) =>
          Array.isArray(person?.face_bbox) &&
          person.face_bbox.length === 4 &&
          !person.duplicate_of_person_id,
      )
    : [];
}

function visibleGroups(advertisement) {
  return Array.isArray(advertisement?.groups)
    ? advertisement.groups.filter(
        (group) => Array.isArray(group?.bbox) && group.bbox.length === 4,
      )
    : [];
}

function personHasIncompleteRequiredFields(person, advertisement) {
  if (
    advertisement?.depiction_type === "multiple_types_present" &&
    presentFieldIsMissing(person, "depiction_type")
  ) {
    return true;
  }
  if (presentFieldIsMissing(person, "perceived_age")) return true;
  if (presentFieldIsMissing(person, "perceived_gender_presentation")) return true;
  if (presentFieldIsMissing(person, "face_expression_legibility")) return true;
  if (presentFieldIsMissing(person, "face_orientation")) return true;
  const expressionLegible = person.face_expression_legibility !== "0_not_legible";
  if (expressionLegible) {
    if (presentFieldIsMissing(person, "gaze_target")) return true;
    if (
      person.gaze_target === "another_person" &&
      !hasValue(person.gaze_target_person_id) &&
      person.gaze_target_person_unboxed !== true
    ) {
      return true;
    }
  }
  if (presentFieldIsMissing(person, "mouth_covered")) return true;
  if (person.mouth_covered === "yes" || person.mouth_covered === "partly") {
    if (presentFieldIsMissing(person, "mouth_covering")) return true;
    if (person.mouth_covering === "other" && !hasText(person.mouth_covering_other_text)) {
      return true;
    }
  }
  if (expressionLegible) {
    if (presentFieldIsMissing(person, "smile_present")) return true;
    if (person.smile_present === "yes" && presentFieldIsMissing(person, "smile_intensity")) return true;
  }
  return false;
}

function groupHasIncompleteRequiredFields(group) {
  if (presentFieldIsMissing(group, "group_type")) return true;
  if (presentFieldIsMissing(group, "age_composition")) return true;
  if (presentFieldIsMissing(group, "gender_presentation_composition")) return true;
  if (presentFieldIsMissing(group, "expression_legibility_distribution")) return true;
  if (group.expression_legibility_distribution === "all_0_not_legible") return false;
  if (presentFieldIsMissing(group, "dominant_gaze")) return true;
  if (presentFieldIsMissing(group, "smile_prevalence")) return true;
  if (
    group.smile_prevalence !== "none" &&
    group.smile_prevalence !== "not_assessable" &&
    presentFieldIsMissing(group, "dominant_smile_intensity")
  ) {
    return true;
  }
  return false;
}

function hasIncompleteRequiredAnnotations(annotation) {
  if (!annotation || typeof annotation !== "object") return false;
  const status = annotation.status || null;
  if (!DONE_STATUSES.has(status)) return false;
  if (!annotation.flow_source) return false;
  const page = annotation.page || {};
  if (String(page.qualifying_ad_count) === "0") {
    return !hasValue(page.no_qualifying_ad_reason);
  }
  if (presentFieldIsMissing(page, "qualifying_ad_count")) return true;
  const advertisements = Array.isArray(annotation.advertisements)
    ? annotation.advertisements
    : [];
  if (
    hasField(page, "qualifying_ad_count") &&
    advertisements.length < Number(page.qualifying_ad_count || 0)
  ) {
    return true;
  }
  for (const advertisement of advertisements) {
    if (presentFieldIsMissing(advertisement, "depiction_type")) return true;
    if (presentFieldIsMissing(advertisement, "face_depiction_count_band")) return true;
    const people = boxedPeople(advertisement);
    const groups = visibleGroups(advertisement);
    if (hasField(advertisement, "face_depiction_count_band")) {
      if (
        advertisement.face_depiction_count_band === "10_20" ||
        advertisement.face_depiction_count_band === "20_plus"
      ) {
        if (presentFieldIsMissing(advertisement, "has_outstanding_individuals")) return true;
        if (!groups.length) return true;
      } else if (!people.length) {
        return true;
      }
    }
    if (
      people.length >= 2 &&
      presentFieldIsMissing(advertisement, "duplicate_faces_present")
    ) {
      return true;
    }
    if (
      advertisement.duplicate_faces_present === "yes" &&
      presentFieldIsMissing(advertisement, "unique_face_count")
    ) {
      return true;
    }
    if (people.some((person) => personHasIncompleteRequiredFields(person, advertisement))) return true;
    if (groups.some(groupHasIncompleteRequiredFields)) return true;
  }
  return false;
}

function effectiveAnnotationStatus(record) {
  const annotation = annotationFromRecord(record);
  const status = record?.status || annotation?.status || null;
  return missingNoQualifyingAdReason(annotation) ||
    hasLegacyAudienceCrowdGroupType(annotation) ||
    hasIncompleteRequiredAnnotations(annotation)
    ? "draft"
    : status;
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
    const status = effectiveAnnotationStatus(record);
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

module.exports = {
  DONE_STATUSES,
  effectiveAnnotationStatus,
  hasIncompleteRequiredAnnotations,
  hasLegacyAudienceCrowdGroupType,
  missingNoQualifyingAdReason,
  summarizeAnnotations,
};
