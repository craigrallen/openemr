# OPEMR-130: CCDA care plan narrative stripping

## Correction

`getPlanOfCare()` removes legacy `{|...|}` issue-code markup from a care plan description before placing the description in the CCDA XML. The prior greedy match could start at the first `{|` and end at the last `|}`, deleting ordinary narrative between two markers. The match is now non-greedy, so each marker is removed separately and the intervening source bytes remain. The existing `]` exclusion in the pattern is unchanged, including its behavior for malformed markers.

This correction applies to the same description used by the care plan, goal, health concern, and planned procedure branches. Query text and binds, issue linking, SDOH handling, authorization, status and dates, and XML structure are unchanged. The description text and its derived `sha_extension` can change when previously deleted narrative is restored. The hash is computed for each export; no persisted data migration is needed. Downstream consumers that deduplicate by this identifier need authenticated export validation.

## Native isolated regression boundary

`CarePlanNarrativeStripTest` loads a byte-identical mirror of the entire production dispatch source in each child process. The two relative includes required by that source resolve to inert files in the private temporary mirror. It uses the native `xmlEscape()` helper and parses the returned XML. The author method is overridden to return fixed XML. `QueryUtils`, `UuidRegistry`, and `HistorySdohService` are child-only substitutes. A fixed, generated PHP file inside the mirror defines the namespaced `Carecoordination\Model\sqlQuery()` boundary, which records the social-history read and returns `false`. These boundaries return synthetic rows and record calls; they perform no database or endpoint I/O. The test contains expected narratives, not a copy of the production regex.

The eight narrative cases cover separated and adjacent markers, multiline content, a single marker, no marker with XML escaping, and legacy malformed-marker behavior. Each case runs independently in all four output branches. A separate filtered-empty case checks that the early return occurs before data access.

## Verification

The repository's isolated-test command is `vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/Services/Cda/CarePlanNarrativeStripTest.php`. With the available vendor launcher, the focused test also ran from the repository root using:

```sh
/Users/craig/.hermes/workspaces/openemr-workbench-shell/vendor/bin/phpunit --no-configuration --do-not-cache-result tests/Tests/Isolated/Services/Cda/CarePlanNarrativeStripTest.php
```

Both the direct run and the repository-configured run passed: **33 tests, 778 assertions, 0 failures, 0 errors**. Controller logs in `verification/ccda-care-plan-narrative-20261024` under the OpenEMR mission directory record earlier original-source RED runs: **33 tests, 764 assertions, 8 intended failures, 0 errors** for the expanded test and **8 tests, 237 assertions, 2 intended failures, 0 errors** for the historical test. Those RED runs establish that the regression detects the missing narrative. Do not add a separate external bootstrap to the direct vendor command; it conflicts with the functions loaded by that launcher in this local setup. This isolated check does not establish clinical acceptance or complete suite, UI, security, and authenticated export behavior.
