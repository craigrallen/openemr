# Calculated vitals source read

Status: production source change proposed on `OPEMR-117-calculated-vitals-source-read`; unmerged and undeployed. This restores internal source-form lineage and supports the reliability of original feature 4. It does not complete that feature, a user-visible or endpoint feature, or clinical acceptance.

## Scope and behavior

`VitalsCalculatedService::search()` joins calculated records to their source `form_vitals` rows and supplies `source_vital_uuid` from `form_vitals.uuid`. The grouping method previously checked its own uninitialized `$sourceVitalUuid` instead of the current row, leaving `parent_observation_uuid` empty even for rows with a source. The single expression change checks the current row's `source_vital_uuid` before converting and appending it. Existing null and empty handling, deduplication, source order, component handling, metadata, SQL, calculation math, and writes are unchanged.

`FhirObservationVitalsService::searchCalculatedVitals()` calls `transformCalculatedRecord()`, which forwards `parent_observation_uuid` internally. The vitals service has its own `parseOpenEMRRecord()` and does not use `FhirObservationTrait`. Its current serializer does not consume `parent_observation_uuid` or emit `derivedFrom`, so this change introduces no new invalid external references through that consumer. The source identifier is `form_vitals.uuid`, whereas the FHIR vitals reader maps individual columns to Observation identities through `uuid_mapping`. Future FHIR lineage serialization must resolve each source form UUID to the appropriate per-column mapped Observation identities; connecting the trait alone would not do that. This change establishes only internal source-form lineage, not endpoint or ACL behavior, dereferenceable FHIR references, or clinical clearance.

## Evidence and verification

Tests-only commit `b72f8da2` recorded a genuine native RED before the source change: 2 tests, 63 assertions, 1 failure, 0 errors; actual `parent_observation_uuid` was `[]` where sources were expected. The controller's post-change native run of those 2 tests was GREEN: 68 assertions, zero issues. The isolated tests invoke the real grouping method with interleaved rows and check source membership, deduplication, order, components, and metadata. The further source-less fixture with null, empty, and missing source keys also passed: final focused GREEN was 3 tests, 128 assertions, zero issues. Broader Services execution returned exit 0 with 827 tests and 2,131 assertions, with 1 warning, 1 skip and 1 incomplete; it was not issue-free. These tests do not exercise a database, FHIR endpoint, authentication, or clinical workflow.

With project dependencies configured, the native focused command is:

```sh
vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/Services/CalculatedVitalsSourceReadTest.php
```

The controller's actual RED and GREEN used an external rooted loader; those executions are controller evidence. Independent final static review cleared the narrow production/test scope and the FHIR-path, isolated-command and rotation documentation corrections. Its remaining P3 request to record the final controller test results is addressed above. Authenticated, security and clinical checks, FHIR identity mapping/serialization, and ordinary approval remain open. This is run 1 of a maximum of two consecutive scheduled delivery runs on this surface/PR; implementation and QA both count.

The full-source inverse is to replace only the changed presence expression with the original `!empty($sourceVitalUuid)`. Reversing that expression restores the original service bytes; the documentation and tests are separate files.

Candidate screening: the LBF candidate was rejected because all three callers are PDF paths. The missing-name-history candidate was rejected because no in-repo consumers were found. After this budget, a different implementation should begin with fresh independent work on the independent original22 backlog or an untouched popup candidate, rather than defaulting to a same-file zero-component-value follow-up. The zero-component-value finding is outside this change.
