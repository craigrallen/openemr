# OPEMR-206 recipient chooser contract

This minimal implementation removes the patient branch's count-zero user 1 fallback from the native `getAuthPortalUsers()` function in `portal/messaging/messages.php`. The eligible staff query and dashboard branch remain intact. The standalone PHP contract extracts the complete function by token boundaries and evaluates only that function. It does not execute the route preamble or start OpenEMR, a database, or a browser. Synthetic `sqlStatement`, `sqlFetchArray`, and `sqlQuery` stubs record queries and supply rows. Patient and dashboard branches run in separate PHP processes because `IS_DASHBOARD` is a constant.

The patient contract requires an empty recipient list when user 1 exists but is ineligible, and when no users exist. It also requires no user 1 fallback lookup, the active portal staff predicate, and intact eligible row order and shape. The dashboard contract preserves the eligible staff plus patient list and the existing user 1 fallback when staff are absent.

## Tests-only baseline, before product change

| Command | Result |
| --- | --- |
| `php -l tests/clinical-ui/portal-patient-recipient-chooser-contract.php.fixture` | Pass |
| `node --check tests/js/portal-patient-recipient-chooser.test.js` | Pass |
| `php tests/clinical-ui/portal-patient-recipient-chooser-contract.php.fixture patient` | Exit 1; 5 passed, 4 failed of 9 assertions |
| `php tests/clinical-ui/portal-patient-recipient-chooser-contract.php.fixture dashboard` | Exit 0; 8 passed, 0 failed of 8 assertions |

The four patient failures are the intended RED: the ineligible user 1 appears in the list and triggers a fallback lookup; the no-users case returns `[false]` and also triggers a fallback lookup. The hosted Jest adapter treats either a nonzero fixture exit or malformed report as failure. Jest was not run locally.

## Minimal implementation GREEN

| Command | Result |
| --- | --- |
| `php tests/clinical-ui/portal-patient-recipient-chooser-contract.php.fixture patient` | Exit 0; 9 passed, 0 failed of 9 assertions |
| `php tests/clinical-ui/portal-patient-recipient-chooser-contract.php.fixture dashboard` | Exit 0; 8 passed, 0 failed of 8 assertions |
| `php -l portal/messaging/messages.php` | Pass |
| `php -l tests/clinical-ui/portal-patient-recipient-chooser-contract.php.fixture` | Pass |
| `node --check tests/js/portal-patient-recipient-chooser.test.js` | Pass |
| `git diff --check` | Pass |

These results cover native PHP control flow and the queries issued to synthetic stubs. Remaining gates are an authenticated empty-picker check in the native route, security and authorization review, persistence and SQL behavior, browser behavior, and clinical acceptance. The server resolver is unchanged and owned separately. No frontend or runtime acceptance is claimed; Jest was not run locally.
