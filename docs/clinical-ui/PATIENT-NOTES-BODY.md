# Patient notes body: bounded reading geometry

Status: production CSS inserted after controller-verified RED; post-edit GREEN, hosted CI, browser checks and independent review are pending controller execution. This is a partial presentation change to the existing patient staff notes/messages list, not clinical acceptance.

## Scope and reference

The only route change is the exact `STYLE` exported by `tests/clinical-ui/patient-notes-body-contract.cjs`, inserted immediately before its exported `ANCHOR` in `interface/patient_file/summary/pnotes_full.php`. Removing that block restores the complete original route bytes. The existing `patient-messages.css` palette adaptation, markup, PHP, scripts, controls, data and endpoints remain as they were. The new rules are limited to `@media screen` and `body.oe-clinical-workspace.oe-clinical-messages #pnotes`, so they target the active workbench list.

The researched `messageView` reference in `OpenEMR-Research/researched/index.html`, recorded in [PATIENT-MESSAGES.md](PATIENT-MESSAGES.md), uses a `.sheet`/`.doc` composition with a clear header and readable message rows. This slice carries the reading geometry into the existing table: the patient name has its own 18px line below the heading; the nested row can occupy the available width; action labels can wrap; the existing sheet gets responsive padding; and the fifth table cell has a 38–65ch reading measure, 18px/22px padding and 1.65 line height. The table remains a table and its columns, links and actions stay present. This does not add a side-by-side reference pane or implement any reference feature.

This supports the original feature 6 (patient-linked internal notes/messages between medical staff) as a visual slice. Feature 6 is not completed, and none of the 22 features in [ACCEPTANCE.md](ACCEPTANCE.md) is accepted by this edit. There is no claim of clinical or runtime parity.

## Test evidence and pending checks

The controller's actual corrected portable RED, against the tests-only commit `5aa710a0bbc7b1cfd28e0e5dd00b71ca7d9c3fb9`, was **25 tests, 24 passed, 1 failed**: the live route was missing the exact inline style. The direct history run was **26 tests, 25 passed, 1 failed** for the same reason. Full fixture/base equality passed. The controller also exercised the exact proposed CSS with nonignored Stylelint and reported **0 warnings**. These are pre-edit observations, not GREEN results.

Controller verification commands for this change:

```sh
node --test --test-reporter=tap tests/clinical-ui/patient-notes-body-contract.cjs
node --test --test-reporter=tap tests/clinical-ui/patient-notes-body-contract.cjs --history
npm run test:js -- --runInBand tests/js/patient-notes-body.test.js
```

The contract checks the exact style, its location and the inverse that restores the complete route; the history mode checks the base fixture and changed-path scope. The controller owns post-edit GREEN, actual diff, PHP/Stylelint checks, hosted checks, browser checks and independent review. None is reported here as completed after this edit. A maximum allocation of **two consecutive SCHEDULED RUNs** limits scheduling; it is not a cap of two test attempts and is not test evidence.

Native authenticated gates remain open: staff send/read across permitted roles, restricted-role denial, CSRF, persistence, native table keyboard behavior, contrast, translated and RTL layout, and OS print. Existing denied Swedish clone/publication work and other denied scopes remain excluded.
