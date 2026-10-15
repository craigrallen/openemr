# Personalize popup (TECH-64)

Linkage: TECH-64, branch `TECH-64-template-personalization`, draft PR 74. The test contract was committed first in `1045b8b4` (`tests/js/personalize-popup.test.js`, frozen fixture `tests/clinical-ui/fixtures/personalize-original.txt`).

## Scope

`library/custom_template/personalize.php` is restyled as a quiet paper document, but only inside an active workbench popup (`html.oe-workbench-context.oe-workbench-popup`) and only on screen. The standalone page, printed output and explicit legacy mode keep the original rendering.

The route takes exactly the five declared edits:

1. Imports `ClinicalWorkspaceAssets` and the typed `OEGlobalsBag`.
2. Adds one `media="screen"` link to `interface/clinical-workspace/personalize-popup.css`. The link uses the typed webroot and the helper's `?v=` version.
3. `body_top` becomes `body_top oe-personalize`.
4. The form gains `oe-personalize-document`.
5. The action row gains `oe-personalize-actions`.

`ClinicalWorkspaceAssets::SUPPORTED` gains `personalize-popup.css` in sorted order. No other route, shared stylesheet, popup engine or theme file changes. SQL, per-user `template_users` writes, ACL checks, session use, the AJAX sources, nested dialog sizes, inline handlers, the `itemdiv` inline height, the `.text` label cells and the original type sizing all stay byte-for-byte. Undoing the five edits reproduces the fixture.

## Rationale

- **Paint and modest box spacing only.** The stylesheet sets ink/paper/canvas paint, a 1px line border, an 8px radius and small padding/margin. It does not touch typography, the Bootstrap grid, buttons, options or anything script-owned. The category scripts (`jsub_selected`, `check_user_category`, `display_category_item`, `jsub_sortNow`) toggle and rebuild elements that stay unstyled.
- **Canvas `!important`.** The theme's `.body_top` rule forces `background-color` with `!important` (`interface/themes/color_base.scss`). The only way to paint the canvas is to answer it in kind, from a selector with higher specificity. This is the sheet's only `!important`.
- **Paired control paint.** Enabled controls pair ink, paper and line. The enabled selector excludes `:disabled`, `.is-invalid`, `.is-valid` and `.was-validated *`, so Bootstrap's validation borders and glows still apply. This route renders no validation states today, so the exclusions are defensive. Disabled controls get their own disabled ink/paper pair.
- **Focus.** Focus is a 2px petrol outline with a 1px offset, and the Bootstrap glow is removed (`box-shadow: none`). The `:focus` rule is separate from the `:focus-visible` rule, so a browser that does not recognize `:focus-visible` drops only that rule and still shows the focus outline.
- **Action row.** The action row keeps its natural centered wrap and only gains a top rule and padding. Save and the three ACL-gated links (Delete Category, Add Category, Add Context) keep their own classes and handlers.

## Acceptance states

| State | Expected |
|---|---|
| Workbench popup, screen | Canvas body, paper form sheet, paired controls, petrol focus outline, ruled action row |
| Standalone page (no workbench classes on `html`) | Original theme rendering; no rule matches |
| Printed output | Original rendering; the link is `media="screen"` |
| Explicit legacy mode | Original rendering, provided the popup engine removes `oe-workbench-popup` / `oe-workbench-context` |
| Disabled control | Disabled ink/paper pair, line border |
| Validation state (`.is-invalid`, `.is-valid`, `.was-validated`) | Theme/Bootstrap cues stay; none are emitted by this route today |
| User without `nationnotes/nn_configure` | Only Save in the action row; the rule still draws |

Source-level evidence comes only from the committed Jest contract. These states have not been accepted in a live browser.

## Known limitations

- **Theme `.text` cells.** The two `.col-sm-5 text` label cells keep the theme `.text` sizing, and under some themes (for example manila) a `.text` color set with `!important`. The sheet deliberately does not target `.text`, so those labels may not take the workbench ink.
- **Width reduction.** The sheet adds decoration to the form on top of the existing `container-fluid` padding: 12px margin on each side, a 1px border on each side and 4px padding on each side (and, vertically, 8px top and 12px bottom margin). The sheet makes no claim that this equals or fits any fixed caller frame width. Wrapping of the two `col-sm-5` selects and the `col-sm-2` arrow column under this added decoration has not been measured.
- **Native select rendering.** The multi-selects (`size="6"`) and their options use native OS rendering. Whether paper background and ink carry through to options on every engine and OS is unknown and has not been tested.
- **No live, demo or locale verification.** No live GET or POST and no save were performed, and no database, demo-data or deploy step was run. The original 22 requested features (theme acceptance is tracked separately), demo data and the Swedish locale remain open acceptance items.

## Inherited issues (unchanged by design)

These predate this slice. Fixing any of them would change behaviour, so they belong in a separate change:

- **No CSRF check.** The save path (`$_REQUEST['submitform'] == 'save'`) has no CSRF verification, and the form posts no token.
- **ACL gates only the links.** ACL gates only the management links. The page itself, and the per-user save, rely on global authentication alone.
- **Undefined `list_id`.** `$_REQUEST['list_id']` is read with no default (on line 24 with `?:`, and in the Add Category href). Opening the route without `list_id` raises an undefined-key warning.
- **Undefined `selectFrom`.** `remove_selected()` calls `jsub_sortNow(form.elements[selectFrom])`, but `selectFrom` is not defined in its scope.
- **Implicit global `event`.** `jsub_selected()` calls `event.preventDefault()` through the implicit global `event`, not a handler parameter.
- **Unused handler.** The `.iframe_abvmedium` handler (700×550) is bound, but no element on this page carries that class.

## Dialog sizes

- **Caller.** `library/custom_template/custom_template.php` opens `personalize.php?list_id=…` through its `.iframe_medium` handler at **725×575**.
- **Nested from Personalize:**
  - `.iframe_small` (Add Category → `add_template.php`) opens at 400×250.
  - `.iframe_medium` (Delete Category → `delete_category.php`, Add Context → `add_context.php`) opens at 500×500.
  - `.iframe_abvmedium` would open at 700×550, but nothing on the page uses it.
- **Refresh.** Every nested dialog closes with `onClosed: 'refreshme'`. None of these sizes change.

## Next candidate (not accepted)

The next independent candidate is `library/custom_template/add_template.php`, the 400×250 nested Add Category dialog. It has not been inspected in depth, has no tests and is not accepted. It needs its own contract-first slice.

## Review and delivery

- **Review.** An earlier independent Codex attempt could not run because file tools were unavailable ("no device"). It was not a substantive review. The controller will supply the captured full diff to an independent reviewer, and this document does not claim that review has cleared.
- **Delivery.** Verification, commit and push belong to the controller. Merge and deployment are not authorized by this document.
