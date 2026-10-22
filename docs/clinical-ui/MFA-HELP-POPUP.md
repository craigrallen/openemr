# OPEMR-85: MFA help in the workbench

## Ownership and exact scope

Run 1 of at most 2. Owner: Hermes. This is the MFA help route presentation seam only. The exact five-file change scope is:

1. `Documentation/help_files/mfa_help.php`
2. `tests/js/fixtures/mfa-help-popup-original.php.txt`
3. `tests/js/contracts/mfa-help-popup.cjs`
4. `tests/js/mfa-help-popup.test.js`
5. `docs/clinical-ui/MFA-HELP-POPUP.md`

The tests-only starting HEAD was `b65dbfe5`. The original route was byte-identical to the pinned fixture at RED. The route change adds one `@media screen` style block immediately before `</head>` and the `mfa-help-workbench-route` body class. Its five rules pair canvas/ink on the body, paper/ink on the direct help container, paper/ink on headings, transparent/ink on non-button links, and transparent/ink on help redirects. Every rule requires both `html.oe-workbench-context` and the route body marker. The existing info-panel CSS, instructional and security text, translations, hidden details, toggle script, sample controls, fonts, geometry, warnings, session behavior, and surrounding route bytes remain as they were.

The scoped colors pair inherited workbench help backgrounds and text to support readability in that context. The new CSS has no print rule. The source contract checks the exact additions and inverse against the original fixture; it does not measure rendered contrast or native behavior.

## Actual caller and context

`interface/usergroup/mfa_registrations.php` sets `show_help_icon` to `true` and `help_file_name` to `mfa_help.php` in its OemrUI settings. It calls `pageHeading()` for the help icon and `oeBelowContainerDiv()` for the modal. OemrUI's constructor attaches the help icon listener when `enable_help !== 0` and `display_help_icon` is true; `oeBelowContainerDiv()` emits the modal when `display_help_icon` is true. These are separate conditions. OemrUI uses an ordinary `#myModal` with `#targetiframe`; the iframe source is loaded on first help click.

In the workbench, the same-origin `targetiframe` help document can traverse its content frame to the active shell. The existing popup controller then gives this ordinary modal's help document `oe-workbench-context` **only**, not `oe-workbench-popup`. This route's CSS also requires its own body marker, so neither the context class alone nor this route outside that context activates the colors. No caller, authentication, enrollment, shared asset, or configuration change is part of this work.

The MFA security guidance is inherited content. Preserving it does not endorse or clinically approve its wording or sample controls.

## Evidence and limits

The genuine controller RED is recorded in `/Users/craig/.hermes/projects/openemr/verification/mfa-help-20261021/red.log`: 34 tests, 33 passed, 1 failed because the live route lacked the presentation seam. The synthetic candidate passed its exact-source checks while the production route was still the original fixture. Tests-only commit `b65dbfe5` followed RED. Controller GREEN subsequently passed all 34 portable contracts and 35 history-mode checks (including full original Git-base authentication and scope), all 1,260 Jest tests across 62 suites, PHP syntax, rooted ESLint, actual nonignored source CSS stylelint and `git diff --check`. Thirteen temporary individual sibling dependency links were removed; no dependency install or configuration/gate change. Evidence logs are in that external verification directory. Hosted CI remains pending publication; source/synthetic checks do not establish native acceptance.

Native authenticated help eligibility, session and role behavior, default/dark/solar themes, warning and control appearance, focus and contrast, opened/resized/narrow/short viewport behavior, keyboard and RTL use, print behavior, and clinician approval remain outstanding. The additions are CSS scoped to screen plus a DOM body class; behavior across all media, including print, has not been natively verified. Source contracts are neither native or security acceptance nor proof of a fully researched UI, all 22 areas, or exhaustive popup completion. This work does not authorize a bypass, merge, or deployment; the controller owns independent verification and draft publication.
