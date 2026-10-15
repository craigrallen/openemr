# Procedure catalogue popup

`interface/orders/types.php` renders the procedure catalogue both as the `dlgopen` picker from
`orders_results.php` and as the admin/super maintenance tab. This change presents it as a
screen-only workbench document sheet in both modes.

## Rationale

- Scoped to `html.oe-workbench-context body.oe-procedure-catalogue`, not the popup marker, so the
  picker and the maintenance tab share one presentation.
- The route gains only four insertions (asset import, helper-versioned `media="screen"` link, body
  class, sheet class). Inverting them restores the original route byte-for-byte; SQL, ACL, QOE,
  opener callbacks, the `types_ajax.php` tree, controls, stripes and fonts are untouched.
- `procedure-catalogue-popup.css` uses the existing `--oe-wb-*` palette from `popup.css`, pairs
  every ink with its paper (sheet, `.table`, `tr.head`, `evenrow`/`oddrow`), leaves cells and the
  inherited `mark.oe-patient-background` / `oe-pink-background` marks to their inherited paint, reconciles Bootstrap row/column gutters,
  wraps button groups, and gives separate `:focus` / `:focus-visible` outlines.
- The one `!important` repaints `#con0 .text-body`: dark/solar themes compile Bootstrap's
  `.text-body` to near-white, which would vanish on the paper rows.
- `procedure-catalogue-popup.css` is a supported basename in `ClinicalWorkspaceAssets`, covered by
  isolated successful and missing-asset checks.

## Evidence

- `tests/js/procedure-catalogue-popup.test.js`: RED at 12 failed / 7 passed, then on the expanded
  suite 13 failed / 7 passed (20 total) before implementation.
- Source checks only. They do not establish rendered behaviour.

## Inherited, not changed

- Semantic paint: the AJAX tree (`types_ajax.php`) marks rows with `mark.oe-patient-background` /
  `oe-pink-background`, not inline yellow/pink cells. The sheet does not override them; source is
  preserved and their contrast against the sheet is unverified.
- No explicit CSRF token on the route's form; this presentation change neither adds nor removes one.

## Open (needs separate acceptance)

- Native browser geometry and rendered contrast
- Compiled theme interaction (light, dark, solar)
- Keyboard reachability and focus order
- Dynamic AJAX tree rows after expand/collapse
- Narrow viewports
- RTL languages
- Print output (the sheet is `media="screen"` and `@media screen`, so the CSS is inactive in print by
  construction; native print output is not verified)
- Opener and QOE callbacks in a live session
- Role coverage (`patients/lab` picker vs `admin/super` maintenance)
- Deployed-instance verification
- Ordinary review and approval
