# Transaction create validation write boundary (OPEMR-121)

## Scope and rationale

The standard API route is `POST /api/patient/:pid/transaction` in
`apis/routes/_rest_routes_standard.inc.php`. It checks the `patients` / `trans`
ACL, reads the JSON request body, and calls
`TransactionRestController::CreateTransaction`. The controller previously put
service validation messages into a `ProcessingResult` but then called
`PatientTransactionService::insert` anyway. An invalid referral could therefore
reach the persistence path.

This slice adds one early return immediately after setting validation messages
in `CreateTransaction`. It uses the existing
`RestControllerHelper::handleProcessingResult($processingResult, 201, true)`
contract: validation messages produce a 400 response with `validationErrors`
and empty `internalErrors`, `data`, and `links`. Valid requests still call
`insert` with the original payload and use the existing 201 multiple-result
response, including its data array and pagination links.

The only owned files in this slice are the controller, its new isolated
`TransactionValidationWriteBoundaryTest.php`, and this note. Service,
helper, routes, authorization, read, and update behavior are outside scope.

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
wrong-type and UTF-8 byte-boundary cases. The controller will recheck corrected
RED against the original controller source before final verification; no
corrected RED or GREEN result is claimed here.

## Limits and delivery gates

The isolated test replaces the controller's private service on an instance
created without its constructor and disables the service constructor on its
mock. This is a persistence seam, not an authenticated route, database, or
clinical acceptance test. The real service validator may throw for a missing
`type` or malformed types; unknown nonempty types retain the legacy accepted
path. The handling of `insert` returning `false` or throwing is unchanged.

This note and slice do not close the full 22-item clinical UI register or
claim an implemented UI feature. Native GREEN results, strict PHPStan and
other required checks must be verified on the edited head. Ordinary approval,
independent review, exact-head hosted CI, and applicable authenticated and
clinical acceptance remain delivery gates before merge or deployment.
