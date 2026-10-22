# Code Finder popup: document-shaped presentation slice

Route: `interface/patient_file/encounter/find_code_popup.php`

## Scope

Presentation only. When the Code Finder opens inside an active clinical
workbench popup (`html.oe-workbench-popup`), the existing `container-fluid`
is shown as a quiet paper document on the workbench canvas. The original
search form (code type select, search term, search and clear buttons) and the
original results table are preserved as they were.

Changed files:

- `interface/patient_file/encounter/find_code_popup.php` — exactly the four
  declared `ROUTE_ADDITIONS` in `tests/clinical-ui/code-picker-support.cjs`:
  the `ClinicalWorkspaceAssets` import, a versioned `media="screen"`
  stylesheet link after `Header::setupHeader('opener')`, the
  `oe-code-picker-popup` body class, and the `oe-code-picker-popup__document`
  class on the existing container.
- `src/Common/Assets/ClinicalWorkspaceAssets.php` — the declared
  `ASSET_ADDITIONS` entry `code-picker-popup.css` in the supported list.
- `interface/clinical-workspace/code-picker-popup.css` — new; one
  `@media screen` block matching `CSS_RULES`.
- `tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php` — own
  modification time, missing fallback, near-miss rejection and shipped-file
  version tests for the new name, following the existing allowlist tests.

Unchanged: CSRF handling, `main_code_set_search()` arguments, the
`selcode` / `selcode_target` opener callbacks, every caller of the popup, the
shared popup frame (`interface/clinical-workspace/popup.css`, `popup.js`) and
`interface/themes/theme-defaults.scss`. No behavior or security changes.

## Rationale

- Every selector is scoped under
  `html.oe-workbench-popup body.oe-code-picker-popup`, so the popup looks the
  same as before outside the workbench, and the stylesheet does not apply to
  print (`media="screen"`).
- No font changes, no `!important`, no button palette changes, no
  hover/striping/table-cell rules. Buttons and result links only get a focus
  ring.
- Focus: each simple `:focus` fallback is its own rule, separate from the
  matching `:focus-visible` rule, so a browser that rejects `:focus-visible`
  does not also drop the fallback.
- The disabled/readonly field pair is the last rule so it wins over the
  normal and focus pairs.

### Width and wrapping

The document padding (`12px 16px`) and 1px border add about 34px of
padding-plus-border in total. That figure is not a reduction relative to the
original `container-fluid`, whose Bootstrap gutters already consume width; the
net change in available width is unmeasured, and no numeric delta is claimed.

The `.form-inline` and its `.form-group` get `flex-wrap: wrap`. This is a
provision for narrow callers, not an accepted fix: the `.form-group` display
below 576px may not be flex, so the wrap may not apply there, and the existing
`input-group` may still overflow in narrow frames. The smallest recorded real
caller sizes are 500×400 (`sl_receipts_report.php`), 600×400 (eye form) and
700×400 (`functional_cognitive_status`). Overflow prevention has not been
checked in a browser.

## RED result (before production edits)

Recorded by the controller before any production file was edited:
**60 tests, 25 passing, 35 failing.** The explicit-history baseline checks
for business anchors and real callers passed at that point.

The initial baseline test had an indentation-substring counting defect. The
controller corrected it by anchoring on the newline before the final RED run. That correction is in the baseline test
file (`tests/clinical-ui/code-picker-baseline.test.cjs`), not the support
file; no production source was changed to fit it.

## GREEN result (after production edits)

Recorded by the controller:

- Node source-contract suite: 60 tests passing.
- PHP syntax check: 3 files passing.
- CSS stylelint: passing.
- `git diff --check`: clean.
- Independent source review of the complete nine-file diff found no newly
  introduced P1/P2 issues beyond the documentation defects corrected here.
- The helper PHPUnit tests were added after the production edits and were
  not run locally.

This is source-only evidence. It is not native-theme or full-fidelity
acceptance.

### Inherited `selcode_target` behavior

In production, `selcode_target` checks `opener.set_related_target` but invokes
`opener.set_related`, preserving the original arguments. This is inherited
behavior and is unchanged by this slice.

## Pending gates (not passed)

None of these have been run or approved. This document does not claim that
any of them passed:

- [ ] Native compiled theme: how the stylesheet renders against the real
      compiled theme CSS, including whether the `--oe-wb-*` custom properties
      (including `--oe-wb-disabled-ink` / `--oe-wb-disabled-paper`) resolve.
- [ ] Keyboard: tab order and a visible focus ring on the select, search
      field, search/clear buttons and result links.
- [ ] Contrast: measured contrast of the rendered text, borders and focus
      ring, including disabled/readonly fields.
- [ ] Tiny viewports: the smallest opener sizes and zoomed text, including
      wrapping of the search form.
- [ ] RTL: layout and wrapping in a right-to-left language.
- [ ] Print and legacy: print output unchanged; behavior outside the
      workbench popup and in older browsers unchanged.
- [ ] Real opener: selecting a code from each real caller (immunizations,
      history, receipts report, eye form, observation form, reason-code
      widget) still fills the opener and closes the popup.
- [ ] Roles: checked with non-admin users and restricted ACLs.
- [ ] Approval: review and sign-off.

The source-contract suites in `tests/clinical-ui/` check source text only.
They do not prove native control geometry or rendered contrast.
