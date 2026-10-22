# OPEMR-93 — Issues dashboard help presentation

## Scope and rationale

This change adds a screen-only palette to `Documentation/help_files/issues_dashboard_help.php` when the ordinary Issues help iframe is inside an active workbench. The page's own body class pairs with the shared controller's `html.oe-workbench-context` class. Neither class alone applies the new rules. The page has no new asset registration: `Header::setupHeader()` already loads the autoloaded `workbench-popup` script and stylesheet from `config/config.yaml`; the shared `popup.css` defines the canvas `#f3f7f5`, paper `#fff`, and ink `#17343b` tokens on the context root. Fallback values cover an absent token declaration.

The only production file changed is `Documentation/help_files/issues_dashboard_help.php`. The only added file is this note. `tests/js/contracts/issues-dashboard-help-popup.cjs`, its nonexecuting original fixture, and `tests/js/issues-dashboard-help-popup.test.js` remain the controller's tests-only HEAD (`7c63a85ac81bfa1ef1ae3c0fb9daac48f9a5d1fb`). No caller, shared controller, theme, PHP behavior, JS behavior, semantic warning/icon/button/control, guidance, link, font, or layout rule changes. Historical medical, ICD10, Ensora eRx, CCR, and CCD instructions remain verbatim as existing content; retaining them does not endorse clinical accuracy.

## Actual caller and context chain

`interface/patient_file/summary/stats_full.php` takes `pid` from the active session, enumerates `IssueTypeRegistry::issueTypes()`, and requires at least one `AclMain::aclCheckIssue` result. It then checks the patient's `squad` through `AclMain::aclCheckCore('squads', ...)`, denying access when appropriate. Its Issues sections check each issue type again, and Add requires `write` or `addonly`. For allergy/medication Add, `erx_enable` plus the user's `newcrop_user_role` can route to `eRx.php?page=medentry`; the existing eRx/portal include and `lists_touch.php` CSRF path are outside this edit. This is a source preflight of the safety boundary, not an authenticated role or session test.

That caller configures `OemrUI` with `show_help_icon => true`, `help_file_name => "issues_dashboard_help.php"`, and `expandable => true` for `stats_full_patient_xpd`, `external_data_patient_xpd`, and `patient_ledger_patient_xpd`. Its header include, `interface/patient_file/summary/dashboard_header.php`, passes `$oemr_ui->pageHeading()` into `templates/patient/dashboard_header.html.twig`; the caller later invokes `$oemr_ui->oeBelowContainerDiv()`. `OemrUI` gates the help icon with `enable_help`, uses `#help-href` to open `#myModal`, and emits the iframe as `id='targetiframe'` with an empty `src` and a `data-src` pointing at the help file. Its first-click handler assigns `src` once. Its separate expandable handler persists expanded state via `user_settings.php` with a CSRF token. The legacy `interface/help_modal.php` also uses a help iframe but is not this dashboard's `OemrUI` modal path.

In workbench mode, the help iframe may sit within the dashboard `contentframe`, below the active shell. The shared `interface/clinical-workspace/popup.js` walks same-origin parent/opener windows to that shell. For this ordinary `OemrUI` modal iframe, it adds `oe-workbench-context` to the help document's `<html>` while active, but does not add `oe-workbench-popup`. Mode changes and pagehide remove its owned context class. The route-local selector therefore requires both that context and `body.oe-issues-dashboard-help-popup`. Standalone, legacy, and blocked cross-origin cases remain outside the rule.

## Exact presentation seam

The inserted constant is the contract's exact `<style>` block immediately before the original `    </head>`; the original `    <body>` becomes `    <body class="oe-issues-dashboard-help-popup">`. Under `@media screen`, five paired background/foreground rules target: body canvas/ink; direct `.oe-help-container` paper/ink; `.oe-help-heading` paper/ink; non-button help links transparent/ink; and `.oe-help-redirect` transparent/ink. Every selector begins `html.oe-workbench-context body.oe-issues-dashboard-help-popup`. The direct-child container and `a:not(.btn)` boundaries avoid controls. The only `!important` declarations are heading `background-color` and redirect `color`: `interface/themes/colors/utilities/help-files.scss` gives `.oe-help-heading` a `background-color: $palepale !important` and `.oe-help-redirect` a `color: $darker !important`. `interface/themes/oe-common/help-files-common.scss` also provides help heading and link styling. No generic icon, warning, button, semantic palette, print, spacing, border, or typography override is added.

The original route is exactly 16,957 bytes with SHA-256 `a5dc0fde0cdfce137fd6821ae973e450fb240bb6c1780dcbf0479b2d97fb3eac`, pinned by `tests/js/fixtures/issues-dashboard-help-popup-original.php.txt` and authentic Git base `18647270e0c799189d2dc10f801e8de2bff1a360`. Complete inverse: remove the one exact contract `style` constant before `    </head>`, then replace the one `    <body class="oe-issues-dashboard-help-popup">` with `    <body>`. The resulting bytes must match that 16,957-byte fixture and base route byte for byte. This covers every untouched section, control, icon, link, PHP fragment, and whitespace byte, rather than selected snippets. The initial anchor defect in the test preparation was corrected before the recorded RED; its evidence was retained by the controller.

## Evidence and controller handoff

Before production, the controller recorded genuine corrected portable RED: 9 tests, 8 passed, 1 failed; direct `--history` RED: 10 tests, 9 passed, 1 failed; and a strict Jest adapter failure. Each sole failure was the missing live presentation seam. Synthetic candidate success and source-derived caller/controller checks establish a feasible exact edit, but source-only and synthetic evidence is neither native effective contrast nor authenticated acceptance. This production/doc handoff leaves GREEN **pending controller execution and independent review**.

From this checkout, the controller can run:

```sh
node --test --test-reporter=tap tests/js/contracts/issues-dashboard-help-popup.cjs
node tests/js/contracts/issues-dashboard-help-popup.cjs --history
node_modules/.bin/jest --runInBand tests/js/issues-dashboard-help-popup.test.js
git diff -- Documentation/help_files/issues_dashboard_help.php
git status --short
```

The controller should confirm the exact inverse against the fixture/base, inspect the two-file production/docs delta, and execute its normal gates. Pending acceptance includes default, dark, and solar themes with semantic descendants; illustrative Add/Save controls and focus contrast; actual roles and sessions; the native modal opened and resized at narrow and short viewports; keyboard, RTL, OS print, security, and clinician review. Complete hosted CI, including final Codecov, and ordinary approval remain pending. This source slice does not establish full design fidelity, all 22 requested features, exhaustive popup migration, clinical correctness, or merge readiness. The Swedish checkout/publication and PR 112 denied-review paths remain blocked. Publication, if later authorized, belongs to the controller on the fork's `master` base; branch, commit, and PR names must retain uppercase `OPEMR-93`.

After rotation, a different independent candidate for source preflight is the Patient Demographics help path: `interface/patient_file/summary/demographics.php` configures `medical_dashboard_help.php`. Inventory its own caller permissions, OemrUI path, original bytes, theme conflicts, and native acceptance scope before proposing any edit; OPEMR-93's Issues result does not validate that route.
