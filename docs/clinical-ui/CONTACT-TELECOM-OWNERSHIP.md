# Contact telecom ownership boundary (OPEMR-129)

`ContactTelecomService::saveTelecomsForContact()` accepts batches of form actions for one contact. A supplied `contact_telecom_id` used to select a telecom without checking that it belonged to the requested contact. `UPDATE` and `ADD` with an ID could then replace its fields and `contact_id`; `INACTIVATE` and `DELETE` could deactivate it. The service now loads each supplied ID once and skips that item unless its native `ContactTelecom::getContact()->get_id()` equals the requested contact ID. The warning contains only the batch index. Processing continues with later items.

## Native call chain and compatibility

- The service constructs `Contact($contactId)` before the batch and checks its ID; that preexisting check also relies on a constructor-supplied ID and is outside this change. `new ContactTelecom($suppliedId)` calls `ORDataObject::populate()`, which reads `contact_telecom` by ID and populates its fields. It leaves the constructor's supplied ID in place when the row is absent, so `get_id()` alone does not prove existence.
- `ContactTelecom::get_contact_id(): int` cannot safely read a missing row: its unpopulated `contact_id` is null and the declared return type raises a `TypeError`. `getContact()` constructs a native `Contact` from that owner value; `Contact::get_id(): ?int` returns null or zero for an absent owner value and converts a populated numeric string to an integer. Matching it to `$contactId` rejects a foreign, missing, or unowned supplied telecom before `deactivate()`, setters, or `persist()`.
- The owner check may perform an additional `contact` read and cache the loaded `Contact` on the telecom. For a valid owner this cached object is reused by native persistence. An absent owner value does not trigger a contact row lookup.
- `ADD` without an ID still uses a new native telecom and persists with a generated ID. Every action with a same-owner ID retains its previous mutation and persistence path. Non-`ADD` actions without an ID and actions without `data_action` retain their existing skip behavior. A nonexistent supplied ID is intentionally skipped instead of being treated as a new telecom or persisted under that ID.

The check is scoped to `saveTelecomsForContact()`. Other public service methods are outside this change.

## Regression evidence and verification

The tests-only commit `594c6447a6929a0d407e46953f037e5deb9285b8` preceded the production edit. The real pre-fix run in `/Users/craig/.hermes/projects/openemr/verification/contact-telecom-ownership-20261024/RED-native-actual.log` reported **17 tests, 165 assertions, 9 failures, 0 errors**. Earlier loader and Mockery failures were harness setup failures, not RED evidence. The subsequent `GREEN.log` reported **17 tests, 195 assertions, zero issues**. These results precede the additional unowned-row cases in this review fix. The test uses the native service, `ContactTelecom`, `Contact`, and `ORDataObject`; only database boundary calls are substituted. SQL is recorded against synthetic rows, with no live database or endpoint. The controller owns the new RED run against the original service and final acceptance gates.

With project dependencies available in a normal checkout, run:

```sh
vendor/bin/phpunit --configuration phpunit-isolated.xml --do-not-cache-result tests/Tests/Isolated/Services/ContactTelecomOwnershipTest.php
```

For this workspace's external dependency loader, the controller can run from the workspace root:

```sh
php -r 'define("PHPUNIT_COMPOSER_INSTALL", "/Users/craig/.hermes/projects/openemr/verification/contact-telecom-ownership-20261024/native-bootstrap.php"); require PHPUNIT_COMPOSER_INSTALL; exit((new PHPUnit\TextUI\Application)->run($_SERVER["argv"]));' -- --bootstrap /Users/craig/.hermes/projects/openemr/verification/contact-telecom-ownership-20261024/native-bootstrap.php --configuration phpunit-isolated.xml --do-not-cache-result tests/Tests/Isolated/Services/ContactTelecomOwnershipTest.php
```

These source and synthetic SQL checks support the ownership guard; they do not establish an exploitable route, complete `22` coverage, UI behavior, or security acceptance. Batch saves remain partial: earlier successful items stay saved if a later item is skipped or persistence fails. The read then write is not atomic; a concurrent owner change between the check and persist remains a race without a database constraint or transaction.
