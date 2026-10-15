# Procedure provider editor — popup document sheet

Status: **source slice only.** Presentation of the existing
`interface/orders/procedure_provider_edit.php` route when it is opened as a
popup inside an active workbench. Nothing has been checked in a browser,
compiled theme, screen reader or restricted role yet.

## Caller and dialog size

`interface/orders/procedure_provider_list.php` (unchanged) opens the route for
both Add and Edit with `dlgopen(scriptTitle, '_blank', 800, 750, false, title)`.
In `library/dialog.js` those two numbers mean different things:

- **Width 800** becomes a `max-width` percentage of the opener's
  `innerWidth`; when the opener is 1080px wide or narrower the dialog uses
  `modal-full` instead.
- **Height 750** is the initial and minimum height, not a fixed one. The
  dialog starts at 750px expressed in `vh`; once the iframe loads,
  `SizeModaliFrame` measures the content height plus 60px, keeps it at
  least 750px, and caps it at the opener's viewport height (the
  `.modal-content` also carries `max-height: 94vh`).

How the sheet sits inside any particular dialog size has not been measured.

## What changed

- `interface/orders/procedure_provider_edit.php`: one `ClinicalWorkspaceAssets`
  import, one `media="screen"` versioned link after the inline `<style>`, and
  classes on four existing elements: `<body>` (`oe-procedure-provider-popup`),
  the container (`__canvas`), the form (`__document`) and the existing
  Save/Cancel/Delete `btn-group` (`__actions`). Every SQL statement, the
  `admin/users` ACL check, GET/POST CSRF checks and token fields, the
  integration login/password fields, all options, help text, the tooltip
  script, the inline typography and the `window.close()` /
  `opener.refreshme()` save response are byte-identical.
- `interface/clinical-workspace/procedure-provider-popup.css`: new,
  screen-only. Every selector starts with
  `html.oe-workbench-popup body.oe-procedure-provider-popup`, so it is inert
  in a standalone window, in legacy mode and in print. `popup.js` only adds
  its classes to `<html>`.
- `src/Common/Assets/ClinicalWorkspaceAssets.php`: one allowlist entry.

## Presentation

- Canvas body, and the original form as a paper sheet with a line border.
- `.form-control` fields and the collapsible help panels each set foreground
  and background together from the shared `--oe-wb-*` tokens defined in
  `popup.css`. Help panel visibility stays with Bootstrap `.collapse`.
- The original buttons are set to wrap with a gap and keep their theme
  palettes; the sheet sets no button colours. Wrapping is implemented in the
  stylesheet, but whether long translated labels or narrow widths still
  overflow has not been measured.
- Buttons and help links reserve a transparent outline; a plain `:focus`
  rule colours it for engines without `:focus-visible`, followed by a
  separate `:focus-visible` rule.
- No font, size, weight or spacing-of-text changes; no `!important`.

## Theme notes (source reading only)

`theme-defaults.scss` sets `fieldset`/`legend` colours `!important`; this
route has neither element. `#theform` rules target an id the form does not
have, and no button `onclick` matches `[onclick~="delete"]`. The Solar
override sets `.btn-secondary` ink `!important`, which Cancel keeps because
the sheet does not paint buttons. In the Dark and Solar override sections no
`:focus` rules were found; the compiled Bootswatch layers were not inspected.
No contrast or rendered-size result is claimed for any theme.

## Tests

- `node --test tests/clinical-ui/procedure-provider.test.cjs`: portable,
  no git history. Declared edits, preserved business source and element
  counts, negative ACL/SQL/CSRF/credential/control/callback/font mutations,
  allowlist entry, and the stylesheet guard (scope, screen only, typography,
  colour pairs, empty `!important` allowlist, wrapping, focus order). Jest
  runs it through `tests/js/clinical-procedure-provider.test.js`.
- `node --test tests/clinical-ui/procedure-provider-baseline.test.cjs`:
  mandatory locally, needs base commit `18647270`. Inverts the declared edits
  and compares the route byte-for-byte with the base; pins the caller, shared
  popup files, themes and every existing clinical-workspace file.
- `tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php`:
  missing/shipped/updated versions and rejected near-miss and traversal names.

## Not yet verified

Compiled-theme rendering and contrast, narrow-width and zoom behaviour,
keyboard order, opener refresh after save/delete, restricted roles, print,
and legacy browsers.
