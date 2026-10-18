# OPEMR-33 template profile popup action sheet

This is a partial, source-only workbench action-sheet adaptation. The existing profile and editor branches remain distinct. The full 814-line original `portal/import_template.php` route is preserved except for the three frozen additions: a sorted asset import, one escaped and versioned `media="screen"` stylesheet link after both profile `Header::setupHeader` branches, and one class on the existing `disposeProfile` nav.

Changed production files:

- `portal/import_template.php` adds only those three route changes.
- `src/Common/Assets/ClinicalWorkspaceAssets.php` adds one sorted supported asset entry.
- `interface/clinical-workspace/template-profile-popup.css` adds exactly three screen rules scoped to `html.oe-workbench-context .oe-template-profile-actions` and its focused buttons. The retained `bg-light` class requires the sole `!important` on the background.

The frozen `tests/js/template-profile-popup.test.js` and `tests/clinical-ui/fixtures/template-profile-popup-original.txt` were not changed. Controller-verified, tests-only `65f6b128e0205616c1637d586ebff6aea4643f78` (hosted JS39086431904) was genuinely RED: exactly three intended missing-production route/helper/CSS failures, with 1264 passing tests across 62 suites. Its positive synthetic, inverse, AST, and mutation checks passed. The controller independently byte-compared the original fixture and embedded helper with fetched `origin/master` at `18647270`. This implementation did not run tests or native PHP.

The inherited `save_profiles` branch has no explicit CSRF check. `DocumentTemplateService::saveAllProfileTemplates()` transactionally deletes and reinserts all `document_template_profiles` records with `template_id > 0`. This change makes no security clearance claim and does not change that workflow.

Native PHP and context activation, compiled themes and contrast, keyboard and focus behavior, narrow opening and resize, full-height, RTL, print, roles, real drag and drop, recurrence, Save, Quit, opener behavior, and ordinary approval remain open. Native button palettes, glow, and outline clipping are unverified. This source slice is not full researched visual fidelity, clinical acceptance, or completion of the 22-feature program.
