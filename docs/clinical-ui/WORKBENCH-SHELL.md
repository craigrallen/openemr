# Clinical workbench shell

This slice changes the real `interface/main/tabs/main.php` shell. The 206px navigation rail is the default. It presents the same server-filtered Knockout menu tree as the existing menu, under visual Work, Patient, and Practice headings. Existing categories remain nested and retain their original order within each heading. Unknown module categories appear under Practice. No menu JSON, ACL rule, URL, target, or action is rewritten.

The rail renders every live action recursively, including runtime module and form entries. Categories start collapsed. Search matches translated labels and ancestor paths. Grouping uses the original source label saved before translation; the model also retains `menu_id`. A click passes the original `menu_entry` and browser click event to `menuActionClick`, which continues to own tab activation, form handling, locked encounters, popups, and telemetry. The rail checks live `enabled()` state on the action and every ancestor before dispatch, including popup actions. Disabled items remain visible and focusable, and a blocked click announces the launcher's requirement message in a visible live region. The existing All menus search remains available.

The top header retains the actual user menu, patient finder, module render hook, branding, and session behavior. The existing patient and encounter control strip stays above the main tabs. The default workbench is bounded to the viewport; its rail scrolls independently while the header, patient strip, tabs, and iframe frame area remain in the flex chain. Iframe content keeps its own scroll. The shell styles its toolbar, tabs, and frame border without styling iframe contents. The current tab supplies the content heading. The mobile drawer adds a backdrop, makes the page behind it inert, traps focus, and supports Escape and backdrop close with focus restoration. It does not intercept normal typing. RTL uses logical borders and side positioning.

The **Legacy navigation** control restores the original navbar menu. Browsers with native `Element.moveBefore` move the attendant, tabs, and frames nodes into their legacy direct-child positions using that state-preserving primitive. Other browsers keep those nodes in their original parents throughout the mode change; `display: contents` and equivalent full/compact theme flex rules give them the legacy visual layout. Ordinary `insertBefore` or `appendChild` on the iframe ancestor chain can reload an iframe and discard an unsaved draft, so the transition never uses those operations. The control stores only the navigation mode (`workbench` or `legacy`) in local storage. No patient information is stored by this shell.

## Scope against the 22 features

The shell is supporting navigation infrastructure. It is not one of the 22 features in [ACCEPTANCE.md](ACCEPTANCE.md), and it does not change the status of any of them. All 22 remain listed and tracked there. The shell removes no existing menu entry, route, or legacy layout, so the screens those features will build on remain reachable from both navigation modes.

## Verification

Current checks on the uncommitted slice:

| Gate | Command | Result |
|------|---------|--------|
| Jest | `npm run test:js -- --runInBand --silent` | 22 suites, 339 tests pass |
| ESLint | `npm run lint:js` | pass; changed files also have no warnings |
| Stylelint | `npm run stylelint` (project `.stylelintrc.json`, which covers plain `.css`) | pass |
| PHPStan | `php -d memory_limit=1G vendor/bin/phpstan analyze -c .phpstan/phpstan.ci.neon --no-progress --debug interface/main/tabs/main.php` | no errors on the changed PHP file; full analysis could not complete in this sandbox (worker socket denied, then 1 GB memory exhausted in single process mode) |
| Rector | `vendor/bin/rector process --dry-run --no-progress-bar --debug` (full codebase) | no changes |
| PHPCS | `vendor/bin/phpcs src/Menu/MenuRole.php interface/main/tabs/main.php` | pass |
| PHP syntax | `php -l` on both changed PHP files | pass |

`MenuRole` writes `sourceLabel` only when an entry is a `stdClass`. Menu JSON is decoded with `json_decode` without associative mode, so every real entry is one. The guard narrows the type for PHPStan without a suppression.

The Jest suite covers all four shipped role menus, recursive coverage, runtime insertion, search, original-object dispatch, live ancestor and encounter requirements, popup rejection and feedback, stable focus across context changes, source-label grouping, native and fallback transition paths, drawer focus/backdrop behavior, and static viewport CSS rules. Jest does not prove iframe browsing-context survival or measure layout. The controller's real Chrome SOAP draft check previously found a lost multiline draft on the old transition. The fixed transition needs that real-browser check rerun before publication, along with full and compact legacy layout checks. The browser controller still needs to capture real viewport metrics at 1440×1000 and zoom levels and check patient/encounter changes, dynamic modules, popup/form routes, and RTL in the runtime before deployment.
