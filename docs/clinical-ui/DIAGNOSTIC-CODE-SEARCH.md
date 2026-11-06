# OPEMR-223 DiagnosticReport code search

## Change

The aggregator previously routed a code search to the first child service that supported the first token. A code present in both clinical notes and laboratory reports could therefore lose the laboratory result. Comma-separated OR values could also lose results when their codes belonged to different services.

The replacement parses comma-separated values for service selection, asks the existing mapped-service trait for every supporting service, and combines their ProcessingResult values through the existing searchServices method. It passes the original search parameters and patient bind to each child. The native child search-field factory retains responsibility for parsing raw token and comma-separated input. The category branch, no-code branch, patient binding, and existing child-error handling remain in place. If no service supports a code, the existing getServiceForCode exception supplies the validation error. The native laboratory service reports support for every code, so the unsupported-code case is a synthetic compatibility check rather than a claim about normal laboratory routing.

Only the approved code branch is replaced. The unused legacy import and category behavior remain as supplied; there is no helper, baseline, configuration, or dependency change.

## Evidence and test boundary

The controller saved a tests-only native RED result in red.json: 17 expected checks, 6 passed, and 11 semantic failures before the product replacement. The original complete source SHA-256 was d1f7069a77b8a438b8ecd0737762c13f6eacdb3df29e8fbd557a2ff7b6faca38. The fixture's source gate accepts that original source or the exact approved replacement and checks whole-source preservation by reversing the replacement.

The fixture loads the native DiagnosticReport aggregator, mapped-service traits, patient trait, token search field and value, FHIR search-field factory, ProcessingResult, and QueryPagination. It uses declaration-only seams for the framework base, interfaces, and unused traits; a fixed logger seam; constructor bypass for the aggregator; and a recording projected-row child backend. Those seams do not exercise the full native child services, ListService, SQL, the complete search pipeline, or production authentication. The 17 checks cover shared, single-service, comma-separated and array OR, prefixed and repeated tokens, parameter forwarding, patient binding, category precedence, no-code aggregation, child errors, and synthetic unsupported-code validation. Final 17/17 is expected only if the controller executes the approved replacement and reports it; it has not been observed here.

No runtime request, local Jest, emulation, PHPUnit, PHPStan, installation, network access, or independent review was performed in this authoring step. Hosted CI and coverage, independent review, and ordinary approval remain open. The change is unmerged and undeployed. It supports patient-record interoperability for this DiagnosticReport search path; it does not establish UI coverage, all 22 paths, Swedish completeness, authenticated FHIR behavior, roles, security, persistence, clinical correctness, or whole-FHIR conformance.
