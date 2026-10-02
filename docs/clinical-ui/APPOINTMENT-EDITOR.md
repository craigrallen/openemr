# Appointment editor workbench slice

## Scope

The real `interface/main/calendar/add_edit_event.php` form now loads scoped screen-only `appointment.css` and the existing ancestor-aware `mode.js`. Each asset has an escaped per-file `filemtime()` URL token. The actual Patient/Provider/Group tabs, subject strip, schedule/recurrence region, field labels and action region use the same paper/petrol design as the calendar.

Existing form IDs/names, callbacks, form POST target, event dispatches, guards and direct-child layout remain intact. No SQL, save/delete/duplicate/availability/recurrence handlers changed. Labels were connected to the existing Repeat and Room controls; Comments gained a matching ID. Category/status selects, DOB warning, recurrence alert, patient infobox and danger actions retain theme colours and visibility. New CSS neither hides controls nor moves iframe ancestors.

Activation is confirmed for the application's actual calendar `newEvt` → `dlgopen` iframe dialog, whose same-origin ancestor hosts the workbench. Legacy/direct pages keep their existing presentation; screen media scoping leaves print styling to the theme. Standalone opener-only popups, all installed module hooks and every restricted role/theme are not claimed browser-verified.

Asset versions come from `OpenEMR\Common\Assets\ClinicalWorkspaceAssets::version()`, a read-only lookup of fixed asset basenames. The default directory is `interface/clinical-workspace` (`appointment.css`, `mode.js`, `visit-history.css`); the allowed legacy `ajtooltip.js` lives in `library/js` and requires a separate helper instance pointed at that directory. The helper returns the file's real `filemtime()` as a string, `'0'` when the file is missing, and throws for any other name, which rules out filename traversal. The view's URL expression therefore names only the web root, the asset and the helper call. Inlining `filemtime(__DIR__ ...)` had made the core `AssetCacheBusterTest` treat the hrefs as filesystem paths, so they failed its no-query-string rule. That guard is unchanged. The helper's real temp-file tests live in `tests/Tests/Isolated/Common/Assets`.

## Verification

- Claude implemented the production restyle and baseline/source parity tests; the controller recovered turn-limit exits and fixed two Stylelint findings.
- Controller observed a genuine failing asset-cache regression (23 pass/1 fail), then replaced static include versions with per-file versions; focused 24 tests, Stylelint and PHP syntax passed.
- Independent Codex source review found no concrete P1/P2 regression in the reviewed production diff/CSS. Source review is not runtime proof.
- Controller exercised baseline and redesigned local OpenEMR/MariaDB using real calendar and original Patient/Provider tab links: actual form visible, a temporary unsaved Comments draft survives programmatic host legacy/workbench toggling while the modal stays open, tab round trip and original Cancel action work. No clinical POST, saved appointment, generated note or database mutation was performed by these checks.
- The same local browser pass exercises synthetic Finder → Visit History clinical/billing views → five/all-results paging → mobile overflow → actual encounter → nested four-field SOAP form. Evidence is external `browser-qa/next-ui-redesign-local.json` and `appointment-{patient,provider}-redesign-local.png`.

This is presentation delivery, not completion of the original 22-feature backend/integration register. Live deployment and exact-head hosted CI remain separate gates; local screenshots do not prove Railway rollout or all-role parity.
