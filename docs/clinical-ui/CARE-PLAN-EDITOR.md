# Care Plan encounter editor: workbench presentation

Issue: OPEMR-147. Owner: Hermes. SCHEDULED run 1 of maximum 2 after rotation from OPEMR-146/OPEMR-217; internal handoffs do not consume runs. This is an authoring state, with controller verification and acceptance pending.

## Scope and change

The complete five-path boundary for this slice is:

1. `interface/forms/care_plan/templates/care_plan_form.html.twig`
2. `tests/clinical-ui/fixtures/care-plan-form-original.html.twig.txt`
3. `tests/clinical-ui/care-plan-editor-contract.cjs`
4. `tests/js/care-plan-editor.test.js`
5. `docs/clinical-ui/CARE-PLAN-EDITOR.md`

This production phase changes only the template and this document. The fixture, contract, and Jest adapter remain frozen. The template adds the contract's exact `<style>` block immediately before `</head>` and changes only `<body>` to `<body class="oe-care-plan-editor">`. The CSS applies to screens when `html.oe-workbench-context` is present: a bounded paper sheet, full-width row geometry, larger description area, paired action colors, focus outlines, and wrapping actions. The existing `setupHeader()` path loads the workbench popup asset; its context class follows the active workbench host. Outside that context, and in print, the added rules do not apply. There is no added script or new clinical editor workflow.

The original template has a complete byte inverse under the contract's two additions. Its Twig expressions, actions, scripts, IDs, CSRF input, row loop and includes, Save/Cancel handlers, and hidden `#clickId` input are preserved. The pristine row stays in `<template id="care-plan-row-template">` outside the form, where its inputs remain inert until the existing `careplan.js` clones a row.

## Native call flow and source protections

`new.php` constructs `CarePlanController` and calls `newAction()`; `view.php` includes `new.php`. `newAction()` checks `FormService::hasFormPermission('care_plan')`, obtains patient and encounter IDs from the session, reads the requested form ID, and loads existing rows with patient and encounter filters. It supplies a session CSRF token, the rows, and reason status choices to this Twig template. The form posts to `save.php?id=…`; `save.php` requires an encounter session and calls `saveAction()` with the authorized user from the patient session. `saveAction()` checks form permission and the POST CSRF token, then validates that a positive submitted form ID belongs to the session patient and encounter before replacing rows in a transaction. `CarePlanFormService` performs the form membership lookup and row persistence. These are source protections already present; this presentation edit does not alter or newly exercise them.

## Reference and evidence

The visual reference is `/Users/craig/artifacts/OpenEMR-Research/researched/index.html#encounter`. It supports the original two-pane encounter direction; it is not evidence of fidelity to all 22 researched work areas or of a complete clinical editor. The change adapts the Care Plan form to the current workbench context without claiming full reference fidelity.

The controller verified tests-only commit `c6f24b5a` against the unchanged production template. Direct portable command:

```sh
node --test-reporter=tap tests/clinical-ui/care-plan-editor-contract.cjs
```

RED: 7 tests, 6 passed, 1 failed, because the actual template lacked the proposed additions. The synthetic proposal and mutation guards passed. Direct history command:

```sh
node --test-reporter=tap tests/clinical-ui/care-plan-editor-contract.cjs --history
```

RED: 8 tests, 7 passed, 1 failed for the same actual-template condition. The controller also reported zero stylelint warnings for the proposed CSS. These are pre-edit controller results, not a claimed post-edit GREEN result. The controller owns subsequent tests, independent review, and hosted CI.

Planned verification uses offline native Twig rendering with synthetic helper boundaries, geometry, legacy-context, and print checks. At authoring, that verification, independent review, and hosted CI are pending. No authenticated native application execution, clinical acceptance, merge, or deployment is claimed.

## Open work and limits

Ordinary approval; Save/Update behavior and persistence; roles, permission and security behavior under real sessions; row cloning and reason widgets; native accessibility, full contrast, translations, RTL, older browsers and operating systems, and print behavior remain OPEN. This is not a new full clinical editor. No master branch, production database, patient data, integrations, vendor assets, policy, or cron actions are part of this slice.
