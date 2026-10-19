# Printed fee sheet (Superbill) popup — OPEMR-60

Status: **tests and fixture only; production seam pending.** Native, CI and
human review are all still pending. Nothing here has been rendered, printed or
reviewed in a browser.

## Scope

This is a partial, researched UI change to
`interface/patient_file/printed_fee_sheet.php`. It is limited to exactly one
production seam, which has not been applied yet:

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
callback), geometry and pagination, typography, controls, escaping,
translation and print logic. The rules set no `!important`, no print or all
media, no geometry and no typography.

The production edit waits for a fresh RED run to be authorized. The seam must
match the verifier's two rules and the body class exactly.

## Launch contexts

- **Superbill menu (`fill=1`)**: `Popup:Superbill` in `standard.json` and
  `front_office.json` opens through `popMenuDialog` → `dlgopen(..., 'modal-mlg', ...)`.
  On an active workbench shell, the dialog frame gets `oe-workbench-context`.
  The two rules apply there, on screen only.
- **Appointments report (`fill=2`)**: this route uses
  `window.open(..., "_blank").opener = null`. With no opener and no dialog
  frame, the popup controller stays inactive, so the context class is never
  added and the seam has no effect.

## Behavioural delta

The marker class is added to the `<body>` tag for every media type, print
included. That is the only change that applies to all media, and it is just
an attribute. `body.innerHTML` (the printed content) is unaffected. Colour
changes happen only under `@media screen` and only when the workbench
context class is present.

## Evidence and its limits

The tests are genuine source-contract tests. They are **not** security
evidence, live rendering evidence or print evidence. They do not check
contrast, RTL, window sizing, real print output or the CSP/security posture.

- `tests/fixtures/printed-fee-sheet-original.php.txt`: frozen base route
  (SHA-256 pinned, equal to the blob at base `18647270`).
- `tests/printed-fee-sheet.contract.test.cjs`: the verifier, the full set of
  inverse/mutation tests (each mutation is proven to change the candidate),
  launch-chain checks and the live-route check.
- `tests/js/printed-fee-sheet.test.js`: Jest-side companion.

The live-route test is expected to fail (RED) until the production seam lands.

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
