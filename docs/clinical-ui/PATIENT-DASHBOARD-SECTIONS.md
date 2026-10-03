# Patient dashboard section sizing

## Change

Workbench patient cards use their content height, not 100% of their containing column. Generic workbench section padding no longer also pads cards. Collapsed cards display a compact header; the separator lives on the visible expanded body. Expanded content is not assigned an arbitrary maximum height or clipped.

The shared Twig template derives body visibility, icon and initial `aria-expanded` from one effective collapse state. Forced-open cards remain visible even with a stale collapsed preference. Original target IDs, native collapse controls, add/edit links, ACLs and stored preference contracts remain unchanged. Legacy CSS is unchanged; the corrected semantic template state applies to both modes.

The record-page stylesheet gets a real per-file cache version through `ClinicalWorkspaceAssets`, with the stylesheet basename explicitly allowlisted.

## Verification

- CSS TDD: four genuinely failing layout assertions before the changes, then all six focused regressions green. PHP setup prevented the implementer's initial RED: this is a recorded test-first exception, not claimed as PHP test-first. A later replay against the exact base Twig source produced three real assertion failures (collapsed fixture/ARIA and forced-open visibility), and the base asset helper produced two unsupported-asset errors. Restoring byte-identical candidates passed the same full focused files (38 Twig tests / 182 assertions, 21 asset tests / 29 assertions).
- Full JS: 37 suites / 672 tests; JS lint and full stylelint passed.
- PHPStan full CI configuration: no errors.
- Full isolated PHPUnit: 5,981 tests / 15,264 assertions; passed with 4 warnings, 24 skips and 14 incomplete tests (not represented as an issue-free run).
- Independent read-only Codex review: no P1/P2 findings.
- Real authenticated Chrome, guarded `SYNTH-DEMO-0001`: every one of the 24 rendered cards opened and closed through its original title control at 1440/768/390px, LTR and RTL. Every closed body measured zero height and its card fit its header plus padding/border. Vitals shrank from 1,249.5px to 51.9px when closed. Original open/closed states were restored. No browser page errors.

Browser verification used the complete replacement candidate stylesheet after disabling the existing stylesheet link; appending a replacement while keeping removed original selectors active is not equivalent. No PHP/HTML response or patient data was replaced. The user-preference persistence callback was explicitly suppressed only in that disposable QA browser context; no preference or clinical form POSTs were issued. This proves native controls and candidate layout, not preference API persistence or deployed server markup. Initial server semantic state is covered by real Twig tests and must be checked after deployment.

## Limits

The browser role was the existing test administrator and only the synthetic record above was used. Optional disabled cards/modules and other roles were not dynamically exercised. They retain the shared template contract; do not claim universal optional-module or permission-path browser coverage. Critical forced-open semantics are covered in isolated rendering tests. No records, settings, database schema, permissions, dependencies or global theme rules were changed.

Browser evidence (outside the repository): `browser-qa/dashboard-cards-{baseline,candidate}.json` and `.png`; runner `browser-qa/probe_dashboard_cards.py`. This branch is not deployed until separately approved and exact-head CI is green.
