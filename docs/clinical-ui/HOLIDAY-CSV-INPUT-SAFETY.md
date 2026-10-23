# Holiday CSV date input safety

An interior NUL in a CSV date cell reaches `DateTimeImmutable::createFromFormat()` after the parser trims the cell. PHP throws `ValueError` for that input. The holiday import UI catches `InvalidHolidayCsvException` and `RuntimeException`, so this `ValueError` bypasses its normal error message path.

`HolidayCsvParser::parseDate()` now returns `null` when the already trimmed date contains a NUL. The existing invalid-date path then raises `InvalidHolidayCsvException` with the CSV row number. This check leaves the current trim behavior intact: raw leading or trailing NULs can still be trimmed and accepted. It does not change description handling, zero-year acceptance, accepted date formats, calendar validation, timezone, midnight, CSV header and BOM handling, blank rows, or generator row order and numbering.

The parser is a generator, so a valid row can be yielded before a later invalid row is encountered. Upload validation iterates the parser before moving the file; that existing validation-before-move behavior is unchanged. This change is limited to the parser, the new native input-safety tests and this note. It does not change the service, uploader, transactions, SQL or storage, ACLs, or sessions.

The controller executed the tests-only commit `a294cde5` against native PHP 8.5.12 with the actual League CSV reader and target parser. The genuine RED run had 20 tests, 63 assertions, eight `ValueError` errors in interior-NUL cases, and zero failures; all compatibility cases passed. After the minimal fix, the controller's native GREEN run passed 20 tests and 103 assertions with no errors or failures. Existing parser tests passed 11 tests/22 assertions and the isolated SQLite-backed service tests passed 25 tests/44 assertions; these use synthetic scratch files, not a clinical database. In a normal populated clone, run:

```sh
php vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/Services/HolidayCsvInputSafetyTest.php
```

The controller's external-only dependency loader is local verification support, not product tooling. Tests use synthetic data. This parser-level result does not establish authenticated UI or database acceptance, or acceptance of the full original calendar requirements for booking blocks (#12), conflict handling (#14), and related behavior. Deployment and merge have not occurred; ordinary approval and complete CI remain.
