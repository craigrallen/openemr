# Facility popup (OPEMR-7)

Add/Edit Facility (`templates/super/facilities/form.html.twig`) painted as a workbench
popup document. Paint only: no layout redesign, no behaviour change.

## Scope

Owned files:

| File | Change |
|------|--------|
| `templates/super/facilities/form.html.twig` | Exactly three replacements (below). |
| `interface/clinical-workspace/facility-popup.css` | New screen-only paint sheet. |
| `src/Common/Assets/ClinicalWorkspaceAssets.php` | `facility-popup.css` added to `SUPPORTED`, alphabetically. |
| `tests/js/facility-popup.test.js` | Contract tests (written first; unchanged in this phase). |
| `tests/clinical-ui/fixtures/facility-original.txt` | Frozen original template from master `18647270`; immutable. |

The three template replacements, and nothing else:

1. A `media="screen"` link to `facility-popup.css`, versioned through
   `clinicalWorkspaceAssetVersion('facility-popup.css')|attr_url` with `webroot|attr`,
   inserted on the line after `{{ setupHeader(['opener', 'erx']) }}`.
2. `<body class="body_top">` becomes `<body class="body_top oe-facility-popup">`.
3. The existing outer `<div class="container-fluid">` becomes
   `<div class="container-fluid oe-facility-document">`. The header row with Cancel and Save
   stays inside it, above (not inside) `<form name='facility-form'>`.

No script, control, escaping, Twig conditional, wrapper or attribute changes. Reverting the
three replacements reproduces the frozen original byte for byte; the tests check this in both
directions, and that partial application or any other edit fails restoration.

`workspace.css` is deliberately not linked: it is shell/workspace styling, and this route only
needs paint. The sheet defines its own `--oe-facility-*` tokens, each resolving from
`popup.css`'s `--oe-wb-*` value when present and otherwise falling back to the same literal.

## What the sheet paints

All rules sit inside one `@media screen` block and are paired for both
`html.oe-workbench-context` and `html.oe-workbench-popup`, plus `body.oe-facility-popup`.
Outside an active workbench, or on any other route, nothing matches; print keeps the legacy
rendering.

- **Canvas.** `color` and `background-color` with `!important` on the route body. This is the
  only `!important` in the sheet; it answers the real theme rule in
  `interface/themes/color_base.scss` (`.body_top, .bgcolor2, .body_nav { background-color:
  $paler !important; }`).
- **Paper.** The outer `.oe-facility-document` container gets a paired ink + paper.
- **Ordinary `.form-control`.** Paired ink, background and border at rest, on `:focus`
  (petrol border and ring), and when `:disabled` or `[readonly]` (disabled ink/paper). Every
  control selector excludes `.is-invalid`, `.is-valid` and descendants of `.was-validated`, so
  validation borders, icons and focus rings keep the theme's semantic palette.
- **Placeholder.** Muted ink plus `opacity: 1` (Firefox otherwise dims it further), same
  validation exclusions.
- **Focus rings.** `.btn` and `.nav-link` (top Save/Cancel, copy-address and colour-picker
  buttons, Physical/Mailing tabs) get an outline on `:focus` and, in a separate rule, on
  `:focus-visible`. Outline properties only: button and pill palettes are untouched.

Retained as theme-owned (the tests reject rules targeting them): geometry, typography,
display and visibility; Bootstrap `.nav`/`.tab-pane`/`.active`/`.show`/`.fade`, the
`custom-switch` controls, `.btn-*` palettes, and the `bg-light` / `text-muted` panels and
hints, which stay as the theme's own background/ink pairs. No evidence was gathered that they
need overriding, so they are not overridden.

## Source preflight (read, not executed)

Backend, unchanged and anchored by the tests:

- `interface/usergroup/facilities.php`: `AclMain::aclCheckCore('admin', 'users')` with
  `AccessDeniedHelper::denyWithTemplate`; `CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail:
  true)` for any POST; field map (`name` ← `facility`, `color` ← `ncolor`, `facility_code` ←
  `facility_id`); `mode=facility` without `newmode=admin_facility` calls
  `FacilityService::insertFacility()` and exits; with it, `updateFacility()` (with `fid`) then
  `updateUsersFacility()` and exits. `refreshme()` calls `top.restoreSession()` and reloads.
- `interface/usergroup/facility_admin.php` (edit) and `interface/usergroup/facilities_add.php`
  (add): the same `admin/users` ACL; `collectValidationPageRules("/interface/usergroup/facilities_add.php")`
  feeding `collectThis`; `forceClose` on a `mode=facility` POST; `erxEnabled` from
  `OEGlobalsBag::getBoolean('erx_enable')`; `disablePBE` = `'disabled'` when another
  primary business entity exists; `mode` `edit` / `add`. Both render the shared template.

Template behaviour preserved verbatim:

- Hidden `csrf_token_form`, `mode=facility`, and for edit `newmode=admin_facility` plus
  escaped `fid`.
- `submitform()`: `submitme(1, undefined, 'facility-form', collectvalidation)` client
  validation; when eRx is enabled, client-side length/format checks raise an `alert()` and
  stop the save. That is the whole eRx involvement here: `setupHeader(['opener', 'erx'])` is
  unchanged, and there is no native eRx call or outbound request from this page.
- `top.restoreSession()`, then `$.ajax` with the form's own `action`, `method` and
  `serialize()`d data, closing with `dlgclose('refreshme', false)` on success. The original
  has no failure callback; a failed save leaves the dialog open with no message. That is
  inherited and **not** fixed here.
- Physical/Mailing tabs, `copyAddress()` buttons, the ColorPicker (`pick()` / `pickColor()`
  into `#ncolor`), the primary-business-entity switch with its eRx `displayAlert()` and
  `disablePBE`, all other switches, required-field stars, and every `|attr` / `|xla` /
  `|text` / `|xlj` escape.

Callers in `facilities.php`: Add opens `dlgopen(..., 1020, 620, ...)` with
`allowResize: false`; Edit opens `1020 × 900` with `allowResize: true`.

## Evidence

- Source reading of the files above, and of `interface/clinical-workspace/popup.css` for the
  token values used as fallbacks.
- Commands: none executed for this phase (no Jest, PHP, PHPStan or browser runs). Test
  results come from the controller's hosted run only; this document claims none.

## Inherited risks

- No AJAX failure handler in `submitform()` (above).
- The `bg-light` panels and `text-muted` hint keep theme colours while their surroundings use
  workbench ink and paper. On a theme where `bg-light` is dark, workbench ink on that panel
  could lose contrast; this has not been measured.
- The canvas `!important` overrides `.body_top` only on this route inside a workbench.
- `selectList()` output for Organization Type is painted only if it carries `.form-control`;
  not verified from rendered HTML.

## Outstanding acceptance (not claimed)

- Hosted Jest run of `tests/js/facility-popup.test.js` (GREEN not yet observed by the owner).
- Rendered checks of Add (1020 × 620, non-resizable) and Edit (1020 × 900, resizable), both
  on first open and after subsequent resizes; narrow widths, RTL and print.
- Measured contrast across shipped themes, including dark themes and the `bg-light` panels.
- Live add/edit saves, validation and eRx alert flows (no live writes were made).
- Deployed, clinical and design-fidelity acceptance.
