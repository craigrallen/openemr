# Print Amendments popup (OPEMR-54)

Route: `interface/patient_file/summary/print_amendments.php`, opened by
`interface/patient_file/summary/list_amendments.php` with a bare `window.open(url)`.

## Status

This is a **partial source adaptation only**. It is not a full researched design, and it is
not a security acceptance. The native runtime has not been exercised: no live route,
bootstrap, database, patient, print or audit action was performed. All 22 / demo / Swedish
and denied boundaries from the clinical-workspace programme remain in force, including the
clinical no-live-action boundary. No merge, deploy, cron or policy action is part of this
change.

## Implemented production delta

The route source now carries exactly the delta the contract allows, and nothing else:

1. One `<style media="screen">` directly after `Header::setupHeader()`, closing `<head>`,
   with exactly two rules, in this order:
   - `html.oe-workbench-context body.oe-print-amendments-document`:
     ink `var(--oe-wb-ink, #17343b)` on canvas `var(--oe-wb-canvas, #f3f7f5)`.
   - `html.oe-workbench-context body.oe-print-amendments-document > table`:
     ink on paper `var(--oe-wb-paper, #fff)` with an inset 1px quiet edge
     `var(--oe-wb-line, #d9e4e2)`.
2. One extra class, `oe-print-amendments-document`, on the existing `body_top` `<body>`.

Embedding: `<style>` tags at 4 spaces, selectors at 6, declarations at 8 (2 after the common
prefix is removed). Colour only: no geometry, fonts, wrappers, controls, scripts, print or
other media rules, PHP, query, caller, helper or shared-asset change. The raw tables keep
`border='1'`, `width:75%`, `page-break-after` and have no `.table` class. History order,
date formatting, escaping and translation are unchanged, as are the `Header` assets and the
`opener.top.printLogPrint(window)` call. Removing the delta reproduces the frozen original
byte for byte.

## Activation

The caller opens the route with `window.open(url)`: no window features, so no explicit popup
size, and `window.opener` is kept. `popup.js` (autoloaded by `Header`) adds
`oe-workbench-context` only when the opener chain reaches an **active, same-origin**
workbench shell. With a closed opener, no opener, or a cross-origin opener, the page stays
legacy and the two rules are inert. The caller must not be changed to `noopener`, and the
opener must never be restored or patched.

The `<style>` is screen-only, but the body marker class is a real DOM change in every
medium. The default `printLogPrint` audit fallback uses `win.document.body.innerHTML`,
which excludes the body element and its class; the head style is excluded too. The route
sets no `printlogdata`. No change to that default payload follows from these two additions
alone. Native print output and audit behavior still require verification.

## Known, not cleared

- The amendment query is bound only to `amendment_id`, not to the session PID. The route
  therefore inherits the existing cross-patient binding risk. This change does not touch it
  and it is **not cleared** and **not security accepted**.
- The context rule sets `background-color` on `body`. Where a theme sets the body background
  with `!important`, that theme override still wins; where it does not, the workbench canvas
  replaces the theme body background in the activated popup. Which happens per theme is
  unverified.

## Pending (not run)

- Native compiled default, dark and solar theme contrast in the live popup.
- Window/opener activation in a real browser, including closed-opener and `noopener` cases.
- Open-and-resize to narrow and short windows.
- RTL, keyboard, legacy print output, and the `printLogPrint` audit-captured body.
- Hosted CI and broader PHP/code-quality suites; local source checks below do not replace them.

## Tests

- Fixture: `tests/fixtures/print-amendments-original.php.txt` (frozen base route,
  non-executable extension, SHA-256 pinned).
- Contract: `tests/clinical/print-amendments-popup.test.cjs` (node:test, no dependencies, no
  git unless `REQUIRE_GIT_BASELINE=1`).
- Jest wrapper: `tests/js/clinical-print-amendments-popup.test.js`.

Evidence actually observed: before this production change the controller ran the contract
with `REQUIRE_GIT_BASELINE=1` (Git-authenticated fixture) and recorded RED in
`red-final.tap`: 10 passing, 1 failing — the intended
`production route carries the screen-only presentation seam` failure for the missing
presentation. After the minimal production delta, the controller and independent Codex
Astra reviewer each executed the mandatory-history suite: **11/11 passed, zero skipped**.
Portable checks keep history authentication optional; controller history validation is mandatory.
Controller PHP syntax and nonignored extracted inline CSS stylelint passed. Full local Jest
passed **62 suites / 1,260 tests** after temporary individual sibling dependency links resolved
initial ESM/stylelint-config setup failures; links were removed and initial failures retained.
The tests-only commit's hosted JS run also recorded the sole missing-presentation failure
with 61 other suites passing. Hosted final-head and native acceptance are separate gates.
