# Drug editor popup

Presentation-only adaptation of `interface/drugs/add_edit_drug.php` when it is
opened inside the clinical workbench popup frame. The form reads as one paper
sheet with hairline detail rows; the route's logic is untouched.

## Changed files

- `interface/drugs/add_edit_drug.php` — seven insertions only: the
  `ClinicalWorkspaceAssets` import, a `media="screen"` stylesheet link after
  `Header::setupHeader(["opener"])` and before the route's inline `<style>`,
  and the classes `oe-drug-editor-popup` (body), `oe-drug-editor-form`,
  `oe-drug-editor-limits`, `oe-drug-editor-templates` and
  `oe-drug-editor-actions`. Original classes stay alongside.
- `interface/clinical-workspace/drug-editor-popup.css` — one `@media screen`
  block; every selector starts with
  `html.oe-workbench-popup body.oe-drug-editor-popup`.
- `src/Common/Assets/ClinicalWorkspaceAssets.php` — `drug-editor-popup.css`
  added to the allowlist (name-checked before any path is built).
- `tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php` —
  versioning, missing-file fallback, exact allowlist, near-miss and traversal
  rejection for the new name.
- `tests/js/drug-editor-popup.test.js` — source contract, inline-script and
  stylesheet guards.

Not changed: the launcher, `add_edit_lot.php`, the nested code picker,
`library/dialog.js`, and the shared `popup.css` / `popup.js`.

## What the stylesheet does

- Sheet: paper/ink and a hairline border on the form; each top-level
  `.form-group` replaces only its bottom margin with a hairline rule (the
  inherited `mt-3` top margin stays).
- The warehouse limits and templates tables become `display: block` with
  `overflow-x: auto`, so they scroll inside the sheet when their columns
  cannot fit; their fields keep a `5rem` minimum instead of being crushed.
- Actions are a wrapping flex row; Update/Add, Delete (when shown) and Cancel
  all stay. Buttons may wrap their text; Delete keeps the theme's danger
  palette.
- Fields, read-only code fields, placeholders and the primary/secondary
  buttons set colour and paper together from `--oe-wb-*` tokens. A `:focus`
  border fallback is a separate rule from the keyboard `:focus-visible`
  outline on fields, checkboxes and buttons.
- Not touched: font family/size/weight/line-height, the body's themed
  `.body_top` background (no body rule exists), any `display` on
  `.drugsonly`/`.ippfonly` or the inline-hidden IPPF row, print, and the
  legacy (non-workbench) page. No `!important`.

## Launcher geometry (from source, not measured)

- `interface/drugs/drug_inventory.php` `dodclick()` calls
  `dlgopen('add_edit_drug.php?' + params.toString(), '_blank', 900, 600)`.
- The route's pickers call
  `dlgopen('../patient_file/encounter/find_code_dynamic.php' + getter, '_blank', 900, 800)`.
- In `library/dialog.js`, when `where.innerWidth <= 1080` the requested width
  is replaced by `modal-full`; otherwise 900px is converted to a percentage of
  the parent viewport. The content height starts at the requested height with
  `max-height: 94vh`, and `SizeModaliFrame` then resizes it on load from the
  frame document height (+60px), clamped between the requested minimum and
  the parent viewport height.
- After adding a new drug the same frame navigates to
  `add_edit_lot.php?drug=…&lot=0`, which this slice does not style.

Width at a given parent viewport therefore depends on that viewport; this
document makes no claim about how the sheet fits any particular frame size.
Overflow on narrow frames is handled by table scrolling and wrapping actions,
but long translated labels and the original fixed-size inputs can still
widen rows; that is not attributed solely to legacy markup.

## Evidence

Source-only. Focused Jest (`tests/js/drug-editor-popup.test.js`) checks:
the route reverses to its baseline SHA-256 through the exact insertion
mapping, caller/picker/dialog hashes, negative mutations of SQL, ACL, CSRF,
session, validation, confirmation, opener and picker bytes, unchanged
controls and conditional product/IPPF/template markup, the route's actual
inline scripts in jsdom, selector scoping and screen isolation, computed
display unchanged except the two tables and actions, palette pairing and the
focus split. The PHPUnit isolated cases cover the helper.

## Open gates

None of these has been exercised; each stays open:

- compiled theme rendering (light, dark and colour themes) in a real browser;
- keyboard traversal and focus visibility;
- narrow frames, both direct and after dialog resizing;
- RTL layout and long translations;
- the nested code picker and its callbacks into this page;
- opener refresh / `window.close()` / post-add lot navigation;
- print and the legacy (non-workbench) page staying unchanged;
- live role/ACL variants (with and without Delete);
- deployed environment checks.

Programme readiness is unchanged by this slice: the all-22 surfaces status
and the Swedish programme are as recorded elsewhere.
