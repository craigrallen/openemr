# Add User popup (OPEMR-19)

Route: `interface/usergroup/usergroup_admin_add.php`, opened from
`usergroup_admin.php` by `dlgopen('', '', 'modal-mlg', 450, ...)` as an iframe.

## Scope

A partial palette for the existing route. Nothing else changes.

| File | Change |
|------|--------|
| `interface/usergroup/usergroup_admin_add.php` | Four additions only: the sorted `ClinicalWorkspaceAssets` import; one escaped, versioned `media="screen"` stylesheet link directly after `Header::setupHeader()`; `oe-add-user-screen` appended to the existing `body_top` body; `oe-add-user-document` appended to the single existing `.container`. |
| `interface/clinical-workspace/add-user-popup.css` | New. Exactly six rules, each scoped to `html.oe-workbench-context` plus one of the two hooks. |
| `src/Common/Assets/ClinicalWorkspaceAssets.php` | One sorted `'add-user-popup.css'` entry in `SUPPORTED`. |
| `docs/clinical-ui/ADD-USER-POPUP.md` | This file. |

Removing the four route additions returns the original 686-line route byte
for byte (`tests/clinical-ui/fixtures/add-user-popup-original.txt`).

### The six rules

1. `body.oe-add-user-screen`: `background-color` canvas (`#f3f7f5` fallback) and ink colour. The background is the only `!important` declaration; it exists to win against the theme's own `!important` `.body_top` background.
2. `.oe-add-user-document`: `background-color` paper (`#fff` fallback) and ink colour.
3. `.oe-add-user-document .text`: ink (`#17343b` fallback).
4. `.oe-add-user-document .title`: petrol (`#086878` fallback).
5. `.oe-add-user-document a:focus`: 2px solid petrol outline, 2px offset.
6. `.oe-add-user-document a:focus-visible`: the same outline, as a separate rule.

Backgrounds use the `background-color` longhand, so no image, position or
repeat is reset. Fallbacks match the `html.oe-workbench-context` tokens in
`popup.css`. The rules only apply when the workbench context class is present
on `<html>`; outside it the route renders as before.

### Explicitly out of scope

No wrappers, geometry, spacing, fonts, field, button, mandatory-marker or
password-meter paint, JS, backend, caller, control or credential changes.
The shared workbench files (`workspace.css`, `popup.css`, `popup.js`,
`library/dialog.js`) carry no Add User rules.

Preserved as found: the inherited fixed 600px field table and 120px inline
widths, the `.physician_type_class` / `#main_menu_role` `!important` widths,
both `new_group` forms, the unclosed `<tr>` before the NPI row, the trailing
empty `<table>`, and the Save anchor (`<a ... onclick="return submitform()">`).

Preserved behaviour (source anchors pinned by the test): all three forms and
their POST CSRF tokens, the `admin/users` ACL and `admin/super` group-list
gate, password and admin-password fields, LDAP exclusion branch, `secure_pwd`
strength check, eRx branch, `UserEditRenderEvent` before/after dispatch, SQL,
page validation rules, the AJAX `.done()` success (`dlgclose('reload', false)`)
and `.fail()` paths, Save and Cancel, `top.restoreSession()`, and the `opener`
header asset.

## Verification status

- **RED:** tests-only commit `f5b9351c` on draft PR 93; hosted JS run
  38988176867 failed only the four intended missing-production tests
  (1273 passed, 62 suites). Positive synthetic candidates and negative
  controls passed.
- **GREEN:** pending a hosted run against this production change.

`tests/js/add-user-popup.test.js` is a source-only contract. It reads files
as text and does not execute PHP, the backend or `dialog.js`. It is not a
security clearance, not a measured contrast result, and not a native-fit or
researched-fidelity sign-off.

## Awaiting QA

None of the following has been checked against a running application:

- Ordinary approval of the palette, and native PHP render of the route.
- Context activation: that `html.oe-workbench-context` is present in the
  popup iframe and that the rules apply there and nowhere else.
- Compiled default, dark and solar themes, including warning, mandatory
  marker, form-control and module-injected (`UserEditRenderEvent`) contrast.
  `.text` also sits on `<td>` cells that contain controls, so those may
  inherit ink.
- Keyboard focus visibility and focus-ring clipping inside the table cells.
- Narrow initial and resized `modal-mlg` 450 iframe.
- RTL, print, and the main/patient menu role selectors.
- A real Save (success and failure) and Cancel, closing back to the opener.

## Boundaries kept

No live application HTTP, account or database writes, eRx calls, link
following, installs, secrets, network, policy changes, merge, deploy, cron or
writes to master. Earlier popup boundaries (prior 22, demo data, exhaustive
popup sweeps, Swedish localisation) remain as previously set.
