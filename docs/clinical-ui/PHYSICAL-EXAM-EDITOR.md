# Physical exam editor presentation slice (OPEMR-163)

## Purpose and limit

The researched encounter reference at `/Users/craig/artifacts/OpenEMR-Research/researched/index.html` proposes a document-shaped editing surface. This slice gives the existing physical exam checklist a light document sheet, readable column spacing, a horizontal scroll area for narrow viewports, and visible focus and Save controls inside the workbench. The CSS is scoped to `html.oe-workbench-context body.physical-exam-document-editor` and screen media. The original checklist, diagnosis popup, form action, and clinical data path remain the native OpenEMR implementation.

This is **partial progress on original requirement 2** in [ACCEPTANCE.md](ACCEPTANCE.md): “Document-style note editor with natural spacing, spell-check and autocorrect.” It does not complete that requirement. This physical exam slice adds presentation only; it does not add spell-check or autocorrect, create a new note editor, or establish clinical acceptance. The reference is a design artifact, not a clinical or implementation oracle.

## Exact five-file scope

The complete OPEMR-163 delivery scope, counting the existing tests-first phase and this implementation phase, is:

1. `tests/clinical-ui/fixtures/physical-exam-new-original.php.txt` — original native source fixture.
2. `tests/clinical-ui/physical-exam-editor-contract.cjs` — exported exact presentation proposal, preservation contract, and scope checks.
3. `tests/js/physical-exam-editor.test.js` — JavaScript-side contract coverage.
4. `interface/forms/physical_exam/new.php` — only production edit: the exported inline screen CSS before `</head>` and the body class marker.
5. `docs/clinical-ui/PHYSICAL-EXAM-EDITOR.md` — this scope and verification record.

The tests and fixture were established in the earlier RED phase. The controller recorded 8 tests, 7 passing, and 1 failing for missing presentation at head `626acbd3`, before the production edit. No tests, fixture, or other production files are edited in this phase. `lines.php`, `view.php`, and `edit_diagnoses.php` are unchanged supporting code. The contract's inverse removes the exact CSS and marker and must restore every byte of the original fixture.

## Native action and save semantics

Launch the Physical Exam through its existing encounter form entry point. The native `new.php` route checks the encounter and patient/form association, loads the same system and treatment lines, and posts the same `form_obs` fields and CSRF token. Save is the native `bn_save` submit: the existing transaction replaces persisted rows for an existing form or creates a new form, then redirects unless `form_refresh` is set. Cancel retains the native tab-close action. The diagnosis “Edit” option still opens `edit_diagnoses.php` through `dlgopen`.

After the diagnosis popup saves, its opener calls `refreshme()`. That function sets `form_refresh` and calls `form.submit()`. A programmatic submit does not include the clicked `bn_save` submit control, so this refresh reloads persisted rows without running the Save branch. Unsaved edits in the opener can be lost on that refresh. The presentation change does not alter this native behavior; authenticated QA must exercise it and record the outcome. If an explicit Save request includes `form_refresh`, the existing Save branch persists and stays on the form.

## Verification gate

The mandatory next gate is **at most two consecutive scheduled runs total, including QA**. The controller's prior RED run is historical evidence, not a post-change pass. Schedule the contract and applicable static checks, then authenticated browser QA within that two-run limit; do not represent a planned or incomplete run as passed. Record commands, results, and any blocker before seeking ordinary approval. A third consecutive scheduled run requires a new decision rather than an automatic retry.

Pending evidence includes authenticated native launch, Save, security and CSRF, patient/encounter association, persistence and refresh, keyboard and focus accessibility at narrow widths and zoom, comparison with the encounter/document reference, clinical review of the unchanged checklist, localization and RTL, old browser engines, OS print behavior, and ordinary approval. No screenshot or post-change test result is claimed here. No merge, deployment, or live execution is part of this implementation phase.
