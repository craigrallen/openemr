# Group attendance editor — OPEMR-161

Owner: Hermes. Delivery run: 1 of at most 2, including QA. This is a partial
supporting UI slice for original requirement 2, not full requirement 2, all 22
requirements, or design fidelity acceptance.

## Production change

`interface/forms/group_attendance/new.php` adds the exact contract CSS block
immediately before `</head>` and adds `group-attendance-document-editor` to the
existing body class. At screen size, selectors require
`html.oe-workbench-context body.group-attendance-document-editor`. They present
the form as a document on a muted canvas, constrain the workspace to 1000px,
retain the four-column attendance table with horizontal scrolling at narrow
widths, and style controls, focus rings, pagination and button states. Legacy
direct-page rendering and print are outside the new selector/media scope.

The original PHP, ACL checks, form fields, actions, JavaScript, DataTables setup,
native Add Patient flow and bindings remain byte-for-byte unchanged. This is a
presentation change; no clinical workflow or persistence change is claimed.

## Exact five-path final scope

The intended delivery diff from the pinned baseline contains exactly:

1. `interface/forms/group_attendance/new.php` — production presentation addition.
2. `tests/clinical-ui/fixtures/group-attendance-new-original.php.txt` — complete original source fixture.
3. `tests/clinical-ui/group-attendance-editor-contract.cjs` — source, CSS and scope contract.
4. `tests/js/group-attendance-editor.test.js` — portable JavaScript contract.
5. `docs/clinical-ui/GROUP-ATTENDANCE-EDITOR.md` — this handoff and limits.

The tests-only commit `45d62d99` preceded the production edit. The controller's
genuine RED evidence is in
`/Users/craig/.hermes/projects/openemr/verification/group-attendance-editor-20261029/red-portable.log`
and
`/Users/craig/.hermes/projects/openemr/verification/group-attendance-editor-20261029/red-history.log`.
Portable RED: 9 tests, 8 pass and 1 fail on the missing body/style seam.
History RED: 11 tests, 9 pass and 2 fail, one for the missing presentation and
one for the expected incomplete five-path final scope. The positive proposal
and semantic/presentation mutant checks passed in RED; the history result was
not solely a product failure.

Local verification commands for the controller:

```sh
node tests/clinical-ui/group-attendance-editor-contract.cjs
node tests/clinical-ui/group-attendance-editor-contract.cjs --history
```

GREEN, browser QA, lint, hosted QA and independent review remain pending
controller execution. This implementation run did not execute tests or runtime
commands, so no post-edit pass is asserted.

## Open acceptance work

Authenticated add/save/reopen and role checks; patient, encounter and therapy
group context; CSRF, security and persistence; full accessibility and reference
fidelity; native localization, old engines, OS and print checks remain open.
There is no merge, deployment, database or clinical acceptance, and no Swedish
publication.
