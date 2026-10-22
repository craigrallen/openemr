# Inventory Add/Update Lot popup

`interface/drugs/add_edit_lot.php`, opened from `interface/drugs/drug_inventory.php` with
`dlgopen('add_edit_lot.php?…', '_blank', 600, 475)`, renders as a quiet document sheet when
`popup.js` marks the dialog document `html.oe-workbench-popup`. Outside an active workbench,
in explicit legacy mode and in print, the route renders exactly as before.

## What changed

- Route: class names only on existing nodes (`body`, `h3`, `form`, field `table`, actions
  `div`), the `ClinicalWorkspaceAssets` import, and one versioned `media="screen"` link to
  `interface/clinical-workspace/inventory-lot-popup.css`. Every field, label, wording, row id,
  option list, inline `<style>` (td `0.8125rem`), inline script, handler, ACL check, CSRF
  token/check, session use, SQL statement, save/transfer/destroy/print/close path and the
  `opener.refreshme` callback are byte-for-byte unchanged.
- `ClinicalWorkspaceAssets::SUPPORTED` gains `inventory-lot-popup.css`.
- No change to `workspace.css`, `popup.css`, shared stylelint config or the caller.

## Stylesheet rules

- Every selector starts with `html.oe-workbench-popup body.oe-inventory-lot-popup`; no media
  queries (screen-only comes from the link's `media`).
- The form is the paper sheet on the canvas; rows are hairline-separated label/value lines.
- Rows use a non-important `display: flex`. `trans_type_changed()` writes inline
  `display:none`/`''`, so inline `none` always wins and no rule targets `#row_*`,
  `#label_warehouse`, `[style]` or `visibility`.
- Label cells have an 11rem basis and `min-width: max-content`, so they are not clipped or
  wrapped by the row; a label longer than the available sheet width (for example a long
  translation) overflows instead. Value cells claim 15rem and wrap beneath the label when the
  row is narrower than both, without media queries.
- No `font-size`, `font` or `line-height` declarations: original typography is preserved.
- Paper/ink paired on body, title, sheet, cells, fields, readonly fields and focused fields;
  placeholder colour set explicitly. `:focus` and `:focus-visible` are separate rules.
- Actions: button labels are `white-space: nowrap` and buttons wrap as whole units; a single
  label wider than the sheet (for example a long translation) overflows rather than wrapping
  or fitting. Semantic colours
  are kept: Update/Add petrol, Print petrol outline, Destroy red, Cancel warning. No
  `!important` was needed: the source search found no compiled-theme important rule on these
  buttons (compiled theme CSS was not available to measure).

## Dimensions (from library/dialog.js only)

The width class is chosen once, when `dlgopen` runs; `dialog.js` has no resize handler.

- Opened at a viewport ≤ 1080px (mobile/narrow): `modal-full`, `max-width: 97%`.
- Opened at a viewport > 1080px (desktop): `max-width` = `(600 / innerWidth * 100).toFixed(1)%`,
  about 600px at open. Resizing the window afterwards keeps that rounded percentage of the new
  viewport; it is not re-checked against 1080px and not held at 600px. Opened at 1920px
  (31.3%) and resized to 1000px, the dialog is about 313px.
- Height: 475px converted to vh is only the initial height. With the default
  `sizeHeight: 'auto'`, `SizeModaliFrame` resets it after load to the iframe content height +
  60px, raised to 475px if smaller, then capped at the viewport height. The cap is applied
  after the minimum, so in a viewport shorter than 475px the viewport wins. The modal content
  also keeps its `max-height: 94vh`, so the rendered height never exceeds 94vh. No height of
  475px, and no fit of the content, is promised.
- Two-column threshold (iframe content width, 16px root, derived from the stylesheet by the
  test): body padding 16 + 16, form margin-left 4, form border 1 + 1, form padding 20 + 20,
  label basis 176, column gap 16, value basis 240 = 510px. Below that, value cells stack
  under their labels. A 97% dialog at a 320px viewport (~310px) and the resized 313px case
  above both stack. At open on desktop the ~600px dialog exceeds 510px only before unmeasured
  modal chrome (`modal-body px-1`, dialog borders) and any label wider than its 11rem basis,
  so a two-column layout there is not claimed as measured.
- No native-browser fit is claimed at any width, and long translations can exceed every
  budget above.

## Evidence

`tests/js/inventory-lot-popup.test.js` (focused Jest):

- Caller sha256 identical; route reverses to the exact 18647270 sha256 through the explicit
  insertion mapping; control/row/handler contract equal before and after mapping.
- Twelve negative mutations (CSRF check and token, ACL gates, SQL parameter, opener callback,
  submit/change/print/cancel handlers, row id, typography) each break the inverse hash.
- The route's actual inline `validate()` and `trans_type_changed()` run in jsdom against a
  synthetic form (PHP resolved per new-lot / existing-lot branch, synthetic option lists).
  All six new-lot and both existing-lot transaction branches check row visibility, readonly
  flags and the warehouse label, with the stylesheet loaded and once without it. Validation
  covers date range, quantity, negative quantity, lot number, warehouse, comments, transfer
  source lot and cross-facility confirm. Print and Cancel inline handlers run against stubs.
  Nothing is submitted.
- The two-column threshold is computed from the shipped stylesheet's declarations, not a
  duplicated literal; the `dialog.js` width, rounding and height paths above are
  source-asserted, not run in a browser.
- Recorded original behaviour, preserved: `validate()` returns `undefined` for valid
  non-transfer transactions; the missing-expiration warning sits inside the transfer branch
  and is unreachable there.

Limitations of the evidence:

- jsdom does not provide form named-control getters; the test shims them from
  `form.elements`.
- jsdom's computed style did not reflect a deliberately injected `display: flex !important` on
  rows; that mutation is caught by the static stylesheet assertion only.
- Destroy navigation, warehouse/vendor generation, ACL-disabled options and SQL paths are
  source-asserted, not executed.

## Open

Native PHP render, compiled themes, keyboard traversal, tiny-viewport geometry, real opener and
`refreshme`, translations, print, legacy mode, live roles/ACL, deployed build and ordinary
clinical approval.
