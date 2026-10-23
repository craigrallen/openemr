# Clinical note linked input: OPEMR-107

## Change and rationale

`ClinicalNotesService::saveLinkedDocuments()` and `saveLinkedResults()` previously cleared their respective links before converting each submitted UUID. A malformed later UUID could therefore fail after the old links were deleted, and after earlier lookups or inserts. Both methods now scan all actionable UUID values with the actual `UuidRegistry::uuidToBytes()` converter before their clear or any lookup SQL. A nonempty value that is not a string raises `InvalidArgumentException` before SQL. A malformed string is rejected by the same converter used for the lookup.

The scan narrows mixed rows with `is_array()` before reading `uuid` and explicitly skips the values PHP treats as empty for native JSON/scalar input: absent or `null`, `false`, `0`, `0.0`, `'0'`, `''`, and `[]`. Scalar rows remain skipped. Empty lists still clear existing links. The converter's accepted string spellings remain accepted; there is no separate regex or validity rule. After validation, the original clear, lookup, and insert path remains in place, including input order, duplicate links, SQL targets and binds, and skipping UUIDs that have no matching source row. The parameters remain `array<mixed>` because rows may be scalar.

## Verification record and next run

The controller's genuine native RED on committed `tests/Tests/Isolated/Services/ClinicalNoteLinkedInputTest.php` was **20 tests, 252 assertions, 12 failures**. The failures were unexpected DELETE operations before validation, with no setup errors. Controller GREEN subsequently passed **20 tests, 264 assertions, no errors or failures**, using an external loader rooted at this worktree's source with sibling vendor dependencies only. Broader isolated Services passed **844 tests, 2267 assertions**, exit 0, with **one warning, one skip and one incomplete**; this is not an issue-free full suite. Syntax checks and `git diff --check` passed. Independent Astra static review cleared that earlier production/test diff for the actual JSON-decoded caller; it did not execute tests. This is run 1 of a maximum of two scheduled runs per surface/PR, including QA.

Hosted PHPStan 8.5 Analyze on exact head `2e81798c` then failed on the introduced helper: `empty()` was disallowed and offset `uuid` was accessed on `mixed`. The job also reported baseline count mismatches of 23 versus 24 (`empty`) and 2 versus 3 (mixed offset). This revision fixes those source diagnostics directly; no baseline or suppression was changed. Controller reran the revised helper plus added `0.0` skip case: **20 tests, 264 assertions, zero errors/failures**. Independent Astra delta static review cleared production/tests for the actual associative-JSON caller, but did not run PHP or tests. The corrected exact-head hosted CI remains pending.

For a correctly installed repository, the native isolated command is:

```sh
vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/Services/ClinicalNoteLinkedInputTest.php
```

The controller's external rooted loader is unavailable to hosted CI. The standard repository command above is the CI path. This implementation session did not execute PHP, PHPUnit, the project, a database, or a GUI.

## Scope and remaining gates

Only malformed actionable UUID rejection moves before link mutation. The supported caller decodes associative JSON arrays. The helper skips nonarray rows; the original save loops still determine later behavior for arbitrary object rows, which are outside this guarantee. The caller, `interface/forms/clinical_notes/save.php`, saves the note first and then handles documents and results as separate operations. This fix does not make a note save or the two link updates atomic. It does not promise rollback for a later lookup or insert failure, global transaction safety, ownership checks, or authorization repair.

Authenticated roles, session and persistence behavior, clinical and security review, hosted CI, and ordinary approval remain gates. The change is draft only; it is not acceptance for master or deployment. Swedish checkout or publication and unrelated GUI or cache work remain outside this slice.
