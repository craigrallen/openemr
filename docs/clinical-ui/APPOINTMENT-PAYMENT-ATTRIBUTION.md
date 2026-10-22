# Appointment payment attribution policy (OPEMR-36)

This is a partial feature: a pure arithmetic and link-evidence policy for a future trusted caller. It does not complete booking-payment linkage, a UI, or financial reconciliation. No caller is activated and there is no live database evidence. The current schema has no authoritative booking-payment allocation. The allocation records below describe required input evidence; this document does not claim they are a persisted table or current schema.

## Contract

`OpenEMR\Services\AppointmentPaymentAttribution::assess($booking, $allocations, $arActivity, $currencyContext)` returns exactly `status`, `amount`, and `currency`. `attributed` means only that the supplied evidence passed this policy and its allocated payment rows sum to the returned net amount. It does not mean the service verified persistence, booking ownership, completeness, financial accuracy, or current database state. On any unsupported or invalid evidence, it returns `['status' => 'unavailable', 'amount' => null, 'currency' => null]`; absence of an allocation never becomes a guessed zero.

Synthetic example with one payment and one refund:

```php
$booking = ['pc_eid' => '101', 'pc_pid' => '7', 'pc_gid' => 0, 'pc_multiple' => 0, 'pc_recurrtype' => 0];
$allocations = [
    ['booking_id' => '101', 'pid' => '7', 'encounter' => '501', 'sequence_no' => '1'],
    ['booking_id' => '101', 'pid' => '7', 'encounter' => '502', 'sequence_no' => '2'],
];
$arActivity = [
    ['pid' => '7', 'encounter' => '501', 'sequence_no' => '1', 'pay_amount' => '12.00', 'deleted' => null],
    ['pid' => '7', 'encounter' => '502', 'sequence_no' => '2', 'pay_amount' => '-3.05', 'deleted' => null],
];
$currencyContext = ['code' => 'EUR', 'decimal_places' => 2];

// assess(...) => ['status' => 'attributed', 'amount' => '8.95', 'currency' => 'EUR']
```

The booking must have canonical positive `pc_eid` and `pc_pid`, and `pc_gid`, `pc_multiple`, and `pc_recurrtype` must each be integer `0` or string `'0'`. Group, nonpatient, multiple, and recurring bookings are unsupported. IDs in booking, allocations, and ledger identity must be positive integers or canonical positive decimal strings within `PHP_INT_MAX`; booleans, floats, leading zeroes, whitespace, newlines, signs, and overflow fail closed. Each allocation must contain exactly `booking_id`, `pid`, `encounter`, and `sequence_no`. It claims an entire ledger row, never a split, percentage, or partial amount. Every allocation must identify the supplied booking and patient, and no two allocations may identify the same row.

Each supplied `ar_activity` record requires `pid`, `encounter`, `sequence_no`, `pay_amount`, and `deleted`; other real ledger columns are allowed. The row identity is the exact `(pid, encounter, sequence_no)` composite. Duplicate identities fail closed even if amounts agree. A referenced row must exist and have explicit `deleted === null`. An unreferenced valid row, including a voided row, contributes nothing. Every supplied row must have a canonical `pay_amount` string with exactly two fractional digits and at most ten integral digits; refunds use a leading minus sign, while `-0.00` is invalid. Positive and negative input magnitude cannot exceed `9999999999.99`. The net result may be negative or `0.00`, but its final magnitude must also fit decimal(12,2). A temporary running total may exceed that limit before a later refund offsets it.

The currency context requires an explicitly supplied uppercase three-letter `code` and integer `decimal_places === 2`. This is a syntax check, not authoritative currency validation, exchange conversion, or a default currency. The returned amount is the net of allocated ledger payment rows; it is not necessarily patient-only payment, copay, booking fee, or batch/session total.

Arithmetic uses integer minor units, no floats or `bcmath`. The policy requires a 64-bit PHP platform and at most 10,000 allocation rows and 10,000 ledger rows. `10,000 × 999,999,999,999` minor units fits within signed 64-bit range, so addition cannot overflow even if every allocated amount has the same sign. Inputs beyond either row cap return `unavailable` before row processing. The final decimal(12,2) bound is checked after all allocated rows have been added, making the result independent of row order.

## Trusted caller requirements before activation

A future caller must establish the authoritative current booking snapshot and its existence; persisted allocation ownership, completeness, and uniqueness across bookings; and exact current `ar_activity` rows, including void state. It must supply a verified actual two-decimal currency context, enforce authorized financial visibility and role ACL, record the appropriate read audit, and handle transactions and races when bookings, allocations, or payments are reassigned or voided. The pure policy cannot establish any of those guarantees from arrays alone.

Do not infer allocation from `patient_tracker`, shared encounter or date, a receipt, or `ar_session.pay_total`. Those sources do not establish which whole payment rows belong to this booking.

## TDD evidence and remaining acceptance

The isolated contract test `tests/Tests/Isolated/Services/AppointmentPaymentAttributionTest.php` covers multiple payments and refunds, zero versus missing allocation, separate bookings in one encounter, exact composite identity, missing `pay_amount`/`deleted` fields, voided and duplicate rows, reassignment, strict allocation shape, booking flags, canonical IDs through `PHP_INT_MAX` and rejection above it, malformed records and negative zero, extra ledger columns, decimal limits and cancellation order, and explicit currency. It also specifies that 10,000 unique allocations paired with 10,000 valid rows yield `100.00` from one-cent amounts, while 10,001 valid ledger rows with one referenced allocation yield `unavailable`. A case with 10,001 unique allocations and 10,001 matching valid rows also expects `unavailable`; because both caps are exceeded, that case does not isolate the allocation-count guard. For unique whole-row allocations, exceeding 10,000 allocations requires exceeding 10,000 matching rows, so the allocation guard has no independent valid-evidence boundary case.

The controller recorded a genuine hosted tests-only RED run (`39105656677`, commit `99e82231`) in which PHP 8.3, 8.4, and 8.5 failed; the actual PHP 8.5 JUnit report had 25 expected class-not-found errors and no other isolated failures. These new cases are source-level contract additions only: no tests, dependency commands, or application bootstrap were run for this edit. The controller owns subsequent hosted isolated tests, PHPStan, style, and all-CI checks.

Residual acceptance requires a real persisted allocation design and an authorized caller that proves the prerequisites above, plus controller-run validation. Until then, `attributed` is only a conditional calculation on caller-supplied evidence. A caller that supplies stale, incomplete, forged, or cross-booking evidence can make the result misleading despite this policy's internal checks.
