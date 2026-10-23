# Insurance patient browser palette (OPEMR-115)

## Scope and rationale

This change adds one inline `@media screen` style block immediately before `</head>` and the `oe-insurance-patient-browser` class to the existing `body_top` body in `interface/patient_file/summary/browse.php`. It supplies paired canvas/ink, paper/ink/border, link paper/petrol, and focus outline colors for this route's existing title, labels, and immediate result or insurance table. The selectors require both `html.oe-workbench-context` and this route's body marker. Token fallbacks match the shared workbench popup palette. Outside that context, and in print, the added rules do not apply.

The `background-color: var(--oe-wb-canvas, #f3f7f5) !important` declaration is the **only** new important declaration. It overrides the inherited `.body_top` background rule in `interface/themes/color_base.scss`, which is itself important. The body keeps its existing font and geometry; no font, spacing, size, layout, or visibility rule is added. Apart from the exact style insertion and body marker, all original source bytes remain intact, including search, selection, CSRF, and direct copy behavior.

## Source entry chain

The insurance section of `interface/new/new_comprehensive.php` links Browse to `../../interface/patient_file/summary/browse.php?browsenum=...` through `popUp`. `library/dialog.js` implements `popUp` with `window.open`. The route calls `Header::setupHeader(['datetime-picker', 'opener'])`; `src/Core/Header.php` loads autoload assets, and `config/config.yaml` registers `interface/clinical-workspace/popup.js` and `popup.css` as `workbench-popup`. The popup controller marks `<html>` with `oe-workbench-context` when its same-origin window chain reaches an active workbench. The local body marker then narrows these palette rules to this browser route. This is a source entry chain, not proof of runtime opener behavior.

## Test evidence and commands

The controller completed a genuine tests-only RED on the untouched production route: the six source-contract tests had five passes and one failure, solely because the live route lacked the style and marker. The negative mutation checks passed. The explicit history run likewise failed solely on the untouched production route. An initial negative-anchor setup failure was retained, corrected, and rerun before this phase; it is not presented as an application regression. The controller independently checked the complete 20,386-byte original fixture and seven protected-source pins with Git/native hashes. These are source-contract observations, not rendered UI or clinical acceptance.

Commands for the controller's post-edit verification from the repository root:

```sh
node --test --test-reporter=tap tests/clinical-ui/insurance-patient-browser-contract.cjs
node tests/clinical-ui/insurance-patient-browser-contract.cjs --history
```

`tests/js/insurance-patient-browser.test.js` wraps the six-test source contract for the project JavaScript suite. No tests, PHP, project commands, or authenticated runtime checks were run in this production editing phase; the controller owns post-edit execution and hosted gates. No claim is made that coverage or CI has completed.

## Limits and remaining acceptance

The contract checks exact source additions, complete byte preservation of the original route, negative mutations, and protected source pins. It does not establish the whole researched UI or a faster-record feature. The original SS/SSN label mismatch, malformed table markup, and missing-request or selection edge behavior are intentionally left as found; preserving them does not endorse them. No phone validation work is included because no actual in-repository consumer was found.

Remaining acceptance requires authenticated runtime review in the relevant roles and workbench modes, including the real opener and direct-copy path; clinical security and authorization review; and visual/accessibility checks for layout, contrast, keyboard focus, RTL, and print. Those checks must use appropriate test data and are not claimed here as live QA.
