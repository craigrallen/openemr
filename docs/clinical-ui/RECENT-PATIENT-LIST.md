# Recent patient list read safety (OPEMR-105)

## Scope and rationale

`PatientService::getRecentPatientList()` keeps the existing user selection and `SELECT patients FROM recent_patients WHERE user_id = ?` query. The `recent_patients.patients` column is nullable `TEXT`; the existing writer serializes an array of patient entries into it. The read now returns an empty list for a missing row, a missing or nonstring column, or a malformed serialized root. It deserializes with `allowed_classes => false`, so stored objects cannot run their wakeup hooks. A native error handler covers warnings and notices only during `unserialize()`, records a parse diagnostic, and is restored in `finally`. A diagnostic rejects the whole root. Comparing the decoded array's serialization with the stored bytes also rejects trailing data on PHP versions that accept a valid prefix without a diagnostic.

Each accepted entry must be an array with a positive integer PID or a nonzero, unsigned decimal digit string PID. Zero is the no-patient value and is excluded. Negative values, signs, decimal points, exponents, whitespace, booleans, floats, objects, arrays, and missing PIDs are dropped. No integer conversion or upper bound is applied to decimal strings: leading zeros and strings larger than the platform integer range retain their original type and value. Accepted entries retain their order and duplicates; the returned array is reindexed and contains only `pid` keys. Other stored entry fields are not returned.

The writer can still encounter malformed cached rows during its own read and update path. This change does not repair stored data or change the writer, ACLs, callers, navigation, or database schema.

## Native contract and gates

The committed `tests/Tests/Isolated/Services/RecentPatientListTest.php` invokes the actual service source with an in-memory session and mocked read responses. Its strict error handler treats an emitted warning or notice as a failure. It checks the exact query and user binding, legacy PID preservation, malformed roots and entries, and blocked object wakeup. Run it from the repository root with:

```sh
vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/Services/RecentPatientListTest.php
```

Before the production edit, the controller ran this native contract on unchanged production and reported 39 tests, 234 assertions, 20 errors, and 16 failures; only valid, missing-row, and session cases passed. An earlier session setup error was corrected before this RED run and is not counted as product evidence. The controller's post-edit focused run passed 39 tests and 327 assertions with zero errors or failures. The broader isolated Services run exited zero with 863 tests and 2330 assertions, but retained one warning, one skipped test and one incomplete test; it is not issue-free or a full-suite result. PHP syntax, the repository PHPCS rules for both PHP files, and diff hygiene passed. Independent Astra static review found no substantiated introduced P1/P2/P3 issue; it did not reproduce tests and is not GitHub approval. Local execution uses an external vendor-only loader mapped to this worktree's actual application/test classes and Composer files; hosted target-container gates remain authoritative. Initial loader/PHPCS setup failures are retained separately, not reported as product failures or passing checks.

These read-only mock tests do not exercise a live clinical PHP route, database, role permissions, session lifecycle beyond the mocked lookup, or performance and full-feature acceptance. Native role/session, clinical workflow, security, ordinary approval, and exact-head hosted CI gates remain separate. For the same surface or PR, the delivery schedule allows at most two consecutive runs across implementation and QA. After run 1, the default is to rotate to an independent lane rather than poll the same unchanged state automatically.
