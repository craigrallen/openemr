# Prescription editor popup presentation (OPEMR-178)

## Scope and native path

This is a screen-only presentation change in `templates/prescription/general_edit.html.twig`. The existing `controller.php?prescription&edit` route reaches `C_Prescription::edit_action()`, then `default_action()`, which selects `prescription/` + `template_mod` + `_edit.html.twig`. The general template is the selected general editor; no new route or launcher is introduced.

EyeMag `editScripts()` opens an iframe dialog at 910 px by 400 px, with drag and resize enabled. Demographics `editScripts()` conditionally opens the same prescription flow in a `modal-xl` iframe dialog at 400 px high, also draggable and resizable. The list's Edit action uses native document navigation, remaining inside the existing iframe when opened from those dialogs. Ordinary page navigation to the editor remains supported.

The workbench popup script adds `oe-workbench-context` to the document element only in an active same-origin workbench. The editor body class limits the new CSS to this editor in that context. The frozen rule gives the editor a paper surface capped at 1000 px with natural spacing, permits existing form rows and action labels to wrap, retains a physical margin fallback before `margin-inline`, and clears the form's existing float. It does not repaint all fields, all buttons, the AMC controls, or print output.

## Frozen preservation boundary

The only production edits are the exact `ADDED_STYLE` string inserted immediately before the unique `\n</head>` seam and the exact `BODY_AFTER` replacement for `<body id="prescription_edit">`. The whole original template is retained in `tests/clinical-ui/fixtures/prescription-editor-original.html.twig.txt`. The portable contract removes those two additions and requires the resulting source to equal the fixture; it also checks the fixture against the pinned Git original and unchanged support paths. The strict hosted adapter requires a positive TAP plan with every test passing. The intended final five-path delta is the committed contract, hosted adapter, original fixture, this template, and this document.

Native simplified and full prescription branches, conditional dispense for new and existing prescriptions, AMC prompting, top and bottom action bars, Weno and RxCUI lookup choices, validation, CSRF and session handling, and Save and Print and coding callbacks remain in their original source paths. No input IDs, labels, values, actions, Twig conditions, scripts, or clinical behavior were changed.

## Evidence and pending verification

The controller's recorded pre-implementation RED is `/Users/craig/.hermes/projects/openemr/verification/prescription-editor-popup-20261030/red.tap`: seven contract tests, six passing and one failing because the body marker was absent. This is recorded evidence, not a test run by this implementation owner. The owner did not execute tests, CSS lint, or a browser run under the scheduled allocation. The accepted `/Users/craig/artifacts/OpenEMR-Research/researched/index.html` is presentation research, not evidence that this native popup or the broader 22 areas are complete.

Controller QA still needs the actual portable and hosted contract runs, CSS lint, and rendered light and dark theme checks at dialog and responsive widths, including keyboard and legacy print behavior. Native modal open and resize, select2 and date widgets, conditional dispense visibility, native callbacks, Save and Print, security and persistence, clinical flows, full contrast, accessibility, and full reference acceptance remain pending. This partial presentation change does not establish exhaustive popup coverage, demo completion, Swedish readiness, or completion of the 22 feature areas.

The scheduled surface budget is at most two consecutive runs, including implementation and QA. After that budget, the default next work is a different untouched popup or original 22 area, not unchanged CI polling. No merge, bypass, deploy, production, database, national service, vendor, or cron action is part of this change.
