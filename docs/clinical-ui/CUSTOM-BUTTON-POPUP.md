# TECH-62: Add Custom Button popup

Route: `library/custom_template/add_custombutton.php` (opened as a workbench
popup from the custom template editor).

Status: **production implementation written; GREEN not yet observed.** The
tests-only commit (`6ed81a60`, on master `18647270`) was observed RED in hosted
CI run `38759627706`: 13 failed, 1279 passed across 62 suites, the failures
being the absent route additions, stylesheet and helper registration. The
original fixture was verified at 9831 bytes, unchanged. The implementation that
follows was written without running any tests locally; the hosted GREEN run,
coverage, review and native/browser acceptance are all pending.

## Files

| File | Role |
|------|------|
| `tests/js/custom-button-popup.test.js` | Standalone Jest source contract (reads files only; no child processes, Git or network). |
| `tests/clinical-ui/custom-button-support.js` | Dependency-free helpers: CSS subset parser, stylesheet invariants, indentation check, edit apply/restore, control extraction. |
| `tests/clinical-ui/fixtures/custom-button-original.txt` | The unmodified origin/master route, 9831 bytes. Must not be edited. |
| `library/custom_template/add_custombutton.php` | Route; only the five edits below. |
| `interface/clinical-workspace/custom-button-popup.css` | New route-local screen sheet. |
| `src/Common/Assets/ClinicalWorkspaceAssets.php` | `custom-button-popup.css` added to the sorted `SUPPORTED` list. |

## Route additions

Exactly these five `[original → planned]` edits; undoing them must reproduce
the fixture byte for byte, and applying them to the fixture must reproduce the
route byte for byte.

1. Imports

   ```php
   use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;
   use OpenEMR\Common\Session\SessionWrapperFactory;
   use OpenEMR\Core\Header;
   use OpenEMR\Core\OEGlobalsBag;
   ```

2. Directly after `<?php Header::setupHeader('opener'); ?>` in `<head>`

   ```php
   <?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>
   <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/custom-button-popup.css?v=<?php echo attr_url($clinicalAssets->version('custom-button-popup.css')); ?>">
   ```

3. `<body class="body_top">` → `<body class="body_top oe-custom-button">`
4. The `designation_managment` form gains `class="oe-custom-button-document"`
   (name, action, method and `onsubmit` unchanged).
5. The existing action cell `<td class="text-center" colspan="5">` gains
   `oe-custom-button-actions`. The buttons stay in this cell, which remains a
   table cell so `colspan="5"` and the original `text-center` keep working; the
   sheet sets only `white-space: normal` and spacing on it, so the inline
   controls wrap naturally. No `display`/flex rule is used.

Supporting additions (outside the route):

- `interface/clinical-workspace/custom-button-popup.css`: new sheet.
- `src/Common/Assets/ClinicalWorkspaceAssets.php`: add
  `'custom-button-popup.css'` to `SUPPORTED`, keeping the list sorted.

## What the tests check

- **Fixture:** present, 9831 bytes, each original edit anchor occurs once.
- **Inverse preservation:** restore(route) equals the fixture, apply(fixture)
  equals the route, and every form/input keeps its name, type, value,
  `readonly`, inline `style`, `id`, `size`, `title` and handlers.
- **Structure:** body keeps `body_top`; the `<div class="table-responsive">`
  wrapper and `<tr class="text">` row are unchanged; the read-only number
  cells keep their inline `width`/`background-color:#C9C9C9`.
- **Link:** one screen-only link, versioned through
  `OpenEMR\Common\Assets\ClinicalWorkspaceAssets` (not a guessed
  `Utils`/`Layouts` path), webroot read through typed
  `OEGlobalsBag::getInstance()->getWebRoot()`, no `$GLOBALS`.
- **Helper allowlist:** `custom-button-popup.css` registered and the list
  sorted.
- **Negative mutations:** renaming save/delete, changing submit type, method or
  `onsubmit`, dropping `readonly` or inline paint, removing the hidden `count`,
  renaming checkboxes, removing the `table-responsive` class, classing the
  `.text` row, changing `$st`, the inline `.class1` rule or the SQL ordering,
  and stray classes/links all fail restoration.
- **Stylesheet:** one top-level `@media screen` block; every selector scoped
  under `html.oe-workbench-context.oe-workbench-popup body.oe-custom-button`;
  palette tokens only (`--oe-wb-*`); the only `!important` is the scoped body
  canvas `background-color`, answering the theme's
  `.body_top { background-color: … !important }` in `color_base.scss` with a
  higher-specificity selector; no font changes, `background` shorthand,
  outline removal, external resources or print rules; every layout rule
  (`display`, flex, gap, justify/align, width, overflow, position, …) refused
  with no exception, and the action cell must set `white-space: normal`; every
  `var(--oe-wb-*)` reference must be defined in the real `popup.css`; table,
  `.title_bar_top` and `.class1` repainted with paired ink/paper; editable
  fields painted (normal, `:focus` fallback and a separate `:focus-visible`
  outer outline ring) only through
  `.form-control:not(.was-validated *, :disabled, .is-invalid, .is-valid, [readonly])`,
  so native validation, disabled and read-only states keep their own paint and
  the inline read-only grey is untouched; no selector targets
  `.table-responsive` or the theme `.text` row.

At RED the fixture and negative-control tests passed; the edit, link, helper and
stylesheet tests failed as plain expectations (missing files are read as `null`,
not import errors).

## Stylesheet summary

Quiet canvas body, one paper document with a hairline border and padding, a
ruled title, paper table, muted header cells on canvas, saved `.class1` rows as
a canvas stripe instead of the legacy blue, editable fields on paper with a
petrol focus outline, and the existing action cell left as a table cell with
`white-space: normal` so its inline buttons wrap naturally (original
`text-center` retained). Fonts, the inline
`<style>` block, the button palette, the `table-responsive` wrapper and the
read-only inline paint are untouched.

Disclosed residuals, not verified in a browser:

- The theme `.text` rule (font sizing on the action row) still applies; the
  sheet deliberately does not target it, so no universal contrast claim is
  made for that row or for compiled themes other than the source read.
- The 2px outer focus outline may be clipped by the `table-responsive`
  overflow container.

Defect corrected via independent review (source level, not a native
observation): an earlier draft put `display: flex` on the action `<td>`, which
replaces table-cell formatting and could defeat `colspan="5"`. Codex review
flagged it as P2; the flex/`gap`/`justify-content` rules were removed and the
tests now forbid any layout rule on the sheet. This was a test-design defect
fixed before GREEN, not a new observed RED result; the hosted RED evidence
(13 failed, run `38759627706`) is unchanged. The corrected sheet and tests have
not been run locally or in CI.

## Inherited behaviour left unchanged

The presentation does not change the route's logic. These pre-existing issues
remain and are out of scope for TECH-62:

- No explicit route ACL check and no CSRF token on the save/delete POST.
- Posted `hidid*`/`chk*` IDs are used directly in `UPDATE customlists` without
  checking that the row belongs to the current user's `template_users` entries.
- `$sta = $_POST['start']` but `$end = $st + $count` reads an undefined `$st`.

## Not tested / not claimed

- No real save, delete, GET or POST was exercised; no native browser or
  Selenium run; no local test run.
- Hosted GREEN, coverage and review are pending.
- Open for native acceptance: popup fit and narrow widths, long translated
  labels, focus-ring clipping, compiled-theme behaviour, user roles, the opener
  (custom template editor) round trip, print and the standalone legacy page.
- No claim of full design fidelity, fit, accessibility conformance, safety or
  security hardening.
