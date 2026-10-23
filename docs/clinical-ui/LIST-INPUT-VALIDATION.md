# OPEMR-120 list input validation

Owner: Hermes / run1 / max2. The tests-only characterization is commit `a8d1bf9a`; the production change is confined to `src/Services/ListService.php`. The review follow-up added resource coverage in `tests/Tests/Isolated/Services/ListInputValidationTest.php`. This subsequent scoped correction addresses the hosted PHPStan and baseline-stability feedback on `41b58e3c`.

## Provenance and change

`ListRestController::post()` puts the route's `type` and `pid` into the input, calls `ListService::validate()`, then passes its result to `RestControllerHelper::validationHandler()` before `ListService::insert()`. `ListRestController::put()` also puts the route's `type` and `pid` (and list ID) into the input and follows the same validation path before `ListService::update()`. The helper returns field messages and sets HTTP 400 for an invalid result. The controller, writer, SQL and other services are unchanged.

The service now adds Particle's `string()` rule immediately before each existing `lengthBetween(2, 255)` rule for `title`, `type` and `diagnosis` only when that input is an array, resource or object without `Stringable`. Particle's string rule stops the chain on a shape error, so these supplied malformed values produce field validation messages instead of reaching `strlen()` in `LengthBetween`. Empty optional `diagnosis` arrays still pass: Particle's existing optional empty check stops the chain before the added rule. Missing and empty required values retain their existing required/empty errors.

The guards inspect a local array view, `$values = is_array($list) ? $list : []`, so offsets are safe to read even when the root is malformed. The service still passes the original `$list` to `Validator::validate($list)`. The view does not replace or coerce the input: scalar and object roots retain the Validator's `TypeError` boundary, while supplied field values retain their original types. Existing, unusual acceptance of integers, floats and `Stringable` objects remains deliberate; booleans still reach the original length check and fail when short. Existing two through 255 **byte** limits, length error identifiers, `pid` numeric rule, and begin/end date rules remain in place. This is a bounded input-shape fix. There is no demonstrated exploit and no claim that the entire feature1 flow is complete.

## Evidence and verification

The controller's local, external-loader, tests-first evidence after correcting the assertion-key mistakes is **73 tests, 6 TypeErrors, zero assertion failures**; the **67 compatibility cases passed**. The initial `RED.log` contained 21 test assertion-key bugs and was corrected honestly before production. These numbers describe the pre-fix RED characterization, not a production result. The external-loader invocation and its local dependency setup are controller-owned and are not represented as a standard installed-vendor run here.

Before this resource-test addition, the controller recorded native targeted **GREEN: 73 tests, 395 assertions**. The broader Services run exited **0** with **897 tests, 2,398 assertions, one warning, one skip and one incomplete**; it was not issue-free. The controller also recorded two PHP syntax checks and a diff check as passing. These are prior controller results, not verification of the new resource cases.

An independent Astra static review of the complete three-file diff found no production issues and one P3 test gap: the resource guard lacked direct coverage. This follow-up adds one `php://memory` resource case for each of `title`, `type` and `diagnosis`, using the native service and `ValidationResult` field-message assertions. Each handle is closed in `finally`. The controller verified both original-service RED and guarded-service GREEN; final totals appear below.

With ordinary dependencies installed in this worktree, the targeted native command is:

```sh
vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/Services/ListInputValidationTest.php
```

The broader Services command is:

```sh
vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/Services
```

Neither command was run in the resource-test follow-up. The controller owns execution and final resource-inclusive totals. Final controller local resource-inclusive verification before the hosted run: original service RED 76 tests / 9 TypeErrors / zero assertion failures; guarded service GREEN 76 tests / 416 assertions / zero issues. The initial full static review inspected Particle internals and identified the resource coverage gap; the final complete-three-file static follow-up cleared that gap, but did not independently rerun tests or recheck dependency internals.

The first exact-head hosted PHPStan run at `95cd312f` failed. Its log reported three new mixed-offset errors for `title`, `type` and `diagnosis` inside `ListService::validate()`, plus six always-true top-level `assertIsArray($messages)` calls in the isolated test. The six tautological assertions were removed because `ValidationResult::getMessages()` is statically an array; nested field-message array assertions and runtime `ValidationResult` assertions remain. Hosted `41b58e3c` subsequently reported Analyze nowPASS, but baseline stability FAIL because the added `@param array<mixed> $list` made one existing ListService Particle `argument.type` suppression and one `missingType.parameter` suppression obsolete. This correction removes that docblock and preserves the preexisting mixed method contract. It uses the local array view solely for the three field inspections and leaves the original Validator call intact. The existing shared-owned `argument.type.php` baseline and all other baselines are unchanged. The new native compatibility cases expect `TypeError` for scalar and object roots. The controller will rerun tests on the original and production service and perform fresh hosted checks; their outcomes are not yet known.

## Acceptance and remaining work

Acceptance for this slice is field errors without `TypeError` for supplied nonempty arrays, resources and non-`Stringable` objects in the three text fields, while the characterized empty, scalar, byte-length, PID and date behavior remains intact. Malformed scalar and object roots must still raise the Validator's `TypeError`. Resource-inclusive local RED/GREEN is verified above; the controller's fresh original/production verification and hosted result for this correction remain pending. This correction edits only the service, isolated test and this document.

Real authenticated endpoint checks, roles and ACL, session behavior, persistence, and clinical and security QA remain pending. Ordinary approval is required; there is no standing bypass. There has been no merge or deployment. After ownership of this candidate is resolved, the next different candidate remains controller-selected.
