# Patient groups popup heading

OPEMR-32 gives the four existing navigation headings in `portal/lib/patient_groups.php` the clinical workbench paper and ink colors when the workbench context is active. Both render branches load the same screen-only sheet after either Header version, using an escaped web root and the allowlisted `ClinicalWorkspaceAssets::version()` value. The existing `navbar-light bg-light sticky-top` classes remain. The sheet uses `!important` only for the heading background to override the theme's `bg-light` utility; its more specific brand selector inherits heading ink, and its separate button focus rules provide a visible outline. This is a partial heading treatment, not a whole-popup restyle or reference-fidelity claim. Lists, selection, warnings, controls, dimensions, behavior, and print remain outside this change.

## TDD evidence and verification

The controller's hosted tests-only run `3e857d67` for JS `39079864761` completed before production edits: exactly the three intended missing-production tests failed, with 1,264 passing tests across 62 suites. Synthetic forward/inverse, AST, mutant, and caller tests passed. The frozen full-route fixture and embedded helper baseline independently matched the actual master sources at `18647270`. The production contract requires only the import, two links, four nav classes, one sorted allowlist entry, and exactly four CSS rules. No tests or runtime checks were executed during this production edit; the controller owns subsequent verification and publication.

## Security boundary and open QA

This change does not clear the inherited route security concerns. The existing `save_profile_groups` and `save_groups` POST branches mutate `document_template_profiles` and `patient_data` without an explicit local ACL or CSRF check. Globals authentication alone is insufficient clearance. The inherited service global patient-groups reset and query risk also remain unchanged.

Native PHP and popup context, compiled theme colors and brand/control contrast, focus clipping, narrow and initially resized full-height layouts, RTL, print, role variations, real actions and opener behavior, and ordinary approval remain open for the controller's QA. Effective contrast has not been verified in a native browser.
