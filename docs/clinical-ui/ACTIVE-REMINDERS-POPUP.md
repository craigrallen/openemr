# OPEMR-4: active reminder popup as a document sheet

Status: **implemented; GREEN and review pending.**
Hermes recorded the tests-first commit `137ec909`, a passing controller `cmp` of the
fixture against the unmodified route, and a genuine hosted RED in run `38824154830`.
That run failed on the intended missing route additions, helper entry and stylesheet.
Before the RED, the baseline, mutation and caller checks passed and production code was
unchanged. The three production files are now written. Nothing has been run against
them yet. Hermes owns the tests, Git and hosted CI. This document claims no GREEN
result, count, runtime behaviour or clinical fidelity until Hermes records one here.

| Role | Owner |
|---|---|
| Slice owner, commands, Git, hosted CI | Hermes |
| Implementer | Claude |
| Independent reviewer | Codex |

Allocation: 1 of 2, rotated from PR77. Branch `OPEMR-4-active-reminders-document`,
based on fork master `18647270`. The PR targets fork `master`, and its title and every
commit use uppercase `OPEMR-4`. This slice does not merge, deploy, or touch the database
or cron.

## Scope

The route is `interface/patient_file/reminder/active_reminder_popup.php` (72 lines). It opens from
`demographics.php` `openReminderPopup()` as a 500×250 `dlgopen` iframe. That dialog adds its own
Close button, and the route has its own original Close anchor (`dlgclose(); return false;`).

This slice changes presentation only, and only when the route is inside an active workbench
popup. On screen, the body becomes a canvas and the existing contents sit on one paper sheet.
The heading table, its cells and the title get paired ink and surface colours. Everything
else stays as it is:

- the original table, title, Close control and raw reminder HTML
- typography, the Bootstrap button, and the warning and due-status semantic colours
- legacy (direct) and print rendering

Six files are reserved. The tests-first commit wrote the last three. The implementation
phase wrote the first three:

1. `interface/patient_file/reminder/active_reminder_popup.php` (edited: the five planned additions)
2. `src/Common/Assets/ClinicalWorkspaceAssets.php`: registers `active-reminders-popup.css` first in the sorted list (edited)
3. `interface/clinical-workspace/active-reminders-popup.css` (created)
4. `tests/js/active-reminders-popup.test.js`
5. `tests/clinical-ui/fixtures/active-reminders-original.txt`, which must be byte-identical to the original route
6. `docs/clinical-ui/ACTIVE-REMINDERS-POPUP.md`

The shared `workspace.css` is **not** linked. Neither is `mode.js`. `demographics.php` is not edited.

## Planned route additions (exact; each anchor occurs once)

| # | Original anchor | Presented |
|---|---|---|
| 1 | `use OpenEMR\Core\Header;` | adds `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;` before it |
| 2 | `<?php Header::setupHeader('opener'); ?>` then `</head>` | adds `$clinicalAssets = new ClinicalWorkspaceAssets();` and one `<link rel="stylesheet" media="screen" …/active-reminders-popup.css?v=…version('active-reminders-popup.css')…>` using the existing `OEGlobalsBag` import |
| 3 | `<body class="body_top">` | `<body class="body_top oe-active-reminders">`, then `<div class="oe-reminders-sheet">` |
| 4 | `<table class="table border-0">` | `<table class="table border-0 oe-reminders-heading">` |
| 5 | `echo $active_alerts;` `?>` `</body>` | closes the wrapper with `</div>` before `</body>` |

No PHP logic changes, and no original node, whitespace, script or clinical call is
reordered or removed. The test file declares these five additions and their exact
inverse. Restoring the presented route must reproduce the fixture byte for byte.

Two caveats:

- The wrapper `<div class="oe-reminders-sheet">` adds a new ancestor around every original
  body child. The nodes keep their order, but their parent changes. A theme or script
  selector that depends on direct `body >` children would no longer match them.
  This slice found no such selector in the route itself; theme stylesheets were not audited.
- The wrapper is a block container on every page, including legacy and print, even though
  its styling is screen-and-popup only. Containment can change geometry: margin collapsing,
  floats and the width the original table resolves against. No layout equivalence is claimed.

## Stylesheet (as implemented; tests not yet run against it)

Everything sits in one top-level `@media screen` block. Every selector starts with
`html.oe-workbench-context.oe-workbench-popup body.oe-active-reminders`.

- body: `color` ink, `background-color` canvas
- `.oe-reminders-sheet`: ink on paper, `1px solid` line border, `12px 14px` padding, `6px` radius, `overflow-wrap: anywhere`
- `.oe-reminders-heading` and `.oe-reminders-heading td`: ink on paper
- `.oe-reminders-heading .title`: ink, `background-color: transparent`, because a theme may give `.title` its own explicit ink
- `#close:focus` and, as a separate rule, `#close:focus-visible`: `2px` petrol `outline` and `2px` `outline-offset` only. The `:focus` rule is the fallback; keeping it separate means an engine that rejects `:focus-visible` cannot drop it. In engines with `:focus-visible`, the fallback also shows on pointer focus.

The colour tokens are the existing `--oe-wb-*` palette. Every use takes a literal fallback
equal to the `popup.css` value: ink `#17343b`, canvas `#f3f7f5`, paper `#fff`, line
`#d9e4e2`, petrol `#086878`. The sheet does **not** have any of these:

- `!important`
- custom-property declarations
- fonts or other typography properties
- rules on `span`, `b`, `a`, `.btn`, `.alert`, `.text-*` or `.bg-*`
- `display`, `visibility`, `opacity`, `position`, `overflow`, heights, `white-space`
- removed outlines
- width queries, print rules or `@import`

The padding and border are new geometry. They do not show the content fits a 500×250 frame.

**Why there is no `!important`.** Source reading only: the theme's `.body_top` rule sets
`background: var(--light)` at normal priority. The tab-container rule that does use
`!important` is scoped to `#mainBox > .body_top`, which does not match this document's own
`<body>` inside the dialog iframe. On that reading the scoped selector outranks the theme
without `!important`. The actual runtime cascade and the compiled themes have not been
checked, so this is not established.

## Test design (`tests/js/active-reminders-popup.test.js`)

These run through the normal hosted Jest config with existing dependencies
(`postcss`, the jsdom environment). Nothing was run locally.

**Should pass before and after implementation**

- The fixture is 72 lines with LF endings, ends `</body>\n</html>\n`, and has no workbench classes, link or import.
- Applying the five additions to the fixture and then the exact inverse round-trips byte for byte. The additions add exactly five lines.
- Negative behaviour mutations: 25 single-occurrence anchors, each checked in the fixture and the presented text, and each detected after inverse. They cover:
  - the session pid default and `authUser`
  - the `globals.php` and `clinical_rules.php` includes
  - `Header::setupHeader('opener')`
  - the conditional `enable_allergy_check` and the `allergy_conflict(..., 'all', ...)` call
  - `active_alert_summary(..., "reminders-due", ...)`, with no `test=true` allowed
  - all three conditional headings
  - `xlt` and `text` escaping
  - raw `echo $active_alerts`
  - the Close anchor's `href`, `id`, class, `dlgclose(); return false;` and label
- Presentation mutations are rejected: `media="all"`, a missing version, a `workspace.css` link, a dropped `body_top`, extra roles or classes, a misplaced wrapper, a stray edit, and a dropped or duplicated edit.
- Protected behaviour holds on both the fixture and the current route. The route must not read new superglobals, `filter_input` or `CurrentRequest`.
- The caller (`demographics.php`, not edited) still opens the 500×250 iframe with its own Close, the hidden `#reminder_popup_link`, and two `openReminderPopup();` call sites. Its dashboard probe keeps `test=true`.

**Intended RED before implementation (missing presentation only)**

- The route equals the fixture plus exactly the five additions. The inverse restores the fixture.
- The route links one versioned screen-only sheet, with no `workspace.css` or `mode.js`.
- The helper's `SUPPORTED` list equals the 24 base entries plus `active-reminders-popup.css`, strictly sorted with no duplicates, and keeps `in_array(..., true)`.
- Each stylesheet test fails with the single readable message `…active-reminders-popup.css is not present yet (intended RED…)`, not a file-system stack. These tests cover scope, the screen-only block, token fallbacks, paired ink, typography and semantic exclusions, separate focus rules, and no hidden or clipped content.
- The source cascade (jsdom, plus `popup.css`, plus a **synthetic** explicit-ink theme stand-in) checks three things:
  - canvas body, paper sheet, and ink heading, cells and title
  - inline `red`, `purple` and `green` due spans, plan text and the Close button untouched
  - the sheet is inert on a legacy page, in context without popup, and in popup without context

The cascade resolves values. It does not render them, so it is not a native contrast test.

Limits of the test design:

- While the stylesheet is missing, every stylesheet and cascade test fails on the same
  missing-file message. The hosted RED therefore shows the file was absent. It does not
  show that each test separately detects its own defect.
- The negative controls are source mutations. They prove the inverse catches each change.
  They do not exercise native behaviour, such as whether `dlgclose()` closes the dialog,
  whether the alert log is written, or how a real theme renders.

## Security preflight (source-verified, not re-proved here)

Read from `library/clinical_rules.php`:

- `active_alert_summary` (lines 272–281) calls `compare_log_alerts` when `enable_alert_log` is on and `test` is false.
- `allergy_conflict` (lines 365–366) does the same.

Opening this route can therefore **write alert-log rows**. This slice authorises no runtime GET or POST
and makes no `test=true` change. The implementation leaves both calls byte-identical, so
they keep their default `test=false`. The dashboard probe already uses `test=true`. No live
endpoint GET or POST, and no database QA, was done for this slice.

Authentication comes from `globals.php` and the session. The route has no explicit patient
ACL check of its own. This slice does not claim any authorisation property is newly proved.

## Acceptance states

States: **Not started**, **Written (unexecuted)**, **RED recorded**, **GREEN recorded**, **Reviewed**, **Accepted**.

| Item | State |
|---|---|
| Fixture byte-identity to route at `18647270` | Controller `cmp` PASS (Hermes) |
| Jest file through hosted config | RED recorded at `137ec909` |
| Intended RED (route, helper, CSS, cascade) | RED recorded: hosted run `38824154830` at `137ec909`, failing on the missing route additions, helper entry and stylesheet. Baseline, mutation and caller checks passed beforehand, with production unchanged |
| Implementation of route, helper and CSS | Written (unexecuted) |
| GREEN, lint (`lint:js`, stylelint), `php -l`, PHPStan, phpcs | Not started (Hermes) |
| Independent review (Codex) | Not started |

**Pending. Not claimed by any test in this slice:**

- native compiled themes (light, dark, solar and others): real `.body_top`, `.table` and `.title` declarations and native contrast
- keyboard-only Close and visible focus in real engines
- long labels
- direct legacy route, and 500×250 direct and resized
- RTL and print legacy
- real warnings, with allergy conflicts and every due status
- both Close paths: the route anchor and the dialog button
- roles and announcements
- deployed check
- clinician review and researched-fidelity review
