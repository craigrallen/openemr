# Telehealth session activity clock (OPEMR-78 phase 2)

## Scope and source path

`TeleHealthSessionRepository::updateLastSeenTimestamp()` writes the role-specific `*_last_update` column with database `NOW()`. `TeleHealthSessionRepository::getSessionByAppointmentId()` reads the session row. In `TeleconferenceRoomController::patientAppointmentReadyAction()`, a nonempty `provider_last_update` is passed to `CalendarUtils::isTelehealthSessionInActiveTimeRange()`; a true result sets `session.providerReady`. `CalendarUtils::isUserLastSeenTimeInActiveRange()` applies the existing strict `now < last seen + 15 seconds` rule. This slice changes only the two activity helpers in `CalendarUtils.php` and their isolated test contract. The appointment two-hour safe-range helper, repository queries, controller and callers retain their existing behavior.

The helper now requires a string in exact local database timestamp form `Y-m-d H:i:s`. Missing or nonstring values, NUL bytes, width or trailing-byte mismatches, year 0000, and impossible calendar or clock values return `false` before the activity logger call. The parser is checked for warnings and errors, and the parsed value must format back to the identical input. Year 0000 is explicitly rejected as a non-Gregorian database date even if PHP can represent it. The expiry helper clones its mutable `DateTime` input before adding 15 seconds. Both helpers accept an optional `DateTimeImmutable` clock for deterministic tests; normal callers use the current server clock. The existing debug message and context keys remain unchanged for valid values.

The expiry boundary is strict: exactly 15 seconds old is inactive, including microsecond precision. A timestamp in the future still passes this comparison. This slice does not introduce a clock-skew ceiling or change the server-local timezone interpretation of the database value. Ambiguous and nonexistent local times around DST transitions require a separate policy and evidence; format roundtrip alone does not settle them.

## Evidence and remaining gates

The controller observed genuine local RED against unchanged production before the tests-only commit `05737afa`: 39 tests, 16 errors, 19 failures, 62 assertions, plus a missing-key warning and a coercion deprecation. A year 0000 case was added during implementation; it has no separately controller-observed RED. This document records no hosted RED. Controller GREEN and independent static review are recorded below; hosted full gates and ordinary approval remain pending.

The isolated tests cover malformed and nonstring session values, valid/stale/future and microsecond boundaries, server-local timezone examples, and repeated calls without mutating the supplied `DateTime`. They do not establish authentication or authorization behavior in `patientAppointmentReadyAction()`, controller integration, native browser behavior, live provider operation, database timezone alignment, or a DST ambiguity policy. Those require separate controller-owned validation and appropriate live-service gates.

The original 22-feature map remains [ACCEPTANCE.md](ACCEPTANCE.md). This helper hardening does not accept feature 10, “Offer video consultations from calendar bookings,” or any other row. Feature 10 still requires its booking-to-join end-to-end evidence and a real provider contract for live calls. The other programme obligations, including feature 11's record and note use during a call, booking and calendar work, messaging, payment, AI, and authority-valid certificate/signature workflows, remain open under that register and [PLAN.md](PLAN.md). No live integration, clinical acceptance, deployment, or production activation is claimed here.
> **OPEMR-78 evidence update (2026-10-21):** This note supersedes any earlier
> reference below to a pending controller GREEN. The controller suite was
> observed GREEN: **40 tests, 115 assertions**. The existing
> `TelehealthConfigurationContractsTest` was also GREEN: **10 tests,
> 78 assertions**. PHP syntax checks passed, and rooted PHPCS passed for the
> two checked files. Initial PHPCS setup failures were resolved with a
> runtime-only `installed_paths` setting; no dependency, configuration, or
> gate was changed. The local test run used a sibling vendor bootstrap.
>
> The earlier RED observation was **39 tests, 16 errors, 19 failures** before
> production changes. A year-zero extra case was authored during the
> production phase and was **not** separately observed in the controller RED
> run. Independent Gemini static review completed seven artifacts and found
> no introduced P1/P2/P3 issues; that review is neither runtime nor clinical
> acceptance. Focused supplementary PHPStan level 10 used sibling version
> 2.2.13, while the lock requires 2.2.16. It identified two related new
> test-only diagnostics on the invalid-session test parameter and its call;
> `@param array<string, mixed>` now declares that parameter's key and value
> types. Its initial placement after the PHPUnit attribute was not recognized;
> the controller moved it before the attribute. Supplementary focused PHPStan
> then completed with no errors. No behavioral assertions or production code
> changed during that follow-up.
>
> Hosted full and static checks and ordinary approval remain pending. The
> optional clock seams preserve existing callers and future acceptance
> policy. All feature 10 E2E, live, DST, and authorization gates remain open.
>
> Initial hosted checks on `1667fc5a` found the PHPStan annotation, Rector
> prefix check, and extra EOF blank-line failures. These were repaired locally;
> hosted retry and new-head gates remain pending.
