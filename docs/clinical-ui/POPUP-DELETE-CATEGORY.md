# Delete Category popup presentation (TECH-66)

## Scope and ownership

- **Ticket:** TECH-66, branch `TECH-66-delete-category-document`.
- **Route:** `library/custom_template/delete_category.php`, opened from the
  Nation Notes `personalize.php` "Delete Category" link as a 500×500 dialog.
- **Owner:** the controller owns verification, review and publication. This
  production phase only edited files; it ran nothing locally.
- **Run budget:** this is run 1 of 2 under the maximum-two-run budget. The
  ordinary review gate is retained.

Production changes, all presentation-only:

1. `library/custom_template/delete_category.php` — exactly the four edits
   declared in `tests/js/delete-category-popup.test.js`:
   `ClinicalWorkspaceAssets` import before `Header`; a versioned
   `media="screen"` stylesheet link after `Header::setupHeader('opener')`
   using the existing `OEGlobalsBag` import; `oe-delete-category` on the
   body; `oe-delete-category-form` on the existing form.
2. `src/Common/Assets/ClinicalWorkspaceAssets.php` — `delete-category-popup.css`
   added to `SUPPORTED` in sorted position.
3. `interface/clinical-workspace/delete-category-popup.css` — one
   `@media screen` block, every selector rooted at
   `html.oe-workbench-context.oe-workbench-popup body.body_top.oe-delete-category`.

The tests and the original-route fixture were not changed in this phase.

## Evidence

- **RED (genuine, hosted):** tests-only commit `91767968`, hosted Jest run
  `38801626263`: 10 failed, 1262 passed, 62 suites. The fixture comparison
  against the original route was verified exact.
- **GREEN:** not yet run.
- **Review:** not yet run.

## What the sheet does

- Body canvas `var(--oe-wb-canvas) !important`. The `!important` is required:
  `color_base.scss` gives every flat colour theme
  `.body_top{background-color:$paler!important}`, which otherwise wins over
  both the popup frame and a non-important declaration here. It is the only
  `!important` in the sheet.
- Form paper: ink, paper, `12px` padding, `1px solid var(--oe-wb-line)`
  border, `6px` radius.
- Header cells canvas tint and body cells paper tint, each paired with ink on
  the cell itself so a theme's inherited row ink (manila's `!important`
  `.text`) does not reach the cells.
- Separate `a:focus` and `a:focus-visible` rules giving a
  `2px solid var(--oe-wb-petrol)` outline, offset `1px`.

No display, font, sizing, overflow, visibility, control or tree changes. This
adds geometry (padding and border); it does not prove the content fits.

## Preserved behaviour

The original SQL, AJAX calls and `source` values, the `delete_category` /
`delete_full_category` functions, both `top.restoreSession()` calls, the
confirm and alert messages, the reload, output escaping, the
`<a href=#>` wrappers, the image Delete controls, the row classes, the
`ajax_functions_writer.js` include, the unclosed `form`/`body`/`html` markup
and fonts are all unchanged. No live deletion was attempted.

## Security preflight

- The caller link in `personalize.php` is gated by
  `aclCheckCore('nationnotes', 'nn_configure')`.
- `ajax_code.php` gates both delete sources (`delete_category`,
  `delete_full_category`) on `nn_configure` before either branch runs.
- The route itself relies on global authentication only; it has no ACL check
  and no CSRF handling of its own. This change adds none.
- The AJAX endpoint performs no explicit CSRF check.
- The shared-user check is a client-side two-request path
  (`delete_category` lists other users, then the client calls
  `delete_full_category`); it is not atomic server-side enforcement.

## Limitations

- **Inverse check is limited.** The route test proves the route equals the
  fixture plus the four declared edits, and that listed mutations break
  restoration. It does not prove the fixture is the deployed original, nor
  that unlisted behaviour is exercised; only the enumerated mutations are
  negative controls.
- **Focus outline is the only accessibility provision.** The Delete action is
  an `onclick` on the image, not on the enclosing keyboard-focusable link, so
  keyboard activation of the link does not delete. That inherited
  inaccessible activation is not fixed here.
- **Cascade model, not compiled themes.** The tests resolve the cascade
  against hardcoded representative theme rules (cobalt, tabs_style_full,
  manila), not compiled theme CSS. The model omits Bootstrap link rules, so
  it does not show that links inherit cell ink natively; no such claim is made.
- The original five-column natural table may overflow the 500px dialog now
  that padding and border are added.

Still open: native actual-PHP render and compiled-theme contrast; keyboard
operation; direct and resized/narrow viewport; RTL and translations; print and
legacy browsers; a real delete and reload; role coverage; deployed acceptance.

This is not a broad fidelity, clinical-readiness or all-popups completion
claim. PR75 coverage is blocked separately and older parked drafts remain.
No merge, master, deploy, database, policy, cron or clinical action was taken.
