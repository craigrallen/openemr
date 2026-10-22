# Address Book entry popup (OPEMR-6)

Owner: OPEMR-6, run 1 of 2 (rotated from 79).

## Rationale

`interface/usergroup/addrbook_edit.php` opens from the Address Book list as a dialog. Inside an
active workbench it rendered with the theme's `body_top` canvas and default Bootstrap fields, out
of step with the workbench popups around it. This slice gives it the workbench ink, canvas and
paper, readable field states and visible button focus, as paint only. It does not change layout,
behaviour, data flow or security.

## Caller

`interface/usergroup/addrbook_list.php` is unchanged. `doedclick_add()` opens
`addrbook_edit.php?type=…` and `doedclick_edit()` opens `addrbook_edit.php?userid=…`, both through
`dlgopen(…, '_blank', 650, screen.availHeight * 75/100)`. `refreshme()` resubmits the list form
when the editor closes.

## Source edits

1. `interface/usergroup/addrbook_edit.php`, five additions only (the `changes` array in
   `tests/js/address-book-popup.test.js` is the exact forward/inverse contract):
   - `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;` after the `AclMain` import;
   - `use OpenEMR\Core\OEGlobalsBag;` after the `Header` import;
   - one `media="screen"` link to `/interface/clinical-workspace/address-book-popup.css?v=…`
     right after the inline `</style>`, so it follows `Header::setupHeader(['opener'])` and the
     inline rules;
   - `oe-address-book-popup` added beside `body_top` on `<body>`;
   - `class="oe-address-book-document"` on the existing `theform` form.

   No wrappers, controls, scripts or markup were added, removed or reordered.
2. `interface/clinical-workspace/address-book-popup.css` (new). One `@media screen` block of eight
   rules. Each rule lists both scopes, `html.oe-workbench-context body.oe-address-book-popup` and
   `html.oe-workbench-popup body.oe-address-book-popup`. The values are `popup.css` tokens with
   their exact literal fallbacks:
   - body: ink and canvas, as a paired `!important`, because `interface/themes/color_base.scss`
     sets `body_top`'s background with `!important`;
   - `form.oe-address-book-document`: ink and paper;
   - `.form-control` normal, `:focus`, `:disabled` and `[readonly]`: ink/paper (disabled ink and
     paper for disabled and readonly) plus a border colour. Every field selector carries the form
     class and `:not(.is-invalid, .is-valid, .was-validated *)`, so Bootstrap's validity classes
     and `.was-validated` `:valid`/`:invalid` styling are not overridden;
   - `.btn:focus` and `.btn:focus-visible`: separate rules, each a 2px petrol outline with a 2px
     offset. Button palettes are unchanged.

   No width, padding, border geometry, typography, display or position. There is no NPI overlay
   selector.
3. `src/Common/Assets/ClinicalWorkspaceAssets.php`: `'address-book-popup.css'` was added to the
   strict, sorted `SUPPORTED` list. The lookup is still `in_array(…, true)`.
4. `tests/js/address-book-popup.test.js`: one narrow correction. The selector deny-list in "only
   body, document, fields and button focus are painted" rejected `was-validated` and `*`
   outright. That made the required `.was-validated` container exclusion unexpressible, which is
   a test-design bug. The test now removes only the exact `VALIDITY_EXCLUSION` string
   (`:not(.is-invalid, .is-valid, .was-validated *)`, the idiom `issue-popup.css` already uses)
   before it applies the deny-list. It also drops the old `(?!\))` lookahead, so any other
   `.is-valid`/`.is-invalid`/`was-validated` reference is still rejected. All other expectations,
   including the jsdom validation-state and inverse tests, are unchanged.

## Preserved

- The admin/practice ACL and its deny template.
- Session and POST CSRF.
- Contact save/update SQL with `add_escape_custom`.
- The internal-user delete guard (`username = '' OR username IS NULL`).
- The `window.close()` / `opener.refreshme()` close path.
- Output escaping.
- The NPI fetch through `npi_lookup.php` with its CSRF token and parameters.
- The `typeSelect()` type switch and its row visibility.
- The Save, Delete and Cancel controls and `validateUsingPageRules`.

## Evidence

- Hosted RED at `00929326d6d535e5171aa1ab433a6c1b487bf855` (JS job 38841863422): 17 failures,
  all intended missing-presentation failures. 1277 tests passed across 62 suites. All fixture,
  inverse, security, caller and important-checker tests passed.
- Controller fixture `cmp` showed the fixture byte-identical to the original route and to
  `origin/master`.
- Final hosted GREEN: **pending**.

## Scope and open items

This is a source and cascade change only. It is not clinical, fidelity or geometry acceptance.

Not corrected (inherited):
- the NPI results overlay's hardcoded palette and absolute positioning;
- `currentSkip`'s implicit global initialisation;
- opener compatibility.

There is no complete authorisation audit. Nothing touched a live endpoint, NPI, the database or
any outbound service.

Still open:
- native acceptance against the real PHP route and the compiled themes;
- focus, clipping, and narrow direct and resized windows;
- RTL and translation;
- print and legacy rendering;
- roles;
- real save and delete with opener refresh;
- browser compatibility of the complex `:not()` on older engines.

Unchanged: the original-22, demo, full-popup and Swedish programme boundaries, and the boundaries
denied earlier. No merge, master, deploy, scheduler, policy, secrets or DB work.
