# New patient duplicate search popup

## Scope and rationale

`interface/new/new_search_popup.php` is opened by the new patient form in `interface/new/new_comprehensive.php`. This slice gives the results header and the existing action area a paired workbench ink and paper palette. It adds a visible focus outline to their existing buttons when the popup is in an active workbench context. The stylesheet is loaded for screens through the existing asset version helper and applies only under `html.oe-workbench-context` and the new header marker. Its three tokens have explicit fallback colors.

This is a bounded partial header and action palette. It does not establish full researched design fidelity, native fit, security acceptance, or clinical acceptance. The popup retains its existing wrappers, table and result row structure, widths, fonts, native button palette, and semantic result colors. The stylesheet does not restyle result rows, hover, `.topResult`, `.billing`, `.highlight`, the pager, or the page canvas. It has no print rule and no `!important` declaration.

The source contract preserves the original SQL and patient-data field whitelist, parameter bindings, relevance and fatal public-ID handling, `MAXSHOW`, pagination and result count, session, CSRF and ACL checks, escaping and mappings. It also preserves `simple_search`, `SelectPatient`, opener navigation, the public-ID-dependent `confirmCreate` choice, `srcConfirmSave`, and Cancel. The caller's `875 × 500` dialog and save callback are outside this slice.

## Verification and delivery status

The controller verified a genuine hosted, tests-only RED at `d3cfd1e2a2b9445bba3923227ba7875d2f9760fc`, run `JS39045066769`: exactly three expected failures for the missing route additions, helper entry, and stylesheet, with 1,265 passing tests across 62 suites before production edits. The frozen test's synthetic positive, mutation, caller, and context checks passed. These are RED results, not evidence that this implementation is GREEN. The controller subsequently ran two PHP syntax checks and `git diff --check`; both PHP checks and the diff check passed. Hosted GREEN and remaining production validation are pending the controller.

Native PHP/bootstrap execution and compiled-theme checks remain open. Keyboard focus and clipping, initial and resized narrow `875 × 500` rendering, RTL and print, real roles, and real Select Patient, Confirm Create, and Cancel actions remain open. The inherited nested `tr`/`topResult` case, click-only result rows, and session/GET behavior are not security-cleared by this styling change.

This is OPEMR-27, owned by Hermes, run 1 of at most 2, rotated from PR 100. The original 22-feature programme, all-enabled-entry-type synthetic demo coverage, exhaustive popup inventory, Swedish readiness, and previous gates remain separate and pending as previously recorded; this slice makes no new acceptance claim for them. The fork uses `master` as its default branch by exception. Draft PR 101 already exists; ordinary approval remains pending. There is no standing bypass, and the work is unmerged and undeployed.
