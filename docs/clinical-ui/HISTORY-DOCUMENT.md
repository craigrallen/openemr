# History and Lifestyle sheet (workbench presentation)

This is a partial styling slice for the existing History and Lifestyle view
(`interface/patient_file/history/history.php`). The page is a view reached by GET, but it is
**not operationally read-only** (see the safety note). The slice changes no features, data or
clinical behaviour. It has not been accepted clinically, verified live, or deployed. It closes none of
the 22 features in `ACCEPTANCE.md`; all 22 remain open.

## Scope

In scope: how the History view looks on screen when it sits inside an active clinical
workbench.

Unchanged:
- `history_full.php` (the editor)
- `library/options.inc.php` (the layout renderer)
- `interface/themes/core/patient/history.scss`
- the shared `workspace.css` and `mode.js`
- ACL and squad checks
- data reads, including `newHistoryData` (see the safety note below)
- skip conditions
- the patient menu and header
- print output
- direct (non-workbench) use

## What changed

| File | Change |
| --- | --- |
| `interface/clinical-workspace/history-document.css` | New, screen-only. Details below. |
| `interface/patient_file/history/history.php` | Adds a head block after the existing HIS font-override `<style>`. It loads `history-document.css` with `media="screen"` and `mode.js` with `defer`, both versioned through `ClinicalWorkspaceAssets`. It also adds three classes: `oe-clinical-history-document` on the body, `oe-history-document` on `#container_div`, and `oe-history-actions` on the Edit row. It does **not** load the shared `workspace.css`. |
| `src/Common/Assets/ClinicalWorkspaceAssets.php` | Adds `history-document.css` to the fixed allowlist. |
| `tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php` | Three tests: the asset is versioned per file, a missing file returns `'0'`, and the shipped file is versioned. |
| `tests/js/clinical-history-document.test.js` | New Jest suite with 20 tests (see the TDD record). |
| `tests/Tests/Isolated/PatientFile/History/HistoryRouteRenderTest.php` (+ `HistoryRouteHarness.php`, `HistoryRouteScenario.php`, `Doubles/*`) | New isolated PHPUnit test (7 tests) that `include`s the **real** `history.php`, with labelled test-only doubles (see "Route render test"). |

`history-document.css` sits entirely inside one top-level `@media screen`. It has three kinds
of rule:
- **Token rule**, on `body.oe-clinical-history-document.oe-clinical-workspace`. It declares only
  `--oe-*` tokens: ink, muted, line, paper and petrol (the same values as `workspace.css`), plus a
  route-only `--oe-subtle`. It sets no colour, background or typography on the body.
- **Container rule**, on `… #container_div.oe-history-document`. It sets only
  `padding-left/right: 15px`, which is Bootstrap's own gutter and matches the rows' −15px margins.
- **Sheet rules**, each starting with that container scope:
  - frames `#HIS` as one ruled sheet
  - quiet underline tabs, with a 2px petrol `:focus-visible` ring (the theme sets
    `ul.tabNav a:focus { outline: none }`)
  - paper-coloured tab panels
  - `overflow-wrap: anywhere` on tab links and `td.data`
  - a petrol Edit action that is ruled off from the sheet
  - dark-theme fixes:
    - `#HIS` redefines `--gray300: var(--oe-subtle)`. The renderer's inline subtitle
      `background-color: var(--gray300)` then resolves light, with no `!important` and no markup
      change.
    - `td.label` gets ink on paper.
    - The nested lifestyle `td.data table.table` and its cells get ink on paper. These come from
      `generate_display_field` type 28, where the dark theme's `.table` colour is near-white.
      Status `strong`, icons and spans inherit; no rule targets them directly.

No rule touches `display`, `visibility`, sizing, position, `float`, `overflow`, `font-size`,
`font-family` or `line-height`, and none uses `!important`.

`mode.js` adds `oe-clinical-workspace` only when a same-origin ancestor carries
`workbench-active`. Outside the workbench, and in print, the stylesheet is inert.

### Why the shared workspace.css is not loaded

An earlier revision of this slice linked `workspace.css`. Native QA and an independent review
found two regressions from it:
- **Typography.** Its `body.oe-clinical-workspace` rule replaced the theme font (`Lato,
  Helvetica, …`) with `"Source Sans 3", …` and set `font-size: 0.94rem`, so History subtitles went
  from 16px to 15.04px.
- **Overflow.** Its `≤640px` rule sets `0.8rem` container padding, but Bootstrap rows keep −15px
  margins. The document overflowed to 392px at 390 and 322px at 320.

The route now declares the tokens it needs itself. Its typography is the theme's own, and that
includes the configured HIS override.

## Safety note: GET can create a history row (pre-existing, not changed)

`history.php` runs on a plain GET. If `getHistoryData($pid)` returns no array, it calls
`newHistoryData($pid)`, which **inserts a `history_data` row**, and then reads again. A page
view, a prefetch or a reload can therefore write to the database. This slice does not change
that. The Jest preservation test pins `newHistoryData($pid);` to exactly one occurrence. Fixing
it (POST only, or a read-only empty state) is a separate behavioural change that needs its own
review, and it was not attempted. Source preservation does **not** make this route
operationally read-only.

## Known pre-existing typography gap (not introduced)

The compiled legacy theme declares `div.tab td.data { font-size: 0.8rem !important; }`. That
rule defeats `history.php`'s non-important `#HIS .data` override. With a configured `grp_size`,
data cells stay at 12.8px while subtitles and nested lifestyle cells reach the configured size.
This happens in the baseline (master 5619373) and in the candidate alike. The slice neither
causes nor fixes it, and the native QA keeps it as a failing **absolute** requirement check.

## TDD record

Evidence is outside the repo, in `/Users/craig/.hermes/projects/openemr/verification/cron-history-document/`.

- **First pass.**
  - RED: `red-jest.log` (11/16 failing) and `red-php.log` (3/33 failing).
  - GREEN: `green-jest.log` (16/16) and `green-php.log` (33/33).
- **Review corrections.**
  - RED: `red2-jest.log`, 8/20 failing. The failures cover:
    - the exact head block without `workspace.css`
    - a single `media="screen"`
    - token-only body and 15px container scope
    - token values match the researched palette
    - the subtitle `--gray300` redefinition with paired ink
    - lifestyle `table.table` and cell ink on paper
    - a fixture rule-hit for the lifestyle table and subtitle

    One new test passed already, at RED time: no selector targets semantic `span`, `strong`, `i` or
    `.fa`. It guards the fix rather than proving a defect.
  - GREEN: `green2-jest.log` (20/20) and `green2-php.log` (33/33, 51 assertions).
  - `stylelint3.log` is clean. The earlier `stylelint2.log` flagged `no-descending-specificity` on
    the original rule order; moving the tab `:focus-visible` rule before `li.current a` fixed it.
- **Route render test (native PHP).**
  - RED: `red-route-php.log`, with master 5619373's `history.php` temporarily in place. The
    candidate was hash-verified as restored afterwards (`history-candidate.sha256`). Result: 6/7
    failed on the missing asset block, classes, versions and `$clinicalAssets`. The
    source-binding test passed, as it should on both versions.
  - An earlier RED attempt (`red-route-php-guard-defect.log`) errored in the harness itself, not
    the route. The generated doubles' top-level functions were bound at compile time, before
    their "already loaded" guard could run. They are now declared conditionally, so the guard runs
    first.
  - GREEN: `green-route-php.log`, then `green2-route-php.log` after the review fixes: 7 tests,
    78 assertions.
  - A first GREEN attempt failed on my own expectation for denied viewers. The head's HIS
    font-override `getLayoutProperties()` call runs before the ACL check. The assertion now pins
    exactly that one call, with no tabs or data.
  - Controller review fixes:
    - PHPStan rule `openemr.forbiddenShellExecution`: `proc_open` was replaced by Symfony
      `Process` with an array command.
    - PHPStan rule `phpunit.assertCount`: now uses `assertCount`.
    - Rector: `OemrUIDouble` is now `final readonly`, and `is_int(...)` is used as a first-class
      callable.
    - No suppressions or baseline entries were added.
- **Controller full runs, before the review fixes.**
  - The full isolated suite passed: 6088 tests, 16322 assertions.
  - The first full PHPStan run (`controller-phpstan.log`) reported 4 errors:
    - 2 were introduced by this slice (forbidden `proc_open`, `assertCount`). Both are fixed above.
    - 2 were `OpenEMR\Modules\ClaimRevConnector` "class not found" errors. They were caused by
      that run's setup lacking the real, ignored ClaimRev module.
  - The first full Rector run (`controller-rector.log`) had 2 findings. Both are applied.
- **Controller final verification, after the `Process`, `readonly` and `assertCount` fixes.**
  This is controller-run, against the actual target:
  - Full isolated PHPUnit: exit 0, 6088 tests, 16322 assertions. The 4 inherited warnings,
    24 skipped and 14 incomplete are unchanged.
  - Full Jest: exit 0, 48 suites, 957 tests.
  - Full Rector: exit 0, with only a deprecated-rule warning.
  - Full PHPStan (CI configuration): exit 0, no errors. This run had the genuine ClaimRev module
    restored and the result cache cleared. Nothing was stubbed or suppressed.
  - The route render test (7 tests, 78 assertions) and the `ReflectionClass` target-binding check
    pass against the target's own `vendor/`. That `vendor/` is a **local copy** built from the same
    `composer.lock`, not a symlink to a shared vendor.
  - No local coverage driver (pcov or xdebug) was available.
- **Independent review.** The final Astra review covered all 14 files and found no introduced
  P1 or P2 issues. Its report (`out-1791360521-77530-c30.log`) is saved outside the repo. This
  is not a GitHub approval.
- **Runners (historical, local focused runs).**
  - `run-jest.sh` uses the shared `node_modules`, because the worktree's `node_modules` was empty.
  - `run-php.sh` (asset helper) and `run-php-route.sh` (route render) ran focused isolated
    PHPUnit files. They used a sibling checkout's `vendor/` (identical `composer.lock`) and the
    out-of-repo `bootstrap-rooted.php`, which binds the target's `src/` and `tests/` first.
    Composer "files" autoloads came from the sibling checkout.
  - Those sibling-rooted results remain true as recorded: asset helper 33 tests / 51
    assertions; route 7 tests / 78 assertions.
- **Mutations.** `mutations.log` names six intended mutations but records **no results**.
  Mutation kill evidence is incomplete and is not claimed.

## Route render test (real history.php, test doubles)

`HistoryRouteRenderTest` uses `#[RunTestsInSeparateProcesses]` and `#[PreserveGlobalState(false)]`.
It `include`s the actual target `interface/patient_file/history/history.php`. The route source
is never copied, eval'd or symlinked, and no production file is stubbed or changed.

**Real code:**
- `history.php` itself
- `history.inc.php`
- `getPatientData()`, `getHistoryData()` and `newHistoryData()` from `library/patient.inc.php`
- `xl()` (with `disable_translation`) and the escaping helpers
- `OEGlobalsBag` and `Kernel` (web root `/openemr`)
- the session wrapper, with a Symfony mock-array session holding `pid` 7
- `ClinicalWorkspaceAssets`

A test asserts that this class and `history.php` resolve to the target checkout.

**Doubled (TEST-ONLY, labelled, synthetic data):**
- The harness writes a temporary tree and runs with its working directory at `<tmp>/a/b`, so
  `../../globals.php` is a double. That double defines `sqlQuery()`, which answers only the
  `patient_data` squad read and the `history_data` read; anything else throws.
- The `$srcdir` includes are doubles: `options.inc.php` (`getLayoutProperties`,
  `display_layout_tabs`, `display_layout_tabs_data`, emitting the real renderer's element
  shapes) and `options.js.php`.
- So are `erx_patient_portal_js.php` and `summary/dashboard_header.php`.
- `AclMain`, `Header`, `OemrUI`, `PatientMenuRole` and `SocialHistoryService` are replaced through
  guarded `class_alias`. Every double refuses to load if the real code is already loaded.

**What it pins:**
- The route's own `new ClinicalWorkspaceAssets()` line executes. The `$clinicalAssets` it
  creates is asserted to be the real class.
- Exactly one screen-only `history-document.css` link and one `defer`red `mode.js`, adjacent and
  versioned with the shipped files' real mtimes (never `'0'`). There is no `workspace.css`, and
  `media="screen"` appears exactly once.
- Order: `setupHeader`, then the configured HIS font override (`grp_size` 14 gives four 1.19rem
  rules), then the asset block, then `</head>`. The default layout emits no font rule.
- Body and wrapper classes, the exact Edit anchor inside `oe-history-actions`, the generated tabs
  and tab data, `tabbify()`, `checkSkipConditions()`, the menu, the header, and the help file.
- A read-only-ACL viewer gets the document without the Edit row or menu.
- Missing history row: the **existing** GET-time `newHistoryData()` insert runs once (recorded by
  the double) and the page renders the re-read row.
- Denied viewers (no `patients/med`, or an unseen squad) get "(History not authorized)" and stop.
  There is no history read, no tabs or data, and no insert. Only the head's font-override lookup
  runs.

**Caveats:**
- The denied branches end in `exit()`, so they run in a child PHP process started with Symfony
  `Process`, using the parent's PHPUnit bootstrap or Composer autoloader. Coverage is **not**
  recorded for those lines.
- No local coverage driver (xdebug or pcov) was available. Execution of the instantiation line is
  proven by the `$clinicalAssets` assertion, not by a coverage report.
- The doubles mean this is **not** DB, ACL, runtime or clinical acceptance.

## Jest contrast limit

The Jest contrast check only pairs colour and background *within each rule*. It cannot see an
inherited theme descendant colour, or the inline `--gray300` background. Rendered descendant
contrast is covered only by the native harness below.

## Native offline QA (external harness, synthetic fixture)

`native_qa.py` is in the verification directory and is run in the foreground by the controller
with `uv run native_qa.py`. Playwright Python comes from the uv cache and is never installed into
the repo. Chrome is the system Google Chrome.

**What it loads:**
- the real `tabbify()` from `library/js/common.js`
- jQuery 3.7.1
- the compiled light and dark themes (Bootstrap 4.6.2), with Font Awesome inlined as data URIs
- the candidate's head additions, **parsed from the worktree's `history.php`** and inlined in
  order. The parse refuses any other clinical-workspace reference and refuses the shared
  `workspace.css`.

The harness waits for `document.fonts.ready` and settles animations before measuring.

**Network guard:**
- an offline context plus `context.route('**/*')`, which aborts every request
- a canary fetch that must be rejected
- `page.set_content` only, with no live requests, login, server or database

**The fixture is SYNTHETIC and labelled `FIXTURE`:**
- It is a hand-built `#HIS` copying the shapes emitted by `display_layout_tabs*()` and
  `generate_display_field()` (types 2, 3 and 28).
- It includes a long tab name, a long hyphenated value, a long unbroken value, a lifestyle
  `table.table`, a subtitle, a skip-hidden value and a skipped (blank) row.
- The header and menu are placeholders.
- It is never deployed.

**Matrix:** light and dark × 1440/1024/390/320 × HIS font override (default, or `grp_size` = 14,
which gives 1.19rem).

**Comparison oracle.** `test_native_qa.py` holds 18 offline unit tests for it
(`red-qa-unit.log` was 18 errors; `green-qa-unit.log` is 18/18).
- **Head guard.** The candidate head must equal the baseline head plus *exactly* the approved
  additions, appended last. They are compared by tag, attributes, content hash and length. Any
  other change, whether extra, missing, altered or reordered, is refused, and the style
  comparison for that case is reported as failed rather than skipped.
- **Legacy and print.** Each run compares every enumerated `getComputedStyle` property and every
  bounding rect of every element against the baseline. Only the approved head elements are
  removed first. Unexpected nodes are reported through a node-sequence diff. Print runs at the
  same width with a workbench host active.
- **Body retention.** Every body node's attributes and own text are compared exactly, with only
  the candidate classes stripped.
- **Workbench.** The candidate must meet all of the following. Baseline overflow and contrast are
  recorded separately.
  - strictly zero horizontal overflow
  - Edit fits
  - a single visible panel
  - the skip-hidden value stays `display:none`
  - composited contrast of at least 4.5:1 for every visible tab, `label_custom` cell and span,
    subtitle, `td.data`, lifestyle cell and `strong`, and Edit
  - rendered font-family, size and line-height of every visible text element equal the baseline.
    Font *weight* is excluded because the tabs are intentionally semibold.
- **Tabs and keyboard,** at 1440 and 320:
  - real clicks switch panels through `tabbify`
  - the long tab causes no overflow
  - the keyboard reaches Edit and the tabs with a solid ring of at least 2px and tab-ring
    contrast of at least 3:1
  - Tab+Enter switches tabs

**Check kinds:**
- `regression` covers the candidate guards and parity.
- `absolute` covers the configured-font requirement, judged on both baseline and candidate.
- `report.ok` is true only if *every* check passes, so it stays **false** while the pre-existing
  font gap remains.
- `candidate_regressions_passed` is true only if the run completed, cleaned up, had no errors,
  and every regression check passed.

`.groupname` appears in the font override, but `display_layout_tabs_data()` does not emit it in
this view. The harness records its count (expected 0) rather than inventing markup.

### Runs

- **Initial run (pre-correction), archived as `native-initial-failed/`:** completed, cleanup ok,
  no script errors, **226 checks, 82 failed**.

  | Failure family | Count | Classification |
  | --- | ---: | --- |
  | Legacy style/geometry | 16 | Oracle defect: head assets were snapshotted (91 vs 94 elements); no real comparison happened |
  | Print style/geometry | 16 | Same oracle defect |
  | Nodes/attributes/text | 16 | Oracle misalignment and head whitespace |
  | Default HIS font equality | 8 | Real regression: `workspace.css` typography (fixed) |
  | Custom override = 19.04px | 8 | Pre-existing theme `!important` gap (kept as absolute) |
  | Dark descendant contrast | 8 | Real regression: lifestyle 1.05:1, subtitle 1.61:1 (fixed) |
  | Initial-panel overflow | 8 | Real regression: `workspace.css` 0.8rem gutters (fixed) |
  | Long-tab overflow | 2 | Same gutter regression (fixed) |

- **Corrected run (controller, offline):** the full matrix of 16 cases (light and dark ×
  1440/1024/390/320 × default and custom font) completed with clean cleanup.
  - **266 checks, 250 passed, 16 failed.**
  - All 16 failures are the inherited **absolute** check that the configured HIS font override
    reaches data cells. It fails for baseline and candidate in each of the 8 custom-font cases,
    because of the theme's `div.tab td.data { font-size: 0.8rem !important }`.
  - `candidate_regressions_passed: true`, `ok: false`, exit code 1.
  - Legacy and print FULL computed-style and geometry parity, the head guard, and body node,
    attribute and text retention all **passed** in every case.
  - The offline oracle unit tests (`test_native_qa.py`) pass 18/18.
- **Screenshots.** The `FIXTURE-*` screenshots were inspected and are readable. The fixed-height
  viewport crop at narrow widths does not capture all of the vertical content, so this is not a
  full visual acceptance.

## Not done / limitations

- No live, authenticated, ACL, squad, database or clinical verification was done. No request
  was made to any running OpenEMR.
- The fixture is hand-built, not PHP-rendered. The theme manifest is not bound to a source commit.
- Native QA overall is `ok: false` because of the inherited font gap. Narrow screenshots are
  cropped, so there is no full visual acceptance.
- The configured HIS font override does not reach `td.data`, in both baseline and candidate
  (pre-existing).
- Mutation kill results were never recorded.
- No coverage report exists for `history.php`, because no local pcov or xdebug was available.
- The route render test uses doubles for the database, ACL, layout and header.
- There is no RTL theme build.
- The `newHistoryData` write on GET is unchanged.
- All 22 acceptance features remain open. Production is undeployed and nothing here is acceptance.
  No commit, PR, push, merge or deploy has been made.
