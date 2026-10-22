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

The selected stop is explicitly cast to string when deriving its month. A
null end still produces an empty result for `REPEAT_ON`, without a `substr()`
deprecation; it does not create an indefinite series.

The isolated test extracts the actual `calculateEvents`, `pcGetTopicName`, and
`checkEvent` function bodies from their source files and evaluates them in a
test namespace. Its namespace-local `postcalendar_getDate()` supplies the view
date. This exercises the shipped calculation and `Date_Calc` without executing
the top-level PHP application bootstrap or connecting to a database. Source
evaluation does **not** give original production file statement coverage;
real source-file coverage and native integration remain separate gates.

Controller RED, before the production change: 8 tests, 55 assertions, 5
failures. Evidence: `/Users/craig/.hermes/projects/openemr/verification/recurrence-year-boundary-20261022/RED.log`.
An earlier 10-test, 73-assertion GREEN is historical. The subsequent genuine
review RED was 14 tests, 114 assertions, 1 error from `substr(null, ...)`
deprecation and 1 failure from the added start guard. After the narrow
correction, focused PHPUnit passed: **14 tests, 116 assertions**, using the
sibling binary and autoloader with `--do-not-cache-result`,
`--no-configuration`, and the explicit sibling bootstrap.

This fixes finite recurrence in the calendar grid only. `fetchEvents()` and
MedEx recurrence paths need separate work. It does not enable indefinite or
null-ended recurrence; OPEMR-68 scope remains blocked. Native integration and
real production file statement coverage are pending. This focused result does
not establish all CI, clinical, or feature-13 readiness.
