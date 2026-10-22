# Facility popup (OPEMR-7)

Add/Edit Facility (`templates/super/facilities/form.html.twig`) painted as a workbench
popup document. Partial palette adaptation only: not completed researched geometry or
fidelity work. No layout redesign, no behaviour change.

## Scope

Owned files:

| File | Change |
|------|--------|
| `templates/super/facilities/form.html.twig` | Exactly three replacements (below). |
| `interface/clinical-workspace/facility-popup.css` | New screen-only paint sheet. |
| `src/Common/Assets/ClinicalWorkspaceAssets.php` | `facility-popup.css` added to `SUPPORTED`, alphabetically. |
| `tests/js/facility-popup.test.js` | Contract tests. |
| `tests/clinical-ui/fixtures/facility-original.txt` | Frozen original template from master `18647270`; immutable. |

The three template replacements, and nothing else:

1. A `media="screen"` link to `facility-popup.css`, versioned through
   `clinicalWorkspaceAssetVersion('facility-popup.css')|attr_url` with `webroot|attr`,
   inserted on the line after `{{ setupHeader(['opener', 'erx']) }}`.
2. `<body class="body_top">` becomes `<body class="body_top oe-facility-popup">`.
3. The existing outer `<div class="container-fluid">` becomes
   `<div class="container-fluid oe-facility-document">`. The header row with Cancel and Save
   stays inside it, above (not inside) `<form name='facility-form'>`.

No script, control, filter, conditional or body-wrapper changes, except the declared link and
classes above. Reverting the three replacements reproduces the frozen original byte for byte;
the tests check this in both directions, and that partial application or any other edit fails
restoration.

`workspace.css` is deliberately not linked. The sheet defines its own `--oe-facility-*` tokens,
each resolving from `popup.css`'s `--oe-wb-*` value when present and otherwise falling back to
the same literal.

## What the sheet paints

All rules sit inside one `@media screen` block and are paired for both
`html.oe-workbench-context` and `html.oe-workbench-popup`, plus `body.oe-facility-popup`.
Outside an active workbench, or on any other route, nothing matches; print keeps the legacy
rendering.

- **Canvas.** `color` and `background-color` with `!important` on the route body, answering
  `interface/themes/color_base.scss` (`.body_top, .bgcolor2, .body_nav { background-color:
  $paler !important; }`).
- **Paper.** The outer `.oe-facility-document` container gets a paired ink + paper.
- **Existing `.bg-light` panels (explicit repair).** Setting ink on the document ancestor is a
  newly introduced inheritance issue for these panels, not a pre-existing risk. Each panel now
  gets exactly two declarations, in this order: `color: var(--oe-facility-ink)` (normal) and
  `background-color: var(--oe-facility-paper) !important`. The `!important` on the background
  alone answers Bootstrap's `bg-light` utility; the colour is not important.
- **Ordinary `.form-control`.** Paired ink, background and border at rest, on `:focus`
  (petrol border and ring), and when `:disabled` or `[readonly]` (disabled ink/paper). Every
  control selector excludes `.is-invalid`, `.is-valid` and descendants of `.was-validated`, so
  validation borders, icons and focus rings keep the theme's semantic palette.
- **Placeholder.** Muted ink plus `opacity: 1` (Firefox otherwise dims it further), same
  validation exclusions.
- **Focus rings.** `.btn` and `.nav-link` get an outline on `:focus` and, in a separate rule,
  on `:focus-visible`. Outline properties only: button and pill palettes are untouched.

Still theme-owned (the tests reject rules targeting them): geometry, typography, display and
visibility; Bootstrap `.nav`/`.tab-pane`/`.active`/`.show`/`.fade`, the `custom-switch`
controls, `.btn-*` palettes, and `text-muted` hints. `text-muted` remains actually
theme-controlled with unknown contrast against the paper.

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

Template behaviour preserved:

- Hidden `csrf_token_form`, `mode=facility`, and for edit `newmode=admin_facility` plus
  escaped `fid`.
- `submitform()`: `submitme(1, undefined, 'facility-form', collectvalidation)` client
  validation; when eRx is enabled, client-side length/format checks raise an `alert()` and
  stop the save. No direct eRx service request is visible in this template. Included files
  (`setupHeader(['opener', 'erx'])` and others) were not audited.
- `top.restoreSession()`, then the original `$.ajax` facility persistence with the form's own
  `action`, `method` and `serialize()`d data, closing with `dlgclose('refreshme', false)` in
  `.done`. `.done` does not inspect an application error, even on HTTP 200, and the original
  has no failure handler: a failed save leaves the dialog open with no message. Both are
  inherited and **not** fixed here.
- Physical/Mailing tabs, `copyAddress()` buttons, the ColorPicker (`pick()` / `pickColor()`
  into `#ncolor`), the primary-business-entity switch with its eRx `displayAlert()` and
  `disablePBE`, all other switches, required-field stars, and every `|attr` / `|xla` /
  `|text` / `|xlj` escape.

Callers in `facilities.php`: Add opens `dlgopen(..., 1020, 620, ...)` with
`allowResize: false`; Edit opens `1020 × 900` with `allowResize: true`.

## Evidence

Real hosted Jest results (controller-reported):

| Stage | Commit | Run | Result |
|-------|--------|-----|--------|
| Initial RED | `37bd7de9` | JS `38850819208` | 17 failed, 1267 passed, 62 suites |
| Initial GREEN | `49abe58b` | JS `38851308316` | green |
| Review | | | P2 finding: paired panel paint |
| New RED | `0cc9bf07` | run `38851592138` | 4 failed, 1296 passed, 62 suites; only the missing panel rule/important allowance |

Final GREEN is pending from the controller. No local test, PHP, PHPStan or browser runs were
made; this document claims none. Source reading covered the files above and
`interface/clinical-workspace/popup.css` for the token fallbacks.

Contrast is source-only: the panel's ink and paper are now an explicit coherent pair, but
contrast has not been measured on any theme.

## Open

- Final hosted GREEN of `tests/js/facility-popup.test.js` after the panel repair.
- Native theme, role, real save, disabled PBE, eRx, legacy, print, narrow and RTL checks.
- Rendered checks of Add (1020 × 620, non-resizable) and Edit (1020 × 900, resizable), on first
  open and after resizes.
- Measured contrast across shipped themes, including dark themes, the panels and `text-muted`.
- `selectList()` output for Organization Type is painted only if it carries `.form-control`;
  not verified from rendered HTML.
- Researched geometry and design-fidelity work, and deployed/clinical acceptance.
