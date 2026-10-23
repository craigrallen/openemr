# OPEMR-106 message input validation

## Scope and rationale

`MessageService::validate()` now places Particle's native `string()` rule before the existing `lengthBetween()` rule on each of the six required fields: `body`, `to`, `from`, `groupname`, `title`, and `message_status`. The bounds remain 2–65535 bytes for `body`, 2–255 bytes for the four middle fields, and 2–20 bytes for `message_status`. This closes the observed type gap: arrays and objects reached the length rule and threw, while numeric values could pass it. The intent is a `ValidationResult` with a failure for malformed field types, without coercion or changes to the input array.

This is a service validation change only. Valid strings, including numeric strings, Unicode, and newlines, remain valid within the existing byte bounds. There is no sanitization, identity check, recipient policy, writer or body-format change. The root input remains the existing array contract; it is not broadened to arbitrary root values. `insert()`, `update()`, SQL, session, ACL, routes, and REST response handling are unchanged. The REST controller's POST and PUT methods call `validate()` before their write; its request schema already declares all six fields as strings. The `pnotes` schema keeps the existing text/varchar columns.

The controller exercised the native installed Particle vendor from `/Users/craig/.hermes/workspaces/openemr-workbench-shell/vendor` through an external rooted loader that mapped all application classes and functions to this worktree. The final focused GREEN confirms that a failed `string()` rule short circuits the length rule for arrays and objects, rejects numeric field values, enforces the existing byte boundaries, and preserves valid string values unchanged. The dependency is absent from this worktree, but its behavior here is verified by that native run.

## Evidence and next gate

The controller committed the tests-only case as `46aa5b6a` after a genuine native RED: **115 tests, 610 assertions, 12 errors, 12 failures**. The RED showed array/object exceptions and numeric values passing across the six fields. These tests were not changed to mask RED. The initial production invocation made no edits because its shell constraint was ambiguous; the clarified successor implemented all six `string()` chains. The final native focused GREEN was **115 tests, 682 assertions, zero errors, failures, or skips**. The broader native Services run exited 0 with **939 tests, 2685 assertions, one warning, one skip, and one incomplete** (`QueryUtils.php:536`, `BaseCodeTypeImporterTest`); it was neither the full suite nor issue free. PHP syntax checks passed for both changed PHP files. The initial PHPCS loader failed with a missing class, so there is no PHPCS pass claim. Independent review and hosted CI remain pending.

Native test command for the controller:

```sh
vendor/bin/phpunit -c phpunit-isolated.xml --do-not-cache-result tests/Tests/Isolated/Services/MessageInputValidationTest.php
```

This documentation correction has not run tests, PHP, the project, the database, or transport. In the portal branch, `library/ajax/upload.php` calls `MessageService::insert()` to create a document notification without first calling `validate()`; `insert()` itself does not validate. Separately, the HL7 results path in `interface/orders/receive_hl7_results.inc.php` inserts into `pnotes` directly. Neither path is covered by the service validation change, nor are other direct writers.

## Remaining acceptance

Authenticated role, session, ACL, REST response, persisted message, security, and clinical acceptance remain outstanding, as does ordinary approval. This slice does not complete feature 6 in `ACCEPTANCE.md` (patient-linked internal notes/messages between medical staff).
