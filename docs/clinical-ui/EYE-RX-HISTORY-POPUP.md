# Eye Rx history popup: OPEMR-28 production phase

## Scope and rationale

The existing Rx History heading table receives a paired ink and paper palette, and its underlined `h4` receives the workbench petrol color on a transparent background. The stylesheet applies only on screen, under `html.oe-workbench-context`, to the newly marked heading table. This is a partial heading presentation change. It does not complete the empty-state palette, the popup, researched design fidelity, security review, or clinical acceptance.

Exactly four production files are owned by this phase:

- `interface/forms/eye_mag/SpectacleRx.php`: one sorted asset import, one escaped and versioned screen stylesheet link immediately after the first, history-branch `Header::setupHeader`, and one class on the existing heading table.
- `src/Common/Assets/ClinicalWorkspaceAssets.php`: one sorted `eye-rx-history-popup.css` allowlist entry.
- `interface/clinical-workspace/eye-rx-history-popup.css`: exactly two heading paint rules inside one screen media rule.
- `docs/clinical-ui/EYE-RX-HISTORY-POPUP.md`: scope, evidence, and acceptance boundaries.

The frozen contract is `tests/js/eye-rx-history-popup.test.js`. Its full-source forward and inverse comparisons preserve every original byte outside the declared additions: all 1,576 original route lines and the complete original asset helper. The route's other Header and print branch, inherited body and wrappers, geometry, fonts, controls, clinical cards, JavaScript, backend paths, and caller stay as they were. No test or fixture is edited.

## Evidence and ownership

The controller completed genuine hosted JS RED on run `39052214889` at tests-only `3f433fab5d1d1171b37444ba3700f1022692a0bb`: exactly the three intended actual-route, actual-helper, and actual-CSS failures; 1,264 tests passed across 62 suites. Synthetic forward, full inverse, strict CSS AST, negative, caller, and context tests passed. Before RED, the controller independently compared the entire original 1,576-line fixture and the entire inline helper baseline byte-for-byte with actual master `18647270`. Claude encountered an actual organization monthly 429 and made no edits; Codex Sol implements after hosted RED, with review assigned to a different provider.

The controller owns genuine hosted GREEN verification, starting with run 1 and capped at 2 runs, plus independent review. GREEN is pending. This implementation phase used local file inspection and the four specified file edits only; it made no runtime or test claim. The existing draft PR is `#102`; it remains unmerged and undeployed. Ordinary approval still applies.

## Preserved behavior and open acceptance

Session patient ID, mutation ownership checks, POST CSRF, query bindings, clinical values, escaping, print behavior, and both route branches are retained by the source-preservation contract. This retention is not security clearance. No app GET or POST, database or patient read, print, delete, prescribe, integration, deployment, cron, or master merge was performed here.

Real PHP/bootstrap execution, opener and context activation, compiled-theme contrast, narrow 560 × 590 initial and resized layout, keyboard and RTL behavior, print roles, and native QA for real delete, print, and opener workflows remain open. The history branch places `<title>` before `<head>` and has no literal opening `<body>` tag before `report_header`; `report_header` output and browser markup recovery were not executed and are not characterized as malformed. Inherited body presentation, fixed geometry, unchanged Rx-card palette, and click-only delete remain inherited unresolved conditions.

All previously denied boundaries remain in force. The Swedish blocked clone and publication are untouched; the earlier parked gates, original 22 acceptance items, and demo limitations remain open. This document does not authorize clinical use, publication, merge, or deployment.
