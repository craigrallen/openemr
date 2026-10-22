# Portal template assignments popup: top heading

## Scope

OPEMR-31 adds a screen-only, context-scoped palette and button focus outline to the existing top `Template Maintenance` nav in `portal/import_template_ui.php`. The nav retains `bg-light text-dark sticky-top`, the Full Editor checkbox, Help button, and Dashboard button. The route links one escaped, per-file-versioned stylesheet immediately after `Header::setupHeader`; `ClinicalWorkspaceAssets` allows that stylesheet. The stylesheet has exactly three rules under `@media screen`: paired heading foreground/background declarations and separate `button:focus` and `button:focus-visible` outlines. The paired heading declarations use `!important` to beat the existing `bg-light` and `text-dark` utilities.

This is a partial top-heading palette and focus change. It does not establish researched-design fidelity, whole-popup styling, native contrast, security, or clinical acceptance. There are no changes to wrappers, fonts, geometry, body, controls, filters, tables, editor, JavaScript, backend, caller, or shared `workspace.css` activation. The existing services, authentication, CSRF/session handling, notification hooks, Select2, Summernote, GET filters, upload, assign, delete, action, and opener paths remain source-preserved.

## Source findings and safety boundary

- `interface/main/tabs/main.php` opens `/portal/import_template_ui.php?from_demo_pid=...` as `pop-assignments` with `modal-lg`, width 850, full height, drag, and resize. The caller is unchanged.
- The route loads `datetime-picker`, `select2`, and `summernote`. Its existing top nav is separate from the dark Scope nav, upload form, repository, patient templates, and assigned templates. The stylesheet targets only the marked top nav when `html.oe-workbench-context` is present; print has no rule here.
- `PatientPortalService::authPortalUser('admin', 'forms')` gates upload controls and selected rendered actions in the route. `portal/import_template.php` has its own `AclMain::aclCheckCore('admin', 'forms')` gate and CSRF checks on upload and delete branches. Some action branches lack local CSRF checks; preserving them is not acceptance of that condition.
- `SendNotificationEvent::JAVASCRIPT_READY_NOTIFICATION_POST` and `SendNotificationEvent::ACTIONS_RENDER_NOTIFICATION_POST` are ready/render hooks in the route. They require a safety preflight before any live route use. A GET of this route must not be assumed read-only.

Source preservation is not security clearance. No actual route PHP/bootstrap, browser, application, network, database, patient, credential, provider, notification, upload, or assignment execution was performed in this production phase.

## Tests-first evidence and remaining gates

Before the production edit, the genuine hosted JavaScript run `39072898536` was RED with exactly three missing-production failures, 1,264 passing tests, and 62 suites. The synthetic forward/inverse preservation, strict CSS AST, mutation, and caller/source-boundary tests passed. This phase did not run local Node/Jest, PHP, bootstrap, native browser, or application checks. Hosted GREEN, full CI, and independent review remain pending; Hermes owns verification, gates, and publication.

Controls and compiled themes, keyboard and focus glow or clipping, narrow initial and resized states, RTL and print roles, real actions, and opener behavior remain OPEN. The original 22, demo, exhaustive popup inventory, and Swedish programme remain OPEN. The denied fresh clone and all prior denied actions remain denied. The draft PR 105 stays unmerged and undeployed, with ordinary approval required. This phase authorizes no merge, master update, deployment, policy or cron change, clinical national action, or vendor action.
