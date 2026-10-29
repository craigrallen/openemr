# Review of Systems editor: workbench document styling

The Review of Systems questionnaire is rendered by
`interface/forms/ros/templates/ros/general_new.html`. This phase adds a paper-like
document presentation inside the active clinical workbench. The form remains the
original Review of Systems form, with its existing fields, radio choices, actions,
translations, session handlers and CSRF token.

## Presentation

- The new CSS sits in `@media screen` and every selector begins with
  `html.oe-workbench-context body.ros-document-editor`. The body class is the only
  markup change. Outside the workbench context, and in print, the new CSS does not
  apply.
- The questionnaire and its container have a maximum width of 860px, use the
  available width below that, and center in the workbench. Responsive padding,
  wrapping text and a wrapping action group let the document adapt to smaller
  screens. The section legends, question labels and Save/Cancel actions have
  readable paper-and-ink colours.
- The existing native radio inputs remain visible. Each generated radio label is
  styled as one full clickable choice, with room for wrapped text. Keyboard focus
  has a visible outline on choices and actions. No field or new notes area is added.

## Scope and evidence

The tests-first contract is in commit `15388e64`. Before this production edit,
the controller verified genuine RED: the portable run had 7 checks, 6 passing
and 1 failing for the missing presentation; the history run had 9 checks, 8
passing and the same missing-presentation failure. The positive proposal and
mutation checks passed. The proposed nonignored CSS had zero lint warnings.
These are pre-edit results, not a claim that post-edit tests or a browser run
have passed. The direct local contract command is
`node tests/clinical-ui/ros-editor-contract.cjs --history`; the portable mode
without `--history` is suitable for shallow hosted checkouts. Neither was run
in this production phase under the current execution restrictions. Controller
verification of this edit remains pending.

This phase covers the real HTML template in the workbench and the stated
presentation contract only. It is a partial original 2 result, not full 2,
all 22, reference fidelity or clinical acceptance. The untouched template
still has inherited duplicate attributes and clinical getter defects; this
styling phase does not resolve or validate them. Authenticated Save and reopen
update, security and roles, patient context, CSRF behaviour, persistence, full
accessibility, the full reference set, localization, older engines and OS print
remain open. The change is unmerged and undeployed.
