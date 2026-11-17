# Encounter diagnosis note contract

This tests only change targets OPEMR-267 at the controller supplied repository and HEAD `09b29da7771aea334ed5745e058751157af980d7`. The controller validates that binding, materializes these files, applies the separate product correction, and runs the real hosted Jest test. This document is not an independent Git attestation.

The proposed product correction changes one complete guard in the native `FhirConditionEncounterDiagnosisService::populateNote` method to:

```php
if (!empty($dataRecord['comments']) || ($dataRecord['comments'] ?? null) === '0') {
```

The source inverse case requires exactly one copy of that guard. Replacing it with the original guard must restore SHA256 `282ac4215d2b9ae5fa0c29fe038dbaa3e97efc5288e66ffbb8878cb033286f24` for the complete original source. This rejects the unchanged baseline and unrelated source edits. The original raw `setText($dataRecord['comments'])` call remains in place.

The PHP fixture loads the actual root relative OpenEMR service, traits, interfaces, and R4 models. It declares only an empty `FhirServiceBase` parent, bypasses the service constructor, and invokes the service's private `populateNote` using reflection. It checks the native getter and decoded JSON independently, including strict string `"0"`, retained legacy integer `42`, omitted empty values, input immutability, and preexisting annotation identity and order. It does not require a Markdown wrapper around the existing raw getter value.

The fixture emits one JSON report line and exits 0 only when every case passes. Semantic failures exit 1; native loading failures exit 2. Jest requires the exact case set, sorted report and case keys, all successful results, empty stderr, and exactly one trailing line feed. RED and GREEN results remain pending controller execution.

This contract covers the complete native class's private note method only. It does not establish behavior for the complete record parser, SQL, authenticated FHIR requests, persistence, or clinical and security acceptance.
