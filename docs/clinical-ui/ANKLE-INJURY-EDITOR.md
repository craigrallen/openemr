# OPEMR-155: Ankle Injury workspace

Owner: Hermes scheduled run 1 of at most 2, including QA. This is the Ankle Injury slice; OPEMR-154 and PR 225 have separate ownership and evidence.

## Scope and behavior

The existing Ankle Injury new and view forms gain the same minimal document surface when `html.oe-workbench-context` is present. A screen-only, form-scoped style block sits before `</head>`; the body gains `oe-ankle-injury-editor`; the existing Plan table gains `oe-ankle-plan`. The form has an 860px maximum width, naturally spaced 12rem injury narrative and Plan fields, compact additional X-ray and diagnosis notes, and actions that wrap at narrow widths. Existing clinical table relationships remain native. Tables scroll horizontally within the document when their contents need more width.

The implementation preserves the original form source apart from those three exact additions. It does not change fields, values, selectors, form actions, CSRF markup, save or retrieval code, scripts, wrappers, or clinical codes. The styling is limited to the active workbench context on screen; direct legacy and print presentation keep their existing source path.

## Evidence and acceptance boundary

The controller corrected an initial bare-selector positive-oracle defect before the RED run. Its corrected `red-corrected.tap` reported 9 portable tests: 8 passed, 1 failed; `red-corrected-history.tap` reported 10 history tests: 9 passed, 1 failed. In both runs the failure was the missing production addition. The proposed CSS also passed actual nonignored Stylelint with zero warnings. These are pre-implementation controller results; this run has not executed the controller tests or a browser. Source preservation proves the exact allowed additions against frozen originals. It does not establish rendered clinical acceptance or authenticated Save and reopen.

The original requirement 2 is supported by this small document treatment, not fulfilled across all 22 areas. The researched reference at `/Users/craig/artifacts/OpenEMR-Research/researched/index.html` is a visual proposal; it is not clinical acceptance evidence. No browser, autocorrect, spellcheck, or authenticated Save result is claimed here.

The controller owns test execution and independent review. Its portable and history commands are:

```sh
node --test --test-reporter=tap tests/clinical-ui/ankle-injury-editor-contract.cjs
node --test-reporter=tap tests/clinical-ui/ankle-injury-editor-contract.cjs --history
```

Pending: native browser review across five themes, independent final review, hosted tests and coverage, and ordinary approval. Authenticated Save and reopen, security and persistence, roles, patient and encounter context, CSRF behavior, clinical codes, reference fidelity, accessibility, OS print behavior, localization, and older engines remain open.

This slice does not authorize merge, deploy, database or patient changes, national or vendor publication, or cron work. Denied actions are not retried here: Swedish clone or publication, local Jest or cache execution, combined ESLint source Git diff, source schema, and protected auxiliaries.
