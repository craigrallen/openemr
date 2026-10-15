# TECH-62: Add Custom Button popup

Route: `library/custom_template/add_custombutton.php` (opened as a workbench
popup from the custom template editor).

Status: **tests only (RED)**. No production file has been changed. Source-only
and native/browser acceptance are pending.

## Files

| File | Role |
|------|------|
| `tests/js/custom-button-popup.test.js` | Standalone Jest source contract (reads files only; no child processes, Git or network). |
| `tests/clinical-ui/custom-button-support.js` | Dependency-free helpers: CSS subset parser, stylesheet invariants, indentation check, edit apply/restore, control extraction. |
| `tests/clinical-ui/fixtures/custom-button-original.txt` | The unmodified origin/master route, 9831 bytes. Must not be edited. |

## Proposed route additions

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
   <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getString('webroot')); ?>/interface/clinical-workspace/custom-button-popup.css?v=<?php echo attr_url($clinicalAssets->version('custom-button-popup.css')); ?>">
   ```

3. `<body class="body_top">` → `<body class="body_top oe-custom-button">`
4. The `designation_managment` form gains `class="oe-custom-button-document"`
   (name, action, method and `onsubmit` unchanged).
5. The existing action cell `<td class="text-center" colspan="5">` gains
   `oe-custom-button-actions`. The buttons stay in this cell; the sheet may
   give it `display: flex; flex-wrap: wrap` so they wrap.

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
  `OEGlobalsBag::getInstance()->getString('webroot')`, no `$GLOBALS`.
- **Helper allowlist:** `custom-button-popup.css` registered and the list
  sorted.
- **Negative mutations:** renaming save/delete, changing submit type, method or
  `onsubmit`, dropping `readonly` or inline paint, removing the hidden `count`,
  renaming checkboxes, removing the `table-responsive` class, classing the
  `.text` row, changing `$st`, the inline `.class1` rule or the SQL ordering,
  and stray classes/links all fail restoration.
- **Stylesheet:** one top-level `@media screen` block; every selector scoped
  under `html.oe-workbench-context.oe-workbench-popup body.oe-custom-button`;
  palette tokens only (`--oe-wb-*`); no `!important`, font changes,
  `background` shorthand, outline removal, external resources or print rules;
  layout changes refused except `display`/`flex-wrap` on
  `.oe-custom-button-actions`; field repaint selectors exclude `[readonly]` so
  the inline read-only paint is untouched; no selector targets
  `.table-responsive` or the theme `.text` row.

At RED the fixture and negative-control tests pass; the edit, link, helper and
stylesheet tests fail as plain expectations (missing files are read as `null`,
not import errors).

## Inherited behaviour left unchanged

The presentation does not change the route's logic. These pre-existing issues
remain and are out of scope for TECH-62:

- No explicit route ACL check and no CSRF token on the save/delete POST.
- Posted `hidid*`/`chk*` IDs are used directly in `UPDATE customlists` without
  checking that the row belongs to the current user's `template_users` entries.
- `$sta = $_POST['start']` but `$end = $st + $count` reads an undefined `$st`.

## Not tested / not claimed

- No real save, delete, GET or POST was exercised; no native browser or
  Selenium run.
- No claim of full design fidelity, accessibility conformance or security
  hardening.
