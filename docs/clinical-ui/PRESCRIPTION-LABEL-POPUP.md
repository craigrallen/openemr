# Prescription label popup (OPEMR-48)

Status: **production change applied; verification pending.** Not accepted.

- **RED (recorded):** the tests-only commit `ed16477c82f32396cd4c01a3d86a999aa31065ad`
  failed as intended in hosted JS run `39192180053`. The portable contract had 50
  passes and 1 failure, the intended "actual dispense_drug.php carries exactly the
  approved screen presentation" check. Jest had 61 other suites passing (1259 tests)
  and 1 failing, the wrapper for that same check. Local history mode confirmed the
  frozen fixture is byte-identical to base `18647270e0c799189d2dc10f801e8de2bff1a360`.
- **Production:** `interface/drugs/dispense_drug.php` now carries the exact addition
  below and nothing else.
- **Local GREEN:** 51/51 portable contracts passed, including mandatory full historical
  source equality, every negative mutation and the original pin. Both changed PHP
  files passed syntax checks; `git diff --check` passed.
- **Independent review:** controller-owned Codex `gpt-6-astra` inspected all six files
  and caller/shared context sources read-only; no introduced P1/P2 findings. No tests
  or application requests were run by the reviewer.
- **Still pending:** final exact-head hosted CI. Executed final evidence is recorded
  in the PR's final controller comment and external delivery report; native and
  clinical acceptance remain open regardless of CI.

Scope: a small, screen-only change to the bottle label (`interface/drugs/dispense_drug.php`)
that puts the label on paper over a quiet canvas inside an active clinical workbench.
The accepted reference sets the direction. This change does not try to match the
reference fully, and it is not a redesign, a native or clinical acceptance, or a
change to dispensing, inventory or audit.

## Target change

1. Directly after the existing `Header::setupAssets(['workbench-popup'])` opt-in, one
   inline `<style media="screen">` block with two rules and a blank line between them:

   ```css
   html.oe-workbench-context body.oe-prescription-label-popup {
     background-color: var(--oe-wb-canvas, #f3f7f5);
   }

   html.oe-workbench-context body.oe-prescription-label-popup > center > table {
     background-color: var(--oe-wb-paper, #fff);
   }
   ```

2. The original body tag gains one class and keeps all its margin attributes:
   `<body class="oe-prescription-label-popup" leftmargin='0' topmargin='0' marginwidth='0' marginheight='0'>`.
   The class itself is not screen-only: it appears in the generated HTML in every
   context, including print and whatever the print/audit callback captures.

Both rules set only `background-color`. The change adds no ink override, shadow,
border, padding, geometry or font rule, and nothing that reaches the black separator
row. The `.labtop`/`.labbot` text stays `#000000`, and the change adds no JS, shared
asset, helper or caller edits.

The selectors are scoped to `html.oe-workbench-context` because `popup.js` toggles
its classes on `<html>` only. Outside an active workbench, neither rule matches.
That conclusion comes from reading the selectors, not from watching the page render.

## What stays the same (source level)

With the style block and the body class removed, the file is byte-identical to the
frozen master source. That covers the 200pt table, the 7pt/9pt legacy type, the
black 5pt separator, the `nowrap` cells, every field and its `text()`/`xlt()`
escaping, `include_opener.js`, the `printLogPrint(window)` callback, the
`admin/drugs` ACL check and the bound sale query.

## Tests

- `tests/fixtures/clinical-workspace/prescription-label-popup.contract.cjs`: a
  dependency-free `node --test` contract. It holds the frozen master source
  (`dispense_drug.master-18647270.txt`), a synthetic approved candidate and mutation
  negatives covering duplication, relocation, media/print scope, width, text, ACL,
  query, escaping, callback and extra CSS. Restoring the frozen source is one of the
  approval checks themselves. History mode is opt-in and local:
  `OPENEMR_PRESCRIPTION_LABEL_GIT_HISTORY=1` compares the fixture with
  `18647270e0c799189d2dc10f801e8de2bff1a360`, and fails rather than skips when that
  history is missing.
- `tests/js/clinical-workspace/prescription-label-popup-contract.test.js`: a Jest
  wrapper that runs the same contract with history mode cleared, so it works in a
  shallow checkout.
- `WorkbenchPopupHeaderfreeTest`: the original pin `65a54587…` stays unchanged. For
  the dispense label only, the exact approved addition is stripped before the opt-in
  lines are removed. The untouched original and the synthetic candidate both match
  the pin, and malformed or extra additions break it.

## Limitations (not verified, no claims)

- **Requests:** none were made to the application, DB, patient, dispense,
  inventory, email or print. A GET without `sale_id` can call `sellDrug()`, which
  posts a sale and moves inventory. On load, the page calls `printLogPrint(window)`,
  which can print and write an audit entry from the opener.
- **ACL:** the route's `admin/drugs` check does not prove the user has authority over
  the current patient's sale. That is out of scope here.
- **Evidence scope:** source-only guards check bytes and CSS text. They do not
  establish native default/dark/solar theme rendering, the real 400×200 window or a
  resized narrow window, RTL, keyboard use, roles, print or print preview, or that
  the body captured for audit is unchanged now that it carries the class.
- **Themes:** the fallbacks are fixed light palette values, and no theme matrix has
  been run.
- **Clinical acceptance:** none is claimed. This is presentation only.
