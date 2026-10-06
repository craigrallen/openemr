# Patient DOB context in the workbench header

The workbench patient header (`#attendantData`, rendered from `interface/main/tabs/templates/patient_data_template.php`) shows the patient's date of birth next to the name and external record ID, with the encounter context beside them.

## Source of the DOB

The header has no separate DOB fetch. The DOB comes only from the existing `str_dob` argument of `left_nav.setPatient` (`interface/main/tabs/js/frame_proxies.js`), which is stored in the Knockout `patient_data_view_model`. Chart pages such as `demographics.php`, `demographics_full.php` and `orders_results.php` publish that value after their own ACL checks. The server builds it as translated text (for example ` DOB: <short date> Age: <age>`, or `Age at death` for a deceased patient).

The three publishers build the value through `OpenEMR\Patient\PatientDobContext::headerString()` (`src/Patient/PatientDobContext.php`). If `DOB_YMD` is a real `Y-m-d` calendar date, the page's existing label closure runs unchanged. That keeps the same translated labels and the same age function per page: `getPatientAgeDisplay` in demographics, `oeFormatAge` for deceased patients, and `getPatientAge` in orders_results. If the DOB is SQL NULL, empty, a zero date (`0000-00-00` or year `0000`), an impossible date (`2020-02-30`) or not in `Y-m-d` form, the page publishes `''` instead of bare labels (` DOB:  Age: `). The header never parses translated label text. "Unknown" is signalled only by the empty string, which is the existing `str_dob` contract. `setPatient`'s signature, ACL checks, when the call is made and who can see it are all unchanged. The slice adds no endpoint and no request.

## Behaviour

| State | Header shows |
|-------|--------------|
| `str_dob` is a non-blank string | The published string exactly as sent, bound with `text:` so it is escaped |
| New patient with `str_dob` null, undefined, empty or whitespace | Translated `DOB: Unknown` (`xlt('DOB')`, `xlt('Unknown')`) |
| Same patient re-published with `str_dob` null/undefined | The DOB already shown stays in place |
| Same patient re-published with a DOB string | The new string replaces the old one |
| Same patient re-published by a chart page whose DOB is now unknown (`''`) | `DOB: Unknown` (an empty string is authoritative; only null/undefined mean "not supplied") |
| Different patient selected | New view model; nothing carries over from the previous patient |
| Patient cleared / no patient | No DOB element |

The DOB element sets `data-dob-state="known|unknown"` to support styling and tests.

### The gap this closes

`pnotes_full.php` and `pnotes_full_add.php` call `setPatient(..., null, ...)` when opened with `set_pid`. When that patient was already open, the same-patient branch called `str_dob(null)`, so the DOB vanished from the header until the dashboard was reloaded. A null or undefined argument now counts as "not supplied". Opening a different patient through those pages shows `DOB: Unknown` instead of a blank space.

Because the name, external ID and DOB appear together, two patients with the same name can still be told apart. Switching patients replaces all three.

## Tests

`tests/js/patient-dob-context.test.js` drives the real `setPatient` proxy and `patient_data_view_model`, and binds the real PHP-rendered template through `tests/js/fixtures/patient-data-template-harness.php`, for every `patient_name_display` variant. It covers: known DOB, same-patient null/undefined refresh, same-patient replacement, a new patient without a DOB, empty/whitespace/undefined as unknown, same-name switching, clearing, no patient, and escaping.

It also runs the real `PatientDobContext` class through `tests/js/fixtures/patient-dob-publisher-harness.php` (no autoloader or DB) for NULL, empty, zero, impossible and malformed dates, and for valid dates including a leap day. It passes that output into the real proxy and template, checking that unknown shows `Unknown` and that a same-patient `null` refresh keeps a valid DOB. A source-contract test checks that every `setPatient` call in `demographics.php`, `demographics_full.php` and `orders_results.php` goes through the guard, and that `main.php` loads `frame_proxies.js` with a new `clinical_ui` cache token.

Cache token history: this slice originally moved the token from `20261003-banner` to `20261003-dob`. After the later workspace-spacing integration, the current value of `$clinicalUiAssetVersion` in `interface/main/tabs/main.php` is `20261003-workspace-spacing-dob`. All four consumers of that variable use it: `js/menu_launcher.js`, `js/workbench_shell.js`, `js/frame_proxies.js` and `css/workbench_shell.css`.

### Original TDD evidence (this slice, before integration)

RED (publisher pages stashed, guard and tests present): `Tests: 3 failed, 47 passed, 50 total`. Each failure was a page missing the guard. Before that, the asset-token test failed on its own (`Expected: not "20261003-banner"`). GREEN with all changes: `Test Suites: 3 passed`, `Tests: 125 passed, 125 total` across the three suites below.

```
npx jest --runInBand --coverage=false --cacheDirectory ~/.hermes/cache/scratch/jest-batch2-patient-dob \
  tests/js/patient-dob-context.test.js tests/js/patient-identity-banner.test.js tests/js/workbench-shell.test.js
```

### Refreshed controller evidence (after the staged integration merge)

On the refreshed integration checkout, the controller re-ran the full Jest suite: 38 suites, 722 tests, all passing. `php -l` passed on all six changed PHP files, and `git diff --check` passed. This is local evidence from an isolated scratch checkout. It is not a hosted CI run, and the change has not been merged or deployed to production.

## Not verified here

- Fresh hosted CI is still needed and has not been run for this integration: full-codebase PHPStan (level 10) with baseline-regeneration stability (retain this slice's obsolete-entry removals; add no suppressions), PHPCS, Rector dry-run, the PHPUnit suites, and coverage.
- Runtime DOB navigation (opening a chart, switching patients, and moving from demographics to patient notes in a live session) has not been verified against a running stack.

- Real browser rendering and real chart navigation (demographics → patient notes with `set_pid`) have not been exercised against a running stack.
- `DOB: Unknown` uses the existing `DOB` and `Unknown` translation keys. Rendering in non-English languages has not been checked against a live language table.
- The harness label closure only echoes the validated date. The real `xl()`, `oeFormatShortDate()` and age closures need globals and a DB, and were not run. No PHPUnit run was possible here because there is no `vendor/` in this checkout, so PHPStan and PHPCS have not been run on `PatientDobContext.php` either. Only `php -l` was run.
- Other `setPatient` callers were not changed: `pnotes_full.php` and `pnotes_full_add.php` (pass `null`), `billing_report.php`, `messages/templates/linked_documents.php`, and the comlink telehealth module's `telehealth-calendar.js`. Their `str_dob` handling was not audited in this slice.
- ESLint: `eslint.config.mjs` gives `tests/js/**/*.js` the Node globals, which clears the `__dirname` `no-undef` warnings in Jest suites. The 53 warnings in `frame_proxies.js` are the same count as on HEAD (browser globals shared across scripts).
