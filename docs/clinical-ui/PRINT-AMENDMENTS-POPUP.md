# Print Amendments popup (OPEMR-54)

Route: `interface/patient_file/summary/print_amendments.php`, opened by
`interface/patient_file/summary/list_amendments.php` with a bare `window.open(url)`.

## Status

This is a **partial source adaptation only**. It is not a full researched design, and it is
not a security acceptance. The native runtime has not been exercised: no live route,
bootstrap, database, patient, print or audit action was performed. All 22 / demo / Swedish
and denied boundaries from the clinical-workspace programme remain in force. No merge,
deploy, cron or policy action is part of this change.

## Accepted production delta (pending, tests first)

1. One `<style media="screen">` directly after `Header::setupHeader()`, closing `<head>`,
   with exactly two rules, in this order:
   - `html.oe-workbench-context body.oe-print-amendments-document`:
     ink `var(--oe-wb-ink, #17343b)` on canvas `var(--oe-wb-canvas, #f3f7f5)`.
   - `html.oe-workbench-context body.oe-print-amendments-document > table`:
     ink on paper `var(--oe-wb-paper, #fff)` with an inset 1px quiet edge
     `var(--oe-wb-line, #d9e4e2)`.
2. One extra class, `oe-print-amendments-document`, on the existing `body_top` `<body>`.

Embedding: `<style>` tags at 4 spaces, selectors at 6, declarations at 8 (2 after the common
prefix is removed). Colour only: no geometry, fonts, wrappers, controls, scripts, PHP,
query, caller, helper or shared-asset change. The raw tables keep `border='1'`, `width:75%`,
`page-break-after` and have no `.table` class. History, date formatting, escaping and
translation are unchanged. Removing the delta must reproduce the frozen original byte for byte.

## Activation

`popup.js` (autoloaded by `Header`) adds `oe-workbench-context` only when the opener chain
reaches an active same-origin workbench shell. `window.open(url)` keeps `window.opener`, so
the popup activates; the caller must not be changed to `noopener` and the opener must never
be restored or patched. With a closed opener, or no opener, the page stays legacy (inert).
The caller specifies no fixed popup size.

The `<style>` is screen-only, but the body marker class is in every medium: the DOM captured
by `opener.top.printLogPrint(window)` for the print audit carries the extra class.

## Known, not cleared

The amendment query is bound only to `amendment_id`, not to the session PID. This change does
not touch it and it is **not security cleared**.

## Awaiting QA

- Native default, dark and solar theme contrast in the live popup.
- Window/opener activation, including closed-opener and `noopener` cases, in a real browser.
- Open-and-resize to narrow and short windows.
- RTL, keyboard, legacy print output, and the `printLogPrint` captured body.

## Tests

- Fixture: `tests/fixtures/print-amendments-original.php` (frozen base route).
- Contract: `tests/clinical/print-amendments-popup.test.cjs` (node:test, no dependencies, no git
  unless `REQUIRE_GIT_BASELINE=1`).
- Jest wrapper: `tests/js/clinical-print-amendments-popup.test.js`.
