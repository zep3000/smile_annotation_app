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
