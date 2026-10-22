<?php

/**
 * Contract tests for a future pure booking-payment attribution policy.
 *
 * The trusted caller must supply complete, authoritative, whole-ar_activity-row
 * allocations for the current booking. This pure policy does not establish
 * persistence, retrieval, database binding/completeness, or ACL guarantees.
 * Encounter/date lookup and ar_session.pay_total are not allocation evidence.
 *
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Services\AppointmentPaymentAttribution;
use PHPUnit\Framework\TestCase;

final class AppointmentPaymentAttributionTest extends TestCase
{
    /**
     * assess() returns only status, decimal amount, and currency. An attributed
     * amount is the net total of whole allocated payment rows, not necessarily
     * the amount paid by the patient. The trusted caller supplies a two-decimal
     * currency context; the service performs no conversion.
     */
    public function testMultiplePaymentsAndRefundAreSummedExactly(): void
    {
        $booking = self::booking();
        $allocations = [
            self::allocation('101', '7', '501', '1'),
            self::allocation('101', '7', '502', '2'),
            self::allocation('101', '7', '503', '3'),
        ];
        $rows = [
            self::activity('7', '501', '1', '10.10'),
            self::activity('7', '502', '2', '2.05'),
            self::activity('7', '503', '3', '-3.20'),
        ];
        $original = [$booking, $allocations, $rows];

        self::assertSame(
            self::attributed('8.95'),
            (new AppointmentPaymentAttribution())->assess($booking, $allocations, $rows, self::currency())
        );
        self::assertSame($original, [$booking, $allocations, $rows]);
    }

    public function testNetRefundMayBeNegative(): void
    {
        self::assertSame(
            self::attributed('-2.50'),
            $this->assess([self::allocation('101', '7', '501', '1')], [self::activity('7', '501', '1', '-2.50')])
        );
    }

    public function testLinkedZeroIsDifferentFromNoAllocation(): void
    {
        self::assertSame(
            self::attributed('0.00'),
            $this->assess([self::allocation('101', '7', '501', '1')], [self::activity('7', '501', '1', '0.00')])
        );
        self::assertSame(
            self::unavailable(),
            $this->assess([], [self::activity('7', '501', '1', '0.00')])
        );
    }

    public function testUnallocatedLedgerRowsDoNotContribute(): void
    {
        $rows = [
            self::activity('7', '501', '1', '12.00'),
            self::activity('7', '502', '1', '99.00'),
        ];

        self::assertSame(
            self::attributed('12.00'),
            $this->assess([self::allocation('101', '7', '501', '1')], $rows)
        );
    }

    public function testAdditionalLedgerColumnsAreAccepted(): void
    {
        $row = self::activity('7', '501', '1', '12.00');
        $row['account_code'] = 'PAY';
        $row['post_time'] = '2026-01-01 12:00:00';

        self::assertSame(
            self::attributed('12.00'),
            $this->assess([self::allocation('101', '7', '501', '1')], [$row])
        );
    }

    public function testDistinctBookingsInOneEncounterGetOnlyTheirOwnAllocatedRows(): void
    {
        $rows = [
            self::activity('7', '501', '1', '12.00'),
            self::activity('7', '501', '2', '19.00'),
        ];
        $service = new AppointmentPaymentAttribution();

        self::assertSame(
            self::attributed('12.00'),
            $service->assess(self::booking(), [self::allocation('101', '7', '501', '1')], $rows, self::currency())
        );
        self::assertSame(
            self::attributed('19.00'),
            $service->assess(self::booking('102'), [self::allocation('102', '7', '501', '2')], $rows, self::currency())
        );
    }

    public function testExactCompositeRowIdentityIsRequired(): void
    {
        $allocation = self::allocation('101', '7', '501', '1');
        foreach ([
            self::activity('8', '501', '1', '12.00'),
            self::activity('7', '502', '1', '12.00'),
            self::activity('7', '501', '2', '12.00'),
        ] as $wrongRow) {
            self::assertSame(self::unavailable(), $this->assess([$allocation], [$wrongRow]));
        }
    }

    public function testMissingReferencedRowInvalidatesAnOtherwiseValidTotal(): void
    {
        self::assertSame(
            self::unavailable(),
            $this->assess(
                [self::allocation('101', '7', '501', '1'), self::allocation('101', '7', '502', '2')],
                [self::activity('7', '501', '1', '12.00')]
            )
        );
    }

    public function testDeletedReferencedPaymentDoesNotContributeAnAmount(): void
    {
        $rows = [
            self::activity('7', '501', '1', '12.00'),
            self::activity('7', '502', '2', '90.00', '2026-01-01 12:00:00'),
        ];

        self::assertSame(
            self::unavailable(),
            $this->assess([
                self::allocation('101', '7', '501', '1'),
                self::allocation('101', '7', '502', '2'),
            ], $rows)
        );
    }

    public function testOnlyExplicitNullDeletedValueIsActive(): void
    {
        $allocation = [self::allocation('101', '7', '501', '1')];
        foreach (['', '0', 0, false, true] as $deleted) {
            $row = self::activity('7', '501', '1', '12.00');
            $row['deleted'] = $deleted;
            self::assertSame(self::unavailable(), $this->assess($allocation, [$row]));
        }
    }

    public function testUnreferencedDeletedRowCannotAlterAnAttributedTotal(): void
    {
        self::assertSame(
            self::attributed('12.00'),
            $this->assess(
                [self::allocation('101', '7', '501', '1')],
                [
                    self::activity('7', '501', '1', '12.00'),
                    self::activity('7', '502', '2', '90.00', '2026-01-01 12:00:00'),
                ]
            )
        );
    }

    public function testDuplicateAndConflictingAllocationsFailClosed(): void
    {
        $first = self::allocation('101', '7', '501', '1');
        $row = self::activity('7', '501', '1', '12.00');

        self::assertSame(self::unavailable(), $this->assess([$first, $first], [$row]));
        self::assertSame(
            self::unavailable(),
            $this->assess([$first, self::allocation('102', '7', '501', '1')], [$row])
        );
    }

    public function testDuplicateLedgerIdentityFailsClosedEvenWhenAmountsAgree(): void
    {
        $row = self::activity('7', '501', '1', '12.00');
        self::assertSame(
            self::unavailable(),
            $this->assess([self::allocation('101', '7', '501', '1')], [$row, $row])
        );
        self::assertSame(
            self::unavailable(),
            $this->assess(
                [self::allocation('101', '7', '501', '1')],
                [$row, self::activity('7', '501', '1', '99.00')]
            )
        );
    }

    public function testReassignedPatientAndWrongBookingFailClosed(): void
    {
        $row = self::activity('7', '501', '1', '12.00');
        foreach ([
            self::allocation('101', '8', '501', '1'),
            self::allocation('102', '7', '501', '1'),
        ] as $wrongAllocation) {
            self::assertSame(self::unavailable(), $this->assess([$wrongAllocation], [$row]));
        }
    }

    public function testAllocationCannotClaimOnlyPartOfALedgerRow(): void
    {
        foreach (['amount', 'allocated_amount', 'pay_amount', 'percentage'] as $field) {
            $partial = self::allocation('101', '7', '501', '1');
            $partial[$field] = $field === 'percentage' ? '50' : '1.00';
            self::assertSame(
                self::unavailable(),
                $this->assess([$partial], [self::activity('7', '501', '1', '12.00')]),
                $field
            );
        }
    }

    public function testGroupNonpatientMultipleAndRecurringBookingsAreUnsupported(): void
    {
        $allocation = [self::allocation('101', '7', '501', '1')];
        $rows = [self::activity('7', '501', '1', '12.00')];
        $group = self::booking();
        $group['pc_gid'] = 9;
        // pc_gid identifies a group; pc_multiple is separately unsupported ambiguity.
        $multiple = self::booking();
        $multiple['pc_multiple'] = 1;
        $recurring = self::booking();
        $recurring['pc_recurrtype'] = 1;

        self::assertSame(self::unavailable(), $this->assess($allocation, $rows, $group));
        self::assertSame(self::unavailable(), $this->assess($allocation, $rows, $multiple));
        self::assertSame(self::unavailable(), $this->assess($allocation, $rows, $recurring));
        $nonpatient = self::booking();
        $nonpatient['pc_pid'] = '0';
        self::assertSame(self::unavailable(), $this->assess($allocation, $rows, $nonpatient));
        self::assertSame(
            self::unavailable(),
            $this->assess([self::allocation('900', '7', '501', '1')], $rows)
        );
    }

    public function testMissingBookingFieldsFailClosed(): void
    {
        $allocation = [self::allocation('101', '7', '501', '1')];
        $rows = [self::activity('7', '501', '1', '12.00')];
        foreach (array_keys(self::booking()) as $field) {
            $missing = self::booking();
            unset($missing[$field]);
            self::assertSame(self::unavailable(), $this->assess($allocation, $rows, $missing), $field);
        }
    }

    public function testCanonicalIntegerAndStringIdsAreAccepted(): void
    {
        $booking = self::booking();
        $booking['pc_eid'] = 101;
        $booking['pc_pid'] = 7;
        $allocation = self::allocation('101', '7', '501', '1');
        $allocation['booking_id'] = 101;
        $allocation['pid'] = 7;
        $allocation['encounter'] = 501;
        $allocation['sequence_no'] = 1;
        $row = self::activity('7', '501', '1', '12.00');
        $row['pid'] = 7;
        $row['encounter'] = 501;
        $row['sequence_no'] = 1;
        self::assertSame(self::attributed('12.00'), $this->assess([$allocation], [$row], $booking));
        self::assertSame(self::attributed('12.00'), $this->assess(
            [self::allocation('101', '7', '501', '1')],
            [self::activity('7', '501', '1', '12.00')]
        ));
    }

    public function testCanonicalIdsAtTheSafeIntegerMaximumAreAccepted(): void
    {
        $maximum = (string) PHP_INT_MAX;
        $booking = self::booking();
        $booking['pc_eid'] = $maximum;
        $booking['pc_pid'] = $maximum;
        $allocation = self::allocation($maximum, $maximum, $maximum, $maximum);
        $row = self::activity($maximum, $maximum, $maximum, '12.00');

        self::assertSame(self::attributed('12.00'), $this->assess([$allocation], [$row], $booking));
    }

    public function testIdsAboveTheSafeIntegerMaximumFailClosed(): void
    {
        // Literal boundary avoids overflowing PHP integer arithmetic in the test.
        $aboveMaximum = '9223372036854775808';
        $allocation = self::allocation('101', '7', '501', '1');
        $row = self::activity('7', '501', '1', '12.00');

        foreach (['pc_eid', 'pc_pid'] as $field) {
            $booking = self::booking();
            $booking[$field] = $aboveMaximum;
            self::assertSame(self::unavailable(), $this->assess([$allocation], [$row], $booking), $field);
        }
        foreach (array_keys($allocation) as $field) {
            $invalidAllocation = $allocation;
            $invalidAllocation[$field] = $aboveMaximum;
            self::assertSame(self::unavailable(), $this->assess([$invalidAllocation], [$row]), $field);
        }
        foreach (['pid', 'encounter', 'sequence_no'] as $field) {
            $invalidRow = $row;
            $invalidRow[$field] = $aboveMaximum;
            self::assertSame(self::unavailable(), $this->assess([$allocation], [$invalidRow]), $field);
        }
    }

    public function testNoncanonicalIdsFailClosedInEveryIdentityField(): void
    {
        $baseAllocation = self::allocation('101', '7', '501', '1');
        $baseRow = self::activity('7', '501', '1', '12.00');
        foreach ([0, '0', '-1', ' 7', '7 ', "7\n", '07', '7e0', 7.0, true, false, null, str_repeat('9', 100)] as $badId) {
            foreach (['pc_eid', 'pc_pid'] as $field) {
                $booking = self::booking();
                $booking[$field] = $badId;
                self::assertSame(self::unavailable(), $this->assess([$baseAllocation], [$baseRow], $booking), $field);
            }
            foreach (array_keys($baseAllocation) as $field) {
                $allocation = $baseAllocation;
                $allocation[$field] = $badId;
                self::assertSame(self::unavailable(), $this->assess([$allocation], [$baseRow]), $field);
            }
            foreach (['pid', 'encounter', 'sequence_no'] as $field) {
                $row = $baseRow;
                $row[$field] = $badId;
                self::assertSame(self::unavailable(), $this->assess([$baseAllocation], [$row]), $field);
            }
        }
    }

    public function testMissingAllocationAndLedgerFieldsFailClosed(): void
    {
        $baseAllocation = self::allocation('101', '7', '501', '1');
        $baseRow = self::activity('7', '501', '1', '12.00');
        foreach (array_keys($baseAllocation) as $field) {
            $allocation = $baseAllocation;
            unset($allocation[$field]);
            self::assertSame(self::unavailable(), $this->assess([$allocation], [$baseRow]), $field);
        }
        foreach (array_keys($baseRow) as $field) {
            $row = $baseRow;
            unset($row[$field]);
            self::assertSame(self::unavailable(), $this->assess([$baseAllocation], [$row]), $field);
        }
    }

    public function testMalformedArrayRecordsFailClosed(): void
    {
        $allocation = self::allocation('101', '7', '501', '1');
        $row = self::activity('7', '501', '1', '12.00');
        foreach ([[], ['pid' => '7'], ['unexpected'], null, 'bad'] as $malformed) {
            self::assertSame(self::unavailable(), $this->assess([$malformed], [$row]));
            self::assertSame(self::unavailable(), $this->assess([$allocation], [$malformed]));
        }
    }

    public function testMissingAndInvalidBookingFlagsFailClosed(): void
    {
        $allocation = [self::allocation('101', '7', '501', '1')];
        $rows = [self::activity('7', '501', '1', '12.00')];
        foreach (['pc_gid', 'pc_multiple', 'pc_recurrtype'] as $field) {
            foreach ([null, false, true, '', '00', ' 0', "0\n", -1] as $badFlag) {
                $booking = self::booking();
                $booking[$field] = $badFlag;
                self::assertSame(self::unavailable(), $this->assess($allocation, $rows, $booking), $field);
            }
        }
        $booking = self::booking();
        $booking['pc_gid'] = '0';
        $booking['pc_multiple'] = '0';
        $booking['pc_recurrtype'] = '0';
        self::assertSame(self::attributed('12.00'), $this->assess($allocation, $rows, $booking));
    }

    public function testMalformedPaymentAmountsFailClosedWithoutPartialTotal(): void
    {
        $allocations = [
            self::allocation('101', '7', '501', '1'),
            self::allocation('101', '7', '502', '2'),
        ];
        foreach (['1', '1.2', '.20', '01.20', '+1.20', ' 1.20', '1.20 ', "1.20\n", '1e2', 'NaN', '-0.00', '10000000000.00', '-10000000000.00', 1.2, null] as $badAmount) {
            $row = self::activity('7', '502', '2', '2.00');
            $row['pay_amount'] = $badAmount;
            self::assertSame(
                self::unavailable(),
                $this->assess($allocations, [self::activity('7', '501', '1', '1.00'), $row])
            );
        }
    }

    public function testDecimalTwelveTwoBoundaryAndTotalOverflow(): void
    {
        self::assertSame(
            self::attributed('9999999999.99'),
            $this->assess(
                [self::allocation('101', '7', '501', '1')],
                [self::activity('7', '501', '1', '9999999999.99')]
            )
        );
        self::assertSame(
            self::unavailable(),
            $this->assess(
                [self::allocation('101', '7', '501', '1'), self::allocation('101', '7', '502', '2')],
                [self::activity('7', '501', '1', '9999999999.99'), self::activity('7', '502', '2', '0.01')]
            )
        );
        self::assertSame(
            self::unavailable(),
            $this->assess(
                [self::allocation('101', '7', '501', '1'), self::allocation('101', '7', '502', '2')],
                [self::activity('7', '501', '1', '-9999999999.99'), self::activity('7', '502', '2', '-0.01')]
            )
        );
    }

    /** The decimal(12,2) limit applies to the final net total in either row order. */
    public function testCancellationNearBoundaryDoesNotRejectAnIntermediateSum(): void
    {
        $allocations = [self::allocation('101', '7', '501', '1'), self::allocation('101', '7', '502', '2'), self::allocation('101', '7', '503', '3')];
        $rows = [
            self::activity('7', '501', '1', '9999999999.99'),
            self::activity('7', '502', '2', '0.01'),
            self::activity('7', '503', '3', '-0.01'),
        ];
        self::assertSame(self::attributed('9999999999.99'), $this->assess($allocations, $rows));
        self::assertSame(self::attributed('9999999999.99'), $this->assess(array_reverse($allocations), array_reverse($rows)));
        $negative = [
            self::activity('7', '501', '1', '-9999999999.99'),
            self::activity('7', '502', '2', '-0.01'),
            self::activity('7', '503', '3', '0.01'),
        ];
        self::assertSame(self::attributed('-9999999999.99'), $this->assess($allocations, $negative));
        self::assertSame(self::attributed('-9999999999.99'), $this->assess(array_reverse($allocations), array_reverse($negative)));
    }

    public function testTenThousandUniqueAllocationsAndLedgerRowsAreAccepted(): void
    {
        $allocations = [];
        $rows = [];
        for ($sequenceNo = 1; $sequenceNo <= 10000; $sequenceNo++) {
            $sequence = (string) $sequenceNo;
            $allocations[] = self::allocation('101', '7', '501', $sequence);
            $rows[] = self::activity('7', '501', $sequence, '0.01');
        }

        self::assertSame(self::attributed('100.00'), $this->assess($allocations, $rows));
    }

    public function testTenThousandAndOneLedgerRowsAreRejectedWithOneValidAllocation(): void
    {
        $rows = [];
        for ($sequenceNo = 1; $sequenceNo <= 10001; $sequenceNo++) {
            $rows[] = self::activity('7', '501', (string) $sequenceNo, '0.01');
        }

        self::assertSame(
            self::unavailable(),
            $this->assess([self::allocation('101', '7', '501', '1')], $rows)
        );
    }

    public function testTenThousandAndOneUniqueAllocationsAndMatchingRowsAreRejected(): void
    {
        $allocations = [];
        $rows = [];
        for ($sequenceNo = 1; $sequenceNo <= 10001; $sequenceNo++) {
            $sequence = (string) $sequenceNo;
            $allocations[] = self::allocation('101', '7', '501', $sequence);
            $rows[] = self::activity('7', '501', $sequence, '0.01');
        }

        // Both input caps are exceeded; this cannot isolate the allocation guard.
        self::assertSame(self::unavailable(), $this->assess($allocations, $rows));
    }

    public function testCurrencyContextIsMandatoryAndExplicit(): void
    {
        $allocation = [self::allocation('101', '7', '501', '1')];
        $rows = [self::activity('7', '501', '1', '12.00')];
        $service = new AppointmentPaymentAttribution();

        foreach ([[], ['code' => 'SEK'], ['code' => 'SEK', 'decimal_places' => 3], ['code' => 'sek', 'decimal_places' => 2], ['code' => '', 'decimal_places' => 2], ['code' => "USD\n", 'decimal_places' => 2]] as $invalidContext) {
            self::assertSame(self::unavailable(), $service->assess(self::booking(), $allocation, $rows, $invalidContext));
        }
        self::assertSame(
            ['status' => 'attributed', 'amount' => '12.00', 'currency' => 'EUR'],
            $service->assess(self::booking(), $allocation, $rows, ['code' => 'EUR', 'decimal_places' => 2])
        );
    }

    /**
     * @param list<mixed> $allocations
     * @param list<mixed> $rows
     * @param array<string, mixed>|null $booking
     * @return array{status: string, amount: ?string, currency: ?string}
     */
    private function assess(array $allocations, array $rows, ?array $booking = null): array
    {
        return (new AppointmentPaymentAttribution())->assess(
            $booking ?? self::booking(),
            $allocations,
            $rows,
            self::currency()
        );
    }

    /** @return array<string, mixed> */
    private static function booking(string $id = '101'): array
    {
        return ['pc_eid' => $id, 'pc_pid' => '7', 'pc_gid' => 0, 'pc_recurrtype' => 0, 'pc_multiple' => 0];
    }

    /** @return array<string, mixed> */
    private static function allocation(string $bookingId, string $pid, string $encounter, string $sequenceNo): array
    {
        return ['booking_id' => $bookingId, 'pid' => $pid, 'encounter' => $encounter, 'sequence_no' => $sequenceNo];
    }

    /** @return array<string, mixed> */
    private static function activity(string $pid, string $encounter, string $sequenceNo, string $amount, ?string $deleted = null): array
    {
        return ['pid' => $pid, 'encounter' => $encounter, 'sequence_no' => $sequenceNo, 'pay_amount' => $amount, 'deleted' => $deleted];
    }

    /** @return array{code: string, decimal_places: int} */
    private static function currency(): array
    {
        return ['code' => 'USD', 'decimal_places' => 2];
    }

    /** @return array{status: string, amount: string, currency: string} */
    private static function attributed(string $amount): array
    {
        return ['status' => 'attributed', 'amount' => $amount, 'currency' => 'USD'];
    }

    /** @return array{status: string, amount: null, currency: null} */
    private static function unavailable(): array
    {
        return ['status' => 'unavailable', 'amount' => null, 'currency' => null];
    }
}
