# Surgery encounter link (OPEMR-135)

## Contract and change

`PatientIssuesService::linkIssueToEncounter()` documents and stores its encounter argument as `form_encounter.encounter`. The schema gives `form_encounter` a separate `id` primary key and `encounter` column; `issue_encounter` stores `pid`, `list_id`, and `encounter`, with a unique key across those three columns. A surgery in `lists` is associated through `issue_encounter.list_id = lists.id` for the same patient.

`SurgeryService::search()` now projects `form_encounter.encounter AS eid` and matches the encounter on both the stored clinical encounter number and the surgery patient. This prevents a numerically colliding `form_encounter.id` or another patient's clinical encounter number from supplying the wrong `euuid`. The change is confined to two lines of that query.

The existing left joins remain: a surgery without an issue association, or with an association that has no matching encounter for its patient, still returns a row with null `eid` and `euuid`. Multiple valid associations remain multiple rows, each with its own encounter UUID. The query still filters `lists.type = 'surgery'`, uses the same search builder and bound values, and converts UUID fields through the existing result path. It does not deduplicate rows or add an authorization policy.

## Verification evidence and status

The tests-only commit `be6bfc751452cc73498670ac7bcfa0b90659e17b` preceded the production commit `0b7166668fa53e1adc03032058cbad82cd603a36` in Git history. The controller ran the same command from this checkout for RED and GREEN, using PHP 8.5.12 and PHPUnit 11.5.56:

```sh
php /Users/craig/.hermes/projects/openemr/verification/surgery-encounter-link-20261025/phpunit-native.php -c phpunit-isolated.xml --do-not-cache-result tests/Tests/Isolated/Services/SurgeryEncounterLinkTest.php
```

The external evidence directory `/Users/craig/.hermes/projects/openemr/verification/surgery-encounter-link-20261025/` contains `RED.log` and `GREEN.log`. RED reported **6 tests, 74 assertions, 3 failures, 0 errors**: the first case received the foreign-patient UUID ending `cccc...1` instead of the same-patient UUID ending `bbbb...1`; the foreign-only reference returned `eid` 901 rather than null; and the valid multiple-association case returned null encounters. GREEN reported **6 tests, 99 assertions, 0 issues**. The logs do not embed commit hashes; commit ordering is established separately by Git history.

The relational cases execute the actual `SurgeryService::search()` SQL through native `QueryUtils` and ADODB entry points backed by an in-memory PDO SQLite database with the relevant tables. The controller also checked the exported native query and synthetic fixture in an isolated Docker `mariadb:12.3.3` container (`--network none`, no host ports or live database). The MariaDB check used the five complete `CREATE TABLE` definitions extracted from this checkout's `sql/database.sql`. Its evidence is `mariadb-verification.json`, `mariadb-native.log`, `mariadb-native.sql`, and `verify-mariadb.py` in the same external directory. The corrected query returned `eid` 900 with the same-patient UUID ending `bbbb...1`, null `eid` and `euuid` for the foreign-only link, and separate `eid` 902/903 rows with their matching UUIDs. The original join on the same schema and data returned the foreign UUID ending `cccc...1` for the collision. This verifies the bounded relational query against those source definitions and fixtures, not a full application database or installation.

The controller's broader isolated Services run exited 0 with **830 tests, 2102 assertions, 1 warning, 1 skipped, and 1 incomplete** (`services.log`); it was not issue-free. This correction phase has not run PHP or tests. Hosted full exact-head CI, production-like runtime integration, authenticated FHIR and ACL checks, audit behavior, and clinical acceptance remain unverified. This is not a full22, UI, clinical, or security exploit acceptance claim.

`SurgeryService::getAll()` contains a separate legacy encounter join and is outside this change. The remaining path is normal approval followed by hosted full exact-head CI and runtime acceptance. This note grants no standing bypass.
