# Global Message and Reminder Center: workbench presentation slice

This is the staff Message/Reminder Center at `interface/main/messages/messages.php`. It is not the patient notes pages (`pnotes_full*.php`), which are covered in [PATIENT-MESSAGES.md](PATIENT-MESSAGES.md). The base is `5619373`.

It adapts the default message board to the accepted research composition, within these limits: screen only, active workbench only, presentation only. It does not implement or accept any of the 22 requested features, and it changes nothing in the acceptance register ([DESIGN-FIDELITY.md](DESIGN-FIDELITY.md)). The All menus control was retired, and this slice does not add it.

## What changed

| File | Change |
|------|--------|
| `interface/main/messages/messages.php` | Adds one `use` line. Adds a four-line asset block just before `</head>`, inside the default (non-`go`) branch. Adds a body class: `body_top` becomes `body_top oe-clinical-global-messages`. Adds four selection-class lines, each directly after an original row-painting line (see below). |
| `src/Common/Assets/ClinicalWorkspaceAssets.php` | Adds `'global-messages.css'` to the supported list. No new logic. |
| `interface/clinical-workspace/global-messages.css` | New stylesheet. Every rule is inside `@media screen` and scoped to `body.oe-clinical-workspace.oe-clinical-global-messages`. |
| `tests/js/clinical-global-messages.test.js` | Jest contracts: source baseline, CSS and mode controller. 27 tests: 7 PHP-source, 10 CSS-contract, 8 composer, 2 mode-controller. |
| `tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php` | Two new cases (per-file version, shipped file) and one near-miss rejection case (`global_messages.css`). |

The page loads its assets the same way as the other routes: `workspace.css` (`media="screen"`, because that sheet is not media-scoped internally), then `global-messages.css`, then `mode.js` (`defer`). Each URL is `attr(webroot)` plus `?v=attr_url($clinicalAssets->version(...))`. No served link expression uses `filemtime`, `__DIR__` or `v_js_includes`.

`mode.js` adds `oe-clinical-workspace` only when a same-origin ancestor body has `workbench-active`. In the legacy shell, on direct loads and in print, the page keeps its current presentation.

## Boundaries

- **MedEx `go=` branches are unchanged.** The asset block sits after `//original message.php stuff`. A test checks that the `go` branch region contains no workspace reference. MedEx navigation output, `SMS_bot` exits and the setup, addRecall, Recalls, Preferences and icons pages never load the sheet.
- **PHP logic is preserved.** A Jest test removes exactly the permitted additions and checks that the result hashes to the base file's sha256 (`d484fb65…ebc8b`). The permitted additions are the use line, the asset block, the body-class change and the four selection lines, and each selection line is only removed when it directly follows its original line. That covers every SQL statement, ACL check, session call, CSRF token, `$_REQUEST` read, task switch, handler and dialog.
- **Control identity and order are checked separately.** The test also checks the 65 `id`/`name` attributes in order and the counts of 32 tokens (handlers, buttons, tabs, includes, `exit`, `<title>`).
- **Row selection uses an explicit class, toggled by the original handlers.** These are four additive lines, each placed directly after an original row-painting line. The original lines are untouched.

  | Handler | Original line kept | Added line |
  |---------|--------------------|------------|
  | `selectRow()` | `style.background = "var(--gray200)"` | `classList.add('oe-message-selected')` |
  | `deselectRow()` | `style.background = "var(--light)"` | `classList.remove('oe-message-selected')` |
  | `selectAll()` on, PHP echo per row | `…checked=true; …style.background='var(--gray200)';` | `echo …classList.add('oe-message-selected');` |
  | `selectAll()` off, PHP echo per row | `…checked=false; …style.background='var(--light)';` | `echo …classList.remove('oe-message-selected');` |

  The test pins what did not change at their baseline counts: `style.background` (4), `checked=true`/`checked=false` (1 each) and `addEventListener` (2). No selection logic was replaced and no event handlers were added. The CSS tints `.messages-item-row.oe-message-selected > td` (`#e4f0f1`, ink). It contains no `:has()`, so the cue works in the declared older browsers. Legacy CSS has no rule for the class, so legacy rows look exactly as before.
- **Only the Messages pane is restyled.**
  - **Messages pane:** `#messages-div` is the paper sheet. `display` is never set on any pane, so Bootstrap still owns tab visibility.
  - **Reminders, Recalls and SMS panes** (`#reminders-div`, `#recalls-div`, `#sms-div`) are not painted as sheets. `workspace.css` still applies its generic body canvas/ink, ink `h4` and petrol links in workbench mode, so these panes are explicitly put back on the theme's own pair:
    - background `var(--white)` with text `var(--body-color)`;
    - `h4` and `a:not(.btn)` in `var(--body-color)`;
    - `a.btn-secondary` as a theme pair: text `var(--body-color)` on background `var(--gray200)`. In the light theme this is exactly the button the theme draws: its final rule is `#111827` on `#e5e7eb`. In the dark theme it is `#f8f9fa` on `#343a40`, not the theme's own `#212529` on `#f8f9fa`, because no single theme variable gives the button's text colour in both themes.
      - This replaced a text-only `var(--white)` rule that native QA measured at 1.24:1 in light (legacy 14.33:1); see "Native QA regression fix" below.
      - A Jest guard now fails any rule in these panes that sets a button's text colour without its background.

    No `--oe-*` token or literal colour reaches these panes. This keeps `dated_reminders.php`'s `.text-body` progress text readable: `#f8f9fa !important` on the dark theme's `#000` surface.
- **Layout:**
  - **Heading:** the existing `OemrUI` heading becomes a 28px/650 title on a transparent background. It wraps long translations with `overflow-wrap: anywhere`.
  - **Toolbars:** the tabs, the filter row (My Messages + See All/Just Mine + All/Active/Inactive) and the action row (Add New, Delete, optional Direct buttons, pager) are wrapping flex rows.
  - **Current filter:** the disabled span for the current filter becomes an ink-on-pale chip.
- **The original table scrolls horizontally.** The outer layout table gets `table-layout: fixed`. `#MessageList` gets `overflow-x: auto; max-width: 100%`. The inner table gets `min-width: 640px`. Nothing is hidden: the stylesheet contains no `display: none`, `visibility: hidden`, `opacity: 0` or width media queries.
- **Dark compiled theme:** every surface painted light in the Messages pane also sets its own ink (sheet, table, `th`, `td`, hover, selected cells, tabs, compose jumbotron, `#messages-div a.btn-secondary`).
  - **`!important` overrides:** exactly six, each needed to beat a theme `!important` utility, and test-enumerated: the heading `.bg-light` background, the tab `.bg-light` background, the See All/Just Mine icon's `.text-body` colour, the compose sheet's `.p-2` padding, and `#note`'s `.text-dark` colour and `.bg-light` background (forced together as one pair).
- **Danger and status colours are preserved.** No selector targets `.text-danger`, `.bg-*`, `.text-muted` or `.btn-delete`. The only `btn-danger` rule is `#messages-div a.btn-danger { color: #fff }`, which undoes `workspace.css`'s petrol link colour. The read-only `bg-dark` note history keeps its theme pair; composer fields set their own pair (below).
- **Document-style composer (`#new_note` > `.jumbotron`, `task=addnew|edit`).** CSS only; every control, label, hidden input, handler and value stays in its original element and order.
  - **Sheet:** paper/ink with document padding `1.5rem clamp(0.75rem, 4vw, 2.25rem)`; the legend `h4` is a 24px/650 title over a line rule (reference `.doc` / `.doc-title`).
  - **Labels and fields:** labels are ink on paper, weight 600, theme size (so `.oe-empty-label` spacers still align the Clear buttons). `.form-control` fields set ink on paper, the reference `#a9bbc3` border, `height: auto; min-height: 40px`. Only `background-color` is set, so the patient picker's `.oe-patient-background` image survives.
  - **Focus:** `.form-control:focus` restates ink on paper (the dark theme's own focus rule otherwise repaints it), petrol border and the reference `3px solid #b65020` ring.
  - **Placeholders:** `.form-control::placeholder` is `var(--oe-muted, #526a70)` at `opacity: 1` (5.75:1 on paper). The dark theme's pale grey hint was 1.49:1 on the paper fields (patient/recipient). Focus keeps paper, so one rule covers both states. It is scoped to the composer.
  - **Note:** `#note` is a ruled writing surface: ink on paper, bottom border only, 14px/1.7, `min-height: 10rem`. `resize` is untouched.
  - **Narrow widths:** metadata columns are `flex: 1 1 11rem; max-width: 100%; min-width: 0` (the Clear column keeps its button width), so fields wrap to full rows instead of squeezing into `col-6` halves. Send/Print/Cancel are a wrapping footer under a line rule, `min-height: 38px`, `white-space: normal`; theme button colours are untouched.
- **Stylelint:** no width queries, so the `media-feature-range-notation` prefix allowlist and `clinical-calendar-stylelint.test.js` are unchanged. The new file passes the repo `.stylelintrc.json`.

## Test evidence

Jest command (existing shared dependencies, no install or symlinks):

```
D=/Users/craig/.hermes/workspaces/openemr-researched-work-areas/node_modules
NODE_PATH=$D node $D/jest/bin/jest.js --rootDir "$PWD" --runInBand tests/js/clinical-global-messages.test.js
```

### Original RED (before any source change; first version, 18 tests)

```
Tests:       14 failed, 4 passed, 18 total
```

- **CSS-contract tests:** all **10** failed with ENOENT for `global-messages.css`. An earlier version of this document said 12; that was wrong.
- **PHP-wiring tests:** 4 failed because the import, asset block and body class were missing.
- **The 4 that passed** are guards that had to hold before and after the change: body-class distinctness, control counts/order, and the two `mode.js` controller tests.
- **Helper RED (host PHP, no vendor):** `version('global-messages.css')` threw `InvalidArgumentException: Unsupported clinical workspace asset`.

### Original GREEN

- **New suite, first run:** `1 failed, 17 passed`. The failure was a flaw in the test: the pane-`display` regex `-div(\s|$)` also matched the action toolbar *inside* the pane. It was narrowed to selectors whose subject is a pane.
- **Stylelint, first run:** 2 `no-descending-specificity` errors. Fixed by reordering the `#pageHeadingNav .nav-link` rule. Stylelint now exits 0.
- **Then:** 5 suites, 74 tests passed. `php -l` was clean, and the helper returned the shipped file's mtime and rejected the near-miss name.

### Corrected RED (independent review: two P2 findings)

The review found two P2 issues:

1. Painting every pane white made the dark theme's `.text-body` reminder progress text about 1.05:1 against white.
2. Selection relied on `:has()` only, so declared older browsers lost the row cue.

The tests were changed first. The suite went from 18 to 20 tests:

- **Hash normalization:** now strips the four exact selection lines, each only directly after its original line.
- **New test:** selection-class counts, with the original painting, checks and listeners pinned.
- **Pane rule:** only `#messages-div` may be painted, and no `.tab-pane`/`#content` selectors are allowed.
- **New test:** the other panes get `var(--white)`/`var(--body-color)` and no workspace tokens.
- **Selected rule:** must be `.oe-message-selected`, with no `:has(`.
- **Danger/secondary rules:** must be scoped to `#messages-div`.

Output saved externally as `verification/cron-global-messages/red2-jest.txt`:

```
Tests:       6 failed, 14 passed, 20 total
```

The 6 failures were exactly the two hash/selection wiring tests and four CSS tests (Messages-only pane, theme-surface panes, selected-row class, danger/secondary scope).

### Corrected GREEN

- **Source fix:** four additive selection lines, plus CSS narrowed to `#messages-div` with theme-pair restoration for the other three panes.
- **Targeted run** (`green2-jest.txt`): 5 suites, **76 tests passed**. That is the new suite's 20 plus patient-messages, calendar-stylelint, workspace and finder.
- **Stylelint:** exit 0 (`green2-stylelint.txt`).
- **`php -l`:** clean.
- **Controller full Jest:** 48 suites, 957 tests passed.

## Native offline harness (external, not committed)

The harness is `/Users/craig/.hermes/projects/openemr/verification/cron-global-messages/qa.py`. Its own docstring describes it; in summary:

**What it renders**
- It executes the real `messages.php` on host PHP, both the git `5619373` baseline and the patched file.
- OpenEMR's bootstrap and helpers are replaced by labelled doubles in `doubles/`. They supply synthetic rows and flags, and mutating helpers throw.
- It keeps the page's own board markup and the original `selectRow`/`deselectRow`/`selectAll` scripts.
- It uses the real compiled light and dark themes, built from the worktree SCSS. Their sha256s are pinned in the report.

**What it checks**
- Control identity and order.
- Legacy and print equality with the baseline, element by element (geometry and computed CSS).
- Page overflow, local table scrolling and toolbar bounds.
- Contrast, including selected cells and reminder progress text, and theme danger colours.
- Real-click selection, select-all and deselection.
- Draft retention across workbench/legacy toggles.

**Safety**
- Every network request is aborted, never fulfilled.
- The guard is proven by an external canary (`http://gm-canary.invalid/qa-probe`) dispatched from inside the fixture frame. The harness waits for Chrome to pause it, aborts it, and requires the page's `fetch` to reject. An empty abort list counts as unverified.
- Submit, `requestSubmit`, `window.open`, `alert` and `confirm` are guarded before any page script runs.
- The run is FAILED on any exception, budget overrun, cleanup problem or leftover Chrome process.

**Result status**
- The author's earlier, broader attempt (`native-qa.py`) was killed with exit 137 before it produced output. It is not evidence.
- The controller's first `qa.py` run (Chrome 154) reported **FAILED: 226 passed, 40 failed**. That entire output is preserved unchanged in `qa-first-failed/`; the corrections are described in the next section.
- The controller's rerun after the corrections below reported **268 checks passed**. It used the real PHP fixture render and Chrome, and covered legacy and print equality, control identity, selection, draft retention and the repaired strict contrast checks.
- It is fixture-only evidence, not authenticated or deployed acceptance. The missing-jQuery `ReferenceError`s are fixture exceptions. They are reported raw under `fixtureExceptions` in the report and do not count as acceptance.

## Native QA regression fix (after the first `qa.py` run)

The first run's 40 failures fell into five groups:

1. **Product regression (4 failures, real).** In the light reminders pane, the `View Log`, `Forward` and `Set As Completed` buttons measured 1.24:1 (legacy 14.33:1).
   - Cause: my text-only `a.btn-secondary { color: var(--white) }` put `#fff` on the light theme's final `.btn-secondary` background `#e5e7eb`.
   - **RED** (`red3-jest.txt`): the pane test was changed to require a theme pair, and a guard was added. Result: `1 failed, 19 passed, 20 total`.
   - **Fix:** `color: var(--body-color); background-color: var(--gray200)`.
   - **GREEN, first run:** 2 test-side failures, both mine. The new guard's `/\.btn/` also matched `a:not(.btn)`; it was narrowed to selectors whose subject is a button (`a.btn…`). My CSS comment contained hex literals, which the strict hex allowlist rejected; the comment was reworded and the allowlist kept.
   - **GREEN** (`green3-jest.txt`): 5 suites, 76 tests passed. Stylelint exit 0.
   - No contrast criterion was changed.
2. **Page-exception comparison (32 failures, harness).** Baseline and patched threw the same `ReferenceError: $ is not defined`, but the raw stacks differ because the srcdoc line numbers shift.
   - The comparison is now bounded: (type, message) with counts, stacks dropped. A new error type, a new message or a different count still fails.
   - Raw stacks are kept in the failure detail and under `fixtureExceptions`.
3. **Legacy hover mismatch (1 failure, harness).** The pointer was left where the previous click happened, so a different row sat under it after the layout moved.
   - The shell now has a 24px strip above the iframe. The pointer is parked there before every snapshot or measurement, so hover state is the same for baseline and patched.
   - Clicks add the iframe offset.
   - No product change.
4. **Draft status (2 failures, harness input).** A foreground probe (`probe-select.py`) showed that in macOS headless Chrome, ArrowDown, and Space→ArrowDown→Enter, only open the popup and never commit. A typed character commits through typeahead and fires trusted `input`/`change`.
   - The harness now types `r` and requires exactly one trusted `change` event to `Read`. The draft check still requires the status to change and both values to survive the toggles.
5. **Network canary (1 failure, harness).** The old probe expected the page's own relative script URL to be aborted. Inside `about:srcdoc` that URL never resolves to a request, so the list was empty and the guard was unverified.
   - It is replaced by the external canary described under Safety. A foreground probe (`probe-canary.py`) recorded paused-and-aborted plus page rejection, with clean cleanup.

**Harness regression tests:** `test_qa.py`, 10 tests, no browser. They cover:
- false completion: an exception yields `status: FAILED`, `completed: false` and exit 1;
- `final_ok` failing on cleanup errors or check failures;
- canary verification rejecting an empty abort list, a missing page rejection, or an abort of a different URL;
- bounded exception equality: shifted lines compare equal, while a new type, a new message or a different count compare unequal;
- the guard running before any page script;
- the neutral pointer strip sitting outside the iframe.

RED was 9 errors out of 10; the guard-order test already passed because it pins existing behaviour. GREEN is OK (10/10). `qa.py --render-only` passes (9 checks, 0 errors).

## Controller verification (current)

These results are as reported by the controller; the author did not run them.

| Gate | Result |
|------|--------|
| Full Jest | 48 suites, 957 tests passed |
| Full isolated PHPUnit | 6082 tests, 16245 assertions, exit 0 (4 warnings, 24 skipped, 14 incomplete) |
| Focused asset PHPUnit | 33 tests, 51 assertions passed |
| PHPCS (changed PHP), stylelint, targeted ESLint | 0 errors |
| Full Rector | passed, with a deprecated-rule warning |
| Full PHPStan | passed, with no suppressions or baseline entries (see note) |
| External harness unit tests (`test_qa.py`) | 10 passed, with a ResourceWarning |
| External native fixture (`qa.py`, real PHP render, Chrome) | 268 checks passed. The first failed run (226 passed, 40 failed) is preserved in `qa-first-failed/`. |
| Independent review (Codex/Astra) | final pass covered all 6 changed files plus the harness guards; no P1/P2 introduced |

The table above predates the composer slice. Final controller evidence for the composer and placeholder corrections:

| Gate | Result |
|------|--------|
| Full Jest | 48 suites, 964 tests passed |
| External harness unit tests (`test_qa.py`) | 25 passed, with the inherited ResourceWarning |
| External native fixture (`compose-placeholder-final/qa.json`, real PHP render, Chrome) | 388 passed, 0 failed, exit 0, complete. Includes the real `::placeholder` measurement, the probe, and the blurred and focused states. |
| Independent review (Codex/Astra, `openemr-compose-final-review.txt`) | no P1/P2 introduced |

**PHPStan note:** the first full run failed during setup because two ClaimRev module classes were missing. That was an environment problem, not a code one. The controller fixed it by restoring the real ignored module, rebuilding the worktree's own correctly rooted autoloader and clearing the cache. The rerun passed.

## Not done / remaining

- **State:** draft PR #41. The composer and placeholder corrections are recorded below, pending publication. They are published only when the controller does so; no commit SHA is claimed here.
- **No acceptance:** none of the 22 requested features is accepted or completed. No seeded demo rows were added, and coverage was not recounted live.
- **Fixture limits of the native evidence:**
  - Screenshots lack the icon fonts, which cannot load offline.
  - jQuery and Bootstrap JS are absent. The resulting missing-jQuery exceptions are compared by type, message and count against the baseline, and the raw stacks are kept.
  - OpenEMR roles, ACL, session and DB are doubles, not real.
- **Not covered by browser evidence:**
  - No live, authenticated or deployed run.
  - No Firefox, Safari, older or pre-`:has()` engine.
  - No RTL theme variant, zoom, long translations, assistive technology, restricted roles or full clinical workflow.
- **Reminders/Recalls/SMS colour pairing:** the restored theme pair approximates the theme's own surface. Light uses `--white` `#fff`, while the light theme body is `#f9fafb`. Theme link colours inside those panes become `--body-color`, not the theme's link blue/grey. `a.btn-secondary` matches the light theme exactly, but in dark it is `#f8f9fa` on `#343a40` rather than the theme's `#212529` on `#f8f9fa`.
- **Known residuals:**
  - The disabled pager chevron uses `.text-muted`, an `!important` utility, and stays theme-coloured. It is a decorative disabled indicator.
  - The legacy heading help icon's inline `style="color: var(--gray)"` is unchanged.
  - The legacy inline `@media (max-width: 768px)` block in `messages.php` is unchanged.
- **Compose form:** presentation slice only (see above). Not covered: the `task=edit` thread/linked-documents/procedure-order variant in a browser (the native fixture renders `task=addnew` only), the `messages_due_date` datetime field, the patient/user pickers' popups and the actual send/print round trip. Not design-fidelity acceptance.
- **Composer evidence (this slice):** Jest RED 7 failed / 18 passed, then GREEN 25/25; stylelint clean; `test_qa.py` RED 9 errors (`compose_problems` missing), then 19/19. `qa.py` adds `compose` to the light/dark x 1440/1024/390/320 matrix (legacy + print identical to baseline, inventory/reach/contrast/overflow/exceptions) plus a composer gate (controls inside the sheet, button labels unclipped and >= 38px, fields >= min(140px, 90% of sheet), note >= 14px/1.5, >= 120px tall, >= 80% sheet width, >= 4.5:1, every visible field focused with an indicator at >= 4.5:1). Only `--render-only` was run here (PASS, 9/9); the browser matrix is for the controller to run.
- **Composer native runs (controller, before the placeholder correction):** the first run (`compose-qa/qa.json`) was 380 passed, 8 failed. The failures were the patient/user Clear (`.btn-undo`) buttons at 36px. After the full-size button rule, `compose-final/qa.json` was 388 passed, 0 failed. Both are offline fixture runs. Neither measured `::placeholder`, so they predate and do not cover the correction below.
- **Placeholder correction (review P2, after the 388/0 run):**
  - **Jest:** RED 1 failed / 26 passed, then GREEN 27/27. The full `tests/js` run is 38 suites, 899 tests passed. Stylelint is clean.
  - **`test_qa.py`:** RED 5 failed + 1 error (19 prior passed), then 25/25.
  - **`qa.py` gate:** for every composer `.form-control` with a non-empty placeholder and empty value, the gate reads the computed `::placeholder` colour and opacity over the field's backdrop. It does this blurred and after a real `focus()`. Both states must reach >= 4.5:1, and every field must have both states.
  - **Probe:** a probe input with a known `::placeholder` style must read back, or the gate fails. An engine that ignores the pseudo-element cannot pass silently.
  - **Runs (author):** only `--render-only` was rerun (PASS, 9/9).
- **Superseded:** the "no native run yet" and "predate the correction" statements above are superseded by the controller's final run, `compose-placeholder-final/qa.json`: 388 passed, 0 failed, exit 0, measuring real `::placeholder` with the probe, blurred and focused (see the final controller table).
- **Fixture screenshot limits (final run):** the fixture is not authenticated or deployed. Missing icon fonts still show as squares, and the recipient field's single-line hint is still visibly truncated at 320px.
- **Not covered by the final run:** send, edit, role and database behaviour. None of these is accepted.
- **No acceptance claim:** this is not design-fidelity or full-fidelity acceptance, clinical acceptance, send/edit/role/database acceptance, or deployment evidence.
