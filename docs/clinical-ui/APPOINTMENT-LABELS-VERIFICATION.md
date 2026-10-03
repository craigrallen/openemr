# Appointment editor: label association, focus outline and keyboard pickers

Scope: `interface/main/calendar/add_edit_event.php`, `interface/main/calendar/add_edit_event.js`,
`interface/clinical-workspace/appointment.css`.
Regression tests: `tests/js/clinical-appointment.test.js` ("schedule and status labels name their controls",
"text inputs and selects draw a real outline on focus, not only a box-shadow",
"patient and group pickers open from the keyboard").

## Defects

| Visible label | Control | Before | After |
|---|---|---|---|
| `#tdallday4` "duration" | `form_duration` (`#tdallday5`) | no `for`; field named only by `title` | `for='tdallday5'` |
| `#tdrepeat2` "until date" | `form_enddate` | no `for` | `for='form_enddate'` |
| `#title_apptstatus` "Status" | `form_apptstatus` (from `generate_form_field`) | no `for` | `for='form_apptstatus'` |
| `#title_prefcat` "Exclusive Category" | `form_prefcat` | no `for`, select had no id | `for='form_prefcat'`, select gains `id='form_prefcat'` |

Clicking a label now focuses its control, and screen readers announce the visible label text.

Focus: Bootstrap sets `.form-control:focus { outline: 0 }` and the workbench ring was `box-shadow` only.
Forced-colors mode (Windows High Contrast) drops `box-shadow`, so focused text fields and selects had no indicator.
The scoped `:focus` rule now adds `outline: 2px solid transparent`. Normal rendering is unchanged; forced-colors
mode repaints the transparent outline in a system colour.

## Keyboard picker activation

The Group field (`form_group`) is `readonly` and opens its picker only from `onclick='sel_group()'`, so a keyboard
user could focus it but not open the picker. `add_edit_event.js` now has `bindPickerKeys(document)`, called first in
the page's existing `$(function () { ... })` block. It adds a `keydown` listener only to a field that is
**read-only and** carries the expected handler (`form_patient` → `sel_patient()`, `form_group` → `sel_group()`).
On plain Enter or Space (no Ctrl/Alt/Meta, not auto-repeat) the listener prevents the default and calls the field's
own `click()`, so the original inline handler runs once. `sel_group()` still calls `top.restoreSession()` before
`dlgopen('find_group_popup.php', ...)`; session handling is untouched. Mouse click behaviour is unchanged.

The Patient field (`form_patient`) is **not** `readonly` in this page (nor at the pre-restyle baseline 949886b), so
it is deliberately left unbound: typing, Enter and Space keep native behaviour, and mouse click still opens
`find_patient_popup.php`. No `role="button"` was added to either field, and no `readonly` was added to Patient.
Keyboard activation of the Patient picker therefore remains unavailable; making it available would require a
product decision to make the field read-only or add a separate picker button.

Tests load the real `add_edit_event.js` into jest's jsdom (which runs scripts), render the real Patient and Group
`<input>` markup from the PHP (PHP stripped) so the original inline `onclick` attributes compile, and record
`restoreSession`/`dlgopen` calls. They cover Enter and Space on Group (one `restoreSession` then one
`find_group_popup.php`, default prevented), native click parity, Tab/letters/auto-repeat/modified keys ignored,
Patient keys untouched, a field with the wrong handler left unbound, double binding not opening twice, original
names/ids/handlers with no `role` and no Patient `readonly`, and the ready-block call. They were run red first
(`bindPickerKeys is not a function`, 15 failing) before the implementation.

## Unchanged

All `name`s, existing `id`s, inline handlers (including `onclick='sel_patient()'`/`onclick='sel_group()'` and
Group's `readonly`), `sel_patient`/`sel_group`/`setpatient`/`setgroup`, jQuery bindings, the POST target, tab links, event dispatches and the
form's direct-child `<div>` count (tested by the existing inventory baseline). `add_edit_event.js` toggles these
labels by `id` and `style` only, and reads `f.form_prefcat` by name. Neither depends on `for`. No booking, submit,
SOAP or shell code was touched.

## Accessible-name change (intentional)

`form_duration`, `form_enddate`, `form_apptstatus` and `form_prefcat` were previously named only by their `title`.
Their accessible name is now the visible label text (WCAG 2.5.3 Label in Name), and the `title` becomes the
description. The `form_prefcat` name includes the visible "(If selected, …)" hint inside the label.
The Patient and Group names are unchanged (they already had `for` labels); only their keyboard behaviour changed.

## Commands

```
node_modules/.bin/jest --runInBand --coverage=false \
  --cacheDirectory ~/.hermes/cache/scratch/jest-batch2-appointment-labels   # 30 suites, 550 tests passed
npm run -s lint:js                                                           # exit 0
npm run -s stylelint                                                         # exit 0
php -l interface/main/calendar/add_edit_event.php                            # no syntax errors
git diff --check                                                             # clean
```

`eslint` on `add_edit_event.js` reports 0 errors and the file's existing `no-unused-vars` warnings for global
functions called from PHP; `bindPickerKeys` joins that list for the same reason.

## PHP coverage of the changed markup

`add_edit_event.php` is a procedural page; CI records its coverage only from real HTTP requests, through
`ci/auto_prepend.php` in the `e2e` suite of `test.yml` (see `ci/README-COVERAGE.md`). Jest tests read the PHP
source and do not execute it.

`tests/Tests/E2e/AppointmentFormLabelsTest.php` logs in as admin and loads the page in new-appointment mode.
That request renders all four changed labels, the `id='form_prefcat'` select and the `bindPickerKeys(document)`
call (none are inside a conditional). `bindPickerKeys(document)` runs in the page's jQuery ready handler, so the
test first registers its own ready handler through `executeAsyncScript` and waits for it to run. jQuery runs ready
handlers in registration order, so the page's handler has run by then. There is no fixed sleep. The test then
asserts that each label's browser-resolved `label.control` is the intended control. It also asserts that the
Patient field is typeable (`readOnly` is false), and that Enter on it neither calls `sel_patient()` nor is
prevented. Each `executeScript` result is checked with `assertIsString` before `json_decode`.

Limits:

- The test has **not been run locally** (no Docker stack or `vendor/` here). Only `php -l` was run on it. It runs
  in hosted CI's e2e job.
- The Group picker branch of `bindPickerKeys` is not exercised by this E2E test, because the Group field renders
  only when `enable_group_therapy` is on. Jest covers that branch in JS.
- No RED run: the test covers markup that is already in this branch, and the "before" state was not run in a
  browser.

## Still needed: browser acceptance

These checks have **not** been run in a browser:

- Click each of the four labels and confirm focus moves to its control. Repeat for "Exclusive Category"
  after selecting the In Office category.
- Check the screen-reader name of each control (Chrome accessibility pane or NVDA/VoiceOver).
- In Windows High Contrast / `forced-colors: active` emulation, Tab through the Patient/Provider tabs and confirm
  a visible ring on every text field and select.
- Confirm normal (non-forced) focus looks the same as before.
- On a group appointment (`group=true`, groups enabled), Tab to Group, press Enter and then Space: the group picker
  opens once each time and the session is still valid in the popup. Confirm mouse click is unchanged.
- On a patient appointment, confirm the Patient field still accepts typing and click still opens the patient
  picker; confirm Enter there does not submit or navigate.
- Screen-reader announcement of the Group field (read-only text input; no role change) has not been checked.
