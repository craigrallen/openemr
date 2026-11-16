# OPEMR-259: procedure provider narrative

## Proposed change and evidence

The future product change has one operand: escape `$narrativeText` where the procedure provider mapper concatenates it into the XHTML `div`, using `htmlspecialchars($narrativeText, ENT_QUOTES | ENT_SUBSTITUTE | ENT_XML1, 'UTF-8')`. The source preservation case requires exactly that corrected full line and verifies that reversing it restores the supplied original SHA-256. The original source must fail the narrative and preservation cases. These files contain tests and documentation only. Controller syntax checks and hosted fixture/Jest results are pending; no local execution or independent repository or HEAD attestation is claimed.

The native editor copies `users.organization` into the provider's `name` and saves that bound name. `ProcedureProviderService` projects `prov.name`. The proposed mapper change affects the generated narrative only; structured `Organization.name` retains the untrimmed source value. The fixture checks native getters, object JSON, encoded JSON, and literal XHTML expectations separately. It checks absent, null, empty, whitespace, and string-zero behavior, native missing-name extension behavior, active state, optional NPI, fixed timestamp, type, ID, input immutability, and fields outside name and text.

## Fixture boundary

`tests/clinical-ui/procedure-provider-narrative.php.fixture` runs only through CLI PHP. Its root-relative autoloader loads native OpenEMR classes with exact case. It declares an empty `FhirServiceBase` solely to satisfy the mapper's parent declaration, loads the real marker interface and empty trait, and constructs the native mapper with `ReflectionClass::newInstanceWithoutConstructor()`. The records and identifiers are synthetic. This boundary avoids vendor and application bootstrap, SQL, HTTP, and the mapper constructor. The fixture emits one JSON line with exactly `passed`, `failed`, and `cases`; bootstrap failure exits 2. Jest executes the PHP fixture with a 15-second timeout and checks the complete case set and report shape. It does not emulate PHP.

## Scope and limits

XML parsing uses `LIBXML_NONET` and checks one XHTML `div` and one `p` with literal paragraph text. Invalid UTF-8 is substituted in the narrative while the structured name keeps its original bytes; native JSON encoding is expected to fail for those bytes. XML control characters remain outside this fix, and malformed structured JSON is not repaired. This is mapper-level evidence, not completion of the original 22 features, UI, demo, Swedish clinical, authenticated security, persistence, or SQL acceptance.

The controller owns Git materialization and execution. The implementation allocation is one change with a maximum of two including implementation QA. Ordinary approval is separate from a draft review. This work does not authorize merge, deploy, master, database, patient, national, vendor, cron, root checkpoint writes, denied historical retries, or external writes.
