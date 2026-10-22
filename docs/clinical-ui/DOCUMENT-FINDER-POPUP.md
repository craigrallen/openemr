# Document Finder popup (OPEMR-10)

Status: **source-only partial palette adaptation.** This is not a finished design
match, and nothing here has been accepted as complete. The initial implementation
(`e9369494`) has a recorded hosted GREEN run. The final review-strengthening commit's
hosted run is **pending**, and no result is claimed for it until it is recorded.

## Rationale

`interface/main/finder/document_select.php` opens in a workbench popup (the
`dlgopen` 700×400 dialog from `trusted-messages.js`). It painted in the colour theme's
`.body_top` palette and Bootstrap's `.bg-light`, so it did not match the
`html.oe-workbench-popup` surfaces around it. This slice changes colours only, and only
inside that popup context. It does not touch geometry, fonts, padding, borders,
`display`, wrappers, the backend, CSRF, ACL, or behaviour.

## Exact production edits

1. `interface/main/finder/document_select.php`: exactly four additions, as defined by
   `ADDITIONS` in `tests/js/document-finder-popup.test.js`. Removing them gives back
   `tests/clinical-ui/fixtures/document-finder-original.txt` byte for byte.
   - `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;` before the `CsrfUtils` import.
   - A `ClinicalWorkspaceAssets` instance and one screen-only stylesheet link, after
     `Header::setupHeader(['common', 'opener'])`. The web root is escaped with
     `attr()`, and the `?v=` version is escaped with `attr_url()`.
   - `document-finder-popup` added to `<body class="body_top">`.
   - `document-finder-document` added to the `container-responsive` div.
2. `src/Common/Assets/ClinicalWorkspaceAssets.php`: one new `SUPPORTED` entry,
   `'document-finder-popup.css'`, placed in sorted order before
   `'encounter-document.css'`. Nothing else changed.
3. `interface/clinical-workspace/document-finder-popup.css` (new): a single
   `@media screen` block with 2-space nesting and one selector per rule. Every
   selector starts with `html.oe-workbench-popup body.document-finder-popup`. It uses
   `--oe-wb-*` tokens with literal fallbacks.
   - Ink and background are always set as a pair. The one exception is the
     placeholder rule, which sets ink plus `opacity: 1`.
   - Only two `!important` declarations, and each one answers an existing
     `!important`:
     - the body background, against `.body_top` in `interface/themes/color_base.scss`;
     - `#searchCriteria.bg-light`, against Bootstrap's `.bg-light`.
   - `:focus` and `:focus-visible` rings are separate rules for `#searchparm` and
     `#submitbtn`. That way, a browser that doesn't support one pseudo-class can't
     discard the fallback along with it.
   - The neutral status uses `#searchstatus:not(.alert)`. This only excludes elements
     that carry `.alert`; it does not by itself guarantee semantic colours. The inherited
     `#searchstatus` foreground colour remains in place, so the semantic contrast of the
     status text is **unverified**.
   - Result cells use `.oneresult:not(:hover) > td`. This stops the new paint being
     applied to a hovered row's cells, so the original inline
     `.oneresult:hover { background-color: #336699 }` row highlight is intended to
     show. That inline rule has lower specificity and is not touched. The computed
     transparency of the hovered cells across themes is **unverified**.
   - Field state rules (`:focus`, `:disabled`, `[readonly]`, `::placeholder`) sit
     behind `#theform:not(.was-validated)` and `#searchparm:not(.is-invalid, .is-valid)`
     (complex `:not()`, as `selector-not-notation` requires). This keeps them from
     overriding Bootstrap validation colours.
   - The `#searchparm` `:focus` and `:focus-visible` ring rules come before the
     higher-specificity field paint rules, to satisfy `no-descending-specificity`. They
     set only `outline`, so the order does not change any rendered value.
4. This document.

Test changes: `tests/js/document-finder-popup.test.js` was changed. The SPEC was
adapted for the complex `:not()` selectors and the rule-order change, and the
mutations were strengthened so they no longer rely only on `toThrow`. The inverse
baselines and the strict allowlist are unchanged.

The source guards in that test are string/structure checks on the source. They are not
native browser proof of the rendered result.

## Evidence

- Hosted RED (tests-first), commit `6ed613c9`, run `38881266113`: 4 failed,
  1266 passed, 62 suites. The four failures are the intended missing-production
  assertions only. All source, mutation and theme guards passed. The frozen fixture
  and the embedded helper baseline were byte-compared separately against
  `origin/master` and matched exactly.
- Hosted JS GREEN for the initial implementation, commit `e9369494`, run
  `38882202895`: 62 suites, 1271 tests, all passing.
- Final review-strengthening commit: hosted run **pending**. No result is claimed
  until it is recorded.
- Controller PHP syntax checks passed on both PHP files.
- Controller CSS lint on the non-ignored CSS passed, after 7 lint errors were
  repaired (the complex-`:not()` notation, rule order, and controller whitespace /
  trailing newline).
- Not performed: local Node, Jest, history, hash, cache or bootstrap checks, and any
  browser run. No PHPStan run was performed in this slice.
- Review: an independent Astra review of all six files found no introduced P1 or P2
  issue. It identified a test-maintenance weakness, which was corrected (see the test
  changes above).

## Inherited issues, documented and not changed

These are pinned unchanged by the test. They are recorded here, not fixed, and no
security property is claimed for them. No exploit has been confirmed. No application
GET/POST was made and no real records were used.

- **Authorization scope.** From reading the code (not running it):
  - `DocumentService.php` (lines 188–291) builds a bound search with an integer SQL
    limit of 26 (`$MAX_RECORDS + 1`) and a category `can_access` check.
  - The route then filters each row through `Document::can_access()`.
  - `Document.class.php` (lines 370–385) allows a document with no category and
    checks ALL of its categories otherwise.
  - Nothing here proves patient-specific authorization.
- **Unscoped search.** The search is patient-scoped only when the request `pid`
  resolves to a patient. With a session-only or invalid `pid`, the search runs
  unscoped, but the hidden `pid` field and the "Showing documents for patient"
  banner can still render.
- **Malformed attribute.** The `data-category` attribute is emitted without its
  opening quote.
- **Unchanged original behaviour gaps:**
  - Rows respond to clicks only (no keyboard selection).
  - The label's `for="searchby"` doesn't match the input id `searchparm`.
  - `SubmitForm` calls `.css("disabled", "true")`, which does not disable the button.
  - The no-record branches have gaps.
- **Caller.** In `trusted-messages.js` (lines 185–215), the caller passes the CSRF
  token and an optional `pid`, encoded, then calls `restoreSession`, then
  `dlgopen(…, 700, 400)`. It reads the selection back through `setSelectedDocument`.
  This was confirmed by reading the source only.

## Still open, not accepted

All of these remain open. The denial boundaries are retained, and nothing here claims
all-22, demo, or Swedish completion.

- Native acceptance of the complex `:not(.is-invalid, .is-valid)` selector in older
  engines that lack selector-list support inside `:not()`. Where it is unsupported, the
  whole field rule is dropped and the field keeps the theme palette; this is not tested.
- The palette under each native compiled theme, and confirmation that the
  `oe-workbench-popup` class actually activates in a live popup.
- Contrast measurement of every token pair and fallback, including the inherited
  `#searchstatus` foreground on `:not(.alert)` status text.
- Computed transparency of hovered result cells under each theme, and confirmation
  that the inline hover highlight shows.
- Native browser proof of the rendered result; the source guards are not a substitute.
- Keyboard focus visibility and focus-ring clipping inside the dialog.
- Direct (non-popup) loading, plus the narrow 700×400 dialog and resized viewports.
- RTL and translated strings.
- Print, and legacy browsers.
- Role- and ACL-specific views.
- A real document selection and opener callback, end to end.
- Security acceptance of the inherited scope issues above.
