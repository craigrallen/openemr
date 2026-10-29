# GAD-7 editor document workspace (OPEMR-157)

## Scope and result

This is a partial implementation of the researched original requirement 2 for a clinical document workspace. The new and saved GAD-7 questionnaire routes receive the same screen-only, workbench-scoped presentation. In a workbench context, the existing form becomes a centered white document up to 860px wide on a muted background. Its question tables and selectors fit the available width; question text, the score, and the dynamically inserted difficulty question can wrap. Save and exit actions become full-width up to 20rem, with visible keyboard focus. Narrow screens use fluid padding and width rather than a separate questionnaire flow. Outside `html.oe-workbench-context`, and in print, these styles do not apply.

Only `interface/forms/gad7/new.php` and `interface/forms/gad7/view.php` gain the contract's identical `<style>` literal immediately before `</head>` and `oe-gad7-editor` on their existing body classes. The original HTML, form fields, values, action URLs, CSRF token, scoring and exit scripts, and shared engines remain as they were. The current form still uses its original tables and two sets of Save and exit controls. This presentation delta does not establish full fidelity to the researched design.

## Evidence and verification handoff

The controller established genuine RED before production edits: portable 8 tests, 7 pass and 1 fail; history 11 tests, 10 pass and 1 fail. The sole failure was the missing style/body seam on the actual routes. The earlier incorrect `undef` reset expectation was corrected to the inherited shared JavaScript behavior before that RED. Original route fixtures and all mutation checks remain in the tests. The proposed CSS had zero stylelint warnings in the controller's prior lint evidence. These are pre-implementation results; this production phase has not run tests, PHP, project runtime, or lint.

From the repository root, the controller can run the direct portable and history contracts:

```sh
node --test --test-reporter=tap tests/clinical-ui/gad7-editor-contract.cjs
node tests/clinical-ui/gad7-editor-contract.cjs --history
```

The hosted adapter is `tests/js/gad7-editor.test.js`. It invokes the portable contract and checks its reported plan and enumerated results dynamically, requiring every reported test to pass with no failures, skips, or todos. The contract's narrow DOM doubles exercise the unchanged shared scoring and optional difficulty scripts offline with synthetic helpers. That evidence is not clinical acceptance.

## Open gates and ownership

Authenticated Save and update, roles and permissions, security, persistence, accessibility, full visual fidelity, old browser engines, real RTL, and OS print remain open gates. The original 22 requirements, UI and demo review, and Swedish programme remain open. No deployment or merge has occurred; ordinary approval is still needed for those steps.

Hermes owns scheduled run 1 of at most 2, including QA. Internal phases are not separate scheduled runs. The controller will select a different item next.
