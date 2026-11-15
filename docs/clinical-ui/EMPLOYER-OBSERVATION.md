# Employer observation result contract

`FhirObservationEmployerService::searchForOpenEMRRecords()` must return the backend `ProcessingResult` itself when that result has validation or internal errors. The intended production change is exactly three lines immediately after `$result = $service->search($openEMRSearchParameters);`:

```php
            if ($result->hasErrors()) {
                return $result;
            }
```

The source preservation case accepts the supplied original source SHA-256 (`8744a447447c22499029c2ed7bba9b14b3730aa09a591f1aeb122f6aefc86c08`) or a source whose single exact insertion reverses to that hash. It reads the whole source; it does not rewrite it. The controller supplies and validates the repository and HEAD binding separately.

The CLI fixture loads native OpenEMR classes from `src` through PSR-4. It uses the native employer mapper, observation traits, search fields, interfaces, `ProcessingResult`, and `QueryPagination`. A declaration-only synthetic `FhirServiceBase` and `BaseService` avoid application bootstrap. A recording subclass of the native `EmployerService` replaces its constructor and `search()` so no SQL or other backend I/O occurs. Reflection bypasses the mapper constructor and invokes its protected search method. A native `ProcessingResult` subclass counts `getData()` calls in the combined-error case.

The error cases require backend result identity and exact validation or internal errors. The combined-error case also requires unchanged partial data and pagination, with zero `getData()` calls, so malformed rows are never transformed. Invalid category and code cases remain pre-backend validation with zero search calls. Success cases require one backend call, a fresh successful result, exact native occupation observation data, unchanged unsupported-code row skipping, forwarded patient, `_id`, and date object identity, and the native occupation/industry `missing(false)` OR filter. Nominal success pagination propagation is outside this contract.

This is an internal service contract. Returning partial backend data unchanged on error does not prove HTTP row exposure or clinical persistence. The fixture has no app bootstrap, vendor dependency, SQL, HTTP, installation, or runtime hash attestation. The Jest adapter checks the single-line JSON report and named cases; its execution is reserved for hosted CI, not local Jest or emulation. The original source is expected to fail the backend-error cases while passing source preservation and existing-behavior cases. No production-row change beyond the early error return is proposed.
