# Appointment confirmation recording foundation (OPEMR-37)

This is a partial foundation for the original 19 booking confirmation work: a synthetic, in-memory rehearsal of eligibility decisions. It is not functional booking confirmation, and the application does not invoke it as a real production dry-run. Nothing here sends a message, writes to a database, creates an audit event, or connects to a transport. In particular, `recorded` means only that this recorder instance added a metadata receipt; it never means sent or delivered.

## Public API

`OpenEMR\Services\AppointmentConfirmationRecorder` is final and has no constructor arguments. `record(array $requestedBooking, array $currentBooking, array $patient, string $requestedChannel): array` returns exactly `['sms' => reason, 'email' => reason]`. The only channel selections are `sms`, `email`, and `both`; any other selection returns `not_requested` for both channels. An unrequested channel stays `not_requested`, with no fallback.

The possible reasons are:

| Reason | Meaning |
| --- | --- |
| `not_requested` | This channel was not selected, or the selection was unknown. |
| `invalid_booking` | A requested or current booking snapshot is invalid, they disagree, or the patient ID is not bound to them. |
| `consent_required` | The channel's patient consent field is not the exact string `YES`. |
| `invalid_contact` | The channel's designated patient contact field is absent or invalid. |
| `duplicate` | The same eligible metadata tuple was already recorded by this instance. |
| `recorded` | An eligible metadata receipt was appended in memory; no delivery occurred. |

For `both`, SMS and email consent and contact decisions are independent. Booking validation precedes both. Suppression, consent, and contact are checked before duplicate detection, including on a repeat call. Rejected attempts do not reserve a deduplication key.

`getRecords(): array` returns an ordered list by value. Each receipt has only `booking_id`, `patient_id`, `event_date`, `start_time`, and `channel` (`sms` or `email`). IDs are canonical decimal strings. Records contain no phone number, email address, message body, or delivery status. Dedupe uses this exact five-field tuple and is local to one recorder instance. There is no persistence, concurrent coordination, or durable/exactly-once claim.

## Input limits

Both booking snapshots must independently contain `pc_eid`, `pc_pid`, `pc_eventDate`, `pc_startTime`, `pc_recurrtype`, `pc_multiple`, and `pc_apptstatus`. IDs must be positive integers or canonical positive decimal strings without leading zeroes; large canonical strings stay strings. Dates must be real Gregorian dates in exact `YYYY-MM-DD` form with years `0001` through `9999`. Times must be exact 24-hour `HH:MM:SS`. Recurrence and multiple flags must each be integer `0` or string `'0'`. Status must be exactly `'-'` in each snapshot. This conservative rehearsal covers only that nonrecurring, single-booking status and does not assign meanings to customized or unknown statuses. The snapshots must agree on booking ID, patient ID, date, and time, and `patient['pid']` must match that patient ID.

SMS requires `patient['hipaa_allowsms'] === 'YES'` and `patient['phone_cell']` in exact E.164 form: `+`, then 2 to 15 digits, beginning with 1 through 9. Email requires `patient['hipaa_allowemail'] === 'YES'` and a single ASCII email address of at most 254 bytes, with no whitespace or control characters and accepted by `FILTER_VALIDATE_EMAIL`. Values are not trimmed or normalized. There is no fallback to a home or portal phone or alternate email.

`$currentBooking` and `$patient` are caller assertions, not authoritative reads. This class does not establish booking or patient identity authority, access control, a fresh consent read, or protection against races. In-memory booking and patient IDs, dates, and times remain sensitive when used with real patients. Callers must use synthetic data only; this class adds no logger, audit trail, or storage for that metadata.

## Existing code and remaining work

Existing reminder and notification paths are not confirmation evidence. `AppointmentSetEvent::givenAppointmentData` contains POST data. `rc_sms_notification_helpers.php` provides thin SQL and formatting primitives; `AppointmentNotificationRunner` owns the reminder scan-and-send pipeline and its occurrence-aware deduplication. That reminder deduplication is not booking confirmation idempotency. `PatientPortalService` handles document notification. A MedEx `NO` check is not affirmative confirmation consent. This foundation changes no transport, listener, or reminder code.

Gated work remains: DB-backed current booking and consent reads with identity authority; role and CSRF checks and read audit; content, locale, timezone, and real future-occurrence eligibility; cancellation and reschedule race handling; recurrence; durable transactional idempotency; a protected UI; and explicit approval for sandbox delivery. No pending gate is dropped. This change is not a merge or deployment.
