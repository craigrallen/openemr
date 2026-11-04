# RelatedPerson active mapping

The read mapper now emits `active: true` for strict integer `1` or strict string `'1'`. All other values retain the existing false behavior. The change is limited to one expression in `FhirRelatedPersonService::populateActive`.

The controller executed six synthetic contract cases with two semantic failures before the product change: direct string `'1'` and string `'1'` through the full native parse. After the change all six pass. The fixture uses the native service, traits, interfaces, FHIR models, helpers and JSON serialization, with a declaration-only framework parent and a Reflection constructor bypass. Its complete-source inverse retains original SHA-256 `2897441609d9ab3489003b6143cb722910691b43059bbb97a8d0e68f03b7c267` and constrains the source change. The full parse returns a RelatedPerson object even when the encode flag is true; it does not establish string encoding.

Source inspection shows `ContactRelationService` selects `cr.active`; `BaseService` converts UUIDs without normalizing active. These are source observations, not executed database-producer coverage. No runtime SQL, browser behavior or production corruption was observed. This supports a narrow interoperability correction, not completion of the original 22 features, UI behavior or Swedish acceptance.

The controller replaced a display-masked synthetic phone input and its matching assertion with `synthetic-phone`, then recaptured the same genuine RED before production. This is test-data-only; the initial authored proposal and evidence remain retained for independent review.

Hosted CI, ordinary approval, authenticated role and security checks, persistence checks and clinical QA remain pending. Historical denials remain in force; no merge or deploy is proposed. This is run 1 of at most 2 consecutive scheduled runs including implementation AND QA. Internal phases do not consume separate allocations. A preliminary FhirDeviceService read-mapper item requires a fresh native gap, ownership and Jira assessment before it is ready.
