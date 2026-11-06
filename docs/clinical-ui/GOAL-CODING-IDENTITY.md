# Goal description coding identity

## Source trace

`FhirGoalService` constructs `CarePlanService` with `TYPE_GOAL`. Its search delegates to `CarePlanService::search()`, whose query selects goal rows from `form_care_plan`, projects each row's `code` into `details`, and aggregates rows by encounter and form ID. `FhirGoalService::parseOpenEMRRecord()` consumes those details to build `Goal.description.coding`. This trace follows source code; no SQL was executed for this change.

## Mapping rule

A description coding is identified by its resolved system and exact prefix-stripped code. The mapper resolves the system from the original typed input before checking for duplicates. A repeated pair is skipped; the first coding, display, and input order win. Aliases such as `SNOMED:42` and `SNOMED-CT:42` resolve to one pair. The same code in different systems remains distinct, as do `01` and `1` within one system. Description lookup still receives the original typed input. Target measures remain per detail, including details whose description coding was skipped.

## Evidence and limits

The native PHP CLI fixture uses synthetic records, a deterministic `lookup_code_descriptions()` and `xl()`, an empty framework base class, and reflection to bypass the mapper constructor. Native Goal, Coding, CodeTypesService, and UtilsService classes are loaded from source without application or database bootstrap. Controller pre-product RED was 10 passed and 6 failed out of 16; post-product GREEN is 16/16. The exact whole-source inverse preserves original SHA256 `e73ad2b3e64728168a13af1607ee91a1dabef0afcb414af71be169bdb502e28b`. Actual hosted strict adapter execution remains pending. Controller moved synthetic global initialization before the native constructor and removed unnecessary error-reporting exclusions before recording RED; these are nonproduction fixture corrections requiring independent review. No local Jest, emulation, PHPUnit, or PHPStan execution is claimed.

The full original 22 features, researched UI, exhaustive popups, demo coverage and Swedish programme remain incomplete; this is only a supporting patient-record interoperability slice, not a clinical-loss or authenticated-acceptance proof. Actual SQL and FHIR behavior, roles, security, persistence, clinical QA, ordinary approval, and exact-head hosted coverage and static checks are awaiting verification. This record does not establish merge, deployment, master, cron, database, live-patient, national, or vendor acceptance.