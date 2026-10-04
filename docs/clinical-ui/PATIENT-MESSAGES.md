# Patient messages list and compose workbench slice

Status: implemented on `feat/clinical-patient-messages` (base `ba11545`), not accepted. This is a partial adaptation of the researched `messageView` composition to two existing screens. It is not completed design fidelity, and no feature in `ACCEPTANCE.md` or `STATUS.md` changes state because of it.

## Route and scope

- `interface/patient_file/summary/pnotes_full.php` is the existing patient staff notes/messages list.
- `interface/patient_file/summary/pnotes_full_add.php` is the existing compose/amend dialog that the list opens through `dlgopen`.

Each page gets four changes and nothing else:

- a `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;` import;
- a body scope class: `oe-clinical-messages` on the list, `oe-clinical-message-compose` on the dialog;
- three asset tags after the existing `Header::setupHeader` call, each with an escaped webroot and a per-file `ClinicalWorkspaceAssets` version:
  - `workspace.css`, linked with `media="screen"` because its own rules are not media-scoped;
  - the new `patient-messages.css`;
  - the existing `mode.js`, loaded `defer`;
- `patient-messages.css` added to the helper's supported list.

No production JavaScript was added, and no markup, ID, name, form, handler or link changed.

`mode.js` adds `oe-clinical-workspace` only while a same-origin ancestor body carries `workbench-active`:

- The list runs in a workbench tab iframe, so its host is reached through that frame.
- `dlgopen` mounts the compose iframe in `top`, so the dialog's parent is the shell itself.

Every `patient-messages.css` selector starts with `body.oe-clinical-workspace.oe-clinical-messages` or `body.oe-clinical-workspace.oe-clinical-message-compose`, and every rule sits inside `@media screen`. Direct loads, the legacy shell and print therefore keep the original theme presentation. `pnotes_print.php` is not touched.

## Presentation

The slice follows the reference `messageView`/`.doc`/`.sheet`/`.rows` composition:

- **Type and colour:** Arial, 14px, line-height 1.5. Colours come from the existing workspace neutral/petrol tokens (`--oe-ink`, `--oe-line`, `--oe-petrol`, `--oe-paper`, …), with literal fallbacks, plus the reference's neutral literals.
- **List:**
  - The heading has a rule under it, and the toolbars (`.btn-group`) wrap with gaps.
  - The filter strip and message table become a white sheet.
  - Column heads are muted uppercase, and rows are padded and top-aligned.
- **Compose:** a single document sheet (max 760px) holds the title rule, quiet labels and fields. The existing message being amended shows as a thread entry. `#note` is restyled as a document field: bottom border only, 104px minimum height, focus tint.
- **Billing:** the balance-due and billing-note rows get a 4px warning edge, with ink on paper.

What the slice deliberately does not do:

- No element is hidden. There is no `display:none`, `visibility:hidden`, `content:` or `!important`.
- The outbox block's inline `display:none` is left in charge.
- All eight inbox columns stay. The tables get a min-width and scroll inside the existing `#inbox_div.table-responsive` and outbox containers.
- The textarea keeps its native resize. Nothing declares `resize`, and no autocorrect/spellcheck/AI attributes or send claims were added.

### Theme pairing

Every surface the slice paints light also sets its own ink, and every element it gives ink also gets a light surface. This matters because OpenEMR themes set colours on descendants directly; for example, the compiled dark theme has `.table { color: #f8f9fa }` and `.form-control { background-color: #000 }`, including on `:focus`.

- **List:** the `.tabContainer` sheet, its `.table` (`background-color: transparent`) and its `td` set `--oe-ink`.
- **Compose:** the sheet sets ink on paper, and `.form-control` and `.form-control:focus` set ink on `--oe-paper`.
- **Danger and warning colours:**
  - **Billing cell:** the cell sits on paper (an earlier warm `#fff3d9` tint lowered `text-danger` contrast from 4.53:1 to 4.11:1) and sets `--oe-ink` itself.
  - **Balance with no billing note:** when the billing note is empty, PHP emits the balance-due row without `text-danger` spans, so the text would otherwise inherit the theme's `.table` colour. In the compiled dark theme that is `#f8f9fa` on white, 1.05:1.
  - **Legacy dark render:** the legacy dark page shows the same 1.05:1, because a theme rule paints `tr.billing` white. That legacy defect is left unchanged.
  - **Danger spans:** no rule targets `.text-danger`, so its spans keep the theme's danger colour.
  - **Delete button:** `a.btn-danger` gets a literal `#fff`, because `workspace.css` colours every link petrol and the dark theme maps `--white` to black while keeping `.btn-danger` text white.

### Overflow

The original list never closes its first `.row`, so the rest of the page parses inside a flex row that also contains a nested `.row`. In workbench mode:

- `.tabContainer` is bounded with `flex: 0 0 100%; max-width: 100%; min-width: 0`, so the 960px table scrolls inside `#inbox_div` instead of widening the page.
- `#pnotes` padding is at least 15px, so it is never narrower than the Bootstrap row gutter.
- The nested `.row > .row` gets `margin-inline: 0`.

The result is exactly 0px page-level horizontal overflow in workbench mode at every tested width. The legacy page keeps its own 15px overflow at 360px; that comes from the nested row and is not introduced by this slice.

The compose dialog can be much narrower than its open width. `dialog.js` fixes the modal width as a percentage of the window at open time, so a dialog opened at 1440px and then resized to 390/320px leaves a 180/146px iframe. An authenticated candidate-overlay run found that the original new-note page fits there, but the first version of this slice overflowed and clipped Save. This was a regression introduced by the slice: `flex: 0 0 auto` buttons and 16px sheet padding. The correction is screen-only:

- compose `.btn-group > .btn` is `flex: 0 1 auto; min-width: 0; max-width: 100%; white-space: normal`, so labels wrap at their full 14px size;
- the sheet's inline padding minimum drops from 16px to 8px. Because the value is `clamp(8px, 5vw, 36px)`, this only changes frames narrower than 320px.

Nothing is hidden, scaled or forced into a full-screen modal. The list toolbar keeps `flex: 0 0 auto`.

Out of scope and unchanged:

- Legacy defects: `id='outbox_div table-resonsive'`, `show_div('outbox')` finding no element, duplicate `#noteid`/`#Submit` IDs, the unclosed `.row`, and the missing doctype (quirks mode) on the dialog.
- Endpoint semantics.

## Preserved behaviour

These are unchanged:

- ACL and squad checks;
- CSRF fields and checks;
- docid/orderid linking (`setGpRelation`/`isGpRelation`);
- active/inactive filters and pagination;
- Edit/Delete permission branches;
- `note_modal` dialogs, `change_activity`, `deletenote`, `refreshme`, `restoreSession` paths and `set_pid`/`setPatient`;
- the scanned-document popup;
- the compose form and its recipients list, "Mark Message as Completed", the due-date picker and the AJAX save, plus `dlgclose`, Print, Cancel, Save-as-new and Append.

No backend, schema, API, query or message data was changed or created.

## Tests and evidence

### In repo

`tests/js/clinical-patient-messages.test.js` (Jest, jsdom) has 18 tests:

- **Asset tags:** for both pages, escaped versioned asset tags in order, `media="screen"` on `workspace.css`, the body scope class, the dialog's missing doctype preserved, and no new script or writing-assistance attributes.
- **Token parity:** counts of 29 list tokens and 23 compose tokens, pinned to `ba11545`.
- **CSS contract (PostCSS):**
  - every rule is screen-only and scoped, and the real controls are targeted;
  - Arial 14px and the workspace tokens are used, with a colour allow-list;
  - toolbars wrap and tables scroll inside containers, with the `.tabContainer` flex bounds;
  - the outbox `display` is untouched, and there is no hiding, `!important`, `content` or body overflow;
  - `#note` is a document field with native resize and a visible outline;
  - billing sits on paper with ink and no selector targets `.text-danger`, and the sole `btn-danger` rule is `color: #fff`.
- **Resized compose dialog:** at 146px and 180px frames, the sheet chrome leaves at least 110px for content. Compose action buttons shrink and wrap at 14px, with no compose overflow, transform, zoom or width media query.
- **Theme pairing:** the sheet, table, `td` and billing `td` set ink; `.form-control` and `:focus` set ink on paper; the gutter rules are present.
- **Mode controller:** the list follows a workbench host two frames up and returns to legacy on toggle. The dialog activates under `top` without mutating its form or unsaved values. The legacy shell and direct load stay inactive.

`ClinicalWorkspaceAssetsTest` gains two PHPUnit cases: a temporary versioned `patient-messages.css`, and the shipped file's version.

### Outside the repo

Evidence lives in `/Users/craig/.hermes/projects/openemr/verification/cron-patient-messages/`.

**TDD record:**

- Initial slice: `red-jest.txt` (8 failed / 5 passed; the passing five are the parity and mode invariants, which hold before and after) and `red-native-php.txt` (3 failures), then green.
- QA-driven flex overflow and Delete colour: `red2-jest.txt`, then `green2-jest.txt`.
- Independent review P2s (dark theme `.table` and `.form-control` contrast) plus the danger-contrast and gutter findings:
  - `red3-jest.txt` (4 failed);
  - `red-native-qa-themes-corrected.txt` (415 passed, 51 failed against the unfixed CSS);
  - then the CSS fix.
  - `red-native-qa-themes.txt` is an earlier run whose harness still had wrong RTL, Tab and focus preconditions. It is kept only for transparency.

- Final review P2 (a balance with no billing note has no danger spans, so its text inherited the theme's near-white `.table` colour on the white cell):
  - `red4-jest.txt` (2 failed);
  - `red4-native-qa.txt` (660 passed, 6 failed: every dark balance-only case at 1.05:1);
  - then one `color` declaration on the billing cell.

- Resized compose dialog (authenticated candidate-overlay finding, see Overflow):
  - `red6-narrow-jest.txt` (2 failed, against the `91f99a5` CSS). `red5-narrow-jest.txt` is an earlier run whose test helper read only the first matching rule; the helper now merges matching rules in source order.
  - `red5-narrow-native-qa.txt` (1254 passed, 64 failed: every 146/180px compose case; the new-note baseline premise passes);
  - then the CSS correction: `green6-narrow-jest.txt` and `green5-narrow-native-qa.txt`.

**Final runs:**

| Check | Result | Record |
| --- | --- | --- |
| Targeted Jest | 18/18 | `green6-narrow-jest.txt` |
| Full Jest | 38 suites, 690 tests passed | `full-jest-narrow.txt` |
| Stylelint, repo config | exit 0 | `stylelint-narrow.txt` (earlier: `stylelint-final.txt`; `lint.txt`, with 4 errors, was a pre-fix run) |
| ESLint, repo `eslint.config.mjs`, on the new test | exit 0 after the resized-dialog tests | `cron-patient-messages-live/controller-lint-final2.txt` |
| `php -l` on the four changed PHP files | clean | `php-lint.txt` |
| Host-PHP helper harness, no vendor | pass | `green-native-php.txt` |
| Invariant diff | only `<body>` removed; added lines are only the import, asset tags and body class | `invariant-diff.txt` |
| Native QA | 1318 passed, 0 failed (earlier 666 before the new-note fixture and 146/180px frames) | `green5-narrow-native-qa.txt`, `native-qa/native-qa.json` |

ESLint ran through temporary links in the worktree's empty, gitignored `node_modules`, pointing to the four config imports in the shared node_modules (`globals`, `eslint-plugin-jest`, `@eslint/js`, `@eslint/eslintrc`). The links were removed afterwards.

### Native QA (`native-qa.py`)

This is real native-browser evidence (headless Chrome 154 driven over CDP) against offline synthetic fixtures. It is not authenticated-application evidence. The harness:

- **Compiles the real themes on each run.** `compile-themes.cjs` compiles `interface/themes/oe-styles/style_light.scss` and `style_dark.scss` from the worktree with the existing sass 1.105 and bootstrap 4.6.2. It uses the repo's own `sass-bsimport-loader` transform and the `webpack.themes.js` include paths and importer, writing to `themes/` (autoprefixer is not run).
- **Renders the fixtures.** Hand-written synthetic markup shaped like each page's PHP output is rendered with the compiled theme, `workspace.css`, `patient-messages.css` and the real `mode.js`, inside a same-origin iframe under a shell body with or without `workbench-active`.
- **Blocks the network.** It aborts every request through CDP `Fetch` and never fabricates a response. A probe request proves the interception is live.

It renders four page fixtures:

- the list with a billing note, whose balance and note sit in `text-danger` spans;
- the list with a balance but an empty billing note, whose balance row has no spans, matching the PHP branch where `$colorbeg` is empty;
- the compose dialog for an existing note (Print, Cancel, Save as new, Append);
- the compose dialog for a new note (Cancel, Save), the branch that the authenticated overlay exercised.

For each theme (light, dark) × fixture × `dir` (ltr, rtl) × width (360/768/1280px, plus 146/180px resized-dialog frames for compose), it checks:

- **Legacy and print:** the legacy-host and workbench-print renders equal the baseline in geometry, computed CSS and per-element contrast.
- **Workbench rendering:** activation, Arial 14px, and body direction equal to the theme baseline.
- **Overflow:** page-level horizontal overflow is exactly 0 in workbench mode. The legacy baseline value is reported separately.
- **Control reach:** every baseline-reachable control is still visible and hit-testable, and the control inventory is the same.
- **Contrast:** every text and field element reaches min(4.5:1, the theme's own baseline ratio), including fields focused by script.
- **Danger colours:** `text-danger` and `btn-danger` colours equal the theme.
- **List:** eight columns render, the outbox stays hidden, toolbars wrap, and the inbox scrolls internally at 360px.
- **Balance-only list:** the billing cell and every other `td` reach an absolute 4.5:1. The general check only requires min(4.5, baseline), and the legacy baseline here is itself 1.05:1.
- **Compose:** the textarea keeps native resize, has the document-field style, and toolbars wrap. Every control that sits wholly inside the unscrolled frame at baseline still does. Save is present, hittable and inside the frame, and is never clicked. Action and field text stays at 14px.
- **Resized compose frames (146/180px):** every original control fits inside the frame. For the new-note branch, the harness first checks the premise that the unstyled original fits with 0 overflow. In the existing-note branch, the original nowrap `btn-group` overflows by 53/19px at baseline. The workbench wraps it to 0px overflow.

Real input through `Input.dispatchKeyEvent` and `Input.dispatchMouseEvent`:

- **Compose keyboard:** Tab reaches type, recipient, due date and note. Each keyboard-focused field meets the contrast floor and has a visible focus indicator.
- **List keyboard at 360px:** Tab reaches all 11 inbox controls in order. Each lands inside the inbox viewport, the page never scrolls sideways, and Shift+Tab returns to the previous inbox control.
- **List pointer at 360px:** a horizontal wheel/trackpad scroll moves only the inbox, and a real click toggles a checkbox in the scrolled table.

Unsaved textarea, select and checkbox state also survives legacy/workbench toggles.

Two fixes were made to the harness itself. Neither forces a pass:

- `Emulation.setFocusEmulationEnabled` is on, because a headless page otherwise has no system focus and `:focus` never matches.
- The wheel delta sign follows the inbox's computed `direction`. The compiled LTR theme sets `body { direction: ltr }`, so a nominal `dir="rtl"` fixture still lays out the inbox LTR. A leftward wheel at `scrollLeft` 0 was correctly a no-op, and the earlier RTL failure was a wrong precondition.

Screenshots are in `native-qa/`. Boxes in place of icons there are the theme's icon font, which cannot load offline.

## Limitations

- **Candidate overlay, not deployment.** One authenticated run injected the `91f99a5` candidate assets browser-locally into a real session and resized a real `dlgopen` compose dialog. That run found the 146/180px regression described under Overflow. Its harness reports overall `ok: false` and `acceptance: false`, because of blocked automatic page requests, page errors and the undeployed candidate. The correction is verified only by offline fixtures and Jest. An authenticated rerun against the corrected candidate is still pending. Nothing here claims deployed, clinical, full-source or runtime parity.
- **Fixture versus application.** The other browser evidence uses synthetic fixtures. No authenticated OpenEMR session, PHP rendering, DB, jQuery, `dialog.js`, `restoreSession`, AJAX save, datetimepicker or real `dlgopen` mounting was exercised. There was no live, restricted-role, screen-reader, touch-gesture, real print-dialog/pagination or deployment verification.
- **Themes not covered.**
  - Solar, manila, colour and compact variants were not compiled or checked.
  - The RTL theme variant (`oemr-rtl.scss`) cannot compile here, because `bootstrap-rtl` (a napa git dependency) is not installed and nothing was installed. RTL coverage is therefore `dir="rtl"` on the LTR themes, which themselves force `direction: ltr` on body.
  - CSS emitted by webpack's css-loader/autoprefixer is not reproduced.
- **PHP gates.** Docker is unavailable and `vendor/` is empty, so there was no full isolated PHPUnit run, PHPStan, Rector or PHPCS. The two new PHPUnit cases were not executed under PHPUnit. Their logic was exercised by the host-PHP harness, and `php -l` passed.
- **Inherited defects.** The legacy dark theme's unreadable balance-only row (1.05:1), the malformed list markup and the existing-note compose toolbar overflowing a 146/180px resized dialog are pre-existing. They remain in legacy mode.
- **Design fidelity.** Fidelity remains partial and unaccepted, and the required GitHub review is a separate gate.
