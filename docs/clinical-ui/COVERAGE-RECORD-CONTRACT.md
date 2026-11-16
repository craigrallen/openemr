# OPEMR-261 Coverage record contract

This contract covers the **read side of stored legacy `insurance_data` rows**. A stored string `policy_number` equal to `'0'` must produce both the Member Number (`MB`) Coverage identifier and `subscriberId`, each with the exact string value `'0'`. Other policy values retain their existing behavior. Missing, null, empty, false, and integer zero remain omitted. The additional policy type identifier remains independent.

The intended product change is exactly two identical replacements in `src/Services/FHIR/FhirCoverageService.php`:

```php
if (!empty($dataRecord['policy_number'])) {
```

becomes

```php
if (!empty($dataRecord['policy_number']) || ($dataRecord['policy_number'] ?? null) === '0') {
```

Both guards must change, one for `identifier` and one for `subscriberId`. All other source bytes must remain unchanged. The fixture requires two corrected occurrences, no old occurrences, and a SHA-256 match to `f3bab1661280d995102f9675a23095a74026276069df7832a9bc74bad4e6b15a` after reversing only those two replacements. The original source cannot satisfy that inverse check.

The standalone CLI fixture uses the native Coverage mapper, generated FHIR model, interfaces, traits, `UtilsService`, and `ValidationUtils` with root-relative, exact-case source paths. Its empty `FhirServiceBase` is a declaration only. Reflection creates the service without running its constructor. The fixture compares native getters, serialized objects, and encoded JSON; checks input immutability; and compares the full resource against a normal policy after removing only the member identifier and `subscriberId`. It initializes UTC, site, and date globals and uses fixed start and end timestamps.

Static source checks establish a limited producer path: `new_comprehensive_save.php` passes `filter_input(INPUT_POST, "i1policy_number")` to `newInsuranceData`; that legacy function binds `$policy_number` to the `insurance_data.policy_number` SQL placeholder without an empty check or `CoverageValidator`; the schema declares a varchar policy column; and `InsuranceService::search` selects `insurance_data.*` before result-record conversion. These checks do not execute SQL or prove an authenticated UI submission succeeds.

The FHIR API write path remains outside this contract. `CoverageValidator` requires `policy_number` length 2–255, so an API write of `'0'` remains unsupported. No validator or API relaxation is proposed, and this is not an API round trip test.

The controller owns Git binding, materialization and execution. Tests-only commit `70537bd9` preceded the product change. The native fixture reported 21 cases, 15 passing and six failing on original source, then 21/21 passing after the two guards changed. An initial 20-case RED is retained separately; the controller added an independent subscriber-only predicate before the final RED because the shared policy assertion stopped first at missing identifier count. PHP syntax, Node syntax and diff checks pass. Local Jest/emulation was not run; actual hosted adapter execution and exact-head CI remain separate gates. The coding CLI authored tests and the minimal product proposal in separate phases; the independent reviewer receives all four final artifacts. These results do not independently attest to HEAD or runtime persistence. Allocation is run 1 of a maximum two consecutive scheduled runs including implementation and QA. Ordinary approval and authenticated native roles/security/persistence/clinical acceptance remain open; retain the PR as draft, unmerged and undeployed. No patient or national data, vendor process, cron job, historical denied retry, or root checkpoint write is part of this work.
