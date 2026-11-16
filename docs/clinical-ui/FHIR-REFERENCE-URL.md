# FHIR reference URL contract — OPEMR-254

Owner Hermes controller; scheduled allocation **1/max2 consecutive delivery runs INCLUDING implementation AND QA**, independently rotated OPEMR-253/PR310. This supports patient-record interoperability, not completion of the original22, researched UI, demo coverage or Swedish programme.

## Native contract

`FhirServiceBase::setFhirApiUrl` installs the resolver in `FHIRSearchFieldFactory`. The factory resolves absolute reference-search values before constructing `ReferenceSearchField` / `ReferenceSearchValue`. `ServerConfig::getFhirUrl` produces an endpoint ending in `/fhir` without a trailing slash. Historically the resolver extracted `r/Patient/id` from that base, or `/Patient/id` from a slash-terminated base, leaving an incorrect or empty resource name in the native reference parser.

The final four scoped changes normalize the configured base to one trailing slash, require an exact prefix including that boundary, extract the suffix at its actual length, and declare the stored offset as an integer. Both base spellings now return `Patient/opaque-id`, producing native resource `Patient` and ID `opaque-id`. Sibling paths and remote URLs embedding the configured base in a path, query or fragment are rejected rather than mistaken for local references. This is not a comprehensive URI validator or a demonstrated network/SSRF exploit fix.

Accepted suffixes remain byte-for-byte unchanged, including resource case, opaque IDs, encoded characters, query and fragment text. Scheme/port/path matching is deliberately literal, not semantic URI canonicalization. A bare base without its slash now returns null; the normalized base alone returns an empty suffix, which the existing factory rejects as empty. These base-only results are changed behavior, not historical compatibility claims. Empty configured bases retain only a slash-based prefix rule, not a security guarantee. Caller configuration validation, malformed URI policy and UUID conversion remain outside this patch.

## Tests and source preservation

The fixture directly requires the complete native `FhirUrlResolver` and `ReferenceSearchValue` classes from checkout-relative paths. It uses `isUuid=false`, opaque synthetic IDs, explicit runtime checks and one fixed JSON report. There is no framework bootstrap, application execution, SQL, HTTP, patient data, PHPUnit or dependency mock. It does not exercise the factory at runtime; that connected caller is source-inspected only.

The real Jest adapter launches PHP with an absolute fixture path and a 15-second timeout, requiring empty stderr, a successful process, exact single-line framing, exact keys and all24 unique named cases. It is reserved for actual hosted execution; no local Jest or emulator was run.

Tests-only commit `c54cd4cc` preceded production changes: native RED was6 PASS/18 FAIL with empty stderr. Initial native GREEN24/24 did not clear hosted PHPStan: its actual Analyze failed because the untyped offset was mixed. The first static review missed that diagnostic. Tests-only `c7ddd28c` expanded the exact source inverse to require an integer property and genuinely failed23 PASS/1 FAIL before the type correction. Final native GREEN is24/24. The same test-only commit corrects exactly one missing slash in `FhirAllergyIntoleranceServiceQueryTest::getReferenceURL`: the old helper constructed invalid `defaultPatient/id` URLs, causing genuine hosted failures for both absolute-reference datasets. It changes no assertions, providers, SQL or expected results. Local authenticated service tests were not run; fresh hosted execution remains required.

PHP source/fixture/query-test syntax, Node adapter syntax and `git diff --check` pass. Hosted JavaScript, PHPStan Analyze/baseline stability and complete exact-head CI/coverage are separately tracked by the controller. Shared `binaryOp.invalid.php` baseline ownership belongs to PR171; any obsolete suppression cleanup is a blocked integration gate, not permission to edit it or retain an artificial arithmetic expression. No hosted result or independent review is fabricated here.

The source inverse requires exactly one constructor normalization line, one changed prefix predicate, one changed substring expression and one typed property. Reversing only those four edits restores SHA-256 `3669ffddef677c453ededb00eeb43190beec02d2a53d9bedd14586b8ed2f1efd`, retaining every other production byte. Tests/docs are reviewed nonproduction work; the production correction follows genuine RED.

## Remaining gates and boundaries

Ordinary approval and authenticated public-query, SQL persistence, UUID, roles/security and clinical acceptance remain open; standalone class checks do not complete them. Independent frozen-content static review and hosted results are controller evidence, not ordinary GitHub approval or authenticated acceptance.

Swedish clone/publication/installation, root NEXT-WORK/STATUS writes and every other historical denied phase remain untouched. No master writes, merge, review bypass, deployment, database mutation, real patients, national integrations, vendor contact, cron changes or audit-review restarts are included. PR55 remains parked and PR47 settled. Next implementation rotates to a different independently eligible item rather than replaying unchanged QA.
