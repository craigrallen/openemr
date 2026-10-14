# Physical exam diagnoses popup

## Scope

This is a bounded presentation slice for one route: `interface/forms/physical_exam/edit_diagnoses.php`, the physical exam diagnosis editor.

The launcher, `interface/forms/physical_exam/new.php`, is unchanged. It still opens the route with `dlgopen('../../forms/physical_exam/edit_diagnoses.php?lineid=' + encodeURIComponent(line_id), '_blank', 500, 400)`. Its sha256 equals origin/master `18647270`.

### Activation

Every rule requires `html.oe-workbench-popup` plus `body.oe-physical-diagnoses`.

- `html.oe-workbench-popup` is the shared marker. `interface/clinical-workspace/popup.js` sets it only when a same-origin parent or opener chain reaches an active workbench shell through a dlgopen dialog frame or an opener.
- Header already loads `popup.js` and `popup.css` (which defines the `--oe-wb-*` tokens), so the route links neither.
- The shared `workspace.css` is not linked, so its typography and print rules cannot leak in.
- The route sheet is linked with `media="screen"`, and all of its rules sit inside a single `@media screen` block.

The sheet therefore stays inert, and the legacy rendering remains, in all of these cases:

- a workbench tab frame (context marker only);
- an inactive or legacy shell;
- a standalone window;
- a non-workbench opener;
- print.

### Route edits

The edits are minimal and non-semantic:

- `use` lines for `ClinicalWorkspaceAssets` and `OEGlobalsBag`;
- one versioned `<link>` after `Header::setupHeader('opener')`:
  - `?v=` comes from `ClinicalWorkspaceAssets::version('physical-diagnoses-popup.css')`;
  - the web root comes from `OEGlobalsBag::getWebRoot()`;
- classes on existing elements:

| Element | Class added |
| --- | --- |
| `body` | `oe-physical-diagnoses` |
| `form` | `oe-physical-diagnoses-form` |
| the original `<center>` | `oe-physical-diagnoses-sheet` |
| `table` | `oe-physical-diagnoses-table` |
| the label row | `oe-physical-diagnoses-head` |
| the actions `<p>` | `oe-physical-diagnoses-actions` |

All of the following are byte-for-byte unchanged:

- the POST check (`if ($_POST['form_save'])`, which is inherited and not repaired);
- session lookup, CSRF check and token, ACL;
- line-id normalization and its 400 response;
- `DiagnosisHelper::save` arguments;
- SQL and `ORDER BY ordering, diagnosis`;
- the five appended blank rows;
- input names, types, sizes, maxlengths, inline width and `attr()` escaping;
- the `restoreSession` submit;
- `window.close()`, and the `opener.refreshme` callback.

`ClinicalWorkspaceAssets` gains one allowlisted fixed basename, `physical-diagnoses-popup.css`, in sorted position.

### Presentation (`interface/clinical-workspace/physical-diagnoses-popup.css`)

- **Page and sheet.** A canvas page holds a paper sheet, capped at 46rem with a hairline border. The `<center>` alignment is undone (`text-align: start`).
- **Table.** The label row is muted, weight 600 and ruled. Field rows are also ruled.
- **Inputs.** Inputs get a muted, non-hairline border. The order input is `4em` wide (max 100%). The diagnosis input keeps its inline `width:100%` and is never sized by the sheet.
- **Actions.** Save is the petrol primary; Cancel is a paper secondary with a paired hover.
- **Dark themes.** Every text-bearing surface restates an explicit `--oe-wb-*` ink/surface pair: body, sheet, table, cells, label cells, inputs, Save, Cancel and the Cancel hover. Ink, surface, border and outline colours all use tokens. The one literal colour is the sheet's faint `box-shadow: 0 1px 2px rgb(23 52 59 / 6%)`. It is decorative and carries no text contrast. The test's literal-colour guard checks only hex values and `white`/`black`, so it does not cover `rgb()`.
- **Font sizes.** No `font`, `font-size`, `line-height`, `zoom`, `transform` or letter-spacing/case declarations, so the theme's full sizes stand.
- **Nothing is hidden.** No hidden, clipped, positioned, reordered or `!important` declarations.
- **RTL.** All properties are logical.
- **Keyboard focus.** A 2px petrol outline is drawn on the text inputs, Save and Cancel.
  - The `:focus` fallback is a **separate rule** from `:focus-visible` for fields and for actions.
  - This matters because an engine that does not support `:focus-visible` invalidates an entire grouped selector list, which would have removed the fallback too.
- **Action wrapping.** The actions container is `display: flex; flex-wrap: wrap`. Save and Cancel are `flex: 0 1 auto; min-width: 0; max-width: 100%`, so each moves to its own line as a whole control when the frame is narrow.
  - Native `<input type="submit|button">` labels are single-line. The retained `white-space: normal` / `overflow-wrap` declarations are not claimed to wrap the label text.
  - A translated label longer than the frame stays on one line inside a control capped at the sheet width.

## Evidence (source-level only)

### Jest: `tests/js/physical-diagnoses-popup.test.js`

27 tests, Node environment, with real JSDOM windows for `popup.js`.

- **Inverse presentation mapping.** Undoing exactly the declared edits restores the exact 135-line origin/master route, sha256 `48442d95…a6ac`. Each edit must occur exactly once, so every untouched business byte is proved.
- **Launcher.** `new.php` sha256 equals origin/master and its dlgopen 500×400 call is present.
- **28 negative mutations break the restoration.** They cover:
  - POST guard, CSRF check and token, session, `restoreSession`;
  - ACL, line-id source, 400 response;
  - orderings fallback, SQL order, `+ 5` rows, blank-row ordering;
  - maxlengths, input names, `attr` escaping, inline width;
  - submit type, Save label, Cancel callback, `window.close`, `opener.refreshme`;
  - action `attr_url`, Header `'opener'` asset;
  - a stray class, the `&nbsp;`.
  - These are string mutations evaluated in-test. Production files were not mutated for these runs.
- **Link contracts.** The link appears once, is screen-only, follows the Header assets, is versioned through the helper, and no workspace or popup asset is linked.
- **Helper allowlist.** The basename is present once, in sorted position.
- **Sheet contracts.**
  - one `@media screen` block, every selector positively scoped;
  - no font/zoom/transform;
  - nothing hidden or clipped;
  - logical properties;
  - document shape;
  - dark-theme pairs;
  - focus outlines;
  - the `:focus` / `:focus-visible` separation, plus a negative control proving the check rejects a grouped list;
  - name-prefix selection only.
- **Real `popup.js` controllers.**
  - Engages in the shell's dlgopen frame (form value untouched) and in a window whose opener is a workbench frame.
  - Toggles off for legacy mode and back on for reactivation.
  - Stays legacy for a tab frame, an inactive shell, a standalone window and a non-workbench opener.
- **Generic tiny-frame arithmetic (estimates, not native geometry).** 146px and 180px are **generic, hypothetical inner-frame widths**. They are not predictions for the `new.php` launcher. The arithmetic assumes a 16px font:
  - sheet chrome is about 30px, leaving about 116px or more;
  - that is ≥ 100px for a single-line Cancel;
  - after the 4em order input there is ≥ 32px for the diagnosis input.
  - These numbers are derived from declared CSS values. They are not measured layout.
- **Launcher-derived narrow sizes: KNOWN GAP (unresolved).** These tests read the production sources instead of assuming a frame width:
  - `new.php` calls `dlgopen(..., 500, 400)`.
  - Above 1080px, `library/dialog.js` turns the width into a fixed `max-width` of `(width / innerWidth * 100).toFixed(1)%`, and it is not recomputed on resize.
  - Opened at 1440px, that keeps **34.7%**. Resized to 320/390px, the dialog is capped at **111.04px / 135.33px**.
  - Modal chrome makes the inner frame smaller still. Only the template's `.modal-body px-1` (2 × 4px) is subtracted, which gives upper bounds of **103.04px / 127.33px**. The modal-content border and other Bootstrap chrome are not subtracted, so the real frame is narrower again. Both bounds are below the generic 146/180px.
  - At those upper bounds, the existing estimates **fail**:
    - action budget 73.04px / 97.33px, against the ≥ 100px target;
    - diagnosis budget −6.96px / 17.33px, against the ≥ 32px target.
  - The test asserts these failures as a recorded known gap. It does not treat them as acceptable or usable. No product CSS or route control was changed for estimates.
  - Native acceptance at these sizes is unresolved.

### PHPUnit

- **`tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php`.** Two new cases:
  - temporary-file versioning, the missing-file `0` fallback, and rejection of near-miss and traversal names;
  - the shipped file's mtime.
  - The isolated file was run natively: 48 tests, OK.
- **`tests/Tests/Services/Forms/PhysicalExam/EditDiagnosesTest.php`.** One new DB-backed case renders the real route (`testRenderPresentsDocumentSheetWithoutChangingControls`). It asserts:
  - one screen-only versioned link;
  - each class once;
  - 1 persisted row plus exactly 5 blank rows, with unchanged input markup;
  - `attr` escaping of `<`, `>`, `&` and `"`;
  - Save, Cancel, CSRF and `restoreSession`.
  - **It was not run here**, because this worktree has no Docker stack and databases were not to be altered. It exists for CI and container coverage.

### TDD record

Records are in `/Users/craig/.hermes/projects/openemr/verification/physical-diagnoses-20261014/`.

- **`RED.txt`.** Before production edits:
  - Jest 20 failed / 2 passed. The two passes were the launcher check and the mutation check, which cannot fail before edits exist. The rest failed on the missing sheet, the unregistered basename and the unedited route.
  - PHPUnit: 1 error (unsupported asset), 1 failure (missing shipped file).
- **First implementation.** Jest showed 1 failure, from a test-regex bug: `\bwhite\b` matched `white-space`. The regex was tightened to colour keywords only, and a spot check confirmed it still catches `white` and `#fff`.
- **`RED-focus-separation.txt`.** The focus-separation contract was added and failed against the grouped rules (1 failed / 23 passed). The CSS was then split into separate field and action `:focus` and `:focus-visible` rules.
- **`GREEN.txt`.** Final run:

| Check | Result |
| --- | --- |
| Focused Jest | 24/24 |
| Neighbouring popup suites | 199/199 |
| `ClinicalWorkspaceAssetsTest` | OK (48 tests, 102 assertions) |
| `php -l` on 4 changed PHP files | clean |
| Exact-file stylelint with the repo `.stylelintrc.json` | exit 0 |
| `git diff --check` | clean |
| Untracked-file whitespace check | clean |
| Launcher sha256 | equal to origin/master |

- **Review correction (independent review P2).** In the earlier record, the 146/180px budgets were wrongly tied to the 500px launcher.
  - **`RED-launcher-resize.txt`.** A test asserted that old claim against the production `dialog.js` calculation. It failed: the 320px upper bound is 103.04, expected ≥ 146. A first attempt errored on a test-regex bug (the launcher URL contains `encodeURIComponent(...)`). The regex was fixed before the recorded run.
  - The assertion was then corrected to the real values, with the known-gap budgets above.
  - **`GREEN-launcher-resize.txt`.** Focused Jest, 27/27. Only the test file and this document changed in this correction. No production source changed. The neighbouring suites, PHPUnit and stylelint were not re-run for this correction, because the files they cover are unchanged.

- **Other records.**
  - `LINT.txt` is an earlier stylelint baseline comparison.
  - `ESLINT.txt` records that ESLint could not run: the repo's `eslint.config.mjs` imports `globals`, which is not resolvable from the shared node_modules. This is not a lint pass.

**Tooling.** No installs and no lockfile changes. Jest and stylelint ran from the sibling `openemr-popup-immunization/node_modules` via `NODE_PATH` and `--rootDir .`. PHPUnit 11.5 ran from the sibling `openemr-workbench-shell/vendor`, read-only, through a scratch bootstrap outside the repo that resolves `OpenEMR\` and `OpenEMR\Tests\` from this worktree first.

## Limitations

- **No browser evidence**:
  - no compiled-theme, screenshot, Selenium or native-Chrome run;
  - no measured layout at 146/180px or any other width;
  - no opener/`refreshme` round trip, real dlgopen or print check;
  - no live role or ACL run.
  - Source tests do not establish any of these.
- **Activation is simulated.** JSDOM proves class activation and selector matching only, not cascade, computed style or layout.
- **The DB-backed render test was not executed here.**
- **Inherited behaviour kept.** It is unchanged, not repaired:
  - no doctype (quirks mode);
  - `<center>` and table `width` attributes;
  - an unguarded `$_POST['form_save']` read;
  - the `&nbsp;` between buttons. In the flex row it becomes a small anonymous item and adds a little extra spacing.
- **Narrow-size usability is an unresolved limitation.** This is not acceptance at all widths. If the launcher dialog is opened at 1440px and the window is then narrowed to 320–390px, the estimated budgets fail (see the known gap above). No fix is claimed or attempted here without native geometry.
- **Long labels.** Native input button labels do not wrap. A translation wider than the sheet stays on one line within the capped control.
