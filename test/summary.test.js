const assert = require("node:assert/strict");
const test = require("node:test");
const {
  effectiveAnnotationStatus,
  summarizeAnnotations,
} = require("../src/shared/annotation-summary");

test("annotation summaries count completed work without double-counting identities", () => {
  const records = [
    {
      status: "complete",
      payload: {
        status: "complete",
        advertisements: [{
          people: [
            { face_bbox: [0, 0, 0.1, 0.1], duplicate_of_person_id: null },
            { face_bbox: [0.2, 0.2, 0.3, 0.3], duplicate_of_person_id: "p1" }
          ],
          groups: [{ group_id: "g1" }]
        }],
        timing: { total_focused_ms: 1250 }
      }
    },
    {
      status: "ineligible",
      payload: {
        status: "ineligible",
        page: { qualifying_ad_count: "0", no_qualifying_ad_reason: "no_ads_on_page" },
        advertisements: [],
        timing: { total_focused_ms: 750 }
      }
    },
    {
      status: "ineligible",
      payload: {
        status: "ineligible",
        page: { qualifying_ad_count: "0" },
        advertisements: [],
        timing: { total_focused_ms: 5000 }
      }
    },
    { status: "draft", payload: { status: "draft", advertisements: [{ people: [{}], groups: [] }] } }
  ];

  assert.deepEqual(summarizeAnnotations(records, 4), {
    pages_total: 4,
    pages_annotated: 2,
    qualifying_advertisements: 1,
    face_depictions_boxed: 2,
    unique_face_identities_boxed: 1,
    groups_annotated: 1,
    focused_time_ms: 2000
  });
});

test("legacy audience/crowd group type reopens completed annotations", () => {
  const annotation = {
    status: "complete",
    advertisements: [
      {
        groups: [{ group_type: "audience_or_crowd" }]
      }
    ]
  };
  assert.equal(effectiveAnnotationStatus(annotation), "draft");
});

test("completed annotation with unannotated boxed person is treated as draft", () => {
  const annotation = {
    status: "complete",
    flow_source: { flow_schema_version: "1.16" },
    page: { qualifying_ad_count: "1" },
    advertisements: [
      {
        depiction_type: "photo_of_person",
        face_depiction_count_band: "2",
        duplicate_faces_present: "no",
        people: [
          {
            person_id: "ad1_p1",
            face_bbox: [0, 0, 0.2, 0.2],
            duplicate_of_person_id: null,
            perceived_age: null,
            perceived_gender_presentation: null,
            face_expression_legibility: null,
            face_orientation: null,
            gaze_target: null,
            mouth_covered: null,
            mouth_covering: null,
            smile_present: null,
            smile_intensity: null
          },
          {
            person_id: "ad1_p2",
            face_bbox: [0.3, 0.3, 0.5, 0.5],
            duplicate_of_person_id: null,
            perceived_age: "middle_adult",
            perceived_gender_presentation: "masculine",
            face_expression_legibility: "0_not_legible",
            face_orientation: "frontal",
            mouth_covered: "no"
          }
        ],
        groups: []
      }
    ]
  };

  assert.equal(effectiveAnnotationStatus(annotation), "draft");
});

test("completed annotation with all boxed people annotated remains complete", () => {
  const completePerson = (personId, x) => ({
    person_id: personId,
    face_bbox: [x, 0, x + 0.1, 0.1],
    duplicate_of_person_id: null,
    perceived_age: "middle_adult",
    perceived_gender_presentation: "masculine",
    face_expression_legibility: "0_not_legible",
    face_orientation: "frontal",
    mouth_covered: "no"
  });
  const annotation = {
    status: "complete",
    flow_source: { flow_schema_version: "1.16" },
    page: { qualifying_ad_count: "1" },
    advertisements: [
      {
        depiction_type: "photo_of_person",
        face_depiction_count_band: "2",
        duplicate_faces_present: "no",
        people: [completePerson("ad1_p1", 0), completePerson("ad1_p2", 0.2)],
        groups: []
      }
    ]
  };

  assert.equal(effectiveAnnotationStatus(annotation), "complete");
});
