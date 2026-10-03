# Clinical UI — slice 1 status: "All menus" launcher

Branch: `feat/clinical-menu-launcher`, pushed to `craigrallen/openemr`; draft PR [#4](https://github.com/craigrallen/openemr/pull/4). See the latest checkpoint below; historical test records retain their original limitations.
Date: 2026-10-01.

This is the first production slice of the researched redesign only. It does
**not** complete the design. See [PLAN.md](PLAN.md) for later slices.

## Scope: additive only

- **Nothing is removed or replaced.** The existing dropdown menu, patient
  finder, patient and encounter menus, and every other entry point work exactly
  as before. The launcher is an extra way into the **global** menu.
- **Covered:** the live global (main navbar) menu tree for the signed-in
  user, as the server built it for this session.
- **Not covered:** the patient menu (`patient_menus/`, `PatientMenuRole`),
  the encounter forms menu (`encounter/forms.php`, `EncounterMenuEvent`),
  actions reachable only from inside pages, and the patient finder. These have
  not been redesigned or indexed. The launcher is **not** a finder for every
  feature in the app, and this slice makes no such claim.
- **Parity not established.** The hard parity gate in [PLAN.md](PLAN.md) has
  not been run. The Jest coverage of the shipped `menus/*.json` files is a
  static inventory. It does not cover runtime role, facility, configuration,
  module or form variation, so it is not evidence of parity. No old UI may be
  retired on the strength of this slice.

## What changed

| File | Change |
|---|---|
| `interface/main/tabs/js/menu_launcher.js` | New. Indexes the live Knockout menu tree, filters, renders results with `textContent`, guards requirements, dispatches `menuActionClick`. |
| `templates/interface/main/tabs/menu_launcher.html.twig` | New. Trigger button, dialog markup, translated strings (`xlt`/`xla`), scoped `oe-menu-launcher` CSS. |
| `interface/main/tabs/main.php` | +12 lines: loads the script after `tabs_view_model.js`, renders the template next to `#mainMenu`, calls `OpenEMRMenuLauncher.create()` after `ko.applyBindings`. |
| `tests/js/menu-launcher.test.js` | New Jest (jsdom) suite, 78 tests. |

Not changed: the dropdown menu template, `menu_json.html.twig`, `menuActionClick`,
menu JSON, `MainMenuRole`, global CSS/themes, the build, dependencies, the database.

## Behaviour

- **Data source:** `app_view_model.application_data.menu`, the same runtime
  tree the dropdown renders. That tree has already been filtered on the server
  (ACL, globals, `MenuEvent::MENU_UPDATE` / `MENU_RESTRICT` listeners, visit
  forms, blank LBF forms). There is no new endpoint and the raw JSON is not read.
  The index is rebuilt inside a Knockout computed, so changes to labels,
  children or the top-level array show up straight away.
- **Search:** case- and diacritic-insensitive. Every whitespace-separated
  token has to match the label or the breadcrumb. Label matches rank first,
  then menu order. Results show the label, the `Section › Subsection`
  breadcrumb and, for unavailable items, the requirement message (amber text,
  not colour alone).
- **Activation:** before any dispatch, `findBlockingNode` checks `enabled()`
  live on every ancestor header and on the item itself. An action item with no
  `enabled()` fails closed. If anything blocks, the launcher stays open, shows
  the same message the existing alerts use (or a group-specific one) in the
  polite live region, and does **not** call `menuActionClick`. This covers
  `target: 'pop'` items, which `menuActionClick` opens before it checks
  `enabled()`.
- **Dispatch:** `menuActionClick(originalMenuEntry, evt)`, where
  `evt = {type:'click', currentTarget, target, originalEvent}`. Its
  `currentTarget` holds only the label text, so the popup title matches what
  the dropdown passes. Encounter locks, the `load_form.php` fixup,
  `navigateTab` and `restoreSession`, `popMenuDialog`/`dlgopen` and telemetry
  all stay inside `menuActionClick`.
- **Keyboard and accessibility:** a combobox with a listbox inside a
  `role="dialog" aria-modal="true"`, and `aria-activedescendant` for the
  active option. Up/Down arrows wrap, Enter activates, Escape closes, Tab
  cycles between the search field and the close button, and clicking the
  backdrop closes. Opening focuses the search field. Closing restores focus to
  the trigger and resets `aria-expanded`.
- **Pointer focus:** `mousedown` on a result option is cancelled, so the
  non-focusable `<li>` cannot pull focus to the body and leave the open dialog
  with no keyboard handler. A blocked activation also refocuses the search
  field. `mousedown` on the backdrop is cancelled before closing, so the
  browser's default focus change cannot undo the restore to the trigger.
  `mousedown` elsewhere in the dialog keeps its default behaviour. The dialog
  has `tabindex="-1"`, so a click on a non-interactive part (title, header,
  status, empty-state text, padding) focuses the dialog instead of the body.
  Escape and the Tab trap keep working, and Tab returns to the search field.
  The dialog is not a Tab stop, and `:focus` on it has no outline.
- **IME composition:** keydowns with `isComposing`, keyCode 229, or between
  `compositionstart` and `compositionend` are left to the IME. Enter, arrows,
  Escape and Tab are not handled. This includes the commit Enter that Safari
  sends after `compositionend` with keyCode 229. A normal Enter after the
  composition still activates. Composition state is reset on open.
- **No global shortcut.** The launcher has no listeners outside its own
  dialog and trigger. A tested case confirms Ctrl/Cmd+K, `/`, Enter and Escape
  pass through untouched.
- **Nothing is persisted.** The query and results are cleared on close, and
  there are no storage APIs. The breadcrumbs contain menu labels only, never
  patient data.

## TDD record (actual commands and output)

Node deps were installed locally in the worktree with
`npm ci --ignore-scripts --no-audit --no-fund` ("added 1175 packages", exit 0).

1. **RED 1, module absent:** `npx jest tests/js/menu-launcher.test.js`
   → `Test suite failed to run … ENOENT … interface/main/tabs/js/menu_launcher.js`.
2. **RED 2, skeleton API and empty template:** the same command
   → `Tests: 38 failed, 2 passed, 40 total`, exit 1. The two passes were
   trivially satisfied by the stub ("requirement 0 items are available",
   "empty query returns every entry").
3. **GREEN:** after implementing the module and template, the same command
   → `Tests: 40 passed, 40 total`.
4. **Integration tests added after GREEN** (the real `menuActionClick` from
   `tabs_view_model.js` with jQuery: tab navigation, popup title, rejected
   patient popup, encounter lock, `load_form` fixup) plus the shell-wiring
   checks. Because these were written after the implementation, they were
   validated with temporary mutations. The file was restored and confirmed
   identical with `cmp`:
   - M1, passing the whole option row as `currentTarget` → 2 failed
     (both popup-title tests)
   - M2, ignoring ancestors → 2 failed
   - M3, no guard at activation → 6 failed
   - M4, `innerHTML` for labels → 2 failed
5. **First-round final:** `npx jest tests/js/menu-launcher.test.js` → `Tests: 48 passed, 48 total`.

### Review round 2: two P2 fixes from an independent review (TDD)

The existing `.click()` tests could not catch these. jsdom does not run the
`mousedown` default action that moves focus in browsers. The new tests use a
`nativeMousedown` helper that emulates it: if `mousedown` is not cancelled,
focus moves to the nearest focusable ancestor, otherwise to the body. The new
`imeKey` helper sends keydowns with `isComposing` and keyCode 229.

6. **RED:** 13 tests were added (pointer focus ×7, IME ×6) before any
   production change. `npx jest tests/js/menu-launcher.test.js` →
   `Tests: 10 failed, 51 passed, 61 total`. The failures were the intended
   defects:
   - focus ended on `body` instead of the search field (×3)
   - result and backdrop `mousedown` were not `defaultPrevented` (×2)
   - a composing Enter called `dispatch` (×4)
   - a composing ArrowDown was intercepted (×1)

   Three tests already passed. These are guards against over-fixing:
   - an available result still dispatches once
   - non-result `mousedown` keeps its default behaviour
   - composition state does not carry over to the next opening
7. **GREEN:** after the `menu_launcher.js` changes, the same command →
   `Tests: 61 passed, 61 total`.
8. **Mutation check.** Each change was reverted on its own, then the file was
   restored and confirmed identical with `cmp`:
   - M5, no refocus on a blocked activation → 1 failed
   - M6, no `preventDefault` on result `mousedown` → 2 failed
   - M7, no `preventDefault` on backdrop `mousedown` → 1 failed
   - M9, no composition flag → 1 failed
   - M10, no keyCode 229 check → 1 failed
   - M11, no reset of the flag on open → 1 failed
   - M8, no `isComposing` check → **0 failed**. No test isolated that check.
9. **Gap closed:** one test was added for `isComposing` alone (keyCode 13, no
   composition events). Under M8 it gives `1 failed, 61 passed, 62 total`.
   After restoring: `Tests: 62 passed, 62 total`.

### Round 3: focus after clicking a non-interactive part of the dialog (TDD)

10. **RED:** 16 tests were added before any production change. Five targets
    (title, header area, status text, empty-state text, dialog padding) each
    get 3 tests: focus stays inside the dialog, Escape closes and restores
    focus to the trigger, and Tab is trapped (search field, then the close
    button). One more guards the search field: its `mousedown` is not
    cancelled, it takes focus, and typing still filters.
    `npx jest tests/js/menu-launcher.test.js` →
    `Tests: 15 failed, 63 passed, 78 total`. All 15 failures were the
    intended defect. Focus fell to `body`, so `contains(activeElement)` was
    false, and Escape and Tab never reached the dialog's keydown listener.
    The search-field guard passed before the fix as well.
11. **GREEN:** minimal fix, template only. `tabindex="-1"` on the
    `role="dialog"` element, plus `.oe-menu-launcher__dialog:focus
    { outline: none; }`. `menu_launcher.js` is unchanged. The same command →
    `Tests: 78 passed, 78 total`. The existing guard "mousedown inside the
    dialog (not a result) keeps its default behaviour" still passes. The
    result `mousedown`/click dispatch tests and the real `menuActionClick`
    popup tests also pass unchanged.
    The RED run doubles as the mutation check: without `tabindex`, 15 fail.

## Other checks run (after round 3)

- `npx jest` (whole JS suite) → `Test Suites: 20 passed, 20 total; Tests: 316 passed, 316 total`.
- `npm run lint:js` (`eslint '**/*.js' --quiet`) → exit 0.
- `npx eslint interface/main/tabs/js/menu_launcher.js tests/js/menu-launcher.test.js`
  → 0 errors. One `no-undef` warning for `__dirname` in the test, the same
  pattern as the existing tests.
- Stylelint run on the template's `<style>` block, extracted and dedented, via
  `npx stylelint --stdin-filename interface/main/tabs/menu_launcher.css` → exit 0
  (re-run after the round-3 template change).
- `php -l interface/main/tabs/main.php` → no syntax errors (host PHP 8.5.11).
  `main.php` was not changed in rounds 2 or 3.
- **phpcs, PHPStan and Rector:** not run. There is no `vendor/` and no
  `phpcs` on the host. See below.

## Not run / blockers

- **PHP and Twig suites:** not run. The worktree has no `vendor/`, no
  `openemr-cmd`, and no running docker stack. `composer install` would need
  network access, which this task does not allow. The automatic Twig
  compilation test (`phpunit-isolated`) should pick up the new template. Run
  `openemr-cmd pit` (or `composer phpunit-isolated`) and `openemr-cmd pst`
  before merge.
- **No live browser check yet:** the launcher has not been seen in a running
  OpenEMR, and screen reader, zoom, RTL and narrow-navbar layout are
  untested. The jsdom tests cover DOM, focus and keyboard logic only. The
  pointer-focus and IME fixes are checked against emulated browser behaviour,
  not real engines or a real IME. They still need manual checks in Chrome,
  Firefox and Safari, each with a CJK IME, and with touch input.
  Recommended check: Selenium/Panther against the dev stack (see CLAUDE.md),
  as admin and as a restricted user.
- **codespell** is not installed on the host, so it was not run.
- **New translation strings** need adding to the translation set through the
  normal process. Until then they fall back to English: "All menus", "Search
  menus", "Search menus by name or section", "Menu items", "Matching menu
  items", "No menu items match your search.", "You must first select a
  therapy group.", "You must first select a therapy group encounter.", "This
  menu item is not available." The other strings already exist.

## Known limitations

- The launcher is deliberately stricter than the dropdown: it blocks a child
  whose ancestor header requirement is unmet (e.g. Ensora eRx without a
  patient). The dropdown does not check header requirements.
- The result count is shown as "Matching menu items: N". It is not
  pluralised per locale.
- Dynamic entries come only from whatever the server put in the global menu
  tree. The patient menu (`patient_menus/`) and the encounter forms menu
  (`EncounterMenuEvent`) are separate menus. They are not indexed and have
  not been redesigned.
- After a click on a non-interactive part of the dialog, focus is on the
  dialog itself. Escape and Tab work, but the arrow keys and Enter only act
  from the search field, so the user presses Tab (or clicks the field) first.

## Railway test server — 2026-10-02 (commit 081ee60)

- **Root cause of failed deployment dcd8ee59:** `.gitattributes` `docker/* export-ignore`
  removed `docker/railway/` from GitHub's source archive that Railway builds from.
  Fixed with carve-outs for `docker/railway/**` and `docker/release/**`; covered by an
  isolated test that lists a real `git archive`.
- **Hadolint CI:** `Dockerfile.dockerignore` removed (it matched `docker/**/Dockerfile*`);
  lint gate unchanged; isolated test asserts only real Dockerfiles match.
- **Review HIGH/MEDIUM items 1–7 fixed** (see `docker/railway/README.md`).
- **Evidence:** isolated `RailwayDeploymentIsolatedTest` 31 tests / 309 assertions OK
  (RED first: 17 failures). Container acceptance `docker/railway/acceptance-test.sh`
  38/38 PASS from a clean archive build against MariaDB 11.4 (RED first: archive missing
  Dockerfile, build failed as on Railway).
- **Historical checkpoint:** live deployment of 081ee60 was not yet verified then.
  Railway requires the extensionless path `/meta/railway/readyz`.

## Verified test deployment and coverage repair — 2026-10-02

- Test URL: https://openemr-testing.up.railway.app — synthetic-data testing only,
  not approved for clinical use. HTTP boundary and OpenEMR both use generated
  credentials held outside the repository. No credentials are published here.
- Authorized Railway project `014ebcd7-0f23-42b3-b017-b21a41660f12`, workspace
  `5f5802b0-af5a-4de1-a2bc-2ff9a0e7b3ab`, testing environment
  `ed77713f-2a78-4b13-9c83-bef83f3d67b1`. Only this project was provisioned.
- Verified deployment `472f23d8-353f-46fd-8c4d-1bdf9bf64820` is SUCCESS, source
  `craigrallen/openemr`, branch `feat/clinical-menu-launcher`, runtime commit
  `1601840ab0a3c679157c922a11d79e58533aa230`. Provider PORT explicitly set to 80
  to match Apache; without it the provider healthcheck could not reach Apache.
- App service `f8e0da1e-d57b-4b21-9b2e-1e18871f5033`, sites volume instance
  `d31644ce-c25a-4033-8ca2-821060cec5d9` READY. DB service
  `f65c53bf-a4f5-4fbf-a0ee-16df16dac1c6`, volume instance
  `2a2deed9-785c-4f02-bd16-f0e102b99574` READY, no public domain or TCP proxy.
  DB hostname `mariadb.railway.internal` read back; private networking ACTIVE.
- Actual runtime DB: OpenEMR 8.5.0, schema 546, 283 tables, zero patients.
  Random admin login passed locally and over public HTTPS; anonymous login 401,
  ready endpoint 200, installer/admin/upgrader/documents direct access 403 even
  with boundary authentication. Restarted app AND DB; login, DB counts and
  synthetic document checksum match before/after restart.
- Hardened startup verifies safety globals before Apache; web PHP removes SOAP
  and Redis extensions and checks the complete restricted function/class set.
  These are defense-in-depth application guards, not a provider network firewall
  or universal proof against every possible outbound path. External integrations
  remain disabled/unconfigured; no real sends, payments or submissions tested.
- Controller container acceptance: 39 PASS, zero failures. Focused isolated
  deployment suite: 67 tests passed. Independent Astra reviewed the final guard
  changes; no remaining blocking findings reported. Historical failed-first
  evidence and raw controller outputs retained in the mission verification area.
- Codecov diagnosis: the launcher test harness used dynamic function evaluation,
  bypassing Jest source instrumentation: 230 statements, zero recorded hits
  despite passing behavior tests. Changed the loader to a real module require;
  full JS suite 20 suites / 316 tests passed with coverage. Launcher now records
  223/230 statements and 95/115 branches. CI generates/uploads JS lcov using
  the existing whole-source scope; no thresholds, exclusions or gates weakened.
  Coverage repair committed as `7185f97`; hosted report must still be read back
  on that exact head. It does not establish browser/role parity.
- Official FK forms 7804, 7800, 7801, 7802, 7426, 7427, 7472 acquired from the
  authority index. Mission `certificates/official/manifest.json` stores source,
  retrieval time, printed versions, SHA-256 and parser metadata. All seven parse
  as XFA PDF 1.7; field filling/render/import usability remains unverified.
  Inera Webcert reference retained; issuer/SITHS/HSA/onboarding and clinical/legal
  approval remain prerequisites for genuine signing/submission.
- PR #4 remains draft and unmerged. No old UI retired. All 22 acceptance rows
  remain open. Next: verify latest CI/Codecov and test deployment, exercise the
  launcher in real browser/admin/restricted/module contexts, then take the next
  bounded additive design/backend slice. The redesign is NOT complete.

## Patient Finder workspace slice — 2026-10-03

Presentation-only Finder slice in `feat/clinical-finder-workspace`; see
[FINDER.md](FINDER.md) for scope, RED/GREEN commands and logs. Controller
verified full Jest 28 suites / 428 tests, full isolated PHPUnit 5875 tests /
14834 assertions (exit 0 with four inherited warnings, five skipped and
fourteen incomplete), ESLint/stylelint/PHPCS/Rector/diff checks. Full-codebase
PHPStan CI passed with zero errors in debug/no-result-cache mode after the
ordinary result-cache write exhausted local disk. No gates/baselines weakened.
Independent Codex Astra found the floated search/results-sheet P2; Claude
fixed regression-first. Actual authenticated local Chrome verified corrected
layout and twelve LTR/RTL desktop/mobile geometry cases, original controls,
global/column/empty search, recent/list tabs and synthetic record routing.
No clinical saves or JS errors; original expansion handler persisted then
restored a local UI preference. Screenshot/reference comparison is partial
Finder fidelity, not full research or clinical acceptance. Wider roles,
modules/custom columns, drag-resize, print, zoom and assistive technology still
need evidence. All 22 acceptance rows remain open. Required hosted CI/review,
merge and canonical test deployment are separate gates, not yet claimed here.
