# Clinical notes editor — OPEMR-152

## Scope and implementation

This implementation adds the frozen contract's single CSS block in the `head` of the native New/Edit Twig template and the `oe-clinical-notes-editor` class on its existing form. The CSS applies on screens within `html.oe-workbench-context`: an 860px maximum paper surface, a full-width narrative field, natural vertical spacing, readable metadata and linked items, and visible native actions and focus states. A narrow-screen rule stacks metadata fields. The style is presentation only.

The original Twig structure, JavaScript initialization and events, CSRF token, values, row loop, partial includes, and form action remain unchanged. The Save, View, and shared templates and scripts are untouched.

The frozen five-path change boundary is:

1. `interface/forms/clinical_notes/templates/new.html.twig` — implementation.
2. `tests/clinical-ui/fixtures/clinical-notes-template-original.twig.txt` — frozen original fixture; unchanged in this phase.
3. `tests/clinical-ui/clinical-notes-editor-contract.cjs` — frozen contract; unchanged in this phase.
4. `tests/js/clinical-notes-editor.test.js` — supporting test; unchanged in this phase.
5. `docs/clinical-ui/CLINICAL-NOTES-EDITOR.md` — this record.

Only paths 1 and 5 were edited in the IMPLEMENT phase.

## Evidence and verification status

Controller evidence directory: `/Users/craig/.hermes/projects/openemr/verification/clinical-notes-editor-20261028`.

At frozen head `a558e23a`, before the production addition, the genuine red portable contract reported 7 tests, 6 pass, 1 fail; the history variant reported 8 tests, 7 pass, 1 fail. Both failures were the expected missing production addition. The proposed CSS stylelint result was nonignored and reported zero warnings. These are pre-implementation results, not a claim that the edited template has passed controller verification.

The controller's contract commands are:

```sh
node --test-reporter=tap tests/clinical-ui/clinical-notes-editor-contract.cjs
node --test-reporter=tap tests/clinical-ui/clinical-notes-editor-contract.cjs --history
```

Controller verification after this edit is pending. The browser harness uses native Twig base, main, and partial templates with synthetic data and synthetic Twig helpers. It does not establish an authenticated workflow. The original two reference views provide support for this limited presentation change; full fidelity for both views and coverage of all 22 reference states have not been established.

No claim is made here that authenticated Save, document or result linking, search, cloning, security, persistence, clinical behavior, full accessibility, reference acceptance, or hosted gates passed.

## Run accounting

Owner: Hermes. This is scheduled run 1 of a maximum of 2. QA and internal phases are included within scheduled runs; they are not additional runs.
