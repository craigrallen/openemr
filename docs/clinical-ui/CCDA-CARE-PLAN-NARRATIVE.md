# OPEMR-130: CCDA care plan narrative stripping

## Correction

`getPlanOfCare()` removes legacy `{|...|}` issue-code markup from a care plan description before placing the description in the CCDA XML. The prior greedy match could start at the first `{|` and end at the last `|}`, deleting ordinary narrative between two markers. The match is now non-greedy, so each marker is removed separately and the intervening source bytes remain. The existing `]` exclusion in the pattern is unchanged, including its behavior for malformed markers.

This correction applies to the same description used by the care plan, goal, health concern, and planned procedure branches. Query text and binds, issue linking, SDOH handling, authorization, status and dates, and XML structure are unchanged. The description text and its derived `sha_extension` can change when previously deleted narrative is restored. The hash is computed for each export; no persisted data migration is needed. Downstream consumers that deduplicate by this identifier need authenticated export validation.

## Native isolated regression boundary

`CarePlanNarrativeStripTest` loads a byte-identical mirror of the entire production dispatch source in each child process. The two relative includes required by that source resolve to inert files in the child-only mirror. It uses the native `xmlEscape()` helper and parses the returned XML. The author method is overridden to return fixed XML. `QueryUtils`, `UuidRegistry`, and `HistorySdohService` are child-only substitutes, and a namespaced `Carecoordination\Model\sqlQuery()` function intercepts the social-history read. Those boundaries return synthetic rows and record calls; they perform no database or endpoint I/O. The test contains expected narratives, not a copy of the production regex.

The eight narrative cases cover separated and adjacent markers, multiline content, a single marker, no marker with XML escaping, and legacy malformed-marker behavior. Each case runs independently in all four output branches. A separate filtered-empty case checks that the early return occurs before data access.

## Verification

Run from the repository root in an environment with the checkout's Composer dependencies:

```sh
vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/Services/Cda/CarePlanNarrativeStripTest.php
```

Do not add an external bootstrap to this command: its function definitions duplicate those loaded by the vendor launcher. Before the production change, the controller's focused run of the original eight-case test reported **8 tests, 237 assertions, 2 intended failures, 0 errors**; the failures exposed the missing intervening narrative. The independent branch cases and corrected production source await a controller PHPUnit run. That historical RED result does not establish a post-change pass or clinical acceptance. Complete suite, UI, security, and authenticated export validation are outside this isolated check.
