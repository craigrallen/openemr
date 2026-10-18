<?php

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Services\AppointmentConfirmationRecorder;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Contract tests for the recording-only, instance-local confirmation rehearsal.
 * The original contract tests were published first, while the class was absent (RED).
 * Later boundary cases extend that contract after the initial implementation.
 */
final class AppointmentConfirmationRecorderTest extends TestCase
{
    /**
     * @param array{sms: string, email: string} $expected
     * @param list<array{booking_id: string, patient_id: string, event_date: string, start_time: string, channel: string}> $receipts
     */
    #[DataProvider('requestedChannels')]
    public function testRecordsOnlyRequestedEligibleChannels(string $channel, array $expected, array $receipts): void
    {
        $recorder = new AppointmentConfirmationRecorder();
        $booking = self::booking();
        $patient = self::patient();

        self::assertSame($expected, $recorder->record($booking, $booking, $patient, $channel));
        self::assertSame($receipts, $recorder->getRecords());
    }

    /**
     * @return iterable<string, array{string, array{sms: string, email: string}, list<array{booking_id: string, patient_id: string, event_date: string, start_time: string, channel: string}>}>
     */
    public static function requestedChannels(): iterable
    {
        yield 'SMS only' => ['sms', ['sms' => 'recorded', 'email' => 'not_requested'], [self::receipt('sms')]];
        yield 'email only' => ['email', ['sms' => 'not_requested', 'email' => 'recorded'], [self::receipt('email')]];
        yield 'both, in channel order' => ['both', ['sms' => 'recorded', 'email' => 'recorded'], [self::receipt('sms'), self::receipt('email')]];
    }

    public function testUnknownChannelSelectionDeniesEverything(): void
    {
        foreach (['', 'SMS', 'Email', ' sms', 'sms,email', 'all'] as $selection) {
            $recorder = new AppointmentConfirmationRecorder();
            $booking = self::booking();
            self::assertSame(
                ['sms' => 'not_requested', 'email' => 'not_requested'],
                $recorder->record($booking, $booking, self::patient(), $selection),
                $selection
            );
            self::assertSame([], $recorder->getRecords(), $selection);
        }
    }

    public function testBothChannelsMakeIndependentConsentAndContactDecisions(): void
    {
        $cases = [
            'SMS consent missing' => [['hipaa_allowsms' => 'NO'], ['sms' => 'consent_required', 'email' => 'recorded'], 'email'],
            'email consent missing' => [['hipaa_allowemail' => 'NO'], ['sms' => 'recorded', 'email' => 'consent_required'], 'sms'],
            'SMS contact invalid' => [['phone_cell' => '555-0100'], ['sms' => 'invalid_contact', 'email' => 'recorded'], 'email'],
            'email contact invalid' => [['email' => 'not an address'], ['sms' => 'recorded', 'email' => 'invalid_contact'], 'sms'],
        ];

        foreach ($cases as $description => [$changes, $expected, $recordedChannel]) {
            $recorder = new AppointmentConfirmationRecorder();
            $booking = self::booking();
            $patient = array_replace(self::patient(), $changes);
            self::assertSame($expected, $recorder->record($booking, $booking, $patient, 'both'), $description);
            self::assertSame([self::receipt($recordedChannel)], $recorder->getRecords(), $description);
        }
    }

    public function testConsentRequiresExactYesForEachChannel(): void
    {
        foreach (['NO', null, '', 'unknown', 'yes', true, 1] as $value) {
            foreach (['sms' => 'hipaa_allowsms', 'email' => 'hipaa_allowemail'] as $channel => $field) {
                $recorder = new AppointmentConfirmationRecorder();
                $booking = self::booking();
                $patient = self::patient();
                $patient[$field] = $value;
                self::assertSame(
                    $channel === 'sms'
                        ? ['sms' => 'consent_required', 'email' => 'not_requested']
                        : ['sms' => 'not_requested', 'email' => 'consent_required'],
                    $recorder->record($booking, $booking, $patient, $channel),
                    $field . ': ' . var_export($value, true)
                );
                self::assertSame([], $recorder->getRecords());
            }
        }
    }

    public function testAbsentConsentAlsoDeniesItsChannel(): void
    {
        foreach (['sms' => 'hipaa_allowsms', 'email' => 'hipaa_allowemail'] as $channel => $field) {
            $recorder = new AppointmentConfirmationRecorder();
            $booking = self::booking();
            $patient = self::patient();
            unset($patient[$field]);
            self::assertSame('consent_required', $recorder->record($booking, $booking, $patient, $channel)[$channel]);
            self::assertSame([], $recorder->getRecords());
        }
    }

    public function testInvalidBookingSnapshotsDenyAllRequestedChannels(): void
    {
        $invalidFields = [
            'zero booking ID' => ['pc_eid', 0],
            'negative booking ID' => ['pc_eid', -7],
            'boolean booking ID' => ['pc_eid', true],
            'array booking ID' => ['pc_eid', [7]],
            'leading-zero booking ID' => ['pc_eid', '007'],
            'negative patient ID' => ['pc_pid', -42],
            'boolean patient ID' => ['pc_pid', false],
            'array patient ID' => ['pc_pid', [42]],
            'signed patient ID' => ['pc_pid', '+42'],
            'float ID' => ['pc_eid', 7.0],
            'scientific ID' => ['pc_eid', '7e0'],
            'space in ID' => ['pc_eid', ' 7'],
            'line feed in ID' => ['pc_eid', "7\n"],
            'recurring booking' => ['pc_recurrtype', 1],
            'boolean zero recurrence' => ['pc_recurrtype', false],
            'unknown recurrence' => ['pc_recurrtype', ''],
            'group booking' => ['pc_multiple', 1],
            'boolean zero multiple' => ['pc_multiple', false],
            'unknown group flag' => ['pc_multiple', null],
            'year zero' => ['pc_eventDate', '0000-01-01'],
            'invalid month' => ['pc_eventDate', '2026-13-01'],
            'non-leap February 29' => ['pc_eventDate', '2025-02-29'],
            'noncanonical date' => ['pc_eventDate', '2026-2-03'],
            'line feed in date' => ['pc_eventDate', "2026-10-18\n"],
            'invalid hour' => ['pc_startTime', '24:00:00'],
            'noncanonical time' => ['pc_startTime', '09:00'],
            'line feed in time' => ['pc_startTime', "09:15:00\n"],
            'cancelled' => ['pc_apptstatus', 'x'],
            'no-show' => ['pc_apptstatus', '?'],
            'unknown status' => ['pc_apptstatus', 'custom'],
            'empty status' => ['pc_apptstatus', ''],
        ];

        foreach ($invalidFields as $description => [$field, $value]) {
            foreach (['requested', 'current'] as $snapshot) {
                $recorder = new AppointmentConfirmationRecorder();
                $requested = self::booking();
                $current = self::booking();
                if ($snapshot === 'requested') {
                    $requested[$field] = $value;
                } else {
                    $current[$field] = $value;
                }
                self::assertSame(
                    ['sms' => 'invalid_booking', 'email' => 'invalid_booking'],
                    $recorder->record($requested, $current, self::patient(), 'both'),
                    $description . ' in ' . $snapshot
                );
                self::assertSame([], $recorder->getRecords());
            }
        }
    }

    public function testMissingRequiredBookingKeysDenyBothChannelsInEitherSnapshot(): void
    {
        foreach (array_keys(self::booking()) as $field) {
            foreach (['requested', 'current'] as $snapshot) {
                $recorder = new AppointmentConfirmationRecorder();
                $requested = self::booking();
                $current = self::booking();
                if ($snapshot === 'requested') {
                    unset($requested[$field]);
                } else {
                    unset($current[$field]);
                }
                self::assertSame(
                    ['sms' => 'invalid_booking', 'email' => 'invalid_booking'],
                    $recorder->record($requested, $current, self::patient(), 'both'),
                    $field . ' absent from ' . $snapshot
                );
                self::assertSame([], $recorder->getRecords());
            }
        }
    }

    public function testRequestedAndCurrentMustAgreeAndPatientMustBeBound(): void
    {
        foreach (['pc_eid' => '8', 'pc_pid' => '43', 'pc_eventDate' => '2026-10-19', 'pc_startTime' => '10:16:00'] as $field => $value) {
            $recorder = new AppointmentConfirmationRecorder();
            $requested = self::booking();
            $current = self::booking();
            $current[$field] = $value;
            self::assertSame(
                ['sms' => 'invalid_booking', 'email' => 'invalid_booking'],
                $recorder->record($requested, $current, self::patient(), 'both'),
                $field
            );
            self::assertSame([], $recorder->getRecords());
        }

        foreach ([43, '042', 0, null, '42 ', 42.0] as $pid) {
            $recorder = new AppointmentConfirmationRecorder();
            $booking = self::booking();
            $patient = self::patient();
            $patient['pid'] = $pid;
            self::assertSame(
                ['sms' => 'invalid_booking', 'email' => 'invalid_booking'],
                $recorder->record($booking, $booking, $patient, 'both'),
                var_export($pid, true)
            );
            self::assertSame([], $recorder->getRecords());
        }

        $recorder = new AppointmentConfirmationRecorder();
        $booking = self::booking();
        $patient = self::patient();
        unset($patient['pid']);
        self::assertSame(['sms' => 'invalid_booking', 'email' => 'invalid_booking'], $recorder->record($booking, $booking, $patient, 'both'));
    }

    public function testCanonicalStringZerosAndRealLeapDayAreAccepted(): void
    {
        $recorder = new AppointmentConfirmationRecorder();
        $booking = self::booking();
        $booking['pc_recurrtype'] = '0';
        $booking['pc_multiple'] = '0';
        $booking['pc_eventDate'] = '2028-02-29';
        self::assertSame(
            ['sms' => 'recorded', 'email' => 'not_requested'],
            $recorder->record($booking, $booking, self::patient(), 'sms')
        );
        self::assertSame([array_replace(self::receipt('sms'), ['event_date' => '2028-02-29'])], $recorder->getRecords());
    }

    public function testGregorianYearEndpointsAndCanonicalLargeId(): void
    {
        foreach (['0001-01-01', '9999-12-31'] as $date) {
            $recorder = new AppointmentConfirmationRecorder();
            $booking = array_replace(self::booking(), [
                'pc_eid' => '123456789012345678901234567890',
                'pc_eventDate' => $date,
            ]);
            self::assertSame(
                ['sms' => 'recorded', 'email' => 'not_requested'],
                $recorder->record($booking, $booking, self::patient(), 'sms')
            );
            self::assertSame([
                array_replace(self::receipt('sms'), [
                    'booking_id' => '123456789012345678901234567890',
                    'event_date' => $date,
                ]),
            ], $recorder->getRecords());
        }
    }

    public function testIntegerAndCanonicalStringIdsShareIdentity(): void
    {
        $recorder = new AppointmentConfirmationRecorder();
        $requested = self::booking();
        $current = array_replace($requested, ['pc_eid' => '7', 'pc_pid' => 42]);
        self::assertSame(
            ['sms' => 'recorded', 'email' => 'not_requested'],
            $recorder->record($requested, $current, self::patient(), 'sms')
        );
        self::assertSame([self::receipt('sms')], $recorder->getRecords());
    }

    public function testInvalidBookingPreservesUnrequestedChannelStatus(): void
    {
        foreach (['sms', 'email'] as $channel) {
            $recorder = new AppointmentConfirmationRecorder();
            $booking = self::booking();
            $current = array_replace($booking, ['pc_apptstatus' => 'x']);
            self::assertSame(
                $channel === 'sms'
                    ? ['sms' => 'invalid_booking', 'email' => 'not_requested']
                    : ['sms' => 'not_requested', 'email' => 'invalid_booking'],
                $recorder->record($booking, $current, self::patient(), $channel)
            );
            self::assertSame([], $recorder->getRecords());
        }
    }

    public function testContactSyntaxAndNoFallback(): void
    {
        $invalidSms = ['', '123456789', '+0', '+1', '+1234567890123456', '+1 234', "+12\n34", ' +1234', '+1234 ', '+1-234'];
        foreach ($invalidSms as $phone) {
            $recorder = new AppointmentConfirmationRecorder();
            $booking = self::booking();
            $patient = self::patient();
            $patient['phone_cell'] = $phone;
            $patient['phone_home'] = '+15551234567';
            $patient['portal_phone'] = '+15551234567';
            self::assertSame(['sms' => 'invalid_contact', 'email' => 'not_requested'], $recorder->record($booking, $booking, $patient, 'sms'), var_export($phone, true));
            self::assertSame([], $recorder->getRecords());
        }

        $invalidEmails = ['', 'Jane <jane@example.test>', 'a b@example.test', "a\n@example.test", 'a@exämple.test', str_repeat('a', 245) . '@example.test'];
        foreach ($invalidEmails as $email) {
            $recorder = new AppointmentConfirmationRecorder();
            $booking = self::booking();
            $patient = self::patient();
            $patient['email'] = $email;
            $patient['alternate_email'] = 'fallback@example.test';
            self::assertSame(['sms' => 'not_requested', 'email' => 'invalid_contact'], $recorder->record($booking, $booking, $patient, 'email'), $email);
            self::assertSame([], $recorder->getRecords());
        }

        foreach (['phone_cell' => 'sms', 'email' => 'email'] as $field => $channel) {
            $recorder = new AppointmentConfirmationRecorder();
            $booking = self::booking();
            $patient = self::patient();
            unset($patient[$field]);
            self::assertSame('invalid_contact', $recorder->record($booking, $booking, $patient, $channel)[$channel]);
            self::assertSame([], $recorder->getRecords());
        }
    }

    public function testMixedContactValuesAreRejectedWithoutWarnings(): void
    {
        foreach (['sms' => 'phone_cell', 'email' => 'email'] as $channel => $field) {
            foreach ([[], ['value'], true, false, 0, 42, 1.5, null] as $value) {
                $recorder = new AppointmentConfirmationRecorder();
                $booking = self::booking();
                $patient = self::patient();
                $patient[$field] = $value;
                self::assertSame(
                    $channel === 'sms'
                        ? ['sms' => 'invalid_contact', 'email' => 'not_requested']
                        : ['sms' => 'not_requested', 'email' => 'invalid_contact'],
                    $recorder->record($booking, $booking, $patient, $channel),
                    $channel . ': ' . var_export($value, true)
                );
                self::assertSame([], $recorder->getRecords());
            }
        }
    }

    public function testE164DigitCountEndpointsAreAccepted(): void
    {
        foreach (['+12', '+' . str_repeat('9', 15)] as $phone) {
            $recorder = new AppointmentConfirmationRecorder();
            $booking = self::booking();
            $patient = array_replace(self::patient(), ['phone_cell' => $phone]);
            self::assertSame(
                ['sms' => 'recorded', 'email' => 'not_requested'],
                $recorder->record($booking, $booking, $patient, 'sms')
            );
            self::assertSame([self::receipt('sms')], $recorder->getRecords());
        }
    }

    public function testEmailPublicLengthContractAt254And255Bytes(): void
    {
        $localPart = str_repeat('a', 64);
        $domainPrefix = str_repeat('b', 63) . '.' . str_repeat('c', 63) . '.';
        $email254 = $localPart . '@' . $domainPrefix . str_repeat('d', 61);
        $email255 = $localPart . '@' . $domainPrefix . str_repeat('d', 62);
        $recorder = new AppointmentConfirmationRecorder();
        $booking = self::booking();
        $patient = array_replace(self::patient(), ['email' => $email254]);
        self::assertSame(
            ['sms' => 'not_requested', 'email' => 'recorded'],
            $recorder->record($booking, $booking, $patient, 'email')
        );
        $patient['email'] = $email255;
        // Public recorder length contract; FILTER_VALIDATE_EMAIL may also reject this address.
        self::assertSame(
            ['sms' => 'not_requested', 'email' => 'invalid_contact'],
            $recorder->record($booking, $booking, $patient, 'email')
        );
        self::assertSame([self::receipt('email')], $recorder->getRecords());
    }

    public function testDedupeUsesBookingIdentityDateTimeAndChannelWithoutConsumingInvalidAttempts(): void
    {
        $recorder = new AppointmentConfirmationRecorder();
        $booking = self::booking();
        $patient = self::patient();
        $withoutConsent = array_replace($patient, ['hipaa_allowsms' => 'NO']);

        self::assertSame('consent_required', $recorder->record($booking, $booking, $withoutConsent, 'sms')['sms']);
        self::assertSame([], $recorder->getRecords());
        self::assertSame(['sms' => 'recorded', 'email' => 'not_requested'], $recorder->record($booking, $booking, $patient, 'sms'));
        self::assertSame(['sms' => 'duplicate', 'email' => 'not_requested'], $recorder->record($booking, $booking, $patient, 'sms'));
        self::assertSame(['sms' => 'duplicate', 'email' => 'recorded'], $recorder->record($booking, $booking, $patient, 'both'));

        $later = array_replace($booking, ['pc_startTime' => '10:16:00']);
        self::assertSame('recorded', $recorder->record($later, $later, $patient, 'sms')['sms']);
        $otherBooking = array_replace($booking, ['pc_eid' => 8]);
        self::assertSame('recorded', $recorder->record($otherBooking, $otherBooking, $patient, 'sms')['sms']);
        self::assertSame([
            self::receipt('sms'),
            self::receipt('email'),
            array_replace(self::receipt('sms'), ['start_time' => '10:16:00']),
            array_replace(self::receipt('sms'), ['booking_id' => '8']),
        ], $recorder->getRecords());
    }

    public function testDedupeDistinguishesDateAndPatient(): void
    {
        $recorder = new AppointmentConfirmationRecorder();
        $booking = self::booking();
        $patient = self::patient();
        self::assertSame('recorded', $recorder->record($booking, $booking, $patient, 'sms')['sms']);

        $nextDate = array_replace($booking, ['pc_eventDate' => '2026-10-19']);
        self::assertSame('recorded', $recorder->record($nextDate, $nextDate, $patient, 'sms')['sms']);

        $otherPatientBooking = array_replace($booking, ['pc_pid' => '43']);
        $otherPatient = array_replace($patient, ['pid' => 43]);
        self::assertSame('recorded', $recorder->record($otherPatientBooking, $otherPatientBooking, $otherPatient, 'sms')['sms']);
        self::assertSame([
            self::receipt('sms'),
            array_replace(self::receipt('sms'), ['event_date' => '2026-10-19']),
            array_replace(self::receipt('sms'), ['patient_id' => '43']),
        ], $recorder->getRecords());
    }

    public function testBothChannelsCanRecordAfterEarlierDenials(): void
    {
        $recorder = new AppointmentConfirmationRecorder();
        $booking = self::booking();
        $patient = self::patient();
        $denied = array_replace($patient, ['hipaa_allowsms' => 'NO', 'hipaa_allowemail' => 'NO']);
        self::assertSame(
            ['sms' => 'consent_required', 'email' => 'consent_required'],
            $recorder->record($booking, $booking, $denied, 'both')
        );
        self::assertSame([], $recorder->getRecords());
        self::assertSame(
            ['sms' => 'recorded', 'email' => 'recorded'],
            $recorder->record($booking, $booking, $patient, 'both')
        );
        self::assertSame([self::receipt('sms'), self::receipt('email')], $recorder->getRecords());
    }

    public function testInvalidBookingAndContactAttemptsDoNotReserveAChannel(): void
    {
        $recorder = new AppointmentConfirmationRecorder();
        $booking = self::booking();
        $patient = self::patient();
        $cancelled = array_replace($booking, ['pc_apptstatus' => 'x']);
        $badContact = array_replace($patient, ['phone_cell' => '555-0100']);

        self::assertSame('invalid_booking', $recorder->record($booking, $cancelled, $patient, 'sms')['sms']);
        self::assertSame('invalid_contact', $recorder->record($booking, $booking, $badContact, 'sms')['sms']);
        self::assertSame([], $recorder->getRecords());
        self::assertSame('recorded', $recorder->record($booking, $booking, $patient, 'sms')['sms']);
        self::assertSame([self::receipt('sms')], $recorder->getRecords());
    }

    public function testCurrentSuppressionAndWithdrawnConsentAreCheckedBeforeDuplicate(): void
    {
        $recorder = new AppointmentConfirmationRecorder();
        $booking = self::booking();
        $patient = self::patient();
        self::assertSame('recorded', $recorder->record($booking, $booking, $patient, 'sms')['sms']);

        $withdrawn = array_replace($patient, ['hipaa_allowsms' => 'NO']);
        self::assertSame('consent_required', $recorder->record($booking, $booking, $withdrawn, 'sms')['sms']);
        $cancelled = array_replace($booking, ['pc_apptstatus' => 'x']);
        self::assertSame('invalid_booking', $recorder->record($booking, $cancelled, $patient, 'sms')['sms']);
        self::assertSame([self::receipt('sms')], $recorder->getRecords());
    }

    public function testRepeatContactAndBookingChecksPrecedeDuplicateForBothChannels(): void
    {
        $recorder = new AppointmentConfirmationRecorder();
        $booking = self::booking();
        $patient = self::patient();
        self::assertSame(
            ['sms' => 'recorded', 'email' => 'recorded'],
            $recorder->record($booking, $booking, $patient, 'both')
        );

        $invalidContacts = array_replace($patient, ['phone_cell' => '+1', 'email' => 'invalid']);
        self::assertSame(
            ['sms' => 'invalid_contact', 'email' => 'invalid_contact'],
            $recorder->record($booking, $booking, $invalidContacts, 'both')
        );
        $removedContacts = $patient;
        unset($removedContacts['phone_cell'], $removedContacts['email']);
        self::assertSame(
            ['sms' => 'invalid_contact', 'email' => 'invalid_contact'],
            $recorder->record($booking, $booking, $removedContacts, 'both')
        );
        $removedConsent = $patient;
        unset($removedConsent['hipaa_allowsms'], $removedConsent['hipaa_allowemail']);
        self::assertSame(
            ['sms' => 'consent_required', 'email' => 'consent_required'],
            $recorder->record($booking, $booking, $removedConsent, 'both')
        );
        $cancelled = array_replace($booking, ['pc_apptstatus' => 'x']);
        self::assertSame(
            ['sms' => 'invalid_booking', 'email' => 'invalid_booking'],
            $recorder->record($booking, $cancelled, $patient, 'both')
        );
        self::assertSame([self::receipt('sms'), self::receipt('email')], $recorder->getRecords());
    }

    public function testRecordsAreInstanceLocalAndInputsAreNotMutated(): void
    {
        $first = new AppointmentConfirmationRecorder();
        $second = new AppointmentConfirmationRecorder();
        $requested = self::booking();
        $current = self::booking();
        $patient = self::patient();
        $requestedBefore = $requested;
        $currentBefore = $current;
        $patientBefore = $patient;

        self::assertSame(['sms' => 'recorded', 'email' => 'recorded'], $first->record($requested, $current, $patient, 'both'));
        self::assertSame($requestedBefore, $requested);
        self::assertSame($currentBefore, $current);
        self::assertSame($patientBefore, $patient);
        self::assertSame([], $second->getRecords());
        self::assertSame('recorded', $second->record($requested, $current, $patient, 'sms')['sms']);
        self::assertSame([self::receipt('sms'), self::receipt('email')], $first->getRecords());
        self::assertSame([self::receipt('sms')], $second->getRecords());
    }

    public function testMutatingReturnedRecordsDoesNotChangeStoredReceipts(): void
    {
        $recorder = new AppointmentConfirmationRecorder();
        $booking = self::booking();
        $patient = self::patient();
        self::assertSame(
            ['sms' => 'recorded', 'email' => 'recorded'],
            $recorder->record($booking, $booking, $patient, 'both')
        );
        $copy = $recorder->getRecords();
        $copy[0]['booking_id'] = '999';
        $copy[1]['channel'] = 'sms';
        $copy[] = self::receipt('sms');
        self::assertSame([self::receipt('sms'), self::receipt('email')], $recorder->getRecords());
        self::assertSame(
            ['sms' => 'duplicate', 'email' => 'duplicate'],
            $recorder->record($booking, $booking, $patient, 'both')
        );
    }

    /** @return array<string, int|string> */
    private static function booking(): array
    {
        return [
            'pc_eid' => 7,
            'pc_pid' => '42',
            'pc_eventDate' => '2026-10-18',
            'pc_startTime' => '09:15:00',
            'pc_recurrtype' => 0,
            'pc_multiple' => 0,
            'pc_apptstatus' => '-',
        ];
    }

    /** @return array<string, int|string> */
    private static function patient(): array
    {
        return [
            'pid' => 42,
            'hipaa_allowsms' => 'YES',
            'hipaa_allowemail' => 'YES',
            'phone_cell' => '+15551234567',
            'email' => 'patient@example.test',
        ];
    }

    /** @return array{booking_id: string, patient_id: string, event_date: string, start_time: string, channel: string} */
    private static function receipt(string $channel): array
    {
        return [
            'booking_id' => '7',
            'patient_id' => '42',
            'event_date' => '2026-10-18',
            'start_time' => '09:15:00',
            'channel' => $channel,
        ];
    }
}
