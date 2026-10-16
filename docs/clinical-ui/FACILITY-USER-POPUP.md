# OPEMR-8: Facility user information popup

Edit Facility Specific User Information (`interface/usergroup/facility_user_admin.php`) opened
from Facility Specific User Information (`interface/usergroup/facility_user.php`) inside the
workbench.

## Scope

A narrow, partial palette adaptation of the existing route. This is not a full-fidelity redesign.
The researched admin/Practice preview was used for direction only (its canvas, ink, paper and
muted colours); none of its workflow features were added.

Changes to the route are exactly four additions. Every other byte of the original file is kept:

1. `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;`
2. A `media="screen"` stylesheet link, escaped with `attr()` / `attr_url()` and versioned with
   `ClinicalWorkspaceAssets::version()`, placed directly after `Header::setupHeader(...)`.
3. `class="oe-facility-user-popup"` on `<body>`.
4. `oe-facility-user-document` added to the existing outer `.container`.

`src/Common/Assets/ClinicalWorkspaceAssets.php` registers `facility-user-popup.css` once, in sorted
position.

`interface/clinical-workspace/facility-user-popup.css` is a single `@media screen` block scoped to
`body.oe-workbench-context.oe-facility-user-popup` and the existing `.oe-facility-user-document`.
It sets only paint properties and has no `!important`:

| Token  | Value     | Used for                                        |
|--------|-----------|-------------------------------------------------|
| canvas | `#edf2f3` | popup body; readonly and disabled field paper   |
| ink    | `#182c36` | text, field text, focus outlines                |
| paper  | `#fff`    | document, table and cells, fields               |
| muted  | `#536773` | opaque placeholder; disabled field text         |

- The table and its cells are painted with ink and paper together, because the dark theme gives
  `.table` an explicit colour.
- Native `input` / `select` / `textarea.form-control` are paired with ink and paper in their normal,
  focused, readonly and disabled states. The placeholder is muted at full opacity. The readonly and
  disabled rules come after the focus rule.
- Every field rule excludes `:not(.is-invalid, .is-valid, .was-validated *)`, so Bootstrap
  validation styling still applies.
- Fields, Save (`.btn-save`) and Cancel (`.btn-cancel`) get a `:focus` fallback outline and, in a
  separate rule, a `:focus-visible` outline. Button palettes are unchanged.
- Select2, the date/datetime pickers, options_listadd, `workspace.css`, geometry, typography,
  layout, wrappers, display, controls and the backend are untouched. The fixed 180px/270px
  original columns remain. That does not prove there are no narrow-width problems.

## Backend and caller (reviewed, unchanged)

- Both routes check the `admin/users` ACL. The popup requires `user_id` and `fac_id` in GET and
  posts the hidden CSRF token, `mode=facility_user_id`, `user_id` and `fac_id`.
- Fields come from `FACUSR` layout options through `generate_form_field`, and each value is read
  per user, facility and field.
- `facility_user.php` checks CSRF on POST before its ACL-guarded save, then INSERTs or UPDATEs
  `facility_user_ids`.
- The caller opens the popup with `small_modal` as an iframe `dlgopen` at 550x550, using
  `sizeHeight: 'auto'`, `allowResize: true` and `allowDrag: true`.
- Inherited behaviour is kept and was not fixed: the submit `.done()` ignores the response, and
  there is no AJAX failure handler. This change does not claim the route is secure.

## Tests

`tests/js/facility-user-popup.test.js` contains source, selector and parsed-declaration contracts.
It does not compute the native cascade, render the popup or exercise authentication.

- Tests-only RED at `1ef99957` (hosted run JS38859759175): 7 intended failures, 1264 passing,
  62 suites. An earlier report said 6 failures; the actual count was 7. The route matched the
  frozen fixture byte-for-byte, and production code was unchanged.
- GREEN for this production change is pending the controller's run.

Source review is not compiled, native, visual, role or save proof.

## Awaiting native QA

- Real generated FACUSR fields, Select2, date/calendar widgets, list-add links and help.
- Contrast and geometry for all dynamic content.
- Narrow layouts, both direct and at the 550x550 iframe after resizing.
- RTL, print, the legacy (non-workbench) page, each role, and save with opener refresh.

## Boundaries

- Approval is still needed for native acceptance and for merge.
- The implementer worked through file read/write/edit only. The controller runs verification and
  Git. Nothing was committed, pushed or deployed, and no live endpoint, database or bootstrap was
  requested. No denied action was retried.
- Every branch, commit and PR keeps the `OPEMR-8` key, except for the fork's default `master`.
