# Encounter diagnosis note contract

This change targets OPEMR-267 from original source HEAD `09b29da7771aea334ed5745e058751157af980d7`. The controller validates each CLI handoff binding, materializes the supplied files and executes the native contract. Independent static review and real hosted Jest remain separate gates. This document is not an independent Git attestation.

The product correction changes one complete guard in the native `FhirConditionEncounterDiagnosisService::populateNote` method to:

```php
if (!empty($dataRecord['comments']) || (is_array($dataRecord) && ($dataRecord['comments'] ?? null) === '0')) {
```

The source inverse case requires exactly one copy of that guard. Replacing it with the original guard must restore SHA256 `282ac4215d2b9ae5fa0c29fe038dbaa3e97efc5288e66ffbb8878cb033286f24` for the complete original source. This rejects the unchanged baseline and unrelated source edits. The original raw `setText($dataRecord['comments'])` call remains in place.

The PHP fixture loads the actual root relative OpenEMR service, traits, interfaces, and R4 models. It declares only an empty `FhirServiceBase` parent, bypasses the service constructor, and invokes the service's private `populateNote` using reflection. It checks the native getter and decoded JSON independently, including strict string `"0"`, retained legacy integer `42`, omitted empty values, input immutability, and preexisting annotation identity and order. It does not require a Markdown wrapper around the existing raw getter value.

The fixture emits one JSON report line and exits 0 only when every case passes. Semantic failures exit 1; native loading failures exit 2. Jest requires the exact case set, ordered report and case keys, all successful results, empty stderr, and exactly one trailing line feed. No local Jest execution or emulation is authorized.

Tests-only commit `89173573` produced genuine native RED: 15 passed and 3 failed, with empty stderr. The string-zero and existing-note append cases failed on missing annotations; the source-inverse case rejected the original guard. After the separate CLI product proposal, the controller observed 18 passed and 0 failed with empty stderr. PHP source/fixture syntax, JavaScript syntax and diff checks passed. Initial fixture loading and redundant global-import warnings were retained as harness failures, not semantic RED; controller test-only fixes corrected the native autoloader prefix, removed redundant imports and added the CLI guard before the genuine RED. Production was still unchanged at that point.

The connected source path is native `add_edit_issue.php` forwarding `form_comments` when set, `PatientIssuesService` filtering columns and passing bound insert/update values, and this service's inner and outer `l.comments` projections. This source trace is not executed SQL or authenticated persistence evidence. Other Condition services and the shared trait remain unchanged and independently owned. Scheduled allocation is 1/max2 consecutive runs including implementation and QA. Ordinary approval and complete exact-head hosted gates remain required; no merge or deployment is implied.

The initial hosted PHPStan Analyze run `44071121704` failed because the newly added offset was on mixed input: the historical diagnostic count grew from one to two. This was a real static failure missed by the initial static review, not a baseline-stability pass. Tests-only `d71628c8` tightened the approved source inverse; controller RED was 17 passed and one source failure before a separate CLI correction added `is_array` only to the new right operand. Final native GREEN remains 18/18 with empty stderr. The original first branch, setter, parameter type and shared baseline remain unchanged. Fresh complete review and final-head hosted Analyze/baseline stability are required for the correction.

This contract covers the complete native class's private note method only. It does not establish behavior for the complete record parser, SQL, authenticated FHIR requests, persistence, or clinical and security acceptance.
