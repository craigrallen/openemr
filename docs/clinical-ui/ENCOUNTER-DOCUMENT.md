# New/Edit Encounter sheet (workbench presentation)

Partial styling slice for the existing New/Edit Encounter form
(`interface/forms/newpatient/templates/newpatient/common.html.twig`). It is not a feature or
clinical change and has not been accepted clinically or deployed.

## What changed

| File | Change |
| --- | --- |
| `interface/clinical-workspace/encounter-document.css` | New. All rules sit inside `@media screen` and are scoped to `body.oe-clinical-encounter.oe-clinical-workspace #container_div.oe-encounter-document`. The `#container_div` id lets them outrank the shared `body.oe-clinical-workspace #container_div` rule in `workspace.css`. |
| `.../partials/common/_head.html.twig` | Loads `workspace.css` with `media="screen"`, so print is unchanged. Also loads `mode.js` (`defer`) and `encounter-document.css` after the original assets. Head hooks and their order are unchanged. |
| `common.html.twig` | Adds `oe-clinical-encounter` to the body and `oe-encounter-document` to `#container_div`. |
| `.../partials/common/_form-controls.html.twig` | Adds `oe-encounter-actions` to the Save/Cancel `.form-row`. Buttons, IDs, classes and the cancel wiring are unchanged. |
| `ClinicalWorkspaceAssets.php` | Adds `encounter-document.css` to the fixed asset allowlist. |
| `src/Common/Twig/TwigExtension.php` | New `clinicalWorkspaceAssetVersion(asset)` function, the existing `ClinicalWorkspaceAssets::version()` injected through the constructor (default: the shipped directory). It returns the file mtime, `'0'` for a missing allowlisted file, and rejects names outside the allowlist (Twig `RuntimeError` wrapping `InvalidArgumentException`). `_head` calls it directly; the controller is unchanged from ba11545. |
| `.stylelintrc.json` | Adds `encounter-document.css` to the existing `media-feature-range-notation: prefix` override. This is the only file added; no other rule or threshold changed. |

`mode.js` adds `oe-clinical-workspace` only inside an active workbench. Direct (legacy) and print
presentations therefore keep the existing theme.

The sheet:
- has a 1100px maximum width and ruled section headings
- gives every text colour an explicit background
- uses a petrol 2px focus outline for fields and buttons
- rules off the action row
- stacks field columns full-width at 640px and below

`!important` appears only where `theme-defaults.scss` itself forces legend/fieldset background and
text colour with `!important`. There is no `:has()` and no range media-query syntax.

## TDD record

Logs are in `~/.hermes/projects/openemr/verification/cron-encounter-document/`.

1. `red.log` → `green.log`: the first slice, 11 failing → 12/12 passing.
2. Review round (three P2 findings: dark legend/fieldset pairing, print leak through `workspace.css`,
   container specificity; plus the `:has()`/range syntax and a lint test that could pass as a no-op).
   `red2.log` showed 12 failures across `clinical-encounter-document`, `clinical-calendar-stylelint`
   and `clinical-calendar`. `green2.log` showed 50/50 passing. Both override-allowlist tests now
   assert the whole `overrides` array, not a filtered subset. The lint test now:
   - requires a non-ignored report whose source is this file
   - requires an invalid stdin sentinel to be rejected under the same filename, with both the repo
     ignore file and a test-local empty ignore file
3. Native QA found an overflow I had introduced: 3px horizontal scroll at 390/320. The narrow 0.75rem
   padding was smaller than the heading `.row`'s 15px gutter. `red3-overflow.log` shows one failing
   test, then `green3-overflow.log` shows 13/13 after changing the padding to `1rem`.
4. Full Jest suite (`full-suite3.log`): 38 suites, 685 tests passing. `git diff --check` is clean.
   `php -l` passes on both changed PHP files.

5. Coverage correction (PR35 codecov/patch: the one new controller line was never executed). The
   controller-only parameter was replaced by the Twig function above.
   - RED: `red-coverage-php.log` showed 5 failing/erroring tests, with
     `Unknown "clinicalWorkspaceAssetVersion" function`. `red-coverage-jest.log` showed 2 failing.
   - GREEN: `green-coverage-php.log` showed:
     - `ClinicalWorkspaceAssetVersionFunctionTest`: 5/5. It renders through a real Twig
       `Environment`, with the real `_head.html.twig` from a `FilesystemLoader`; only
       `setupHeader` is stubbed.
     - `ClinicalWorkspaceAssetsTest`: 23/23, including the new encounter-document allowlist and
       shipped-file tests.
     - `TwigExtensionIsolatedTest`: 1/1.
   - `green-coverage-jest.log` showed 15/15. The full Jest suite is 38 suites, 685 tests.
   - Native QA re-ran with `ok=true`, and the re-rendered page carries the file's real mtime.
   - These PHPUnit runs used the host PHP 8.5 against a **sibling** vendor (identical
     `composer.lock`) through `run-php.sh`/`bootstrap-rooted.php`. The bootstrap maps
     `OpenEMR\` and `OpenEMR\Tests\` to this worktree. Composer "files" autoloads (procedural
     `library/` helpers such as `attr_url`/`text`) load from the sibling checkout. No coverage
     driver was available locally, so patch coverage is verified only by hosted CI.

PHPStan, phpcs and Rector were **not** run. The target vendor and Docker were not available.

## Native offline QA (external harness, synthetic fixture)

Run with `uv run --offline --no-project --with playwright python native-qa.py` in the verification
directory, using system Google Chrome 154 headless. Result: `native-qa/evidence.json`
`stage=complete, ok=true`. It covers light and dark themes at 1440, 1024, 390 and 320px. Each case
checks:

- **Controls:** the multiset of controls matches the ba11545 baseline render. It compares 26
  controls by tag, type, name, id, value, checked/disabled/required/readonly, inline handlers and
  select options.
- **Workbench and layout:** `mode.js` turns workbench mode on. There is no horizontal overflow, and
  the sheet is ≤1100px wide.
- **Contrast at rest:** minimum unfocused text contrast is 4.53.
- **Keyboard:** real `Tab` presses from the parent frame reach Save. Every keyboard-focused field or
  button had a petrol 2px solid outline. Minimum focused text contrast was 6.44, and minimum
  outline-to-sheet contrast was 6.44.
- **Legacy and print:** without workbench (legacy), and in print with workbench on, computed styles
  of the key elements are identical to the baseline.
- **Semantic states:** `.alert-danger`, `.text-danger` and `.error-border` keep their legacy colours
  inside the workbench.
- **Guards:** zero requests, submits, page errors or dialogs in the QA phase. The guards attach
  persistently to the context and record at event time. A negative-path phase proved that a
  `requestSubmit()` and a `form.submit()` are each recorded and discarded with no request.

Harness corrections made during the run (these were not product changes):
- Use system Chrome rather than downloading a browser.
- Wait out Bootstrap's 0.15s border transition before reading styles.
- Skip natively disabled inputs in the programmatic-focus check.

### Fixture limitations

- The page comes from `render-fixtures.php`, which renders the real worktree templates (and the
  ba11545 templates for the baseline) through the real Twig environment. It uses a sibling vendor
  with an identical `composer.lock`.
- The data is **synthetic**. `setupHeader`, `selectList` (DB `list_options`) and
  `displayOptionClass` are stubbed. Some selects render empty because the synthetic data shapes do
  not match the template.
- All page scripts are stripped. `newpatient.js`, validation, the date picker, Select2 and module
  widgets did **not** run. `.error-border` and the danger elements are fixture classes added by the
  harness.
- Theme CSS is compiled from the real light/dark sources. No RTL build was available, so RTL was not
  tested.
- Screenshots are of the offline fixture, clipped to the 900px iframe. They are not of the deployed
  app.
- Not tested: an authenticated session, the real `main.php` frame tree, screen readers, translated
  or long labels in real locales, and module Twig hooks emitting content.
