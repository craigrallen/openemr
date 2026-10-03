# Patient Finder workbench slice

Status: **local-only, partial.** This is a presentation slice on the existing Finder. It is not clinical acceptance and does not close any of the 22 rows in [ACCEPTANCE.md](ACCEPTANCE.md); row 1 (faster access to patient records) stays open.

## Route and scope

`interface/main/finder/dynamic_finder.php` (rendering `templates/patient_finder/finder.html.twig`) stays the Finder route. The body already carried `oe-clinical-finder` and loaded `workspace.css` and `mode.js`. This slice adds:

- `interface/clinical-workspace/finder.css`, linked after `workspace.css` from an escaped webroot URL and versioned through `ClinicalWorkspaceAssets::version('finder.css')`. The helper's fixed allow-list gains `finder.css`, and nothing else changes in it.
- One additive DataTables `dom` wrapper: `'Rlfrt<"mytopdiv">ip'` becomes `'Rlf<"oe-finder-results"rt><"mytopdiv">ip'`. Every original feature (ColReorder, length, filter, processing, table, options div, info, paging) is still there and in the same order. The new div only groups the processing indicator and the table, so they can be styled as a results sheet. Without workspace mode the div has no styles.
- An additive `oe-finder-results` class on the Recent Patients wrapper (`<div class="table mt-2 oe-finder-results">`).

The query, `dynamic_finder_ajax.php`, the column/sort JSON, exact/partial `searchType`, per-column `fnFilter`, the new-browser-tab toggle and `fnew` CSRF form, `persistCriteria` with CSRF, `restoreSession` row navigation, the Add New Patient `PageHeadingRenderEvent` item and its ACL, the expandable/search heading actions (`dynamic_finder_xpd`), the recent-patient list, the shared heading partial and the shell are all unchanged.

## Presentation (workspace mode only)

Every selector starts with `body.oe-clinical-workspace.oe-clinical-finder`, and every rule sits inside `@media screen`. `mode.js` adds `oe-clinical-workspace` only while a same-origin ancestor has `workbench-active`, so direct, explicit legacy, cross-origin and print views keep the original theme. The layout follows the accepted reference hierarchy:

- **Quiet document heading:** the existing navbar becomes a borderless page head. The real "Patient Finder" title is 1.75rem (28px), weight 650, with tight tracking and wrapping allowed. Add New Patient and the expand/search icons stay in place.
- **Compact toolbar:** the original "Search all columns" field becomes a labelled flex row, up to about 35rem wide. The input can shrink (`min-width: 0`).
- **Readable results sheet:** a white bordered sheet with `overflow-x: auto`. Headers are muted and uppercase, cells are 14px with consistent padding, and every column stays reachable by horizontal scroll. The per-column filter row gets compact inputs.
- **Footer:** the new-tab and exact-search checkboxes wrap with gaps; the info text and pagination wrap.
- **RTL:** logical properties only. The stylesheet has no physical left/right margin, padding, border, text-align or float. Values from `workspace.css` that pointed one way (`text-align: left`, `margin-right`) are overridden logically.
- **Narrow:** at 640px or below the heading is 25px and cell padding is tighter. The heading partial has no toggler, so `.navbar-collapse` is kept visible there. Otherwise Bootstrap hides Add New Patient below 576px, which is legacy behaviour that this mode does not hide.
- No `display: none` or `visibility: hidden`. No control is removed or reordered.

## TDD record

Logs: `/Users/craig/.hermes/projects/openemr/finder-tdd/`. All commands ran via `/Users/craig/bin/openemr-cmd worktree exec feat/clinical-finder-workspace e 'cd /var/www/localhost/htdocs/openemr && …'`.

| Step | Command | Result |
|---|---|---|
| RED (`01-red.log`) | `node_modules/.bin/jest tests/js/clinical-finder.test.js --runInBand` | 4 failed, 2 passed. The two passes are guards on existing behaviour (preserved tokens, legacy toggle) |
| RED | `vendor/bin/phpunit -c phpunit-isolated.xml --filter ClinicalWorkspaceAssetsTest` | 16 tests, 1 error (`Unsupported clinical workspace asset`), 1 failure (shipped `finder.css` missing) |
| GREEN (`02-green-focused.log`) | `jest tests/js/clinical-finder.test.js tests/js/clinical-workspace.test.js` and the same PHPUnit filter | 21/21 Jest; PHPUnit OK (16 tests, 20 assertions) |
| Final (`04-final-gates.log`) | `node_modules/.bin/jest --runInBand --silent` | 28 suites, 428 tests passed |
| Final | `vendor/bin/phpunit -c phpunit-isolated.xml` (includes Twig compilation over all templates) | OK with issues: 5875 tests, 4 warnings, 5 skipped, 14 incomplete. The same warning count was reported before this slice (see VISIT-HISTORY.md) |
| Final | eslint (test), stylelint (`finder.css`), `php -l`, phpcs, rector dry-run (3 changed PHP files), codespell (changed files) | all clean. Stylelint first flagged 3 `no-descending-specificity` orderings, which were fixed by reordering or tightening selectors |

`tests/js/clinical-finder.test.js` checks:

- the real route links the helper-versioned `finder.css` after `workspace.css`;
- the exact new `dom` string and the recent wrapper class;
- about 45 preserved source and template tokens (AJAX, exact/partial search, new tab, ACL, CSRF, `restoreSession`, the heading event, expandable help, labels);
- the stylesheet's scope, screen-only rules, RTL and hidden-content constraints, and the 28px heading;
- jsdom markup shaped like the rendered page, which shows no rule matches any element in legacy mode, the key regions are styled in workspace mode, and the control DOM order is unchanged;
- that the legacy toggle restores the original body class.

These are source/DOM contracts. They do not run DataTables, the AJAX endpoint or real navigation.

No Twig render fixture covers `patient_finder/finder.html.twig`, so there was none to regenerate. The template is covered by the isolated Twig compilation test only.

## Review fix: results squeezed beside the floated search

Codex's independent review (P2) and a real-browser screenshot found the same bug. `overflow-x: auto` makes `.oe-finder-results` a block formatting context, so it sat beside the original DataTables search filter, which is floated, and the table was squeezed. The controller's browser check (`05-browser-float-red.log`) asserts that the sheet's top is at or below the search toolbar's bottom, and it failed (toolbar and sheet both at y≈340).

- **RED** (`06-float-clear-red.log`): a new CSS contract (`clear: both` on the sheet) failed: 1 failed, 5 passed.
- **Fix:** add `clear: both` to the scoped `.oe-finder-results` rule. No control, float or DOM order changed.
- **GREEN** (`07-float-clear-green.log`): focused Jest 21/21, plus clean stylelint and eslint.

Controller final gates (`09-controller-final-gates.log`) reran full JavaScript: 428 tests / 28 suites; full isolated PHP: 5875 tests / 14834 assertions, exit 0 with four inherited warnings, five skipped and fourteen incomplete. ESLint, stylelint, PHPCS and Rector also passed.

Controller full-codebase PHPStan CI configuration passed with zero errors using `php -d memory_limit=8G vendor/bin/phpstan analyse -c .phpstan/phpstan.ci.neon --memory-limit=8G --no-progress --debug` (`08-controller-phpstan-debug.log`). Debug mode avoids the result-cache write that exhausted disk; no baseline or gate was weakened.

Actual authenticated disposable-local Chrome checked the real DataTables render: results below the search toolbar after the fix, all original controls across mode toggles, global/column/empty search, recent/list tabs and correct synthetic patient routing. Twelve LTR/RTL geometry cases at 1440/1024/768/640/390/320px passed with Add New Patient and footer options visible. No clinical save or JavaScript error. The original advanced-search open/close handler persisted then restored a local UI preference; this was not a clinical-data write. Local sources were restored afterward. Evidence: mission `browser-qa/finder-workspace-local.json` and `finder-workspace-{1440,390}-local.png`. Images are local feature evidence, not Railway deployment. Compared with the accepted schedule reference, Finder follows heading/document/table styling, not schedule semantics or full research fidelity.

## Blockers and limits

- Local host remains short of disk space; do not start further dependency copies without a resource check.
- Not verified: 200–400% zoom, print, all themes, restricted roles, enabled module/custom-column combinations, column drag-resize and assistive technology. Processing indicator position during a delayed request still needs dedicated evidence.
- No new seed rows, live database/document changes, outbound calls or Railway deployment. Required hosted CI/review and canonical deployment remain separate delivery gates.
