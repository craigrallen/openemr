# OPEMR-226 Media search error routing

`FhirMediaRestController::getAll()` should pass a `ProcessingResult` with validation or internal errors to `RestControllerHelper::handleFhirProcessingResult($processingResult, 200)` before reading result data or building a search bundle. Successful searches retain the existing bundle path.

The PHP fixture loads the native controller, `ProcessingResult`, and `QueryPagination` directly. It calls the native `getAll()` method with a synthetic service result and synthetic helper, response, global, and bundle boundaries. It checks validation errors, internal errors while `isValid()` is true, combined errors, empty and poison data, unchanged service arguments, success bundle entries, and an exact whole-source inverse hash that protects `getOne()` and the rest of the controller. The JavaScript adapter checks the fixture's single-line JSON report and exit result.

This is controller routing evidence. The fixture does not exercise actual HTTP handling, helper serialization or status codes, authentication, security, SQL, persistence, or clinical acceptance. Native auth, HTTP, SQL, security, and clinical QA, ordinary review, and exact-head hosted gates remain scheduled. No RED or GREEN run is asserted here. This change does not authorize merge, deployment, database changes, master, cron, or Swedish publication.
