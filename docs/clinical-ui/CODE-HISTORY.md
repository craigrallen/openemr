# Diagnosis Codes History picker

`interface/patient_file/encounter/find_code_history.php` is the dialog the procedure order form opens (`dlgopen('find_code_history.php', 'dxDialog', ...)` in `interface/forms/procedure_order/common.php`) to build a procedure's diagnoses list. Inside an active workbench it now renders as a document sheet: a quiet framed current-diagnoses editor in an opaque sticky band, a readable ruled results table, and the usage tips under the editor.

## Scope delivered

- Presentation only. The route gains a body class (`oe-code-history`), four wrapper hook classes and a screen-only link to `interface/clinical-workspace/code-history.css` plus `mode.js`, both versioned through `ClinicalWorkspaceAssets` (fixed basename `code-history.css` added to its allowlist).
- Rules match only `body.oe-code-history.oe-clinical-workspace`. `mode.js` sets the `oe-clinical-workspace` marker only when it finds an active workbench, either as the dialog frame's parent or as the window's opener, so a standalone page without such an opener, explicit legacy mode and print keep the original rendering. A standalone window whose opener is an active workbench can activate the mode; the tests cover only a standalone window without that opener. `workspace.css` is not linked. The shared `popup.css` and `popup.js` already autoload through `Header` at baseline: they are not newly added by this change, and their existing typography still applies.
- Route-local `--oe-ch-*` tokens pair ink with a surface on every coloured rule. Rows, cells, code buttons, the editor input and the tips card set no colour, so the red matched rows, `<mark>` highlights, active row, danger/warning palettes, hidden tips and the spinner remain theme- and script-owned.
- Full-size code labels wrap within their cell; the 32rem table scrolls horizontally inside the sheet; `:focus` and `:focus-visible` each keep a visible ring on the trash button, editor, code buttons and Dismiss.

Unchanged: all SQL, the session `pid` read, de-duplication, sorting and problems-first ordering, every inline function (`setFormDx`, `rtnCode`, `clearCodes`, `setCodes`), the `opener.targetElement` / `opener.targetProcedure` contract, the top-frame `saveDx` / `showTips` hookups, DOM ids, controls, wording and translations, and the launcher.

## Inherited data-scope limitation

The procedure-history query is not patient-filtered: it reads diagnoses from all procedure orders, while only the problem-list query is restricted to the session patient. This lane deliberately leaves that behaviour unchanged, so the "Procedures" rows must not be read as this patient's history. Fixing the scope is separate, reviewed work.

Also inherited: without an opener, the ready handler fails after the alert and the spinner stays.

## Evidence

- `tests/js/code-history-popup.test.js` (Jest): reversible edit map back to the original route digest with negative guards over SQL, session, sort, callbacks, ids, wording and controls; the original inline script executed under jsdom for opening, append/remove, Save, clear, Help/Dismiss and the no-opener alerts; stylesheet scope, token contrast, inherited typography, focus declarations, declared-width estimates at 146/180/390px (with in-memory negative mutations: an oversized, `auto` or non-shrinking input minimum must fail) and stylelint; engagement through the real `mode.js`.
- `tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php`: the new basename versions from its own file and near-miss names are rejected.

The 146/180/390px checks are declared-box arithmetic: estimates, not native geometry, computed over this sheet and Bootstrap 4.6 declarations at 16px/rem. They subtract the editor gutters, the framed group's border and padding, the trash button's padding and border around a 1em glyph estimate, and the input's padding and border, then require the input's effective declared minimum to fit and at least 40px of text width to remain. They do not measure fonts, the real glyph, zoom or scrollbars.

Open acceptance gaps, retained:

- Tips stay inside the inherited sticky editor band with no height bound or independent scrolling; reachability of long tips at narrow widths or short heights is unverified (the tests check toggling only).
- Hover states are not verified; dark-theme hover foregrounds on the shared popup's white table surface are an inherited cascade concern.
- Focus rings are checked as declarations only, not as rendered in a native browser.
- No native visual or browser acceptance (live, real-role, real-data or print) of this route has been performed.
