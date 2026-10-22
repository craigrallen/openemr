# Edit Layout Properties popup (OPEMR-9)

A scoped, screen-only colour and focus palette for Edit Layout Properties
(`interface/super/edit_layout_props.php`). It does not redesign the page and does not claim full
design fidelity.

## The route and its caller

- `edit_layout_props.php` is an admin route: it checks `AclMain::aclCheckCore('admin', 'super')`
  and denies otherwise. It reads `layout_id` and `group_id` from the query string, shows layout
  properties (or group properties when `group_id` is set), and on POST checks the CSRF token, then
  updates or inserts `layout_group_properties`.
- The caller is the layout editor, `interface/super/edit_layout.php`. It opens the route with
  `dlgopen('edit_layout_props.php?' + params, '_blank', 775, 550, "", title)`. After a save the
  route calls `opener.refreshme(layout_id)` and `window.close()`; `refreshme` reloads
  `edit_layout.php` for that layout.
- The services, products and diagnoses code fields open `find_code_dynamic.php` through
  `sel_related()`. The popup calls back into `set_related`, `del_related` and `get_related`.

## What changed

Exactly four edits to the route. Every other byte matches the frozen original
(`tests/clinical-ui/fixtures/layout-properties-original.txt`):

1. `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;` added to the imports.
2. Straight after the original `Header::setupHeader('opener')`, one
   `<link rel="stylesheet" media="screen">` to `interface/clinical-workspace/layout-properties-popup.css`.
   The web root is passed through `attr()`, and the `?v=` version comes from
   `ClinicalWorkspaceAssets::version()` through `attr_url()`.
3. `oe-layout-properties-popup` appended to the body class. `body_top` stays.
4. `class='oe-layout-properties-document'` added to the existing form. `method` and `action`
   are unchanged.

`src/Common/Assets/ClinicalWorkspaceAssets.php` gets a single allowlist entry,
`'layout-properties-popup.css'`, in its sorted slot after `'issue-popup.css'`. No other line in
that file changed.

Kept as they were: `td { font-size:10pt; }`, the `<center>`/`<table>` wrapper, the SQL, the
admin/super ACL check, the POST CSRF check, layout/group scoping, the Gacl ACO listing, validation
messages, hidden controls, session handling, the code-picker functions, the opener callback and
`window.close()`. `workspace.css` is not linked.

## The stylesheet

`interface/clinical-workspace/layout-properties-popup.css` is one `@media screen` block. Every
selector starts `body.oe-workbench-context.oe-layout-properties-popup`, and every selector is on
the fixed list in the test. The only properties are `color`, `background-color`, `outline`,
`outline-offset` and placeholder `opacity`. The canvas background is the only `!important`
declaration; nothing else uses it.

| Target | Ink | Background |
|---|---|---|
| Canvas (body) | `#182c36` | `#edf2f3 !important` |
| Document paper (`.oe-layout-properties-document`) and its `td` | `#182c36` | `#fff` |
| Field, normal and focused | `#182c36` | `#fff` |
| Field placeholder (opacity 1) | `#536773` | inherits field paper |
| Field, disabled | `#536773` | `#edf2f3` |
| Field, readonly | `#182c36` | `#edf2f3` |

- Field rules use `.form-control:not(.is-invalid, .is-valid, .was-validated *)`. Bootstrap
  validation states keep the theme's feedback colours. `:disabled` and `[readonly]` are added
  after that selector and come after the `:focus` rule in the file.
- Fields, checkboxes and the original Submit/Cancel `input.btn` get a `2px solid #0b5cad`
  outline with a 2px offset on `:focus`. The same outline is repeated on `:focus-visible` in a
  separate rule, so a browser that rejects that selector still keeps the `:focus` fallback.
- Button palettes and checkbox appearance are left alone. Only the focus outline is added.

### Why the canvas background is `!important`

`interface/themes/color_base.scss` declares
`.body_top, .bgcolor2, .body_nav { background-color: $paler !important; }`, and the route's body
keeps `body_top`. Any normal canvas declaration would lose to that. When both declarations are
`!important`, specificity decides: the scope selector
`body.oe-workbench-context.oe-layout-properties-popup` is (0,2,1) and `.body_top` is (0,1,0), so the
scope wins. The test checks that the theme source contains that `.body_top` rule, that the route
keeps `body_top`, and that the sheet has exactly one `!important`: `background-color: #edf2f3` in a
rule whose only selector is the scope. The canvas `color` stays a normal declaration.

This is a source-level argument. The browser's computed cascade has not been checked, including in
compiled themes that may add other `!important` backgrounds with higher specificity.

## Evidence

- First RED (tests only, commit `8b8b87a9`): hosted run with 7 intended failures, 1268 tests
  passing across 62 suites. Before this phase the controller also confirmed that the full original
  route fixture and the full helper baseline compare exactly equal.
- Second RED (commit `de0d4d88`, hosted run `JS38870582850`): 4 intended failures, all on the
  canvas `!important` contract, with 1272 tests passing across 62 suites. That run checked the sheet
  as it stood before this change, which had no `!important` on the canvas.
- GREEN: waiting on the controller's run. No result is recorded here yet.

The test (`tests/js/layout-properties-popup.test.js`) checks source code only. It shows that the
route is the frozen original plus the four edits and that the sheet meets its structural and
contrast rules. It does not show what a browser actually renders.

## Known limits and still open

- The sheet only applies when `oe-workbench-context` is on the body. This route does not set that
  class itself. According to the controller's source review, it comes from the shared `Header`
  popup controller. This phase did not check that in a browser, so whether the class is present at
  runtime in this popup is unverified.
- The canvas `!important` is argued from source specificity only (see above). This change does not
  claim the colours win in the browser's real cascade.
- Not verified: compiled themes, narrow screens, the popup opened directly and resized to
  775×550, keyboard focus clipping, RTL, legacy print, accessibility roles, and a real save
  followed by the opener refresh.
- Bugs inherited from the original, left unchanged on purpose. In the new-layout duplicate check,
  `$tmp` holds the query result but the branch tests `$row`, so duplicate detection is not
  established (`$row` may be set elsewhere, for example by inherited globals). The
  layout ID check `preg_match('/(LBF|LBT|HIS)[0-9A-Za-z_]+/', …)` has no anchors, so it accepts
  IDs that only contain a valid prefix somewhere inside them.
- This work did not audit the application over HTTP or for security. Design references were
  used only as general guidance. Nothing was changed in production, clinical systems, databases,
  deployment, vendor code, cron jobs or policy.
