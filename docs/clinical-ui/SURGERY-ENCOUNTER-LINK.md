# Surgery encounter link (OPEMR-135)

## Contract and change

`PatientIssuesService::linkIssueToEncounter()` documents and stores its encounter argument as `form_encounter.encounter`. The schema gives `form_encounter` a separate `id` primary key and `encounter` column; `issue_encounter` stores `pid`, `list_id`, and `encounter`, with a unique key across those three columns. A surgery in `lists` is associated through `issue_encounter.list_id = lists.id` for the same patient.

`SurgeryService::search()` now projects `form_encounter.encounter AS eid` and matches the encounter on both the stored clinical encounter number and the surgery patient. This prevents a numerically colliding `form_encounter.id` or another patient's clinical encounter number from supplying the wrong `euuid`. The change is confined to two lines of that query.

The existing left joins remain: a surgery without an issue association, or with an association that has no matching encounter for its patient, still returns a row with null `eid` and `euuid`. Multiple valid associations remain multiple rows, each with its own encounter UUID. The query still filters `lists.type = 'surgery'`, uses the same search builder and bound values, and converts UUID fields through the existing result path. It does not deduplicate rows or add an authorization policy.

## RED evidence and verification status

The tests-only commit `be6bfc751452cc73498670ac7bcfa0b90659e17b` preceded the production change. The controller's recorded RED run of `tests/Tests/Isolated/Services/SurgeryEncounterLinkTest.php` reported **6 tests, 74 assertions, 3 genuine failures, 0 errors**. The first case expected the same-patient encounter UUID ending `bbbb...1` but received the foreign-patient UUID ending `cccc...1`; the foreign-only reference returned `eid` 901 rather than null; the valid multiple-association case returned null encounters. The exact RED command is pending from the controller because the supplied handoff records the results but omits the command and `RED.log` path.

The relational cases execute the actual `SurgeryService::search()` SQL through native `QueryUtils` and ADODB entry points backed by an in-memory PDO SQLite database with the relevant tables. They prove the observed failure in that relational fixture, including key collisions and patient separation. They do not prove behavior on production MariaDB, the full OpenEMR schema, or an integrated runtime.

**GREEN is pending.** This implementation phase has not run PHP or tests; the controller runs them. Hosted full exact-head CI, production-like runtime integration, authenticated FHIR and ACL checks, and clinical acceptance remain unverified. This is not a full22, UI, clinical, or security exploit acceptance claim.

`SurgeryService::getAll()` contains a separate legacy encounter join and is outside this change. The remaining path is normal approval followed by hosted full exact-head CI and runtime acceptance. This note grants no standing bypass.
