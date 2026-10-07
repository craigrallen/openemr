# Common workbench popup migration

## Scope delivered in this branch

This is the shared popup-engine stage, not an assertion that every clinical, portal or module popup has finished migration.

- Register a shared, screen-only popup stylesheet and context controller through the existing Header autoload pipeline.
- Detect the real same-origin workbench host through bounded parent/opener chains, including nested pop-outs; decline cross-origin, closed and cyclic chains.
- Support the shell's own inline modals after DOM readiness and observe workbench/legacy mode changes.
- Preserve form controls, values, validation states, dialog callbacks, iframe identity and existing authentication/ACL/domain logic.
- Pair neutral popup table text/background for light/dark themes while retaining explicit semantic palettes.

No source edits alter SQL, saves, permissions, signing, outbound integrations or live data. CSS is screen-only; print and explicit legacy mode retain their baseline presentation.

## Test and review evidence

The common feature has executable Jest context/CSS regression tests, full repository JavaScript tests, ESLint, Stylelint, asset build and isolated PHP verification. PHPStan and Rector were exercised with a correctly rooted vendor and the genuine Composer-installed ClaimRev package. No suppressions or coverage thresholds changed.

An offline native-Chrome diagnostic exercises four compiled themes at 320 and 1440 pixels. It retains strict semantic-colour, validation-border, value/control/callback, legacy, print, geometry and contrast checks, with negative fixtures proving deliberate failures. The fieldset's declared one-pixel border has a narrowly measured geometry allowance; it is not a global tolerance increase. Source-neutral document coordinates and bounded animation settling avoid scroll/timing false positives.

This native diagnostic uses synthetic HTML and static dialog markup, not real patient data or full dialog.js/Bootstrap callback execution. Opener focus and opener print emulation are explicit gaps, and fixture evidence does not establish live role/ACL/module acceptance.

## Remaining inventory and acceptance

The external code inventory scans 4,400 tracked application files and records 1,876 edges/contracts. These include native browser UI and external content exclusions, behavior-only callbacks, inline modals, same-origin pages and unresolved dynamic targets. A source scan is not runtime acceptance.

Remaining work includes Header-free content, no-opener windows, template/render-chain verification, bespoke popup document layouts, portal/module contexts and guarded real-role workflows. Other open history/message PRs retain their own ownership. Never claim the entire popup migration complete solely because this shared bundle passes tests.

## Cache and delivery

Assets use the existing Header `v_js_includes` version behavior. Route-local mode consumers retain their existing asset helper/version contracts. Merge or deployment is not authorized by this document; require independent review, exact-head CI and the applicable user approval.
