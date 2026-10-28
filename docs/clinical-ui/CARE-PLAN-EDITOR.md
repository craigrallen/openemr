# Care Plan encounter editor: workbench presentation

Issue: OPEMR-147. Owner: Hermes. SCHEDULED run 1 of maximum 2 after rotation from OPEMR-146/PR217; internal phases and handoffs do not consume scheduled runs. This is an authoring state, with controller verification and acceptance pending.

## Scope and change

The complete five-path boundary for this slice is:

1. `interface/forms/care_plan/templates/care_plan_form.html.twig`
2. `tests/clinical-ui/fixtures/care-plan-form-original.html.twig.txt`
3. `tests/clinical-ui/care-plan-editor-contract.cjs`
4. `tests/js/care-plan-editor.test.js`
5. `docs/clinical-ui/CARE-PLAN-EDITOR.md`

This production phase changes only the template and this document. The fixture, contract, and Jest adapter remain frozen. The template contains the contract's exact `<style>` block immediately before `</head>` and changes only `<body>` to `<body class="oe-care-plan-editor">` relative to the original fixture. The CSS applies to screens when `html.oe-workbench-context` is present: a bounded paper sheet, full-width row geometry, larger description area, paired action colors including the Solar Cancel correction, focus outlines, wrapping actions, and paired background and text colors for the reason card and its header. The existing `setupHeader()` path loads the workbench popup asset; its context class follows the active workbench host. Outside that context, and in print, the added rules do not apply. There is no added script or new clinical editor workflow.

The original template has a complete byte inverse under the contract's two additions. Its Twig expressions, actions, scripts, IDs, CSRF input, row loop and includes, Save/Cancel handlers, and hidden `#clickId` input are preserved. The pristine row stays in `<template id="care-plan-row-template">` outside the form, where its inputs remain inert until the existing `careplan.js` clones a row.

## Native call flow and source protections

`new.php` constructs `CarePlanController` and calls `newAction()`; `view.php` includes `new.php`. `newAction()` checks `FormService::hasFormPermission('care_plan')`, obtains patient and encounter IDs from the session, reads the requested form ID, and loads existing rows with patient and encounter filters. It supplies a session CSRF token, the rows, and reason status choices to this Twig template. The form posts to `save.php?id=…`; `save.php` requires an encounter session and calls `saveAction()` with the authorized user from the patient session. `saveAction()` checks form permission and the POST CSRF token, then validates that a positive submitted form ID belongs to the session patient and encounter before replacing rows in a transaction. `CarePlanFormService` performs the form membership lookup and row persistence. These are source protections already present; this presentation edit does not alter or newly exercise them.

## Reference and evidence

The visual reference is `/Users/craig/artifacts/OpenEMR-Research/researched/index.html#encounter`. It supports original requirement 2's two-pane encounter direction; the original 22 items are feature requirements, not researched work areas. The reference does not establish full fidelity or a complete clinical editor. The change adapts the Care Plan form to the current workbench context without claiming full reference fidelity.

The initial production CSS reached controller GREEN: 7/7 portable and 8/8 history checks passed. Offline native Twig rendering passed 40 cases and 120 comparisons for the checked geometry, legacy context, and print behavior; that pass missed the reason card's dark-theme contrast defect. An initial broader run timed out at 26/77; the retained full run passed. These results do not establish authenticated native behavior or full contrast and accessibility acceptance.

An independent reviewer then reported P2 for the reason card. Browser evidence at dark 320 px in both LTR and RTL showed dark text on a black reason card (1.452:1) and failing reason labels (`browser-reason-red.json`). The synthetic proposal and mutation guards passed, and the proposed reason CSS had zero stylelint warnings. The controller verified the tests-only reason correction against the unchanged production template. Direct portable command:

```sh
node --test-reporter=tap tests/clinical-ui/care-plan-editor-contract.cjs
```

RED: 8 tests, 7 passed, 1 failed because the actual template lacked the updated reason CSS block. Direct history command:

```sh
node --test-reporter=tap tests/clinical-ui/care-plan-editor-contract.cjs --history
```

RED: 9 tests, 8 passed, 1 failed for the same actual-template condition. These were pre-edit results for the reason correction; the reason palette is present in the current template.

### Solar Cancel correction

The native Twig browser check then covered all eight Solar cases and found Cancel text and background at 1.078:1 contrast (`browser-solar-red.json`). This is genuine browser RED evidence for the CSS present before this correction. The proposed scoped CSS keeps Cancel's light background and dark foreground across rest, hover, focus, and active states, while preserving the existing focus outline rules. Its exact literal is exported by the portable contract. The proposed CSS had zero stylelint warnings.

Before the production source edit, the controller ran the tests-only Solar proposal. The first attempt at `cd70b510` had an extra mutant setup failure; that result was retained, and the test setup was corrected without editing production source. All proposal and mutant subtests then passed. The direct portable run was genuinely RED with 9 tests, 8 passed, and 1 failed on the old actual template. The direct history run was genuinely RED with 10 tests, 9 passed, and 1 failed for the same actual-template mismatch. An independent Astra review also found that the Jest adapter expected a hardcoded seven tests while the portable suite now has eight; the tests-only adapter was corrected to check TAP plan, test, pass, and fail agreement.

This document records those pre-edit results, not a post-edit GREEN claim. The controller owns final GREEN verification against the actual template, all-state browser checks, the full hosted run, and fresh independent review. Authenticated native application acceptance remains pending.

No authenticated native application execution, clinical acceptance, merge, or deployment is claimed.

## Open work and limits

Ordinary approval; native Save/Update behavior and persistence; roles, permission and security behavior under real sessions; row cloning and reason widgets; native accessibility, full contrast, translations, RTL, older browsers and operating systems, and full reference fidelity remain OPEN. Offline print checks passed, but native print acceptance remains open. This is not a new full clinical editor. No master branch, production database, patient data, integrations, vendor assets, policy, or cron actions are part of this slice.
