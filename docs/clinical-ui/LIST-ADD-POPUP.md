# Add-to-list inline box workbench palette

Ticket: **OPEMR-12**. Branch: `OPEMR-12-list-add-inline-popup`. Doc: `docs/clinical-ui/LIST-ADD-POPUP.md`.

Status: **source-implemented, pending hosted verification; partial; a bounded palette change, not a redesign.** It is not clinical acceptance and closes none of the 22 rows in [ACCEPTANCE.md](ACCEPTANCE.md). It needs ordinary review approval. It does not merge, deploy, change the database, or add a cron job.

## What the box is

`library/options_listadd.inc.php` is the original **shared fragment**. Its own header says it "CANNOT stand alone". It has no route, page or body class of its own. Six actual include paths include it into their own page: `interface/forms/LBF/new.php`, `interface/new/new_comprehensive.php`, `interface/patient_file/history/history_full.php`, `interface/patient_file/summary/demographics_full.php`, `interface/patient_file/transaction/add_transaction.php` and `interface/usergroup/facility_user_admin.php`. It sits next to `library/options.inc.php` data type 26 selects and their **Add** buttons (`.addtolist`). It renders one hidden `#newlistitem` box, positioned absolutely, and a jQuery script that fills, shows, saves and hides that box.

This phase changes only the palette of that existing box while it sits in an active workbench. It is not a modal, a dialog or a new popup, and the TODO in the fragment ("Convert this to a modal or a dialog") is still open.

## Change

Exactly three additions to the frozen original fragment, nothing else:

1. `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;`, added in sorted order before the existing `CsrfUtils` import.
2. One `<link rel="stylesheet" media="screen">` placed straight after the fragment's PHP block, before the original hidden-DIV comment. The web root is escaped with `attr()`, and the `?v=` version comes from `attr_url((new ClinicalWorkspaceAssets())->version('list-add-popup.css'))`. It uses an inline expression rather than a new PHP variable: the fragment is included into its caller's scope, so a new assignment there could overwrite a caller variable. `$session` is still the only assignment.
3. An `oe-list-add-popup` marker class added to the end of the box's existing class list. `position-absolute bg-light border border-dark` stay as they were.

Every other byte of the fragment, all its JavaScript and all its markup, matches the frozen original. Removing the three additions restores it byte for byte.

`src/Common/Assets/ClinicalWorkspaceAssets.php` gains one sorted allow-list entry, `'list-add-popup.css'`, after `'lbf-document.css'`. Nothing else in the helper changes.

New `interface/clinical-workspace/list-add-popup.css`: one `@media screen` block. Every selector starts with `html.oe-workbench-context #newlistitem.oe-list-add-popup`. It declares no custom properties; it uses the `--oe-wb-*` tokens that the existing shared `popup.css` defines on `html.oe-workbench-context`. The rules are:

- **Box:** `background-color: var(--oe-wb-paper) !important` and `color: var(--oe-wb-ink)`. The box keeps `.bg-light`, and Bootstrap 4.6 emits that class as `background-color: #f8f9fa !important` (`$light: $gray-100`), so only an important declaration can replace it. This is the sheet's only `!important`.
- **Text fields** (`.form-control` not `.is-invalid`, `.is-valid` or inside `.was-validated`): paper and ink at rest and on `:focus`; disabled paper and ink for `:disabled` and `[readonly]`, which also wins on a focused read-only field; the placeholder is ink at `opacity: 1`. Validation states keep the theme's paint and semantic borders.
- **Focus ring:** `outline: 2px solid var(--oe-wb-petrol)` with a 2px offset on the field and on both `input[type='button']` buttons. `:focus` and `:focus-visible` are separate rules, so an engine that does not support `:focus-visible` still applies the `:focus` ring. Both ring rules come before the field palette rules, so the ordering avoids descending specificity without any lint suppression. The sheet carries no stylelint comments and no config override.

Rule order is fixed by the test: box, `:focus` ring, `:focus-visible` ring, normal/focus field, disabled/readOnly field, placeholder. The disabled/readOnly rule stays after the normal/focus rule, so a disabled field that matches `:focus` keeps the locked palette. The test's disabled-and-focused assertion is explicitly **synthetic**: jsdom cannot focus a disabled element, so the test forces `:focus` to match in its simulated cascade. It is not evidence of native focus behaviour on a disabled field.

No rule sets font, padding, width, border, display, visibility, z-index or position. No wrapper element is added, and Add/Cancel keep their `btn-primary`/`btn-secondary` theme paint. Without `oe-workbench-context`, on a box without the marker, and in print, no rule applies and the box keeps the original theme. Contexts lacking the marker keep the legacy rendering; direct page activation of the marker is not established.

## Behaviour that stays original

This is inherited behaviour, recorded rather than changed:

- **Form choice:** the generic single-field form is used, or the state form (full name plus abbreviation) when the list is `state` and the `state_custom_addlist_widget` global is on. The state form's `<li>` markup is malformed as originally written (`/><li>` where a closing tag belongs) and is left as is.
- **Keyboard:** Enter anywhere in the box calls `SaveNewListItem` and suppresses the default action. There is no Escape handler and no focus trap. **Cancel** hides the box; **Add** saves.
- **Position and focus:** the box is set to `display: inline`, centred on the click's `pageX`/`pageY`, and focus goes to `#newlistitem_value`. After a successful save it is hidden. Focus is not returned to the Add button.
- **Client validation:** `alert()` rejects a value that starts with a digit or contains `'` or `"` (and checks the state abbreviation the same way). No other validation happens on the client.
- **Request:** `$.getJSON` sends an HTTP **GET** to `library/ajax/addlistitem.php` with `csrf_token_form`, `listid`, `newitem` and `newitem_abbr`. The generic form sends the title as the abbreviation. There is no failure callback, so a network or parse failure is silent.
- **Option propagation:** on `error == ''` every `select.addtolistclass_<listid>` on the page is rebuilt from the returned options. The field that opened the box selects the new item; every other select keeps its current value. Any other `error` is shown with `alert()`.
- `window.oeUI.optionWidgets` still exposes `AddToList`, `CancelAddToList` and `SaveNewListItem`.

## Authorisation and inherited request debt

- **Caller:** `options.inc.php` renders the Add button only when the user passes the list's own `lists` ACO, if one exists, or otherwise `lists`/`default`.
- **Backend:** `addlistitem.php` loads `globals.php` (session) and checks the CSRF token. The endpoint source has no explicit list ACL check of its own, and UI visibility of the Add button is not server authorization. Global authentication is verified at `globals.php` lines 741-742.
- **GET mutation:** it inserts into `list_options` from a GET request. CSRF is checked, but a state change over GET remains inherited debt.
- **Races:** the duplicate-title and duplicate-id checks and the `max(seq) + 1` sequence are separate, non-atomic queries. Concurrent adds can produce duplicates or equal `seq` values.

None of this is changed or fixed here; it is outside the scope of this palette change and stays open.

## Tests-first record

`tests/js/list-add-popup.test.js` was committed before any production change in `dddc5d7a` (tests only). Hosted JS run `38904533355` on that commit finished RED: 6 intended failures, 1311 passes, 62 suites. The controller independently checked the frozen fragment fixture (`tests/clinical-ui/fixtures/list-add-popup-original.txt`) and the embedded helper baseline against the actual `origin/master` `18647270`. The test was **changed after that RED commit**, by more than a comment correction. The earlier "posts to" became "sends GET to" comment fix is still there, but the later edits also: moved the focus-ring rules ahead of the palette rules in the expected rule order; retained the indexed sheet mutants; added two rule-order negative cases; and added an explicitly synthetic disabled-and-focused assertion. The RED run above was against the earlier test, so it does not describe the current test, and the current test is not claimed to be unchanged from the RED commit.

## Verification status

Controller-run checks so far, all on the current source:

- `php -l` on the fragment (`library/options_listadd.inc.php`) and on the helper (`src/Common/Assets/ClinicalWorkspaceAssets.php`): both **PASS**.
- `stylelint` on the actual, non-ignored stylesheet (`interface/clinical-workspace/list-add-popup.css`): no warnings or errors.
- `git diff --check`: **PASS**.

These are **syntax, lint and whitespace checks only**. `php -l` proves the two PHP files parse; it is not a PHP application gate. No PHP runtime or application test has been run, and no local Jest run was made.

Still pending:

- **Hosted GREEN** for the test and lint gates. Hosted CI has not run on the current source.
- PHP application gates (PHPUnit, PHPStan, the pre-commit suite), which are separate from the syntax check above.
- Ordinary review approval, coverage, and complete hosted CI.

The controller owns the remaining verification; this document makes no runtime claim.

What the test covers (source level, with a simulated cascade):

- the fragment equals the frozen original plus exactly the three additions, with no new caller-scope assignment, and 20 fragment mutations (Enter handler, state flag, CSRF token, endpoint, propagation, visibility, geometry, fonts, IDs, classes, wrapper, exposed widgets, escaping, media, import order, duplicate link) are rejected;
- the helper equals its baseline plus the one sorted line;
- the sheet is exactly the allow-listed selectors and declarations, in the fixed rule order (focus rules before the palette rules), in one `@media screen` block, with no custom properties and a single `!important`; the indexed sheet mutants are retained and two rule-order negative cases are added, and all of them are expected to be rejected;
- a jsdom cascade against representative theme rules shows paper over `.bg-light` only in the marked workbench box, the field states, validation borders, focus rings and untouched button paint;
- the caller ACL and the backend CSRF/GET contract text are still present.

The frozen-original inverse and the simulated cascade are source and mock checks. They are **not proof of native behaviour or of measured contrast**: they do not run the jQuery script, the endpoint, a database or a real browser.

Known limitations of the cascade simulator:

- Specificity handling of `:not(...)` is naive, so it can disagree with a real engine's specificity.
- Selector errors are ignored rather than reported.
- It gives no actual cascade proof and no contrast proof.

## Not claimed

No endpoint GET or POST was sent. No PHP runtime or application test was run, no local Jest run was made, and no compiled-theme or browser check was run. None of contrast, restricted roles, RTL, zoom, print, keyboard or assistive-technology behaviour is claimed as accepted. The syntax, lint and whitespace checks under Verification status are the only checks run.

## Remaining gates

- **Native original contexts:** the box inside each of the six native host include paths, in a real workbench and standalone, including state-form lists with the global on and off.
- **Computed compiled-theme behaviour:** computed styles from the compiled themes, including RTL, keyboard focus, and print.
- **Keyboard, translated:** Enter, Add and Cancel with a non-English language, where the Add/Cancel values and state-form labels are translated.
- **Real option propagation:** a save against a disposable list on a page with more than one `addtolistclass_<listid>` select, confirming the opener selects the new item and the others keep their values.
- Measured contrast for each palette state.
- Hosted GREEN for the test and lint gates, the PHP application gates, ordinary review approval, coverage, and complete hosted CI.

## Boundaries kept

The 22 original acceptance rows are the reference and are not reopened or closed. Evidence stays on demo data only. The Swedish programme's scope is unchanged, and denial paths (ACL-denied Add buttons, CSRF rejection) keep their original behaviour. Denial boundaries also cover prior tool permissions: a denied tool call is not retried. No seed rows, live database or document changes, outbound calls, Railway deployment or merge.
