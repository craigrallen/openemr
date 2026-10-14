# Destroy Lot popup

`interface/drugs/destroy_lot.php` rendered as a quiet document sheet when it runs inside an
active clinical workbench popup. Outside that context (standalone page, legacy shell, print) the
route renders as before.

## Changes

- `interface/drugs/destroy_lot.php` — six reversible insertions only:
  - `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;`
  - a versioned `<link rel="stylesheet" media="screen">` to `destroy-lot-popup.css`, placed after
    `Header::setupHeader(['datetime-picker', 'opener'])` so it follows `popup.css`;
  - route classes added beside the originals: `body.body_top.oe-destroy-lot-popup`,
    `form.oe-destroy-lot-form`, `table.table-borderless.w-100.oe-destroy-lot-fields`,
    `div.btn-group.oe-destroy-lot-actions`.
- `interface/clinical-workspace/destroy-lot-popup.css` — new. One `@media screen` block; every
  selector starts with `html.oe-workbench-popup body.oe-destroy-lot-popup`. Uses only `popup.css`
  `--oe-wb-*` tokens.
  - Body on canvas, form as a bordered paper sheet (`max-width: 40rem`).
  - Rows become wrapping flex lines: label basis `10rem`, value basis `15rem`, both `min-width: 0`;
    the value drops beneath its label when both do not fit. Labels may wrap (the legacy
    `text-nowrap` class stays in the markup; its `!important` is relaxed in scope), and labels and
    display-only values use `overflow-wrap: anywhere`.
  - Text inputs keep their native `size`/`w-100` and gain `max-width: 100%`, a token border and
    padding. No height, overflow, font, line-height or stacking (position/z-index/transform)
    declarations.
  - The legacy `<center>` is kept; only `text-align: start` is applied to it.
  - Native Submit/Cancel inputs keep their classes; the group wraps as whole buttons with a gap.
    Submit keeps the shared `popup.css` primary colours; Cancel becomes a paper/ink secondary.
    A keyboard `:focus-visible` outline is added to the fields and buttons.
  - `!important` is used twice: the body background (colour themes compile
    `.body_top { background-color: … !important }`) and the label `white-space`.
- `src/Common/Assets/ClinicalWorkspaceAssets.php` — `destroy-lot-popup.css` added to the supported
  list in alphabetical order.
- `tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php` — added to the two
  existing popup-stylesheet arrays and a near-miss rejection case.
- `tests/js/destroy-lot-popup.test.js` — new focused test.

## Preserved and tested (static, jsdom)

- Whole-file sha256 of the route reverses to the 18647270 baseline through the six insertions;
  23 negative mutations (ACL, ID guards, save condition, CSRF check/token/session, both SQL
  statements and the NULL date binding, post-save `window.close()` and `opener.refreshme()`,
  onsubmit, confirmation text and result, `top.restoreSession()`, datepicker selector and options,
  cancel, submit name, header assets, the inline `td` font-size, `<center>`) each break it.
- Callers are byte-identical to this checkout: `add_edit_lot.php` and `drug_inventory.php`.
- The route's actual inline `validate(f)` runs in jsdom: decline → `false`, no session restore;
  accept → `restoreSession` then `true`; the form's `onsubmit` attribute cancels/allows a
  dispatched submit event accordingly (no navigation or post). Cancel calls `window.close`.
  Same behaviour without the stylesheet or workbench class.
- Every selector matches the route markup under `html.oe-workbench-popup` and nothing without the
  html class or without the route body class.

## Caller geometry (from source, not measured)

- `drug_inventory.php` opens Add/Update Lot with
  `dlgopen('add_edit_lot.php?' + params.toString(), '_blank', 600, 475)`.
- Destroy Lot is reached from that dialog's Destroy button by same-frame navigation
  (`window.location.href='destroy_lot.php?drug=…&lot=…'`), so it inherits the existing modal.
- `library/dialog.js`: when `where.innerWidth <= 1080` the modal is `modal-full` (97%); otherwise
  its width is `600 / innerWidth` as a `toFixed(1)` percentage, written once at open. Height 475
  is the initial `vh` size with `max-height: 94vh`. With the default `sizeHeight: 'auto'`, the
  iframe `load` handler calls `SizeModaliFrame(e, 475)` (content height + 60, floored at 475,
  capped at the viewport). Iframe load events normally fire on each navigation, so this is
  expected to rerun for Destroy Lot; that has not been observed in a browser here.
- No fit arithmetic is claimed: modal chrome, translated label widths and native control widths
  were not measured.

## Not verified — separate acceptance gates

- Real PHP render against a running stack, and real-browser rendering of the sheet.
- Compiled themes (light, colour themes with `.body_top !important`, dark) and their contrast.
- Keyboard order and `:focus-visible` visibility on native inputs and the datepicker overlay.
- Narrow frames (≤ 1080px `modal-full`, resized dialogs, small viewports) and RTL.
- Long translations: native `<input type="button|submit">` labels do not wrap; a very long
  translated label may still exceed a narrow sheet (residual, not clipped).
- Opener behaviour after a real save (`window.close()` / `opener.refreshme()` inside the dialog).
- Print and the inactive legacy shell (expected unchanged: screen-only link and scope; not
  observed).
- Ordinary review and approval; no form was submitted and no database row was written.
