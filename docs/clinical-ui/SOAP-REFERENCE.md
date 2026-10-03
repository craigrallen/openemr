# SOAP editor: previous-notes reference

An optional, collapsed side panel in the SOAP form editor
(`interface/forms/soap/`) that shows the same patient's earlier SOAP notes as
read-only reference while a clinician writes the current note.

## What is supported

- **Previous SOAP notes only.** The panel reads `form_soap` rows joined to
  `forms` (`formdir = 'soap'`, `deleted = 0`) and `form_encounter`, with the
  patient repeated on every join. Other form types, documents, problems,
  medications and external records are not shown.
- **Same patient, earlier encounters.** The current encounter and the form
  being edited are excluded; notes dated after the current encounter are
  excluded. At most 5 notes are shown, newest first, each with its encounter
  number and date as provenance.
- **Read-only.** Nothing in the panel writes to the database. Earlier notes
  cannot be edited from the panel.
- **Copy only on explicit command.** Each section of an earlier note has a
  "Copy to current draft" button. Clicking it appends that section's text to
  the matching field of the note being edited, in the browser only. Nothing is
  saved until the clinician saves the form through the existing save action,
  and the copied text should be reviewed first. Nothing is copied
  automatically.

## Access and lock rules

These reuse existing OpenEMR rules; the panel adds no new permissions.

- **Form ACL:** the `soap` registry row's `aco_spec`, checked as
  `AclMain::aclCheckForm('soap')` does (no row or empty spec means no form ACO
  applies). Denied → "restricted" message, no query of notes.
- **Encounter sensitivity:** as in `view_form.php`, a note whose encounter has
  a non-empty sensitivity requires `aclCheckCore('sensitivities', <level>)`.
  Notes failing that are withheld and the panel says some notes are hidden; a
  fully withheld result is shown as restricted, never as "no earlier notes".
- **Copy eligibility (ESign):** copy is offered only when the server
  positively determines the note being edited is unlocked, using the same
  queries as `Encounter_Signable::isLocked()` (`lock_esign_all`) and
  `Form_Signable::isLocked()` (`lock_esign_individual`, keyed by `forms.id`).
  A saved note must belong to exactly one `forms` row for the session patient
  and its encounter. Any doubt denies copy. The panel only reads lock state; it
  never signs or locks.

## Failure behaviour

- Reads use the throwing `QueryUtils` path. A database or other runtime
  exception degrades the panel to "Earlier SOAP notes could not be loaded"
  with copy denied, and the SOAP editor still renders and saves as before.
- A malformed or out-of-scope row makes the whole result unavailable rather
  than partially shown.
- PHP `Error`s and promoted warnings (`ErrorException`) are treated as
  defects and are not swallowed.

## Unchanged

Form IDs, names, actions, save/process flow, the ESign workflow, REST/FHIR
APIs, drafts and the encounter iframe ancestry are unchanged. The panel is
added to the existing editor template only.

## Limits

- This is a convenience reference. It makes no claim of clinical decision
  support, documentation completeness, or regulatory/compliance conformance,
  and it is not an authoritative record view; the encounter's own form view
  remains the source of truth.
- Verified by isolated PHPUnit and Jest tests with synthetic data and stubbed
  reads. It has not been verified against a live database, real ACL
  configurations, real ESign lock data, or in a running browser session.
