# Patient note recipient read guard (OPEMR-113)

This is a supporting change for original feature 6. `checkPnotesNoteId()` now returns `false` after its note query when the row has a missing, empty, or mismatched ID, or when either `user` or `assigned_to` is missing or null. These cases do not enter the dependent portal-user lookup. Malformed rows are defensive cases; the ordinary `SELECT` includes all three columns. This is needless-dependent-query and malformed-row hardening, not a demonstrated SQL exploit or a full authorization fix.

The new guard checks the null-coalesced ID value for falsiness, including `false`, `0`, `'0'`, `''`, `null`, and `[]`. The original branch checks remain unchanged.

The note SQL, ID bind, and `deleted != 1` filter are unchanged. Complete rows still use the original loose ID comparison and `in_array` recipient comparison. A valid empty recipient string is still present metadata and follows the original branches. Valid unrelated users, including those on notes assigned to a nonportal user, still reach the existing portal lookup. Query errors already throw through `QueryUtils`; this guard adds no error-handling guarantee.

The source callers in `interface/main/messages/messages.php` use this check for edit, add to an existing nonpatient-assigned note, save, and delete. Its separate `-patient-` creation path does not call this check and is outside this change.

## Verification and release boundary

Before this production change, the controller recorded a genuine native RED against the actual target source: 24 tests, 218 assertions, 2 errors, 8 failures, and no deprecations. The earlier native log failed during loader setup, and the empty rooted run exited in a driver `die`; neither establishes a product test result. The external loader at `/Users/craig/.hermes/projects/openemr/verification/pnotes-recipient-read-20261023/bootstrap-rooted.php` loads the actual `adodb.inc.php` before its mysqli driver and roots application classes in this checkout. It does not require repository config or vendor edits.

The controller can run the targeted native test from the repository root with this existing loader:

```sh
cd /Users/craig/.hermes/workspaces/openemr-pnotes-recipient-read
/opt/homebrew/bin/php -r 'define("PHPUNIT_COMPOSER_INSTALL", "/Users/craig/.hermes/projects/openemr/verification/pnotes-recipient-read-20261023/bootstrap-rooted.php"); require PHPUNIT_COMPOSER_INSTALL; exit((new PHPUnit\TextUI\Application())->run(array_merge(["phpunit"], array_slice($argv, 1))));' -- -c phpunit-isolated.xml --do-not-cache-result tests/Tests/Isolated/library/PnotesRecipientReadTest.php
```

This targeted test uses real `QueryUtils` and native ADODB transport mocks. It does not establish full suite, CI, clinical, or deployment acceptance. Full authenticated role and session checks, CSRF, clinical and security review, persistence QA, and ordinary approval remain required. This change is unmerged and undeployed.

The guard and test corrections described here received static diff review only. The controller still needs to rerun the targeted native test and independently review these corrections.
