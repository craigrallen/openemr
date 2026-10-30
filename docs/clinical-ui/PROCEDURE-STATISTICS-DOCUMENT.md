# Procedure Statistics document — OPEMR-176

## Scope

This is a partial presentation slice of the researched clinical workbench direction. It gives the existing Procedure Statistics HTML report a screen-only paper surface when `html.oe-workbench-context` is active. The report heading follows the document's left edge, and wide, dynamically generated tables can scroll inside the paper. The table receives paired dark ink and white surface colors. The 1100px limit applies to the paper, not to the number or meaning of report columns. The normal route and print presentation remain subject to their existing styling.

The researched [prototype](/Users/craig/artifacts/OpenEMR-Research/researched/index.html) is a mock reference. Its fictional rows and actions are not part of this route. This slice does not complete the [clinical UI plan](PLAN.md), the full 22-feature [acceptance register](ACCEPTANCE.md), or full reference fidelity.

The five-path review scope is:

1. `interface/orders/procedure_stats.php` — the only production edit, at the HTML head and body seams.
2. `docs/clinical-ui/PROCEDURE-STATISTICS-DOCUMENT.md` — this implementation and verification record.
3. `tests/clinical-ui/procedure-statistics-document-contract.cjs` — immutable portable source contract.
4. `tests/js/procedure-statistics-document.test.js` — immutable hosted adapter.
5. `tests/clinical-ui/fixtures/procedure-statistics-original.php.txt` — immutable complete original-route fixture.

Only paths 1 and 2 are edited in this implementation run. The fixture and tests remain unchanged. The contract's source guard requires the complete route to equal the fixture after removing exactly the added style block and body class; it also checks the five-path history, working, and untracked scope. The controller's prior tests-first RED evidence is `/Users/craig/.hermes/projects/openemr/verification/procedure-statistics-document-20261030/red.tap` (8 tests, 7 pass, 1 fail for the missing document class) and `/Users/craig/.hermes/projects/openemr/verification/procedure-statistics-document-20261030/red-history.tap` (9 tests, 8 pass, 1 fail). Both precede this production edit. The tests-only handoff HEAD is `92947698263c0596a6e9f407703c860b424a9e90`.

## Native behavior retained

The new CSS is inside the route's existing HTML branch, immediately before `</head>`, and is limited to `@media screen` and the document body class under the workbench context. No wrapper, asset, import, dependency, or script is added. The original form, Submit action, `Screen` / `Printer` / `Export File` choices, CSV response branch, printer callback, and date widgets remain in place. So do dynamic demographic, age, and followup columns; SQL and binds; ACL, CSRF, and session handling; escaping; and report generation. Existing print rules are untouched.

## Verification still required

The controller has not yet supplied GREEN for the portable contract or hosted adapter, nor native authenticated or browser evidence. Those are separate gates. Native QA must exercise Submit, Export File, Printer, date widgets, roles and security persistence, and the actual generated columns. Browser QA must inspect full keyboard use, contrast and accessibility, long labels, RTL, narrow and wide widths, and print. Full reference and the broader clinical acceptance register remain separate. No test, browser, DB, or hosted execution is claimed by this document.

This allocation is scheduled implementation plus QA, at most two runs including QA. Internal phases are not additional runs. No merge, administration bypass, deployment, or database change is part of this slice. After this allocation, the next default item is a different untouched eligible surface; unchanged parked CI is not a reason to poll this item again.
