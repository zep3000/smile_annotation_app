const ENUMS = {
  yes_no: ["yes", "no"],
  depiction_type: [
    "photo_of_person",
    "naturalistic_illustration",
    "stylized_illustration",
    "cartoon_or_caricature",
    "generic_human_figure",
    "photo_of_artwork_or_statue",
    "drawing_of_statue_monument_or_public_symbol",
    "mask_mannequin_doll_or_puppet",
    "personified_object",
    "nonhuman_creature_with_face",
    "schematic_icon_or_logo_face",
    "multiple_types_present"
  ],
  individual_age: ["infant", "child", "adolescent", "young_adult", "middle_adult", "older_adult", "not_assessable"],
  gender_presentation: ["feminine", "masculine", "ambiguous_or_androgynous", "not_assessable"],
  face_orientation: ["beyond_profile", "profile", "three_quarter", "frontal", "tilted_down", "tilted_up", "not_assessable"],
  face_expression_legibility: ["0_not_legible", "1_low_legibility", "2_moderate_legibility", "3_high_legibility"],
  gaze_target: ["viewer_camera", "another_person", "advertised_product", "other_object", "off_frame_or_scene_direction", "eyes_covered", "closed_eyes", "not_assessable"],
  mouth_covered: ["no", "yes", "partly", "not_assessable"],
  mouth_covering: ["hand", "beard", "other_body_part", "part_of_another_person", "object", "object_in_mouth", "text_or_graphic_overlay", "other", "not_assessable"],
  smile_presence: ["yes", "no", "not_assessable"],
  smile_intensity: ["1_slight", "2_clear", "3_broad", "4_laughter_like"],
  group_type: ["interacting_group", "posed_group", "audience_or_crowd", "background_population", "separate_portraits_or_composite"],
  group_age_composition: ["young_only", "middle_only", "older_only", "mostly_young", "mostly_middle", "mostly_older", "mixed", "not_assessable"],
  group_gender_composition: ["feminine_only", "masculine_only", "mostly_feminine", "mostly_masculine", "mixed", "ambiguous_or_androgynous_present", "not_assessable"],
  group_expression_legibility: [
    "all_0_not_legible",
    "mostly_0_not_legible",
    "all_1_low_legibility",
    "mostly_1_low_legibility",
    "all_2_moderate_legibility",
    "mostly_2_moderate_legibility",
    "all_3_high_legibility",
    "mostly_3_high_legibility",
    "mixed_legibility"
  ],
  group_gaze: ["toward_viewer_camera", "toward_each_other", "toward_object", "off_frame_or_scene_direction", "mixed", "not_assessable"],
  group_smile_prevalence: ["none", "minority", "about_half", "majority", "all", "not_assessable"],
  group_smile_intensity: ["slight", "clear", "broad_or_laughter_like", "mixed"]
};

const PERSON_DEPICTION_TYPES = ENUMS.depiction_type.filter((value) => value !== "multiple_types_present");
const CROWD_FACE_BAND_VALUES = ["10_20", "20_plus"];
const CROWD_FACE_BANDS = new Set(CROWD_FACE_BAND_VALUES);

const STEP_META_EN = {
  P1_qualifying_ad_count: {
    unit: "Page",
    prompt: "How many advertisements on this page contain at least one eligible face depiction?",
    instruction: "Choose 0-5 directly, or enter a higher exact count.",
    help: "Count advertisements, not faces. A depiction is eligible when more than an ear or back of a head is visible and a face can be located. Human, illustrated, sculpted, personified, nonhuman, and schematic faces are included."
  },
  P2_single_ad_full_page: {
    unit: "Advertisement",
    prompt: "Is the single qualifying advertisement full-page?",
    instruction: "If it fills the usable page, no ad box is needed.",
    help: "Full-page means the qualifying advertisement occupies the page as the main unit. If other page content is present, choose partial page."
  },
  A1_ad_bbox: {
    unit: "Advertisement",
    prompt: "Draw the complete advertisement bounding box.",
    instruction: "Draw or adjust one box around the full advertisement.",
    help: "Include the visual and text belonging to the ad. Exclude neighboring editorial content or other advertisements."
  },
  DRAW_AD_BOXES: {
    unit: "Advertisement",
    prompt: "Draw one box for each qualifying advertisement.",
    instruction: "Draw all qualifying ad boxes, then choose Next.",
    help: "Use this when multiple qualifying ads are present. Each box should include one full advertisement."
  },
  A2_ad_depiction_type: {
    unit: "Advertisement",
    prompt: "How are the eligible faces in this advertisement depicted?",
    instruction: "Choose one shared type, or Multiple types present.",
    help: "Choose a single type only when it applies to every individually coded face in this advertisement. If more than one type occurs within this advertisement, choose Multiple types present; each coded person in this advertisement will then receive a depiction type."
  },
  A3_unique_person_count: {
    unit: "Advertisement",
    prompt: "Draw a box around every eligible face depiction.",
    instruction: "Keep Only individuals selected and draw 1-9 boxes, or choose 10-20 or 20+ for a crowd.",
    help: "For one to nine faces, leave Only individuals selected, draw every face, and choose Done only after all boxes are drawn. The exact count is recorded automatically. Include mirrors and repetitions. Use the smallest box that covers all visible face and head features needed for coding, including visible hair, ears, chin, beard or moustache, and face-worn items such as glasses. Do not include neck, shoulders, captions, or empty background unless they visibly cover or cut across the face. If you switch to a crowd band after drawing, provisional individual boxes are removed. You can switch back to Only individuals before continuing."
  },
  C1_outstanding_present: {
    unit: "Crowd",
    prompt: "Are there outstanding individuals that should be annotated separately?",
    instruction: "Choose yes only for visually prominent individuals inside a larger crowd.",
    help: "Outstanding individuals are central, large, singled out, or otherwise analytically important. They will receive full individual coding before group coding."
  },
  DRAW_OUTSTANDING_INDIVIDUAL_BOXES: {
    unit: "People",
    prompt: "Draw outstanding individual face boxes.",
    instruction: "Draw every outstanding face box before choosing Done.",
    help: "Use this only for individuals who should be coded separately from the remaining crowd or group. Use the smallest box that covers all visible face and head features needed for coding, including visible hair, ears, chin, beard or moustache, and face-worn items such as glasses."
  },
  DRAW_GROUP_BOXES: {
    unit: "Groups",
    prompt: "Draw one box for each visually distinct remaining group.",
    instruction: "Each group box should include all faces in that group.",
    help: "Use group boxes for crowds or many small faces where individual annotation would be slow or unreliable."
  },
  G1_group_type: {
    unit: "Group",
    prompt: "Choose the group type.",
    instruction: "",
    help: "Code the dominant visual organization of the boxed group."
  },
  G2_group_age: {
    unit: "Group",
    prompt: "Choose the group's apparent age composition.",
    instruction: "",
    help: "Code broad perceived age composition only from visible evidence."
  },
  G3_group_gender: {
    unit: "Group",
    prompt: "Choose the group's perceived gender-presentation composition.",
    instruction: "",
    help: "Code presentation, not identity. Use not assessable only when the necessary visual evidence is unavailable."
  },
  G4_group_expression_legibility: {
    unit: "Group",
    prompt: "How legible are facial expressions in this group?",
    instruction: "Choose the closest distribution across the grouped faces.",
    help: "Score the overall expression-coding legibility across the group. Low, moderate, or high legibility can result from any combination of limited facial detail, covering or occlusion, face orientation, small face size, blur, low contrast, or poor image/reproduction quality. Choose mixed when no single level or mostly-level describes the group well. If no grouped faces are legible, gaze and smile questions are skipped."
  },
  G5_group_gaze: {
    unit: "Group",
    prompt: "Choose the group's dominant gaze pattern.",
    instruction: "",
    help: "Code the dominant visible gaze pattern among assessable faces."
  },
  G6_group_smile: {
    unit: "Group",
    prompt: "How prevalent is visible smiling among assessable group members?",
    instruction: "",
    help: "Estimate prevalence among group members whose mouths/faces are visible enough to assess."
  },
  G7_group_smile_intensity: {
    unit: "Group",
    prompt: "What smile intensity predominates among smiling group members?",
    instruction: "",
    help: "Code only among those visibly smiling. Use mixed if no single intensity predominates."
  },
  D0_duplicates_present: {
    unit: "Page",
    prompt: "Do any individually boxed faces repeat the same face identity?",
    instruction: "Consider mirrors, repeated portraits, and collage repetitions.",
    help: "Answer once for all individually boxed faces on this page. Similar-looking faces are not duplicates unless they clearly repeat the same person, character, object, or represented identity."
  },
  D1_unique_face_count: {
    unit: "Page",
    prompt: "How many unique face identities are represented by the boxes?",
    instruction: "Count each repeated identity once.",
    help: "This number must be smaller than the number of drawn face boxes because at least one person is repeated."
  },
  D2_select_main: {
    unit: "Duplicate grouping",
    prompt: "Select the main face for this identity.",
    instruction: "Click the clearest or most analytically useful face box.",
    help: "The main face receives the detailed person annotation. Its repeated depictions remain stored as linked boxes."
  },
  D3_select_duplicates: {
    unit: "Duplicate grouping",
    prompt: "Select every duplicate of this main face.",
    instruction: "Click matching boxes to select or deselect them, then choose Next.",
    help: "Leave unrelated faces unselected. An identity group may have no duplicates when another group accounts for the repeated face on the page."
  },
  I0_person_depiction_type: {
    unit: "Person",
    prompt: "How is this person depicted?",
    instruction: "Choose the best-fitting depiction type.",
    help: "This question appears per person only because Multiple types present was selected for this advertisement."
  },
  I1_age: {
    unit: "Person",
    prompt: "Choose this person's perceived age band.",
    instruction: "",
    help: "Use broad apparent age from visible evidence. Choose not assessable when the face/body evidence is insufficient."
  },
  I2_gender: {
    unit: "Person",
    prompt: "Choose this person's perceived gender presentation.",
    instruction: "",
    help: "Code presentation, not identity. Use ambiguous/androgynous only when that is the visible presentation."
  },
  I3_orientation: {
    unit: "Person",
    prompt: "Choose the face orientation.",
    instruction: "",
    help: "Less than profile means less of the face is visible than in a conventional profile. Choose tilted down or tilted up when vertical head angle is the clearest orientation feature."
  },
  I4_expression_legibility: {
    unit: "Person",
    prompt: "How legible is this person's facial expression?",
    instruction: "Choose the closest level on the four-point scale.",
    help: "Score the overall result, not the cause. Low, moderate, or high legibility can result from any combination of limited facial detail, covering or occlusion, face orientation, small face size, blur, low contrast, or poor image/reproduction quality. Judge their combined effect on expression coding. Level 0 skips gaze and smile coding; orientation and mouth covering are still recorded."
  },
  I5_gaze_target: {
    unit: "Person",
    prompt: "What is this person's gaze?",
    instruction: "Choose one.",
    help: "Code visible direction, not implied attention. Choose closed eyes only when the eyelids are visibly closed. Choose not assessable when gaze cannot be judged for another reason."
  },
  I5_target_person: {
    unit: "Person",
    prompt: "Which other person is the gaze directed at?",
    instruction: "Click a boxed person, or choose Person without bounding box.",
    help: "A boxed target is stored by person id. Use Person without bounding box for someone visible in the ad who was not individually boxed."
  },
  I6_mouth_covered: {
    unit: "Person",
    prompt: "Is the mouth covered by something?",
    instruction: "Choose one.",
    help: "Choose partly when a covering blocks only part of the mouth. Choose not assessable only when the mouth region is absent or unusable. For a difficult but visible case, select the best-fitting substantive answer."
  },
  I7_mouth_covering: {
    unit: "Person",
    prompt: "What covers the mouth?",
    instruction: "",
    help: "Choose the main visible covering. Record what covers the mouth, not whether the covering is intentional."
  },
  I7_covering_other_text: {
    unit: "Person",
    prompt: "Briefly describe the other mouth covering.",
    instruction: "Use a short, concrete description.",
    help: "Describe what visibly covers the mouth. Do not infer intention or emotion."
  },
  I8_smile_present: {
    unit: "Person",
    prompt: "Is a smile visibly present?",
    instruction: "",
    help: "Code visible mouth/facial configuration only. Do not infer felt emotion."
  },
  I9_smile_intensity: {
    unit: "Person",
    prompt: "Choose the visible smile intensity.",
    instruction: "",
    help: "Use the four-level verbal scale without external examples: slight, clear, broad, laughter-like."
  },
  END_PAGE_COMPLETE: {
    unit: "Finished",
    prompt: "Image annotation complete.",
    instruction: "Use Next page to continue.",
    help: ""
  },
  END_PAGE_INELIGIBLE: {
    unit: "Finished",
    prompt: "No qualifying advertisement on this image.",
    instruction: "Use Next page to continue.",
    help: ""
  },
  END_PAGE_REVIEW: {
    unit: "Finished",
    prompt: "Image marked for review.",
    instruction: "Use Next page to continue.",
    help: ""
  }
};

const STEP_META_DE = {
  P1_qualifying_ad_count: {
    unit: "Seite",
    prompt: "Wie viele Anzeigen auf dieser Seite enthalten mindestens eine geeignete Gesichtsdarstellung?",
    instruction: "Wähle 0-5 direkt aus oder gib eine höhere genaue Anzahl ein.",
    help: "Zahle Anzeigen, nicht Gesichter. Eine Darstellung ist geeignet, wenn mehr als nur ein Ohr oder der Hinterkopf sichtbar ist und das Gesicht mit einer Box markiert werden kann. Eingeschlossen sind menschliche, illustrierte, skulpturale, personifizierte, nichtmenschliche und schematische Gesichter."
  },
  P2_single_ad_full_page: {
    unit: "Anzeige",
    prompt: "Ist die einzige qualifizierende Anzeige ganzseitig?",
    instruction: "Wenn sie die nutzbare Seite ausfüllt, ist keine Anzeigen-Box nötig.",
    help: "Ganzseitig bedeutet, dass die qualifizierende Anzeige die Seite als Haupteinheit einnimmt. Wenn weitere Seiteninhalte vorhanden sind, wähle Teilseite."
  },
  A1_ad_bbox: {
    unit: "Anzeige",
    prompt: "Zeichne die vollständige Anzeigen-Box.",
    instruction: "Zeichne oder korrigiere eine Box um die gesamte Anzeige.",
    help: "Schließe Bild und Text ein, die zur Anzeige gehören. Schließe benachbarte redaktionelle Inhalte oder andere Anzeigen aus."
  },
  DRAW_AD_BOXES: {
    unit: "Anzeige",
    prompt: "Zeichne eine Box für jede qualifizierende Anzeige.",
    instruction: "Zeichne alle qualifizierenden Anzeigen-Boxen und wähle dann Weiter.",
    help: "Nutze dies, wenn mehrere qualifizierende Anzeigen vorhanden sind. Jede Box soll eine vollständige Anzeige einschließen."
  },
  A2_ad_depiction_type: {
    unit: "Anzeige",
    prompt: "Wie sind die geeigneten Gesichter in dieser Anzeige dargestellt?",
    instruction: "Wähle einen gemeinsamen Typ oder mehrere Typen vorhanden.",
    help: "Wähle nur dann einen einzelnen Typ, wenn er für alle einzeln codierten Gesichter in dieser Anzeige gilt. Wenn innerhalb dieser Anzeige mehr als ein Typ vorkommt, wähle mehrere Typen vorhanden; dann wird der Darstellungstyp pro codierter Person abgefragt."
  },
  A3_unique_person_count: {
    unit: "Anzeige",
    prompt: "Zeichne eine Box um jede geeignete Gesichtsdarstellung.",
    instruction: "Lass Nur Einzelpersonen ausgewählt und zeichne 1-9 Boxen, oder wähle 10-20 bzw. 20+ für eine Menge.",
    help: "Bei ein bis neun Gesichtern lass Nur Einzelpersonen ausgewählt, zeichne jedes Gesicht und wähle Fertig erst, wenn alle Boxen gezeichnet sind. Die genaue Anzahl wird automatisch gespeichert. Spiegelungen und Wiederholungen werden mitgezählt. Nutze die kleinste Box, die alle sichtbaren Gesichts- und Kopfmerkmale abdeckt, die für die Codierung gebraucht werden, einschließlich sichtbarer Haare, Ohren, Kinn, Bart oder Schnurrbart und getragener Brillen. Schließe Hals, Schultern, Bildunterschriften und leeren Hintergrund aus, sofern sie das Gesicht nicht sichtbar verdecken oder schneiden. Wenn du nach dem Zeichnen zu einer Mengen-Kategorie wechselst, werden vorläufige Einzelpersonen-Boxen entfernt. Du kannst vor dem Fortfahren wieder zu Nur Einzelpersonen wechseln."
  },
  C1_outstanding_present: {
    unit: "Menge",
    prompt: "Gibt es herausstechende Einzelpersonen, die separat annotiert werden sollten?",
    instruction: "Wähle ja nur für visuell hervorgehobene Personen innerhalb einer größeren Menge.",
    help: "Herausstechende Einzelpersonen sind zentral, groß, hervorgehoben oder anderweitig analytisch wichtig. Sie erhalten eine vollständige Einzelcodierung vor der Gruppencodierung."
  },
  DRAW_OUTSTANDING_INDIVIDUAL_BOXES: {
    unit: "Personen",
    prompt: "Zeichne Boxen für herausstechende Einzelpersonen.",
    instruction: "Zeichne jede herausstechende Gesichts-Box, bevor du Fertig wählst.",
    help: "Nutze dies nur für Personen, die separat von der restlichen Menge oder Gruppe codiert werden sollen. Nutze die kleinste Box, die alle sichtbaren Gesichts- und Kopfmerkmale abdeckt, die für die Codierung gebraucht werden, einschließlich sichtbarer Haare, Ohren, Kinn, Bart oder Schnurrbart und getragener Brillen."
  },
  DRAW_GROUP_BOXES: {
    unit: "Gruppen",
    prompt: "Zeichne eine Box für jede visuell abgrenzbare verbleibende Gruppe.",
    instruction: "Jede Gruppen-Box soll alle Gesichter dieser Gruppe einschließen.",
    help: "Nutze Gruppen-Boxen für Mengen oder viele kleine Gesichter, bei denen Einzelannotation langsam oder unzuverlässig wäre."
  },
  G1_group_type: {
    unit: "Gruppe",
    prompt: "Wähle den Gruppentyp.",
    instruction: "",
    help: "Codiere die dominierende visuelle Organisation der markierten Gruppe."
  },
  G2_group_age: {
    unit: "Gruppe",
    prompt: "Wähle die ungefähre Alterszusammensetzung der Gruppe.",
    instruction: "",
    help: "Codiere nur die grobe wahrgenommene Alterszusammensetzung anhand sichtbarer Hinweise."
  },
  G3_group_gender: {
    unit: "Gruppe",
    prompt: "Wähle die wahrgenommene Geschlechterpräsentation der Gruppe.",
    instruction: "",
    help: "Codiere Präsentation, nicht Identität. Nutze nicht beurteilbar nur, wenn die nötigen visuellen Hinweise fehlen."
  },
  G4_group_expression_legibility: {
    unit: "Gruppe",
    prompt: "Wie gut sind Gesichtsausdrücke in dieser Gruppe lesbar?",
    instruction: "Wähle die passendste Verteilung über die gruppierten Gesichter.",
    help: "Bewerte die allgemeine Lesbarkeit für Ausdruckscodierung in der Gruppe. Niedrige, mittlere oder hohe Lesbarkeit kann durch wenige Gesichtsdetails, Verdeckung, Gesichtsausrichtung, kleine Gesichtsgröße, Unschärfe, niedrigen Kontrast oder schlechte Bild-/Reproduktionsqualität entstehen. Wähle gemischt, wenn kein einzelnes Niveau oder mehrheitliches Niveau gut passt. Wenn keine gruppierten Gesichter lesbar sind, werden Blick- und Lächelfragen übersprungen."
  },
  G5_group_gaze: {
    unit: "Gruppe",
    prompt: "Wähle das dominierende Blickmuster der Gruppe.",
    instruction: "",
    help: "Codiere das dominierende sichtbare Blickmuster unter den beurteilbaren Gesichtern."
  },
  G6_group_smile: {
    unit: "Gruppe",
    prompt: "Wie verbreitet ist sichtbares Lächeln unter den beurteilbaren Gruppenmitgliedern?",
    instruction: "",
    help: "Schätze die Häufigkeit unter Gruppenmitgliedern, deren Mund/Gesicht sichtbar genug ist."
  },
  G7_group_smile_intensity: {
    unit: "Gruppe",
    prompt: "Welche Lächelintensität überwiegt unter den lächelnden Gruppenmitgliedern?",
    instruction: "",
    help: "Codiere nur unter sichtbar lächelnden Personen. Nutze gemischt, wenn keine Intensität klar überwiegt."
  },
  D0_duplicates_present: {
    unit: "Anzeige",
    prompt: "Wiederholen einzeln markierte Gesichter dieselbe Gesichtsidentitat?",
    instruction: "Berücksichtige Spiegel, wiederholte Porträts und Collage-Wiederholungen.",
    help: "Beantworte dies für die einzeln markierten Gesichter in der aktuellen Anzeige. Ähnlich aussehende Gesichter sind keine Duplikate, außer sie wiederholen klar dieselbe Person, Figur, dasselbe Objekt oder dieselbe dargestellte Identität."
  },
  D1_unique_face_count: {
    unit: "Anzeige",
    prompt: "Wie viele eindeutige Gesichtsidentitaten sind durch die Boxen dargestellt?",
    instruction: "Zähle jede wiederholte Identität nur einmal.",
    help: "Diese Anzahl muss kleiner sein als die Anzahl der gezeichneten Gesichts-Boxen, weil mindestens eine Person wiederholt wird."
  },
  D2_select_main: {
    unit: "Duplikatgruppe",
    prompt: "Wähle das Hauptgesicht für diese Identität.",
    instruction: "Klicke die klarste oder analytisch nutzlichste Gesichts-Box.",
    help: "Das Hauptgesicht erhalt die detaillierte Personenannotation. Wiederholte Darstellungen bleiben als verknupfte Boxen gespeichert."
  },
  D3_select_duplicates: {
    unit: "Duplikatgruppe",
    prompt: "Wähle alle Duplikate dieses Hauptgesichts.",
    instruction: "Klicke passende Boxen zum Aus- oder Abwählen und wähle dann Weiter.",
    help: "Lass nicht zugehörige Gesichter ungewählt. Eine Identitätsgruppe kann keine Duplikate enthalten, wenn eine andere Gruppe das wiederholte Gesicht abdeckt."
  },
  I0_person_depiction_type: {
    unit: "Person",
    prompt: "Wie ist diese Person dargestellt?",
    instruction: "Wähle den passendsten Darstellungstyp.",
    help: "Diese Frage erscheint pro Person nur, weil für diese Anzeige mehrere Typen vorhanden ausgewählt wurde."
  },
  I1_age: {
    unit: "Person",
    prompt: "Wähle die wahrgenommene Altersgruppe dieser Person.",
    instruction: "",
    help: "Nutze das grobe sichtbare Alter. Wähle nicht beurteilbar, wenn Gesicht/Körper nicht genug Hinweise liefern."
  },
  I2_gender: {
    unit: "Person",
    prompt: "Wähle die wahrgenommene Geschlechterpräsentation dieser Person.",
    instruction: "",
    help: "Codiere Präsentation, nicht Identität. Nutze ambig/androgyn nur, wenn das die sichtbare Präsentation ist."
  },
  I3_orientation: {
    unit: "Person",
    prompt: "Wähle die Gesichtsausrichtung.",
    instruction: "",
    help: "Weniger als Profil bedeutet, dass weniger vom Gesicht sichtbar ist als bei einem konventionellen Profil. Wähle nach unten geneigt oder nach oben geneigt, wenn der vertikale Kopfwinkel das klarste Ausrichtungsmerkmal ist."
  },
  I4_expression_legibility: {
    unit: "Person",
    prompt: "Wie gut ist der Gesichtsausdruck dieser Person lesbar?",
    instruction: "Wähle die passendste Stufe auf der Vier-Punkte-Skala.",
    help: "Bewerte das Ergebnis, nicht die Ursache. Niedrige, mittlere oder hohe Lesbarkeit kann durch wenige Details, Verdeckung, Gesichtsausrichtung, kleine Gesichtsgröße, Unschärfe, niedrigen Kontrast oder schlechte Bild-/Reproduktionsqualität entstehen. Beurteile die kombinierte Wirkung auf die Ausdruckscodierung. Stufe 0 überspringt Blick- und Lächelcodierung; Ausrichtung und Mundverdeckung werden weiterhin erfasst."
  },
  I5_gaze_target: {
    unit: "Person",
    prompt: "Wohin geht der Blick dieser Person?",
    instruction: "Wähle eine Option.",
    help: "Codiere die sichtbare Richtung, nicht die vermutete Aufmerksamkeit. Wähle Augen bedeckt, wenn die Augenregion sichtbar verdeckt ist. Wähle Augen geschlossen nur, wenn die Augenlider sichtbar geschlossen sind. Wähle nicht beurteilbar, wenn der Blick aus anderem Grund nicht eingeschätzt werden kann."
  },
  I5_target_person: {
    unit: "Person",
    prompt: "Auf welche andere Person ist der Blick gerichtet?",
    instruction: "Klicke eine markierte Person oder wähle Person ohne Box.",
    help: "Ein markiertes Ziel wird über die Personen-ID gespeichert. Nutze Person ohne Box für eine sichtbare Person in der Anzeige, die nicht einzeln markiert wurde."
  },
  I6_mouth_covered: {
    unit: "Person",
    prompt: "Ist der Mund durch etwas verdeckt?",
    instruction: "Wähle eine Option.",
    help: "Wähle teilweise, wenn eine Verdeckung nur einen Teil des Mundes blockiert. Wähle nicht beurteilbar nur, wenn die Mundregion fehlt oder nicht nutzbar ist. Bei schwierigen, aber sichtbaren Fällen wähle die beste substantielle Option."
  },
  I7_mouth_covering: {
    unit: "Person",
    prompt: "Was verdeckt den Mund?",
    instruction: "",
    help: "Wähle die hauptsächliche sichtbare Verdeckung. Erfasse, was den Mund verdeckt, nicht ob die Verdeckung absichtlich ist."
  },
  I7_covering_other_text: {
    unit: "Person",
    prompt: "Beschreibe kurz die andere Mundverdeckung.",
    instruction: "Nutze eine kurze, konkrete Beschreibung.",
    help: "Beschreibe, was den Mund sichtbar verdeckt. Interpretiere keine Absicht oder Emotion."
  },
  I8_smile_present: {
    unit: "Person",
    prompt: "Ist ein Lächeln sichtbar?",
    instruction: "",
    help: "Codiere nur sichtbare Mund-/Gesichtskonfiguration. Schließe nicht auf gefühlte Emotion."
  },
  I9_smile_intensity: {
    unit: "Person",
    prompt: "Wähle die sichtbare Lächelintensität.",
    instruction: "",
    help: "Nutze die vierstufige verbale Skala ohne externe Beispiele: leicht, deutlich, breit, lachend."
  },
  END_PAGE_COMPLETE: {
    unit: "Fertig",
    prompt: "Annotation des Bildes abgeschlossen.",
    instruction: "Nutze Nächste Seite, um fortzufahren.",
    help: ""
  },
  END_PAGE_INELIGIBLE: {
    unit: "Fertig",
    prompt: "Keine qualifizierende Anzeige auf diesem Bild.",
    instruction: "Nutze Nächste Seite, um fortzufahren.",
    help: ""
  },
  END_PAGE_REVIEW: {
    unit: "Fertig",
    prompt: "Bild zur Prufung markiert.",
    instruction: "Nutze Nächste Seite, um fortzufahren.",
    help: ""
  }
};

const LANGUAGE_STORAGE_KEY = "annotationAppV2Language";
const LANGUAGE_LABELS = { en: "English", de: "Deutsch" };

function initialLanguage() {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === "en" || saved === "de") return saved;
  return (navigator.language || "").toLowerCase().startsWith("de") ? "de" : "en";
}

const state = {
  session: null,
  manifest: null,
  hostedMode: false,
  annotationRevision: 0,
  expertMode: false,
  language: initialLanguage(),
  startMode: "new",
  resumeSessions: [],
  sessionLookupToken: 0,
  statuses: {},
  currentIndex: 0,
  maxVisitedIndex: 0,
  annotation: null,
  annotationPersisted: false,
  dirty: false,
  step: { id: "P1_qualifying_ad_count" },
  selectedBoxId: null,
  drawing: null,
  dragging: null,
  zoom: 1,
  fitBaseWidth: 1,
  visibleRegionKey: "0,0,1,1",
  naturalSize: { width: 0, height: 0 },
  saveTimer: null,
  savePromise: null,
  changeVersion: 0,
  prefetchedImage: null,
  imageLoadToken: 0,
  stepTimer: null,
  lastFocusStart: null,
  completionLoading: false,
  completionSummary: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function sessionDisplayId(session = state.session) {
  return String(session?.session_code || session?.session_id || "");
}
const STORAGE_KEY = "annotationAppV2State";
const DONE_STATUSES = new Set(["complete", "ineligible", "needs_review"]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const DISPLAY_LABELS_EN = {
  photo_of_person: "photo of person",
  cartoon_or_caricature: "cartoon/caricature",
  photo_of_artwork_or_statue: "photo of artwork/statue",
  drawing_of_statue_monument_or_public_symbol: "drawing of statue, monument, or public symbol",
  mask_mannequin_doll_or_puppet: "mask, mannequin, doll, or puppet",
  schematic_icon_or_logo_face: "schematic icon/logo face",
  multiple_types_present: "multiple types present",
  only_individuals: "only individuals",
  "10_20": "10-20",
  "20_plus": "20+",
  beyond_profile: "less than profile",
  none_visible: "none visible",
  any_visible: "some visible",
  not_visible: "not visible",
  partly_visible: "partly visible",
  fully_visible: "fully visible",
  not_assessable: "not assessable",
  viewer_camera: "viewer/camera",
  toward_viewer_camera: "toward viewer/camera",
  hand_or_body: "hand/body",
  object_or_clothing: "object/clothing",
  face_orientation: "face orientation",
  text_or_graphic_overlay: "text/graphic overlay",
  image_quality_or_low_contrast: "image quality/low contrast",
  "1_slight": "1 slight",
  "2_clear": "2 clear",
  "3_broad": "3 broad",
  "4_laughter_like": "4 laughter-like",
  "0_not_legible": "0 not legible",
  "1_low_legibility": "1 low legibility",
  "2_moderate_legibility": "2 moderate legibility",
  "3_high_legibility": "3 high legibility",
  all_0_not_legible: "all not legible",
  mostly_0_not_legible: "mostly not legible",
  all_1_low_legibility: "all low legibility",
  mostly_1_low_legibility: "mostly low legibility",
  all_2_moderate_legibility: "all moderate legibility",
  mostly_2_moderate_legibility: "mostly moderate legibility",
  all_3_high_legibility: "all high legibility",
  mostly_3_high_legibility: "mostly high legibility",
  mixed_legibility: "mixed legibility",
  broad_or_laughter_like: "broad/laughter-like",
  ambiguous_or_androgynous: "ambiguous/androgynous",
  ambiguous_or_androgynous_present: "ambiguous/androgynous present",
  audience_or_crowd: "audience/crowd",
  three_quarter: "three-quarter",
  off_frame: "off-frame",
  crop_or_frame: "crop/frame",
  off_frame_or_scene_direction: "scene direction/off-screen",
  own_body_part: "other body part",
  other_body_part: "other body part",
  part_of_another_person: "(part of) another person",
  object_in_mouth: "object in mouth",
  tilted_down: "tilted down",
  tilted_up: "tilted up"
};

const DISPLAY_LABELS_DE = {
  yes: "ja",
  no: "nein",
  partly: "teilweise",
  full_page: "ganzseitig",
  partial_page: "Teilseite",
  photo_of_person: "Foto einer Person",
  naturalistic_illustration: "naturalistische Illustration",
  stylized_illustration: "stilisierte Illustration",
  cartoon_or_caricature: "Cartoon/Karikatur",
  generic_human_figure: "generische menschliche Figur",
  photo_of_artwork_or_statue: "Foto von Kunstwerk/Statue",
  drawing_of_statue_monument_or_public_symbol: "Zeichnung von Statue, Denkmal oder öffentlichem Symbol",
  mask_mannequin_doll_or_puppet: "Maske, Schaufensterpuppe, Puppe oder Marionette",
  personified_object: "personifiziertes Objekt",
  nonhuman_creature_with_face: "nichtmenschliches Wesen mit Gesicht",
  schematic_icon_or_logo_face: "schematisches Icon/Logo-Gesicht",
  multiple_types_present: "mehrere Typen vorhanden",
  only_individuals: "nur Einzelpersonen",
  "10_20": "10-20",
  "20_plus": "20+",
  infant: "Säugling",
  child: "Kind",
  adolescent: "Jugendliche/r",
  young_adult: "junge/r Erwachsene/r",
  middle_adult: "mittleres Erwachsenenalter",
  older_adult: "ältere/r Erwachsene/r",
  feminine: "feminin",
  masculine: "maskulin",
  ambiguous_or_androgynous: "ambig/androgyn",
  beyond_profile: "weniger als Profil",
  profile: "Profil",
  three_quarter: "Dreiviertel",
  frontal: "frontal",
  tilted_down: "nach unten geneigt",
  tilted_up: "nach oben geneigt",
  not_assessable: "nicht beurteilbar",
  viewer_camera: "Betrachter/Kamera",
  another_person: "andere Person",
  advertised_product: "beworbenes Produkt",
  other_object: "anderes Objekt",
  off_frame_or_scene_direction: "Szenenrichtung/außerhalb des Bildes",
  eyes_covered: "Augen bedeckt",
  closed_eyes: "Augen geschlossen",
  hand: "Hand",
  beard: "Bart",
  other_body_part: "anderes Körperteil",
  own_body_part: "anderes Körperteil",
  part_of_another_person: "(Teil einer) anderen Person",
  object: "Objekt",
  object_in_mouth: "Objekt im Mund",
  text_or_graphic_overlay: "Text/grafische Überlagerung",
  other: "anderes",
  "1_slight": "1 leicht",
  "2_clear": "2 deutlich",
  "3_broad": "3 breit",
  "4_laughter_like": "4 lachend",
  "0_not_legible": "0 nicht lesbar",
  "1_low_legibility": "1 geringe Lesbarkeit",
  "2_moderate_legibility": "2 mittlere Lesbarkeit",
  "3_high_legibility": "3 hohe Lesbarkeit",
  interacting_group: "interagierende Gruppe",
  posed_group: "gestellte Gruppe",
  audience_or_crowd: "Publikum/Menge",
  background_population: "Hintergrundpersonen",
  separate_portraits_or_composite: "getrennte Porträts/Komposit",
  young_only: "nur jung",
  middle_only: "nur mittleres Alter",
  older_only: "nur älter",
  mostly_young: "überwiegend jung",
  mostly_middle: "überwiegend mittleres Alter",
  mostly_older: "überwiegend älter",
  mixed: "gemischt",
  feminine_only: "nur feminin",
  masculine_only: "nur maskulin",
  mostly_feminine: "überwiegend feminin",
  mostly_masculine: "überwiegend maskulin",
  ambiguous_or_androgynous_present: "ambig/androgyn vorhanden",
  all_0_not_legible: "alle nicht lesbar",
  mostly_0_not_legible: "überwiegend nicht lesbar",
  all_1_low_legibility: "alle geringe Lesbarkeit",
  mostly_1_low_legibility: "überwiegend geringe Lesbarkeit",
  all_2_moderate_legibility: "alle mittlere Lesbarkeit",
  mostly_2_moderate_legibility: "überwiegend mittlere Lesbarkeit",
  all_3_high_legibility: "alle hohe Lesbarkeit",
  mostly_3_high_legibility: "überwiegend hohe Lesbarkeit",
  mixed_legibility: "gemischte Lesbarkeit",
  toward_viewer_camera: "zum Betrachter/zur Kamera",
  toward_each_other: "zueinander",
  toward_object: "zu einem Objekt",
  none: "keine",
  minority: "Minderheit",
  about_half: "etwa die Hälfte",
  majority: "Mehrheit",
  all: "alle",
  slight: "leicht",
  clear: "deutlich",
  broad_or_laughter_like: "breit/lachend",
  face_orientation: "Gesichtsausrichtung",
  image_quality_or_low_contrast: "Bildqualität/niedriger Kontrast",
  hand_or_body: "Hand/Körper",
  object_or_clothing: "Objekt/Kleidung",
  none_visible: "nichts sichtbar",
  any_visible: "etwas sichtbar",
  not_visible: "nicht sichtbar",
  partly_visible: "teilweise sichtbar",
  fully_visible: "vollständig sichtbar",
  off_frame: "außerhalb des Bildes",
  crop_or_frame: "Beschnitt/Rahmen"
};

const STEP_META = new Proxy(STEP_META_EN, {
  get(target, property) {
    return (state.language === "de" ? STEP_META_DE[property] : null) || target[property];
  }
});

const DISPLAY_LABELS = new Proxy(DISPLAY_LABELS_EN, {
  get(target, property) {
    return (state.language === "de" ? DISPLAY_LABELS_DE[property] : null) || target[property];
  }
});

const UI_TEXT = {
  en: {
    app_title: "Annotation App V2",
    welcome_1: "This app guides you through one annotation decision at a time for magazine pages or page spreads.",
    welcome_2: "We are looking for advertisements containing eligible face depictions. A face is eligible when more than an ear or the back of a head is visible and its location can be boxed. Human, illustrated, sculpted, personified, nonhuman, and schematic faces are included.",
    welcome_3: "For each qualifying ad, you will draw boxes where needed and then answer short visual questions. Always choose the single best-fitting answer when visual evidence is available; use not assessable only when the required evidence cannot be seen well enough.",
    welcome_4: "Use the question-mark button for detailed coding rules. Your progress is saved during annotation so a session can be resumed later.",
    welcome_5: "Use the urgent comment button during annotation only for exceptional cases that were unusually difficult or may need review; it adds a note but does not replace the required answer.",
    manifest_path: "Manifest JSON path",
    annotation_session: "Annotation session",
    new_annotation: "New annotation",
    resume_annotation: "Resume annotation",
    saved_annotation: "Saved annotation",
    no_saved_sessions_loaded: "No saved sessions loaded",
    refresh_sessions: "Refresh sessions",
    start_new_annotation: "Start new annotation",
    open_saved_annotation: "Open saved annotation",
    study_password: "Study password",
    continue: "Continue",
    assignment_code: "Eight-digit assignment code",
    open_annotation: "Open annotation",
    annotation_set_complete: "Annotation set complete",
    thank_you: "Thank you.",
    annotations_saved: "Your annotations have been saved.",
    pages: "Pages",
    qualifying_ads: "Qualifying ads",
    faces_boxed: "Faces boxed",
    groups: "Groups",
    focused_time: "Focused time",
    session: "Session",
    review_annotations: "Review annotations",
    sign_out: "Sign out",
    return_to_start: "Return to start",
    not_started: "Not started",
    started: "Started",
    done: "Done",
    loading_page: "Loading page",
    previous_page: "Previous page",
    next_page: "Next page",
    zoom_controls: "Zoom controls",
    fit_image: "Fit image",
    fit: "Fit",
    zoom_out: "Zoom out",
    zoom_in: "Zoom in",
    box_editing_controls: "Box editing controls",
    undo_last_box: "Undo last box",
    undo: "Undo",
    delete_selected_box: "Delete selected box",
    delete: "Delete",
    show_coding_rule: "Show coding rule",
    add_urgent_comment: "Add urgent comment",
    back: "Back",
    next: "Next",
    edit_annotation: "Edit annotation",
    finish_task: "Finish task",
    image_progress: "Image progress",
    task_progress: "Task progress",
    task: "Task",
    expert: "Expert",
    exit: "Exit",
    urgent_comment: "Urgent comment",
    urgent_comment_placeholder: "What was difficult or important here?",
    cancel: "Cancel",
    save: "Save",
    save_session_number: "Save your session number",
    session_number_copy_instruction: "Copy this number now. It identifies this annotation if you need to resume it later.",
    copy_number: "Copy number",
    page_changed_elsewhere: "This page changed elsewhere",
    page_changed_explanation: "Another browser or tab saved a newer version. Reload this page before continuing so that work is not overwritten.",
    reload_page: "Reload page",
    higher_count: "Higher count",
    face_route: "Face route",
    other_covering: "Other covering",
    short_description: "Short description",
    person_without_box: "Person without bounding box",
    no_target_selected: "No target selected.",
    selected_person_without_box: "Selected: person without bounding box",
    boxes: "Boxes",
    language_group: "Interface language",
    page_overview: "Page overview",
    page_states: "Page states",
    open_page_overview: "Open page overview",
    open_page_overview_expert: "Open page overview; all pages are available",
    choose_saved_annotation: "Choose a saved annotation to resume.",
    selected_saved_unavailable: "The selected saved annotation is no longer available.",
    manifest_required: "Manifest path is required.",
    loading_saved_sessions: "Loading saved sessions...",
    loading: "Loading...",
    saved_sessions_unavailable: "Saved sessions could not be loaded",
    no_saved_annotations: "No saved annotations found.",
    saved_annotations_found_one: "1 saved annotation found.",
    saved_annotations_found_many: "{count} saved annotations found.",
    copying: "Copying...",
    copied: "Copied",
    session_number_copied: "Session number copied.",
    copy_unavailable: "Copy was unavailable. The number is selected; use Ctrl+C.",
    finishing_task: "Finishing task...",
    final_page_not_saved: "The final page could not be saved. Try again.",
    complete_every_page: "Complete every page before finishing the task.",
    image_could_not_load: "Image could not be loaded.",
    opening_annotation: "Opening annotation...",
    signing_in: "Signing in...",
    unknown_date: "Unknown date",
    assignment: "Assignment",
    final_terminal_instruction: "Choose Finish task to save and view your summary.",
    completion_page_single: "You completed the page. Your annotations have been saved.",
    completion_page_many: "You completed all {count} pages. Your annotations have been saved.",
    page_status_title: "Page {number}: {status}",
    page_locked_title: "Page {number}: {status}. Complete pages in order to unlock it.",
    enter_integer_6_99: "Enter an integer from 6 to 99.",
    select_at_least_one: "Select at least one option.",
    click_person_or_unboxed: "Click a person box or choose Person without bounding box.",
    select_one_main_face: "Select one main face box.",
    enter_short_description: "Enter a short description.",
    select_one_option: "Select one option."
  },
  de: {
    app_title: "Annotations-App V2",
    welcome_1: "Diese App führt dich Schritt für Schritt durch die Annotation von Magazinseiten oder Doppelseiten.",
    welcome_2: "Gesucht werden Anzeigen mit geeigneten Gesichtsdarstellungen. Ein Gesicht ist geeignet, wenn mehr als nur ein Ohr oder der Hinterkopf sichtbar ist und seine Position mit einer Box markiert werden kann. Eingeschlossen sind menschliche, illustrierte, skulpturale, personifizierte, nichtmenschliche und schematische Gesichter.",
    welcome_3: "Für jede qualifizierende Anzeige zeichnest du bei Bedarf Boxen und beantwortest danach kurze visuelle Fragen. Wähle immer die eine bestpassende Antwort, wenn visuelle Hinweise vorhanden sind; nutze nicht beurteilbar nur, wenn die nötige Evidenz nicht gut genug sichtbar ist.",
    welcome_4: "Über die Fragezeichen-Schaltfläche findest du genauere Codierregeln. Dein Fortschritt wird während der Annotation gespeichert, sodass du eine Sitzung später fortsetzen kannst.",
    welcome_5: "Nutze die dringende Kommentar-Schaltfläche nur für Ausnahmefälle, die ungewöhnlich schwierig waren oder geprüft werden sollten; der Kommentar ersetzt keine erforderliche Antwort.",
    manifest_path: "Pfad zur Manifest-JSON",
    annotation_session: "Annotationssitzung",
    new_annotation: "Neue Annotation",
    resume_annotation: "Annotation fortsetzen",
    saved_annotation: "Gespeicherte Annotation",
    no_saved_sessions_loaded: "Keine gespeicherten Sitzungen geladen",
    refresh_sessions: "Sitzungen aktualisieren",
    start_new_annotation: "Neue Annotation starten",
    open_saved_annotation: "Gespeicherte Annotation öffnen",
    study_password: "Studienpasswort",
    continue: "Weiter",
    assignment_code: "Achtstelliger Zuweisungscode",
    open_annotation: "Annotation öffnen",
    annotation_set_complete: "Annotationsset abgeschlossen",
    thank_you: "Danke.",
    annotations_saved: "Deine Annotationen wurden gespeichert.",
    pages: "Seiten",
    qualifying_ads: "Qualifizierende Anzeigen",
    faces_boxed: "Gesichter markiert",
    groups: "Gruppen",
    focused_time: "Aktive Zeit",
    session: "Sitzung",
    review_annotations: "Annotationen ansehen",
    sign_out: "Abmelden",
    return_to_start: "Zurück zum Start",
    not_started: "Nicht begonnen",
    started: "Begonnen",
    done: "Fertig",
    loading_page: "Seite wird geladen",
    previous_page: "Vorherige Seite",
    next_page: "Nächste Seite",
    zoom_controls: "Zoom-Steuerung",
    fit_image: "Bild einpassen",
    fit: "Einpassen",
    zoom_out: "Verkleinern",
    zoom_in: "Vergroßern",
    box_editing_controls: "Box-Bearbeitung",
    undo_last_box: "Letzte Box rückgängig",
    undo: "Rückgängig",
    delete_selected_box: "Ausgewählte Box löschen",
    delete: "Löschen",
    show_coding_rule: "Codierregel anzeigen",
    add_urgent_comment: "Dringenden Kommentar hinzufügen",
    back: "Zurück",
    next: "Weiter",
    edit_annotation: "Annotation bearbeiten",
    finish_task: "Aufgabe abschließen",
    image_progress: "Bildfortschritt",
    task_progress: "Aufgabenfortschritt",
    task: "Aufgabe",
    expert: "Expert",
    exit: "Beenden",
    urgent_comment: "Dringender Kommentar",
    urgent_comment_placeholder: "Was war hier schwierig oder wichtig?",
    cancel: "Abbrechen",
    save: "Speichern",
    save_session_number: "Sitzungsnummer sichern",
    session_number_copy_instruction: "Kopiere diese Nummer jetzt. Mit ihr kannst du diese Annotation später fortsetzen.",
    copy_number: "Nummer kopieren",
    page_changed_elsewhere: "Diese Seite wurde anderswo verändert",
    page_changed_explanation: "Ein anderer Browser oder Tab hat eine neuere Version gespeichert. Lade die Seite neu, bevor du fortfährst, damit keine Arbeit überschrieben wird.",
    reload_page: "Seite neu laden",
    higher_count: "Höhere Anzahl",
    face_route: "Gesichtsroute",
    other_covering: "Andere Verdeckung",
    short_description: "Kurze Beschreibung",
    person_without_box: "Person ohne Box",
    no_target_selected: "Kein Ziel ausgewählt.",
    selected_person_without_box: "Ausgewählt: Person ohne Box",
    boxes: "Boxen",
    language_group: "Sprache der Oberfläche",
    page_overview: "Seitenübersicht",
    page_states: "Seitenstatus",
    open_page_overview: "Seitenübersicht öffnen",
    open_page_overview_expert: "Seitenübersicht öffnen; alle Seiten sind verfügbar",
    choose_saved_annotation: "Wähle eine gespeicherte Annotation zum Fortsetzen.",
    selected_saved_unavailable: "Die ausgewählte gespeicherte Annotation ist nicht mehr verfügbar.",
    manifest_required: "Ein Manifest-Pfad ist erforderlich.",
    loading_saved_sessions: "Gespeicherte Sitzungen werden geladen...",
    loading: "Laden...",
    saved_sessions_unavailable: "Gespeicherte Sitzungen konnten nicht geladen werden",
    no_saved_annotations: "Keine gespeicherten Annotationen gefunden.",
    saved_annotations_found_one: "1 gespeicherte Annotation gefunden.",
    saved_annotations_found_many: "{count} gespeicherte Annotationen gefunden.",
    copying: "Wird kopiert...",
    copied: "Kopiert",
    session_number_copied: "Sitzungsnummer kopiert.",
    copy_unavailable: "Kopieren war nicht verfügbar. Die Nummer ist markiert; nutze Strg+C.",
    finishing_task: "Aufgabe wird abgeschlossen...",
    final_page_not_saved: "Die letzte Seite konnte nicht gespeichert werden. Versuche es erneut.",
    complete_every_page: "Schließe jede Seite ab, bevor du die Aufgabe beendest.",
    image_could_not_load: "Bild konnte nicht geladen werden.",
    opening_annotation: "Annotation wird geöffnet...",
    signing_in: "Anmeldung läuft...",
    unknown_date: "Unbekanntes Datum",
    assignment: "Zuweisung",
    final_terminal_instruction: "Wähle Aufgabe abschließen, um zu speichern und die Zusammenfassung zu sehen.",
    completion_page_single: "Du hast die Seite abgeschlossen. Deine Annotationen wurden gespeichert.",
    completion_page_many: "Du hast alle {count} Seiten abgeschlossen. Deine Annotationen wurden gespeichert.",
    page_status_title: "Seite {number}: {status}",
    page_locked_title: "Seite {number}: {status}. Schließe Seiten der Reihe nach ab, um sie freizuschalten.",
    enter_integer_6_99: "Gib eine ganze Zahl von 6 bis 99 ein.",
    select_at_least_one: "Wähle mindestens eine Option.",
    click_person_or_unboxed: "Klicke eine Personen-Box oder wähle Person ohne Box.",
    select_one_main_face: "Wähle eine Hauptgesichts-Box.",
    enter_short_description: "Gib eine kurze Beschreibung ein.",
    select_one_option: "Wähle eine Option."
  }
};

function t(key, values = {}) {
  const table = UI_TEXT[state.language] || UI_TEXT.en;
  const fallback = UI_TEXT.en[key] || key;
  const template = table[key] || fallback;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
}

function setText(selector, key) {
  const element = $(selector);
  if (element) element.textContent = t(key);
}

function setTitle(selector, key) {
  const element = $(selector);
  if (element) element.title = t(key);
}

function setAriaLabel(selector, key) {
  const element = $(selector);
  if (element) element.setAttribute("aria-label", t(key));
}

function setPlaceholder(selector, key) {
  const element = $(selector);
  if (element) element.placeholder = t(key);
}

function applyLanguage({ rerender = true } = {}) {
  document.documentElement.lang = state.language;
  document.title = t("app_title");
  $$("[data-lang-option]").forEach((button) => {
    const selected = button.dataset.langOption === state.language;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.title = LANGUAGE_LABELS[button.dataset.langOption] || button.dataset.langOption;
  });
  $$(".language-toggle").forEach((group) => group.setAttribute("aria-label", t("language_group")));

  setText(".login-panel h1", "app_title");
  const welcome = $$(".welcome-copy p");
  ["welcome_1", "welcome_2", "welcome_3", "welcome_4", "welcome_5"].forEach((key, index) => {
    if (welcome[index]) welcome[index].textContent = t(key);
  });
  const manifestLabel = $("#manifestPathField");
  if (manifestLabel) {
    for (const node of manifestLabel.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) node.textContent = `\n            ${t("manifest_path")}\n            `;
    }
  }
  setText(".field-label", "annotation_session");
  $('[data-session-mode="new"]').textContent = t("new_annotation");
  $('[data-session-mode="resume"]').textContent = t("resume_annotation");
  const resumeLabel = $("#resumeFields label");
  if (resumeLabel) {
    for (const node of resumeLabel.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) node.textContent = `\n              ${t("saved_annotation")}\n              `;
    }
  }
  $("#refreshSessionsButton").textContent = t("refresh_sessions");
  $("#startButton").textContent = state.startMode === "resume" ? t("open_saved_annotation") : t("start_new_annotation");
  const passwordLabel = $("#hostedPasswordStep label");
  if (passwordLabel) {
    for (const node of passwordLabel.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) node.textContent = `\n              ${t("study_password")}\n              `;
    }
  }
  $("#hostedLoginButton").textContent = t("continue");
  const assignmentLabel = $("#hostedAssignmentStep label");
  if (assignmentLabel) {
    for (const node of assignmentLabel.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) node.textContent = `\n              ${t("assignment_code")}\n              `;
    }
  }
  $("#hostedOpenButton").textContent = t("open_annotation");

  setText(".completion-kicker", "annotation_set_complete");
  setText("#completionTitle", "thank_you");
  setText("#completionMessage", "annotations_saved");
  const statKeys = ["pages", "qualifying_ads", "faces_boxed", "groups", "focused_time"];
  $$(".completion-stats span").forEach((span, index) => {
    span.textContent = t(statKeys[index]);
  });
  const completionSession = $(".completion-session");
  if (completionSession) completionSession.firstChild.textContent = `${t("session")} `;
  $("#reviewCompletedTaskButton").textContent = t("review_annotations");
  if (state.completionSummary) renderCompletionSummary(state.completionSummary);

  setAriaLabel("#imageList", "page_overview");
  setText(".page-list-header > strong", "pages");
  setAriaLabel(".page-list-legend", "page_states");
  const legendStates = $$(".page-list-legend .page-state");
  ["not_started", "started", "done"].forEach((key, index) => {
    if (legendStates[index]) legendStates[index].lastChild.textContent = t(key);
  });
  setAriaLabel("#imageLoading", "loading_page");
  $("#bboxDoneButton").textContent = t("done");
  setAriaLabel("#prevImageButton", "previous_page");
  setAriaLabel("#nextImageButton", "next_page");
  setTitle("#prevImageButton", "previous_page");
  setTitle("#nextImageButton", "next_page");
  setAriaLabel(".zoom-toolbar", "zoom_controls");
  setTitle('[data-zoom="fit"]', "fit_image");
  $('[data-zoom="fit"]').textContent = t("fit");
  setTitle('[data-zoom="out"]', "zoom_out");
  setTitle('[data-zoom="in"]', "zoom_in");
  setAriaLabel(".edit-toolbar", "box_editing_controls");
  setTitle("#undoBoxButton", "undo_last_box");
  $("#undoBoxButton").textContent = t("undo");
  setTitle("#deleteBoxButton", "delete_selected_box");
  $("#deleteBoxButton").textContent = t("delete");
  setTitle("#helpButton", "show_coding_rule");
  setAriaLabel("#helpButton", "show_coding_rule");
  setTitle("#urgentCommentButton", "add_urgent_comment");
  setAriaLabel("#urgentCommentButton", "add_urgent_comment");
  setTitle("#imageProgress", "image_progress");
  $("#pageListToggle").textContent = t("pages");
  const sessionDisplay = $(".session-code-display");
  if (sessionDisplay) sessionDisplay.firstChild.textContent = `${t("session")} `;
  $("#taskTitle").textContent = t("task");
  setTitle("#taskProgress", "task_progress");
  $("#expertModeBadge").textContent = t("expert");
  $("#hostedExitButton").textContent = t("exit");
  $("#leaveCompletedTaskButton").textContent = state.hostedMode ? t("sign_out") : t("return_to_start");

  setText("#commentDialog h2", "urgent_comment");
  setPlaceholder("#urgentCommentText", "urgent_comment_placeholder");
  $("#cancelCommentButton").textContent = t("cancel");
  $("#saveCommentButton").textContent = t("save");
  setText("#sessionCodeTitle", "save_session_number");
  const sessionDialogText = $("#sessionCodeDialog .dialog-body > p");
  if (sessionDialogText) sessionDialogText.textContent = t("session_number_copy_instruction");
  $("#copySessionCodeButton").textContent = t("copy_number");
  $("#continueSessionButton").textContent = t("continue");
  setText("#saveConflictTitle", "page_changed_elsewhere");
  const conflictText = $("#saveConflictDialog .instruction");
  if (conflictText) conflictText.textContent = t("page_changed_explanation");
  $("#reloadAfterConflictButton").textContent = t("reload_page");

  if (state.manifest) {
    $("#pageListToggle").title = state.expertMode ? t("open_page_overview_expert") : t("open_page_overview");
  }
  if (rerender && state.annotation) render();
}

function setLanguage(language) {
  if (language !== "en" && language !== "de") return;
  state.language = language;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  if (state.resumeSessions.length) renderResumeSessions(state.resumeSessions, $("#resumeSessionSelect")?.value || null);
  applyLanguage();
}

function labelize(value) {
  if (DISPLAY_LABELS[value]) return DISPLAY_LABELS[value];
  return String(value).replaceAll("_", " ");
}

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundRel(value) {
  return Number(clamp(value, 0, 1).toFixed(6));
}

function compactTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:.]/g, "").replace("T", "_").replace("Z", "");
}

function imageUrl(image) {
  if (state.hostedMode) return `/api/image?image_id=${encodeURIComponent(image.image_id)}`;
  return `/api/image?path=${encodeURIComponent(image.path)}`;
}

function discardPrefetchedImage() {
  const entry = state.prefetchedImage;
  state.prefetchedImage = null;
  if (!entry) return;
  entry.cancelled = true;
  if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
}

function prefetchImage(index) {
  if (!state.hostedMode || !state.manifest) return;
  const image = state.manifest.images[index];
  if (!image || image.image_id === currentImage()?.image_id) return;
  if (state.prefetchedImage?.imageId === image.image_id) return;
  discardPrefetchedImage();
  const entry = {
    imageId: image.image_id,
    objectUrl: null,
    cancelled: false,
    promise: null
  };
  entry.promise = (async () => {
    const response = await fetch(imageUrl(image), { cache: "no-store" });
    if (!response.ok) throw new Error("Image prefetch failed.");
    const objectUrl = URL.createObjectURL(await response.blob());
    entry.objectUrl = objectUrl;
    const probe = new Image();
    probe.src = objectUrl;
    if (typeof probe.decode === "function") await probe.decode();
    if (entry.cancelled) {
      URL.revokeObjectURL(objectUrl);
      entry.objectUrl = null;
      return null;
    }
    return objectUrl;
  })().catch(() => {
    if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
    entry.objectUrl = null;
    return null;
  });
  state.prefetchedImage = entry;
}

async function takePrefetchedImage(image) {
  const entry = state.prefetchedImage;
  if (!entry || entry.imageId !== image.image_id) return null;
  state.prefetchedImage = null;
  return entry.promise;
}

function currentImage() {
  return state.manifest.images[state.currentIndex];
}

function adByIndex(index = state.step.adIndex || 0) {
  return state.annotation?.advertisements?.[index] || null;
}

function personById(id) {
  if (!state.annotation) return null;
  for (const ad of state.annotation.advertisements) {
    const person = ad.people.find((candidate) => candidate.person_id === id);
    if (person) return person;
  }
  return null;
}

function groupById(id) {
  if (!state.annotation) return null;
  for (const ad of state.annotation.advertisements) {
    const group = ad.groups.find((candidate) => candidate.group_id === id);
    if (group) return group;
  }
  return null;
}

function nextNumericId(items, field, prefix) {
  let max = 0;
  for (const item of items) {
    const id = String(item[field] || "");
    if (!id.startsWith(prefix)) continue;
    const suffix = id.slice(prefix.length);
    if (/^\d+$/.test(suffix)) max = Math.max(max, Number(suffix));
  }
  return `${prefix}${max + 1}`;
}

function defaultAd(number) {
  const adId = state.annotation?.advertisements
    ? nextNumericId(state.annotation.advertisements, "ad_id", "ad")
    : `ad${number}`;
  return {
    ad_id: adId,
    extent: null,
    bbox: null,
    bbox_source: null,
    depiction_type: null,
    face_depiction_count_band: null,
    has_outstanding_individuals: null,
    duplicate_faces_present: null,
    unique_face_count: null,
    people: [],
    groups: []
  };
}

function defaultPerson(ad, role = "individual") {
  const personId = nextNumericId(ad.people, "person_id", `${ad.ad_id}_p`);
  return {
    person_id: personId,
    annotation_role: role,
    face_bbox: null,
    duplicate_of_person_id: null,
    duplicate_person_ids: [],
    depiction_type: null,
    perceived_age: null,
    perceived_gender_presentation: null,
    face_orientation: null,
    face_expression_legibility: null,
    gaze_target: null,
    gaze_target_person_id: null,
    gaze_target_person_unboxed: null,
    gaze_target_object_ref: null,
    mouth_covered: null,
    mouth_covering: null,
    mouth_covering_other_text: null,
    smile_present: null,
    smile_intensity: null
  };
}

function defaultGroup(ad) {
  const groupId = nextNumericId(ad.groups, "group_id", `${ad.ad_id}_g`);
  return {
    group_id: groupId,
    bbox: null,
    group_type: null,
    age_composition: null,
    gender_presentation_composition: null,
    expression_legibility_distribution: null,
    dominant_gaze: null,
    smile_prevalence: null,
    dominant_smile_intensity: null
  };
}

function setInitialFaceRoute(ad, route) {
  if (!ad) return;
  const previous = ad.face_depiction_count_band;
  state.selectedBoxId = null;
  state.drawing = null;
  state.dragging = null;

  if (route === "only_individuals") {
    ad.people = ad.people.filter((person) => person.annotation_role === "individual");
    ad.groups = [];
    ad.has_outstanding_individuals = null;
    const count = ad.people.filter((person) => person.face_bbox).length;
    ad.face_depiction_count_band = count ? String(count) : null;
    invalidateDuplicateResolution(ad);
    return;
  }

  if (!CROWD_FACE_BANDS.has(route)) return;
  const wasCrowd = CROWD_FACE_BANDS.has(previous);
  ad.face_depiction_count_band = route;
  if (!wasCrowd) {
    ad.people = [];
    ad.groups = [];
    ad.has_outstanding_individuals = null;
  } else {
    ad.people = ad.people.filter((person) => person.annotation_role !== "individual");
  }
  invalidateDuplicateResolution(ad);
}

function defaultAnnotation(image) {
  return {
    schema_version: "ad_face_annotation_v2",
    flow_source: {
      playbook: "docs/annotation_playbook_v1.md",
      yaml: "docs/annotation_flow_v1.yaml",
      flow_schema_version: "1.13"
    },
    session: {
      session_id: state.session.session_id,
      session_code: sessionDisplayId(),
      session_created_at: state.session.created_at
    },
    task: {
      task_id: state.manifest.task_id,
      manifest_path: state.manifest.manifest_path,
      image_index: image.index,
      image_total: image.total
    },
    image: {
      image_id: image.image_id,
      filename: image.filename,
      path: image.path,
      page_type: image.page_type,
      metadata: image.metadata || {}
    },
    status: "draft",
    created_at: nowIso(),
    updated_at: nowIso(),
    finished_at: null,
    current_step: { id: "P1_qualifying_ad_count" },
    page: {
      qualifying_ad_count: null,
      duplicate_faces_present: null,
      unique_face_count: null
    },
    face_identity_groups: [],
    advertisements: [],
    urgent_comments: [],
    review_flags: [],
    timing: {
      screen_times: [],
      total_elapsed_ms: 0,
      total_focused_ms: 0
    },
    navigation_history: []
  };
}

function migrateLoadedAnnotation(annotation) {
  annotation.flow_source ||= {};
  annotation.flow_source.flow_schema_version = "1.13";
  annotation.page ||= {};
  if (annotation.page.qualifying_ad_count === "unclear") annotation.page.qualifying_ad_count = null;
  const legacyPageDepictionType = annotation.page.depiction_type || null;
  annotation.page.duplicate_faces_present ??= null;
  annotation.page.unique_face_count ??= null;
  annotation.face_identity_groups ||= [];
  for (const ad of annotation.advertisements || []) {
    if (!("depiction_type" in ad)) {
      if (legacyPageDepictionType === "multiple_types_present") {
        const personTypes = new Set(
          (ad.people || []).map((person) => person.depiction_type).filter(Boolean)
        );
        ad.depiction_type = personTypes.size === 1 ? [...personTypes][0] : legacyPageDepictionType;
      } else {
        ad.depiction_type = legacyPageDepictionType;
      }
    }
    ad.face_depiction_count_band ??= ad.unique_person_count_band ?? null;
    if (ad.extent === "unclear") ad.extent = null;
    if (ad.face_depiction_count_band === "unclear") ad.face_depiction_count_band = null;
    if (ad.has_outstanding_individuals === "unclear") ad.has_outstanding_individuals = null;
    ad.duplicate_faces_present ??= null;
    ad.unique_face_count ??= null;
    for (const person of ad.people || []) {
      person.duplicate_of_person_id ??= null;
      person.duplicate_person_ids ||= [];
      person.depiction_type ??= null;
      person.face_expression_legibility ??= null;
      person.face_expression_legibility = ({
        "1_not_legible": "0_not_legible",
        "2_low_legibility": "1_low_legibility",
        "3_moderate_legibility": "2_moderate_legibility",
        "4_high_legibility": "3_high_legibility"
      })[person.face_expression_legibility] || person.face_expression_legibility;
      if (!("gaze_target_person_unboxed" in person)) {
        person.gaze_target_person_unboxed = person.gaze_target_unboxed_person_confirmed === "yes" ? true : null;
      }
      if (person.gaze_target === "off_frame" || person.gaze_target === "scene_direction") {
        person.gaze_target = "off_frame_or_scene_direction";
      }
      if (!("mouth_covered" in person)) person.mouth_covered = null;
      if (!("mouth_covering" in person)) person.mouth_covering = null;
      if (person.mouth_covering === "own_body_part") person.mouth_covering = "other_body_part";
      if (person.mouth_covering === "another_person") person.mouth_covering = "part_of_another_person";
      if (!("mouth_covering_other_text" in person)) person.mouth_covering_other_text = null;
      for (const field of [
        "perceived_age",
        "perceived_gender_presentation",
        "face_orientation",
        "gaze_target",
        "mouth_covered",
        "mouth_covering",
        "smile_present"
      ]) {
        if (person[field] === "unclear") person[field] = null;
      }
    }
    if (ad.depiction_type && ad.depiction_type !== "multiple_types_present") {
      for (const person of ad.people || []) person.depiction_type = null;
    }
    for (const group of ad.groups || []) {
      group.expression_legibility_distribution ??= null;
      if (group.dominant_gaze === "off_frame" || group.dominant_gaze === "scene_direction") {
        group.dominant_gaze = "off_frame_or_scene_direction";
      }
      for (const field of [
        "group_type",
        "age_composition",
        "gender_presentation_composition",
        "expression_legibility_distribution",
        "dominant_gaze",
        "smile_prevalence",
        "dominant_smile_intensity"
      ]) {
        if (group[field] === "unclear") group[field] = null;
      }
    }
  }
  delete annotation.page.depiction_type;
  return annotation;
}

function normalizeLoadedStep(step) {
  const replacements = {
    A2_representation_media: "A2_ad_depiction_type",
    DRAW_ALL_INDIVIDUAL_BOXES: "A3_unique_person_count",
    G4_group_gaze: "G4_group_expression_legibility",
    G5_group_smile: "G4_group_expression_legibility",
    G6_group_smile_intensity: "G4_group_expression_legibility",
    I4_gaze_eligible: "I5_gaze_target",
    I5_confirm_unboxed_target: "I5_target_person",
    I6_mouth_visibility: "I6_mouth_covered",
    I7_occlusion_reason: "I6_mouth_covered",
    I7_occlusion_other_text: "I6_mouth_covered"
  };
  if (step.id === "I0_duplicate") {
    const ad = adByIndex(step.adIndex);
    return { ...step, id: ad?.depiction_type === "multiple_types_present" ? "I0_person_depiction_type" : "I1_age" };
  }
  if (step.id === "I10_teeth_visibility") return nextPersonOrAfter(step);
  if (step.id === "P3_page_depiction_type") {
    return { ...step, id: "A2_ad_depiction_type", adIndex: step.adIndex ?? 0 };
  }
  return replacements[step.id] ? { ...step, id: replacements[step.id] } : step;
}

function saveLocalBootState() {
  if (state.hostedMode) return;
  if (!state.session || !state.manifest) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    session_id: state.session.session_id,
    manifest_path: state.manifest.manifest_path,
    start_mode: "resume"
  }));
}

function loadLocalBootState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    error.code = data.code;
    error.currentRevision = data.current_revision;
    throw error;
  }
  return data;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

function currentStepKey(step = state.step) {
  const parts = [step.id];
  if (step.adIndex !== undefined) parts.push(`ad${step.adIndex}`);
  if (step.personId) parts.push(step.personId);
  if (step.groupId) parts.push(step.groupId);
  if (step.identityGroupIndex !== undefined) parts.push(`identity${step.identityGroupIndex}`);
  return parts.join(":");
}

function startStepTimer(step) {
  state.stepTimer = {
    step_instance_id: `${compactTimestamp()}_${Math.random().toString(16).slice(2, 8)}`,
    step_id: step.id,
    step_key: currentStepKey(step),
    context: {
      ad_id: step.adIndex !== undefined ? adByIndex(step.adIndex)?.ad_id || null : null,
      person_id: step.personId || null,
      group_id: step.groupId || null,
      identity_group_index: step.identityGroupIndex ?? null
    },
    entered_at: nowIso(),
    start_ms: performance.now(),
    focused_ms: 0,
    focus_start_ms: document.hidden ? null : performance.now()
  };
}

function finishStepTimer(answerEvent = "leave") {
  const timer = state.stepTimer;
  if (!timer || !state.annotation) return;
  const end = performance.now();
  if (timer.focus_start_ms !== null) {
    timer.focused_ms += end - timer.focus_start_ms;
    timer.focus_start_ms = null;
  }
  const record = {
    step_instance_id: timer.step_instance_id,
    step_id: timer.step_id,
    step_key: timer.step_key,
    context: timer.context,
    entered_at: timer.entered_at,
    left_at: nowIso(),
    elapsed_ms_total: Math.round(end - timer.start_ms),
    elapsed_ms_focused: Math.round(timer.focused_ms),
    event: answerEvent
  };
  state.annotation.timing.screen_times.push(record);
  state.annotation.timing.total_elapsed_ms += record.elapsed_ms_total;
  state.annotation.timing.total_focused_ms += record.elapsed_ms_focused;
  state.stepTimer = null;
}

document.addEventListener("visibilitychange", () => {
  const timer = state.stepTimer;
  if (!timer) return;
  const now = performance.now();
  if (document.hidden && timer.focus_start_ms !== null) {
    timer.focused_ms += now - timer.focus_start_ms;
    timer.focus_start_ms = null;
  } else if (!document.hidden && timer.focus_start_ms === null) {
    timer.focus_start_ms = now;
  }
});

function enterStep(step) {
  state.step = { ...step };
  if (state.annotation) {
    state.annotation.current_step = { ...state.step };
  }
  state.selectedBoxId = null;
  state.drawing = null;
  state.dragging = null;
  $("#helpText")?.classList.add("hidden");
  startStepTimer(state.step);
  render();
}

function transitionTo(step) {
  finishStepTimer("next");
  state.annotation.navigation_history.push({ ...state.step });
  enterStep(step);
  markDirty(true);
  void saveAnnotationDebounced();
}

function restorePreviousStep() {
  if (!state.annotation?.navigation_history?.length) return;
  const reopensFinishedPage = state.step.id.startsWith("END_PAGE_");
  finishStepTimer("back");
  if (reopensFinishedPage) {
    state.annotation.status = "draft";
    state.annotation.finished_at = null;
    state.statuses[currentImage().image_id] = {
      status: "draft",
      updated_at: nowIso(),
      finished_at: null
    };
  }
  let previous = state.annotation.navigation_history.pop();
  while (previous && ["I4_gaze_eligible", "I10_teeth_visibility"].includes(previous.id) && state.annotation.navigation_history.length) {
    previous = state.annotation.navigation_history.pop();
  }
  enterStep(normalizeLoadedStep(previous));
  markDirty(true);
  void saveAnnotationDebounced();
}

function terminalStep(status, stepId) {
  state.annotation.status = status;
  state.annotation.finished_at = nowIso();
  return { id: stepId };
}

function addReviewFlagOnce(reason, step = state.step) {
  const flag = {
    step_id: step.id,
    reason,
    ad_id: step.adIndex !== undefined ? adByIndex(step.adIndex)?.ad_id || null : null,
    person_id: step.personId || null,
    group_id: step.groupId || null
  };
  const exists = state.annotation.review_flags.some((item) =>
    item.step_id === flag.step_id &&
    item.reason === flag.reason &&
    (item.ad_id || null) === flag.ad_id &&
    (item.person_id || null) === flag.person_id &&
    (item.group_id || null) === flag.group_id
  );
  if (!exists) state.annotation.review_flags.push({ ...flag, created_at: nowIso() });
}

function exactCountValue(value) {
  return /^[1-9]$/.test(String(value)) ? Number(value) : null;
}

function exactAdCountValue(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 99 ? number : null;
}

function ensureAdsForCount(value) {
  const count = exactAdCountValue(value);
  if (!count) return;
  while (state.annotation.advertisements.length < count) {
    state.annotation.advertisements.push(defaultAd(state.annotation.advertisements.length + 1));
  }
  state.annotation.advertisements.length = count;
}

function ensureSingleAd() {
  if (!state.annotation.advertisements.length) {
    state.annotation.advertisements.push(defaultAd(1));
  }
  state.annotation.advertisements.length = 1;
  return state.annotation.advertisements[0];
}

function allBoxedPeople(adIndex = null) {
  return state.annotation.advertisements.flatMap((ad, currentAdIndex) => {
    if (adIndex !== null && currentAdIndex !== adIndex) return [];
    return ad.people
      .filter((person) => person.face_bbox)
      .map((person) => ({ ad, adIndex: currentAdIndex, person }));
  });
}

function canonicalPeople(ad) {
  return ad.people.filter((person) => person.face_bbox && !person.duplicate_of_person_id);
}

function personStartStep(adIndex, person) {
  const ad = adByIndex(adIndex);
  return {
    id: ad.depiction_type === "multiple_types_present" ? "I0_person_depiction_type" : "I1_age",
    adIndex,
    personId: person.person_id,
    personIndex: adByIndex(adIndex).people.indexOf(person)
  };
}

function nextAdAfterCompletedAd(adIndex) {
  const nextIndex = adIndex + 1;
  if (nextIndex < state.annotation.advertisements.length) {
    return { id: "A2_ad_depiction_type", adIndex: nextIndex };
  }
  return terminalStep("complete", "END_PAGE_COMPLETE");
}

function firstDetailsInAd(adIndex) {
  const ad = adByIndex(adIndex);
  const people = canonicalPeople(ad);
  if (people.length) return personStartStep(adIndex, people[0]);
  if (ad.groups.length) {
    return { id: "G1_group_type", adIndex, groupId: ad.groups[0].group_id, groupIndex: 0 };
  }
  return nextAdAfterCompletedAd(adIndex);
}

function firstDetailsFromAd(startAdIndex = 0) {
  for (let adIndex = startAdIndex; adIndex < state.annotation.advertisements.length; adIndex += 1) {
    const ad = adByIndex(adIndex);
    if (canonicalPeople(ad).length || ad.groups.length) return firstDetailsInAd(adIndex);
  }
  return terminalStep("complete", "END_PAGE_COMPLETE");
}

function duplicateStepAd(step = state.step) {
  return step.adIndex !== undefined ? adByIndex(step.adIndex) : null;
}

function duplicatePeopleForStep(step = state.step) {
  return step.adIndex !== undefined ? allBoxedPeople(step.adIndex) : allBoxedPeople();
}

function duplicateScopeId(step = state.step) {
  return duplicateStepAd(step)?.ad_id || null;
}

function duplicateIdentityGroups(step = state.step) {
  const scopeId = duplicateScopeId(step);
  if (!scopeId) return state.annotation.face_identity_groups;
  return state.annotation.face_identity_groups.filter((group) => group.scope_ad_id === scopeId);
}

function duplicatePresenceForStep(step = state.step) {
  const ad = duplicateStepAd(step);
  return ad ? ad.duplicate_faces_present : state.annotation.page.duplicate_faces_present;
}

function duplicateUniqueCountForStep(step = state.step) {
  const ad = duplicateStepAd(step);
  return ad ? ad.unique_face_count : state.annotation.page.unique_face_count;
}

function duplicatePersonIdsForStep(step = state.step) {
  return new Set(duplicatePeopleForStep(step).map(({ person }) => person.person_id));
}

function syncPageDuplicateSummary() {
  const ads = state.annotation.advertisements || [];
  const values = ads.map((ad) => ad.duplicate_faces_present).filter(Boolean);
  state.annotation.page.duplicate_faces_present = values.includes("yes")
    ? "yes"
    : values.length === ads.length && ads.length
      ? "no"
      : null;
  state.annotation.page.unique_face_count = allBoxedPeople().filter(({ person }) => !person.duplicate_of_person_id).length || null;
}

function clearDuplicateLinks(step = state.step) {
  const personIds = duplicatePersonIdsForStep(step);
  const scopeId = duplicateScopeId(step);
  if (!personIds.size && !scopeId) return;
  state.annotation.face_identity_groups = state.annotation.face_identity_groups.filter((group) => {
    if (scopeId && group.scope_ad_id === scopeId) return false;
    if (!scopeId) return false;
    const ids = [group.main_person_id, ...(group.duplicate_person_ids || [])].filter(Boolean);
    return !ids.some((id) => personIds.has(id));
  });
  for (const { person } of duplicatePeopleForStep(step)) {
    person.duplicate_of_person_id = null;
    person.duplicate_person_ids = [];
  }
  syncPageDuplicateSummary();
}

function invalidateDuplicateResolution(ad = null) {
  const adIndex = ad ? state.annotation.advertisements.indexOf(ad) : undefined;
  const step = adIndex >= 0 ? { adIndex } : state.step;
  clearDuplicateLinks(step);
  const targetAd = ad || duplicateStepAd(step);
  if (targetAd) {
    targetAd.duplicate_faces_present = null;
    targetAd.unique_face_count = null;
  } else {
    state.annotation.page.duplicate_faces_present = null;
    state.annotation.page.unique_face_count = null;
  }
  syncPageDuplicateSummary();
}

function applyNoDuplicateLinks(step = state.step) {
  clearDuplicateLinks(step);
  const ad = duplicateStepAd(step);
  if (ad) {
    ad.duplicate_faces_present = "no";
    ad.unique_face_count = duplicatePeopleForStep(step).length;
  } else {
    state.annotation.page.duplicate_faces_present = "no";
    state.annotation.page.unique_face_count = allBoxedPeople().length;
  }
  syncPageDuplicateSummary();
}

function startDuplicateOrDetailsForAd(adIndex) {
  const step = { adIndex };
  const people = duplicatePeopleForStep(step);
  if (people.length < 2) {
    applyNoDuplicateLinks(step);
    return firstDetailsInAd(adIndex);
  }
  return { id: "D0_duplicates_present", adIndex };
}

function nextPersonOrAfter(step) {
  const ad = adByIndex(step.adIndex);
  const pool = canonicalPeople(ad);
  const current = personById(step.personId);
  const poolIndex = pool.indexOf(current);
  const next = pool[poolIndex + 1];
  if (next) {
    return personStartStep(step.adIndex, next);
  }
  if (ad.groups.length) {
    return { id: "G1_group_type", adIndex: step.adIndex, groupId: ad.groups[0].group_id, groupIndex: 0 };
  }
  return nextAdAfterCompletedAd(step.adIndex);
}

function firstGroupDetailOr(adIndex, fallback) {
  const ad = adByIndex(adIndex);
  if (!ad.groups.length) return typeof fallback === "function" ? fallback() : fallback;
  return { id: "G1_group_type", adIndex, groupId: ad.groups[0].group_id, groupIndex: 0 };
}

function nextGroupOrEnd(step) {
  const ad = adByIndex(step.adIndex);
  const group = groupById(step.groupId);
  const index = ad.groups.indexOf(group);
  const next = ad.groups[index + 1];
  if (next) {
    return { id: "G1_group_type", adIndex: step.adIndex, groupId: next.group_id, groupIndex: index + 1 };
  }
  return nextAdAfterCompletedAd(step.adIndex);
}

function getPersonField(step) {
  const person = personById(step.personId);
  return person;
}

function getGroupField(step) {
  return groupById(step.groupId);
}

function stepValue(step = state.step) {
  const ad = adByIndex(step.adIndex);
  const person = step.personId ? getPersonField(step) : null;
  const group = step.groupId ? getGroupField(step) : null;
  const map = {
    P1_qualifying_ad_count: () => state.annotation.page.qualifying_ad_count,
    P2_single_ad_full_page: () => ad?.extent,
    A2_ad_depiction_type: () => ad?.depiction_type,
    A3_unique_person_count: () => ad?.face_depiction_count_band,
    C1_outstanding_present: () => ad?.has_outstanding_individuals,
    D0_duplicates_present: () => duplicatePresenceForStep(step),
    D1_unique_face_count: () => duplicateUniqueCountForStep(step),
    G1_group_type: () => group?.group_type,
    G2_group_age: () => group?.age_composition,
    G3_group_gender: () => group?.gender_presentation_composition,
    G4_group_expression_legibility: () => group?.expression_legibility_distribution,
    G5_group_gaze: () => group?.dominant_gaze,
    G6_group_smile: () => group?.smile_prevalence,
    G7_group_smile_intensity: () => group?.dominant_smile_intensity,
    I0_person_depiction_type: () => person?.depiction_type,
    I1_age: () => person?.perceived_age,
    I2_gender: () => person?.perceived_gender_presentation,
    I3_orientation: () => person?.face_orientation,
    I4_expression_legibility: () => person?.face_expression_legibility,
    I5_gaze_target: () => person?.gaze_target,
    I6_mouth_covered: () => person?.mouth_covered,
    I7_mouth_covering: () => person?.mouth_covering,
    I7_covering_other_text: () => person?.mouth_covering_other_text,
    I8_smile_present: () => person?.smile_present,
    I9_smile_intensity: () => person?.smile_intensity
  };
  return map[step.id] ? map[step.id]() : null;
}

function setStepValue(value, step = state.step) {
  const ad = adByIndex(step.adIndex);
  const person = step.personId ? getPersonField(step) : null;
  const group = step.groupId ? getGroupField(step) : null;
  const map = {
    P1_qualifying_ad_count: () => {
      state.annotation.page.qualifying_ad_count = value;
      if (value === "0") state.annotation.advertisements = [];
      if (value === "1") ensureSingleAd();
      if (exactAdCountValue(value) && Number(value) > 1) ensureAdsForCount(value);
    },
    P2_single_ad_full_page: () => {
      ad.extent = value;
      if (value === "full_page") {
        ad.bbox = [0, 0, 1, 1];
        ad.bbox_source = "automatic_full_usable_page";
      } else if (ad.bbox_source === "automatic_full_usable_page") {
        ad.bbox = null;
        ad.bbox_source = null;
      }
    },
    A2_ad_depiction_type: () => {
      ad.depiction_type = value;
      if (value !== "multiple_types_present") {
        for (const item of ad.people) item.depiction_type = null;
      }
    },
    A3_unique_person_count: () => {
      setInitialFaceRoute(ad, value);
    },
    C1_outstanding_present: () => {
      ad.has_outstanding_individuals = value;
    },
    D0_duplicates_present: () => {
      const targetAd = duplicateStepAd(step);
      if (targetAd) {
        targetAd.duplicate_faces_present = value;
        targetAd.unique_face_count = value === "no" ? duplicatePeopleForStep(step).length : null;
      } else {
        state.annotation.page.duplicate_faces_present = value;
        state.annotation.page.unique_face_count = value === "no" ? allBoxedPeople().length : null;
      }
      clearDuplicateLinks(step);
      syncPageDuplicateSummary();
    },
    D1_unique_face_count: () => {
      const targetAd = duplicateStepAd(step);
      if (targetAd) targetAd.unique_face_count = Number(value);
      else state.annotation.page.unique_face_count = Number(value);
      clearDuplicateLinks(step);
      for (const { person: item } of duplicatePeopleForStep(step)) {
        item.duplicate_of_person_id = null;
        item.duplicate_person_ids = [];
      }
    },
    G1_group_type: () => {
      group.group_type = value;
    },
    G2_group_age: () => {
      group.age_composition = value;
    },
    G3_group_gender: () => {
      group.gender_presentation_composition = value;
    },
    G4_group_expression_legibility: () => {
      group.expression_legibility_distribution = value;
      if (value === "all_0_not_legible") {
        group.dominant_gaze = null;
        group.smile_prevalence = null;
        group.dominant_smile_intensity = null;
      }
    },
    G5_group_gaze: () => {
      group.dominant_gaze = value;
    },
    G6_group_smile: () => {
      group.smile_prevalence = value;
      if (value === "none" || value === "not_assessable") {
        group.dominant_smile_intensity = "not_applicable";
      } else if (group.dominant_smile_intensity === "not_applicable") {
        group.dominant_smile_intensity = null;
      }
    },
    G7_group_smile_intensity: () => {
      group.dominant_smile_intensity = value;
    },
    I0_person_depiction_type: () => {
      person.depiction_type = value;
    },
    I1_age: () => {
      person.perceived_age = value;
    },
    I2_gender: () => {
      person.perceived_gender_presentation = value;
    },
    I3_orientation: () => {
      person.face_orientation = value;
    },
    I4_expression_legibility: () => {
      person.face_expression_legibility = value;
      if (value === "0_not_legible") {
        person.gaze_target = null;
        person.gaze_target_person_id = null;
        person.gaze_target_person_unboxed = null;
        person.gaze_target_object_ref = null;
        person.smile_present = null;
        person.smile_intensity = null;
      }
    },
    I5_gaze_target: () => {
      person.gaze_target = value;
      if (value !== "another_person") {
        person.gaze_target_person_id = null;
        person.gaze_target_person_unboxed = null;
      } else {
        person.gaze_target_person_id = null;
        person.gaze_target_person_unboxed = null;
      }
    },
    I6_mouth_covered: () => {
      const previous = person.mouth_covered;
      person.mouth_covered = value;
      if (previous !== value) {
        person.mouth_covering = null;
        person.mouth_covering_other_text = null;
        person.smile_present = null;
        person.smile_intensity = null;
      }
    },
    I7_mouth_covering: () => {
      person.mouth_covering = value;
      if (value !== "other") person.mouth_covering_other_text = null;
    },
    I8_smile_present: () => {
      person.smile_present = value;
      if (value !== "yes") person.smile_intensity = null;
    },
    I9_smile_intensity: () => {
      person.smile_intensity = value;
    }
  };
  if (map[step.id]) {
    map[step.id]();
    markDirty(true);
    renderInput();
    renderOverlay();
    updateNavState();
    void saveAnnotationDebounced();
  }
}

function choiceValuesForStep(step) {
  const map = {
    P1_qualifying_ad_count: ["0", "1", "2", "3", "4", "5"],
    P2_single_ad_full_page: ["full_page", "partial_page"],
    A2_ad_depiction_type: ENUMS.depiction_type,
    A3_unique_person_count: CROWD_FACE_BAND_VALUES,
    C1_outstanding_present: ENUMS.yes_no,
    D0_duplicates_present: ENUMS.yes_no,
    G1_group_type: ENUMS.group_type,
    G2_group_age: ENUMS.group_age_composition,
    G3_group_gender: ENUMS.group_gender_composition,
    G4_group_expression_legibility: ENUMS.group_expression_legibility,
    G5_group_gaze: ENUMS.group_gaze,
    G6_group_smile: ENUMS.group_smile_prevalence,
    G7_group_smile_intensity: ENUMS.group_smile_intensity,
    I0_person_depiction_type: PERSON_DEPICTION_TYPES,
    I1_age: ENUMS.individual_age,
    I2_gender: ENUMS.gender_presentation,
    I3_orientation: ENUMS.face_orientation,
    I4_expression_legibility: ENUMS.face_expression_legibility,
    I5_gaze_target: ENUMS.gaze_target,
    I6_mouth_covered: ENUMS.mouth_covered,
    I7_mouth_covering: ENUMS.mouth_covering,
    I8_smile_present: ENUMS.smile_presence,
    I9_smile_intensity: ENUMS.smile_intensity
  };
  return map[step.id] || [];
}

function isChoiceStep(step = state.step) {
  return choiceValuesForStep(step).length > 0;
}

function isMultiStep(step = state.step) {
  return false;
}

function currentBboxSpec(step = state.step) {
  if (!state.annotation) return null;
  const ad = adByIndex(step.adIndex);
  if (step.id === "A1_ad_bbox") {
    return {
      mode: "single",
      type: "ad",
      labelPrefix: "Ad",
      getBoxes: () => ad.bbox ? [{ id: `${ad.ad_id}:bbox`, bbox: ad.bbox, type: "ad", label: ad.ad_id }] : [],
      setBox: (bbox) => {
        ad.bbox = bbox;
        ad.bbox_source = "manual";
      },
      deleteBox: () => {
        ad.bbox = null;
        ad.bbox_source = null;
      },
      required: 1,
      max: 1
    };
  }
  if (step.id === "DRAW_AD_BOXES") {
    const exact = exactAdCountValue(state.annotation.page.qualifying_ad_count);
    return {
      mode: "collection",
      type: "ad",
      labelPrefix: "Ad",
      collection: state.annotation.advertisements,
      getBoxes: () => state.annotation.advertisements.filter((item) => item.bbox).map((item) => ({ id: `${item.ad_id}:bbox`, bbox: item.bbox, type: "ad", label: item.ad_id })),
      create: (bbox) => {
        const adItem = state.annotation.advertisements.find((item) => !item.bbox);
        if (!adItem) return;
        adItem.bbox = bbox;
        adItem.bbox_source = "manual";
      },
      update: (id, bbox) => {
        const found = state.annotation.advertisements.find((item) => `${item.ad_id}:bbox` === id);
        if (found) found.bbox = bbox;
      },
      remove: (id) => {
        const found = state.annotation.advertisements.find((item) => `${item.ad_id}:bbox` === id);
        if (found) {
          found.bbox = null;
          found.bbox_source = null;
        }
      },
      required: exact || 1,
      max: exact || Infinity
    };
  }
  if (step.id === "A3_unique_person_count" || step.id === "DRAW_OUTSTANDING_INDIVIDUAL_BOXES") {
    const isInitialFaceDrawing = step.id === "A3_unique_person_count";
    if (isInitialFaceDrawing && CROWD_FACE_BANDS.has(ad.face_depiction_count_band)) return null;
    const role = isInitialFaceDrawing ? "individual" : "outstanding_individual";
    const pool = () => ad.people.filter((person) => person.annotation_role === role);
    const syncDerivedCount = () => {
      if (isInitialFaceDrawing) {
        const count = pool().filter((person) => person.face_bbox).length;
        ad.face_depiction_count_band = count ? String(count) : null;
      }
    };
    return {
      mode: "collection",
      type: "person",
      labelPrefix: "P",
      getBoxes: () => pool().filter((person) => person.face_bbox).map((person) => ({ id: person.person_id, bbox: person.face_bbox, type: "person", label: person.person_id })),
      create: (bbox) => {
        const person = defaultPerson(ad, role);
        person.face_bbox = bbox;
        ad.people.push(person);
        syncDerivedCount();
        invalidateDuplicateResolution(ad);
      },
      update: (id, bbox) => {
        const person = personById(id);
        if (person) person.face_bbox = bbox;
      },
      remove: (id) => {
        ad.people = ad.people.filter((person) => person.person_id !== id);
        syncDerivedCount();
        invalidateDuplicateResolution(ad);
        for (const person of ad.people) {
          if (person.gaze_target_person_id === id) {
            person.gaze_target = null;
            person.gaze_target_person_id = null;
            person.gaze_target_person_unboxed = null;
          }
        }
      },
      required: 1,
      max: isInitialFaceDrawing ? 9 : Infinity
    };
  }
  if (step.id === "DRAW_GROUP_BOXES") {
    return {
      mode: "collection",
      type: "group",
      labelPrefix: "G",
      getBoxes: () => ad.groups.filter((group) => group.bbox).map((group) => ({ id: group.group_id, bbox: group.bbox, type: "group", label: group.group_id })),
      create: (bbox) => {
        const group = defaultGroup(ad);
        group.bbox = bbox;
        ad.groups.push(group);
      },
      update: (id, bbox) => {
        const group = groupById(id);
        if (group) group.bbox = bbox;
      },
      remove: (id) => {
        ad.groups = ad.groups.filter((group) => group.group_id !== id);
      },
      required: 1,
      max: Infinity
    };
  }
  return null;
}

function allRenderableBoxes() {
  if (!state.annotation) return [];
  const boxes = [];
  for (const ad of state.annotation.advertisements) {
    if (ad.bbox) boxes.push({ id: `${ad.ad_id}:bbox`, bbox: ad.bbox, type: "ad", label: ad.ad_id });
    for (const group of ad.groups) {
      if (group.bbox) boxes.push({ id: group.group_id, bbox: group.bbox, type: "group", label: group.group_id });
    }
    for (const person of ad.people) {
      if (person.face_bbox) boxes.push({ id: person.person_id, bbox: person.face_bbox, type: "person", label: person.person_id });
    }
  }
  if (state.drawing?.bbox) {
    boxes.push({ id: "pending", bbox: state.drawing.bbox, type: currentBboxSpec()?.type || "person", label: "", pending: true });
  }
  return boxes;
}

function identityGroupAt(index, create = false, step = state.step) {
  const scopedGroups = duplicateIdentityGroups(step);
  if (create) {
    const scopeId = duplicateScopeId(step);
    while (scopedGroups.length <= index) {
      const next = state.annotation.face_identity_groups.length + 1;
      const group = {
        identity_group_id: `identity_${next}`,
        main_person_id: null,
        duplicate_person_ids: []
      };
      if (scopeId) group.scope_ad_id = scopeId;
      state.annotation.face_identity_groups.push(group);
      scopedGroups.push(group);
    }
  }
  return scopedGroups[index] || null;
}

function assignedFaceIds(beforeGroupIndex = Infinity, step = state.step) {
  const assigned = new Set();
  duplicateIdentityGroups(step).forEach((group, index) => {
    if (index >= beforeGroupIndex) return;
    if (group.main_person_id) assigned.add(group.main_person_id);
    for (const id of group.duplicate_person_ids || []) assigned.add(id);
  });
  return assigned;
}

function duplicateGroupContext(step = state.step) {
  const index = step.identityGroupIndex || 0;
  const group = identityGroupAt(index, true, step);
  const assignedBefore = assignedFaceIds(index, step);
  const candidateIds = duplicatePeopleForStep(step).map(({ person }) => person.person_id);
  return { index, group, assignedBefore, candidateIds };
}

function applyIdentityGroups(step = state.step) {
  for (const { person } of duplicatePeopleForStep(step)) {
    person.duplicate_of_person_id = null;
    person.duplicate_person_ids = [];
  }
  for (const group of duplicateIdentityGroups(step)) {
    const main = personById(group.main_person_id);
    if (!main) continue;
    main.duplicate_person_ids = [...group.duplicate_person_ids];
    for (const duplicateId of group.duplicate_person_ids) {
      const duplicate = personById(duplicateId);
      if (duplicate) duplicate.duplicate_of_person_id = main.person_id;
    }
  }
  syncPageDuplicateSummary();
}

function handleDuplicateFaceSelection(id) {
  const person = personById(id);
  if (!person?.face_bbox) return;
  const { index, group, assignedBefore, candidateIds } = duplicateGroupContext();
  if (!candidateIds.includes(id)) return;
  if (assignedBefore.has(id)) return;
  state.annotation.face_identity_groups.length = index + 1;
  if (state.step.id === "D2_select_main") {
    group.main_person_id = id;
    group.duplicate_person_ids = [];
    state.selectedBoxId = id;
  } else if (state.step.id === "D3_select_duplicates" && id !== group.main_person_id) {
    const selected = new Set(group.duplicate_person_ids);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    group.duplicate_person_ids = [...selected];
    state.selectedBoxId = id;
  }
  markDirty();
  render();
  void saveAnnotationDebounced();
}

function validationMessage(step = state.step) {
  const spec = currentBboxSpec(step);
  if (spec) {
    const count = spec.getBoxes().length;
    if (count < spec.required) return state.language === "de"
      ? `Erforderliche Boxen: ${spec.required}. Aktuelle Boxen: ${count}.`
      : `Required boxes: ${spec.required}. Current boxes: ${count}.`;
    if (Number.isFinite(spec.max) && spec.max === spec.required && count !== spec.max) {
      return state.language === "de"
        ? `Zeichne genau ${spec.max} Boxen. Aktuelle Boxen: ${count}.`
        : `Draw exactly ${spec.max} boxes. Current boxes: ${count}.`;
    }
    return "";
  }
  if (isMultiStep(step)) {
    const values = stepValue(step);
    return Array.isArray(values) && values.length ? "" : t("select_at_least_one");
  }
  if (step.id === "I5_target_person") {
    const person = personById(step.personId);
    return person?.gaze_target_person_id || person?.gaze_target_person_unboxed === true
      ? ""
      : t("click_person_or_unboxed");
  }
  if (step.id === "D1_unique_face_count") {
    const total = duplicatePeopleForStep(step).length;
    const count = Number(duplicateUniqueCountForStep(step));
    return Number.isInteger(count) && count >= 1 && count < total
      ? ""
      : state.language === "de"
        ? `Gib eine ganze Zahl von 1 bis ${Math.max(total - 1, 1)} ein.`
        : `Enter a whole number from 1 to ${Math.max(total - 1, 1)}.`;
  }
  if (step.id === "D2_select_main") {
    return duplicateGroupContext(step).group.main_person_id ? "" : t("select_one_main_face");
  }
  if (step.id === "D3_select_duplicates") {
    const { index, group, assignedBefore, candidateIds } = duplicateGroupContext(step);
    const selectedNow = new Set([group.main_person_id, ...(group.duplicate_person_ids || [])]);
    const remainingAfter = candidateIds.filter((id) => !assignedBefore.has(id) && !selectedNow.has(id)).length;
    const groupCount = Number(duplicateUniqueCountForStep(step));
    const groupsAfter = groupCount - index - 1;
    if (remainingAfter < groupsAfter) return state.language === "de"
      ? `Lass mindestens ${groupsAfter} Gesicht${groupsAfter === 1 ? "" : "er"} für die verbleibenden Identitäten übrig.`
      : `Leave at least ${groupsAfter} face${groupsAfter === 1 ? "" : "s"} for the remaining identities.`;
    if (groupsAfter === 0 && remainingAfter > 0) return state.language === "de"
      ? `Ordne die verbleibenden ${remainingAfter} Gesicht${remainingAfter === 1 ? "" : "er"} dieser Person zu.`
      : `Assign the remaining ${remainingAfter} face${remainingAfter === 1 ? "" : "s"} to this person.`;
    return "";
  }
  if (step.id === "I7_covering_other_text") {
    return String(stepValue(step) || "").trim() ? "" : t("enter_short_description");
  }
  if (isChoiceStep(step)) {
    const value = stepValue(step);
    return value === null || value === undefined || value === "" ? t("select_one_option") : "";
  }
  return "";
}

function canAdvance() {
  return !validationMessage();
}

function commitP1ManualInputIfPresent() {
  if (state.step.id !== "P1_qualifying_ad_count") return true;
  const input = $("#manualAdCount");
  if (!input || !input.value.trim()) return true;
  const raw = Number(input.value);
  if (!Number.isInteger(raw) || raw < 6 || raw > 99) {
    input.setAttribute("aria-invalid", "true");
    input.focus();
    $("#saveStatus").textContent = t("enter_integer_6_99");
    $("#saveStatus").className = "status-line error";
    return false;
  }
  input.removeAttribute("aria-invalid");
  setStepValue(String(raw));
  return true;
}

function nextStepForCurrent() {
  const step = state.step;
  const ad = adByIndex(step.adIndex);
  const person = step.personId ? personById(step.personId) : null;
  const group = step.groupId ? groupById(step.groupId) : null;
  switch (step.id) {
    case "P1_qualifying_ad_count": {
      const value = state.annotation.page.qualifying_ad_count;
      if (value === "0") return terminalStep("ineligible", "END_PAGE_INELIGIBLE");
      if (value === "1") return { id: "P2_single_ad_full_page", adIndex: 0 };
      if (exactAdCountValue(value)) return { id: "DRAW_AD_BOXES" };
      return step;
    }
    case "P2_single_ad_full_page":
      return ad.extent === "full_page" ? { id: "A2_ad_depiction_type", adIndex: 0 } : { id: "A1_ad_bbox", adIndex: 0 };
    case "A1_ad_bbox":
      return { id: "A2_ad_depiction_type", adIndex: step.adIndex };
    case "DRAW_AD_BOXES":
      return { id: "A2_ad_depiction_type", adIndex: 0 };
    case "A2_ad_depiction_type":
      return { id: "A3_unique_person_count", adIndex: step.adIndex };
    case "A3_unique_person_count": {
      if (CROWD_FACE_BANDS.has(ad.face_depiction_count_band)) {
        return { id: "C1_outstanding_present", adIndex: step.adIndex };
      }
      return startDuplicateOrDetailsForAd(step.adIndex);
    }
    case "DRAW_ALL_INDIVIDUAL_BOXES":
      return startDuplicateOrDetailsForAd(step.adIndex);
    case "C1_outstanding_present":
      return ad.has_outstanding_individuals === "no"
        ? { id: "DRAW_GROUP_BOXES", adIndex: step.adIndex }
        : { id: "DRAW_OUTSTANDING_INDIVIDUAL_BOXES", adIndex: step.adIndex };
    case "DRAW_OUTSTANDING_INDIVIDUAL_BOXES":
      return { id: "DRAW_GROUP_BOXES", adIndex: step.adIndex };
    case "DRAW_GROUP_BOXES":
      return startDuplicateOrDetailsForAd(step.adIndex);
    case "D0_duplicates_present":
      if (duplicatePresenceForStep(step) === "no") {
        applyNoDuplicateLinks(step);
        return step.adIndex !== undefined ? firstDetailsInAd(step.adIndex) : firstDetailsFromAd(0);
      }
      clearDuplicateLinks(step);
      return { id: "D1_unique_face_count", adIndex: step.adIndex };
    case "D1_unique_face_count":
      return { id: "D2_select_main", adIndex: step.adIndex, identityGroupIndex: 0 };
    case "D2_select_main":
      return { id: "D3_select_duplicates", adIndex: step.adIndex, identityGroupIndex: step.identityGroupIndex };
    case "D3_select_duplicates": {
      const nextGroupIndex = step.identityGroupIndex + 1;
      if (nextGroupIndex < Number(duplicateUniqueCountForStep(step))) {
        return { id: "D2_select_main", adIndex: step.adIndex, identityGroupIndex: nextGroupIndex };
      }
      applyIdentityGroups(step);
      return step.adIndex !== undefined ? firstDetailsInAd(step.adIndex) : firstDetailsFromAd(0);
    }
    case "G1_group_type":
      return { id: "G2_group_age", adIndex: step.adIndex, groupId: step.groupId, groupIndex: step.groupIndex };
    case "G2_group_age":
      return { id: "G3_group_gender", adIndex: step.adIndex, groupId: step.groupId, groupIndex: step.groupIndex };
    case "G3_group_gender":
      return { id: "G4_group_expression_legibility", adIndex: step.adIndex, groupId: step.groupId, groupIndex: step.groupIndex };
    case "G4_group_expression_legibility":
      return group.expression_legibility_distribution === "all_0_not_legible"
        ? nextGroupOrEnd(step)
        : { id: "G5_group_gaze", adIndex: step.adIndex, groupId: step.groupId, groupIndex: step.groupIndex };
    case "G5_group_gaze":
      return { id: "G6_group_smile", adIndex: step.adIndex, groupId: step.groupId, groupIndex: step.groupIndex };
    case "G6_group_smile":
      return group.smile_prevalence === "none" || group.smile_prevalence === "not_assessable"
        ? nextGroupOrEnd(step)
        : { id: "G7_group_smile_intensity", adIndex: step.adIndex, groupId: step.groupId, groupIndex: step.groupIndex };
    case "G7_group_smile_intensity":
      return nextGroupOrEnd(step);
    case "I0_person_depiction_type":
      return { ...step, id: "I1_age" };
    case "I1_age":
      return { ...step, id: "I2_gender" };
    case "I2_gender":
      return { ...step, id: "I4_expression_legibility" };
    case "I4_expression_legibility":
      if (person.face_orientation) {
        return person.face_expression_legibility === "0_not_legible"
          ? { ...step, id: "I6_mouth_covered" }
          : { ...step, id: "I5_gaze_target" };
      }
      return { ...step, id: "I3_orientation" };
    case "I3_orientation":
      if (!person.face_expression_legibility) {
        return { ...step, id: "I4_expression_legibility" };
      }
      if (person.face_expression_legibility === "0_not_legible") {
        return { ...step, id: "I6_mouth_covered" };
      }
      return { ...step, id: "I5_gaze_target" };
    case "I5_gaze_target":
      if (person.gaze_target === "another_person") {
        return { ...step, id: "I5_target_person" };
      }
      return { ...step, id: "I6_mouth_covered" };
    case "I5_target_person":
      return { ...step, id: "I6_mouth_covered" };
    case "I6_mouth_covered":
      return person.mouth_covered === "yes" || person.mouth_covered === "partly"
        ? { ...step, id: "I7_mouth_covering" }
        : person.face_expression_legibility === "0_not_legible"
          ? nextPersonOrAfter(step)
          : { ...step, id: "I8_smile_present" };
    case "I7_mouth_covering":
      if (person.mouth_covering === "other") return { ...step, id: "I7_covering_other_text" };
      return person.face_expression_legibility === "0_not_legible"
        ? nextPersonOrAfter(step)
        : { ...step, id: "I8_smile_present" };
    case "I7_covering_other_text":
      return person.face_expression_legibility === "0_not_legible"
        ? nextPersonOrAfter(step)
        : { ...step, id: "I8_smile_present" };
    case "I8_smile_present":
      return person.smile_present === "yes" ? { ...step, id: "I9_smile_intensity" } : nextPersonOrAfter(step);
    case "I9_smile_intensity":
      return nextPersonOrAfter(step);
    default:
      return step;
  }
}

function advance() {
  if (state.step.id.startsWith("END_PAGE_")) {
    if (state.currentIndex < state.manifest.images.length - 1) {
      void loadImage(state.currentIndex + 1, { allowSequentialNext: true });
    } else {
      void showCompletionView();
    }
    return;
  }
  if (!commitP1ManualInputIfPresent()) return;
  const message = validationMessage();
  if (message) {
    $("#saveStatus").textContent = message;
    $("#saveStatus").className = "status-line error";
    return;
  }
  transitionTo(nextStepForCurrent());
}

function markDirty() {
  if (!state.annotation) return;
  state.dirty = true;
  state.changeVersion += 1;
  state.annotation.updated_at = nowIso();
  $("#saveStatus").textContent = "";
  $("#saveStatus").className = "status-line";
}

async function saveAnnotationNow() {
  if (!state.session || !state.annotation) return;
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }
  if (state.savePromise) await state.savePromise;
  if (!state.dirty) return;
  const image = currentImage();
  const annotation = state.annotation;
  const saveVersion = state.changeVersion;
  annotation.current_step = { ...state.step };
  annotation.updated_at = nowIso();
  const operation = (async () => {
    try {
      const saved = await postJson("/api/annotation", {
        session_id: state.session.session_id,
        image_id: image.image_id,
        revision: state.annotationRevision,
        annotation
      });
      state.annotationRevision = Number(saved.revision || state.annotationRevision);
      state.statuses[image.image_id] = {
        status: annotation.status,
        updated_at: annotation.updated_at,
        finished_at: annotation.finished_at
      };
      state.annotationPersisted = true;
      state.dirty = state.changeVersion !== saveVersion;
      $("#saveStatus").textContent = "";
      $("#saveStatus").className = "status-line";
      renderImageList();
      updateProgress();
      if (state.dirty) saveAnnotationDebounced();
    } catch (error) {
      $("#saveStatus").textContent = error.message;
      $("#saveStatus").className = "status-line error";
      state.dirty = true;
      if (error.code === "revision_conflict") {
        const dialog = $("#saveConflictDialog");
        if (dialog && !dialog.open) dialog.showModal();
      }
    }
  })();
  state.savePromise = operation;
  try {
    await operation;
  } finally {
    if (state.savePromise === operation) state.savePromise = null;
  }
}

function saveAnnotationDebounced() {
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    void saveAnnotationNow();
  }, 350);
}

function autoAdvanceAfterChoice() {
  const sourceStepKey = currentStepKey();
  window.setTimeout(() => {
    if (currentStepKey() === sourceStepKey && !state.step.id.startsWith("END_PAGE_") && state.step.id !== "I5_target_person" && !currentBboxSpec()) {
      advance();
    }
  }, 120);
}

function renderChoice(values, selected, multi = false) {
  const container = document.createElement("div");
  container.className = "choice-grid";
  const many = values.length > 9;
  if (many) container.classList.add("many");
  values.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.dataset.value = value;
    if (value === "multiple_types_present") button.classList.add("multiple-types-choice");
    const isSelected = multi ? selected.includes(value) : selected === value;
    if (isSelected) button.classList.add("selected");
    button.textContent = labelize(value);
    button.addEventListener("click", () => {
      if (multi) {
        const next = new Set(selected);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        setStepValue([...next]);
      } else {
        setStepValue(value);
        autoAdvanceAfterChoice();
      }
    });
    container.appendChild(button);
  });
  return container;
}

function renderP1CountInput() {
  const wrapper = document.createElement("div");
  wrapper.className = "count-input";
  const quickCounts = renderChoice(["0", "1", "2", "3", "4", "5"], stepValue(state.step), false);
  wrapper.appendChild(quickCounts);

  const manual = document.createElement("div");
  manual.className = "manual-count-row";
  manual.innerHTML = `
    <label>
      ${escapeHtml(t("higher_count"))}
      <input id="manualAdCount" type="number" min="6" max="99" step="1" inputmode="numeric" placeholder="6-99">
    </label>
  `;
  wrapper.appendChild(manual);

  window.setTimeout(() => {
    const input = $("#manualAdCount", wrapper);
    const commit = () => {
      const raw = Number(input.value);
      if (!Number.isInteger(raw) || raw < 6 || raw > 99) {
        input.setAttribute("aria-invalid", "true");
        input.focus();
        $("#saveStatus").textContent = t("enter_integer_6_99");
        $("#saveStatus").className = "status-line error";
        return;
      }
      input.removeAttribute("aria-invalid");
      const value = String(raw);
      setStepValue(value);
      window.setTimeout(() => {
        if (canAdvance()) advance();
      }, 80);
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      }
    });
    input.addEventListener("input", () => {
      input.removeAttribute("aria-invalid");
      $("#saveStatus").textContent = "";
      $("#saveStatus").className = "status-line";
    });
  }, 0);

  return wrapper;
}

function renderUniqueFaceCountInput() {
  const total = duplicatePeopleForStep(state.step).length;
  const values = Array.from({ length: Math.max(total - 1, 0) }, (_, index) => String(index + 1));
  return renderChoice(values, String(stepValue(state.step) || ""), false);
}

function renderA3FaceRouteInput(ad) {
  const selected = CROWD_FACE_BANDS.has(ad.face_depiction_count_band)
    ? ad.face_depiction_count_band
    : "only_individuals";
  const container = document.createElement("div");
  container.className = "choice-grid";
  ["only_individuals", ...CROWD_FACE_BAND_VALUES].forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.dataset.value = value;
    if (selected === value) button.classList.add("selected");
    button.textContent = labelize(value);
    button.addEventListener("click", () => {
      setInitialFaceRoute(ad, value);
      markDirty();
      renderInput();
      renderOverlay();
      updateNavState();
      void saveAnnotationDebounced();
    });
    container.appendChild(button);
  });
  return container;
}

function renderDuplicateSelectionStatus() {
  const { index, group, assignedBefore, candidateIds } = duplicateGroupContext();
  const wrapper = document.createElement("div");
  wrapper.className = "selection-status";
  const groupCount = Number(duplicateUniqueCountForStep(state.step));
  const selectedDuplicates = group.duplicate_person_ids || [];
  const assignedNow = new Set([group.main_person_id, ...selectedDuplicates].filter(Boolean));
  const available = candidateIds.filter((id) => !assignedBefore.has(id) && !assignedNow.has(id));
  const heading = document.createElement("strong");
  heading.textContent = state.language === "de"
    ? `Eindeutiges Gesicht ${index + 1} von ${groupCount}`
    : `Unique face ${index + 1} of ${groupCount}`;
  wrapper.appendChild(heading);
  const detail = document.createElement("p");
  if (state.step.id === "D2_select_main") {
    detail.textContent = group.main_person_id
      ? state.language === "de" ? `Hauptgesicht: ${group.main_person_id}` : `Main face: ${group.main_person_id}`
      : state.language === "de" ? "Kein Hauptgesicht ausgewählt." : "No main face selected.";
  } else {
    detail.textContent = selectedDuplicates.length
      ? state.language === "de" ? `Ausgewählte Duplikate: ${selectedDuplicates.join(", ")}` : `Selected duplicates: ${selectedDuplicates.join(", ")}`
      : state.language === "de" ? "Keine Duplikate für diese Identität ausgewählt." : "No duplicates selected for this identity.";
  }
  wrapper.appendChild(detail);
  const remaining = document.createElement("p");
  remaining.className = "instruction";
  remaining.textContent = state.language === "de"
    ? `${available.length} nicht zugeordnete Gesichts-Box${available.length === 1 ? "" : "en"} bleiben nach dieser Gruppe übrig.`
    : `${available.length} unassigned face box${available.length === 1 ? "" : "es"} ${available.length === 1 ? "remains" : "remain"} after this group.`;
  wrapper.appendChild(remaining);
  return wrapper;
}

function renderCoveringOtherInput() {
  const label = document.createElement("label");
  label.textContent = t("other_covering");
  const input = document.createElement("input");
  input.id = "coveringOtherText";
  input.type = "text";
  input.maxLength = 240;
  input.placeholder = t("short_description");
  input.value = stepValue(state.step) || "";
  input.addEventListener("input", () => {
    const person = personById(state.step.personId);
    person.mouth_covering_other_text = input.value;
    markDirty();
    updateNavState();
    void saveAnnotationDebounced();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && input.value.trim()) {
      event.preventDefault();
      advance();
    }
  });
  label.appendChild(input);
  window.setTimeout(() => input.focus(), 0);
  return label;
}

function renderInput() {
  const area = $("#inputArea");
  area.innerHTML = "";
  const step = state.step;
  const spec = currentBboxSpec(step);
  if (step.id === "A3_unique_person_count") {
    const ad = adByIndex(step.adIndex);
    const count = ad.people.filter((person) => person.annotation_role === "individual" && person.face_bbox).length;
    const countText = document.createElement("p");
    countText.className = "face-box-count";
    countText.textContent = state.language === "de" ? `Gesichter markiert: ${count} / 9` : `Faces boxed: ${count} / 9`;
    area.appendChild(countText);

    const crowdRoute = document.createElement("div");
    crowdRoute.className = "crowd-route";
    const label = document.createElement("strong");
    label.textContent = t("face_route");
    crowdRoute.appendChild(label);
    crowdRoute.appendChild(renderA3FaceRouteInput(ad));
    area.appendChild(crowdRoute);
    return;
  }
  if (spec) {
    const count = spec.getBoxes().length;
    const target = Number.isFinite(spec.max) && spec.max === spec.required
      ? `${t("boxes")}: ${count} / ${spec.required}`
      : `${t("boxes")}: ${count}`;
    const p = document.createElement("p");
    p.className = "instruction";
    p.textContent = target;
    area.appendChild(p);
    return;
  }
  if (step.id === "P1_qualifying_ad_count") {
    area.appendChild(renderP1CountInput());
    return;
  }
  if (step.id === "D1_unique_face_count") {
    area.appendChild(renderUniqueFaceCountInput());
    return;
  }
  if (step.id === "D2_select_main" || step.id === "D3_select_duplicates") {
    area.appendChild(renderDuplicateSelectionStatus());
    return;
  }
  if (step.id === "I5_target_person") {
    const person = personById(step.personId);
    const p = document.createElement("p");
    p.className = "instruction";
    if (person?.gaze_target_person_id) p.textContent = state.language === "de" ? `Ausgewählt: ${person.gaze_target_person_id}` : `Selected: ${person.gaze_target_person_id}`;
    else if (person?.gaze_target_person_unboxed === true) p.textContent = t("selected_person_without_box");
    else p.textContent = t("no_target_selected");
    area.appendChild(p);

    const unboxedButton = document.createElement("button");
    unboxedButton.type = "button";
    unboxedButton.className = "choice-button";
    if (person?.gaze_target_person_unboxed === true) unboxedButton.classList.add("selected");
    unboxedButton.textContent = t("person_without_box");
    unboxedButton.addEventListener("click", () => {
      person.gaze_target_person_id = null;
      person.gaze_target_person_unboxed = true;
      state.selectedBoxId = null;
      markDirty();
      advance();
    });
    const choices = document.createElement("div");
    choices.className = "choice-grid";
    choices.appendChild(unboxedButton);
    area.appendChild(choices);
    return;
  }
  if (step.id === "I7_covering_other_text") {
    area.appendChild(renderCoveringOtherInput());
    return;
  }
  const values = choiceValuesForStep(step);
  if (values.length) {
    area.appendChild(renderChoice(values, stepValue(step), false));
  }
}

function stepOrdinalText() {
  return STEP_META[state.step.id]?.unit || (state.language === "de" ? "Schritt" : "Step");
}

function currentHierarchyParts() {
  const parts = [];
  if (state.step.adIndex !== undefined) {
    parts.push(adByIndex(state.step.adIndex)?.ad_id || `ad${state.step.adIndex + 1}`);
  }
  if (state.step.personId) parts.push(state.step.personId);
  if (state.step.groupId) parts.push(state.step.groupId);
  if (state.step.identityGroupIndex !== undefined) {
    parts.push(`${state.language === "de" ? "Identität" : "identity"} ${state.step.identityGroupIndex + 1}/${duplicateUniqueCountForStep(state.step)}`);
  }
  return parts;
}

function stepKickerText() {
  const unit = stepOrdinalText();
  const hierarchy = currentHierarchyParts();
  return hierarchy.length ? `${unit} ${hierarchy.join("/")}` : unit;
}

function renderContextSummary() {
  const panel = $("#contextSummary");
  if (panel) panel.innerHTML = "";
  const image = currentImage();
  const bottom = $("#bottomFilename");
  if (bottom) {
    bottom.textContent = image?.filename || "";
    bottom.title = image?.filename || "";
  }
}

function renderStepPanel() {
  const meta = STEP_META[state.step.id] || STEP_META.P1_qualifying_ad_count;
  const finalTerminal = state.step.id.startsWith("END_PAGE_") && state.currentIndex >= state.manifest.images.length - 1;
  $("#stepKicker").textContent = stepKickerText();
  $("#questionText").textContent = meta.prompt;
  $("#instructionText").textContent = finalTerminal ? t("final_terminal_instruction") : meta.instruction || "";
  $("#helpText").textContent = meta.help || "";
  $("#helpButton").disabled = !meta.help;
  renderInput();
  renderContextSummary();
  updateNavState();
}

function updateNavState() {
  const terminal = state.step.id.startsWith("END_PAGE_");
  const finalPage = state.currentIndex >= state.manifest.images.length - 1;
  $("#backButton").disabled = !state.annotation?.navigation_history?.length;
  $("#backButton").textContent = terminal ? t("edit_annotation") : t("back");
  $("#nextButton").disabled = terminal
    ? state.completionLoading
    : state.step.id === "P1_qualifying_ad_count" ? false : !canAdvance();
  $("#nextButton").textContent = terminal
    ? finalPage ? t("finish_task") : t("next_page")
    : currentBboxSpec() ? t("done") : t("next");
}

function taskIsComplete() {
  return Boolean(state.manifest?.images?.length) && state.manifest.images.every((image) =>
    DONE_STATUSES.has(state.statuses[image.image_id]?.status)
  );
}

function summaryUrl() {
  if (state.hostedMode) return "/api/summary";
  return `/api/summary?session_id=${encodeURIComponent(state.session.session_id)}&manifest_path=${encodeURIComponent(state.manifest.manifest_path)}`;
}

function formatFocusedTime(milliseconds) {
  const minutes = Math.max(0, Math.round(Number(milliseconds || 0) / 60_000));
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function renderCompletionSummary(summary) {
  state.completionSummary = summary;
  $("#completionPages").textContent = Number(summary.pages_annotated || 0).toLocaleString();
  $("#completionAds").textContent = Number(summary.qualifying_advertisements || 0).toLocaleString();
  $("#completionFaces").textContent = Number(summary.face_depictions_boxed || 0).toLocaleString();
  $("#completionGroups").textContent = Number(summary.groups_annotated || 0).toLocaleString();
  $("#completionTime").textContent = formatFocusedTime(summary.focused_time_ms);
  const pageTotal = Number(summary.pages_total || 0);
  $("#completionMessage").textContent = pageTotal === 1
    ? t("completion_page_single")
    : t("completion_page_many", { count: pageTotal });
  $("#completionSessionCode").textContent = sessionDisplayId();
  $("#leaveCompletedTaskButton").textContent = state.hostedMode ? t("sign_out") : t("return_to_start");
}

async function showCompletionView() {
  if (state.completionLoading) return;
  state.completionLoading = true;
  updateNavState();
  $("#saveStatus").textContent = t("finishing_task");
  $("#saveStatus").className = "status-line";
  try {
    finishStepTimer("task_complete");
    markDirty();
    await saveAnnotationNow();
    if (state.dirty) throw new Error(t("final_page_not_saved"));
    await refreshProgress();
    if (!taskIsComplete()) throw new Error(t("complete_every_page"));
    const data = await fetchJson(summaryUrl());
    renderCompletionSummary(data.summary || {});
    $("#appView").classList.add("hidden");
    $("#completionView").classList.remove("hidden");
    $("#completionView").focus();
  } catch (error) {
    $("#saveStatus").textContent = error.message;
    $("#saveStatus").className = "status-line error";
    if (!state.stepTimer) startStepTimer(state.step);
  } finally {
    state.completionLoading = false;
    if (!$("#appView").classList.contains("hidden")) updateNavState();
  }
}

function reviewCompletedTask() {
  $("#completionView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  enterStep(state.step);
  window.setTimeout(() => {
    setStageSize();
    renderOverlay();
  }, 0);
}

async function leaveCompletedTask() {
  if (state.hostedMode) {
    await hostedExit();
    return;
  }
  window.location.reload();
}

function estimateRemainingScreens() {
  const step = state.step;
  if (step.id.startsWith("END_PAGE_")) return 0;
  const currentDone = state.annotation.timing.screen_times.length;
  let remaining = 4;
  for (const ad of state.annotation.advertisements) {
    remaining += 2;
    if (exactCountValue(ad.face_depiction_count_band)) {
      remaining += canonicalPeople(ad).length * 11;
    } else {
      remaining += 2 + canonicalPeople(ad).length * 11 + ad.groups.length * 7;
    }
  }
  return Math.max(remaining - currentDone, 1);
}

function updateProgress() {
  if (!state.manifest) return;
  const completeCount = state.manifest.images.filter((image) => {
    const status = state.statuses[image.image_id]?.status;
    return DONE_STATUSES.has(status);
  }).length;
  $("#taskProgress").value = Math.round((completeCount / state.manifest.images.length) * 100);
  const completedScreens = state.annotation?.timing?.screen_times?.length || 0;
  const remaining = estimateRemainingScreens();
  $("#imageProgress").value = state.step.id.startsWith("END_PAGE_")
    ? 100
    : Math.round((completedScreens / Math.max(completedScreens + remaining, 1)) * 100);
}

function pageWorkState(imageId) {
  const status = state.statuses[imageId]?.status;
  if (DONE_STATUSES.has(status)) {
    return { key: "done", label: t("done") };
  }
  if (status) {
    return { key: "started", label: t("started") };
  }
  if (state.annotation && currentImage()?.image_id === imageId && state.dirty) {
    return { key: "started", label: t("started") };
  }
  return { key: "not-started", label: t("not_started") };
}

function normalNavigationLimit() {
  if (!state.manifest?.images?.length) return 0;
  let limit = Math.max(0, state.currentIndex || 0, state.maxVisitedIndex || 0);
  state.manifest.images.forEach((image, index) => {
    if (state.statuses[image.image_id]?.status) {
      limit = Math.max(limit, index);
    }
  });
  return Math.min(limit, state.manifest.images.length - 1);
}

function canNavigateToImageIndex(index, { allowSequentialNext = false } = {}) {
  if (!state.manifest?.images?.length) return false;
  if (index < 0 || index >= state.manifest.images.length) return false;
  if (state.expertMode) return true;
  const limit = normalNavigationLimit() + (allowSequentialNext ? 1 : 0);
  return index <= Math.min(limit, state.manifest.images.length - 1);
}

function renderImageList() {
  const list = $("#imageListItems");
  list.innerHTML = "";
  state.manifest.images.forEach((image, index) => {
    const button = document.createElement("button");
    button.type = "button";
    if (index === state.currentIndex) button.classList.add("active");
    const workState = pageWorkState(image.image_id);
    const canOpen = canNavigateToImageIndex(index);
    button.disabled = !canOpen;
    button.dataset.pageState = workState.key;
    button.setAttribute("aria-current", index === state.currentIndex ? "page" : "false");
    button.title = canOpen
      ? t("page_status_title", { number: index + 1, status: workState.label })
      : t("page_locked_title", { number: index + 1, status: workState.label });
    button.innerHTML = `
      <span class="page-list-copy">
        <span class="image-name">${escapeHtml(image.filename)}</span>
        <span class="page-state ${workState.key}"><span class="page-state-dot"></span>${workState.label}</span>
      </span>
      <span class="page-index">${index + 1}</span>
    `;
    button.addEventListener("click", () => {
      if (canOpen) void loadImage(index);
    });
    list.appendChild(button);
  });
}

function currentVisibleRegion() {
  const step = state.step || {};
  const full = [0, 0, 1, 1];
  const fullPageSteps = new Set([
    "P1_qualifying_ad_count",
    "P2_single_ad_full_page",
    "A1_ad_bbox",
    "DRAW_AD_BOXES"
  ]);
  if (fullPageSteps.has(step.id) || step.id?.startsWith("END_PAGE_")) return full;
  if (["D0_duplicates_present", "D1_unique_face_count", "D2_select_main", "D3_select_duplicates"].includes(step.id)) {
    if (step.adIndex !== undefined) return adByIndex(step.adIndex)?.bbox || full;
    const boxed = allBoxedPeople();
    const adIndexes = new Set(boxed.map((item) => item.adIndex));
    if (adIndexes.size === 1) {
      const [adIndex] = [...adIndexes];
      return adByIndex(adIndex)?.bbox || full;
    }
    return full;
  }
  const ad = step.adIndex !== undefined ? adByIndex(step.adIndex) : null;
  if (!ad?.bbox) return full;
  return ad.bbox;
}

function regionKey(region = currentVisibleRegion()) {
  return region.map((value) => Number(value).toFixed(6)).join(",");
}

function isFullRegion(region = currentVisibleRegion()) {
  return region[0] === 0 && region[1] === 0 && region[2] === 1 && region[3] === 1;
}

function setStageSize() {
  const image = $("#pageImage");
  const stage = $("#imageStage");
  if (!state.naturalSize.width) return;
  const region = currentVisibleRegion();
  const nextRegionKey = regionKey(region);
  if (state.visibleRegionKey !== nextRegionKey) {
    state.fitBaseWidth = 1;
    state.visibleRegionKey = nextRegionKey;
  }
  const regionWidth = Math.max(0.001, region[2] - region[0]);
  const regionHeight = Math.max(0.001, region[3] - region[1]);
  const regionPixelWidth = state.naturalSize.width * regionWidth;
  const regionPixelHeight = state.naturalSize.height * regionHeight;
  const scroll = $("#imageScroll");
  const availableWidth = Math.max(260, scroll.clientWidth - 32);
  const availableHeight = Math.max(260, scroll.clientHeight - 32);
  if (!state.fitBaseWidth || state.fitBaseWidth <= 1) {
    const scale = Math.min(availableWidth / regionPixelWidth, availableHeight / regionPixelHeight, 1);
    state.fitBaseWidth = Math.max(260, Math.round(regionPixelWidth * scale));
  }
  const width = Math.round(state.fitBaseWidth * state.zoom);
  stage.style.width = `${width}px`;
  stage.style.aspectRatio = `${regionPixelWidth} / ${regionPixelHeight}`;
  stage.classList.toggle("full-region", isFullRegion(region));
  const fullDisplayWidth = width / regionWidth;
  const fullDisplayHeight = fullDisplayWidth * (state.naturalSize.height / state.naturalSize.width);
  image.style.width = `${fullDisplayWidth}px`;
  image.style.height = `${fullDisplayHeight}px`;
  image.style.left = `${-region[0] * fullDisplayWidth}px`;
  image.style.top = `${-region[1] * fullDisplayHeight}px`;
  const viewHeight = Math.round(width * (regionPixelHeight / regionPixelWidth));
  $("#overlay").setAttribute("viewBox", `0 0 ${stage.clientWidth || width} ${stage.clientHeight || viewHeight}`);
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function renderOverlay() {
  const overlay = $("#overlay");
  const stage = $("#imageStage");
  const width = stage.clientWidth || 1;
  const height = stage.clientHeight || 1;
  const region = currentVisibleRegion();
  const fullRegion = isFullRegion(region);
  overlay.innerHTML = "";
  overlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const boxes = allRenderableBoxes();
  const duplicateSelection = state.step.id === "D2_select_main" || state.step.id === "D3_select_duplicates";
  const duplicateContext = duplicateSelection ? duplicateGroupContext(state.step) : null;
  for (const box of boxes) {
    if (!fullRegion && box.type === "ad") continue;
    const pixelBox = pageBoxToViewPixels(box.bbox, region, width, height);
    if (!pixelBox) continue;
    const [x1, y1, x2, y2] = pixelBox;
    const gazeTargetPersonId = state.step.id === "I5_target_person"
      ? personById(state.step.personId)?.gaze_target_person_id
      : null;
    const isDuplicateMain = duplicateContext?.group.main_person_id === box.id;
    const isDuplicateMember = duplicateContext?.group.duplicate_person_ids?.includes(box.id);
    const isPreviouslyAssigned = duplicateContext?.assignedBefore.has(box.id);
    const isDuplicateCandidate = duplicateSelection && box.type === "person" && !isPreviouslyAssigned;
    const isCurrentPerson = box.id === state.step.personId;
    const isCurrentGroup = box.id === state.step.groupId;
    const rect = svgEl("rect", {
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1,
      class: `bbox ${box.type} ${box.id === state.selectedBoxId ? "selected" : ""} ${isCurrentPerson ? "current-person" : ""} ${isCurrentGroup ? "current-group" : ""} ${box.id === gazeTargetPersonId ? "gaze-target" : ""} ${isDuplicateMain ? "identity-main" : ""} ${isDuplicateMember ? "identity-duplicate" : ""} ${isPreviouslyAssigned ? "identity-assigned" : ""} ${isDuplicateCandidate ? "identity-candidate" : ""} ${box.pending ? "pending" : ""}`.trim(),
      "data-box-id": box.id
    });
    overlay.appendChild(rect);
    if (box.label) {
      overlay.appendChild(svgEl("text", {
        x: x1 + 6,
        y: Math.max(14, y1 - 6),
        class: "bbox-label"
      })).textContent = box.label;
    }
    if (box.id === state.selectedBoxId && !box.pending) {
      const size = 12;
      for (const [hx, hy, cursor] of [[x1, y1, "nw"], [x2, y1, "ne"], [x1, y2, "sw"], [x2, y2, "se"]]) {
        const handle = svgEl("rect", {
          x: hx - size / 2,
          y: hy - size / 2,
          width: size,
          height: size,
          class: "handle",
          "data-box-id": box.id,
          "data-handle": cursor
        });
        overlay.appendChild(handle);
      }
    }
  }
  const bboxSpec = currentBboxSpec();
  const editableBoxes = bboxSpec ? bboxSpec.getBoxes() : [];
  const canUndoBox = editableBoxes.length > 0;
  const canDeleteBox = Boolean(state.selectedBoxId && editableBoxes.some((box) => box.id === state.selectedBoxId));
  $("#undoBoxButton").disabled = !canUndoBox;
  $("#deleteBoxButton").disabled = !canDeleteBox;
  $(".edit-toolbar").classList.toggle("hidden", !(canUndoBox || canDeleteBox));
  positionBboxDoneButton();
}

function positionBboxDoneButton() {
  const button = $("#bboxDoneButton");
  if (!button) return;
  const spec = currentBboxSpec();
  const gazeTarget = state.step.id === "I5_target_person"
    ? personById(state.step.personId)?.gaze_target_person_id
    : null;
  const duplicateSelection = state.step.id === "D2_select_main" || state.step.id === "D3_select_duplicates";
  const duplicateGroup = duplicateSelection ? duplicateGroupContext(state.step).group : null;
  const duplicateAnchor = duplicateSelection
    ? (state.selectedBoxId || duplicateGroup.main_person_id)
    : null;
  button.textContent = duplicateSelection || gazeTarget ? t("next") : t("done");
  if ((!spec && !gazeTarget && !duplicateAnchor) || !canAdvance()) {
    button.classList.add("hidden");
    return;
  }
  const boxes = spec ? spec.getBoxes() : allRenderableBoxes();
  const selected = gazeTarget
    ? boxes.find((box) => box.id === gazeTarget)
    : duplicateAnchor
      ? boxes.find((box) => box.id === duplicateAnchor)
    : boxes.find((box) => box.id === state.selectedBoxId) || boxes[boxes.length - 1];
  if (!selected) {
    button.classList.add("hidden");
    return;
  }
  const pixelBox = normalizedBoxToPixels(selected.bbox);
  const stage = $("#imageStage");
  const maxLeft = Math.max(8, stage.clientWidth - 86);
  const maxTop = Math.max(8, stage.clientHeight - 42);
  button.style.left = `${clamp(pixelBox[2] + 8, 8, maxLeft)}px`;
  button.style.top = `${clamp(pixelBox[3] + 8, 8, maxTop)}px`;
  button.classList.remove("hidden");
}

function render() {
  if (!state.annotation) return;
  const image = currentImage();
  const imageTitle = $("#imageTitle");
  if (imageTitle) imageTitle.textContent = image.filename;
  $("#bottomPageLabel").textContent = `${image.index + 1} / ${image.total}`;
  $("#bottomFilename").textContent = image.filename;
  $("#prevImageButton").disabled = !canNavigateToImageIndex(state.currentIndex - 1);
  $("#nextImageButton").disabled = !canNavigateToImageIndex(state.currentIndex + 1);
  setStageSize();
  renderImageList();
  renderStepPanel();
  renderOverlay();
  updateProgress();
  saveLocalBootState();
}

function overlayPoint(event) {
  const rect = $("#overlay").getBoundingClientRect();
  const overlay = $("#overlay");
  const viewWidth = Number(overlay.viewBox.baseVal.width) || rect.width || 1;
  const viewHeight = Number(overlay.viewBox.baseVal.height) || rect.height || 1;
  return {
    x: clamp((event.clientX - rect.left) * (viewWidth / rect.width), 0, viewWidth),
    y: clamp((event.clientY - rect.top) * (viewHeight / rect.height), 0, viewHeight)
  };
}

function pageBoxToViewPixels(bbox, region = currentVisibleRegion(), width = null, height = null) {
  const overlay = $("#overlay");
  const viewWidth = width || Number(overlay.viewBox.baseVal.width) || 1;
  const viewHeight = height || Number(overlay.viewBox.baseVal.height) || 1;
  const regionWidth = Math.max(0.001, region[2] - region[0]);
  const regionHeight = Math.max(0.001, region[3] - region[1]);
  const ix1 = Math.max(bbox[0], region[0]);
  const iy1 = Math.max(bbox[1], region[1]);
  const ix2 = Math.min(bbox[2], region[2]);
  const iy2 = Math.min(bbox[3], region[3]);
  if (ix2 <= ix1 || iy2 <= iy1) return null;
  return [
    ((ix1 - region[0]) / regionWidth) * viewWidth,
    ((iy1 - region[1]) / regionHeight) * viewHeight,
    ((ix2 - region[0]) / regionWidth) * viewWidth,
    ((iy2 - region[1]) / regionHeight) * viewHeight
  ];
}

function viewPointToPage(point) {
  const overlay = $("#overlay");
  const region = currentVisibleRegion();
  const width = Number(overlay.viewBox.baseVal.width) || 1;
  const height = Number(overlay.viewBox.baseVal.height) || 1;
  const regionWidth = Math.max(0.001, region[2] - region[0]);
  const regionHeight = Math.max(0.001, region[3] - region[1]);
  return {
    x: roundRel(region[0] + (point.x / width) * regionWidth),
    y: roundRel(region[1] + (point.y / height) * regionHeight)
  };
}

function findBox(id) {
  return allRenderableBoxes().find((box) => box.id === id);
}

function isInteractiveBox(id) {
  const spec = currentBboxSpec();
  if (!spec || !id || id === "pending") return false;
  return spec.getBoxes().some((box) => box.id === id);
}

function setBoxById(id, bbox) {
  const spec = currentBboxSpec();
  if (spec) {
    if (spec.mode === "single" && spec.getBoxes().some((box) => box.id === id)) spec.setBox(bbox);
    if (spec.mode === "collection") spec.update(id, bbox);
  }
  if (id.endsWith(":bbox")) {
    const ad = state.annotation.advertisements.find((candidate) => `${candidate.ad_id}:bbox` === id);
    if (ad) ad.bbox = bbox;
  } else {
    const person = personById(id);
    if (person) person.face_bbox = bbox;
    const group = groupById(id);
    if (group) group.bbox = bbox;
  }
}

function deleteSelectedBox() {
  if (!state.selectedBoxId) return;
  const spec = currentBboxSpec();
  if (spec?.mode === "single" && spec.getBoxes().some((box) => box.id === state.selectedBoxId)) {
    spec.deleteBox();
  } else if (spec?.mode === "collection" && spec.getBoxes().some((box) => box.id === state.selectedBoxId)) {
    spec.remove(state.selectedBoxId);
  }
  state.selectedBoxId = null;
  markDirty();
  render();
  void saveAnnotationDebounced();
}

function undoLastBox() {
  const spec = currentBboxSpec();
  if (!spec) return;
  const boxes = spec.getBoxes();
  const last = boxes[boxes.length - 1];
  if (!last) return;
  state.selectedBoxId = last.id;
  deleteSelectedBox();
}

function commitBox(bbox) {
  const spec = currentBboxSpec();
  if (!spec) return;
  const boxes = spec.getBoxes();
  if (spec.mode === "single") {
    spec.setBox(bbox);
    state.selectedBoxId = spec.getBoxes()[0]?.id || null;
  } else if (boxes.length < spec.max) {
    spec.create(bbox);
    const nextBoxes = spec.getBoxes();
    state.selectedBoxId = nextBoxes[nextBoxes.length - 1]?.id || null;
  }
  markDirty();
  render();
  void saveAnnotationDebounced();
}

function normalizedRect(a, b) {
  const pageA = viewPointToPage(a);
  const pageB = viewPointToPage(b);
  const x1 = Math.min(pageA.x, pageB.x);
  const y1 = Math.min(pageA.y, pageB.y);
  const x2 = Math.max(pageA.x, pageB.x);
  const y2 = Math.max(pageA.y, pageB.y);
  return [roundRel(x1), roundRel(y1), roundRel(x2), roundRel(y2)];
}

function normalizedBoxToPixels(bbox) {
  const overlay = $("#overlay");
  const width = Number(overlay.viewBox.baseVal.width) || 1;
  const height = Number(overlay.viewBox.baseVal.height) || 1;
  return pageBoxToViewPixels(bbox, currentVisibleRegion(), width, height) || [0, 0, 0, 0];
}

function pixelBoxToNormalized(bbox) {
  const a = viewPointToPage({ x: bbox[0], y: bbox[1] });
  const b = viewPointToPage({ x: bbox[2], y: bbox[3] });
  return [roundRel(a.x), roundRel(a.y), roundRel(b.x), roundRel(b.y)];
}

function bindOverlay() {
  const overlay = $("#overlay");
  overlay.addEventListener("pointerdown", (event) => {
    if (!state.annotation || event.button !== 0) return;
    const target = event.target;
    const point = overlayPoint(event);
    if (state.step.id === "D2_select_main" || state.step.id === "D3_select_duplicates") {
      const id = target.dataset?.boxId;
      if (id) handleDuplicateFaceSelection(id);
      return;
    }
    if (state.step.id === "I5_target_person") {
      const id = target.dataset?.boxId;
      const currentAd = adByIndex(state.step.adIndex);
      const clickedPerson = id ? personById(id) : null;
      const targetPersonId = clickedPerson?.duplicate_of_person_id || id;
      if (id && currentAd?.people.some((candidate) => candidate.person_id === id) && targetPersonId !== state.step.personId) {
        const person = personById(state.step.personId);
        person.gaze_target_person_id = targetPersonId;
        person.gaze_target_person_unboxed = false;
        markDirty();
        render();
        void saveAnnotationDebounced();
      }
      return;
    }
    const boxId = target.dataset?.boxId;
    const handle = target.dataset?.handle;
    if (boxId && isInteractiveBox(boxId)) {
      state.selectedBoxId = boxId;
      const box = findBox(boxId);
      if (box) {
        state.dragging = {
          pointerId: event.pointerId,
          id: boxId,
          handle: handle || "move",
          start: point,
          original: normalizedBoxToPixels(box.bbox)
        };
        overlay.setPointerCapture(event.pointerId);
      }
      renderOverlay();
      return;
    }
    if (!currentBboxSpec()) return;
    state.selectedBoxId = null;
    state.drawing = {
      pointerId: event.pointerId,
      start: point,
      current: point,
      bbox: [point.x, point.y, point.x, point.y]
    };
    overlay.setPointerCapture(event.pointerId);
    renderOverlay();
  });

  overlay.addEventListener("pointermove", (event) => {
    const point = overlayPoint(event);
    if (state.drawing) {
      state.drawing.current = point;
      state.drawing.bbox = normalizedRect(state.drawing.start, point);
      renderOverlay();
      return;
    }
    if (state.dragging) {
      const drag = state.dragging;
      const [x1, y1, x2, y2] = drag.original;
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      let next = [x1, y1, x2, y2];
      const overlay = $("#overlay");
      const maxX = Number(overlay.viewBox.baseVal.width) || 1;
      const maxY = Number(overlay.viewBox.baseVal.height) || 1;
      if (drag.handle === "move") {
        const width = x2 - x1;
        const height = y2 - y1;
        const nx1 = clamp(x1 + dx, 0, maxX - width);
        const ny1 = clamp(y1 + dy, 0, maxY - height);
        next = [nx1, ny1, nx1 + width, ny1 + height];
      } else {
        let nx1 = x1;
        let ny1 = y1;
        let nx2 = x2;
        let ny2 = y2;
        if (drag.handle.includes("w")) nx1 = clamp(x1 + dx, 0, x2 - 2);
        if (drag.handle.includes("e")) nx2 = clamp(x2 + dx, x1 + 2, maxX);
        if (drag.handle.includes("n")) ny1 = clamp(y1 + dy, 0, y2 - 2);
        if (drag.handle.includes("s")) ny2 = clamp(y2 + dy, y1 + 2, maxY);
        next = [nx1, ny1, nx2, ny2];
      }
      setBoxById(drag.id, pixelBoxToNormalized(next));
      markDirty();
      renderOverlay();
    }
  });

  overlay.addEventListener("pointerup", (event) => {
    if (state.drawing) {
      const bbox = state.drawing.bbox;
      state.drawing = null;
      const pixelBox = normalizedBoxToPixels(bbox);
      if (Math.abs(pixelBox[2] - pixelBox[0]) > 6 && Math.abs(pixelBox[3] - pixelBox[1]) > 6) {
        commitBox(bbox);
      } else {
        renderOverlay();
      }
    }
    if (state.dragging) {
      if (overlay.hasPointerCapture(event.pointerId)) overlay.releasePointerCapture(event.pointerId);
      state.dragging = null;
      render();
      void saveAnnotationDebounced();
    }
  });

  overlay.addEventListener("pointercancel", () => {
    state.drawing = null;
    state.dragging = null;
    renderOverlay();
  });

  overlay.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    state.drawing = null;
    renderOverlay();
  });
}

async function refreshProgress() {
  const query = state.hostedMode
    ? "/api/progress"
    : `/api/progress?session_id=${encodeURIComponent(state.session.session_id)}&manifest_path=${encodeURIComponent(state.manifest.manifest_path)}`;
  const data = await fetchJson(query);
  state.statuses = data.progress.statuses || {};
}

async function loadImage(index, options = {}) {
  if (!state.manifest) return;
  const requestedIndex = clamp(index, 0, state.manifest.images.length - 1);
  if (!canNavigateToImageIndex(requestedIndex, options)) return;
  const loadToken = ++state.imageLoadToken;
  const requestedImage = state.manifest.images[requestedIndex];
  const prefetchedSourcePromise = takePrefetchedImage(requestedImage);
  $("#imageLoading").classList.remove("hidden");
  finishStepTimer("image_change");
  await saveAnnotationNow();
  if (loadToken !== state.imageLoadToken) {
    void prefetchedSourcePromise?.then((source) => source && URL.revokeObjectURL(source));
    return;
  }
  if (state.dirty) {
    void prefetchedSourcePromise?.then((source) => source && URL.revokeObjectURL(source));
    $("#imageLoading").classList.add("hidden");
    return;
  }
  state.currentIndex = requestedIndex;
  state.maxVisitedIndex = Math.max(state.maxVisitedIndex, state.currentIndex);
  state.naturalSize = { width: 0, height: 0 };
  state.fitBaseWidth = 1;
  state.visibleRegionKey = "0,0,1,1";
  const image = currentImage();
  const pageImage = $("#pageImage");
  const annotationPromise = fetchJson(`/api/annotation?session_id=${encodeURIComponent(state.session.session_id)}&image_id=${encodeURIComponent(image.image_id)}`);
  const prefetchedSource = await prefetchedSourcePromise;
  if (loadToken !== state.imageLoadToken) {
    if (prefetchedSource) URL.revokeObjectURL(prefetchedSource);
    return;
  }
  let annotationReady = false;
  let imageReady = false;
  const applyLoadedImage = () => {
    if (!annotationReady || !imageReady) return;
    state.naturalSize = {
      width: pageImage.naturalWidth || 1,
      height: pageImage.naturalHeight || 1
    };
    state.zoom = 1;
    state.fitBaseWidth = 1;
    setStageSize();
    renderOverlay();
    $("#imageLoading").classList.add("hidden");
    prefetchImage(state.currentIndex + 1);
  };
  pageImage.onload = () => {
    imageReady = true;
    if (prefetchedSource) URL.revokeObjectURL(prefetchedSource);
    applyLoadedImage();
  };
  pageImage.onerror = () => {
    imageReady = false;
    $("#saveStatus").textContent = t("image_could_not_load");
    $("#saveStatus").className = "status-line error";
    $("#imageLoading").classList.add("hidden");
  };
  pageImage.src = prefetchedSource || imageUrl(image);
  const data = await annotationPromise;
  if (loadToken !== state.imageLoadToken) return;
  state.annotationRevision = Number(data.revision || 0);
  state.annotationPersisted = Boolean(data.annotation);
  state.dirty = false;
  state.changeVersion = 0;
  state.annotation = migrateLoadedAnnotation(data.annotation || defaultAnnotation(image));
  state.step = normalizeLoadedStep(state.annotation.current_step || { id: "P1_qualifying_ad_count" });
  const normalizedLegacyStatus = !state.step.id.startsWith("END_PAGE_") && state.annotation.status !== "draft";
  if (normalizedLegacyStatus) {
    state.annotation.status = "draft";
    state.annotation.finished_at = null;
  }
  enterStep(state.step);
  annotationReady = true;
  if (pageImage.complete && pageImage.naturalWidth) imageReady = true;
  applyLoadedImage();
  if (normalizedLegacyStatus) {
    markDirty();
    void saveAnnotationDebounced();
  }
  saveLocalBootState();
}

function formatSessionTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("unknown_date");
  return new Intl.DateTimeFormat(state.language === "de" ? "de-DE" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function clearResumeSessions(message = t("no_saved_sessions_loaded")) {
  state.resumeSessions = [];
  const select = $("#resumeSessionSelect");
  const option = document.createElement("option");
  option.value = "";
  option.textContent = message;
  select.replaceChildren(option);
  select.disabled = true;
}

function renderResumeSessions(sessions, preferredSessionId = null) {
  const select = $("#resumeSessionSelect");
  select.replaceChildren();
  for (const session of sessions) {
    const option = document.createElement("option");
    option.value = session.session_id;
    option.textContent = state.language === "de"
      ? `${t("session")} ${sessionDisplayId(session)} | ${session.task_id} | ${session.done}/${session.total} fertig | ${session.started} begonnen | ${formatSessionTimestamp(session.updated_at || session.created_at)}`
      : `${t("session")} ${sessionDisplayId(session)} | ${session.task_id} | ${session.done}/${session.total} done | ${session.started} started | ${formatSessionTimestamp(session.updated_at || session.created_at)}`;
    select.appendChild(option);
  }
  select.disabled = sessions.length === 0;
  const preferred = sessions.find((session) => session.session_id === preferredSessionId);
  if (preferred) select.value = preferred.session_id;
}

async function refreshResumeSessions(preferredSessionId = null) {
  const status = $("#sessionLookupStatus");
  const token = ++state.sessionLookupToken;
  status.className = "status-line";
  clearResumeSessions(t("loading_saved_sessions"));
  status.textContent = t("loading");
  try {
    const data = await fetchJson("/api/sessions");
    if (token !== state.sessionLookupToken) return;
    state.resumeSessions = data.sessions || [];
    renderResumeSessions(state.resumeSessions, preferredSessionId);
    status.textContent = state.resumeSessions.length
      ? state.resumeSessions.length === 1
        ? t("saved_annotations_found_one")
        : t("saved_annotations_found_many", { count: state.resumeSessions.length })
      : t("no_saved_annotations");
  } catch (error) {
    if (token !== state.sessionLookupToken) return;
    clearResumeSessions(t("saved_sessions_unavailable"));
    status.textContent = error.message;
    status.className = "status-line error";
  }
}

function setStartMode(mode, { refresh = true, preferredSessionId = null } = {}) {
  state.startMode = mode === "resume" ? "resume" : "new";
  $$("[data-session-mode]").forEach((button) => {
    const selected = button.dataset.sessionMode === state.startMode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const resuming = state.startMode === "resume";
  $("#manifestPathField").classList.toggle("hidden", resuming);
  $("#resumeFields").classList.toggle("hidden", state.startMode !== "resume");
  $("#startButton").textContent = state.startMode === "resume" ? t("open_saved_annotation") : t("start_new_annotation");
  $("#loginStatus").textContent = "";
  if (state.startMode === "resume" && refresh) {
    void refreshResumeSessions(preferredSessionId);
  } else if (state.startMode === "new") {
    state.sessionLookupToken += 1;
  }
}

function resumeIndexFromStatuses() {
  const images = state.manifest.images;
  let index = images.findIndex((image) => {
    const status = state.statuses[image.image_id]?.status;
    return status && !DONE_STATUSES.has(status);
  });
  if (index >= 0) return index;
  index = images.findIndex((image) => !state.statuses[image.image_id]);
  if (index >= 0) return index;
  return Math.max(images.length - 1, 0);
}

function selectSessionCodeText() {
  const value = $("#sessionCodeValue");
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(value);
  selection.removeAllRanges();
  selection.addRange(range);
}

async function copySessionCode() {
  const code = sessionDisplayId();
  const status = $("#sessionCodeStatus");
  status.textContent = t("copying");
  status.className = "status-line";
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await Promise.race([
      navigator.clipboard.writeText(code),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("Clipboard timed out")), 1500);
      })
    ]);
    status.textContent = t("session_number_copied");
    status.className = "status-line saved";
    $("#copySessionCodeButton").textContent = t("copied");
  } catch {
    selectSessionCodeText();
    status.textContent = t("copy_unavailable");
    status.className = "status-line error";
  }
}

function showSessionCodePrompt() {
  const dialog = $("#sessionCodeDialog");
  $("#sessionCodeValue").textContent = sessionDisplayId();
  $("#sessionCodeStatus").textContent = "";
  $("#sessionCodeStatus").className = "status-line";
  $("#copySessionCodeButton").textContent = t("copy_number");
  dialog.showModal();
  return new Promise((resolve) => {
    $("#continueSessionButton").onclick = () => {
      dialog.close();
      $("#continueSessionButton").onclick = null;
      resolve();
    };
  });
}

async function startApp() {
  let manifestPath = $("#manifestPath").value.trim();
  $("#loginStatus").textContent = "";
  $("#loginStatus").className = "status-line";
  try {
    if (state.startMode === "resume" && !$("#resumeSessionSelect").value) {
      await refreshResumeSessions(loadLocalBootState()?.session_id || null);
    }
    const selectedSessionId = state.startMode === "resume" ? $("#resumeSessionSelect").value : null;
    if (state.startMode === "resume" && !selectedSessionId) {
      throw new Error(t("choose_saved_annotation"));
    }
    if (state.startMode === "resume") {
      const selected = state.resumeSessions.find((session) => session.session_id === selectedSessionId);
      if (!selected) throw new Error(t("selected_saved_unavailable"));
      manifestPath = selected.manifest_path;
    } else {
      if (!manifestPath) throw new Error(t("manifest_required"));
    }
    const [configData, manifestData] = await Promise.all([
      fetchJson("/api/config"),
      fetchJson(`/api/manifest?path=${encodeURIComponent(manifestPath)}`)
    ]);
    const sessionData = await postJson("/api/session", {
      session_id: selectedSessionId,
      manifest_path: manifestData.manifest.manifest_path,
      task_id: manifestData.manifest.task_id
    });
    state.expertMode = Boolean(configData.config?.expert_mode);
    state.session = sessionData.session;
    state.manifest = manifestData.manifest;
    $("#manifestPath").value = state.manifest.manifest_path;
    await refreshProgress();
    $("#loginView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    $("#taskTitle").textContent = state.manifest.task_id;
    $("#expertModeBadge").classList.toggle("hidden", !state.expertMode);
    $("#pageListToggle").title = state.expertMode
      ? t("open_page_overview_expert")
      : t("open_page_overview");
    $("#sessionCodeTop").textContent = sessionDisplayId();
    $("#sessionCodeTop").title = `${t("session")} ${sessionDisplayId()}`;
    const initialIndex = state.startMode === "resume" ? resumeIndexFromStatuses() : 0;
    state.currentIndex = initialIndex;
    state.maxVisitedIndex = initialIndex;
    await loadImage(initialIndex);
    if (!sessionData.resumed) await showSessionCodePrompt();
  } catch (error) {
    $("#loginStatus").textContent = error.message;
    $("#loginStatus").className = "status-line error";
  }
}

function setHostedEntryStep(step) {
  const passwordStep = step === "password";
  $("#hostedPasswordStep").classList.toggle("hidden", !passwordStep);
  $("#hostedAssignmentStep").classList.toggle("hidden", passwordStep);
  $("#loginStatus").textContent = "";
  window.setTimeout(() => {
    (passwordStep ? $("#hostedPassword") : $("#hostedAssignmentCode"))?.focus();
  }, 0);
}

async function enterHostedAssignment(code) {
  $("#loginStatus").textContent = t("opening_annotation");
  $("#loginStatus").className = "status-line";
  const sessionData = await postJson("/api/assignment/open", { code });
  const [configData, manifestData] = await Promise.all([
    fetchJson("/api/config"),
    fetchJson("/api/manifest")
  ]);
  state.expertMode = Boolean(configData.config?.expert_mode);
  state.session = sessionData.session;
  state.manifest = manifestData.manifest;
  await refreshProgress();
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#taskTitle").textContent = state.manifest.task_id;
  $("#expertModeBadge").classList.toggle("hidden", !state.expertMode);
  $("#hostedExitButton").classList.remove("hidden");
  $("#pageListToggle").title = state.expertMode
    ? t("open_page_overview_expert")
    : t("open_page_overview");
  $("#sessionCodeTop").textContent = sessionDisplayId();
  $("#sessionCodeTop").title = `${t("assignment")} ${sessionDisplayId()}`;
  const initialIndex = resumeIndexFromStatuses();
  state.currentIndex = initialIndex;
  state.maxVisitedIndex = initialIndex;
  await loadImage(initialIndex);
}

async function hostedLogin() {
  const password = $("#hostedPassword").value;
  $("#loginStatus").textContent = t("signing_in");
  $("#loginStatus").className = "status-line";
  try {
    await postJson("/api/auth/login", { role: "annotator", password });
    $("#hostedPassword").value = "";
    setHostedEntryStep("assignment");
  } catch (error) {
    $("#loginStatus").textContent = error.message;
    $("#loginStatus").className = "status-line error";
  }
}

async function hostedOpenAssignment() {
  const code = $("#hostedAssignmentCode").value.trim();
  try {
    await enterHostedAssignment(code);
  } catch (error) {
    $("#loginStatus").textContent = error.message;
    $("#loginStatus").className = "status-line error";
  }
}

async function hostedExit() {
  await saveAnnotationNow();
  await postJson("/api/auth/logout", {});
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

function showCommentDialog() {
  $("#urgentCommentText").value = "";
  $("#commentDialog").showModal();
}

function saveUrgentComment() {
  const text = $("#urgentCommentText").value.trim();
  if (!text) {
    $("#commentDialog").close();
    return;
  }
  const step = state.step;
  state.annotation.urgent_comments.push({
    comment_id: `comment_${compactTimestamp()}`,
    text,
    created_at: nowIso(),
    image_id: currentImage().image_id,
    page_id: currentImage().image_id,
    advertisement_id: step.adIndex !== undefined ? adByIndex(step.adIndex)?.ad_id || null : null,
    group_id_if_active: step.groupId || null,
    person_id_if_active: step.personId || null,
    interrupted_step_id: step.id
  });
  state.annotation.review_flags.push({
    step_id: step.id,
    reason: "urgent_comment",
    created_at: nowIso()
  });
  markDirty();
  $("#commentDialog").close();
  void saveAnnotationNow();
}

function persistBeforeUnload() {
  if (!state.session || !state.annotation) return;
  finishStepTimer("unload");
  if (!state.annotationPersisted && !state.dirty) return;
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }
  state.annotation.current_step = { ...state.step };
  state.annotation.updated_at = nowIso();
  const payload = JSON.stringify({
    session_id: state.session.session_id,
    image_id: currentImage().image_id,
    revision: state.annotationRevision,
    annotation: state.annotation
  });
  navigator.sendBeacon("/api/annotation", new Blob([payload], { type: "application/json" }));
}

function updateImageArrowHover(event) {
  const pane = $(".image-pane");
  if (!pane) return;
  const rect = pane.getBoundingClientRect();
  if (!rect.width) return;
  const x = event.clientX - rect.left;
  const zoneWidth = rect.width * 0.1;
  pane.classList.toggle("nav-hover-left", x >= 0 && x <= zoneWidth);
  pane.classList.toggle("nav-hover-right", x <= rect.width && x >= rect.width - zoneWidth);
}

function clearImageArrowHover() {
  const pane = $(".image-pane");
  if (!pane) return;
  pane.classList.remove("nav-hover-left", "nav-hover-right");
}

function bindEvents() {
  $$("[data-lang-option]").forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.langOption));
  });
  $("#startButton").addEventListener("click", () => void startApp());
  $$("[data-session-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const stored = loadLocalBootState();
      setStartMode(button.dataset.sessionMode, {
        preferredSessionId: stored?.session_id || null
      });
    });
  });
  $("#refreshSessionsButton").addEventListener("click", () => {
    void refreshResumeSessions($("#resumeSessionSelect").value || loadLocalBootState()?.session_id || null);
  });
  $("#manifestPath").addEventListener("change", () => {
    if (state.startMode === "resume") {
      void refreshResumeSessions(loadLocalBootState()?.session_id || null);
    }
  });
  $("#manifestPath").addEventListener("keydown", (event) => {
    if (event.key === "Enter") void startApp();
  });
  $("#hostedLoginButton").addEventListener("click", () => void hostedLogin());
  $("#hostedPassword").addEventListener("keydown", (event) => {
    if (event.key === "Enter") void hostedLogin();
  });
  $("#hostedOpenButton").addEventListener("click", () => void hostedOpenAssignment());
  $("#hostedAssignmentCode").addEventListener("input", (event) => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 8);
  });
  $("#hostedAssignmentCode").addEventListener("keydown", (event) => {
    if (event.key === "Enter") void hostedOpenAssignment();
  });
  $("#hostedExitButton").addEventListener("click", () => void hostedExit());
  $("#reviewCompletedTaskButton").addEventListener("click", reviewCompletedTask);
  $("#leaveCompletedTaskButton").addEventListener("click", () => void leaveCompletedTask());
  $("#reloadAfterConflictButton").addEventListener("click", () => window.location.reload());
  $("#saveConflictDialog").addEventListener("cancel", (event) => event.preventDefault());
  $("#copySessionCodeButton").addEventListener("click", () => void copySessionCode());
  $("#sessionCodeDialog").addEventListener("cancel", (event) => event.preventDefault());
  $("#nextButton").addEventListener("click", advance);
  $("#bboxDoneButton").addEventListener("click", advance);
  $("#backButton").addEventListener("click", restorePreviousStep);
  $("#prevImageButton").addEventListener("click", () => void loadImage(state.currentIndex - 1));
  $("#nextImageButton").addEventListener("click", () => void loadImage(state.currentIndex + 1));
  $("#urgentCommentButton").addEventListener("click", showCommentDialog);
  $("#pageListToggle").addEventListener("click", () => {
    $("#workspace").classList.toggle("sidebar-open");
    setStageSize();
    renderOverlay();
  });
  $("#cancelCommentButton").addEventListener("click", () => $("#commentDialog").close());
  $("#saveCommentButton").addEventListener("click", saveUrgentComment);
  $("#helpButton").addEventListener("click", () => $("#helpText").classList.toggle("hidden"));
  $("#undoBoxButton").addEventListener("click", undoLastBox);
  $("#deleteBoxButton").addEventListener("click", deleteSelectedBox);
  $(".image-pane").addEventListener("mousemove", updateImageArrowHover);
  $(".image-pane").addEventListener("mouseleave", clearImageArrowHover);
  $$("[data-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.zoom;
    if (action === "fit") state.zoom = 1;
      if (action === "in") state.zoom = Math.min(3, state.zoom + 0.15);
      if (action === "out") state.zoom = Math.max(0.35, state.zoom - 0.15);
      setStageSize();
      renderOverlay();
      positionBboxDoneButton();
    });
  });
  $("#imageScroll").addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    state.zoom = clamp(state.zoom + direction * 0.12, 0.35, 3);
    setStageSize();
    renderOverlay();
    positionBboxDoneButton();
  }, { passive: false });
  window.addEventListener("resize", () => {
    setStageSize();
    renderOverlay();
    positionBboxDoneButton();
  });
  window.addEventListener("pagehide", persistBeforeUnload);
  bindOverlay();
}

async function boot() {
  const stored = loadLocalBootState();
  bindEvents();
  applyLanguage({ rerender: false });
  try {
    const publicConfig = await fetchJson("/api/public-config");
    state.hostedMode = publicConfig.mode === "hosted";
  } catch {
    state.hostedMode = false;
  }
  if (state.hostedMode) {
    $("#localStartFields").classList.add("hidden");
    $("#hostedStartFields").classList.remove("hidden");
    try {
      const auth = await fetchJson("/api/auth/me");
      if (!auth.authenticated || auth.role !== "annotator") {
        setHostedEntryStep("password");
      } else if (auth.assignment?.code) {
        await enterHostedAssignment(auth.assignment.code);
      } else {
        setHostedEntryStep("assignment");
      }
    } catch (error) {
      $("#loginStatus").textContent = error.message;
      $("#loginStatus").className = "status-line error";
      setHostedEntryStep("password");
    }
    return;
  }
  if (stored) {
    $("#manifestPath").value = stored.manifest_path || "";
    setStartMode("resume", {
      preferredSessionId: stored.session_id || null
    });
  } else {
    setStartMode("new", { refresh: false });
  }
}

void boot();
