# History and Lifestyle editor (workbench document)

Route: `interface/patient_file/history/history_full.php` (Patient → History → Edit).

Inside an active clinical workbench the editor reads as one quiet document sheet: ruled
paper surface, underline tabs, petrol Save and a paper Cancel. Outside the workbench
(legacy direct page) and in print, the page renders exactly as before.

The History **view** (`history.php`, `history-document.css`) is a separate lane and is not
touched here.

## What changed

| File | Change |
|------|--------|
| `history_full.php` | Head block after the page `<style>`: `history-editor.css` (`media="screen"`) and the shared `mode.js` (`defer`), both versioned by `ClinicalWorkspaceAssets`. Body class `oe-clinical-history-editor`, container class `oe-history-editor`, action group class `oe-history-editor-actions`. Nothing else. |
| `interface/clinical-workspace/history-editor.css` | New route stylesheet. |
| `src/Common/Assets/ClinicalWorkspaceAssets.php` | `history-editor.css` added to the allowed names. |

ACL checks, CSRF token, form action/`onsubmit`, hidden `mode` field, Save/Cancel markup,
tab renderers, validation and skip-condition scripts are byte-for-byte unchanged (pinned by
a sha256 revert test).

## Stylesheet rules

- Every rule sits in `@media screen` and starts with
  `body.oe-clinical-history-editor.oe-clinical-workspace #container_div.oe-history-editor`.
  `oe-clinical-workspace` is only added by `mode.js` when a same-origin ancestor carries
  `workbench-active`.
- `workspace.css` is **not** linked, so its body font, canvas and container gutters never apply.
  Palette tokens are declared on the editor container (same values as `workspace.css`).
- No typography properties (font, line-height, letter-spacing, text-transform): the theme and
  the `#HIS .label_custom` font settings stay in charge.
- No `display`, `visibility`, `float`, `position` or `width`/`height` on any real element, so
  `tabbify()` tab switching, group show/hide (`divclick`), skip conditions, select2 and
  datepickers behave as before. The one generated box is a clearfix
  (`div#HIS::after { content: ''; display: table; clear: both }`): the theme floats
  `ul.tabNav` and `div.tabContainer`, and without it the sheet would end at the actions.
- `!important` appears once: custom-template fields (type 34) wrap their text in
  `a.text-body`, whose Bootstrap utility forces the theme body colour (near-white in dark
  themes); the sheet re-pairs it as ink on paper, and its `.text-area` likewise.
- The page writes `id="HIS"` on both the form and the tab wrapper; rules always name
  `form#HIS` or `div#HIS`.
- Dark themes: every text colour is paired with its own background (WCAG AA checked in
  tests); the inline `var(--gray300)` subtitle fill is redefined on the sheet; lifestyle
  (type 28) `table.table` cells get sheet ink on paper, semantic `table-*` variants excluded.
- The sheet is geometry-neutral: no padding, border or margin on the form (a native run measured
  +9px horizontal overflow at 390/320 from them); its rule line is an inset `box-shadow`.
- Narrow screens: tab labels and static values wrap (`overflow-wrap: anywhere`) and Save/Cancel
  wrap. No scroll container is introduced: a native run found focus rings clipped inside a
  scrolled lifestyle cell, so wide renderer tables (types 22/23/28/32) keep the original page's
  behaviour. **The original page already overflows horizontally at 390/320** (lifestyle and exam
  tables); this slice does not fix that and narrow widths are not accepted.
- Visible `:focus-visible` rings on tabs (the theme removes the outline), both actions, and
  radios, checkboxes and custom-template links inside the tabs (outline only).

## Tests

- `tests/js/clinical-history-editor.test.js` (Jest/jsdom): source preservation, untouched
  neighbours (`history.php`, `history_save.php`, `options.inc.php`, `mode.js`, `workspace.css`),
  head placement, stylesheet scope/property/contrast constraints, and a SYNTHETIC fixture of
  the editor markup proving mode toggling keeps every control and that the sheet is inert in
  legacy mode and on other routes.
- `tests/Tests/Isolated/PatientFile/History/HistoryEditorAssetsTest.php` (isolated PHPUnit):
  executes the head block cut verbatim from `history_full.php` with the real escaping helpers,
  `OEGlobalsBag` web root and `ClinicalWorkspaceAssets`; checks real file versions, web-root
  escaping, absence of `workspace.css`, the route hooks and helper allow/deny.
- `tests/Tests/Isolated/PatientFile/History/Editor/HistoryEditorRouteTest.php` (isolated
  PHPUnit, separate processes): executes the **real** `history_full.php` through
  `EditorRouteHarness` with guarded doubles (globals/sqlQuery, the layout renderer emitting the
  SYNTHETIC `fixtures/his-tabs-*.html`, LBF_Validation, the select2 xl script, dashboard header,
  AclMain/Header/OemrUI). Real: the route, history.inc.php,
  getPatientData/getHistoryData, CsrfUtils, translation (disabled), escaping,
  ClinicalWorkspaceAssets, options.js.php, validation_script.js.php, options_listadd.inc.php,
  datetimepicker settings. These route tests were written **after** the production change
  (an explicit TDD exception); they did not have a RED phase.

## Native fixture evidence

An offline native-Chrome harness (outside the repository) runs the real baseline and candidate
`history_full.php` through `EditorRouteHarness` with the compiled light/dark themes and local
jQuery, Bootstrap, Select2 and datetimepicker. Latest controller run
(`runs/native-20261007T103402Z-53164/report.json`): 366 checks, 350 passed, completed, no errors or
cleanup problems, no introduced failure, `accepted: false` because of 16 narrow-width (390/320)
horizontal-overflow checks that the original page fails as well. Legacy and print styles,
controls, values and handlers matched the original; workbench keyboard focus, contrast, fonts and
draft preservation passed. Earlier runs (363 checks) are kept as historical evidence.

This is fixture evidence with a synthetic HIS layout, not the authenticated application. Narrow
(mobile) widths, a deployed instance and the full reference set are **not** accepted.

Visual limitations seen in the fixture screenshots (not resolved, fidelity incomplete):
- Save/Cancel icons render as empty squares (the icon font is not loaded in the fixture).
- A long Select2 value is truncated in its selection box.
- In the dark theme, native form fields keep their dark theme surface on the light paper sheet.

## Not covered

- jsdom has no layout engine: 320px and dark-theme readability are asserted from CSS
  constraints, not measured in a browser.
- No browser/role/save run against a live stack; saving and the ACL deny branches
  (AccessDeniedHelper audits to the database) are unchanged source, not exercised.
- The route test's layout markup is a hand-built fixture copying the editable renderer's
  element shapes, not `display_layout_tabs_data_editable()` output.
