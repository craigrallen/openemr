# Patient tracker elapsed interval (OPEMR-125)

`PatientTrackerService::get_Tracker_Time_Interval()` formats elapsed seconds between two timestamps. The library function in `library/patient_tracker.inc.php` delegates directly to it. `interface/reports/patient_flow_board_report.php` is the source consumer: its live total-visit and status-duration calls use the default mode. A `true` seconds-mode call appears there only as a comment. This source trace does not establish authenticated report acceptance.

## Behavior and rationale

The method keeps its existing `strtotime((string) ...)` timestamp subtraction, so explicit offsets and daylight-saving transitions continue to use elapsed time. It emits nonzero days, hours, and minutes at inclusive 24-hour, 1-hour, and 1-minute thresholds. Seconds are emitted only when the optional seconds mode is enabled. Each unit after the first emitted unit receives `, `, including a unit after a day when no hour is present. The unit words remain the existing literal `xl('day')` / `xl('days')`, `xl('hour')` / `xl('hours')`, `xl('minute')` / `xl('minutes')`, and `xl('second')` / `xl('seconds')` tokens.

Default mode rounds the remaining seconds to minutes after removing whole days and hours. It deliberately does not carry a rounded 60 minutes into the next unit: 59m30s displays `60 minutes`, and 1h59m30s displays `1 hour, 60 minutes`. A zero rounded remainder is omitted, including the former trailing `0 minutes`. Equal or backward timestamps display an empty string in either mode.

Representative exact outputs in untranslated mode:

| Elapsed | Default | Seconds mode |
| --- | --- | --- |
| 1 second | empty string | `1 second` |
| 1 minute | `1 minute` | `1 minute` |
| 1 hour | `1 hour` | `1 hour` |
| 1 hour, 1 second | `1 hour` | `1 hour, 1 second` |
| 1 day | `1 day` | `1 day` |
| 1 day, 1 minute | `1 day, 1 minute` | `1 day, 1 minute` |
| 1 day, 1 hour | `1 day, 1 hour` | `1 day, 1 hour` |
| 1 hour, 59 minutes, 30 seconds | `1 hour, 60 minutes` | `1 hour, 59 minutes, 30 seconds` |

The inclusive thresholds, omitted zero units, and separators correct prior boundary and formatting defects. The existing rounding and non-normalized remainder are compatibility behavior.

## Verification and outstanding acceptance

The controller recorded a native RED run against the unchanged service: **31 tests, 51 assertions, 16 failures, 0 errors**. Its reported evidence is `verification/tracker-interval-20261024/RED.log` and XML. This production edit has no claimed GREEN result; the controller owns that run. The target command is:

```sh
vendor/bin/phpunit -c phpunit-isolated.xml --do-not-cache-result tests/Tests/Isolated/Services/PatientTrackerIntervalTest.php
```

The local default dependency loader is rooted outside this worktree under controller control; no dependency installation is part of this change. Existing PHPStan baseline suppressions include four `strlen(bool)` `argument.type` records that may become obsolete, and the `empty.notAllowed` count may decrease. The shared baseline files are owned by PR150 and PR151 respectively. Baseline coordination and hosted stability remain pending; this edit does not update or suppress baseline findings.

The source-only consumer trace and isolated interval tests are not authenticated clinical acceptance. Native report behavior, roles, translations, persistence, clinical acceptance, and ordinary approval remain outstanding. This work does not complete the original 14–17 scope or the research UI.
