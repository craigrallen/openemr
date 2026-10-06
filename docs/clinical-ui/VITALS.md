# Vitals form: workbench document/table presentation

Status: **proposed, pending review.** Not merged or deployed. This slice does not complete
full design fidelity, and it does not accept any existing feature or any of the 22 feature
criteria.

## What changes

The existing Vitals encounter form (`interface/forms/vitals/`) gets a white paper-sheet
presentation when it opens inside an active workbench. It follows the document/table
direction of the accepted research reference. Outside the workbench, and in print, the
stylesheet rules that apply are the same as before.

Template (markup only, `vitals.html.twig` and `vitals_historical_values_complete.html.twig`):

- `<body class="oe-clinical-vitals">` as a route hook.
- Loads the existing, unchanged `interface/clinical-workspace/mode.js`. It adds
  `oe-clinical-workspace` only while a same-origin ancestor body has `workbench-active`.
- `vitals.css` and `mode.js` use the explicit version token `assetVersion-vitals-document-3` (bumped from `-1` when the
  observation-date rule below changed `vitals.css` after the first published head, and from `-2` when the Other Notes
  and history-header rules changed it again). Both consumers in `vitals.html.twig` carry the same token. The
  standalone history template has no notes editor and loads neither asset, so it is unchanged.
  `vitals.js` and the other shell assets are unchanged.
- The measurement table and the history table each sit in a named, keyboard-focusable scroll
  region (`#vitals-measurements` "Vitals", `#vitals-history-measurements` "Vitals History";
  `role="region"`, `tabindex="0"`). This markup applies in legacy mode too: it adds one tab
  stop before each table. Otherwise the legacy tab order is unchanged.
- The shared `workspace.css` is not loaded on this page.

CSS (appended to `vitals.css`; the original rules above it are byte-for-byte unchanged):

- Every new rule sits inside `@media screen` and is scoped to
  `body.oe-clinical-vitals.oe-clinical-workspace`. Colour tokens are defined in that scope.
- Paper/ink sheet: Arial 14px body text, a 28px main heading, and muted table headers with
  1px dividers.
- The history card and expanded reason cards are re-paired paper/ink. The compiled dark theme
  paints `.card` black. History columns are tinted.
- Petrol Save button and a petrol `:focus-visible` outline.
- The container keeps at least 15px inline padding. The nested date `.row` and the inline
  `#chart` margin rely on Bootstrap's -15px gutters.
- Observation date (`#date`, markup unchanged: still `type="text" size="14"`, same name, title,
  classes, value, date picker class and handlers): one rule for `#date` and `#date:focus` sets
  only `min-inline-size: calc(16ch + 1.5rem + 2px)`, `background-color: var(--oe-paper)` and
  `color: var(--oe-ink)`. The full 16-character `YYYY-MM-DD HH:mm` value now fits at desktop
  widths, where the auto-width column used to clip it (126px text in a 120px content box). Font
  size, padding and borders are unchanged, so the `.error`/`.warning` highlights are the same as
  baseline. The background declaration is for pairing only: the theme's `.oe-patient-background`
  forces white with `!important`, and this rule does not override it. In the dark theme the
  date text goes from 1.3:1 to 13.2:1, focused or not. Legacy and print are unchanged.
- Other Notes (`#note_input`, markup unchanged: same `textarea`, name `note`, id, `form-control` class, value, no
  `rows`/`cols`): one rule for `#note_input` and `#note_input:focus` sets only `min-inline-size: min(18rem, 75vw)`,
  `min-block-size: calc(7.5em + 0.75rem + 2px)`, `background-color: var(--oe-paper)` and `color: var(--oe-ink)`.
  Legacy measured about 164x62px (two lines); the workbench box is 288.8x134px at 1440px (five lines at the
  inherited 16px). Font, padding, borders (`.error`/`.warning`) and the vertical resize handle are unchanged.
  Contrast 13.2:1 focused or not, in both themes. At 390/320px the minimum is 75vw and the table region scrolls.
- Edit-table history date headers (`#vitals-measurements th.historicalvalues`): a separate
  `@media screen and (min-width: 1200px)` rule sets only `white-space: nowrap`. Without it the wider Notes column
  wrapped all three `YYYY-MM-DD HH:mm` headers onto two lines at 1440px. Committed `c2f4cb2` kept them on one line.
  With the rule, header lines match `c2f4cb2` (1,1,1) in light/dark and LTR/RTL, with no page or region overflow.
  Below 1200px the rule does not apply. At 768px the headers wrap to three lines inside the scrolling region.
  That case was not compared against `c2f4cb2`.
- The heading column sizes to its text, so the history link wraps below it on narrow screens.
- The appended rules do not hide anything or set any font size below 14px. Existing rules
  still apply, though:
  - historical columns in the edit table stay `d-none d-md-table-cell`, hidden below 768px
    as before;
  - `.vitals-warning-message` stays 0.8rem;
  - Bootstrap `small`/form sizes are not all 14px.
- `.vitals-warning-message` gets one colour-only pair: dark amber `#6b4500` on `#fff4d6`
  (7.74:1).
  - Why: themes colour it `var(--warning)` `#ffc107`, which is about 12.88:1 on the dark theme's
    black page but 1.63:1 on the white sheet.
  - Its text, size (0.8rem), display and the input borders are unchanged.
- Not touched: `.error`, `.warning`, `.alert*`, `.unfocus`, `.valuesunfocus`, `.readonly`,
  `.hide`, `.editonly`, and form-control borders.

No change to the controller (`C_FormVitals`), `vitals.js`, `save.php`, the database, field
names/values/ids, handlers, CSRF, save/cancel, the growth chart, or the metric/USA and
pediatric logic.

## Tests (source and fixture contracts, not live acceptance)

- `tests/Tests/Isolated/Forms/Vitals/VitalsDocumentTemplateTest.php` (PHPUnit isolated, 4 tests):
  - Runs with `#[RunTestsInSeparateProcesses]` / `#[PreserveGlobalState(false)]`. It gets Twig
    from `ServiceContainer::getTwig()` and adds the vitals template directory to the
    `FilesystemLoader`.
  - Renders the real `vitals.html.twig` with stubbed `setupHeader`/`jqueryDateTimePicker` and a
    stub vitals object, not the DB-backed `FormVitals`.
  - Rows covered: weight (USA/metric conversion), BP systolic with an expanded reason card,
    BMI, BMI status, temperature location, notes, the growth-chart row (hidden), and three
    history dates.
  - Rows not covered: height, BP diastolic, pulse, respiration, temperature, SpO2, circumference
    and pediatric rows, and the runtime scripts.
  - Checks body class, versioned assets, no `workspace.css`, the regions, and the
    form/CSRF/hidden-input/save/cancel/growth-chart/reason/history-link contracts.
  - Records `fixtures/vitals-form-document.html`. Regenerate with `UPDATE_FIXTURES=1`.
- `tests/js/clinical-vitals-document.test.js` (Jest, 20 tests):
  - Source preservation: removing exactly the listed additions gives the original template
    hashes, `mode.js` is unchanged, and the legacy part of the stylesheet hash is unchanged.
  - Contracts on the appended declarations only: screen-only and scoped; no hiding
    declarations; no font-size below 14px; no repainted control borders or semantic surfaces.
  - The only warning rule is the colour/background pair, and its declared colours resolve to
    at least 4.5:1.
  - Cards paired paper/ink, the 15px container gutter, and the heading column sizing.
  - The observation date control is wide enough for a complete `YYYY-MM-DD HH:mm` value and
    has a paired readable colour/background, focused or not.
  - Other Notes: the exact minimum sizes and the ink/paper pair, inside `@media screen`. The
    desktop history headers: exactly one `white-space: nowrap` rule under
    `screen and (min-width: 1200px)`.
  - Rendered-fixture checks in jsdom: route class, regions, and control node identity/values
    through workbench on/off. The observation date and Other Notes controls keep their
    original attributes, value and node.

### Offline native Chrome harness (outside the repo)

Current harness: `verification/cron-vitals-notes/native-qa.py`. It extends the date harness and keeps every
earlier gate. It adds Notes geometry, value/node, contrast, resize, validation and legacy/print checks, plus a
desktop header-line gate. A second baseline compares against committed `c2f4cb2` workbench rendering: exact
fixture, `vitals.css` and `mode.js`, extracted with `git show c2f4cb2:<path>` to `baseline-c2f4cb2/`, with the
same themes, warning text, 1440px viewport and direction. Input SHA-256s and the Chrome version (154.0.8037.93)
are recorded. Final run: `ok: true`, zero failures, zero requests/submissions/errors. RED before the header rule:
4x "desktop history date headers wrap" plus 4x "candidate history header lines differ from committed c2f4cb2".
The earlier description below is of the original `cron-vitals` harness.

`verification/cron-vitals/native-qa.py` uses the installed Chrome via Playwright.

Inputs:

- The candidate fixture above, and the same data rendered through the HEAD templates
  (`render-fixtures.php`).
- Light/dark theme CSS compiled from the real `oe-styles` sources with the repo's
  `sass-bsimport-loader` and the existing `sass` package.
- Each side's `vitals.css`.
- The unchanged `mode.js`, injected once into the candidate only.

How it runs:

- All scripts and links in the rendered pages are stripped, so `vitals.js` and jQuery do not
  run. `@font-face` and `@import` are stripped too, so icons render as empty boxes.
- The page is written into a same-origin `about:blank` iframe in quirks mode, as production
  is (the template has no doctype). The parent body toggles `workbench-active`.
- Every request is aborted. A guard self-test proves the abort path catches a probe.
- RTL is effective body direction over the LTR-compiled theme, not the `rtl_*` build.
- It is not authenticated and not the deployed app.

Submissions are prevented and reported at once to a Python-side binding in every frame and
phase. A self-test proves a submit in a frame that is then discarded is still recorded and
makes no request. The warning message is filled with vitals.js's range text on every page in
every phase.

Final run (`native-qa/native-qa.json`): `stage: complete`, `ok: true`. The final gate requires
zero of each of the following, and the run had zero: requests, submissions, page errors,
dialogs, console errors.

What each check covers:

- **Full matrix** (light/dark × 1440/768/390/320 × LTR/RTL):
  - Legacy screen styles and boxes on 23 sampled elements are identical to baseline, and the
    control multiset is equal.
  - In workbench mode: no horizontal page overflow; heading text fits its column; Save/Cancel
    stay inside the viewport; Arial 14px body and 28px heading; Save is petrol once Bootstrap's
    0.15s transition settles.
  - Contrast is AA or better on the sampled text, including the filled warning (7.74:1, overall
    minimum 5.75:1).
  - Both regions are reached by real Tab, each with an asserted petrol `:focus-visible`
    outline. At 390/320 the measurement region overflows and scrolls with arrow keys while
    keeping focus.
- **Print**: workbench mode matches baseline print, in light and dark at 1440 LTR only.
- **Validation borders and warning text**: `.error`/`.warning` borders and the warning
  message's text, size, display and visibility match baseline, in light and dark at 1440 LTR
  only.
- **Legacy tab order**: equals baseline apart from the two regions, in light at 1440 LTR only.
- **Values and node identity** through workbench on/off/on: light at 768 LTR only.

RED before each fix:

- Earlier runs (archived in `archive-run2/`):
  - A real 3px page overflow at 390/320 (Jest RED, then CSS).
  - A Save-colour failure that was harness timing, not CSS: no production change.
- This round (`archive-run4/native-qa-red5.json`): 16 workbench contrast failures, with the
  filled warning at 1.63:1 in both themes. Jest RED came first, then the CSS pair.

Screenshots in `native-qa/fixture-not-deployed-*.png` show the rendered fixture only.

Test counts:

- My runs: Jest via a shared node_modules with `--rootDir`, 28 suites / 622 tests.
- The parent controller's run with the repo's own root config reported 38 suites / 686 tests
  on the previous revision. Those numbers are not from this run.

## Known limits and pre-existing issues

- In the light theme, the `.error`/`.warning` input borders are grey (`#9ca3af`) on both
  baseline and candidate (pre-existing).
- Dark theme: form controls other than the date keep the theme's black inputs on the white
  sheet. The date input's 1.3:1 text contrast is fixed in workbench screen mode only. Legacy
  dark mode still measures 1.3:1, as in baseline.
- The date fix was checked against the rendered stub fixture in offline native Chrome
  (compiled light/dark themes, 1440/768/390/320, LTR and effective-body RTL). Width is measured
  with the fixture's Arial; other fonts and translated date formats were not checked.
- Not run: PHPStan (its config needs the target's own `vendor/`), phpcs (Slevomat sniffs
  missing from the sibling vendor), ESLint (`globals` missing from the shared node_modules).
  The direct-`TwigContainer` and manual-globals issues were checked with an out-of-repo source
  guard (`php-test-guard.sh`), not PHPStan.
- PHP tests ran with an out-of-repo bootstrap: sibling `vendor/` with the same
  `composer.lock`, and this checkout's `src/` and `tests/` loaded first.
- No deployed or authenticated check, no translated RTL locale, no assistive-technology testing.
