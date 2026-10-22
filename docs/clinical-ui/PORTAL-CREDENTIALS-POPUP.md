# Portal credentials popup: OPEMR-29 production slice

Status: source change on `OPEMR-29-portal-credentials-entry`, pending controller verification and ordinary review. Draft PR 103 remains unmerged and undeployed. This is a partial form palette and focus treatment, not completed researched fidelity, full popup acceptance, or clinical acceptance.

## Change and rationale

- `templates/patient/portal_login/print.html.twig` links the screen-only stylesheet immediately after `setupHeader(['opener'])`, using the existing `webroot|attr` and `clinicalWorkspaceAssetVersion('portal-credentials-popup.css')|attr_url` Twig bindings. The credential entry form alone receives `oe-portal-credentials-entry`.
- `src/Common/Assets/ClinicalWorkspaceAssets.php` adds exactly one sorted `portal-credentials-popup.css` entry between `patient-search.css` and `soap-document.css`, so the version helper accepts this stylesheet.
- `interface/clinical-workspace/portal-credentials-popup.css` uses one `@media screen` block and three rules. The selector requires `html.oe-workbench-context` and the marked form. It pairs workbench ink with paper on that form, then outlines its anchor buttons on `:focus` and `:focus-visible` with a 2px petrol outline and 2px offset. Literal token fallbacks cover absent variables. The separate `:focus` rule preserves an indicator where `:focus-visible` is unavailable or does not match.

The result alert is outside the marked form. The stylesheet does not select it, semantic warnings, the body, container, title, native fields, buttons' palettes, or extension content separately. It does not change geometry, typography, the print style, or any form and backend behavior. The original credential and reset branches, settings checkbox POST, CSRF, escaping, email result, auto-print, extension includes, and Save, Cancel, and Generate handlers remain in the template. Source-only preservation is not security clearance.

## Evidence and open verification

The controller's hosted JS run `39059210948` against tests-only commit `a8ceb0bf18eb13a13b2bffd698801d1e7006663f` completed genuine RED: exactly three missing-production failures, 1,264 passed tests, and 62 suites. Synthetic forward, inverse, AST, negative, binding, and caller tests passed; the original 131-line Twig fixture and inline helper were independently byte-compared with actual `origin/master` at `18647270`. This production slice has no claimed GREEN run or new test execution. Controller-owned syntax/CSS lint and hosted full JS verification remain pending.

Native Twig/bootstrap/context behavior, compiled default/dark/solar form and native-control contrast, extension content, focus clipping, initial and resized 550×550 and legacy 380×200 dialogs, RTL, print, roles, and real Save, Cancel, and Generate actions remain open. Ordinary approval remains open. Earlier parked gates, the original 22, demo, exhaustive popup work, and Swedish blocked clone remain parked. No live application, patient, credential, database, email, print, or provider action was used for this slice.
