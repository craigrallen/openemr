# Patient name search splitting (OPEMR-114)

Status: local production change with controller GREEN complete; independent review and hosted CI remain pending. This is a narrow contribution toward original requirement 1, faster access to patient records; it does not complete the clinical UI redesign or demonstrate a latency improvement or an exploit fix.

## Scope and expected behavior

`library/patient.inc.php` contains the native `getPatientNameSplit()` parser and its `getPatientLnames()` caller. Consecutive ASCII U+0020 spaces between tokens now act as one separator in the no-comma name list and on the given-name side of comma syntax. For example, `Ada  Byron   Lovelace` yields first `Ada`, middle `Byron`, last `Lovelace`; `Van  Dyke,Ada  Byron` keeps last `Van  Dyke`. Empty split tokens are filtered with an explicit comparison to `''`, so the literal token `0` is retained.

This changes searches that previously treated repeated spaces as empty tokens, including cases where the extra tokens caused the middle name to be dropped. Existing outer `trim()` behavior, empty and extra comma-field handling, surname-side internal spacing, tab/newline/nonbreaking-space treatment, wildcards, case, punctuation, and the existing handling of more than three tokens remain as before. In particular, a single `0` still becomes `%` through the existing `empty()` check, and empty comma fields remain empty. SQL construction, binds, callers, and ACL code are unchanged.

## Test evidence and next verification

`tests/Tests/Isolated/library/PatientNameSplitTest.php` requires the actual `library/patient.inc.php` through its native include path. Its data providers cover established outputs and the repeated ASCII-space cases without a database or clinical bootstrap. Before the implementation change, the controller verified genuine RED against the unmodified native source: 41 tests, 41 assertions, 11 failures, no errors. The tests-only commit `1401155f232f6cf4ac39e27499e8b0c9e77ad063` was the starting HEAD. The controller then verified GREEN with native PHP 8.5.12 and PHPUnit 11.5.56: 41 tests, 41 assertions, zero failures, errors, or skips. `php -l` passed for both changed PHP files, and `git diff --check` passed. Independent diff review and hosted CI remain pending.

The three paths for this slice are `library/patient.inc.php`, `tests/Tests/Isolated/library/PatientNameSplitTest.php`, and `docs/clinical-ui/PATIENT-NAME-SPLIT.md`. The test file's acceptance cases were left intact.

## Residual verification and delivery

Authenticated Finder, calendar, and portal behavior remain to be checked. DB-backed query results, roles, persistence, security, and clinical QA need separate verification, followed by ordinary approval. This local change is not acceptance, a merge, or a deployment; no full suite result is claimed. Prior PR #55 is exhausted and parked; PR #47 is merged, with postmerge work complete and cached. The denied Swedish clone/publication actions remain denied. This is run 1 of at most 2; if a further run is needed, the default next run is DIFFERENT.
