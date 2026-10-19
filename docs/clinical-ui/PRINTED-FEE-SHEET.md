# Printed fee sheet (Superbill) popup — OPEMR-60

Status: **source implemented; local verification and independent review
complete; hosted CI and native/role/security/print gates pending.** Nothing here
has been rendered, printed or reviewed in a browser. No merge or deploy is
authorized.

RED was run before the production edit, against tests that were then
uncommitted: 51 tests, 50 passed, 1 failed (only the live-route check, for the
missing body marker and seam), 0 skipped. Those tests were later committed as
the tests-only commit `42854cbf`, so the tests are captured in `42854cbf`; the
RED run was not performed on that commit.

Local verification (controller run, now GREEN):

- History mode: 51/51 passed.
- Portable mode: 47/47 passed.
- PHP syntax check and `git diff --check`: clean.
- Stylelint over the non-ignored, actually added inline CSS: exit 0, no
  warnings.

Independent review: a Codex gpt-6-astra review of all five changed files found
no introduced P1/P2 issues. It independently ran the same contract tests, PHP
syntax check and diff check. This is not a GitHub approval.

## Scope

This is a partial UI change to `interface/patient_file/printed_fee_sheet.php`.
It covers the current Superbill menu path only and is not full researched
fidelity. The production edit is exactly one seam:

1. One body class: `<body bgcolor='#ffffff'>` becomes
   `<body bgcolor='#ffffff' class='oe-printed-fee-sheet'>`.
2. One separate `$html .= "<style>...</style>";` append, placed after the legacy
   style block and before the title/Header append, holding one
   `@media screen` block with exactly two rules:
   - `html.oe-workbench-context body.oe-printed-fee-sheet` sets `color: var(--oe-wb-ink)`
     and `background-color: var(--oe-wb-canvas)`.
   - `html.oe-workbench-context body.oe-printed-fee-sheet form[name='theform']` sets
     `color: var(--oe-wb-ink)` and `background-color: var(--oe-wb-paper)`.

Unchanged by design: custom includes (`$customFeeSheetCodes`), all other PHP,
all JS (including `printLogSetup`, `restoreSession` and the hide-on-print
callback), fonts, geometry and pagination, wrappers, controls, escaping,
translation, shared assets, helpers, callers and print logic. The rules set no
`!important`, no print or all media, no geometry and no typography.

## Launch contexts

- **Superbill menu (`fill=1`)**: `Popup:Superbill` in `standard.json` and
  `front_office.json` opens through `popMenuDialog` → `dlgopen(..., 'modal-mlg', 500, ...)`.
  On an active workbench shell, the dialog frame gets `oe-workbench-context`.
  The two rules apply there, on screen only.
- **Appointments report (`fill=2`)**: this route uses
  `window.open(..., "_blank").opener = null`. With no opener and no dialog
  frame, the popup controller stays inactive, so the context class is never
  added and this branch is not styled. No opener restoration is attempted.

## Behavioural delta

Removing the two presentation additions restores the frozen original source
exactly. The rendered document still differs from the original:

- `<head>` gains one added `<style>` element (screen-only rules).
- `<body>` carries the marker class for every media type, print included.
- `body.innerHTML` (the printed content) is unchanged from the original.

Colour changes happen only under `@media screen` and only when the workbench
context class is present.

## Evidence and its limits

The tests are source-contract tests. They are **not** security evidence, live
rendering evidence or print evidence. No full Jest run was performed and no
screenshots were taken. No security, Swedish-locale, completion of all 22
originally requested features, or demo completion is claimed.

- `tests/fixtures/printed-fee-sheet-original.php.txt`: frozen base route
  (SHA-256 pinned, equal to the blob at base `18647270`).
- `tests/printed-fee-sheet.contract.test.cjs`: the verifier, the inverse/mutation
  tests (each mutation is proven to change the candidate), launch-chain checks
  and the live-route check.
- `tests/js/printed-fee-sheet.test.js`: Jest-side companion.

## Residual gates

Completed locally: controller GREEN run (portable and `--history`), PHP syntax,
diff check, inline-CSS stylelint, and independent Codex review (no introduced
P1/P2; not GitHub approval).

Still open, none passed yet:

- Hosted CI and ordinary GitHub review approval.
- Actual PHP bootstrap, session and authorization behaviour of the route.
- Default dark/solar themes: effective contrast for descendants, the
  `fsgroup`/`fshead` cells and the red "Missing Name" warning.
- Real `modal-mlg`/500 dialog: auto height, open and resize, RTL, keyboard and
  roles.
- Native print output and print-log audit.
- Role and security gates.

## Running

Portable (no Git needed):

```
node --test tests/printed-fee-sheet.contract.test.cjs
```

History (mandatory locally; checks the base ancestry, the fixture blob, the
unchanged launch/Header chain and the five-file change limit):

```
node tests/printed-fee-sheet.contract.test.cjs --history
```

`node --test` strips a trailing `--history` from argv. History mode must
therefore be run with plain `node` as shown above. A `node --test` run does
not cover the history checks.
