# OPEMR-22 patient XML export popup

Status: production presentation changes added on `OPEMR-22-patient-xml-export-document`; GREEN validation and QA are pending. PR #96 remains a draft, unmerged and undeployed. This is a partial researched palette and focus adaptation of the existing popup, not full design fidelity or a claim of responsive or native fit.

## Route and reason

Both `interface/main/tabs/menu/menus/standard.json` and `front_office.json` expose `Export` (`Popup:Export`) at `/custom/export_xml.php` with `target: "pop"`, `requirement: 1`, `acl_req: ["patients", "demo"]`, and `global_req: "!ippf_specific"`. In `interface/main/tabs/js/tabs_view_model.js` lines 307–322, the pop target calls `popMenuDialog`, which opens `modal-mlg` at an initial 500px requested height with automatic height for this title. These are source observations, not a live popup test.

The popup already shows the generated XML in a read-only, 18-row textarea and has a theme-styled Close button calling `dlgclose()`. The page's attachment headers and direct XML output are commented out, so this change does not add a real XML download or export action. The purpose here is to give the existing document surface readable paper and ink colors and a visible focus outline in the workbench context while retaining the existing controls and behavior.

## Exact production files

- `custom/export_xml.php`: add the sorted `ClinicalWorkspaceAssets` import directly after `AclMain`; add one escaped, versioned, `media="screen"` stylesheet link immediately after `Header::setupHeader()`; append a body scope class and a document container class.
- `src/Common/Assets/ClinicalWorkspaceAssets.php`: add `patient-xml-export-popup.css` once in sorted order after `patient-search.css`.
- `interface/clinical-workspace/patient-xml-export-popup.css`: five rules scoped to `html.oe-workbench-context`, with body canvas and ink, document paper and ink, explicit paper and ink on the read-only textarea including focus states, and separate `:focus` and `:focus-visible` outline rules for that textarea and the existing button. The sole `!important` declaration is the body background needed against the existing `.body_top` background. The button retains its theme palette.
- This note records scope and the evidence still required.

`tests/js/patient-xml-export-popup.test.js` defines the exact four route edits, single helper edit and five ordered CSS rules. Its full original route fixture and complete helper original are checked by forward and reverse equality, so every other original route and helper byte must remain unchanged. The source contract also protects the `patients/demo` ACL and denial helper, session PID, backend mappings and queries, `xmlEscape()`, escaped `text($out)`, the read-only 18-row textarea, and the original Close label, class and handler. No wrappers, geometry, fonts, controls, JavaScript, backend code, callers, or security logic are changed.

## Evidence and acceptance

The controller's hosted tests-only run `39012491786` on `68caaa031aa3b91352a079ba881a9c3252bd2956` supplied the genuine RED gate: exactly three missing-production failures, with 1,274 passing tests across 62 suites. Original-source checks, synthetic planned forms and negative controls passed. Hosted Styling was SUCCESS. That RED evidence predates these production edits; it is not a GREEN result.

Acceptance still requires the controller's permitted PHP syntax and CSS lint checks, hosted GREEN suites, and confirmation that the complete route and helper match their exact permitted forms in both directions. No local or hosted post-edit validation is claimed here. No route was executed: `globals.php` may have side effects, and source preservation alone does not grant security clearance.

QA must activate an actual PHP and workbench context, then check compiled default, dark and solar themes for the read-only field, controls and actions: colors, contrast, focus and keyboard behavior. It must also inspect clipping and fit in the initial, narrowed and resized modal-mlg iframe (500px requested initial height; auto-height remains viewport-capped), RTL, print, roles, and the real Close interaction. The scoped CSS offers fallback tokens, but does not certify any of those rendered outcomes.

The original 22, demo, exhaustive popup and Swedish gates remain open, as do denied boundaries. No cron behavior changes. Ordinary review approval is still needed; there is no standing review bypass. PR #96 stays draft, unmerged and undeployed until the controller completes its gates and approval process.
