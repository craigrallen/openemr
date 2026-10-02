# Visit History workbench slice

## Route and scope

`interface/patient_file/history/encounters.php` is the existing Visit History route for patient and group encounters. It is also the clinical/billing switch; the same PHP renders issue-specific history, encounter forms and document rows. This change keeps that route and its query, permission and click paths. It adds `oe-clinical-history` to the body, loads `visit-history.css` and the existing `mode.js` from escaped webroot URLs, and versions each new asset with its own `filemtime()`.

`mode.js` adds `oe-clinical-workspace` only while a same-origin ancestor has `workbench-active`. Every Visit History CSS selector starts with `body.oe-clinical-workspace.oe-clinical-history` and all rules are inside `@media screen`. Direct, legacy-tab and print presentations therefore use the existing theme. The stylesheet changes the heading, patient identity line, clinical/billing and print controls, page-size field, pagination caption, and table chrome. A bounded horizontal scroll retains every clinical, billing, issue, group, insurance and follow-up column on narrow screens. It does not style status/error/alert classes or replace the meaning of existing buttons. Keyboard focus is visible; the page-size select has a native label. Focused encounter/document rows open with Enter or Space using the existing `toencounter` and `todocument` functions; keyboard events from nested controls are ignored.

## Source parity

Before/after counts in `encounters.php` from `git show HEAD:interface/patient_file/history/encounters.php` versus the edited file:

| Contract | Before | After |
| --- | ---: | ---: |
| `if ($billing_view)` | 6 | 6 |
| `if ($issue)` | 4 | 4 |
| `getFormByEncounter(` | 1 | 1 |
| `generatePageElement(` | 3 | 3 |
| `getPatientNameFirstLast($pid)` | 1 | 1 |
| `.encrow` click handler | 1 | 1 |
| `.docrow` click handler | 1 | 1 |
| `.billing_note_text` click handler | 1 | 1 |
| `createFollowUpEncounter(event,` | 2 | 2 |
| `top.printLogSetup` | 1 | 1 |

The source still computes patient name, public ID and DOB from the current PID; retains clinical/billing branches, issue and group variants, pagination query and links, billing-note editor and invoice/follow-up actions; and leaves the ACL/sensitivity checks and form report renderer in place. No database query or backend path changed.

## Verification and limits

The new focused Jest test first failed against the original page (`node_modules/.bin/jest tests/js/clinical-visit-history.test.js --runInBand`: 3 failed on the missing route class, stylesheet, label and keyboard contracts). After the production edit, the same command passed (3 tests). It parses the CSS for complete scoping and checks the real PHP source contracts and workbench mode controller.

Final local agent gates passed: `node_modules/.bin/jest --runInBand --silent` (24 suites, 376 tests), `node_modules/.bin/eslint tests/js/clinical-visit-history.test.js`, `node_modules/.bin/stylelint interface/clinical-workspace/visit-history.css`, `php -l interface/patient_file/history/encounters.php`, and `git diff --check`. The prepared checkout has no `vendor/`, so PHP integration tests cannot run here. The implementation agent did not touch Docker, Railway, DB or network services.

Controller verification subsequently exercised both the unchanged baseline and the actual redesigned local OpenEMR/MariaDB UI: synthetic Finder selection, clinical/billing round trip, five/all-results paging, mobile layout, encounter navigation and the actual nested four-field SOAP form. No clinical POST or JavaScript error occurred. Real-browser testing found the page-size label/select overflowing a narrow frame; a new focused CSS regression failed first, then the controller added wrapping/bounds and normal label whitespace. All four focused tests and Stylelint passed, and the same full browser route passed after copying the corrected source into the disposable local app. External evidence: `browser-qa/next-ui-redesign-local.json` and `visit-history-{clinical,billing,mobile}-redesign-local.png`.

Independent Claude source review found no concrete blocking regression before the small wrapping correction; the corrected snapshot receives a separate delta review. All-theme, RTL, restricted-role and print runtime verification remain limitations, not passing claims. Live deployment and exact-head hosted CI are separate gates.
