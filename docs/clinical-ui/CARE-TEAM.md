# CareTeam provider role contract

OPEMR-248 covers the provider role coding produced by `FhirCareTeamService::populateProviderTeamMembers`. `CareTeamService` obtains `physician_type_codes` from the `physician_type` list. Its provider read strips only a leading `SNOMED-CT:` token; list administration can retain other typed codes. The native role mapper currently assigns the SNOMED system to every populated code and uses SNOMED for title-less lookups.

The fixture calls the public provider population method with the native CareTeam, participant, coding, UtilsService, and CodeTypesService implementations. A declaration-only parent bypasses application bootstrap; reflection bypasses the CareTeam service constructor. The only CodeTypes override records description lookup keys and supplies synthetic descriptions. Translation is a synthetic fallback. Identifiers and timestamps are opaque fixture values. These cases do not exercise SQL, HTTP, security, persistence, clinical acceptance, or US Core validation.

The intended scope is recognized native code types such as NUCC and RoleCode: keep their native FHIR system, code, and title-less lookup type. Bare values and unknown prefixes retain the existing SNOMED fallback; known SNOMED aliases retain their system. No arbitrary-system behavior is specified.

This is a tests-only TDD handoff. Controller execution and results are pending. The controller owns source materialization, Git, and the scheduled run 1 / maximum run 2 sequence, including QA. Ordinary approval and authenticated acceptance remain open; no merge or deploy is implied.
