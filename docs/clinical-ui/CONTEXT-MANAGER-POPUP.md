# Nation Notes context manager popup

`library/custom_template/add_context.php`, opened from `personalize.php` as a
500x500 `dlgopen` iframe that calls `refreshme` on close.

## What changed

- The route links `interface/clinical-workspace/context-manager-popup.css`
  once, `media="screen"`, directly after `Header::setupHeader('opener')`. The
  URL is built from the typed `OEGlobalsBag` web root and versioned through
  `ClinicalWorkspaceAssets`, whose allowlist gains `context-manager-popup.css`.
- Identifying classes go on existing nodes only: body, form, outer table, inner
  list table, both field cells and both action cells.
- Every rule sits under
  `html.oe-workbench-context.oe-workbench-popup body.oe-context-manager`, uses
  `popup.css` tokens, and pairs ink with paper or canvas. The list's
  `.class1`/`.class2` stripes become ink on paper and ink on canvas. The table
  title bars are repainted as ink on paper (`.title_bar`) and ink on canvas
  (`.title_bar_top`) because dark themes can give them light text.
- The body canvas carries the sheet's only `!important`, needed to override the
  `.body_top` `!important` in `color_base.scss`.
- Field paint is guarded by a single
  `:not(:disabled, .is-invalid, .is-valid, [readonly])`. `:focus` and
  `:focus-visible` have separate rules. Action cells may wrap.
- The sheet sets no typography, visibility, display, position, overflow or
  height.

## Unchanged

ACL, SQL, `$_POST` handling, escaping, the inline `<style>` and `<script>`,
handlers, hidden inputs, rows, controls and fonts are byte-identical once the
listed edits are reversed. Existing behaviour that stays as it was:

- No route-specific CSRF token on the add, update and delete POSTs.
- The malformed nested Save/Cancel and Update/Cancel anchors.
- `CheckContextLive` makes a synchronous (`async: false`) AJAX call to
  `ajax_code.php` before a delete is confirmed.
- Simply viewing the page sends no extra live request. Requests happen only
  through the existing handlers.

## Not established

This slice does not claim native fit at 500x500, contrast, or clinical
fidelity. Themes that force `.text` colour with `!important` (for example
manila) still override stripe ink. Acceptance is still open for: dialog role
and labelling, opener refresh, save/update/delete, print, the legacy
(non-workbench) page, narrow dialogs and compiled themes.
