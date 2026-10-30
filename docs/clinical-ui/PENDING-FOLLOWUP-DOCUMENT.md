# Pending Followup document — OPEMR-175

## Scope

The native `interface/orders/pending_followup.php` report receives a small, screen-only document presentation when `html.oe-workbench-context` is active. Its centered report is constrained to 1100 px with a fluid width, paper surface and padding. The existing heading is aligned left with natural spacing, and the existing form can use the available width. The change is limited to one style block in the HTML branch and one class on the existing body. It adds no controls, data or report workflow.

This is a partial adaptation of the researched workbench presentation, not the complete researched UI, feature 2's document-style note editor, all 22 features in `ACCEPTANCE.md`, or clinical acceptance. The pending followup report is an existing report, not a note editor.

## Preserved route behavior

The original facility and date filters, Refresh, Export to CSV and Print controls, report tables, SQL queries and bindings, and JavaScript remain in place. The `acct/rep` ACL guard remains before report rendering. Refresh and CSV report generation still check the POST CSRF input, and the form still carries its session CSRF token and `top.restoreSession()` handler. Patient and procedure values still use the original HTML escaping or CSV escaping paths. The CSV branch still emits its existing download headers and rows; it does not emit the new HTML style or body class. The style applies only to screen media in the workbench context; it introduces no print rule.

## Evidence and limits

The frozen `tests/clinical-ui/pending-followup-document-contract.cjs` checks the exact style and body insertion against the full original route fixture. It also checks placement in the HTML branch, scoped screen selectors, the workbench context chain, and rejects representative mutations to ACL, CSRF, SQL bindings, escaping and CSV behavior. The hosted `tests/js/pending-followup-document.test.js` runs that portable contract. These are source-contract checks; they do not execute PHP, query a database, render a browser or establish clinical behavior.

The controller's genuine RED evidence is `/Users/craig/.hermes/projects/openemr/verification/pending-followup-document-20261030/red-portable.tap`: 7 tests, 6 pass, 1 failure for the missing body class. Its `/Users/craig/.hermes/projects/openemr/verification/pending-followup-document-20261030/red-history.tap` records 8 tests, 7 pass, 1 failure before the tests-only commit `35d0f10e3a21337980a86495b7b7f4bd95ed846e`. GREEN and actual native acceptance are pending controller execution. No test or runtime gate was executed during this implementation allocation.

Ordinary review and hosted gates remain separate. Authenticated native checks still need to cover roles and ACL outcomes, CSRF, session restoration, Refresh, CSV output and Print, plus accessibility, responsive widths and RTL. The route-level source contract does not replace those checks or clinician review. The scheduled two-run allocation includes QA; after that budget, an independent untouched report must take over. It must not default to the earlier 239- or 55-test QA sets.
