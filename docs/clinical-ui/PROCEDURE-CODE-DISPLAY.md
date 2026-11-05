# OPEMR-215 Procedure code display

## Lookup gap and minimal fix

`FhirProcedureOEProcedureService::parseOpenEMRRecord()` parses the primary procedure value, such as `CPT4:99213`, into code `99213` and type `CPT4`. The FHIR coding keeps the unprefixed code and obtains its system from the type. Previously, the primary description lookup received only `99213`. `CodeTypesService::lookup_code_description()` expects a typed `TYPE:CODE` value and passes it to `lookup_code_descriptions()`. The native global lookup splits the type and code before selecting the code set. Without the type, it cannot select that code set, leaving the primary coding display empty.

The production change passes the original `$dataRecord['code']` to the primary description lookup. The FHIR code, system, reason lookup, LOINC lookup and fallback, status, dates, and identity logic remain as before. The source change is exactly one operand replacement.

## Test evidence and scope

The tests were committed before the production edit at HEAD `f5a42d6b853032890506bbaa7a201c30c706d231`. The original mapper SHA-256 was `7342c9643feb67b27df71d5e3d26bff86f7d575f4de33ba9cb77d9a2bc22cb70`. The controller verified a semantic RED on that original source: 7 cases total, 4 passed, 3 failed. The failures covered CPT4 primary display, SNOMED primary display, and primary display alongside LOINC. The source byte inverse case checks that reversing the approved operand replacement restores that original SHA-256.

The contract fixture loads the actual mapper, native `CodeTypesService`, and native FHIR Procedure, CodeableConcept, and Coding models. It supplies an empty synthetic `FhirServiceBase` parent and creates the mapper without its constructor to avoid application bootstrap. Its synthetic global `lookup_code_descriptions()` seam accepts typed values and returns deterministic descriptions; it does not call the native global lookup or SQL. Synthetic rows cover CPT4, SNOMED, a reason code, LOINC, absent descriptions, code fallback, and status, date, and identity behavior. Each row is checked through both object and encoded output, including native model types and equivalent JSON. The JavaScript wrapper invokes the PHP fixture and checks the seven-case report shape and source hash.

After the minimal fix, the controller executed the exact fixture: 7 cases passed, 0 failed. PHP syntax checks for the mapper and fixture, Node syntax for the adapter, and `git diff --check` passed. This factual evidence update is a documentation-only exception to test-first production changes. It is not independent runtime verification, UI or all-22 coverage, Swedish completion, clinical acceptance, or evidence for application bootstrap, authenticated FHIR, persistence, roles, or security. Ordinary approval and full hosted CI remain pending.
