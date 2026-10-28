# Clinic Note editor sheet

## Scope and layout

`new.php` and `view.php` gain the same presentation-only additions. In the active workbench, on screen, the original table becomes a centered white encounter sheet capped at 860px. The encounter heading has a title rule; History, Examination and Plan become stacked sections with full-width writing fields, readable line spacing and vertical resize. Follow Up stays in the sheet: its three native radio choices remain visible, and the existing timing input sits beside “Required in” when space permits and wraps when it does not. The Save and Cancel actions sit in a wrapping footer separated by a rule. At narrow widths, the sheet uses available width and the controls can wrap. The rules require both `html.oe-workbench-context` and `body.oe-clinic-note-editor` inside `@media screen`.

The four exact additions on each route are the literal contract CSS after `Header::setupHeader()`, plus the `oe-clinic-note-editor` body class, `oe-clinic-note-form` form class and `oe-clinic-note-sheet` table class. Header autoload already provides the workbench popup script and stylesheet; no import or link is needed. The original route bytes remain intact around these additions. Native follow-up values (`1`, `2`, `0`), radio helpers and timing field, Save/Cancel, session, CSRF, patient and encounter handling, form values and SQL are preserved. In particular, the original `view.php` form still posts to `new.php`.

This is a Clinic Note sheet slice of the researched encounter document, not a complete match to the accepted reference. The reference includes a central document and quiet read-only same-patient context; this change supplies the central writing geometry only. The reference pane, other visit forms, medical autocorrect and broader clinical workflows remain unfinished.

## Seven-path boundary

The contract's allowed paths are exactly:

1. `interface/forms/clinic_note/new.php`
2. `interface/forms/clinic_note/view.php`
3. `tests/clinical-ui/fixtures/clinic-note-new-original.php.txt`
4. `tests/clinical-ui/fixtures/clinic-note-view-original.php.txt`
5. `tests/clinical-ui/clinic-note-editor-contract.cjs`
6. `tests/js/clinic-note-editor.test.js`
7. `docs/clinical-ui/CLINIC-NOTE-EDITOR.md`

The four test and fixture files are frozen for this implementation phase. Only the two routes and this document are edited.

## Tests-first evidence and remaining gates

The exact original base is `09b29da7771aea334ed5745e058751157af980d7`. The tests-only handoff HEAD is `baa0864461cebe7898066a043e2d66e283a9d72a`. On unmodified production routes, the controller verified a corrected RED run: portable contract **8 tests, 6 passed, 2 failed** for the missing route additions; history contract **9 tests, 7 passed, 2 failed** for the same reason. The initial lint assessment was corrected with an actual, nonignored CSS stylelint invocation: **0 errors, 0 warnings**. These are baseline results, not a post-edit GREEN claim.

The controller's direct contract commands are:

```sh
node --test-reporter=tap tests/clinical-ui/clinic-note-editor-contract.cjs
node --test-reporter=tap tests/clinical-ui/clinic-note-editor-contract.cjs --history
```

The controller will run these and its offline browser and hosted gates after the implementation. Those gates have not yet produced post-edit evidence. No authenticated, native workflow, clinical, mobile, print or contrast acceptance is claimed. This slice does not complete feature 2 or all 22 requested features, and it implies no new ownership or security acceptance.
