# Day sheet num3 popup: screen palette seam (OPEMR-58)

- **Ticket:** OPEMR-58, owner Hermes. Independent popup rotation (day sheet option 3), run 1 of
  at most 2.
- **Route:** `interface/billing/print_daysheet_report_num3.php`
- **Base:** `18647270e0c799189d2dc10f801e8de2bff1a360`
- **Frozen original:** `tests/fixtures/daysheet-num3-original.php.txt` (431 lines, non-executing
  `.php.txt`), SHA-256 `8d192eaabb8d7038b219696b0c75a8d56d6230362eea2aeb675f97e5b0616eee`
- **Contract:** `tests/clinical/daysheet-num3-popup.test.cjs` (node:test, no dependencies) and the
  Jest wrapper `tests/js/clinical-daysheet-num3-popup.test.js` (portable mode only).

## Status

- **Tests phase:** the four test-phase files were committed with the route untouched
  (`82ed3baa68a08cb2cc1feac74a1a0c94e374bc13`). Before any production change the controller ran
  `REQUIRE_GIT_BASELINE=1 node --test tests/clinical/daysheet-num3-popup.test.cjs` locally and
  recorded RED: 13 pass, 1 fail, 0 skipped. The single failure was the intended "production route
  carries the screen-only presentation seam", with only the missing-presentation codes
  (`style-count`, `style-after-header`, `style-before-head-tail`, `body-marker`, `marker-count`,
  `style-missing`). The frozen fixture authenticated against the actual Git base. Evidence:
  `/Users/craig/.hermes/projects/openemr/verification/daysheet-num3-20261019/local-red.txt`.
- **Production phase:** the seam is now present in the route (the screen style block after the
  Header line and the marker class token on the existing body class). Nothing was executed while
  making this change; local GREEN, review and hosted runs belong to the controller and are not
  claimed here.
- **Hosted verification is pending.** No hosted RED or GREEN, CI, review or native run is claimed.

## Rationale

Option 3 opens in a separate window (`target='new'`). When the clinical workbench activation
context is present, the sheet keeps the browser's default canvas and the theme's ink, so it does
not match the workbench palette. The smallest presentation-only fix is a screen-scoped palette
keyed on a body marker, leaving all accounting source untouched.

## Scope

A partial screen palette only: not the full researched design and not clinical acceptance. The
only accepted production delta is:

1. One `<style media="screen">` directly after the existing `<?php Header::setupHeader(); ?>` line.
   The original blank line before `</head>` stays.
2. The marker appended to the existing body class:
   `<body class="body_top">` becomes `<body class="body_top oe-daysheet-num3-document">`.
   `body_top` stays first. The `class` attribute already exists; only a class token is added to
   it. No new attribute is introduced (this body has no legacy margin attributes and none may be
   added).

With `S = html.oe-workbench-context body.oe-daysheet-num3-document`, exactly three rules, each a
paired colour (ink with a background):

| Selector | color | background-color |
|---|---|---|
| `S` | `var(--oe-wb-ink, #17343b)` | `var(--oe-wb-canvas, #f3f7f5)` |
| `S table` | `var(--oe-wb-ink, #17343b)` | `var(--oe-wb-paper, #fff)` |
| `S > a`, `S > a > .title` (grouped) | `var(--oe-wb-ink, #17343b)` | `var(--oe-wb-canvas, #f3f7f5)` |

The close link is a direct child of the body (no container) and its `.title` is a `<span>`, so the
pair is canvas. Format: style tags at column 0, selectors at two spaces, declarations at four, one
blank line between rules, grouped selectors one per line.

Not allowed: `!important`, `box-shadow`, borders, pseudo states, any at-rule including print,
fonts, geometry, wrappers, JavaScript, extra PHP, shared asset, helper, caller, sibling or backend
changes, and table DOM repairs.

Removing the delta must restore the frozen original byte for byte. That equality is checked inside
`validate()` itself, so any edit to restored source fails on its own, not only in a separate test.
Mutants also cover arbitrary one-character inserts and deletes across the original.

## Preserved accounting and source behaviour (recorded, unchanged)

- ACL: `acct/eob` write or `acct/bill` write, else `denyWithTemplate`.
- `billing_report.php` `SubmitTheEndDayPrint()` (option 3, `use_custom_daysheet == 3`) POSTs
  `the_form` to the named target `new`. No window features, no explicit size.
- The route reads its own criteria and `mode` from `$_GET`, and the GET block is computed twice;
  the only POST read is `filter_input(INPUT_POST, 'end_of_day_totals_only', ...)`. The GET/POST
  mismatch is retained.
- `$list` is empty and `BillingReport::billCodesList($list)` runs only for `GET mode=bill`, which
  the caller does not send. An empty list is not evidence that any request is authorized, and the
  route was not executed.
- Per-user totals use the dynamic `$user_totals` map (every distinct user, numeric-only
  accumulation), filtered to non-zero rows. `line_total` / `line_total_pay`, the running total
  cells, the patient transitions (`$old_pid` / `$new_old_pid`, `payment_info` exclusion), the
  `1969-12-31` unbilled sentinel, `sprintf('%.2f', ...)` / `printf('%1$.2f', ...)` amounts and the
  `query_part_day` offsets 37/63 all stay.
- Raw markup stays: the `border-0` detail table, two `border='1'` totals tables, the unclosed
  per-user table and the malformed `<center>`/`<strong>` nesting, `w-100` and `width='250'`
  cells, `font-weight-bold` names, and all `text()`/`xlt()` escaping and translation keys.
- No automatic print and no `printLogPrint` call, before or after.

## Evidence limits

Evidence is source-only: the route, its caller, `Header`, `config.yaml`, `popup.js` and
`popup.css` were read as text. The contrast check covers only the declared fallback pairs
(`#17343b` on `#f3f7f5` and on `#fff`), not effective rendered contrast.

- The head style is screen-only, but the body marker is a DOM delta in all media. No claim is made
  that it is absent from, or harmless in, any audit or print payload.
- Existing `.text`, `.small` and `.title` classes and compiled theme descendant rules may keep
  theme-specific ink or size and override the inherited palette. Their contrast needs native
  acceptance and is not claimed here.
- Context discovery in `popup.js` is a load-time snapshot; it is not proof of ongoing opener
  revocation.

## Verification modes

- Portable: `node --test tests/clinical/daysheet-num3-popup.test.cjs` (no Git calls). The Jest
  wrapper runs only this mode.
- Baseline: `REQUIRE_GIT_BASELINE=1 node --test tests/clinical/daysheet-num3-popup.test.cjs`
  authenticates the fixture against the full Git base, checks the full inverse of the live route,
  requires the caller, `src/Core/Header.php`, shared assets (`popup.css`, `popup.js`,
  `ClinicalWorkspaceAssets.php`, `theme-defaults.scss`, `config.yaml`) and the num1/num2 routes to
  be unchanged, and limits changed files (tracked and untracked) to exactly the route plus these
  four files, with the route present if and only if the seam is. A missing base commit fails; it
  is never skipped.

## Awaiting (not claimed)

Hosted CI on the exact head, independent review, and native acceptance: PHP execution, session,
authority/ACL, accounting correctness, default, dark and solar compiled theme descendants, window
opener lifecycle, desktop and resized narrow layouts, RTL, keyboard and roles, and legacy print.
Approval for publication and merge rests with the controller. No app bootstrap, database, patient,
accounting, print, network or external requests were made. No merge or deploy.
