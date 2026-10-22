# Patient tracker status popup

Route: `interface/patient_tracker/patient_tracker_status.php`
Sheet: `interface/clinical-workspace/tracker-status-popup.css`

## Caller

The Patient Flow Board (`interface/patient_tracker/patient_tracker.php`,
`bpopup(tkid)`) opens the route unchanged:

```js
dlgopen('../patient_tracker/patient_tracker_status.php?tracker_id=' + encodeURIComponent(tkid) + '&csrf_token_form=' + <?php echo js_url(CsrfUtils::collectCsrfToken($session)); ?>, '_blank', 500, 250);
```

The requested size is 500 x 250, but `library/dialog.js` raises the requested
initial iframe height to 300px before applying viewport limits; the modal
content remains capped at 94vh. A short viewport can therefore win over the
initial height. Auto-height growth and actual fit were not measured here. This slice changes neither the
caller nor `library/dialog.js`, so the document sheet may still scroll inside a
capped frame, as before.

## What changed

Presentation only, on screen only, and only inside a genuine workbench popup
(`html.oe-workbench-popup`, set by `interface/clinical-workspace/popup.js`):

- one `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;` import;
- one `media="screen"` stylesheet link, versioned through
  `ClinicalWorkspaceAssets`, whose allowlist gains only `tracker-status-popup.css`;
- classes added to existing nodes: `oe-tracker-status-popup` on `<body>`,
  `__document` on the original `.container`, `__title` on the `<h2>`, and
  `__actions` on the original `.btn-group`.

The sheet paints a quiet canvas, a paper document sheet with a line border,
radius and soft shadow, a petrol title, and paired ink-on-paper selects in both
normal and `:focus` states (so Dark and Solar inputs keep paired paint). The
original Save/Cancel button group wraps; Bootstrap's joined square corners are
restored, including exactly two `!important` corner declarations on
`> .btn:first-child` answering the colour themes' own `!important` rule. The
route has exactly two plain buttons, so no chained `:not()` is needed; the
longer scoped selector outranks the theme's, and the rule follows the focus
rules to satisfy `no-descending-specificity`. Selects and buttons get a separate
`:focus` fallback followed by `:focus-visible`.

Unchanged: fonts, container gutters and padding, labels, controls, list
options, button palettes, CSRF on GET and POST, the session, every SQL
statement, automatic encounter creation, `manage_tracker_status()` writes, and
the opener refresh (`window.opener.document.flb.submit()`) plus `dlgclose()`.
The echoed POST response body is unclassed.

## Tests

- `tests/clinical-ui/tracker-status.test.cjs`: portable source guards,
  no git needed (`node --test tests/clinical-ui/tracker-status.test.cjs`).
- `tests/clinical-ui/tracker-status-baseline.test.cjs`: inverts the declared
  edits and compares the entire route, caller, shared popup engine, select
  renderer, themes and helper with base commit
  `18647270e0c799189d2dc10f801e8de2bff1a360`. Requires git history; never skipped.
- `tests/js/tracker-status-popup.test.js`: opener/engine contract; under Jest it
  also runs the portable suite through `node --test`. It never runs the baseline suite.
- `tests/Tests/Isolated/Common/Assets/ClinicalWorkspaceAssetsTest.php`: missing,
  shipped, updated and rejected (near-miss and traversal) names for the new sheet.

## Limitations (source-only QA)

These checks read source text. They do not prove:

- rendered geometry, wrapping or fit inside the 500 x 250 frame at any width;
- rendered colour contrast in any theme;
- assistive-technology roles or names, or keyboard order in a browser;
- that a real status submit reaches `manage_tracker_status()` or creates an encounter;
- any application request, browser session or database state.

Access control is inherited, not added: the route has no explicit ACL check of
its own and relies on the global authentication in `interface/globals.php`, as
it did before this slice.
