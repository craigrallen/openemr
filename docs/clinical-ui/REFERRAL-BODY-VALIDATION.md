# Referral body validation (OPEMR-126)

`PatientTransactionService::validate()` applies this rule only when the transaction type is `LBTref`. Its real source caller is `TransactionRestController::CreateTransaction()`, which passes request data to the service. The service still passes the original transaction, without normalization, to Particle Validator.

The referral body remains required and retains Particle's `lengthBetween(2, 150)` rule. For a present body whose shape PHP's `strlen()` cannot accept (an array, a resource, or an object without `Stringable`), validation first applies Particle's native `IsString` rule. A nonempty malformed body now produces `IsString::NOT_A_STRING` with `body must be a string` instead of a `TypeError`. Empty arrays continue through the existing required rule and report `body must not be empty`; omitted bodies report `body must be provided, but does not exist`, and null and empty strings retain `body must not be empty`.

The conditional guard leaves the legacy length behavior for strings, integers, floats, booleans, and `Stringable` objects intact. Length is measured by `strlen()` in bytes, including newline bytes: a single `é` is two bytes and passes; 151 bytes fail even if they represent fewer than 151 characters. The existing Particle length error wording says “characters.” No other referral rules or non-referral transaction rules change.

## Verification status

The supervising Hermes controller's native service-level RED run at tests-only commit `4c71bb3a` executed 34 tests and 141 assertions. Four malformed-body cases (nonempty indexed and associative arrays, `stdClass`, and a live resource) raised `strlen()` `TypeError`s; there were no other failures. The legacy scalar, `Stringable`, required-empty, byte-length, date, and non-referral cases passed. This is RED evidence, not a GREEN result.

The supervising Hermes controller's first attempted GREEN and Services runs reached a PHPUnit startup/runtime error after 13 target cases: `Serialization of class@anonymous is not allowed` in `SeparateProcessTestRunner.php:94`. Anonymous `Stringable` objects created in data providers caused this separate-process serialization error. The providers now pass serializable string descriptors, and the test methods create those objects inside the child processes; separate-process isolation remains enabled.

The supervising Hermes controller then ran the native service-level tests under PHP 8.5.12. The saved `GREEN-final.log` and `GREEN-final.xml` report 34 tests, 161 assertions, and zero issues for the targeted referral-body test. The saved `GREEN-Services-final.log` and `GREEN-Services-final.xml` report 858 tests and 2164 assertions with zero errors or failures, but one warning, one skipped test, and one incomplete test. The broader Services run is therefore not issue-free. These runs did not execute `TransactionRestController` integration tests. With native dependencies available, the targeted command is:

```sh
php vendor/bin/phpunit -c phpunit-isolated.xml --do-not-cache-result tests/Tests/Isolated/Services/ReferralBodyValidationTest.php
```

The supervising Hermes controller used an external dependency loader; this change does not alter the target checkout's vendor tree. The isolated tests are database-free. An independent Codex Astra static review of the complete three-file change found no P1 or P2 findings; it used a separate model and context from the same provider and did not run tests. Hosted CI and native authenticated roles, session, ACL, persistence, security, and clinical QA, plus ordinary approval gates, remain open. This coverage is not the full original 22-feature programme, a redesigned UI check, or clinical acceptance.

`TransactionRestController::CreateTransaction()` currently proceeds to `insert()` even when validation reports an error. OPEMR-121 / PR194 is separately required for invalid-no-write behavior. This service validation change does not establish endpoint no-write safety or security exploit remediation.
