# Treatment Planning editor

Route: `interface/forms/treatment_plan/new.php` in the clinical workbench.

This change presents the existing Treatment Planning form as an 860px paper sheet. The three metadata rows remain at the top; the seven narrative fields occupy full-width rows with taller, resizable text areas. At widths of 600px or less, the metadata cells stack. The existing Save, Print and Cancel controls remain native controls with their original handlers. The style applies on screen only when the workbench context class is present.

## Production scope

The sole production change is in `new.php`: the exact CSS proposal exported by `tests/clinical-ui/treatment-plan-editor-contract.cjs` is inserted once before the route's `</head>`, and `oe-treatment-plan-editor` is added to its existing `body_top` class. The contract's inverse must restore all 7,417 original bytes. There are no PHP, script, form action, field name, save, view or print changes. The initial duplicate anchor and CSS specificity order issues were fixed before the production commit.

The inherited `formHeader()` already emits `<html>`, `<head>` and `<body>` before this route emits its own nested tags. Browser HTML parsing repairs that structure: the route style is parsed in the open body and the second body tag's class is merged onto it. This slice leaves that source structure, malformed attributes and unset defaults unchanged. The workbench-scoped selectors rely on that browser repair; the source remains malformed.

## Evidence and limits

The controller recorded a genuine test-first RED on the unchanged production source: portable contract 6 tests, 5 passed, 1 failed; with `--history`, 7 tests, 6 passed, 1 failed. The sole failing assertion was the actual-source check for the missing presentation addition. Tests-only commit `79ec8460` preceded production commit `70932250`.

The final controller delivery supersedes implementation-time evidence: the edited source passed the portable contract 6/6 and `--history` 7/7, PHP syntax and diff checks passed, and the actual CSS passed stylelint with zero warnings. No local Jest or ESLint run was made, preserving the denied boundaries. Browser checks, full hosted validation and independent review were still pending at this documentation edit.

Offline synthetic templates can check layout and native controls, but they are not authenticated application acceptance. This work supports original requirement 2 only. It does not complete feature 2, all 22 features, the full reference, or signing acceptance. Authenticated Save and Print behavior, role and CSRF handling, patient and encounter context, persistence, widgets, accessibility, full contrast, localization, older browsers and operating systems, and print behavior against the full reference remain open.

The schedule is run 1 of a maximum of 2, including QA; internal phases are not separate runs. The default next subject is a different AfterCare Planning document workspace with a fresh preflight, and that subject is not reserved. Ordinary approval is required; there is no standing bypass and no merge or deployment is authorized.
