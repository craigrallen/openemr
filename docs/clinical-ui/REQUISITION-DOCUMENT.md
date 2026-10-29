# Lab requisition document: screen presentation

OPEMR-169 production phase, run allocation **1/2**, owner **Hermes**. This is a partial clinical UI styling slice for `interface/forms/requisition/new.php`. It frames the existing requisition as a bounded document in the workbench and keeps the requisition table scrollable within `.req` at narrow widths. It is not clinical acceptance or deployment.

## Actual scope

This phase adds only the exact `<style>` block specified by `tests/clinical-ui/requisition-document-contract.cjs` immediately before `</head>` and `class="requisition-document"` on the opening `<body>`. The rules apply only under `@media screen` and `html.oe-workbench-context body.requisition-document`. They style the document sheet, header, table surface and existing print button. Outside that workbench context, the new rules do not match. No new script, asset, control or field is added.

The final five-file history scope is the three controller-verified, tests-only files (`tests/clinical-ui/fixtures/requisition-new-original.php.txt`, `tests/clinical-ui/requisition-document-contract.cjs`, and `tests/js/requisition-document.test.js`) plus this document and `interface/forms/requisition/new.php`. This production phase changes only the latter two files. No PHP, JavaScript, SQL, escaping, barcode write, print handler, field, control or other DOM content is changed. There is no merge, deployment, database or cron change.

The contract's full inverse removes the exact body class and exact inserted style block, restoring **every byte** of the original route fixture. Its `verifySource` comparison also requires the candidate to equal `proposed(fixture())`, so unrelated source edits are outside scope. The default contract suite checks the original fixture, CSS rules, exact route proposal and mutations. `--history` adds verification that the fixture is the exact base Git blob and that committed, staged, working and untracked paths together equal the strict five-file scope.

## TDD evidence and limits

The controller verified tests-only commit `265e5ca463599101b0ad0a7059b679fbf45a08fb` before these production edits. The portable RED log has **9 tests, 8 pass, 1 fail**: the real route lacks the proposed presentation. The `--history` RED log has **11 tests, 9 pass, 2 fail**: the same missing presentation and the not-yet-final five-file scope. Logs are `/Users/craig/.hermes/projects/openemr/verification/requisition-document-20261029/red-portable.log` and `red-history.log` in that directory. The proposed CSS passed Stylelint with zero warnings after an extraction newline correction; that checks the proposal, not the production file. No post-edit execution or GREEN result is claimed here.

This is a screen-only layout change, with `.req` retaining local horizontal scrolling. The route already has duplicate `printableArea` IDs, invalid inline styles, barcode persistence on GET, and print code that restores the DOM after printing. These are inherited conditions, neither fixes in this slice nor new regressions from it. Because GET can persist a barcode, this route must not be bootstrapped merely to inspect its appearance.

Authenticated browser verification, native print verification, hosted CI and independent review are **PENDING** until controller evidence exists. No authenticated workflow, security, persistence, native print or full research UI acceptance is claimed. This slice closes none of the 22 clinical UI acceptance features. Ordinary approval remains required; there is no merge bypass.

SDOH168 remains blocked and was not retried in this independent requisition lane. The next different run after this budget is a native clickmap body only after reachability and ownership preflight; it is neither reserved nor accepted here.
