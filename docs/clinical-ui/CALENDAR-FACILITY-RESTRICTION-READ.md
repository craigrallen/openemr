# Calendar facility restriction read

`CalendarFacilityQuery::getUserFacilities()` checks the applicable facility restriction flag before fetching facilities. Calendar calls use `restrict_user_facility`; inventory calls use `gbl_fac_warehouse_restrictions`. When restriction is enabled, the service queries the user's `users_facility` entry count. A missing row, missing `count` key, or null `count` now raises `UnexpectedValueException` with `Unable to determine facility restriction count` before any facility fetch.

The existing zero-count policy is unchanged: a present count that is false in PHP, including `0`, `'0'`, `false`, and `''`, selects the unrestricted facility query. A truthy count selects the existing restricted query. SQL, binds, sorting, and returned row order are unchanged. This change does not add numeric validation.

`QueryUtils::querySingleRow()` already throws on SQL execution errors, and a successful `COUNT(*)` aggregate normally returns one row. This is defensive handling of a missing count result, not proof of an exploitable authorization bypass. In `interface/main/calendar/index.php`, the caller indexes the first returned facility; an exception stops that flow, unlike an empty list. `interface/main/calendar/add_edit_event.php` still lists facilities independently. This change is not endpoint authorization enforcement and does not complete the original 14–16 or UI scope.

The controller ran RED on the tests-only tree subsequently committed as `8fd8c359`: 16 tests, 43 assertions, and four failures for false, empty, missing-key, and null count results. After the guard, controller GREEN passed 16 tests / 51 assertions, and the existing calendar facility suite passed 35 / 78. Broader Services completed 840 / 2054 with one warning, one skipped and one incomplete test (not an issue-free full suite). The external loader uses target application source and sibling vendor dependencies. Reproduce the focused check with:

```sh
python3 /Users/craig/.hermes/projects/openemr/verification/calendar-facility-read-20261023/run-native.py GREEN
```

Authenticated roles, session behavior, ACL and clinical security QA, and ordinary approval remain pending. This is delivery run 1 of at most two consecutive runs including QA; the next run needs a different lane preflight, not unchanged polling. Deployment, merge, and live clinical or database actions are outside this delivery.
