# OPEMR-200: FHIR Condition codings, source-only phase

## Defect and change

`FhirConditionTrait::populateCode()` previously created one `FHIRCoding` before iterating over the diagnosis array. Each iteration changed that same object, so a Condition with multiple diagnosis entries could emit repeated copies of the last coding. The object is now created inside the existing loop. Each input entry keeps its own code, display, system, and order; numeric array keys are still converted to strings. The title fallback and all other mapping logic are unchanged.

## Connected PUT response path

On a successful update, `FhirServiceBase::update()` (lines 191–208) calls `FhirConditionService::updateOpenEMRRecord()` (line 290), which calls `ConditionService::update()` (line 253). After the SQL update succeeds, that method calls `ConditionService::getOne()` (line 315). `getOne()` calls `search()`, whose rows pass through `createResultRecordFromDatabaseResult()` and `BaseService::addCoding()`. `addCoding()` splits semicolon-separated diagnosis codes into the diagnosis array. The inherited `FhirServiceBase::update()` then passes the returned row to `FhirConditionService::parseOpenEMRRecord()` (lines 75–77), which delegates to `FhirConditionProblemListItemService::parseOpenEMRRecord()`; its line 234 invokes the native trait's `populateCode()`.

This is source proof for the successful PUT response mapping, not an authenticated FHIR request or proof that the write persisted. FHIR Condition search subservices use raw SQL rows, so this source path does not establish that their GET responses use `ConditionService::addCoding()` or that their GET behavior is fixed.

## Evidence and verification

Before the product edit, the controller ran the unchanged native contract fixture at HEAD `470b197bd3c7359e06446bcee8a39650abff7e64`. The recorded semantic RED result was 17 expected, 10 passed, and 7 failed, with `loader_failed: false` (`/Users/craig/.hermes/projects/openemr/verification/condition-codings-20261101/controller-red.log`). The fixture directly exercises the production trait with native FHIR R4 model objects; it does not copy the mapping method.

Source-only verification commands for this phase:

```sh
php tests/clinical-ui/fhir-condition-codings-contract.php.fixture
php -l tests/clinical-ui/fhir-condition-codings-contract.php.fixture
php -l src/Services/FHIR/Condition/Trait/FhirConditionTrait.php
node --check tests/js/fhir-condition-codings.test.js
git diff --check
```

The controller captures the command results. This phase does not run the writer, database, authenticated FHIR requests, PHPUnit, or Jest. Actual FHIR behavior, persistence, security, clinical review, and ordinary approval remain pending. This source-only phase does not complete the original 22-item scope.
