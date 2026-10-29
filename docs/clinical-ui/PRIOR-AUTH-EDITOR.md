# Prior authorization document editor — OPEMR-166

Owner Hermes; scheduled delivery run 1/max2 INCLUDING QA, independently rotated from OPEMR-165/PR233. Internal coding/review phases are not additional scheduled runs.

## Scope and preserved behavior

Exactly five paths: native `interface/forms/prior_auth/templates/prior_auth/general_new.html`, portable contract, whole original fixture, hosted Jest adapter and this document. One inline screen/workbench-scoped stylesheet and one body class provide a responsive 860px document, readable number/date metadata, naturally spaced comments and native Save/Cancel. Every selector is rooted at `html.oe-workbench-context body.prior-auth-document-editor`. No backend, data, schema, permission or native action changes.

Removing only the declared stylesheet and body class restores all 3,255 original bytes. Nine supporting entry/controller/model/save/config/theme/popup files match pinned base `09b29da7771aea334ed5745e058751157af980d7`. Smarty expressions, escaping, datepicker setup, form action, session restoration, CSRF, hidden fields, values and native actions remain intact. The inherited Number label's missing input ID and redundant Comments `value` attribute are deliberately unchanged.

Partial original requirement 2, NOT completion of requirement 2, the original 22 requirements, full reference design or clinical acceptance. No new spell-check/autocorrect, editable headings, reference pane or patient identity feature is claimed.

## Actual tests-first evidence

- Tests-only `e1cd1676`: genuine controller RED portable 8 tests/7 pass/1 fail, history 10/9/1, solely missing presentation before `9e7dd3ff` production.
- Initial offline light matrix: 32 cases, 96 inactive/print comparisons passed, BUT all cases failed legend contrast and four long-label Comments keyboard center hits failed. Not a passing browser matrix.
- Independent Astra complete five-file/one-image initial review confirmed introduced P2 legend contrast 4.369:1 on inherited opaque gray background. This prompted tests-only `8d6c3378`: genuine RED portable 10/9/1 and history 12/11/1 BEFORE the one-declaration production legend-paper background correction. Original inverse and all previous mutants remain; new mutant construction is outside rejection assertions.
- Final controller portable 10/10 and history 12/12 PASS. Actual edited stylesheet Stylelint: nonignored, zero warnings/errors. Local Jest/combined ESLint NOT run; prior denied-action boundaries NOT retried. Hosted adapter/complete exact-head CI remain separate.

Reproduce portable and local mandatory history checks respectively:

```sh
node --test-reporter=tap tests/clinical-ui/prior-auth-editor-contract.cjs
node --test-reporter=tap tests/clinical-ui/prior-auth-editor-contract.cjs --history
```

## Offline rendering and failed keyboard gate

Native locked Smarty 4.5.7 renders the full original/candidate template with synthetic getters and helpers. Five actual compiled themes; new/edit, four widths, LTR/simulated RTL and normal/long English labels: 160 unique cases, 480 full original inactive-screen/print DOM, computed-style and geometry comparisons PASS. 1,280 enabled action states and 1,600 field/text states have minimum measured contrast 6.438:1. Unsaved synthetic multiline draft survives context-class flips. Zero browser errors/network requests.

**Browser acceptance FAILS:** 2,320 real Tab/Shift-Tab control stops include 20 Comments center-hit failures at 390px with long labels (four per theme). A separate fresh-page, identical body-focus/scroll-start light comparison has 128 cases: original 16 center misses elsewhere, candidate 4. All four candidate misses are introduced at long-label 390px new/edit LTR/RTL where the original textarea center is visible. Candidate textarea remains focused with a 3px outline but its center is below the viewport. This is measured keyboard/layout acceptance failure, not proof of inaccessible editing or data loss. No fix or passing keyboard claim is implied. Final independent review is pending at this documentation checkpoint.

The original harness's ambiguous sequential focus origin was corrected externally with explicit body focus reset; initial reports remain preserved. Its center-hit criterion was not weakened. Native date-widget initialization is inert; Header, translations, date formatting, CSRF/session and getters are synthetic boundaries. No OpenEMR bootstrap, SQL, authenticated save, security or persistence acceptance. Real RTL/localization/fonts, full control-outline clearance, full accessibility/reference, old engines and OS print remain open.

## Remaining gates and rotation

Blocked: keyboard/layout gate above; complete independent hosted coverage and exact-head CI must be inspected separately. Awaiting QA: authenticated Save/reopen/update/datewidgets, roles/patient/encounter/CSRF/session/security/persistence, full accessibility/reference/localization/older engines/OS print. Needs ordinary approval; no standing review bypass. Prior OPEMR-165 missing coverage and OPEMR-163/OPEMR-161 keyboard failures remain parked, PR55 parked, PR47 settled.

Unmerged and undeployed. No master writes, DB changes, patients, national integrations, vendor contact or cron/policy changes. The controller's final `DELIVERY.md` in `/Users/craig/.hermes/projects/openemr/verification/prior-auth-editor-20261029/` supersedes pending review/CI snapshots here without implying acceptance. Next DIFFERENT implementation must receive fresh Jira/ownership/TDD preflight; this run does not reserve another surface.
