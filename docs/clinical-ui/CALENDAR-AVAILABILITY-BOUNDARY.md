# Calendar availability boundary: OPEMR-99 production phase

## Change and rationale

`library/appointments.inc.php` now reads the configured slot size once at the start of `getAvailableSlots()`. The early guard returns `[]` before event fetching when that cached value is neither an integer nor a float, or is zero or negative. This narrows the mixed value locally before the numeric comparison and slot arithmetic, while accepting both integer and fractional results from `getSlotSize()` without a cast. It avoids a nonterminating or backward stepping slot loop. Each reported slot must satisfy `slot start + slot size <= next event boundary`; an exact fit remains available. The cached size also advances the loop. This replaces the prior half slot threshold, which reported starts whose full intervals overlapped lunch or an appointment.

The returned row still comes from `createAvailableSlot()`, including `pc_endTime` equal to `pc_startTime`. That zero duration reported marker is not an appointment duration guarantee. The new `@return int|float` annotation on `getSlotSize()` was removed to restore its original function source and leave the owned return baseline untouched; its arithmetic body was not changed. Event categories, provider and facility SQL filters, event filtering, recurrence, editor, portal, reports, and storage were not changed. This guard does not normalize malformed nonnumeric interval configuration: `getSlotSize()` evaluates its multiplication before the guard and can still throw on bad configuration.

## Evidence

- Controller recorded genuine RED against unchanged native production source in `RED-native.log`: **17 tests, 206 assertions, 8 failures**. Six failures concerned incomplete intervals at the next boundary; two concerned nonpositive intervals that must return before fetching.
- After the production change, the controller rooted launcher returned **OK: 17 tests, 226 assertions** in `GREEN.log`: `php /Users/craig/.hermes/projects/openemr/verification/availability-boundary-20261022/phpunit-rooted.php --no-configuration tests/Tests/Isolated/Common/Calendar/AvailableSlotsBoundaryTest.php`. The controller log contains no result cache warning; a separate agent run reported one.
- The controller rooted PHPCS check passed for the two changed PHP files with `--standard=phpcs.xml.dist --runtime-set installed_paths` pointing to the sibling vendor Slevomat coding standard. The controller native calendar suite passed **95 tests, 385 assertions** in `calendar-GREEN.log`. Hosted static review remains the authoritative static gate.
- `tests/Tests/Isolated/Common/Calendar/AvailableSlotsBoundaryTest.php` loads native `appointments.inc.php`, `sql.inc.php`, and `translation.inc.php` functions in isolated CLI processes. It substitutes an in-memory ADODB transport backed by mocked Doctrine DBAL connection and result objects. The dispatch mock covers the native appointment filter seam. Tests check expected SQL text and parameter bindings for dates, provider, and facility, as well as returned slot rows. These mocks validate forwarding and native function behavior; they do not prove database isolation or behavior against a real database.
- UTC cases cover partial, exact fit, aligned 15 and 30 minute slots, date and provider separation, and nonpositive sizes. Europe/Stockholm cases use **09:00** on spring and autumn transition dates. Those cases do not exercise ambiguous or nonexistent local DST times.

## Scope and residual gates

This is next boundary hardening for the report list produced by `getAvailableSlots()`. `portal/add_edit_event_user.php:83` calls that function only to ask whether **any** slot exists within a one year range; it does not atomically validate the selected start and appointment duration. `portal/find_appt_popup_user.php` computes slots with its own algorithm. This patch is not full feature 11 delivery or booking enforcement.

Tail behavior after an out of office event, nested or overlapping blocks, and office window constraints remain unverified or unresolved. Recurrence save concurrency also remains open. Authenticated clinician acceptance and clinical data integrity approval are still required gates.
