# OPEMR-108: document reference read

`DocumentService::getFile()` now returns `false` when its bound metadata lookup finds no row (`false` or `[]`). This stops before `C_Document` construction and retrieval. The query still filters by document ID, patient ID, and `deleted = 0`. The valid-row path, including `unknownName`, retrieval flags and key, empty-body handling, MIME type, and result shape, is unchanged. The existing REST controller maps the service's `false` result to HTTP 400.

## Native verification

From `/Users/craig/.hermes/workspaces/openemr-document-reference-read`:

```sh
python3 /Users/craig/.hermes/projects/openemr/verification/document-reference-read-20261023/run-native.py GREEN
```

The external runner invokes the isolated PHPUnit configuration and writes its log and JUnit XML outside the repository. The controller runs the gates. Existing logs record native RED from the tests-only commit `7efd31ab`: five cases, 25 assertions, and five constructor errors when absent metadata fell through to `C_Document` construction. The earlier `RED.log` stopped during loader setup; `RED-native.log` reached the actual method.

The controller's corrected-test `GREEN-final.log` records 5 tests and 40 assertions passing on the earlier head. The earlier broader isolated Services run exited 0 with 829 tests, 2043 assertions, one warning, one skipped test, and one incomplete test; the existing REST run records 15 tests and 65 assertions. Independent Astra static review found a P2 test loader catch; removing that catch and error suppression resolved it, and review of the earlier head found no remaining P1/P2. Positive-path preservation was verified by removing the three-line absent-row guard and comparing the entire source byte-for-byte with the base. Rotation allocation: run 1 / max 2. The initial hosted PHPStan run failed because the new `empty($filenameSql)` increased the service's strict-comparison baseline count from six to seven and the test's `$row` lacked an iterable value annotation. The guard now uses strict `false` and `[]` comparisons, and the test declares `array<mixed>|false`. Exact new-head CI and independent review remain pending; no hosted green result or full positive-path runtime result is claimed here.

The native cases use the actual `getFile()` and `sqlQuery()` with an ADODB mock expecting exactly one bound lookup. They cover `false` and empty-array results, with missing, deleted, and other-patient cases represented by simulated absent rows. They do not read a real deleted row or file, exercise positive retrieval, or verify ACL, clinical behavior, authenticated REST acceptance, or the full feature 4 UI flow. Positive-path preservation is based on the source diff.

`DocumentService` construction normally performs a missing-UUID backfill, so the isolated cases instantiate the service without its constructor. Source preflight shows existing `C_Document::retrieve_action()` category and patient access checks; it does not itself check `deleted`. The metadata query's `deleted = 0` filter and this early return prevent retrieval on an absent filtered row. This change does not replace end-to-end authorization or clinical acceptance.
