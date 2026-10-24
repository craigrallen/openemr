# Transaction create validation write boundary (OPEMR-121)

## Scope and rationale

The standard API route is `POST /api/patient/:pid/transaction` in
`apis/routes/_rest_routes_standard.inc.php`. It checks the `patients` / `trans`
ACL, reads the JSON request body, and calls
`TransactionRestController::CreateTransaction`. The controller previously put
service validation messages into a `ProcessingResult` but then called
`PatientTransactionService::insert` anyway. An invalid referral could therefore
reach the persistence path.

This slice guards `insert` in `CreateTransaction`: validation errors set
messages, while only valid requests call `insert` and add its result. Both
branches use the single existing final
`RestControllerHelper::handleProcessingResult($processingResult, 201, true)`
contract: validation messages produce a 400 response with `validationErrors`
and empty `internalErrors`, `data`, and `links`. Valid requests still call
`insert` with the original payload and use the existing 201 multiple-result
response, including its data array and pagination links.

The five owned files in this slice are the controller, its isolated
`TransactionValidationWriteBoundaryTest.php`, this note, and
`.phpstan/baseline/class.notFound.php` and `.phpstan/baseline/return.type.php`.
The baseline changes each remove one obsolete five-line
`TransactionRestController::CreateTransaction` suppression after its return
annotation was corrected to `array<array<mixed>>`. Service, helper, routes,
authorization, read, and update behavior are outside scope.

## Actual RED evidence

The controller ran the native isolated PHPUnit target at tests-only commit
`ae1457d1` before the controller change. The run had **14 tests, 46
assertions, 10 failures, and no errors**. All 10 invalid-referral cases failed
because `PatientTransactionService::insert('patient-123', [...])` was called
despite a `never()` expectation, at the then-current
`TransactionRestController.php:120`. The four valid cases passed. Evidence:
`/Users/craig/.hermes/projects/openemr/verification/transaction-validation-write-20261024/RED.log`
and `RED.xml` in the same directory. This was a genuine write-boundary RED,
not a test setup failure.

That initial RED stopped at the `never()` insert expectation in each invalid
case. It therefore did not exercise the later response-envelope or Particle
rule-key assertions. A subsequent controller GREEN attempt reported **14 tests,
164 assertions, 10 failures**: the expected rule keys in those tests were
guessed short names rather than Particle's native identifiers. This was a test
expectation error; the insert-forbidden RED remains established. The corrected
tests expect the native missing, empty, date, length, and string-type rule
keys. They retain the no-insert and full response-envelope assertions and add
wrong-type and UTF-8 byte-boundary cases. Against the original controller
source, corrected RED reported **18 tests, 94 assertions, 13 forbidden-insert
failures, and zero errors**. An earlier GREEN reported **18 tests, 233
assertions, and zero issues**; its 13 redundant array assertions were later
removed. The final native isolated replay against the current typed controller
and test reported **18 tests, 220 assertions, and zero issues**. The controller
uses a guard `else` so `insert` runs only after validation succeeds, followed
by the single existing shared response call. Its return annotation describes
the response envelope. A historical broader RestControllers run reported
**248 tests, 1,073 assertions, exit 0, and nine incomplete tests**; it preceded
the later controller and test revisions. The final broader suite has not been
rerun under the current read-only execution constraint.

The test narrows PHP's reported status to an integer or `false` and restores
the prior numeric HTTP status after each case. When PHP
initially reports `false` (no response code set), PHP offers no API to unset
the code after the controller changes it. Teardown therefore sets a neutral
200 in that case; it cannot restore the exact initial `false` state.

## Limits and delivery gates

The isolated test replaces the controller's private service on an instance
created without its constructor and disables the service constructor on its
mock. This is a persistence seam, not an authenticated route, database, or
clinical acceptance test. The real service validator may throw for a missing
`type` or malformed types; unknown nonempty types retain the legacy accepted
path. The handling of `insert` returning `false` or throwing is unchanged.

This note and slice do not close the full 22-item clinical UI register or
claim an implemented UI feature. A previous independent Astra static review of
`80362db8` found no production correctness defect and identified two P3
followups: stale verification text here and the unset HTTP-status teardown
case. A subsequent hosted PHPStan run on `80f356c3` found an extra deprecated
helper call and return, the prose `@return a` type, and the test's unnarrowed
HTTP status. Those source findings were corrected. Hosted strict PHPStan
analysis on `a62463e2` passed, but its baseline stability step failed because
the two now-obsolete suppressions remained. The two baseline files here match
the regenerated artifacts byte for byte; the final whole CI run is pending.
No authenticated route, HTTP/database, or clinical acceptance result is claimed
for this working tree. Ordinary approval and applicable delivery gates remain
before merge or deployment.
