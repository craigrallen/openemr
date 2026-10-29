# PHQ-9 editor presentation

The existing PHQ-9 questionnaire is presented as a document sheet inside the clinical screen workbench. The screen-only CSS in `interface/forms/phq9/common.php` applies when the page is under `html.oe-workbench-context` and its body has `phq9-document-editor`. The questionnaire and form have a fluid maximum width of 860px, with space for the question labels and their attached answer selects. The dynamically populated question 10 area, score, and native Save and Cancel actions remain in the same form and receive the same visual treatment. The rules include visible keyboard focus and wrapping at narrower widths. Print and pages outside this workbench context are outside the CSS selector or media rule.

This is a presentation slice of the original requirement 2, which remains **partial**. It does not complete requirement 2, all 22 requirements, design fidelity, or clinical acceptance. The edit adds only the frozen CSS literal and the body class; the original source bytes otherwise remain intact. The existing field names, question and clinical text, answer options, scoring and validation scripts, defaults, form action, CSRF token, and Save and Cancel handlers are preserved as source. Source preservation is not authenticated acceptance.

## Verification ownership and evidence

The genuine tests-first RED was recorded at tests-only commit `5efa68ab1ad3ee9d299480cffc75c1d1d1e98a4d`: the controller's portable run had 6 passes and 1 failure, and the explicit history run had 8 passes and the same 1 failure. The failing check was the missing body presentation in the unedited source. The proposal, mutants, full original fixture, and supporting-file scope checks passed. The controller's `proposal-lint.json` reported zero nonignored CSS warnings or errors. These are prior controller results; this production edit has not run the tests. Verification, including the scheduled delivery run, remains controller-owned. The schedule is run 1 with a maximum of 2 delivery runs including QA; internal implementation, test, and review activity does not create separate delivery runs.

The default hosted portable invocation is shallow-safe. For an explicit history check in a checkout with the required history, use:

```sh
node tests/clinical-ui/phq9-editor-contract.cjs --history
```

The work remains unmerged and undeployed. Ordinary approval applies, with no bypass. Native authenticated Save, update, reopen, role and CSRF behavior, persistence, accessibility, the full reference, localization, older engines, and OS print remain open. The source also retains an inherited dynamic `onchange` string and a new-form null difficulty warning; this presentation edit does not resolve either logic issue.
