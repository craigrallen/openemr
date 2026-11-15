# OPEMR-247: SDOH observation search errors

Owner: Hermes. Scheduled allocation: 1 of at most 2 consecutive delivery runs, including implementation AND QA; internal test/implementation/review phases are not additional scheduled runs. This rotation is independent of OPEMR-246 / PR303; the default next implementation is DIFFERENT, not unchanged QA polling.

## Scope and evidence

The controller's local repository is `/Users/craig/.hermes/workspaces/openemr-sdoh-observation-errors`; `09b29da7771aea334ed5745e058751157af980d7` is the historical tests-only baseline, not the final review HEAD. The fixture resolves its repository root relatively for hosted portability and authenticates the inherited native method's actual source path. The exact final review HEAD and four artifact hashes are recorded in the controller's external `frozen-review.json`; the inline reviewer does not independently attest HEAD, hashes or runtime behavior. The fixture checks the native observation service source against supplied original SHA256 `580b9e2f995f8cbc31c843a46c6e569f0d6f00e36b6618f2e1c0e5d0f1535117`. It accepts the original bytes or exactly one three-line error-return insertion after the backend search, then removes that insertion and checks the whole original SHA256. Every other production byte must remain intact.

The four paths in this work are:

- `src/Services/FHIR/Observation/FhirObservationHistorySdohService.php` (controller-owned implementation target)
- `tests/clinical-ui/sdoh-observation-errors.php.fixture`
- `tests/js/sdoh-observation-errors.test.js`
- `docs/clinical-ui/SDOH-OBSERVATION-ERRORS.md`

A genuine semantic RED is required before the controller changes production. The native search and filter method runs with real `ProcessingResult`, `QueryPagination`, search fields, traits, interface, and declaration-loaded `HistorySdohService`. A recording `HistorySdohService` subclass supplies synthetic backend results. A native observation-service subclass bypasses its constructor and records calls at the protected observation parsing seam. Declaration-only parent classes avoid application bootstrap. The suite covers error identity, messages, partial data, pagination, zero error-data reads and parsing, empty and row success, native code selection, filter forwarding, and local validation or empty returns. It does not change category support or nominal success pagination.

Static inspection of `HistorySdohService::search` shows that its `SqlQueryException` catch adds an internal error to a `ProcessingResult`. The fixture does not execute SQL. It does not establish clinical, authenticated FHIR, security, persistence, or native observation serialization acceptance. Ordinary approval, draft review, and full hosted gates remain required.

No local Jest, PHPUnit, PHPStan, installs, bootstrap, SQL, HTTP, merge, deploy, master, database, cron, or denied-action retry is part of this handoff. Root checkpoint writes and the OPEMR-168 UI preparation denial remain parked.
