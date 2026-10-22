<?php

/**
 * Pure policy for attributing explicitly allocated payment rows to a booking.
 *
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Services;

final class AppointmentPaymentAttribution
{
    // 10,000 * 999,999,999,999 minor units fits in a signed 64-bit integer.
    private const MAX_INPUT_ROWS = 10000;
    private const MAX_DECIMAL_MINOR_UNITS = 999999999999;
    private const UNAVAILABLE = ['status' => 'unavailable', 'amount' => null, 'currency' => null];

    /**
     * The caller must supply an authoritative booking snapshot, complete
     * persisted whole-row allocations, current ledger rows, and verified currency.
     * This method does not retrieve records or establish those guarantees.
     *
     * @param array<string, mixed> $booking
     * @param array<mixed> $allocations
     * @param array<mixed> $arActivity
     * @param array<string, mixed> $currencyContext
     * @return array{status: string, amount: ?string, currency: ?string}
     */
    public function assess(array $booking, array $allocations, array $arActivity, array $currencyContext): array
    {
        if (
            PHP_INT_SIZE !== 8
            || count($allocations) === 0
            || count($allocations) > self::MAX_INPUT_ROWS
            || count($arActivity) > self::MAX_INPUT_ROWS
        ) {
            return self::UNAVAILABLE;
        }

        $bookingId = self::canonicalId($booking['pc_eid'] ?? null);
        $patientId = self::canonicalId($booking['pc_pid'] ?? null);
        if (
            $bookingId === null
            || $patientId === null
            || !self::isZeroFlag($booking['pc_gid'] ?? null)
            || !self::isZeroFlag($booking['pc_multiple'] ?? null)
            || !self::isZeroFlag($booking['pc_recurrtype'] ?? null)
            || !isset($currencyContext['code'])
            || !is_string($currencyContext['code'])
            || preg_match('/\A[A-Z]{3}\z/', $currencyContext['code']) !== 1
            || !isset($currencyContext['decimal_places'])
            || $currencyContext['decimal_places'] !== 2
        ) {
            return self::UNAVAILABLE;
        }

        /** @var array<string, true> $allocatedIdentities */
        $allocatedIdentities = [];
        foreach ($allocations as $allocation) {
            if (!is_array($allocation) || count($allocation) !== 4) {
                return self::UNAVAILABLE;
            }
            foreach (['booking_id', 'pid', 'encounter', 'sequence_no'] as $field) {
                if (!array_key_exists($field, $allocation)) {
                    return self::UNAVAILABLE;
                }
            }
            $allocatedBookingId = self::canonicalId($allocation['booking_id']);
            $allocatedPatientId = self::canonicalId($allocation['pid']);
            $encounter = self::canonicalId($allocation['encounter']);
            $sequenceNo = self::canonicalId($allocation['sequence_no']);
            if (
                $allocatedBookingId !== $bookingId
                || $allocatedPatientId !== $patientId
                || $encounter === null
                || $sequenceNo === null
            ) {
                return self::UNAVAILABLE;
            }
            $identity = self::identity($patientId, $encounter, $sequenceNo);
            if (isset($allocatedIdentities[$identity])) {
                return self::UNAVAILABLE;
            }
            $allocatedIdentities[$identity] = true;
        }

        /** @var array<string, array{amount: int, active: bool}> $ledger */
        $ledger = [];
        foreach ($arActivity as $row) {
            if (
                !is_array($row)
                || !array_key_exists('pid', $row)
                || !array_key_exists('encounter', $row)
                || !array_key_exists('sequence_no', $row)
                || !array_key_exists('pay_amount', $row)
                || !array_key_exists('deleted', $row)
            ) {
                return self::UNAVAILABLE;
            }
            $rowPatientId = self::canonicalId($row['pid']);
            $encounter = self::canonicalId($row['encounter']);
            $sequenceNo = self::canonicalId($row['sequence_no']);
            $amount = self::minorUnits($row['pay_amount']);
            if ($rowPatientId === null || $encounter === null || $sequenceNo === null || $amount === null) {
                return self::UNAVAILABLE;
            }
            $identity = self::identity($rowPatientId, $encounter, $sequenceNo);
            if (isset($ledger[$identity])) {
                return self::UNAVAILABLE;
            }
            $ledger[$identity] = ['amount' => $amount, 'active' => $row['deleted'] === null];
        }

        $total = 0;
        foreach ($allocatedIdentities as $identity => $_) {
            if (!isset($ledger[$identity]) || !$ledger[$identity]['active']) {
                return self::UNAVAILABLE;
            }
            $total += $ledger[$identity]['amount'];
        }
        if ($total > self::MAX_DECIMAL_MINOR_UNITS || $total < -self::MAX_DECIMAL_MINOR_UNITS) {
            return self::UNAVAILABLE;
        }

        $magnitude = abs($total);
        $amount = ($total < 0 ? '-' : '')
            . intdiv($magnitude, 100)
            . '.'
            . str_pad((string) ($magnitude % 100), 2, '0', STR_PAD_LEFT);

        return ['status' => 'attributed', 'amount' => $amount, 'currency' => $currencyContext['code']];
    }

    private static function isZeroFlag(mixed $value): bool
    {
        return $value === 0 || $value === '0';
    }

    private static function canonicalId(mixed $value): ?string
    {
        if (is_int($value)) {
            return $value > 0 ? (string) $value : null;
        }
        if (!is_string($value) || preg_match('/\A[1-9][0-9]*\z/', $value) !== 1) {
            return null;
        }
        $maximum = (string) PHP_INT_MAX;
        if (strlen($value) > strlen($maximum) || (strlen($value) === strlen($maximum) && strcmp($value, $maximum) > 0)) {
            return null;
        }
        return $value;
    }

    private static function identity(string $patientId, string $encounter, string $sequenceNo): string
    {
        return $patientId . ':' . $encounter . ':' . $sequenceNo;
    }

    private static function minorUnits(mixed $value): ?int
    {
        if (!is_string($value) || preg_match('/\A(-?)(0|[1-9][0-9]{0,9})\.([0-9]{2})\z/', $value, $parts) !== 1) {
            return null;
        }
        $magnitude = ((int) $parts[2] * 100) + (int) $parts[3];
        if ($parts[1] === '-' && $magnitude === 0) {
            return null;
        }
        return $parts[1] === '-' ? -$magnitude : $magnitude;
    }
}
