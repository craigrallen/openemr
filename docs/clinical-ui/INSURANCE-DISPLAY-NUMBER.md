# Insurance display numbers

OPEMR-266 covers option `7` of `InsuranceCompanyService::getDisplayNameForInsuranceRecord()`. For an empty or digitless `line1`, the original `preg_match('/\d+/', ...)` returns zero and `$matches[0]` emits an undefined-key diagnostic. The sole production change is `($matches[0] ?? '')`. Existing visible labels, including `Synthetic insurer (12345,)`, the first ASCII numeric token, leading zeros and literal zero, remain unchanged. Other display modes and every other production byte are preserved.

## Executed evidence

- Tests-only commit `eccde4d7` preceded the product edit. Direct native fixture RED: 21 cases, 15 passed and 6 failed. Five failures were native undefined-key diagnostics; the sixth required the not-yet-applied exact source inverse.
- After the minimal CLI-authored fix, the same fixture passed all 21 cases with exit zero and empty stderr. PHP source/fixture syntax, JavaScript syntax and `git diff --check` passed.
- The initial hosted PHPStan run `44053886103` passed analysis but failed baseline stability: the fix resolves one historical missing-offset diagnostic. All 170 official regenerated baseline files were compared; only the obsolete five-line InsuranceCompanyService suppression in `.phpstan/baseline/offsetAccess.notFound.php` is removed. Fresh exact-path PR and sibling ownership clearance preceded this fifth-file scope extension. This suppression reduction is a reviewed nonproduction CI-repair exception, not a new suppression or weakened gate. Fresh independent five-file review and exact-head hosted gates are required after that change.
- Wrapped Codex Sol authored the tests and the subsequent minimal production replacement in separate phases; the controller materialized the exact proposed artifacts and executed tests. Claude was unauthenticated. Independent frozen-content review and actual hosted Jest/static/coverage gates are separate evidence, not implied by the local result.

## Test scope and limits

The CLI-only fixture loads the complete native class from its checkout-relative filename, confirms reflection provenance, and calls the native static method without constructing the service. `BaseService` is a declaration-only parent and `OEGlobalsBag` is a synthetic configuration singleton. Strict E_ALL diagnostics become exceptions. Exact labels and unchanged complete input rows are checked across options 0–7/default, digitless/empty/null/non-ASCII numeric input, leading zeros, multiple tokens and zero. The original SHA-256 inverse requires one complete approved corrected fragment and rejects unrelated production edits.

The real Jest adapter requires a bounded successful PHP subprocess, one JSON line, empty stderr, exact report/case keys, the complete unique expected case-name set, positive passing count and zero failures. It has not been run locally or emulated; hosted execution remains necessary.

Connected native callers include `getInsuranceProvidersExtra()` used by `insurance_edit.php`, and `InsuranceCompany::get_display_name()`. These callers, configuration storage, SQL, authentication, UI rendering, persistence, security and clinical workflows were not executed. The separate legacy `getInsuranceProviders()` numeric-match access remains out of scope. This is bounded patient-record support, not completion of the original 22 features, researched UI, exhaustive popup coverage, demo coverage or Swedish readiness.

Allocation: 1/max2 consecutive scheduled delivery runs INCLUDING implementation and QA; internal author/test/review phases are not extra scheduled allocations. Ordinary approval and native acceptance remain required. No master write, merge/bypass, deployment, database/patient action, national integration, vendor contact or cron change. Historical denied actions and root checkpoint restrictions remain parked.
