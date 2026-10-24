# First social-history save without a history row

`SocialHistoryService::updateHistoryDataForPatientPid()` reads the latest `history_data` row before appending a new one. The native `sqlQuery()` result is `false` when no row exists. In that case only, the service now starts the merge with `['pid' => $pid]`. Submitted fields still merge afterward, including a submitted PID, and existing rows retain their previous merge behavior. The insert, date reset, attribution, UUID, and save events are unchanged.

This is a supported missing-row service case: `PatientService::databaseInsert()` inserts `patient_data` without creating `history_data`. The legacy patient creation pages call `newHistoryData($pid)`, and `history.php` creates a missing row on GET. Those routes do not establish a reproducible authenticated UI save defect.

## Native test boundary

`tests/Tests/Isolated/Services/SocialHistoryFirstSaveTest.php` uses the repository's real ADOdb, `QueryUtils`, UUID registry, session, kernel, and save events with an isolated SQL transport. It covers missing-row first saves, a numeric-string PID's insert bind and returned value, existing-row append and submitted PID merge behavior, and nonnumeric PID rejection. Run it with the repository configuration:

```sh
vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/Services/SocialHistoryFirstSaveTest.php
```

Before the service change, the controller's native RED run reported 5 tests, 76 assertions, 2 errors (`InvalidArgumentException: pid must be a valid number` on the missing-row cases), and 2 deprecations from merging into `false`; the existing-row paths passed. Evidence: `/Users/craig/.hermes/projects/openemr/verification/social-history-first-save-20261024/RED-native.log`.

Before these runtime narrowing assertions, the controller's native GREEN run reported 6 tests and 171 assertions with no issues. The broader Services run exited 0 with 830 tests and 2174 assertions, plus 1 warning, 1 skip, and 1 incomplete test. Syntax and diff checks passed. An independent three-file review found a static narrowing concern in the test, which this correction addresses; the controller has not yet executed the corrected version or its hosted gates. Acceptance still requires authenticated role and ACL checks, session and persistence verification, clinical-security review, and ordinary approval. The isolated tests do not establish a reproduced UI defect, an exploit, or completion of feature 22.
