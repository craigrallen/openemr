# Day sheet num2 popup: screen palette seam (OPEMR-57)

- **Ticket:** OPEMR-57, owner Hermes. Independent popup rotation, run 1 of at most 2.
- **Route:** `interface/billing/print_daysheet_report_num2.php`
- **Base:** `origin/master` `18647270e0c799189d2dc10f801e8de2bff1a360`
- **Frozen original:** `tests/fixtures/daysheet-num2-original.php.txt` (401 lines, non-executing
  `.php.txt`), SHA-256 `626ba99804484d8f307559b7de1cacb30503ebc39342b7215395b28b7ec807a4`
- **Contract:** `tests/clinical/daysheet-num2-popup.test.cjs` (node:test, no dependencies) and the
  Jest wrapper `tests/js/clinical-daysheet-num2-popup.test.js`.

## Status

- **Tests phase (published):** tests-only commit `d0fd95ac`, draft PR131.
- **Local RED before production (recorded by the controller):** with the route untouched,
  `REQUIRE_GIT_BASELINE=1 node --test tests/clinical/daysheet-num2-popup.test.cjs` gave 13 passes,
  1 intended failure ("production route carries the screen-only presentation seam", exactly the
  missing-presentation codes) and zero skips; the frozen Git bytes, synthetic candidate, inverse and
  all mutants passed. Evidence:
  `/Users/craig/.hermes/projects/openemr/verification/daysheet-num2-20261019/local-red.txt`.
- **Production phase (this change):** the route now carries exactly the approved candidate from
  the contract (`EXPECTED_RULES` / `buildCandidate`): the screen style after the Header line and the
  body class ahead of the unchanged margin attributes. No test, fixture or wrapper was changed.
- **Controller GREEN:** unchanged contracts passed mandatory Git baseline 14/14 and portable
  13/13, zero skips. Full Jest passed 62 suites / 1,260 tests; PHP syntax, actual extracted
  nonignored CSS lint and diff checks passed. Temporary individual sibling dependency links were
  removed. Independent Codex `gpt-6-astra` reviewed all five files and actual caller/theme/Header
  context, found no introduced P1/P2 defects and independently passed both source modes and PHP
  syntax. Claude's production phase reached its turn limit after both intended edits; the
  controller recovered the complete patch by inspecting and executing it.
- **Hosted gates remain pending:** tests-only JS run `39295727332` failed its unit-test step;
  assertion logs were not read, so this is not counted as verified hosted RED. Local RED above
  establishes chronology. Final exact-head CI and native acceptance are separate, unclaimed gates.

## Scope

A partial screen palette, not a complete researched UI. The only accepted production delta is:

1. One `<style media="screen">` directly after the existing `<?php Header::setupHeader(); ?>` line.
   The original blank line before `</head>` stays.
2. `class="oe-daysheet-num2-document"` added to the existing `<body>`, ahead of every original
   legacy margin attribute, which stay byte for byte and in order:
   `topmargin="0" rightmargin="0" leftmargin="2" bottommargin="0" marginwidth="2" marginheight="0"`.

With `S = html.oe-workbench-context body.oe-daysheet-num2-document`, exactly three rules, each a
paired colour (ink with a background):

| Selector | color | background-color |
|---|---|---|
| `S` | `var(--oe-wb-ink, #17343b)` | `var(--oe-wb-canvas, #f3f7f5)` |
| `S table` | `var(--oe-wb-ink, #17343b)` | `var(--oe-wb-paper, #fff)` |
| `S > a`, `S > a > .title` (grouped) | `var(--oe-wb-ink, #17343b)` | `var(--oe-wb-canvas, #f3f7f5)` |

The close link sits directly on the body canvas (num2 has no container), so it pairs with canvas.
Format: style tags at column 0, selectors at two spaces, declarations at four, one blank line
between rules, grouped selectors one per line.

Not allowed: `!important`, `box-shadow`, borders, pseudo states, any at-rule including print,
fonts, geometry, wrappers, JavaScript, extra PHP, shared asset, helper or caller changes, and table
DOM repairs. The raw `border=0`/`border=1` tables, all totals and formulas, the malformed nested
markup, the `<font>` elements and all escaping stay exactly as they are.

Removing the delta must restore the frozen original byte for byte. That equality is checked inside
`validate()` itself, so any edit to restored source fails on its own, not only in a separate test.

## Source and caller behaviour (recorded, unchanged)

- `billing_report.php` `SubmitTheEndDayPrint()` (option 2, `use_custom_daysheet == 2`) POSTs
  `the_form` to the named target `new`. No window features, no explicit size.
- The route reads its own criteria and `mode` from `$_GET`; the only POST read is
  `filter_input(INPUT_POST, 'end_of_day_totals_only', ...)`. The GET/POST mismatch is retained.
- `$list` is empty and `BillingReport::billCodesList($list)` runs only for `GET mode=bill`, which
  the caller does not send. An empty-input early return is not evidence of live-use authorization.
- No automatic print and no `printLogPrint` call, before or after.
- The body class applies in all media and is a real DOM delta; no claim is made that it is absent
  from, or harmless in, any audit or print payload.
- Context discovery in `popup.js` is a load-time snapshot; it is not proof of ongoing opener
  revocation. Descendant `.text`, `.small` and `.bold` may keep theme-specific ink and remain
  native acceptance items.

## Verification modes

- Portable: `node --test tests/clinical/daysheet-num2-popup.test.cjs` (no Git calls).
- Baseline: `REQUIRE_GIT_BASELINE=1 node --test tests/clinical/daysheet-num2-popup.test.cjs`
  authenticates the fixture against the full Git base, checks the full inverse of the live route,
  requires the caller, shared assets (`popup.css`, `popup.js`, `ClinicalWorkspaceAssets.php`,
  `theme-defaults.scss`, `config.yaml`) and the num1/num3 routes to be unchanged, and limits changed
  files to the route plus these four files (this document included). A missing base commit fails;
  it is never skipped.

## Awaiting (not claimed)

Native PHP execution, session, authority/ACL, accounting correctness, default, dark and solar
compiled theme descendants, window opener lifecycle, desktop and resized narrow layouts, RTL,
keyboard and roles, and legacy print. No app bootstrap, database, patient, accounting, print,
vendor or national requests were made. No merge or deploy.

## Boundaries preserved

PR112 denied review and its unpublished files, the Swedish denied clone and publication, and all
other denied boundaries remain in force. The tests phase touched only these four files; the
production phase touched only the route and this document. No caller, shared asset, helper, wrapper
or num1/num3 route was changed.
