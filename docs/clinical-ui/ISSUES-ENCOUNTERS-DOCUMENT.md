# Issues and Encounters popup as a document

`interface/patient_file/problem_encounter.php` (opened from `stats_full.php` with
`dlgopen('../problem_encounter.php?issue=…')`) gets a route-local, screen-only stylesheet,
`interface/clinical-workspace/issues-encounters-document.css`, when it runs inside an active
workbench popup.

## What changed

- The route adds one `use` line, one `media="screen"` link versioned through
  `ClinicalWorkspaceAssets`, and classes on existing elements (`oe-issues-encounters`,
  `oe-ie-document`, `oe-ie-layout`, `oe-ie-identity`, `oe-ie-sections`, `oe-ie-section`,
  `oe-ie-issues`, `oe-ie-encounters`, `oe-ie-actions`, `oe-ie-instructions`). Nothing else in
  the file differs from master.
- `ClinicalWorkspaceAssets` allowlists `issues-encounters-document.css` (one new entry).
- Every rule is scoped to `html.oe-workbench-context body.oe-issues-encounters` inside one
  `@media screen` block. The generic `workspace.css` is not linked.
- Paper sheet on canvas. The Issues and Encounters sections sit in separate frames, marked by
  different top borders, and stack when the popup is narrower than two 18rem bases. Each wide
  table scrolls inside its own frame. Save, Add Issue and Cancel wrap at their existing
  `btn-sm` size. Radios and actions get separate `:focus` and `:focus-visible` outlines.

## What is unchanged

PHP, SQL, ACL, squad check, CSRF, session, `PatientIssuesService` save, hidden fields, radio
order, row ids, `doclick`/`addPair`/`removePair`/`clearall`, inline yellow/indigo/gray selection
colours, the inline `tr.head`/`tr.detail` style, dialog callbacks, translations and the form
action are unchanged. No rule paints a selection row, its cells or a head row. The
`stats_full.php` launcher and the nested Add Issue popup are byte-identical. Standalone, legacy
mode and print keep the original rendering.

## Evidence

- `tests/js/issues-encounters-document.test.js`: undoing the full edit map gives back the
  master sha256 of the route, with negative mutations for service, ACL, CSRF, SQL, session,
  handlers, colours and controls. The original row/radio/save functions run unmodified against
  a synthetic jsdom page (both radio modes, link and unlink, Save disabled state, missing-key
  alert). Further checks cover sheet scoping, contrast from `popup.css` tokens, the production
  `popup.js` context, and a declared-box estimate at 146px and 180px. The estimate is not a
  browser layout measurement.
- `tests/Tests/Isolated/PatientFile/ProblemEncounter/`: renders the real route file with
  doubled `globals.php`/`restoreSession.php` and synthetic data. It covers the GET view, the
  ACL denial and the squad denial. The Save POST branch is not covered because it reads CSRF
  input through `filter_input()`, which a CLI process cannot feed.
- `ClinicalWorkspaceAssetsTest`: the new name is versioned by its own mtime, falls back to
  `'0'` when the file is missing, and near-miss names are rejected.

## Not established

This change is adapted from source and checked against fixtures. It has not been verified in a
native browser, deployed, or accepted for clinical use. Real-role, real-data, native browser
geometry, dark-theme and print checks still need independent review.
