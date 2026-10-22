# OPEMR-26 fax dispatch popup palette and focus slice

## Scope and rationale

This source change adds a workbench-scoped, screen-only treatment to the existing fax dispatch popup. The route imports `ClinicalWorkspaceAssets`, links a versioned stylesheet after `Header::setupHeader()`, and marks its existing form with `oe-fax-dispatch-sheet`. The asset helper adds the stylesheet basename in sorted order. These are the only route and helper additions.

The stylesheet sets paired paper and ink colors on the existing `#div_copy` and `#div_forward` jumbotrons and their three nested `bg-secondary` panels (`#div_copy_doc`, `#div_copy_sn`, `#div_note`). The nested panels need `!important` on their background to override the theme's secondary background. Separate `:focus` and `:focus-visible` rules give the existing form controls, checkboxes, radios, and buttons a petrol outline. Every selector requires `html.oe-workbench-context form.oe-fax-dispatch-sheet`, and the four rules sit inside `@media screen`.

This is a partial palette and focus treatment. It does not establish researched design fidelity, native fit, clinical acceptance, or security acceptance. It leaves the body canvas, title, page preview, result and status areas, and control palettes to the existing theme. It does not alter wrappers, layout, fonts, geometry, button or field palettes, backend behavior, or JavaScript. Compiled theme contrast remains unverified.

## Caller and behavior boundary

The existing fax list opens both received fax and scanned dispatch through `fax_dispatch.php` at 850 × 550 with a CSRF token. The route's GET path can create or remove cache files and run conversion. Its POST path can create a document or form, add a patient note, copy, delete, archive, or send a fax. The source additions leave all those original paths and their security checks byte for byte intact. The asset version comes from the helper's fixed allowlist and is escaped with `attr_url`; the web root is escaped with `attr`.

The existing jumbotron padding and 750 × 970 page images may overflow the 850 × 550 popup. Keyboard checkbox and select-patient affordances, along with existing label quirks, are unchanged. The stylesheet affects the popup only while the workbench context class is active and only on screen.

## Verification and acceptance state

The controller reported a completed hosted tests-only RED run at SHA `2748f0f63e5d2e419c5084a5b8feb234219efc6f` (JS `39037671847`): exactly three expected missing route, helper, and CSS failures; 1,265 passing tests across 62 suites. The controller also reported passing synthetic forward/inverse/CSS positives and mutation, caller, and context guards. The full route fixture and helper were independently byte compared with `origin/master` at `18647270`; Jira readback was Review.

These source edits target the exact additions asserted by `tests/js/fax-dispatch-popup.test.js`. No GREEN result is claimed until the controller runs the hosted tests against this implementation. No application HTTP, database, conversion, file, fax, provider, credential, configuration, merge, deploy, or cron action was performed for this source change. Clinical, security, native, and compiled-theme acceptance remain outstanding.
