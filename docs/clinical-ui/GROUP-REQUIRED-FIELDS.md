# Patient provider Group required fields

The patient provider mapper enumerates assigned patients as Group members. It represents a specific set of people, so the FHIR R4 Group requires `type: "person"` and `actual: true`, including when the enumeration is empty. These fields use the repository's native `FHIRGroupType` and `FHIRBoolean` models. Practitioner records identify the provider associated with the group; they are not Group members.

The source-only fixture exercises the native mapper and models with synthetic records. It checks the complete JSON shape, member order and references, absence of patient names, unchanged input, and an inverse hash of the approved source additions. It does not exercise SQL, HTTP, inbound resources, persistence, clinical workflows, or authorization. Runtime regression, native authorization and security review, and persistence validation remain pending with the controller.
