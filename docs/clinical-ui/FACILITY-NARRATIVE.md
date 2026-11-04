# Facility Organization narrative escaping

## Scope

The supplied native `FhirOrganizationFacilityService::parseOpenEMRRecord()` source builds an XHTML narrative from the facility name and exposes it through the Organization resource and native JSON encoding. The source also shows the Organization-to-OpenEMR field mapping in `parseFhirResource()` and delegates record writes to `FacilityService`. This is source-level evidence of the mapping and writer delegation, not evidence of an authenticated, persisted exploit.

Replace only the raw `$narrativeText` operand in the existing `div` concatenation with `htmlspecialchars($narrativeText, ENT_QUOTES | ENT_SUBSTITUTE | ENT_XML1, 'UTF-8')`. This escapes XML text characters and both quote types, substitutes invalid UTF-8 in the narrative, and retains PHP’s default `double_encode=true`, so entity-looking input remains literal text. The surrounding XHTML, trimming, narrative-presence condition, structured name, other fields, helpers, and validations remain unchanged.

## Tests-first evidence

The controller-supplied tests-only RED result reports 15 fixture cases: 9 passed and 6 failed semantically. Failures cover ampersands, angle brackets, injected sibling markup, quotes, entity-looking text, and invalid UTF-8 substitution. The controller subsequently reported 15/15 GREEN for the proposed production change. These reports were not independently reproduced or authenticated here.

The initial independent static review identified one introduced P2 finding: the fixture’s date-only `period_start` can inherit the current time and make comparisons intermittently fail. This correction changes that fixture value to `2020-01-01 00:00:00`, selecting the native helper’s full-time parser. It does not change assertions, production code, or the 15 case contract. The reported GREEN result preceded this fixture correction; no post-correction execution or final review is claimed.

The fixture loads native classes and models, declares only a synthetic parent class, and bypasses the service constructor. It does not bootstrap the application or use a database, Composer, PHPUnit, or local Jest/emulation.

## Limits and follow-up

Legacy absent, null, empty, whitespace-only, and string-zero name behavior is preserved. XML control-byte policy is not fixed. Invalid UTF-8 in the structured name remains raw and can prevent JSON serialization; substitution applies only to the narrative. Supporting interoperability for the original 22 requested features and the researched UI is not implemented.

Authenticated acceptance, including reads and writes, roles, security, persistence, and clinical gates, remains outstanding. Ordinary approval and hosted coverage CI also remain outstanding. No merge or deployment occurred. No denied acquisition, Git, implementation, runtime, capture, Swedish clone, publication, or installation action was retried or reproduced.