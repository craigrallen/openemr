# Appointment Finder popup: workbench presentation slice

Source-level presentation change for `interface/main/calendar/find_appt_popup.php`
("Find Available Appointments"). It is a source contract, not acceptance: nothing
here has been verified in a browser, against compiled themes, or clinically.

## Rationale

Inside an active clinical workbench, `popup.js` marks the popup's `<html>` with
`oe-workbench-popup`. The route's own inline `<style>` paints the criteria strip
`#ddddff` and the result table `var(--white)`. In the dark theme, `$white` is `#000`
(`interface/themes/oe-styles/style_dark.scss`), so those fills are dark there. A
scoped, screen-only sheet pairs workbench ink with paper on the criteria strip,
table, header, body and typeable text fields. Any element it gives a text colour
also gets a matching background.

## Exact files

- `interface/main/calendar/find_appt_popup.php`: four presentation additions only:
  - the `ClinicalWorkspaceAssets` import;
  - the helper plus the `media="screen"` link, placed after the cktime early-exit
    block and before the original `setappt` script;
  - `oe-appointment-finder-popup` added to the original `body_top` body;
  - `oe-appointment-finder-popup__document` added to the original `container-fluid`.

  The PHP, ACL, SQL, logic, controls, scripts, inline styles and DOM are otherwise
  unchanged. "Logic" here means the slot, holiday, recurrence and configured-hours
  logic.
- `src/Common/Assets/ClinicalWorkspaceAssets.php`: `appointment-finder-popup.css`
  added to the allowlist.
- `interface/clinical-workspace/appointment-finder-popup.css`: new.
  - Scoped to `html.oe-workbench-popup body.oe-appointment-finder-popup` under
    `@media screen`.
  - Workbench tokens are used with the fallbacks that `popup.css` defines.
  - `:focus` and `:focus-visible` are separate rules.
  - Result-link focus rings are inset because `.table-responsive` would clip an
    outset ring.
  - Wrapping is a provision only.
- Tests:
  - `tests/clinical-ui/appointment-finder-support.cjs`
  - `tests/clinical-ui/appointment-finder.cjs` (portable)
  - `tests/clinical-ui/appointment-finder-history.cjs` (explicit local history)
  - `tests/js/appointment-finder-popup.test.js` (Jest wrapper, portable suite only)

Nothing changes in shared `popup.css`, `popup.js`, `workspace.css`, fonts, buttons
or theme palettes. The AM/PM semantic colours and the `.highlight` /
`.blue_highlight` hover classes are inherited untouched.

One intentional corrective rule changes link colour. The dark theme sets
`$link-color: #f0f0f0` (`style_dark.scss`), which would leave AM time links
near-white on the new paper. So `#am a:not(.blue_highlight)` gets
`color: inherit; background-color: transparent`. Non-hovered AM links therefore take
the route's own `#am` `var(--primary)` colour. This deliberately differs from the
previous computed link colour. PM links (`#pm a`, which already use
`var(--danger)`) and hovered links (`.blue_highlight`) are excluded. The transparent
background keeps the row and link hover highlights visible. Effective contrast of
`var(--primary)` on paper in each compiled theme is unverified and stays an open
gate.

The sheet has one `!important`, on the scoped body canvas background. Source proof
is `interface/themes/color_base.scss`, which the colour themes import. It sets
`.body_top { background-color: $paler !important; }`, and this popup's body is
`.body_top`. No theme source read sets an `!important` ink colour, so text colour
is a normal declaration.

## Real launcher

`interface/main/calendar/add_edit_event.js` `find_available()` calls
`dlgopen(..., 'find_appt_popup', 725, 200, '', title)`. That 725×200 is the
requested initial size only. The dialog engine (`library/dialog.js`) and the user
may resize it. This slice claims no rendered geometry and no native fit for any
viewport.

## Risks and inherited behaviour

- **cktime auto-submit.** When `cktime` is present and the slot is free, the route
  emits a minimal page. After 2.5 s, that page calls
  `opener.document.forms[0].submit()` and closes the dialog. That early-success body
  is emitted before the new link and is byte-for-byte unchanged. No live GET or POST
  was executed against this route while preparing the slice.
- **No explicit CSRF.** The route has no explicit CSRF check. That is inherited and
  is not addressed by a presentation change.
- ACL (`patients/appt` write/wsome; write-only confirm path) is unchanged.
- **Older engines.** The field rules use the selector-list form
  `:not([readonly], :disabled, .is-invalid, .is-valid)`, which the repo's stylelint
  requires. A browser engine without selector-list `:not()` drops those rules, so
  the neutral field colours and focus ring would be omitted there. This is open
  older-engine acceptance, not full legacy equivalence.

## Open gates

Each of these is open, and none is claimed:
- native rendering and fit in the real dialog;
- compiled theme behaviour, including light, dark, the colour themes and the
  compact and RTL variants;
- a real opener flow from Add/Edit Event, including `setappt` and the cktime submit;
- an admin- or ACL-restricted user;
- print and legacy (non-workbench) rendering;
- clinical and owner approval.

The next candidate should be a different popup that no other branch has touched,
and it starts only after its own preflight.
