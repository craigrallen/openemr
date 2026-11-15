# OPEMR-244 advance directive search contract

This tests-only change targets the native `FhirObservationAdvanceDirectiveService::searchForOpenEMRRecords` method. It checks that a nonempty code token list containing no supported ADI codes returns an empty `ProcessingResult` before patient lookup. Single unknown, multiple unknown, and system-qualified unknown tokens cover that branch.

Supported codes `75320-2` and `75787-2`, a mixed supported and unknown list, an omitted code, and an explicitly empty native token list retain the existing patient lookup branch. A wrong code field type and an invalid category retain native validation. The fixture passes a 16-byte patient UUID directly, invokes the protected method through reflection, and uses the native token fields, result class, trait, and interfaces. Only `FhirServiceBase` is declared synthetically to supply a logger. The namespaced SQL trap increments a counter and throws a fixed exception. A trapped lookup therefore proves branch preservation; it does not prove successful SQL or data acceptance.

The fixture checks the full service source SHA-256 against `85e0dbe9279a3fce1095fe9e75fecb7381cb624cb6afafec26bd5788898e316e`. It also permits exactly one specified insertion immediately before `unset($openEMRSearchParameters['code'])` when removing that insertion restores the original hash. The baseline source passes this source gate while the three unknown-token behavior cases should fail.

Actual RED/GREEN execution, review, and CI are pending controller work. No production change is proposed here. This scope supports native interoperability for the search branch; it does not cover the full clinical UI, Swedish localization, or the wider 22-case suite. Terminology and DNR mapping remain outside this change.
