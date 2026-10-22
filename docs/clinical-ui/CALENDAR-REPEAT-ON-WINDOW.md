# Finite REPEAT_ON occurrences in the calendar grid

`calculateEvents()` receives an array of displayed days. A month view can include
December days in a January grid or January days in a December grid. The finite
`REPEAT_ON` branch previously caught up and expanded only through the selected
view year from `postcalendar_getDate()`. That omitted valid occurrences in the
adjacent year even when those dates were requested in `$days`.

The branch now catches up to the first displayed calendar month and expands
through the month containing its existing clamped stop date. The stop remains
the earlier of the finite series end and the view's last date. The month loop
advances using the existing `mktime()` step, so its frequency phase and the
historical day overflow of series without `rt2_pf_flag` remain intact. A
nonadvancing step ends the loop. Each candidate still has to be a requested
day, on or before the finite stop, and outside the exception dates. The
existing within-month behavior can place a `REPEAT_ON` occurrence before
`eventDate` when the series starts after its selected weekday. This is a
legacy anomaly retained by this narrow fix, not an endorsement of that start
date behavior. The new start guard was removed after review because it
changed this behavior. Event payloads and the other recurrence branches are
unchanged.

The selected stop is checked as a string when deriving its month. A null end
still produces an empty result for `REPEAT_ON`, without a `substr()`
deprecation; it does not create an indefinite series.

The isolated test includes the shipped `pnAPI.php`, `pnMod.php`, and
`pnuserapi.php` in a separate CLI process. The fixture checks the source and
installs a real `Database` wrapper containing a PHPUnit `Connection` mock in
the private singleton before the legacy includes run. The two module lookups
make exactly one mocked `fetchOne` and one mocked `fetchNumeric` call; every
other configured I/O method fails. All 21 `common.api.php` settings are
prefilled in `pnmodvar`, and the real `pnVarCleanFromInput` reads fixed `Date`
and jump globals. This exercises the real legacy config helpers with no live
database connection or transport. The fixture also requires Reflection
provenance for those helpers and `calculateEvents` from this checkout, uses an
in-memory session, and requires Composer's real `xl()`. The local command
below uses the sibling workbench Composer autoloader, which loads `xl()` from
the sibling `library/translation.inc.php`.

Controller RED, before the production change: 8 tests, 55 assertions, 5
failures. Evidence: `/Users/craig/.hermes/projects/openemr/verification/recurrence-year-boundary-20261022/RED.log`.
Earlier eval-based and five-stub test results are historical and superseded
by this native-source test. The review RED exposed a `substr(null, ...)`
deprecation and a regression from a start guard; both were corrected before
this fixture update. The current native run on October 22, 2026 passed:
**14 tests, 2,050 assertions** (PHPUnit 11.5.56, PHP 8.5.11):

```sh
/Users/craig/.hermes/workspaces/openemr-workbench-shell/vendor/bin/phpunit --do-not-cache-result --no-configuration --bootstrap /Users/craig/.hermes/workspaces/openemr-workbench-shell/vendor/autoload.php tests/Tests/Isolated/Common/Calendar/RepeatOnWindowTest.php
```

This fixes finite recurrence in the calendar grid only. `fetchEvents()` and
MedEx recurrence paths need separate work. It does not enable indefinite or
null-ended recurrence; OPEMR-68 scope remains blocked. Hosted CI is pending.
Real production file statement coverage remains unverified until a coverage
report is produced. This focused result does not establish all CI, clinical,
or feature-13 readiness.
