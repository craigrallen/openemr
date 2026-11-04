# OPEMR-206 recipient chooser contract

This tests-only phase adds a standalone PHP contract for the complete native `getAuthPortalUsers()` function in `portal/messaging/messages.php`. The fixture extracts the function by token boundaries and evaluates only that function. It does not execute the route preamble or start OpenEMR, a database, or a browser. Synthetic `sqlStatement`, `sqlFetchArray`, and `sqlQuery` stubs record queries and supply rows. Patient and dashboard branches run in separate PHP processes because `IS_DASHBOARD` is a constant.

The patient contract requires an empty recipient list when user 1 exists but is ineligible, and when no users exist. It also requires no user 1 fallback lookup, the active portal staff predicate, and intact eligible row order and shape. The dashboard contract preserves the eligible staff plus patient list and the existing user 1 fallback when staff are absent.

## Tests-only baseline, before product change

| Command | Result |
| --- | --- |
| `php -l tests/clinical-ui/portal-patient-recipient-chooser-contract.php.fixture` | Pass |
| `node --check tests/js/portal-patient-recipient-chooser.test.js` | Pass |
| `php tests/clinical-ui/portal-patient-recipient-chooser-contract.php.fixture patient` | Exit 1; 5 passed, 4 failed of 9 assertions |
| `php tests/clinical-ui/portal-patient-recipient-chooser-contract.php.fixture dashboard` | Exit 0; 8 passed, 0 failed of 8 assertions |

The four patient failures are the intended RED: the ineligible user 1 appears in the list and triggers a fallback lookup; the no-users case returns `[false]` and also triggers a fallback lookup. The hosted Jest adapter treats either a nonzero fixture exit or malformed report as failure. Jest was not run locally.

These results cover native PHP control flow and the queries issued to synthetic stubs. They do not establish database or SQL engine behavior, browser rendering, authorization, persistence, or clinic acceptance.
