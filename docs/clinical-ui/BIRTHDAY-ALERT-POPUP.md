# Birthday Alert popup (OPEMR-13)

Branch, commits and PR all keep the uppercase key `OPEMR-13`. This repository's
default branch is `master`, not `main`. That is a documented repository
exception, and PRs target `master`.

## Scope

`interface/patient_file/birthday_alert/birthday_pop.php` is shown by
`demographics.php` in a 300×170 iframe that cannot be resized. The original
route (the frozen fixture) is 97 lines; the edited route is 99 lines. This change only
partly adapts the source to the workbench palette. It does not measure contrast
in a browser, and it does not claim to match any researched layout.

Implemented production edits (source only; see the status section for what
has and has not been verified):

1. `birthday_pop.php` has a sorted `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;`
   between `AclMain` and `CsrfUtils`.
2. Directly after `Header::setupHeader()`, `birthday_pop.php` has one escaped,
   versioned, `media="screen"` link to `/interface/clinical-workspace/birthday-alert-popup.css`.
   The web root is escaped with `attr(OEGlobalsBag::getInstance()->getWebRoot())`, and the
   version with `attr_url((new ClinicalWorkspaceAssets())->version('birthday-alert-popup.css'))`.
   No new PHP variable is added.
3. `<body>` has the class `oe-birthday-alert-popup`. The existing
   `padding: 15px; text-align: center` div has the class
   `oe-birthday-alert-document`, and its inline style is unchanged.
4. `'birthday-alert-popup.css'` is in the `SUPPORTED` list in
   `ClinicalWorkspaceAssets`, in sorted order between `appointment.css` and
   `calendar-sidebar.js`. Nothing else in the helper changed.
5. The new `interface/clinical-workspace/birthday-alert-popup.css` has a
   brace-free header comment and exactly five rules. The rules set the canvas,
   the document paper, the `.h2` petrol colour, and separate checkbox `:focus`
   and `:focus-visible` outlines. The sheet has no `!important`, at-rules,
   imports, fonts, sizing, padding, display or visibility rules, print rules,
   wrappers, or native checkbox styling. There are no JS or backend changes.

Apart from these three additive groups in the route and the one sorted helper
entry, every byte of the original route and helper is unchanged. That covers
the ACL check, PID guard, CSRF token, hidden checkbox (automatic mode, not
manual mode), automatic script, endpoint, user id, balloon, geometry, header
call and strings.

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
- Automatic popup classification is not proved. In the actual `popup.js`,
  `isDialogFrame` uses `frame.closest('.dialogModal')`; it does not use
  `isSmallModal`. Whether the real dialog ancestry matches is therefore a source
  reading only, so the automatic `oe-workbench-popup` class may or may not apply
  inside the real dialog, and this document does not claim either. The scope uses
  `oe-workbench-context` because the rules only need that class to work, whether
  or not the popup class is also present. Activation has not been measured, and
  nobody has observed this in a running browser.
- Source-only evidence that `popup.css`/`popup.js` load for this route: the
  controller read `config/config.yaml` lines 164-168, where the `workbench-popup`
  entry has `autoload: true` with `popup.js` and `popup.css`. `Header::setupHeader()`
  in `src/Core/Header.php` calls `setupAssets(..., true)`, and that autoload
  pipeline confirms the sources load. This is a reading of the source. Nothing
  has run it, and it is not a measured activation.

## Test contract

`tests/js/birthday-alert-popup.test.js` reads source text only, using the
existing `fs`, `path` and `postcss` dependencies:

- `tests/clinical-ui/fixtures/birthday-alert-popup-original.txt` is a frozen copy
  of the full original route. Undoing the three declared edits on the current
  route must give back that copy exactly. Mutating the ACL, PID, CSRF, hidden
  checkbox (automatic mode), automatic script, endpoint, user id, balloon, geometry, header,
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

- RED (recorded): the hosted JS run `38917808431` ran the tests-only commit
  `79cd233769005cbcba3d2ad5c22789118690d398`. Exactly the four intended tests
  that need the production change failed: route inversion, route
  import/link/classes, helper entry, and five-rule sheet. 61 suites and 1297
  tests passed, out of 62 suites and 1301 tests in total. The PostCSS
  Boolean-`important` fix to the test was made before that RED run. No test was
  weakened.
- Hosted GREEN is pending at this checkpoint. The source phase has landed in
  this working tree, but the hosted run against it has not been recorded here,
  and no hosted result is claimed.
- Controller checks on the working tree (no CI result is implied): two PHP
  syntax checks and an actual CSS stylelint run (no ignore) both PASS, and
  `git diff --check` PASSes. No local Jest, no browser and no application
  request have been run.
- An independent Codex Astra review of all six files found no introduced P1 or
  P2 issues. Its minor documentation corrections are applied in this file.
- The controller independently byte-compared the frozen fixture and the full
  embedded helper baseline against actual `origin/master` at `18647270`, and
  both are equal.
- Still open: native activation, compiled theme rendering (light, dark and
  legacy themes), real contrast, the narrow 300×170 frame, RTL, keyboard focus
  behaviour, print, user roles and ACL variants, native checkbox paint, automatic
  popup classification, and whether turnoff persists in both modes.
- A source-only security review has been done, but there is no security or
  runtime acceptance. It found that
  the inherited endpoint `library/ajax/turnoff_birthday_alert.php` checks the
  POST CSRF token. It has no explicit endpoint ACL check, and it does not bind
  `pid`/`user_id` to the session identity. In automatic mode, opening the popup
  immediately sends a POST that changes `patient_birthday_alert`. That is why
  the route must not be executed for verification. No live endpoint,
  application HTTP or DB check has been done. This change does not alter any of
  that behaviour.
