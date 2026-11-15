# OPEMR-238: zero narrative content

## Scope and source control

`ClinicalNoteParser::extractItemContent()` now retains a child whose trimmed text is exactly `"0"`. The sole product change is `if ($text) {` to `if ($text !== '') {`; empty and whitespace-only children remain omitted. The native fixture records the original parser SHA-256 as `d3cb6d863c0860bab8938eea0cd8dab972043eed318cd2bf46c106c77cf4c01b`. It accepts the original source or the single correction only when replacing that correction with the original condition reproduces the recorded SHA-256. The PHP fixture, guards, IDs, XML policy, and formatting were not changed.

## Native evidence

At the controller-pinned tests-only `ec35d953` head, the controller independently recorded genuine native RED: 18 checks, 12 passed, 6 failed. After the parser correction, `php tests/clinical-ui/clinical-note-zero.php.fixture` returned `{"total":18,"passed":18,"failed":0,"failures":[]}` with exit code 0. The expected GREEN is therefore 18 passed and 0 failed. `php -l` passed for the parser and fixture; `node --check` passed for the adapter.

The native fixture uses fixed synthetic XML with PHP DOM. It covers zero-only text and paragraph content, zero between sibling elements, whitespace omission, nonzero and Unicode content, batch and single-item selection, a missing item, a table zero-cell regression, and a synthetic full-document section with references and metadata. The Jest adapter statically invokes that fixture and requires one JSON line with one terminal LF, empty stderr, the report keys and internal counts, exact 18/18/0 totals, and a successful process exit. Its framing expression is `/^[^\r\n]*\n(?![\s\S])/`; the negative lookahead rules out an additional trailing LF. The adapter was syntax checked but was not run locally, so no JavaScript RED or hosted adapter result is claimed.

Source-only tracing connects `CdaTemplateParse::clinicalNotes()` to `fetchClinicalNoteData()` and its call to `ClinicalNoteParser::parseClinicalNotesByCode()`, then to the `clinical_notes` fields. The fixture exercises the parser with synthetic input; this tracing does not exercise that connected caller.

## Coverage and next gates

This evidence does not establish full schema-valid CDA conformance, authenticated import, SQL or persistence behavior, clinical safety, roles, the original 22-check suite, or UI acceptance. Hosted adapter, static analysis, and coverage results remain required, followed by ordinary approval and native QA. No merge, deployment, master change, or cron action is part of this fix.
