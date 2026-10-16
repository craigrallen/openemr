# Birthday Alert popup (OPEMR-13)

Branch, commits and PR all keep the uppercase key `OPEMR-13`.

## Scope

`interface/patient_file/birthday_alert/birthday_pop.php` (97 lines) is shown by
`demographics.php` in a 300×170 iframe that cannot be resized. This change only
partly adapts the source to the workbench palette. It does not measure contrast
in a browser, and it does not claim to match any researched layout.

Planned production edits (not made yet):

1. Add a sorted `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;` between
   `AclMain` and `CsrfUtils`.
2. Directly after `Header::setupHeader()`, add one escaped, versioned,
   `media="screen"` link to `/interface/clinical-workspace/birthday-alert-popup.css`.
   The link uses `OEGlobalsBag::getInstance()->getWebRoot()` and
   `(new ClinicalWorkspaceAssets())->version('birthday-alert-popup.css')`, and
   adds no new PHP variable.
3. Give `<body>` the class `oe-birthday-alert-popup`. Give the existing
   `padding: 15px; text-align: center` div the class
   `oe-birthday-alert-document`, and leave its inline style unchanged.
4. Add `'birthday-alert-popup.css'` to the `SUPPORTED` list in
   `ClinicalWorkspaceAssets`, in sorted order between `appointment.css` and
   `calendar-sidebar.js`.
5. Create a new sheet with exactly five rules and nothing else. The rules set
   the canvas, the document paper, the `.h2` petrol colour, and separate checkbox
   `:focus` and `:focus-visible` outlines. The sheet has no `!important`, at-rules,
   imports, fonts, sizing, padding, display or visibility rules, print rules, or
   native checkbox styling. No JS or backend changes.

## Selector and token deviation (resolved: source-based correction)

The brief asked for `body.oe-workbench-context.oe-birthday-alert-popup` and for
palette names from `workspace.css`. The source does not support either. The
controller has accepted the corrected `html.oe-workbench-context` selector and
the `popup.css` tokens, and has confirmed the actual `popup.js` behaviour on
`document.documentElement`:

- `popup.js` only toggles `oe-workbench-context` and `oe-workbench-popup` on
  `<html>`, and never on `<body>`. A `body.oe-workbench-context…` selector could
  never match. The tests therefore pin `html.oe-workbench-context body.oe-birthday-alert-popup`,
  defined once as `CONTEXT` in the test file.
- `workspace.css` defines `--oe-ink/--oe-paper/--oe-canvas/--oe-petrol`, but only
  inside `body.oe-clinical-workspace`. The `--oe-wb-*` tokens the brief names are
  defined in `popup.css` under `html.oe-workbench-context`, so the tests use those.
- Automatic popup classification is not proved. The iframe's `.iframe` ->
  `isSmallModal` ancestry may matter, so this document does not claim that
  `oe-workbench-popup` never applies. The scope uses `oe-workbench-context`
  because the rules only need that class to work, whether or not the popup class
  is also present. Nobody has observed this in a running browser.

## Test contract

`tests/js/birthday-alert-popup.test.js` reads source text only, using the
existing `fs`, `path` and `postcss` dependencies:

- `tests/clinical-ui/fixtures/birthday-alert-popup-original.txt` is a frozen copy
  of the full original route. Undoing the three declared edits on the current
  route must give back that copy exactly. Mutating the ACL, PID, CSRF, hidden
  manual checkbox, automatic script, endpoint, user id, balloon, geometry, header,
  strings, link escaping, version, media, imports or added classes must fail to
  restore it.
- The helper must equal its embedded original with exactly one added sorted
  basename.
- The sheet AST must match the five-rule allowlist exactly. Each negative mutant
  first checks that its anchor is unique and that it actually changed the input,
  so a broken anchor cannot pass as a rejection.
- A missing sheet is read as empty, so before the sheet exists the tests fail on
  assertions rather than crashing.

These are limits on the source text. They do not prove how the cascade resolves,
what contrast results, or how the page behaves at runtime.

## Status and open gates

- TDD is pending. The controller runs the hosted RED (before the source phase) and
  GREEN (after it). Nothing has been run locally: no Jest, no PHP, no browser and
  no application request. The hosted tests have not run yet, so nothing here is
  claimed as passing. The controller independently byte-compared the frozen
  fixture and the full embedded helper baseline against actual `origin/master`
  at `18647270`, and both are equal. The inverse test still checks the fixture
  against the edited route once the source phase lands.
- Still open: actual theme rendering (light, dark and legacy themes), native
  checkbox paint, native activation, keyboard focus behaviour, automatic popup
  classification, RTL, the narrow 300×170 frame, print,
  user roles and ACL variants, and whether turnoff persists in both modes.
- Security has not been reviewed and is not cleared. The inherited endpoint
  `library/ajax/turnoff_birthday_alert.php` checks the POST CSRF token, but it has
  no explicit ACL check and does not bind `pid`/`user_id` to the session identity.
  In automatic mode, opening the popup immediately sends a POST that changes
  `patient_birthday_alert`. That is why the route must not be executed for
  verification. This change does not alter any of that behaviour.
