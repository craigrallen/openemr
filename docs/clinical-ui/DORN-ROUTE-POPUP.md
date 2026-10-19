# DORN create-route popup: section-sheet presentation (OPEMR-51)

Status: **proposed, not implemented.** This page records a partial, researched
UI change. It is not full design acceptance, and it is not evidence that the
change works in a browser. Production code is unchanged in this checkout.

- Route: `interface/modules/custom_modules/oe-module-dorn/public/route_edit.php`
- Caller: `interface/modules/custom_modules/oe-module-dorn/public/lab_setup.php`
- Frozen original: `tests/fixtures/clinical-workspace/dorn-route.original.php.fixture`
  (267 lines, captured at master `18647270e0c799189d2dc10f801e8de2bff1a360`)
- Source contract: `tests/fixtures/clinical-workspace/dorn-route-popup.contract.cjs`
- Jest wrapper: `tests/js/clinical-dorn-route-popup.test.js`

## Proposed change

The change has two parts and nothing else.

### 1. Body marker

```html
<body class="container-fluid">                      <!-- original -->
<body class="container-fluid oe-dorn-route-popup">  <!-- proposed -->
```

`container-fluid` stays first. The marker is added once, on `<body>`, and goes
nowhere else in the markup.

### 2. A second, screen-only style block

The block goes directly after the original `<style>` block and directly before
`</head>`. The original block stays byte-identical.

```html
    <style media="screen">
      html.oe-workbench-context body.oe-dorn-route-popup {
        color: var(--oe-wb-ink);
        background-color: var(--oe-wb-canvas);
      }

      html.oe-workbench-context body.oe-dorn-route-popup > form > .form-section {
        color: var(--oe-wb-ink);
        background-color: var(--oe-wb-paper);
        border-color: var(--oe-wb-line);
      }
    </style>
```

What this does:

- **Body:** workbench canvas background, workbench ink text.
- **Direct `form > .form-section` children:** paper background, ink text, and
  the edge colour `var(--oe-wb-line)` in place of the original `#ddd`.
- **No geometry change.** The original `.form-section` rule keeps
  `border: 1px solid`, `padding: 15px`, `margin-bottom: 20px` and
  `border-radius: 5px`. The new block changes only the border colour. It sets
  no width, style, padding, margin, radius, shadow, font, display or sizing.
- It does not touch controls, labels, required markers (they stay `red`),
  validation (`.is-invalid`), the checkbox, the alert, the buttons, `h2`, or
  the unused `.form-section h5` rule.
- Both rules are gated on `html.oe-workbench-context`. Outside the workbench,
  no rule applies.
- The block sets `media="screen"`, so it adds nothing to print. However, the
  `class` attribute on `<body>` is present in every medium (see "Open native
  questions").

The four tokens come from `interface/clinical-workspace/popup.css`, inside its
workbench scope (`html.oe-workbench-context, body.workbench-active >
.dialogModal`, within `@media screen`). That stylesheet reaches this route
because `config/config.yaml` defines `workbench-popup` with `autoload: true`,
and the route calls `Header::setupHeader(['opener'])`. Neither file is changed.

## Contract: original, inverse and source checks

All of the evidence here comes from reading source text. None of it comes from
running the page in a browser.

- **Exact preservation.** The only difference between the proposed route and
  the frozen 267-line original is the second style block and the body class.
  Every other byte is unchanged.
- **Strict inverse.** `restorePresentation()` removes exactly one approved seam
  (`</style>` + block + `</head>` + marked `<body>`) and must return the frozen
  original byte for byte. It returns `null` if the block is missing,
  duplicated, relocated or reshaped, or if any trace of it remains (the
  marker, `media=`, `oe-workbench`, or a second `<style>`).
- **Production acceptance.** `accepts()` requires all of:
  - the strict inverse restores the original;
  - the shared normalizer restores the original;
  - the candidate equals `applyPresentation(original)` exactly.
- **Preserved lines.** About 90 security, connector, write, field, EULA,
  Save/Cancel, message and validation lines must each appear exactly once, in
  order. Counts for about 60 tokens (inputs, `required`, escaping helpers,
  superglobals, connector calls, etc.) must not change.
- **Mutants.** About 170 unapproved edits must be rejected. They cover
  placement, media, tokens, selectors, extra rules, original-rule geometry,
  assets/scripts, ACL/CSRF, connector/writes, escaping, form action/tokens,
  fields/EULA, Save/Cancel, validation and byte-level noise.
- **Caller.** The `lab_setup.php` `createRouteClickEdit` block must stay
  verbatim. History mode separately checks that the caller, connector, writers,
  models, `Header`, assets, popup CSS/JS, dialog helpers and theme trees are
  unchanged from base, and that the change stays inside the five-file scope.

The controller ran the portable checks with Node. Reported result: 184 passed,
and exactly 2 failed, as intended. The 2 failures are the live-route checks,
"equals the approved candidate" and "passes production acceptance". They fail
because production has not been changed. All synthetic-candidate and mutant
checks passed. That run is the controller's report. This document does not
claim a test or CI result of its own, and history mode was not reported.

## Caller as found in source

`lab_setup.php` → `createRouteClickEdit(labGuid, labName, isEulaRequired)`
calls:

```js
dlgopen(scriptTitle, '_blank', 800, 750, false, addTitle, {
    sizeHeight: 'auto', allowResize: true, allowDrag: false,
})
```

`scriptTitle` is `route_edit.php?labGuid=…&isEula=…&csrf_token_form=…`.

- If the lab search result says a EULA is required (`isEulaRequired`), the
  dialog opens only after `doLabEULA(labName)` resolves `'accepted'`.
- Otherwise it opens directly.

So the real frame is 800x750, auto-height and resizable. It has not been seen
rendered.

## Inherited behaviour (unchanged and not endorsed)

The presentation change leaves all of the following exactly as found. Recording
them here does not approve them.

- **Unconditional vendor GET.** Every render, including GET, POST and error
  re-render, calls `ConnectorApi::getPrimaryInfos('')`.
- **POST flow.** POST calls `ConnectorApi::createRoute($routeData)` first. On
  success it calls `ConnectorApi::getLab(...)` and then writes locally:
  - an address book record (`AddressBookAddEdit::createOrUpdateRecordInAddressBook`);
  - a procedure provider (`LabRouteSetup::createUpdateProcedureProviders`);
  - the DORN route row (`LabRouteSetup::createDornRoute`).
- **Error, security and transaction concerns.**
  - No transaction wraps the remote create and the three local writes, so a
    partial failure can leave the vendor and the local data out of step.
  - `$_REQUEST['labGuid']` is read with no presence check.
  - CSRF is checked only when `$_REQUEST` is non-empty.
  - A vendor `responseMessage` is shown to the user verbatim (it is escaped
    with `text()`).
  - The form has no closing `</form>`.
  - The JS validation checks `value.trim()`, which a checkbox always passes
    (`"on"`). Only native `required` guards the EULA checkbox.
- **Customer label mismatch.** The label says `for="form_customerAcctNumber"`
  but the input is `id="form_customerAccountNumber"`, so the label is not
  associated with its input. This is preserved on purpose; the contract
  rejects a silent fix.
- **Prechecked EULA is not consent.**
  - The EULA checkbox renders `checked`.
  - The acceptance timestamp defaults to server `date(...)` labelled UTC.
  - The version defaults to `2024-08-28`.

  None of this records an affirmative user act. The presentation neither fixes
  nor endorses it, and this document is not an approval of the EULA or consent
  flow.

## Open native questions

None of the following has been observed in a browser. Each needs native
evidence before any acceptance:

- all themes, with and without `html.oe-workbench-context`;
- open, resized, narrow and short frames in the real dialog;
- RTL;
- keyboard order and focus visibility;
- roles (admin/users ACL pass and deny);
- required and invalid states, including the `.is-invalid` contrast on paper;
- Create and Cancel (`window.close()` inside `dlgopen`);
- EULA shown and hidden;
- legacy print.

**All-media class.** The body class is present in every medium, including
print. No rule targets it outside screen and workbench context, but
third-party or theme CSS that matches `body[class]` or class lists has not been
checked.

## Constraints on this work

- **No requests to the running stack.** No requests were made to the route,
  bootstrap, vendor, database or patient data. Save, EULA and print were not
  exercised.
- **No runtime success claim.** This document does not claim the page renders
  correctly or that any test or CI run passed.
- **Unchanged from before this work:**
  - the denied PR112 review;
  - the six unpublished files;
  - the blocked Swedish clone.

  This document does not resolve or supersede any of them.
- **Outstanding.** Production `route_edit.php` is unmodified. The two intended
  live-route failures stay failing until the approved presentation is applied
  under separate approval.
