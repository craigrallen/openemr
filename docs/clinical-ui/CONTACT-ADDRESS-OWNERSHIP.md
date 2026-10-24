# Contact address ownership (OPEMR-134)

`ContactAddressService::saveAddressesForContact()` checks every nonempty supplied
`contact_address_id` against the target contact before constructing `ContactAddress`
or loading its nested `Address`. A parameter-bound association-row query rejects a
missing row, foreign owner, null owner, or zero owner for `INACTIVATE`, `DELETE`,
`UPDATE`, and `ADD`. It accepts the target owner returned as an integer or decimal
string. Rejected rows log an error and are skipped; later rows still run. This avoids
the model's retained requested ID on a missing row and its nullable owner getter.
It also leaves `ContactAddress::persist()` to load `Contact` after nested `Address`
persistence, as in the original valid-row flow. A new `ADD` without an ID and
same-owner actions keep native object persistence. Empty actions and non-`ADD`
actions without an ID remain skipped.

The source consumers in scope are demographics save, new patient comprehensive
save, and `ContactRelationService`. This service guard does not add controller or
SQL policy. It is a read-then-write check, so concurrent reassignment can race it;
mixed batches are not atomic. Shared `Address` ownership and concurrent updates
are outside this change. The separate `Contact` constructor can also retain an
unknown requested ID; that behavior is untouched.

The isolated suite uses a synthetic SQL/escape boundary while exercising native
`ContactAddress`, `Contact`, and `Address` objects and their persistence. It checks
rejection before nested loads or writes, same-owner metadata and address-link
preservation, intended field changes, mixed-batch continuation, string database IDs,
and Contact loading after the nested Address write. Global `get_db()` and
`escape_table_name()` remain native for diagnostic coverage. The synthetic boundary
does not establish escaping or full security acceptance.

The controller's initial genuine RED run on the tests-only commit `ed4c122a`
reported **22 tests, 472 assertions, 16 ownership failures**, with one existing
`ContactAddress::$use` dynamic-property deprecation. After the first service guard,
the earlier 22-test suite passed 358 assertions but exited 1 with that same
deprecation. The expanded suite's recorded RED run before this correction reported
**26 tests, 565 assertions, one specific stale-Contact failure, one unchanged
deprecation** (`RED-cache.log`). A post-correction GREEN run is pending. The
repository-configured command is:

```bash
vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/Services/ContactAddressOwnershipTest.php
```

The 26-test isolated suite is distinct from the original 22-feature programme.
Controller verification and final review remain pending. The existing deprecation
causes exit 1 under `failOnDeprecation`; a passing assertion count alone is not a
green gate. These runs establish no authenticated exploit, UI or clinical acceptance.
