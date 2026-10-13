# Record/Edit Disclosure popup document

Route: `interface/patient_file/summary/record_disclosure.php`, opened by the Record and
Edit links in `disclosure_full.php` through `dlgopen(..., { type: 'iframe' })`.

## What changed

- One screen-only stylesheet, `interface/clinical-workspace/disclosure-popup.css`, linked
  after `Header::setupHeader()` with `media="screen"` and a per-file `?v=` version from
  `ClinicalWorkspaceAssets` (exact basename `disclosure-popup.css` added to its allowlist).
- Presentation classes on existing nodes only: `oe-disclosure-editor` (body),
  `oe-disclosure-sheet` (container), `oe-disclosure-header`, `oe-disclosure-title`
  (Record span and Edit heading), `oe-disclosure-form`, `oe-disclosure-actions`
  (the original Save/Cancel group) and `oe-disclosure-field` (four form groups).
- Every rule is scoped to `html.oe-workbench-context body.oe-disclosure-editor` inside
  `@media screen`. popup.js sets that marker in dialog and normal frames of an active
  workbench only, so standalone, legacy mode and print keep the legacy rendering.
  No media-feature queries, so no stylelint override.

Unchanged: PHP, ACL and the addonly/`editlid` guard, SQL, session, CSRF, the AJAX submit
and `dlgclose('refreshme', false)`, the Cancel `onclick`, control names/types/defaults,
datetimepicker settings, `submitform()` inline red/white backgrounds, the launcher file,
the datepicker overlay and the original font family and size (none is set); title and
label weight is now explicitly 600.

## Source-tested (`tests/js/disclosure-popup.test.js`, `ClinicalWorkspaceAssetsTest`)

- Reversing the declared edits reproduces the master 18647270 route byte-for-byte
  (sha256), with negative mutations for ACL, guard, SQL, session, CSRF, AJAX, callbacks,
  controls, datepicker settings and validation colours; the launcher is digest-pinned.
- `submitform()` extracted from the route still paints red/white inline and submits once.
  This calls the inline function directly; it does not click Cancel (Cancel remains a
  default-submit button and `submitform()` is not wired to Save in this route).
- Real `popup.js` controllers in jsdom windows: dialog and normal frame engage, inactive/
  standalone/non-workbench opener stay legacy. Legacy toggling is driven by manually
  toggling the `workbench-active` class on a synthetic shell; the production `mode.js`
  interaction is not exercised.
- CSS structure: single screen block, scope, logical properties, no hide/!important and no
  `overflow` hidden/clip declarations, paired neutral ink/surface tokens (contrast >= 4.5
  against popup.css values), validation states excluded from control paint, visible focus,
  gutters zeroed, wrap-enabled actions. The sheet's `overflow-x: auto` makes it a scroll
  container, so "never clips" is not supported.
- 146/180px sizing is a declared-box estimate (16px rem assumed, approximate text widths,
  Font Awesome button prefixes omitted); it is not native wrapping proof or a browser
  layout measurement.
- Stylelint CLI on the new sheet; helper version/allowlist via PHPUnit.
- Known cosmetic mismatch: Bootstrap's `.mt-3` (`margin-top: 1rem !important`) overrides
  the sheet's intended `.75rem` field top spacing.

## Verification record (independent review, 2026-10-13)

- Review of changes against `18647270`: no introduced P1/P2 found.
- Controller full Jest, run with temporary dependency links: PASS, 62 suites / 1284 tests.
  Earlier runs had failed on missing modules in this worktree's setup; the links resolved
  those failures.
- Full ESLint and stylelint: PASS.
- Focused native helper PHPUnit: PASS, 52 tests / 107 assertions.
- Not claimed: full PHP suite, native browser rendering, or clinical acceptance.

## Outstanding native/live acceptance

Not exercised: compiled light/dark theme rendering in a real browser, actual 146/180px
dialog layout, keyboard focus order, datepicker overlay interaction, Save/Cancel through a
real opener and `refreshme` reload, and print preview. The unchanged inline red invalid
background under the sheet's field ink computes to 3.3:1 and needs a native review decision.
