# Patient provider Group required fields

The patient provider mapper enumerates assigned patients as Group members. It represents a specific set of people, so the FHIR R4 Group requires `type: "person"` and `actual: true`, including when the enumeration is empty. These fields use the repository's native `FHIRGroupType` and `FHIRBoolean` models. Practitioner records identify the provider associated with the group; they are not Group members.

The CLI-only fixture executes the complete native mapper and models with synthetic records and a declaration-only parent, bypassing its database-mutating constructor. It checks the complete JSON shape, member order and references, absence of patient names, unchanged input, and an inverse hash of the approved source additions. Controller verification recorded tests-only RED (7 cases, 6 failures), then GREEN (7 cases, 0 failures) after the product additions. The controller added the CLI-only guard before RED; the remaining fixture, adapter and product fragments are coding-CLI authored.

The fixture does not exercise SQL, application bootstrap, authenticated HTTP, inbound resources, persistence, clinical workflows, or authorization. Native authenticated security/persistence/clinical acceptance, complete hosted checks and ordinary approval remain separate gates. This is supporting record interoperability, not completion of the original 22 features, researched UI or Swedish-readiness programme.

FHIR R4 source: <https://hl7.org/fhir/R4/group.profile.json> specifies both fields as `1..1` and permits members only for an actual group.
