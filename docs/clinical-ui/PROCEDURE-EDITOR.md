# Procedure type editor popup slice

## Scope

`interface/orders/types_edit.php` (opened from `interface/orders/types.php` to add or edit a procedure tier) links one screen-only stylesheet, `interface/clinical-workspace/procedure-editor-popup.css`, after its inline `<style>` and before its first script. The link carries an escaped per-file version from `OpenEMR\Common\Assets\ClinicalWorkspaceAssets::version()`, whose fixed allowlist gains exactly that basename.

The route change is presentation only: one `use` import, the versioned link, and hook classes on the existing body, container, form, fieldset and action wrappers (`oe-procedure-editor`, `oe-procedure-sheet`, `oe-procedure-form`, `oe-procedure-document`, `oe-procedure-actions-row`, `oe-procedure-actions`, `oe-procedure-commit`). No headings, controls, labels or generated content are added.

Unchanged by design:

- ACL check, CSRF token collection and `CsrfUtils::checkCsrfInput()` on save/delete, the form's `onsubmit='return top.restoreSession()'` and the inline `restoreSession.php` include.
- SQL, `recursiveDelete()`, the bare `<script>` save/delete response that closes the window and calls `opener.refreshFamily`, and the `Header::setupHeader()` asset list.
- Find-code and find-order popup callbacks (`set_related`, `get_related`, `del_related`, `sel_related`, `set_new_fav`, `doOrdPicker`) and `proc_type_changed()`.
- Script-owned visibility: tier-dependent `.ordonly`/`.resonly`/`.fgponly`/`.foronly` rows, collapsed `*_info` help panels, hover-revealed label help links, the `addfav` disabled select and lab picker, and the `#form_legend` text. The stylesheet sets no `display`, `visibility`, `opacity` or `pointer-events` on any of them.
- Inherited markup quirks (`id=='form_seq'`, `id='form_name '`) and the inline font sizes; the sheet declares no font properties.
- The caller `types.php`, `find_order_popup.php`, `find_code_dynamic.php`, `library/dialog.js`, `src/Core/Header.php`, `config/config.yaml`, and the shared `popup.css`/`popup.js`.

## Presentation

Every selector is scoped to `html.oe-workbench-popup body.oe-procedure-editor` inside a single `@media screen` block, so a direct (non-workbench) open and print keep the legacy rendering. Colours come only from the shared `--oe-wb-*` tokens defined by `popup.css`, always as ink-on-canvas or ink-on-paper pairs. The fieldset becomes a paper document on a canvas page.

The theme defaults (`interface/themes/theme-defaults.scss`, imported by every compiled theme) set `fieldset { background-color: ...; color: ... }`, both `!important`, so ordinary declarations can't override them, whatever their specificity or order. The sheet therefore has exactly two `!important` declarations, both on `html.oe-workbench-popup body.oe-procedure-editor .oe-procedure-document`: `background: var(--oe-wb-paper) !important` and `color: var(--oe-wb-ink) !important`. Both are author `!important`, so the more specific selector (0,3,2 against 0,0,1) wins. No other declaration in the sheet is `!important`, and the theme source and the shared `popup.css` fieldset rule are unchanged. This is a source-level cascade argument. It doesn't show that any theme renders the paper surface natively, and it makes no contrast claim. Save, Cancel and Delete keep their Bootstrap palettes (Delete stays `btn-danger`); the button group wraps at every width rather than overflowing, and both the buttons and the document's help links reserve a transparent outline that turns petrol on `:focus`, with a separate `:focus-visible` rule after it.

## Verification

- The guards are two separate `node --test` suites; local source verification runs both:

  ```bash
  node --test tests/clinical-ui/procedure-editor.test.cjs
  node --test tests/clinical-ui/procedure-editor-baseline.test.cjs
  ```

- `tests/clinical-ui/procedure-editor.test.cjs` needs no git history. It checks that every declared route edit is present once and invertible, the hook classes, control counts and link ordering, the exact allowlist entry against a copied list of the pre-existing names, that the sheet passes the scope, token-pairing, visibility, wrap and focus guards (with negative fixtures), and these docs. It reads the real `fieldset` rule from `theme-defaults.scss`, requires its `!important` set to be exactly `background-color` and `color`, and requires the document rule to answer it with exactly the paper pair above at higher specificity. It also enforces a declaration-level `!important` allowlist (selector, property and value, each once, as a pair, directly in the screen block). Mutations that put `!important` on an unrelated property, another selector, a descendant, a selector list, the `background-color` longhand, another value, a nested media block, a duplicate, or only one half of the pair are rejected. `tests/js/clinical-procedure-editor.test.js` runs this suite under Jest.
- `tests/clinical-ui/procedure-editor-baseline.test.cjs` reads the base commit from git. It checks that removing the declared edits restores the base route byte-for-byte, that business, security, callback, font and quirk mutations break that restoration, that the caller and shared assets are byte-identical, that the helper differs from base only by its one entry, and that the copied baseline names match base.
- `tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php` covers the new entry's per-file version, missing-file fallback, near-miss rejection and shipped file.
- These are source checks. No browser, contrast measurement, narrow-viewport pass or role/theme matrix has been run for this slice.
