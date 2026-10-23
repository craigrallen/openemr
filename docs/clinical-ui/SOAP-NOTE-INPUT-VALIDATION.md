# SOAP note input validation (OPEMR-110)

## Scope and rationale

`EncounterService::validateSoapNote()` now applies Particle Validator's `string()` rule before the existing `lengthBetween(2, 65535)` rule for each of `subjective`, `objective`, `assessment`, and `plan`. Previously, `lengthBetween()` called `strlen()` on non-string values: arrays and objects could raise `TypeError`, while JSON numbers could pass after implicit conversion. A present, nonempty non-string value now produces a field validation error before length checking. The change is limited to these four chains; it does not cast, trim, sanitize, or rewrite input, and it changes no SOAP schema, storage, authentication, or CSRF policy.

The existing length rule counts **bytes** with `strlen()`, with inclusive bounds of 2 and 65535 bytes. Unicode text and newlines are kept as supplied, and validated string values are not transformed. A one-byte nonempty string fails the lower bound; 65536 bytes fails the upper bound.

Particle's optional chain stops before `string()` and `lengthBetween()` for an omitted field, `null`, `''`, or `[]`. Those values retain their existing accepted behavior, including the empty array; this is not a blanket rejection of every array. Nonempty arrays, objects, JSON numbers, and JSON booleans reach `string()` and fail cleanly. Unknown fields are outside these four chains.

## Evidence and verification

The tests-only commit `22650b62` was run against the actual target native validator through an external rooted dependency-only loader, without running the service constructor or a database. Its RED result was **62 tests, 164 assertions, 9 TypeErrors and 8 failures**. The TypeErrors covered array/object and mixed-array inputs; the failures covered accepted JSON numbers. The controller then exercised the actual target validator after the production edit: **62 tests, 224 assertions, zero errors or failures**. The broader isolated Services directory completed with **886 tests, 2227 assertions**, zero errors or failures, but **one warning, one skipped test and one incomplete test**; it is not an issue-free full-suite result. The warning was an array-offset-on-null warning in `QueryUtils.php` triggered by `BaseCodeTypeImporterTest`. PHP syntax checks for both changed PHP files and `git diff --check` passed. In a normal full clone, the native isolated test command is:

```sh
vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/Services/SoapNoteInputValidationTest.php
```

Source inspection of `EncounterRestController::postSoapNote()` and `putSoapNote()` shows both call `validateSoapNote($data)`, pass its result to `RestControllerHelper::validationHandler()`, and return on validation error before calling `insertSoapNote()` or `updateSoapNote()`. This is source-only provenance, not a REST or transport test. Direct service writes or other callers can bypass this validation; the change does not establish coverage for every write path.

This independent surface used run **1 of a maximum 2 consecutive delivery runs**, counting implementation and QA. Default next work rotates to a different eligible item, not unchanged polling. Remaining gates are authenticated UI and security checks, clinical acceptance, ordinary approval, and full exact-head hosted verification. Native GREEN does not establish those gates. This is input-safety hardening supporting original feature 2, not completion of its document-style editor, spell-check or autocorrect acceptance.
