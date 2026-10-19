# OPEMR-56: Day sheet (num1) popup screen seam

Target: `interface/billing/print_daysheet_report_num1.php`, opened by
`SubmitTheEndDayPrint()` in `interface/billing/billing_report.php`.

Base: `18647270e0c799189d2dc10f801e8de2bff1a360`. Frozen original:
`tests/fixtures/daysheet-num1-original.php.txt`, 664 lines with a terminal newline,
SHA-256 `c9b26b97a16f48751e51f562f7e7ed499604849eddd6d0a3616194fc29ec15bf`.

## Status

The tests and this document were written first, in tests-only commit
`ca50d127520ddab5a4f14ce798078604e7f27f14`, before any production change. Before production,
the controller ran `REQUIRE_GIT_BASELINE=1 node --test tests/clinical/daysheet-num1-popup.test.cjs`
locally: 11 passed, 1 failed, 0 skipped. The one failure was the intended missing-production
test, `production route carries the screen-only presentation seam`. The frozen digest, the real
Git-base full inverse and the synthetic and mutation positives passed. The evidence is
`/Users/craig/.hermes/projects/openemr/verification/daysheet-num1-20261019/local-red.txt`.

The hosted run JS39283049292 was queued and had not run at that point. This document makes no
claim that it passed or failed. The genuine local RED is the prerequisite for the production
change, not the hosted run.

The bounded production change below has now been applied to the route. The same test file and
fixture are used, unchanged. Controller verification passed: mandatory Git baseline 12/12,
portable 11/11, full Jest 62 suites/1,260 tests, PHP syntax, actual extracted nonignored inline
CSS lint and `git diff --check`. Temporary individual sibling dependency links were removed.
Independent Codex `gpt-6-astra` reviewed all five files and actual caller/theme/helper context,
found no introduced P1/P2 defects and independently passed both source suites and PHP syntax.
Hosted exact-head gates remain pending; local evidence is not hosted CI or native acceptance.

## How the route is launched (unchanged)

- `the_form` is a POST form. `SubmitTheEndDayPrint()` sets the named target `new` with no window
  features or size. It sets the num1 action only when `use_custom_daysheet == 1`; num2 and num3
  use their own branches.
- The route reads its criteria and `mode` from `$_GET`. Only `end_of_day_provider_only` and
  `end_of_day_totals_only` come from POST, through `filter_input(INPUT_POST, …)`. This mismatch
  between GET criteria and the POST caller stays as it is. `SubmitTheEndDayPrint()` does not
  set `mode`. It posts whatever value the form's existing hidden `mode` field already holds, so
  the posted `mode` is not always `change`. Because the form is posted with no query string,
  `$_GET["mode"]` is unset on this launch, and the route uses its GET defaults.
- `$list` starts empty whatever the mode is. `BillingReport::billCodesList($list)` is called
  only when `$_GET["mode"] === 'bill'`. When it is called, it returns early because `$list` is
  empty, not because the mode is something other than `bill`. This route therefore proves
  nothing about billing updates. Passing the bootstrap, ACL check and helpers does not make
  the route read-only or safe for live use.
- The route has no auto print and no `printLogPrint`.

## Bounded production change

The change was applied after the controller confirmed the local red test. It has two parts:

1. Insert one `<style media="screen">` immediately after the exact
   `<?php Header::setupHeader(); ?>` line. The original blank line before `</head>` stays.
2. Add only `class="oe-daysheet-num1-document"` to the existing bare `<body>`.

Removing exactly those two pieces must restore every byte of the original. The contract's
`validate()` enforces that full restored-source equality itself.

Only the four rules below are allowed. Selectors sit at 2 spaces and declarations at 4, with one
blank line between rules. A grouped selector puts one selector on each line. `S` stands for
`html.oe-workbench-context body.oe-daysheet-num1-document`.

| Selector | Declarations |
|---|---|
| `S` | `color: var(--oe-wb-ink, #17343b)`; `background-color: var(--oe-wb-canvas, #f3f7f5)` |
| `S > .container` | ink; `background-color: var(--oe-wb-paper, #fff)`; `box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2)` |
| `S .table` | ink; paper (no nested outlines) |
| `S > .container > .row > a`,<br>`S > .container > .row > a > .title` | ink; paper |

The rules must not add `!important`, states or pseudo-selectors, print or at-rules, geometry,
fonts, JavaScript, PHP, calculation, aggregation, GET/POST, escaping, date, caller, num2/num3,
helper or shared-asset changes. The body marker is a real DOM change that applies to all media.
It is not a claim about any audit payload. The malformed raw nested tables (12 nested
borderless tables, two closers, one stray `</div>`) are deliberately left unrepaired.

## What the tests prove, and what they do not

The portable run makes no Git calls. It checks:

- the fixture digest and line count;
- that the synthetic positive candidate passes and inverts exactly to the original;
- that the untouched original fails only for missing presentation;
- 81 unique-anchor negative mutants covering ACL, PHP and GET/POST, SQL and aggregation,
  escaping, translations, formulas, money precision, widths, classes, dates, raw structure, the
  close link, print, placement, media, scope, states, pairing, edges, the marker and format;
- the caller's named-target POST, with 10 caller mutants;
- the activation context and the popup.css token defaults;
- an opener discovery model;
- that the live route is either the original or exactly the candidate.

With `REQUIRE_GIT_BASELINE=1`, the run also:

- fails when the base commit is missing;
- compares `git show` of the original route with the fixture bytes;
- checks that the live route minus the approved delta equals the base route;
- checks that the caller, `popup.css`, `popup.js`, `ClinicalWorkspaceAssets.php`, num2 and num3
  are byte-identical to the base.

Preserving the source does not validate native PHP, the bootstrap, ACL or accounting. The
contrast check covers only the declared fallback pairs. It does not establish compiled or
effective contrast. The original `.text` and `.small` descendant ink may stay theme-specific.

## Researched reference alignment

The alignment with the researched reference is partial: it covers paper and canvas only. The
researched layout has not been implemented.

## Open items

- Native default, dark and solar themes.
- The opener snapshot versus ongoing revocation.
- Reuse and closing of the named window.
- Narrow and short viewports, both when opened and after a desktop resize.
- RTL, keyboard use and roles.
- Legacy OS print output.
- Accounting validity.

## Process

- Merging needs an ordinary approval and a complete hosted CI run on the exact head, with no
  standing merge bypass.
- The All22, demo, Swedish and exhaustive popups are retained.
- The denied Swedish clone and review boundaries, and the unpublished PR112 files, stay
  untouched.
- No cron, deploy, DB, app, print, vendor or national requests are made.

## Commands

```
node --test tests/clinical/daysheet-num1-popup.test.cjs
REQUIRE_GIT_BASELINE=1 node --test tests/clinical/daysheet-num1-popup.test.cjs
npx jest tests/js/clinical-daysheet-num1-popup.test.js
```
