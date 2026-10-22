# Edit User popup (OPEMR-18)

Partial workbench palette for `interface/usergroup/user_admin.php`. This is a
source-level presentation change only. It is **not** full researched-design
fidelity, and it is **not** a native fit, contrast or security clearance.

## Caller

`interface/usergroup/usergroup_admin.php` opens the route from a `medium_modal`
link as `dlgopen('', '', 'modal-mlg', 450, '', '', { type: 'iframe', url })`.
The caller is unchanged.

## Source scope

Exactly six files change: four production/documentation files (items 1–4)
plus two test artifacts (items 5–6).

1. `interface/usergroup/user_admin.php` — four additions, nothing else:
   - `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;` in sorted import order
     (after `AclMain`, before `CsrfUtils`).
   - One escaped, versioned, `media="screen"` `<link>` to
     `interface/clinical-workspace/edit-user-popup.css`, directly after
     `Header::setupHeader(['common','opener', 'erx'])` and before the original
     blank line.
   - `oe-edit-user-screen` appended to the original `<body class="body_top">`.
   - `oe-edit-user-document` appended to the **first** `<div class="container">`
     only (the one followed by the ACL PHP block). The inherited trailing empty,
     unclosed `<div class="container">` stays byte identical and unhooked.

   Undoing these four additions restores the original 719-line route byte for
   byte (`tests/clinical-ui/fixtures/edit-user-popup-original.txt`).
2. `src/Common/Assets/ClinicalWorkspaceAssets.php` — one sorted `SUPPORTED`
   entry, `'edit-user-popup.css'`, between `calendar-workday.js` and
   `encounter-document.css`. No behaviour change.
3. `interface/clinical-workspace/edit-user-popup.css` — six ordered,
   single-selector rules, all scoped under `html.oe-workbench-context` plus a
   route hook:
   - `body.oe-edit-user-screen`: canvas background (`!important`, to win
     against the theme's own `!important` `.body_top` background) and ink.
   - `.oe-edit-user-document`: paper background and ink.
   - `.oe-edit-user-document .text`: ink.
   - `.oe-edit-user-document .title`: petrol.
   - `.oe-edit-user-document a:focus` and `a:focus-visible` (separate rules):
     `2px solid` petrol outline, `2px` offset.

   Fallbacks match the `popup.css` workbench context tokens: canvas `#f3f7f5`,
   paper `#fff`, ink `#17343b`, petrol `#086878`.
4. This document.
5. `tests/js/edit-user-popup.test.js` — test artifact: the Edit User popup
   presentation contracts.
6. `tests/clinical-ui/fixtures/edit-user-popup-original.txt` — test artifact:
   the original 719-line route fixture used for the byte-for-byte inverse check.

## Explicitly unchanged

No wrappers, geometry, typography, field or button palette, backend, JS,
caller, control or credential changes. Native field/button classes and the
`redtext` warning and `mandatory` classes are preserved and unstyled by this
sheet. CSRF, ACL (`admin/users`, `admin/super`), password and 2FA fields,
`UserEditRenderEvent` dispatches, SQL, Save/Cancel, session and opener
(`dlgclose`, `top.restoreSession`) behaviour stay identical. Shared engine files
(`workspace.css`, `popup.css`, `popup.js`, `library/dialog.js`) carry no Edit
User rules.

## Test status

- RED: hosted tests-only run 38979489046 on `5254e896` failed with only the four
  intended missing-production failures (1273 passing, 62 suites); positive
  synthetic contracts and negative controls passed.
- RED is unchanged.
- Hosted GREEN: run 38979963101 on
  `6eb72f959a561a0aaef34482055af64163de3323` passed, 62 suites and 1277 tests.
- Controller checks: `php -l` passed on both PHP files; stylelint (actual,
  non-ignored, JSON output) covered one file with zero warnings; diff-check
  passed.
- Complete final exact-head CI is still pending, and this documentation change
  creates a new head that will need fresh CI.
- Independent Codex Astra review of the six files and the caller found no
  introduced P1/P2.
- Native acceptance and ordinary approval remain open.

## Known caveats

`.text` also sits on `<td>` cells that contain form controls, so those controls
may inherit the ink colour. Markup injected through `UserEditRenderEvent` may
inherit ink as well. The paper backdrop's effect on inherited controls, hooks
and the warning/mandatory text still needs compiled, native QA; this change is
not claimed to leave them visually untouched.

## Awaiting QA

- Native workbench activation (`html.oe-workbench-context` present in the
  iframe).
- PHP execution of the route and asset version lookup.
- Compiled contrast under the default, dark and solar themes, including
  `redtext`, `mandatory`, fields and buttons.
- Keyboard focus visibility.
- Clipping in the narrow initial `modal-mlg` 450 iframe and after resize.
- RTL, print (the sheet is `media="screen"`), roles.
- Module content from `UserEditRenderEvent` hooks.
- A real save and opener reload (`dlgclose('reload', false)`).

## Boundaries

The coding phase used no application HTTP requests, submissions, database
writes, installs, links or secrets. GitHub network access was used by the
controller for the PR and CI, so this is not a claim of no network access at
all.

The Original22, demo and Swedish programme remain open; they are not denied
areas. The specifically denied local Node, Jest, history, cache, hash,
bootstrap, PHPUnit and Swedish fresh-clone publication actions are preserved
and were not retried.

No merge, master, deploy, policy, cron, clinical, national or vendor changes
were made, and there is no standing review bypass. This adds no new
restrictions on ordinary authorized future UI work. All caveats above are
retained.
