# Treatment intervention preference value contract

Status: pending controller RED run, GREEN run, review, and CI.

This proposed tests-only contract targets `FhirObservationTreatmentInterventionPreferenceService` and LOINC `75773-2`. It checks that text `0` survives the native `FHIRObservation` getter, JSON serialization, and the service's `transformRow` path. It also covers ordinary and whitespace-preserving text, omitted missing/null/empty text, and existing boolean and coded values.

The PHP fixture loads the actual service, FHIR models, mapper, and traits. It declares only a minimal base class and bypasses the service constructor to avoid application bootstrap. It does not use SQL or HTTP. Its source guard accepts the supplied original SHA-256 or a source differing by exactly the intended text guard substitution; the original source should pass that guard while the three zero-value cases fail.

The Jest adapter checks the fixture's single-line JSON report, case accounting, and exit status. The controller owns repository binding validation, Git operations, execution, and the real RED run before any production change. No runtime result, encoded-true compatibility, or clinical persistence is claimed here.
