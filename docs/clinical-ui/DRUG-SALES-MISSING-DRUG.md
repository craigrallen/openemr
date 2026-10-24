# OPEMR-131: missing drug row during sale

## Reason for the guard

`DrugSalesService::sellDrug()` previously indexed the first result of its bound `drugs` lookup without checking whether a row existed. For a missing drug, PHP warned about the absent index and null offsets. The null `dispensable` value then entered the valid non-dispensable branch: an inventory check could return `true`, and a real sale could reach UUID creation and a sale insert. A missing row must stop before either branch. The guard retains the same product query and bind, checks for the exact empty list returned by `QueryUtils::fetchRecords()`, and returns `false` for `testonly` or `0` for a real sale. These match the existing insufficient-stock return conventions. An existing row with `dispensable = 0` still follows the non-dispensable path.

The guard runs at the product lookup. Existing session, patient, user, encounter, and default-warehouse work still precedes it. SQL lookup exceptions still propagate. Inventory selection, warehouse binding and order, UUID generation, sale persistence, and email handling for existing products are unchanged.

## Source callers and test boundary

The global `sellDrug()` wrapper in `interface/drugs/drugs.inc.php` delegates to the service. Source call sites include `interface/drugs/dispense_drug.php`, `library/FeeSheet.class.php`, `library/FeeSheetHtml.class.php`, and `library/ajax/code_attributes_ajax.php`. `controllers/C_Prescription.class.php` calls the service directly. The Fee Sheet, HTML, and AJAX paths use `testonly` inventory checks; dispensing, prescription, and Fee Sheet paths also make real sales. In `library/FeeSheet.class.php`, the insufficient-inventory message path still reads `$drow['name']` after a separate product lookup without guarding a missing row. Thus this service guard does not make the entire Fee Sheet flow graceful or atomic. This is a source inspection of callers, not a UI or clinical workflow result.

`tests/Tests/Isolated/Services/DrugSalesMissingDrugTest.php` uses the real service, `QueryUtils`, `UuidRegistry`, and session path with a recording ADODB transport. The transport supplies rows and rejects unexpected SQL, so this suite performs no live database I/O. The warning recorder accepts both PHP 8.5's “on null” and the earlier “on value of type null” wording to characterize the failure; the final assertions require no warnings.

The historical tests-only RED on commit `8edc6731` was 10 tests, 131 assertions, 2 failures, and 0 errors. The failures were a missing-drug inventory check returning `true` and a missing-drug real sale reaching an unexpected native UUID registry query. Eight existing-drug, encounter, stock, and product-SQL-error cases passed. After the guard, the controller reported GREEN with 10 tests, 137 assertions, and zero issues. It also reported PHP 8.5 syntax checks for both PHP files and a passing diff check. Those results precede this review correction; no PHP or tests were run during this correction. The portable project command is:

```sh
vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/Services/DrugSalesMissingDrugTest.php
```

These tests provide bounded supporting billing and medication behavior preservation, not original 18 or all 22 acceptance requirements, UI, security, or clinical acceptance. A row disappearing after lookup, actual persistence, authorization roles, ACL, CSRF, broader session behavior, and downstream workflows remain open. This change gives no merge approval.
