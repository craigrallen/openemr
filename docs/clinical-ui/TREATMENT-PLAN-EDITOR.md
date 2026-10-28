# Treatment Planning editor

Route: `interface/forms/treatment_plan/new.php` in the clinical workbench.

This change presents the existing Treatment Planning form as an 860px paper sheet. The three metadata rows remain at the top; the seven narrative fields occupy full-width rows with taller, resizable text areas. At widths of 600px or less, the metadata cells stack. The existing Save, Print and Cancel controls remain native controls with their original handlers. The style applies on screen only when the workbench context class is present.

## Production scope

The sole production change is in `new.php`: the exact CSS proposal exported by `tests/clinical-ui/treatment-plan-editor-contract.cjs` is inserted once before the route's `</head>`, and `oe-treatment-plan-editor` is added to its existing `body_top` class. The contract's inverse must restore all 7,417 original bytes. There are no PHP, script, form action, field name, save, view or print changes.

The inherited `formHeader()` already emits `<html>`, `<head>` and `<body>` before this route emits its own nested tags. Browser HTML parsing repairs that structure: the route style is parsed in the open body and the second body tag's class is merged onto it. This slice leaves that source structure, malformed attributes and unset defaults unchanged. The workbench-scoped selectors rely on that browser repair; the source remains malformed.

## Evidence and limits

The controller recorded a genuine test-first RED on the unchanged production source: portable contract 6 tests, 5 passed, 1 failed; with `--history`, 7 tests, 6 passed, 1 failed. The sole failing assertion was the actual-source check for the missing presentation addition. The proposed CSS separately had zero stylelint errors. GREEN for the edited source is pending the controller's tests, lint and browser checks; no post-edit result is claimed here.

Offline synthetic templates can check layout and native controls, but they are not authenticated application acceptance. This is the original Treatment Planning form and two supporting capabilities, not completion of the full 22-feature reference or a signing workflow. Ordinary approval is required before merge or deployment.
