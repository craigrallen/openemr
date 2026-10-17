# Insurance company search/add popup: entry sheet

## Scope

OPEMR-21 adds a screen-only stylesheet to `interface/practice/ins_search.php`, with an escaped web-root URL and a per-file version from `ClinicalWorkspaceAssets`. The existing `#form_entry` gains `oe-insurance-search-document`. In `html.oe-workbench-context`, that entry sheet receives the workspace paper and ink colors, and its `input.btn` actions receive separate `:focus` and `:focus-visible` outlines. The asset helper adds only the sorted `insurance-search-popup.css` name.

This is a partial entry-sheet palette. It supplies no body canvas or body ink, results palette, or native field, select, button, warning, and read-only control palette. It changes no wrappers, layout, dimensions, fonts, backend, JavaScript, or caller behavior. Native controls retain their existing theme; compiled color and focus contrast still require visual checks.

## Preserved behavior and boundaries

The route still checks POST CSRF before calling `InsuranceCompanyService::saveFromForm($post)`. Existing form filters, field mappings, ID and address defaults, escaping, X12 partner query, validation, and save/update behavior remain as they were. Enter without a Save or Update mousedown still defaults to Search. The mousedown flags continue to distinguish Save and Update. Search still passes a GET CSRF token to `ins_list.php`, whose results are injected into `#form_list` with `jQuery.load`; the results page is unchanged. Session restoration, same-origin `postMessage`, the opener `set_insurance` callback and dialog close path, and Cancel's `window.close()` remain unchanged.

Source inspection found no explicit route or service ACL. The service still makes its insert-versus-update decision using the literal English `Save as New` value or a missing ID (the submitted label can be translated), and performs insurance, address, and phone writes with inherited transaction concerns. This presentation change does not resolve those issues or constitute security clearance.

The actual `interface/new/new_comprehensive.php` caller opens `ins_search.php` in a 650 × 460 iframe dialog with `allowResize: false`. No caller or result changes are included.

## Verification and acceptance

The controller supplied hosted RED from JS Unit Test run `39006142418` on 2026-10-17: 3 production-contract tests failed because the route and helper additions and stylesheet were absent; 1,274 tests passed and 3 failed across 62 suites. This implementation has not been run locally. Hosted GREEN, PHP syntax, nonignored stylelint, and independent full-diff review are pending, followed by ordinary approval.

Native PHP and workbench-context activation; compiled default, dark, and solar warning, control, and focus contrast; keyboard focus and clipping; initial and resized narrow dialogs; RTL, print, and role behavior; and real search, save, update, cancel, and opener flows still need verification. No live GET or POST, database operation, or clinical workflow was exercised here. This is neither completed researched design fidelity nor clinical acceptance.

No master, merge, deploy, policy, cron, clinical, national, or vendor changes are part of this work.
