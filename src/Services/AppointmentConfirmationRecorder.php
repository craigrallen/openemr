<?php

declare(strict_types=1);

namespace OpenEMR\Services;

/**
 * Records synthetic confirmation eligibility metadata in this instance only.
 * A recorded result does not indicate that a message was sent.
 *
 * @phpstan-type BookingInput array{pc_eid?: mixed, pc_pid?: mixed, pc_eventDate?: mixed, pc_startTime?: mixed, pc_recurrtype?: mixed, pc_multiple?: mixed, pc_apptstatus?: mixed}
 * @phpstan-type PatientInput array{pid?: mixed, hipaa_allowsms?: mixed, hipaa_allowemail?: mixed, phone_cell?: mixed, email?: mixed}
 * @phpstan-type BookingIdentity array{booking_id: string, patient_id: string, event_date: string, start_time: string}
 * @phpstan-type Receipt array{booking_id: string, patient_id: string, event_date: string, start_time: string, channel: string}
 */
final class AppointmentConfirmationRecorder
{
    /** @var list<Receipt> */
    private array $records = [];

    /**
     * @param BookingInput $requestedBooking Caller-supplied booking snapshot.
     * @param BookingInput $currentBooking Caller-supplied current booking assertion.
     * @param PatientInput $patient Caller-supplied patient and consent assertion.
     * @return array{sms: string, email: string}
     */
    public function record(
        array $requestedBooking,
        array $currentBooking,
        array $patient,
        string $requestedChannel
    ): array {
        $results = ['sms' => 'not_requested', 'email' => 'not_requested'];
        if (!in_array($requestedChannel, ['sms', 'email', 'both'], true)) {
            return $results;
        }

        $requested = self::validBooking($requestedBooking);
        $current = self::validBooking($currentBooking);
        $patientId = self::canonicalId($patient['pid'] ?? null);
        if (
            $requested === null ||
            $current === null ||
            $requested !== $current ||
            $patientId !== $requested['patient_id']
        ) {
            if ($requestedChannel === 'sms' || $requestedChannel === 'both') {
                $results['sms'] = 'invalid_booking';
            }
            if ($requestedChannel === 'email' || $requestedChannel === 'both') {
                $results['email'] = 'invalid_booking';
            }
            return $results;
        }

        if ($requestedChannel === 'sms' || $requestedChannel === 'both') {
            $results['sms'] = $this->recordChannel($requested, $patient, 'sms');
        }
        if ($requestedChannel === 'email' || $requestedChannel === 'both') {
            $results['email'] = $this->recordChannel($requested, $patient, 'email');
        }
        return $results;
    }

    /** @return list<Receipt> */
    public function getRecords(): array
    {
        return $this->records;
    }

    /**
     * @param BookingInput $booking
     * @return BookingIdentity|null
     */
    private static function validBooking(array $booking): ?array
    {
        $bookingId = self::canonicalId($booking['pc_eid'] ?? null);
        $patientId = self::canonicalId($booking['pc_pid'] ?? null);
        $date = $booking['pc_eventDate'] ?? null;
        $time = $booking['pc_startTime'] ?? null;

        if (
            $bookingId === null ||
            $patientId === null ||
            !is_string($date) ||
            !self::validDate($date) ||
            !is_string($time) ||
            preg_match('/\A(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\z/', $time) !== 1 ||
            !in_array($booking['pc_recurrtype'] ?? null, [0, '0'], true) ||
            !in_array($booking['pc_multiple'] ?? null, [0, '0'], true) ||
            ($booking['pc_apptstatus'] ?? null) !== '-'
        ) {
            return null;
        }

        return [
            'booking_id' => $bookingId,
            'patient_id' => $patientId,
            'event_date' => $date,
            'start_time' => $time,
        ];
    }

    private static function canonicalId(mixed $value): ?string
    {
        if (is_int($value)) {
            return $value > 0 ? (string) $value : null;
        }
        if (is_string($value) && preg_match('/\A[1-9][0-9]*\z/', $value) === 1) {
            return $value;
        }
        return null;
    }

    private static function validDate(string $value): bool
    {
        if (
            preg_match('/\A([0-9]{4})-([0-9]{2})-([0-9]{2})\z/', $value, $parts) !== 1
        ) {
            return false;
        }
        return checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]);
    }

    /**
     * @param BookingIdentity $booking
     * @param PatientInput $patient
     */
    private function recordChannel(array $booking, array $patient, string $channel): string
    {
        $consent = $channel === 'sms'
            ? ($patient['hipaa_allowsms'] ?? null)
            : ($patient['hipaa_allowemail'] ?? null);
        if ($consent !== 'YES') {
            return 'consent_required';
        }

        $contact = $channel === 'sms' ? ($patient['phone_cell'] ?? null) : ($patient['email'] ?? null);
        if ($channel === 'sms') {
            $validContact = is_string($contact) &&
                preg_match('/\A\+[1-9][0-9]{1,14}\z/', $contact) === 1;
        } else {
            $validContact = is_string($contact) &&
                strlen($contact) <= 254 &&
                preg_match('/\A[\x21-\x7E]+\z/', $contact) === 1 &&
                filter_var($contact, FILTER_VALIDATE_EMAIL) !== false;
        }
        if (!$validContact) {
            return 'invalid_contact';
        }

        $receipt = [
            'booking_id' => $booking['booking_id'],
            'patient_id' => $booking['patient_id'],
            'event_date' => $booking['event_date'],
            'start_time' => $booking['start_time'],
            'channel' => $channel,
        ];
        if (in_array($receipt, $this->records, true)) {
            return 'duplicate';
        }

        $this->records[] = $receipt;
        return 'recorded';
    }
}
