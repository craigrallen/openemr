# OPEMR-211: Location organization injection

## Scope

`FhirLocationService::setOrganizationService()` previously assigned the supplied service to `$organizationService`, while `getOrganizationService()` reads `$fhirOrganizationService`. The setter therefore did not affect the dependency used by `parseOpenEMRRecord()`.

The product correction has two exact deltas: the setter assigns `$this->fhirOrganizationService = $organizationService;`, and the unused `private FhirOrganizationService $organizationService;` declaration is removed. Every other product byte remains unchanged. The original source SHA-256 is `a98e53b0c75e35385bc2471d348483fa7978947f771ed0fce15a048a25f4ceb2`; reversing the setter assignment and restoring that declaration at its original constructor anchor must reproduce the hash.

This corrects an existing public injection contract. No existing production caller of the setter was found. Direct setter use and the connected parser support the interoperability behavior tested here; they do not establish completion of the original feature or a UI redesign. This is a dependency gap, not evidence of production data corruption.

## TDD evidence

The tests-only commit `b853b5b24b39d4f0983ae93b3d2a9aa08cef4154` received a genuine controller semantic RED: 12 cases, 4 passed, 8 failed, `errors: []`. The reported source hash remained the original hash above. The failures cover injected identity, replacement, instance independence, parsed references, and null omission. Controller evidence then recorded 12 passing cases with the setter corrected and the unused declaration still present. Hosted PHPStan41895004404 at `3a7bfb75bc60de277c4a41bed63bfcc645ea5da7` reported a genuine RED for the unused `FhirLocationService::$organizationService` property. Tests-only `630388c3` added a precise source check requiring its absence: 13 cases, 12 passed and that check failed before removal. The new 13-case GREEN is recorded separately after materialization, not inferred from authorship.

The CLI contract fixture is `tests/clinical-ui/location-organization-contract.php.fixture`; its hosted Jest wrapper is `tests/js/location-organization.test.js`.

```sh
php tests/clinical-ui/location-organization-contract.php.fixture
```

Jest execution is hosted only for this delivery; local Jest, emulators and PHPUnit remain outside its authorized verification boundary.

Before final RED, controller corrections retained the actual assertions while fixing an invalid `isset` expression to a null check, asserting native `versionId` and status as strings, using an ordinary synthetic phone string, and removing adapter leading whitespace. These are nonproduction harness corrections requiring independent review; the earlier native-status harness failure is retained separately, not counted as semantic regression proof.

The fixture supplies declaration-only synthetic `FhirServiceBase` and a synthetic `FhirOrganizationService` constructor, reference, and call boundary. It loads the native `FhirLocationService`, its traits and interfaces, `UtilsService`, and R4 models. Reflection bypasses the database-mutating Location constructor. It does not construct a native organization service or prove SQL, native ACL, web, or persistence behavior; lazy construction is verified only against the synthetic dependency.

For a native facility record, the contract checks the injected managing reference and encoded JSON, omission when that reference is null, replacement before and after lookup, replacement after lazy lookup, and independence between Location instances. It also checks native Location fields and unchanged input.

## Remaining validation

Authenticated role and security checks, persistence and clinical QA, full hosted CI coverage, and ordinary approval remain open. This delivery includes no merge, deploy, install, national integration, vendor or cron work, or denied-path retry.
