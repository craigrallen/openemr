# Print Billing Report popup (OPEMR-55)

Route: `interface/billing/print_billing_report.php`, opened from
`interface/billing/billing_report.php` by `SubmitTheScreenPrint()`, which POSTs `the_form`
to the named window target `'new'` with no window features (no explicit size).

## Status

This is a **partial screen source presentation only**. It is not a native or complete
researched UI, and it is not a security, financial or audit acceptance. At this stage only the
tests, frozen fixture and this document exist; the production route is **not yet changed**.
The controller records RED before any production edit.

No route, bootstrap, caller, database, financial, print or audit request was made while
writing the contract. The route is never executed by the tests: with `mode=bill` it can UPDATE
billing rows through `BillingReport::billCodesList()`. Everything is checked as source text.
The original-22 register and status coordination are not changed by this work.

## Approved production contract (for the later phase)

Exactly two additive changes; removing them restores the frozen original byte for byte:

1. One `<style media="screen">` immediately after the existing
   `<?php Header::setupHeader(); ?>` line. The original blank line before `</head>` stays.
   Three rules, in this order:
   - `html.oe-workbench-context body.oe-print-billing-report-document`:
     ink `var(--oe-wb-ink, #17343b)` on canvas `var(--oe-wb-canvas, #f3f7f5)`.
   - `… body.oe-print-billing-report-document > table` (existing direct-child raw tables):
     ink on paper `var(--oe-wb-paper, #fff)` with
     `box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2)`.
   - `… > a, … > a .title` (the existing direct-child close link and its `.title` font), one
     grouped rule: ink on canvas. No `:focus-visible` or other state selectors are grouped in.
2. `class="oe-print-billing-report-document"` added to the existing `<body>`. All original
   body attributes (`bgcolor`, `topmargin`, `rightmargin`, `leftmargin`, `bottommargin`,
   `marginwidth`, `marginheight`) are kept unchanged.

Embedding: `<style>` tags at column 0 (the Header line's indent), selectors at 2 spaces,
declarations at 4, one empty line between rules. Removing the common 2-space prefix leaves
2-space declarations and the blank rule separators.

Colour only. Not allowed: geometry, typography, wrappers, `!important`, controls, scripts,
`@media print` or other at-rules, shared-asset links or edits, and any PHP, JS, query,
translation, escaping, backend, `$COLS`, width, date-format, close-link or caller change.

## Existing behaviour preserved, not cleared

These remain exactly as at base and are **not cleared** or **security accepted** by this
change:

- The route reads `$_GET` only, while the caller POSTs `the_form`. In practice the POSTed
  criteria do not appear to reach the route's variables (defaults would apply); this is from
  source reading only and is unverified at runtime. The mismatch is recorded, not fixed.
- A GET request with `mode=bill` reaches `BillingReport::billCodesList($list)`, a billing
  write, from a print view. The ACL is `acct/eob` or `acct/bill` write. Unchanged.
- The data fetch and GET parsing are duplicated in the route. Unchanged.
- The close link is `javascript:window.close()` with `target="Main"`. Unchanged.

## Activation

`popup.js` (autoloaded by `Header` through `config/config.yaml` `workbench-popup`) adds
`oe-workbench-context` only when the opener chain reaches an **active, same-origin**
workbench shell. A window opened as a named form target is expected to keep `window.opener`.
With a closed, missing or cross-origin opener the page stays legacy and the rules are inert.
The opener model is unit-checked against `findWorkbenchHost` only; the actual named-target
POST in a real browser is unverified.

The shared `popup.css` popup rules (for example the popup font) still apply when the context
is active; this contract does not change them.

## Print and audit

The `<style>` is screen-only. The body class is a DOM change in **every** medium, including
print; it is not a claim about any print audit payload. This target has no `printLogPrint`
call and the contract forbids adding one. Legacy OS print output is unverified.

## Contrast

The declared pairs (ink on canvas, ink on paper) meet 7:1 as token values. Paired declarations
on these elements do not prove native effective contrast for descendants, theme overrides,
`bgcolor` interaction or themed `.title` styles.

## Pending (separate acceptance gates, not run)

- Ordinary approval with no bypass of review or policy.
- Actual named `'new'` POST target: opener retention and context activation in a real browser.
- Native compiled default, dark and solar themes.
- Initial and resized narrow and short windows.
- RTL, keyboard operation, window close via the existing link.
- Legacy OS print output.
- Roles: ACL allow and deny paths.
- GET-mode billing (`mode=bill`) behaviour and the POST-vs-GET mismatch, which stay unchanged.
- Output of the `printRecDataOne`/report helpers.
- Hosted CI and broader PHP/code-quality suites.

## Tests

- Fixture: `tests/fixtures/print-billing-report-original.php.txt`, the complete 171-line base
  route (`18647270e0c799189d2dc10f801e8de2bff1a360`), non-executable extension, SHA-256
  `41913171ab3d5990e7a537bde32600cb5b5dec5e27373393ab1e889d950b69f5` pinned.
- Contract: `tests/clinical/print-billing-report-popup.test.cjs` (node:test, no dependencies).
  The default run uses no Git. `REQUIRE_GIT_BASELINE=1` adds a mandatory test that
  authenticates the fixture against the base commit and fails, not skips, without history.
- Jest wrapper: `tests/js/clinical-print-billing-report-popup.test.js` runs the portable
  suite with `execFileSync` and never calls Git, so hosted shallow checkouts are supported.

The contract proves a synthetic candidate before production exists, checks the exact inverse
to the frozen original, and rejects anchored mutants (ACL, billing write path, GET reads,
query, escaping, translation, `$COLS`, widths, dates, close action, body attributes, print
additions, caller launch, style placement, media, scope, selectors, properties, values,
duplicates, relocation and format). Each mutant anchor must exist exactly once and change the
input before rejection is checked.

Expected pre-production result: every test passes except
`production route carries the screen-only presentation seam`, which fails only for the missing
style and body marker. No result has been recorded yet.
