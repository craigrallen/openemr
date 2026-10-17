# Letter entry editor popup — OPEMR-24 phase two

## Source slice

`interface/patient_file/letter.php` keeps its original 754-line route, with only four additions in the letter entry page: the `ClinicalWorkspaceAssets` import, a screen-only versioned stylesheet link immediately after `Header::setupHeader(['datetime-picker', 'topdialog'])`, `oe-letter-editor-popup` on the existing body, and `oe-letter-editor-sheet` on the existing `#theform`. The generated response HTML/PDF branch remains byte identical to the frozen original. No wrapper, script, font, geometry, backend, caller, or generated-output change is included.

`src/Common/Assets/ClinicalWorkspaceAssets.php` gains only the sorted `letter-editor-popup.css` allowlist entry. `interface/clinical-workspace/letter-editor-popup.css` contains one `@media screen` block and exactly five ordered rules. They pair workbench ink with the popup canvas and the form paper; set the toolbar ink to fixed `#17343b` against its retained inline `#ddd` background; and outline focused `.form-control` and buttons for both `:focus` and `:focus-visible`. The stylesheet only applies under `html.oe-workbench-context`. Native controls and semantic palettes retain their theme styling. Print and a page outside the workbench context do not receive these rules.

The original CSRF checks and token, session and patient context, crypto, all template reads and writes, date and text insertion, Save/Generate flow, cancel and closing handlers, and form action remain unchanged. The caller's `500` is its initial **height**; `modal-mlg` specifies width, while the dialog can cap its height to the viewport. This slice does not change the caller or popup geometry.

## Evidence and status

`tests/js/letter-editor-popup.test.js` freezes the complete original route and helper and checks the exact forward and inverse edits. Its CSS PostCSS AST contract permits only the five specified rules. The controller byte-compared the frozen route/helper with fetched `master` at `18647270`. Hosted tests-first run `689df738` / JS job `39025064723` completed a genuine RED: exactly three expected failures for the missing route, helper entry and stylesheet, with 1,266 passing tests across 62 suites. The test and fixture are unchanged.

The production edits in this document are **pending GREEN and full CI** from the controller. No local test, PHP route execution, application request, browser activation, or deployed-instance check is claimed here. Jira OPEMR-24 exists in Review; this source slice remains partial palette/focus work, not researched design fidelity, native fit, security acceptance, or clinical acceptance.

## Residual gates

- Controller syntax and CSS lint, hosted GREEN on the exact edited head, and full CI/coverage and independent diff review.
- Native compiled default, dark and solar theme checks for controls, actions and toolbar contrast.
- Keyboard focus and clipping at narrow initial opening and after resizing; RTL, print and relevant role checks.
- Real Save/Generate and opener behavior with authorized test context, followed by ordinary review and approval.

No application GET/POST, filesystem template mutation, Generate, database, credentials, or deployment was exercised for this slice. Passing source contracts alone cannot close the residual gates.
