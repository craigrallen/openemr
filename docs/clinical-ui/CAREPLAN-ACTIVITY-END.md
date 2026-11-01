# OPEMR-203: CarePlan activity end dates

The native `CarePlanService::search()` query already selects `fcp.date_end`. Before this change, `createResultRecordFromDatabaseResult()` moved each row's `date` into its activity detail but left `date_end` on the record. Search aggregates later rows by appending only their details, so their end dates were lost and the first row's end remained at plan level.

`date_end` now follows `date` into each row's detail. The existing `FhirCarePlanService::parseOpenEMRRecord()` uses each detail's end for `activity.detail.scheduledPeriod.end` and the latest detail end for the CarePlan period. This change does not alter FHIR parsing, date conversion, third-party metadata, status, proposed-date behavior, or the existing independent `scheduledPeriod` plus `scheduledString` issue.

## Verification and boundaries

The committed, read-only fixture `tests/clinical-ui/fixtures/careplan-activity-end.php.fixture` invokes the actual native CarePlan mapper and complete native FHIR service, models, and helpers using reflection and constructor bypass. Its `mapRows()` function composes native mapped rows to match the search loop's detail append; it does not execute SQL or the native search loop. The fixture uses an explicitly synthetic identity `BaseService` because the real parent loads `code_types.inc.php` and site SQL configuration, a declaration-only `FhirServiceBase`, and a synthetic global `text()` helper. Native parent UUID conversion and narrative escaping are therefore outside its coverage.

The 20 cases cover single and multiple activities, distinct and reversed end dates, end-only, start-only, and null-end inputs, plus direct FHIR object and encoded output. UTC fixtures give fixed expectations, not a daylight-saving or timezone policy. Passing these cases supports the original patient-record interoperability path for the mapped end dates; it does not establish complete original 22-feature, UI, Swedish, or full FHIR readiness. SQL/search execution, real aggregation, authentication, roles, security, persistence, clinical QA, and ordinary approval remain open. This work does not authorize merge or deployment.
