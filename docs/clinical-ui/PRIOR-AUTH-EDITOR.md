# Prior authorization editor document presentation (OPEMR-166)

## Scope

`interface/forms/prior_auth/templates/prior_auth/general_new.html` adds one inline screen stylesheet and the `prior-auth-document-editor` body class. Every CSS selector is rooted at `html.oe-workbench-context body.prior-auth-document-editor`. In that context, the existing form gains a centered paper sheet, a ruled heading, spaced Details and Comments groups, readable fields and comments, paired paper/ink and petrol/action colors, and visible keyboard focus outlines. The stylesheet does not apply to print or to pages outside the workbench context.

The production addition is exactly the literal `CSS` and body class proposal exported by `tests/clinical-ui/prior-auth-editor-contract.cjs`. Removing those two additions restores every original template byte. Native attributes, Smarty expressions, datepicker setup, form action, session restoration, CSRF field, hidden fields, Save and Cancel actions, and the original inverse remain intact. The inherited Number label still refers to a missing input ID, and the Comments textarea still carries a redundant `value` attribute; neither receives a speculative semantic change here.

This is a partial presentation slice of original requirement 2. It does not complete requirement 2, the original 22-item scope, reference fidelity, or clinical acceptance.

## Tests-first evidence and verification status

The tests-only commit `e1cd1676` preceded the production edit. The controller ran genuine RED on the unchanged template. Reproduction commands for the two source-contract modes are:

```sh
node tests/clinical-ui/prior-auth-editor-contract.cjs
node tests/clinical-ui/prior-auth-editor-contract.cjs --history
```

The portable run recorded 7 pass, 1 fail; the history run recorded 9 pass, 1 fail. In each, the only failure was `actual template has the exact scoped presentation proposal`, reporting the missing `<body class="prior-auth-document-editor">` seam. The RED logs are `/Users/craig/.hermes/projects/openemr/verification/prior-auth-editor-20261029/red-portable.log` and `red-history.log` in that same directory. The controller also linted the proposed CSS: Stylelint exited 0, with no warnings, errors, or ignored source (`proposal-lint.json` in the same evidence directory).

This production edit has not been executed or tested by this coding agent. GREEN source-contract runs, lint against the edited template, and independent browser verification remain for the controller. The prior RED and proposal lint results do not establish post-edit success.

## Open acceptance

Authenticated real-browser checks remain open for save, update, reopen, native date widgets, roles, patient and encounter context, CSRF and session handling, security, persistence, full accessibility, RTL localization, older engines, OS print, ordinary approval, and complete hosted coverage. No production patients or integrations were used. Prior OPEMR-165 missing coverage and OPEMR-163/OPEMR-161 keyboard issues remain parked. No merge or deployment is authorized by this slice. A later independent candidate is for the controller to select; none has been inspected or chosen here.
