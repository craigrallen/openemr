# Dated reminder due date — OPEMR-140

Status: implementation run 1 of at most 2 consecutive scheduled implementation and QA runs. This limit counts runs, not test attempts. Controller GREEN, hosted gates, review, and clinical acceptance are pending. After run 2, schedule a different item rather than polling this item unchanged.

## Scope and behavior

This is a narrow fix in `sendReminder()` in `library/dated_reminder_functions.php`. The existing caller is `interface/main/dated_reminders/dated_reminders_add.php`: it converts the posted local date with `DateToYYYYMMDD()` and then calls `sendReminder()` for either the selected recipient batch or individual recipients. That caller's conversion is separate from this function's guard; it may normalize an invalid user-entered date before this function sees it. This change therefore does not establish that every invalid UI date is rejected.

The reproduced defect was an unanchored digit-pattern match in `sendReminder()`. It let calendar-impossible dates such as `2024-02-30` and strings containing a date-shaped substring pass into the native recipient lookup. The guard now requires the entire cast-to-string value to match ASCII `YYYY-MM-DD` with `\A` and `\z` anchors, then calls `checkdate()` on the captured month, day, and year. `\z` rejects a trailing newline. The existing string cast remains, preserving its stringable and numeric fallback behavior and diagnostics. The function neither normalizes dates nor restricts dates by timezone or future/past position.

Invalid dates return before recipient SQL execution. Accepted dates continue to the unchanged native recipient lookup and its existing bind and batch rules. The synthetic tests return a no-recipient result there, so they do not exercise the insert or link writes. Acceptance of `0001-01-01` or any other date by this guard does not establish database range or persistence acceptance. Sender, message, priority, patient values, the insert/link body, and caller localization are unchanged. Duplicate-recipient policy, transactions, authorization, priority bounds, and writer atomicity are outside this fix.

## Evidence and remaining gates

The tests-only commit `6f87ae9c` established genuine native RED: 36 tests, 147 assertions, 18 failures, all from unexpected actual `ADOConnection::Execute` calls for invalid dates; there were no setup errors. The existing test is `tests/Tests/Isolated/PatientMessages/DatedReminderDueDateTest.php`. Its mocked terminal database checks that invalid dates stop before SQL and accepted dates reach the real lookup with expected binds and a no-recipient result. It does not prove native runtime persistence, an authenticated sender flow, or completion of all 22 clinical features.

Controller verification is pending. The targeted native command, using this project's vendor, is:

```sh
vendor/bin/phpunit -c phpunit-isolated.xml tests/Tests/Isolated/PatientMessages/DatedReminderDueDateTest.php
```

The controller's rooted external sibling dependency harness was disclosed as drifting from the target lock in ten packages, excluding PHPUnit and ADODB. Authoritative full gates are hosted and remain pending. This implementation phase did not run tests or PHP.

This change supports original feature 6, patient-linked internal notes/messages between medical staff, without changing its unaccepted status in `ACCEPTANCE.md`. Existing popup presentation and PHP, session, ACL, and CSRF behavior remain. The clinical parity, accessibility, static-check, hosted CI, independent review, and clinician approval gates in `PLAN.md`, `STATUS.md`, and `ACCEPTANCE.md` still apply. Swedish certificate signing/submission remains gated on the approved method, external onboarding, and clinical/legal approval; parked approvals stay parked. No clinical use or full-feature acceptance is claimed here.
