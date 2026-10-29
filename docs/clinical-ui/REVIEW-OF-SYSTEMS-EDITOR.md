# Review of Systems editor presentation

## Scope

OPEMR-156 adds the exact screen-only CSS exported by `tests/clinical-ui/review-of-systems-editor-contract.cjs` before `</head>` in `interface/forms/reviewofs/new.php` and `view.php`. The new form gets `body.oe-review-of-systems-editor`; the edit form retains `body_top` and adds the same class. CSS selectors require `html.oe-workbench-context`, so this presentation applies in the clinical workbench context. The `@media screen` block does not style print.

The form pages otherwise retain every original byte, including the ten system groups, 107 checkboxes in each variant, labels, additional notes, checked values on edit, form actions, CSRF token, session handler, Save and Cancel controls, and legacy page markup. This change does not alter `save.php`, `report.php`, shared assets, schema, or tests and fixtures.

The visual treatment uses a centered document sheet, responsive fieldset grids for the two existing checkbox structures, wrapping labels and actions, a wider notes area, and visible keyboard focus. The form-wide `.offset-sm-1` reset corrects the demonstrated 640px edit-page action overflow, including the Save and Cancel row outside the fieldset. Save uses white text on a dark teal background in its base, hover, focus, and active states. Cancel uses dark text on a pale background in those same states; its pale background overrides the shared button theme. Both controls have zero-duration transitions. The research page at `/Users/craig/artifacts/OpenEMR-Research/researched/index.html` is a partial questionnaire and document reference. It does not establish delivery of a full original design or all 22 requested features.

## Verification handoff

The controller verified a tests-only RED at `f88d7db2`: portable contract 11 tests, 10 passed and 1 failed; history contract 12 tests, 11 passed and 1 failed. The sole failure in each was the live CSS missing the updated button palette. Evidence is in `/Users/craig/.hermes/projects/openemr/verification/review-of-systems-editor-20261029/red-palette-corrected.tap` and `red-palette-corrected-history.tap` in that directory. The controller's corrected negative test indents the exact `color: #fff` declaration so it does not match the substring in `background-color: #fff`; the other negative cases remain in the contract.

The controller owns the post-edit checks:

```sh
node --test-reporter=tap tests/clinical-ui/review-of-systems-editor-contract.cjs
node tests/clinical-ui/review-of-systems-editor-contract.cjs --history
```

These commands check exact CSS and reversible original-byte preservation; the history mode also checks the fixed base and path scope. The Jest adapter is for hosted CI only. Local Jest and ESLint: NOT RUN. The controller also owns browser inspection, review, and ordinary approval and hosted gates. No post-edit results are claimed here.

## Limits

The source contract verifies the declared presentation and byte-preservation seams. It does not prove authenticated clinical usability, save behavior, authorization, security, live-theme appearance, or print behavior in a hosted application. This work is unmerged and undeployed pending the controller's gates.
