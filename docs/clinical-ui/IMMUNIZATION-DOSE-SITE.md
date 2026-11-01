# OPEMR-202: Immunization dose without an administration site

Implementation owner: OPEMR-202. Review rotation: 1 of at most 2; ordinary project review remains pending.

## Scope

This supports original patient-record FHIR Immunization interoperability when a recorded dose has no administration site. It does not deliver the full original 22-item scope or a UI change. The exact Jira scope is:

- `src/Services/FHIR/FhirImmunizationService.php` — production change: gate `doseQuantity` on the presence of `amount_administered`, independently of `administration_site`.
- `tests/clinical-ui/fixtures/immunization-dose-site.php.fixture` — existing native PHP fixture, unchanged in this phase.
- `tests/js/immunization-dose-site.test.js` — existing test wrapper, unchanged in this phase.
- `docs/clinical-ui/IMMUNIZATION-DOSE-SITE.md` — this implementation record.

The site guard and coding, quantity value, unit code, and unit system remain as they were. The mapper now retains a present zero amount and omits `doseQuantity` for missing or null amount. It does not invent an amount or change clinical policy, validation, defaults, or unit mapping.

The native immunization query selects amount, unit, and site independently with a site `LEFT JOIN`; its producer currently applies `intval` to the amount. The patient-record form saves amount and site independently, with an optional site selector (516). The same FHIR service parses incoming dose and site independently. This change does not address fractional precision in the producer; PR204 owns the separate `src/Services/ImmunizationService.php` work.

## Evidence and boundaries

The controller saved a genuine pre-change RED in `/Users/craig/.hermes/projects/openemr/verification/questionnaire-normalizer-readiness-20261101/controller-red.log`: 24 cases, 8 passed, 16 failed. After the one-line production change, direct `php tests/clinical-ui/fixtures/immunization-dose-site.php.fixture` returned `{"expected":24,"passed":24,"failed":[]}`.

The no-I/O fixture loads the complete native service, traits, interfaces, helpers, and FHIR models. It substitutes only a declaration-only parent and bypasses the service constructor; it does not bootstrap the application or use a database. Object and encoded results are checked. Fractional and numeric-string inputs cover this direct mapper seam only, not current native producer precision. Missing or null amounts with a site are defensive seam cases, not a proven database record shape.

Hosted/native authenticated FHIR role, security, persistence, and clinical gates remain pending, as does ordinary review. No merge, deployment, master, database, vendor, national or Swedish publication, or cron change is part of this phase; historical denials remain in force.
