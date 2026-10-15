# Template question popup: workbench document presentation

Status: **source-only slice.** This is not a fidelity acceptance, not a clinical
acceptance, and no UI was executed to produce or check it.

## Scope

Route: `library/custom_template/quest_popup.php` (Nation Notes template `??`
question popup).

Changed files:

- `library/custom_template/quest_popup.php` — one `use` import, one
  `ClinicalWorkspaceAssets` instance and one versioned `media="screen"` `<link>`
  directly after `Header::setupHeader('opener')`, and identifying classes on the
  existing `<body>`, `<table>` and three `<td>` elements. Nothing else.
- `src/Common/Assets/ClinicalWorkspaceAssets.php` — the single basename
  `template-question-popup.css` added to the sorted allowlist.
- `interface/clinical-workspace/template-question-popup.css` — new screen-only
  sheet.
- This document.

Not changed: `interface/clinical-workspace/popup.css`, `popup.js`,
`interface/themes/color_base.scss`, `src/Core/Header.php`, and the caller
`library/js/ajax_functions_writer.js`. No shared theme or engine edits.

## Rationale

Inside an active workbench popup the route rendered as a bare legacy table on
the theme's `.body_top` background. The sheet presents the existing table as a
paper sheet on the workbench canvas using only the shared popup tokens
(`--oe-wb-ink`, `--oe-wb-paper`, `--oe-wb-canvas`, `--oe-wb-line`,
`--oe-wb-petrol`), with no raw colours.

- Every selector starts with
  `html.oe-workbench-context.oe-workbench-popup body.oe-template-question`, and
  the whole sheet is one `@media screen` block linked with `media="screen"`, so
  the standalone route and print keep the legacy rendering.
- Body canvas: the theme declares `.body_top` background with `!important`, so
  the body rule carries the sheet's one and only `!important`, on exactly the
  route scope.
- Table: paper, ink, line border, radius; `width: 100%` and `min-width: 0` as a
  provision. No measured fit is claimed.
- Textarea `#quest`: paired ink and paper at rest and on `:focus` (with a petrol
  outline), `box-sizing: border-box` and `max-width: 100%` as a provision. Every
  textarea selector is guarded by
  `:not(:disabled, .is-invalid, .is-valid, [readonly])` so those states stay
  the theme's. `rows="12" cols="70"` are unchanged.
- Option buttons and Save / Cancel cells use `white-space: normal` so they may
  wrap; the cells stay table cells (no `display` change).
- Focus: a plain `:focus` outline fallback and a separate `:focus-visible` rule,
  so a browser that rejects `:focus-visible` cannot discard the fallback.
- Not touched: font sizes and other font properties, the `.text` rows, the
  `btn btn-primary` option palette, the native Save / Cancel `<input
  type="button">` controls, display/visibility/position. No headings or labels
  were invented.

## Behaviour preserved

The single inline script (`showWhereInTextarea`, `replace_quest`, `save_this`),
the four inline handlers, `$_REQUEST['content']`, the
`nation_notes_replace_buttons` `list_options` query, all `htmlspecialchars(...,
ENT_QUOTES)` escaping, `opener.restoreSession()` calls and `window.close()`
calls are byte-identical to the base.

- Security posture is inherited and unchanged: global authentication via
  `interface/globals.php`; there is **no explicit route ACL check** and **no
  CSRF token**. This slice neither adds nor removes either.
- Save only transfers the textarea text to the opener via
  `window.opener.updateEditorContent()` and closes the window; nothing is
  persisted by this route.
- Caller: the original opener requests the popup at **640×250, resizable**.
  That is recorded as the original caller geometry, **not** as a geometry
  acceptance; the sheet makes no claim that the content fits it.
- Compatibility with existing `dlgopen` / `window.close()` callers requires
  native QA.

## Tests

- `node --test tests/clinical-ui/template-question.cjs` — portable source
  checks: link placement and versioning, script/handlers/SQL/escaping/controls
  unchanged, class placement, allowlist order, sheet scope, tokens, the single
  `!important`, textarea state guards and paired ink/paper, separate focus
  rules, wrapping, formatting.
- `node --test tests/clinical-ui/template-question-history.cjs` — whole-route
  baseline: inverting the declared `CHANGES` must reproduce the base route
  byte for byte (base commit `18647270`), removing the one basename restores
  the asset helper, the caller and shared popup/theme/header sources are
  byte-identical, and negative-control mutations break restoration.
- `tests/js/template-question-popup.test.js` exists but was not run for this
  slice.

## Open (not accepted here)

- Native rendering with compiled themes (light, dark, manila, etc.) and
  contrast measurement.
- Keyboard order and focus visibility in a real browser.
- Tiny-window behaviour, both opened directly and after resizing the 640×250
  window.
- RTL layout.
- Print and legacy (non-workbench) rendering.
- Opener roles: Save with and without `updateEditorContent` on the opener, and
  Cancel, under real `dlgopen` / `window.open` callers.
- Ordinary review and approval.
