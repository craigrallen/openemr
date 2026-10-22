# OPEMR-3 — Billing Note popup as a document sheet

Status: **source implemented; tests-first hosted RED verified; current GREEN
pending.** Branch `OPEMR-3-billing-note-document`, base fork `master`
18647270, target fork `master`. Future commits and the PR title carry the
uppercase `OPEMR-3` key. Nothing in this file is runtime or clinical
acceptance evidence.

- Tests-only commit 10ec42be (draft PR77): hosted JS run 38813819166 was
  genuinely RED — 12 intended missing-presentation/CSS failures, 1287 passed,
  62 suites, and no baseline or negative-control failures.
- The production edits below have been made in source after that run. They
  have not been executed by Jest, PHP or a browser here; the controller owns
  the hosted GREEN run, which remains pending.
- Independent Codex Astra review at source 2e26d888 found no introduced P1/P2
  defects. It was static only. The controller's two PHP syntax checks passed.
  Neither is GREEN, runtime or clinical acceptance evidence.

## Surface

- Route: `interface/patient_file/history/edit_billnote.php` (original form,
  `#form_note` textarea, Save and Cancel submit buttons, `dlgclose()` then
  `exit()` after POST).
- Caller: `interface/patient_file/history/encounters.php` opens it with
  `dlgopen(url, '', 'modal-sm', 350, false, '', { onClosed: 'reload' })`.
- Popup mode: the shared Header already loads `popup.js`/`popup.css`
  (`config/config.yaml`), which set `oe-workbench-context` and
  `oe-workbench-popup` on `<html>` only inside an active same-origin workbench.

## Production edits (implemented in source; the only permitted changes)

Recorded as `[original, presented]` pairs in `tests/js/billing-note-popup.test.js`
and applied to the route as exactly those seven replacements:

1. Imports `OpenEMR\Common\Assets\ClinicalWorkspaceAssets` and
   `OpenEMR\Core\OEGlobalsBag`.
2. After `Header::setupHeader()`, a versioned, `media="screen"` link to
   `interface/clinical-workspace/billing-note-popup.css`, with the webroot from
   `OEGlobalsBag::getInstance()->getWebRoot()`.
3. Classes: `body.oe-billing-note`, `.container.oe-billing-note-sheet`,
   `form.oe-billing-note-form`, and `.btn-group.oe-billing-note-actions`.
4. `'billing-note-popup.css'` added in alphabetical order to
   `ClinicalWorkspaceAssets::SUPPORTED` (between `appointment.css` and
   `calendar-sidebar.js`).
5. New `interface/clinical-workspace/billing-note-popup.css`: one
   `@media screen` block, two-space indentation, every selector under
   `html.oe-workbench-context.oe-workbench-popup body.oe-billing-note`. Body
   canvas/ink; sheet paper/ink with a 1px line border, 6px radius and 12px
   block padding (inline gutters left to `.container`); `#form_note` ink/paper
   at rest and on `:focus` (2px petrol outline), disabled-ink/disabled-paper
   when `:disabled`, muted placeholder at `opacity: 1`; actions
   `flex-wrap: wrap`; separate `:focus` and `:focus-visible` outline-only
   rules for the action buttons. No media range queries, `!important`,
   typography, control geometry, button palettes or validation selectors.

The shared `workspace.css` is not linked, and typography is unchanged. SQL,
ACL, CSRF, the autosize script, Save/Cancel, `restoreSession()`, `dlgclose()`
and the caller are untouched. The new sheet's border and block padding do
change the popup's content geometry slightly; the wrap provision is not a
claim that the actions fit natively.

## Test design

`tests/clinical-ui/fixtures/billing-note-original.txt` holds the route's
exact bytes at 18647270. The controller verified it byte-identical (`cmp`)
with both the route as it stood and
`git show origin/master:interface/patient_file/history/edit_billnote.php`.

**Baseline and negative controls** (passed in the hosted RED run before
implementation; they depend only on the fixture, the caller and the shared
Header assets. That they still pass after implementation is not claimed until
the hosted GREEN run):

- The fixture is untouched and has unique anchors.
- The declared edit list is self-inverse on the fixture.
- One mutation control per anchor. Each anchor occurs exactly once. Covered:
  acct/bill write ACL, denial template, POST CSRF check and source, `feid`
  integer parse and UPDATE binding, escaped textarea and its identity, both
  autosize script lines, hidden CSRF token, `top.restoreSession()`, form
  action, Save and Cancel `type='submit'`, `dlgclose()`, `exit()` and the
  shared `Header::setupHeader()`.
- Stray-edit controls: a textarea class, heading typography, a
  `workspace.css` link and an inline body style.
- Caller block (modal-sm, 350, `onClosed: 'reload'`) with mutation controls.

**Intended RED assertions** (failed in hosted run 38813819166 at 10ec42be
because the presentation additions and the CSS were missing; expected to pass
against the implemented source, GREEN pending):

- Production equals `present(fixture)` exactly, `restore(production)` equals
  the fixture, and every edit and mutation anchor occurs exactly once.
- The sheet is linked once, versioned, screen-only, inside `<head>` after the
  shared Header, and uses the typed webroot.
- The asset list is strict and sorted: the 24 original entries plus
  `billing-note-popup.css`, with no duplicates.
- CSS has one `@media screen` block, no print, `@import`, `@font-face`,
  `!important` or lint suppressions. Only `(max-width: Npx)` nested media is
  allowed.
- Every selector sits under
  `html.oe-workbench-context.oe-workbench-popup body.oe-billing-note`. A jsdom
  check confirms that legacy, context-only and popup-only documents do not
  match.
- The body is canvas with ink. The sheet is paper with ink, a 1px line
  border, a radius, and block padding of 24px or less. Inline padding, margin
  and width are not set, so Bootstrap's `.container` gutters stay as they are
  (`$grid-gutter-width / 2`: 15px default, 10px compact per
  `interface/themes/compact-theme-defaults.scss`).
- `#form_note` has paired ink/paper at rest and on `:focus` (with a petrol
  outline), disabled-ink/disabled-paper when `:disabled`, and a muted
  placeholder at `opacity: 1`.
- Each declared colour/background token pair resolves from `popup.css` to at
  least 4.5:1. This is **source-token contrast only**.
- `:focus` fallback rules and `:focus-visible` rules are kept separate. The
  action buttons get both, with outline properties only.
- `.oe-billing-note-actions` gets `flex-wrap: wrap` and no `display` change.
  No button colour, background, border or shadow is set, so the original
  palettes stay (theme `.btn-group .btn` margins and Bootstrap's inline-flex
  group are left alone).
- No font, line-height or control geometry (width, height, padding, margin,
  resize), and nothing hidden or repositioned.
- The original validation border/shadow cues remain. The added `:focus`
  outline is presentation-only, and its native contrast is pending.
- Validation selectors are never targeted. Any control border, shadow or
  background-image rule must carry
  `:not(.is-invalid, .is-valid, .was-validated *)`.

## Explicitly NOT executed or established

- The hosted GREEN run against the implemented source, and the independent
  review. No local Jest, PHPUnit, PHPStan or lint was run for this slice.
- Actual PHP rendering, the runtime, the ACL denial path and the CSRF failure
  path.
- Contrast in the compiled themes (light, dark, solar, manila and compact),
  native rendering and forced colours. The 4.5:1 test checks source tokens
  only, not effective compiled contrast.
- Keyboard order and visible focus in a real browser.
- Fit in a narrow `modal-sm` frame, opened directly or after resizing. The
  wrap provision is not a claim that the actions fit natively.
- RTL, the `printlegacy` path and print output.
- Real Save and Cancel round trips: the stored note, `dlgclose()` and the
  opener reload.
- Actual Save/Cancel and any runtime authorization exercise.
- Restricted roles, a full fidelity comparison against the research, and
  clinical acceptance.

## Inherited security limitation

The existing `acct/bill` ACL is a global billing permission, and the `feid`
query is unchanged. This slice does not establish patient-specific encounter
authorization. Nothing here changes or verifies that behaviour.

No merge, deploy, database or cron change is part of this slice.
