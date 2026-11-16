# OPEMR-260: insurance Organization narrative

## Proposed change

The future product patch has one operand: in `src/Services/FHIR/Organization/FhirOrganizationInsuranceService.php`, replace `$narrativeText` in the narrative `div` concatenation with `htmlspecialchars($narrativeText, ENT_QUOTES | ENT_SUBSTITUTE | ENT_XML1, 'UTF-8')`. Keep the structured `name` assignment and every other mapper operation unchanged. The strict inverse case requires exactly one corrected full line and checks that restoring the original line yields SHA-256 `7f3ac4e813b0754545b706ecc99c9f43ba0e86f98d5dd1ffe3657b869670c2e5`. The original source intentionally fails that case and the escaping cases.

The native path is `ins_search` with `FILTER_UNSAFE_RAW` `form_name`, then `buildSaveDataFromForm`, then a bound `InsuranceCompanyService` insert or update. Search selects `i.name` and forwards the row unchanged to the FHIR mapper. This tests the mapper output contract; it does not write through that path.

## Proposed evidence

`tests/clinical-ui/insurance-organization-narrative.php.fixture` is a CLI-only standalone fixture. It uses a root-relative, exact-case OpenEMR source autoloader and the native Organization model, utilities, constants, interface, trait, and insurance mapper. A declaration-only empty `FhirServiceBase` parent and `ReflectionClass::newInstanceWithoutConstructor()` avoid service construction and I/O. There is no vendor or app bootstrap, SQL, or HTTP. UTC, a fixed `last_updated`, and a fixed address period make expected timestamps deterministic.

The fixture checks literal XHTML strings and parses each present narrative with `DOMDocument` and `LIBXML_NONET`. It requires one XHTML `div`, one `p`, and literal paragraph text. It separately checks native `getText()` and scalar `getName()`, decoded object JSON, and encoded mode. Missing or null names use the native missing-data extension because `isset` is false. Empty, whitespace-only, and string `0` names retain their structured values while omitting narrative according to the current mapper condition. A padded structured name remains untrimmed while its narrative is trimmed. Invalid UTF-8 is substituted in narrative only; the structured bytes remain unchanged, so object JSON and encoded mode are expected to fail.

The remaining cases check active and inactive state, identifiers, opaque telecom values, address fields, optional field omission, unchanged input, and unchanged non-name resource fields. The fixture emits exactly one JSON report line with `passed`, `failed`, and `cases`; it exits 0 only when all cases pass, 1 for case failures, and 2 for bootstrap failure. The Jest test invokes PHP directly with a 15-second timeout and checks the complete exact case-name set and report shape.

Evidence remains pending controller materialization, syntax checks, and hosted execution. These tests are not a full 22-case suite, UI or demo evidence, Swedish clinical acceptance, authenticated exploit evidence, a security or persistence claim, or proof about SQL behavior. They do not exercise inbound `parseFhirResource`; its direct-name getter contract is unrelated here. XML control characters and malformed structured JSON remain limitations outside this proposed operand.

## Handoff limits

The controller owns Git, materialization, execution, and repo/HEAD binding. This tests-only handoff proposes no product patch now. Allocation is 1, maximum 2 including implementation QA. Ordinary approval is separate from a draft; there is no merge, deploy, master, database, patient, national, vendor, cron, or root-checkpoint action, and no historical denied retry.
