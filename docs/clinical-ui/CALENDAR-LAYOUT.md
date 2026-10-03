# Calendar workbench layout repair

## Outcome

The desktop toolbar overflow and the mini-calendar horizontal scroll are fixed in `interface/clinical-workspace/calendar.css`. The live geometry QA passes with the worktree CSS (sha `87363c6486b4`). The CSS is **not deployed**: the QA disables the deployed stylesheet in its own headless browser and injects the worktree file. Nothing is saved or submitted beyond read-only Day/Week/Month, previous/next and Today navigation.

This is a layout fix only. It does not change accessibility, roles, or backend behaviour, and it does not claim any. The remaining gaps are listed below.

## Defects (RED)

These were measured live against the deployed `calendar.css` (sha `149cb71482d0`, same as HEAD). Logs are in `~/.hermes/projects/openemr/calendar-layout-tdd/qa-baseline.txt`. In Day, Week and Month at 1440×1000 (the workbench frame is 946px wide):

- `#viewPicker` (print, refresh, Day, Week, Month) wrapped onto 2 rows, so the toolbar buttons sat on 2 rows. The toolbar was 85px tall.
- The mini calendar scrolled horizontally (scrollWidth 170 > clientWidth 156). Column 7 of every row, and the month-name cell, sat outside the visible area and outside the `#datePicker` panel.

A later review asked for testing in the 768–945px frame band. The first band run (`qa-feature-band-rtl.txt`) found a regression in the first version of the fix. At outer 1280 (786px frame), Day and Week had `#dateNAV` squeezed to 302px. The date heading wrapped onto 2 lines and the next chevron dropped below the previous one. This did not happen with the deployed CSS, so the fix had introduced it. The same thing happened at 1440 when the Today button was shown with a long date.

Jest RED runs (all in the log directory):

- `red.txt`: 3 failed, 29 passed (initial assertions).
- `red2-width.txt`: 1 failed. This run caught that `flex: 0 1 auto` alone still picks up Bootstrap's `width: 100%` from `col-md-*`.
- `red-attempt1-invalid-fixture-expectation.txt`: an earlier draft that expected date rows in the empty fixtures. It was replaced by the row-agnostic seven-column check.
- `red-group-wrap.txt`: 1 failed, 34 passed. The amended toolbar contract failed before the band fix below was written.
- `red-stylelint-guard-no-override.txt`: with the `.stylelintrc.json` override removed, all 3 stylelint guard tests fail.

A rejected attempt (`red-datenav-nowrap.txt`, then `qa-feature-band-rtl-2.txt`) used `white-space: nowrap` on `#dateNAV`. It broke the existing typography contract test. Live, `#viewPicker` wrapped to the left edge of the second row, under the fixed sidebar ("print/Refresh/Day covered", "fixed sidebar overlaps toolbar controls"). It was reverted.

## Fix (GREEN)

All of the following apply from 768px up only, using prefix media notation:

- `#functions` and `#viewPicker` size to their content: `flex: 0 1 auto; width: auto; max-width: none`.
- `#dateNAV` is `flex: 1 0 auto; width: auto; max-width: none`. It takes the remaining width and never shrinks below its own heading and chevrons.
- When the three groups cannot share one row, whole groups wrap using the theme's existing `flex-wrap`, and nothing inside a group wraps. `#viewPicker` has `margin-inline-start: auto`, so on its own row it sits at the end edge, clear of the fixed sidebar.
- Below 768px the theme's stacked layout is unchanged, because the `#bottomLeft` offsets depend on it.
- `#datePicker table` uses `table-layout: fixed`, and the cells have no horizontal padding, so the seven columns share the panel width.
- No font size, `white-space`, overflow, hiding, clipping or transform is used.

Stylelint: `.stylelintrc.json` has a single-file override that sets `media-feature-range-notation: "prefix"` for `interface/clinical-workspace/calendar.css` only. The inline `stylelint-disable` comment has been removed. Every other file keeps the shared `"context"` setting.

## Evidence (current run)

- **Jest, focused** (`green-group-wrap.txt`): `clinical-calendar.test.js` passes 35/35. The new guards are:
  - the exact override in `.stylelintrc.json`
  - no `stylelint-disable` in `calendar.css`
  - the real stylelint CLI, run on `calendar.css` with the repo config, accepts `@media (min-width: 768px)` and rejects `@media (width >= 768px)` with `Expected "prefix"`
- **stylelint CLI** (`stylelint-override.txt`): `calendar.css` exits 0. By hand, piping range syntax under the `calendar.css` filename fails with `Expected "prefix"`. Prefix syntax under a sibling filename fails with `Expected "context"`, which shows the override applies to this one file.
- **Jest, full suite**: controller reran the final source: 27 suites / 436 tests passed (`full-js-controller-final.txt`).
- **ESLint**: controller checked the changed test with the byte-identical shared config: zero errors, one inherited `__dirname` warning. No new warning suppressed.
- **Live QA, feature mode** (`qa-feature-group-wrap.txt`, `browser-qa/calendar-layout-feature.json`): `stage: complete`, `ok: true`, `RESULT PASS`, `legacy_inert: true`. Deployed sha `149cb71482d0` = HEAD.

| Case | Frame | Toolbar rows | `#viewPicker` rows | Date heading lines |
|---|---|---|---|---|
| Day/Week/Month @1440, before and after a legacy round trip | 946 | 1 | 1 | 1 |
| Day/Week/Month @1366 | 872 | 1 | 1 | 1 |
| Month @1280 | 786 | 1 | 1 | 1 |
| Day/Week @1280 (groups need 856/867px) | 786 | 2 (`#viewPicker` right-aligned on row 2) | 1 | 1 |
| Today shown @1440, Day/Week/Month (need 914/906/820px) | 946 | 1 | 1 | 1 |
| Today shown @1280, Day/Week/Month | 786 | 2 | 1 | 1 |
| Simulated RTL @1440, Day/Week/Month | 946 | 1 | 1 | 1 |
| Simulated RTL @1280, Month | 786 | 1 | 1 | 1 |
| Simulated RTL @1280, Day/Week | 786 | 2 (`#viewPicker` at the end edge) | 1 | 1 |

In every case above:

- every toolbar control is shown, unoverlapped, inside the toolbar and frame, and hit-testable at its centre
- both date chevrons are on one line, and the date heading is not clipped and does not overlap a chevron
- no button label is clipped
- the mini calendar shows 7 columns with no scroll, and every cell is inside the panel
- the fixed sidebar does not occlude anything
- the known `#menu-toggle` failure is still present

The 1024, 820 and 390 widths also pass, including with the sidebar toggled open.

## What the QA asserts

`~/.hermes/projects/openemr/browser-qa/verify_calendar_layout.py` (external, not in the repo):

- **1440 default and legacy round trip.** One toolbar row is required, with no exception, plus every check that existed before.
- **Band, Today and RTL probes.** These cover outer 1366×768 and 1280×800 (`band`, which asserts the frame is 768–945px wide), the Today-shown state, and simulated RTL, at 1440 and 1280. They keep every desktop assertion with one exception: more than one toolbar row is accepted only when the measured content widths cannot fit in one row (`#functions` + `#viewPicker` + `#dateNAV` contents and padding > toolbar width). If the groups fit and still wrap, it fails.
- **Always absolute in all of these:** a one-row `#viewPicker`, chevrons on one line, a one-line unclipped date heading, no clipped button labels, no overlap or off-screen controls, toolbar and frame containment, mini-calendar containment, and no fixed-sidebar occlusion.
- **Today control.** The probe verifies Today is absent on today, follows the next chevron (read-only), requires Today to be rendered, measures, then clicks the actual Today control (`GoToToday`, a read-only view submit) and requires it to return to today.
- **RTL.** The direction is simulated: `body dir=rtl` and `direction: rtl` are set temporarily in the QA browser and restored afterwards. This is **not** a translated RTL locale, and the theme's real RTL stylesheet is not exercised.

Harness corrections from earlier passes are still in place:

- legacy equality is computed on the rendered state, not on the harness's injection state
- the harness waits for transitions to finish before legacy snapshots
- `#menu-toggle` is reported as a known pre-existing failure only while it also reproduces with the deployed CSS
- the stage, `ok` and a stale-`.PASS` cleanup are recorded

## Remaining gaps (not addressed here)

- **Accessibility:** `#menu-toggle` has no accessible name. This is a known failure at all widths and has not been fixed.
- **Mobile, below 768px (theme layout, unchanged by this CSS):**
  - With the sidebar toggled open at 820 (Day, Week) and 390 (Week), the fixed `#bottomLeft` sidebar covers print, Refresh, Day, Week and Month. These are pre-existing warnings that also occur with the deployed CSS.
  - With the sidebar closed at 390, `#viewPicker` can wrap onto 2 rows depending on the length of the date label. In this run that was Day and Month; an earlier run on a different date saw Week and Month.
  - Row counts are not asserted below 768px.
- **Real RTL locale:** this has only been simulated, as described above.
- **Roles and semantics:** the toolbar groups, the view picker (the current view is shown only by a border) and the mini-calendar table have no landmark, toolbar or grid roles and no `aria-current`. None of this was tested or changed.
- **Task-led and backend work:** this repair is presentational. Provider/facility filtering, appointment workflows and any PostCalendar backend behaviour are not covered.
- **Deployment:** after deploy, re-run `verify_calendar_layout.py baseline` and check that the served CSS sha matches the worktree's (`87363c6486b4`).
