# Facility Organization narrative escaping

## Scope

The supplied native `FhirOrganizationFacilityService::parseOpenEMRRecord()` source builds an XHTML narrative from the facility name and exposes it through the Organization resource and native JSON encoding. The source also shows the Organization-to-OpenEMR field mapping in `parseFhirResource()` and delegates record writes to `FacilityService`. This is source-level evidence of the mapping and writer delegation, not evidence of an authenticated, persisted exploit.

Replace only the raw `$narrativeText` operand in the existing `div` concatenation with `htmlspecialchars($narrativeText, ENT_QUOTES | ENT_SUBSTITUTE | ENT_XML1, 'UTF-8')`. This escapes XML text characters and both quote types, substitutes invalid UTF-8 in the narrative, and retains PHP’s default `double_encode=true`, so entity-looking input remains literal text. The surrounding XHTML, trimming, narrative-presence condition, structured name, other fields, helpers, and validations remain unchanged.

## Tests-first evidence

The supplied tests-only RED result reports 15 fixture cases: 9 passed and 6 failed semantically. Failures cover ampersands, angle brackets, injected sibling markup, quotes, entity-looking text, and invalid UTF-8 substitution. The fixture loads native classes and models, declares only a synthetic parent class, and bypasses the service constructor. It does not bootstrap the application or use a database, Composer, PHPUnit, or local Jest/emulation. No post-change green result, review, or CI result is claimed.

## Limits and follow-up

Legacy absent, null, empty, whitespace-only, and string-zero name behavior is preserved. XML control-byte policy is not fixed. Invalid UTF-8 in the structured name remains raw and can prevent JSON serialization; substitution applies only to the narrative. Supporting interoperability from the original 22 cases and the researched UI is not implemented.

Authenticated reads and writes, roles, security, persistence, and clinical gates remain to be evaluated, along with ordinary approval and hosted coverage CI. No merge or deployment occurred. No denied acquisition, Git, implementation, runtime, capture, Swedish clone, publication, or installation action was retried or reproduced.