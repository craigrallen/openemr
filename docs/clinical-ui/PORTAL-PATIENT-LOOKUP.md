# OPEMR-109 portal patient lookup acceptance

## Scope and rationale

`src/Services/PatientPortalService.php` now returns `['valid' => false]` when the patient query returns `false` or `[]`, before reading a patient PID or querying `patient_access_onsite`. This avoids a dependent portal lookup and the false-offset or missing-PID warnings for an absent patient. The existing empty-PID short circuit and the valid-patient path, including username and integer PID equality, remain as they were. Missing portal rows already evaluate to invalid through the existing short circuit, so they need no additional guard.

The same file makes `getRequest`'s existing string-or-null parameter explicit as `?string $param = null`. This addresses the PHP 8.5 implicit-nullable deprecation observed while loading the service, without changing its accepted values or request behavior. The other files are `tests/Tests/Isolated/Services/PortalPatientLookupTest.php` and this acceptance note. No caller, session, ACL, CSRF, token, or provisioning code was changed.

## Evidence and limits

The pre-implementation native RED run used the actual `PatientPortalService` source and real `sqlQuery` through synthetic ADO connection and recordset mocks, with no database or other live I/O. It reported **18 tests, 150 assertions, 3 failures**: all three absent-patient variants attempted the forbidden second portal SELECT. It also reported two warning types (array offset on `false`; missing `pid` key) and one PHP 8.5 implicit-nullable deprecation from `getRequest`. Strict diagnostics were retained. The controller's native GREEN run passed **18 tests, 156 assertions**, without warnings or deprecations. PHP syntax checks on the service and test plus `git diff --check` passed. Original features 10/11 gain supporting safety evidence only, not completion.

Source inspection shows `TeleconferenceRoomController::validatePatientIsTelehealthReadyAction` requires an API CSRF token and `patients/appt` ACL, then returns HTTP 400 for an invalid portal patient. `OneTimeAuth::createPortalOneTime` throws for an invalid patient before token creation. These callers were inspected, **not executed**. Clinical and live role, portal, session, account, SQL database, and security acceptance remain open. This slice makes no full feature, UI, clinical acceptance, merge, or deployment claim.

This is scheduled run 1 of at most 2 consecutive runs for this slice. The next scheduled run should address a different slice by default, rather than poll unchanged evidence.
