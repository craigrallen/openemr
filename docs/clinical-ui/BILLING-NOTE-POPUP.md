# OPEMR-3 — Billing Note popup as a document sheet

Status: **tests written, not executed. Production not yet edited.** Branch
`OPEMR-3-billing-note-document`, base `master` 18647270. Nothing in this file
is acceptance evidence.

## Surface

- Route: `interface/patient_file/history/edit_billnote.php` (original form,
  `#form_note` textarea, Save and Cancel submit buttons, `dlgclose()` then
  `exit()` after POST).
- Caller: `interface/patient_file/history/encounters.php` opens it with
  `dlgopen(url, '', 'modal-sm', 350, false, '', { onClosed: 'reload' })`.
- Popup mode: the shared Header already loads `popup.js`/`popup.css`
  (`config/config.yaml`), which set `oe-workbench-context` and
  `oe-workbench-popup` on `<html>` only inside an active same-origin workbench.

## Planned production edits (the only permitted changes)

Recorded as `[original, presented]` pairs in `tests/js/billing-note-popup.test.js`:

1. Imports `OpenEMR\Common\Assets\ClinicalWorkspaceAssets` and
   `OpenEMR\Core\OEGlobalsBag`.
2. After `Header::setupHeader()`, a versioned, `media="screen"` link to
   `interface/clinical-workspace/billing-note-popup.css`, with the webroot from
   `OEGlobalsBag::getInstance()->getWebRoot()`.
3. Classes: `body.oe-billing-note`, `.container.oe-billing-note-sheet`,
   `form.oe-billing-note-form`, and `.btn-group.oe-billing-note-actions`.
4. `'billing-note-popup.css'` added in alphabetical order to
   `ClinicalWorkspaceAssets::SUPPORTED`.

The shared `workspace.css` is not linked, and typography is unchanged.

## Test design

`tests/clinical-ui/fixtures/billing-note-original.txt` should hold the route's
exact bytes at 18647270. It was written with Read/Write only, so its byte
identity has **not** been checked by a tool. Hermes should check it with
`git show 18647270:interface/patient_file/history/edit_billnote.php` and a
byte comparison before relying on it. If the fixture is wrong, the full-inverse
test also fails once the route is implemented.

**Baseline and negative controls** (should pass before and after
implementation; they depend only on the fixture, the caller and the shared
Header assets):

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

**Intended RED assertions** (should fail now because the presentation
additions and the CSS are missing):

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
- Validation selectors are never targeted. Any control border, shadow or
  background-image rule must carry
  `:not(.is-invalid, .is-valid, .was-validated *)`.

## Explicitly NOT executed or established

- None of these tests has been run. Hermes owns the hosted RED run.
- Actual PHP rendering, the runtime, the ACL denial path and the CSRF failure
  path.
- Contrast in the compiled themes (light, dark, solar, manila and compact),
  native rendering and forced colours.
- Keyboard order and visible focus in a real browser.
- Fit in a narrow `modal-sm` frame, opened directly or after resizing. The
  wrap provision is not a claim that the actions fit natively.
- Real Save and Cancel round trips: the stored note, `dlgclose()` and the
  opener reload.
- Restricted roles, a full fidelity comparison against the research, and
  clinical acceptance.

No merge, deploy, database or cron change is part of this slice.
