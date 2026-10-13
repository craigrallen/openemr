# Void Reason dialog (`interface/patient_file/void_dialog.php`)

Screen-only document presentation for the Void Reason/Notes dialog that the fee sheet
(`interface/forms/fee_sheet/new.php`) and IPPF checkout (`interface/patient_file/pos_checkout_ippf.php`)
open with `dlgopen(..., '_blank', 500, 450)`. Both callers are unchanged.

## What changed

Presentation edit map (the complete set; `tests/js/void-dialog.test.js` reverses it and checks the result
against the master `18647270` digest `4c08b423…3339c`):

1. `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;`
2. After the original `Header::setupHeader(['common', 'datetime-picker', 'opener'])`: one `media="screen"` link to
   `interface/clinical-workspace/void-dialog.css`, versioned through `ClinicalWorkspaceAssets`.
3. `<body class="oe-void-dialog">` (route), `container-fluid oe-void-document` (document),
   `<table … class='oe-void-fields'>` (fields), `<p class='oe-void-actions'>` (actions).

`void-dialog.css` is one `@media screen` block with no breakpoints. Every selector starts with
`html.oe-workbench-context body.oe-void-dialog`, so it applies only when the production `popup.js`, which
Header already loads, finds an active workbench. Legacy mode, a standalone window and print keep the original
rendering. It uses the `popup.css` tokens (ink, canvas, paper, petrol, line), with explicit text/surface pairs,
including the focused fields. Fonts are inherited. The field table is stacked by setting `display: block` on
its existing nodes. The original `Submit`/`Cancel` inputs keep their size and wrap in inline flow. Field paint
skips Bootstrap validation states.

## Frozen (pinned by tests)

Includes, Header options, the `generate_form_field` descriptor (`data_type` 1, `void_reasons`,
`Select Reason`, `''`), notes input attributes, `method='post'`, the full `DoSubmit()` script with its three
native alerts, the closed/missing-destination branch, the raw (untrimmed) notes passed to `opener.voidwrap`,
`window.close()` and the inline Cancel handler.

**Inherited, not accepted:** the form has one text field and no submit button. By inference from that preserved
structure (not verified by runtime keyboard testing), pressing Enter in Void Notes would be expected to
implicitly POST the form back to the route and bypass `DoSubmit()`. This slice preserves that structure and
inherited behaviour limitation and only pins the structure that would cause it. No ACL or CSRF is added or claimed.

## Evidence and gaps

- Jest (source digest/mutations, the original callback executed in jsdom, CSS oracles, real `popup.js`
  activation and legacy transition, stylelint): fixture/source level only. The controller ran the full Jest
  suite: 62 suites, 1290 tests, all passing. It also ran full ESLint and stylelint and reported PASS (both
  printed no findings).
- `ClinicalWorkspaceAssetsTest` (with the `void-dialog.css` cases): 51 tests, 106 assertions, PASS.
- Native PHP route render: `tests/Tests/Isolated/PatientFile/VoidDialog/VoidDialogRouteTest.php` (4 tests,
  50 assertions, PASS). It `require`s the real `interface/patient_file/void_dialog.php` by absolute path from
  this checkout, in separate processes, using a temporary 0700 tree with no DB, SQL, session or bootstrap.
  It asserts the Header options, the single screen link (escaped synthetic web root and the real
  `ClinicalWorkspaceAssets` version), the presentation classes, the unchanged form, notes input,
  Submit/Cancel and raw `DoSubmit()` script, the exact `generate_form_field` descriptor, and that the seams
  reject unexpected arguments. This harness was written test-first: a RED run with the harness missing,
  then GREEN. That is test-harness TDD done after the product change, not retroactive product TDD.
  - **Synthetic seams (test-only):** `globals.php` (only marks itself loaded); `options.inc.php`
    `generate_form_field` (accepts only the exact descriptor and `''`, and emits an escaped SYNTHETIC select,
    not real list data); `Header` (a guarded `class_alias` that accepts only `common`/`datetime-picker`/`opener`
    and writes a marker instead of real asset tags). The route, `OEGlobalsBag`, `Kernel` and
    `ClinicalWorkspaceAssets` are this checkout's real code.
  - **Runner versus app bootstrap:** this checkout has no `vendor/`. A sibling checkout's locked PHPUnit
    11.5.56 (`--no-configuration`, external bootstrap) was the runner and supplied the Symfony dependencies.
    OpenEMR's own app bootstrap (`globals.php`, DB, session) was never run. One side effect: the escaping
    and translation helpers (`attr`, `attr_url`, `text`, `xlt`, `xla`, `xlj`, `xl`) that ran came from the
    runner checkout's `library/` files, which its Composer autoloader loads. They differ from this checkout's
    copies only in native return-type declarations.
  - Controller PHPCS passed on all six changed PHP files using the repository rules and the sibling
    runner's explicitly rooted Slevomat standard. Not run locally: full PHPUnit suites, PHPStan or Rector.
- Narrow 146/180px results are declared-box estimates, not browser layout. **Not verified:** native browser
  rendering against the compiled theme, dark-theme pixels, keyboard (including the Enter-key POST above),
  a real opener/`voidwrap`, print, legacy-mode acceptance and a live role.
