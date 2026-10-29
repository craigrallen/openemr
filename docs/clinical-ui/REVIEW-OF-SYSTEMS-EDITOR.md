# Review of Systems editor presentation

## Scope

OPEMR-156 adds the exact screen-only CSS exported by `tests/clinical-ui/review-of-systems-editor-contract.cjs` before `</head>` in `interface/forms/reviewofs/new.php` and `view.php`. The new form gets `body.oe-review-of-systems-editor`; the edit form retains `body_top` and adds the same class. CSS selectors require `html.oe-workbench-context`, so this presentation applies in the clinical workbench context. The `@media screen` block does not style print.

The form pages otherwise retain every original byte, including the ten system groups, 107 checkboxes in each variant, labels, additional notes, checked values on edit, form actions, CSRF token, session handler, Save and Cancel controls, and legacy page markup. This change does not alter `save.php`, `report.php`, shared assets, schema, or tests and fixtures.

The visual treatment uses a centered document sheet, responsive fieldset grids for the two existing checkbox structures, wrapping labels and actions, a wider notes area, and visible keyboard focus. The research page at `/Users/craig/artifacts/OpenEMR-Research/researched/index.html` is a partial questionnaire and document reference. It does not establish delivery of a full original design or all 22 systems.

## Verification handoff

The controller verified a genuine tests-only RED at `fa5420395b3f41b22b4c184379de33b20eeb644f`: portable contract 9 tests, 8 passed and 1 failed; history contract 10 tests, 9 passed and 1 failed. The sole failure in each was the missing live presentation addition. Evidence is in `/Users/craig/.hermes/projects/openemr/verification/review-of-systems-editor-20261029/red-corrected.tap` and `red-corrected-history.tap` in that directory. An earlier missing-path attempt and initial duplicate-mutant and lint setup failures were corrected before this RED and are not product failures.

The controller owns the post-edit checks. Run once, with at most one correction run if needed:

```sh
node --test-reporter=tap tests/clinical-ui/review-of-systems-editor-contract.cjs
node tests/clinical-ui/review-of-systems-editor-contract.cjs --history
npx jest tests/js/review-of-systems-editor.test.js --runInBand
```

The first two commands check exact CSS and reversible original-byte preservation; the history mode also checks the fixed base and path scope. The Jest wrapper checks the portable contract result. The controller also owns lint, browser inspection, review, and ordinary approval and hosted gates. No post-edit results are claimed here.

## Limits

The source contract verifies the declared presentation and byte-preservation seams. It does not prove authenticated clinical usability, save behavior, authorization, security, live-theme appearance, or print behavior in a hosted application. This work is unmerged and undeployed pending the controller's gates.
