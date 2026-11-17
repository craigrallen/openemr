# OPEMR-263 patient-derived observation code-system search

Owner Hermes; independent rotation from OPEMR-262/PR319. Allocation **1/max2 consecutive scheduled delivery runs, including implementation and QA**. This supports patient-record interoperability; it does not complete an original22 feature, researched UI, demo coverage or Swedish readiness.

## Native correction

`FhirObservationPatientService::searchForOpenEMRRecords` now skips explicit nonempty systems other than `FhirCodeSystemConstants::LOINC` before accumulating observation codes. If a nonempty token list has no eligible alternatives, it returns the existing successful empty `ProcessingResult` before patient lookup rather than falling back to every mapped observation.

Bare, null-system and explicit empty-system tokens retain historical eligibility. This is not a claim of empty-system FHIR conformance. Mixed alternatives keep eligible codes in either order. Empty-token and absent-code fallback, unsupported codes with an accepted system, category/type validation, non-code fields and input identity remain unchanged. Shared aggregator, patient producer, trait, baseline and dependencies are not edited.

The native map declares `LOINC:76690-7`; `MappedServiceCodeTrait` selects children by code without testing the system. The original child also discarded the system, so a different-system request with that code reached patient lookup. Those routing facts are static source evidence, not an authenticated API or SQL test.

Seven production lines form two additions. The fixture removes exactly one occurrence of each addition and hashes all remaining production bytes against original SHA256 `d61148c3694820e0d12caea799a7d79da9a2cad140efbce662f73a93d2adf534`. This inverse preserves unrelated bytes but does not independently prove insertion placement; behavioral cases test the native search path separately.

## Tests and boundaries

Tests-only commit `4c172118` precedes production. Controller execution against original source reports 22 cases: 15 pass, seven fail (six semantic failures and one source inverse), with empty stderr. Candidate execution reports 22/22 passing, empty stderr. Two mixed alternatives with an ineligible supported code and eligible unknown code separately detect leakage into the mapped-column filter. Controller-added cases and CLI-only guard were tests-only improvements before the captured RED. No product TDD exception.

The CLI fixture loads the complete native concrete service/observation trait, interfaces, token/composite search classes, constants and native result classes through root-relative paths. It supplies declaration-only `FhirServiceBase` and PSR logging trait plus a synthetic recording `PatientService` that always returns empty rows. The probe calls the actual protected native search. No native patient constructor, parent bootstrap, SQL, patient rows, UUID mapping, list lookup, FHIR output serialization or HTTP is exercised. Backend-call/filter/input tests are not proof of patient output or clinical persistence. No fabricated backend error regression is claimed.

The fixture emits one JSON line and exits zero only when every named case passes; bootstrap failure exits two. The real Jest adapter uses a bounded PHP child and validates exact framing, keys and the complete literal case set. Only hosted Jest is eligible; local Jest/emulation, PHPUnit, PHPStan, installation and application/SQL/HTTP execution remain outside this phase.

## Delivery gates

Initial hosted PHPStan Analyze failed on the new mixed token receiver; the first static review missed this. Native `TokenSearchField::setValues` converts entries to `TokenSearchValue`, but the inherited getter does not expose that element type. After genuine hosted RED, tests-only `e49738bd` tightened the source inverse and produced 21 pass/one source-gate failure before production correction. A wrapped CLI one-line ternary narrows only the new `getSystem()` call, retaining all original statements and their static baseline behavior. Final standalone execution remains 22/22. This source-gate RED is not an extra behavioral failure or PHPStan emulation; fresh hosted Analyze and baseline-stability evidence are required. Original digest remains unchanged.

Wrapped coding-CLI tests-only author and minimal implementer were separate from independent review. Controller owns materialization, Git and runtime verification. Claude unavailable; Sol/Astra use separate contexts/models with the same provider, not ordinary GitHub approval or independent HEAD/hash/runtime attestation. Exact-head hosted/static/coverage evidence is recorded in the controller delivery handoff, not inferred from local tests.

READY means bounded source only after independent review. AWAITING-QA: authenticated public FHIR, actual SQL, roles/security, persistence and clinical acceptance. NEEDS-APPROVAL: ordinary review/approval; draft remains unmerged and undeployed. Any missing/failed coverage or other hosted gate stays BLOCKED. Next delivery rotates to a different eligible item rather than unchanged PR319 or this PR's QA polling. PR55 parked and PR47 settled. Root checkpoint and Swedish clone/publication/installation restrictions and all stopped phases remain preserved. No master writes, merge/bypass, deployment, DB/patients, national integrations, vendor contact, cron changes or audit-reviewer restart.
