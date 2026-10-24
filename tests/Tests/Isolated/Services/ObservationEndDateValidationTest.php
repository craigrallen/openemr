<?php

/**
 * Regression coverage for the enhanced observation form's start and end dates.
 *
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Services\ObservationService;
use OpenEMR\Services\Utils\DateFormatterUtils;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class ObservationEndDateValidationTest extends TestCase
{
    private ObservationService $service;

    /** @var array<string, array{present: bool, value: mixed}> */
    private array $originalGlobals = [];

    private string $originalTimezone;

    public static function setUpBeforeClass(): void
    {
        // Loading BaseService otherwise executes a legacy code-types database read.
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
    }

    protected function setUp(): void
    {
        $this->originalTimezone = date_default_timezone_get();
        foreach (['date_display_format', 'time_display_format'] as $key) {
            $this->originalGlobals[$key] = [
                'present' => array_key_exists($key, $GLOBALS),
                'value' => $GLOBALS[$key] ?? null,
            ];
        }

        date_default_timezone_set('Europe/Stockholm');
        $GLOBALS['date_display_format'] = DateFormatterUtils::DATE_FORMAT_ISO;
        $GLOBALS['time_display_format'] = DateFormatterUtils::TIME_FORMAT_24HR;

        // Only the date branches are exercised; no service constructor or lookup runs.
        $this->service = (new ReflectionClass(ObservationService::class))
            ->newInstanceWithoutConstructor();
    }

    protected function tearDown(): void
    {
        foreach ($this->originalGlobals as $key => $original) {
            if ($original['present']) {
                $GLOBALS[$key] = $original['value'];
            } else {
                unset($GLOBALS[$key]);
            }
        }
        date_default_timezone_set($this->originalTimezone);
    }

    /**
     * @param array<string, mixed> $dates
     * @return list<string>
     */
    private function errorsFor(array $dates): array
    {
        $observation = [
            'pid' => 1,
            'encounter' => 1,
            'groupname' => 'Clinicians',
            'user' => 'admin',
            'form_id' => 0,
            'code' => 'LOINC:1234-5',
            'description' => 'Example observation',
        ];

        $errors = $this->service->validateObservationData(array_merge($observation, $dates));
        $validated = [];
        foreach ($errors as $error) {
            self::assertIsString($error);
            $validated[] = $error;
        }
        self::assertSame($errors, $validated); // Also checks that the service returned list keys.
        return $validated;
    }

    /** @return array<string, array{int, string, string}> */
    public static function invalidEndDates(): array
    {
        return [
            'ISO' => [DateFormatterUtils::DATE_FORMAT_ISO, '2026-06-15', 'not-a-date'],
            'US' => [DateFormatterUtils::DATE_FORMAT_US, '06/15/2026', 'not-a-date'],
            'international' => [DateFormatterUtils::DATE_FORMAT_INTL, '15/06/2026', 'not-a-date'],
            'extra seconds segment' => [
                DateFormatterUtils::DATE_FORMAT_ISO,
                '2026-06-15 14:30',
                '2026-06-15 14:31:00:01',
            ],
        ];
    }

    #[DataProvider('invalidEndDates')]
    public function testInvalidEndDateReportsItsOwnFormatError(int $format, string $start, string $end): void
    {
        $GLOBALS['date_display_format'] = $format;

        self::assertSame(['Invalid end date format'], $this->errorsFor([
            'date' => $start,
            'date_end' => $end,
        ]));
    }

    /** @return array<string, array{int, int, string, string}> */
    public static function earlierEndDates(): array
    {
        return [
            // Date-only parsing supplies the current time, so compare different days.
            'ISO date only' => [DateFormatterUtils::DATE_FORMAT_ISO, DateFormatterUtils::TIME_FORMAT_24HR, '2026-06-15', '2026-06-14'],
            'US date only' => [DateFormatterUtils::DATE_FORMAT_US, DateFormatterUtils::TIME_FORMAT_24HR, '06/15/2026', '06/14/2026'],
            'international date only' => [DateFormatterUtils::DATE_FORMAT_INTL, DateFormatterUtils::TIME_FORMAT_24HR, '15/06/2026', '14/06/2026'],
            '24-hour minutes' => [DateFormatterUtils::DATE_FORMAT_ISO, DateFormatterUtils::TIME_FORMAT_24HR, '2026-06-15 14:30', '2026-06-15 14:29'],
            '12-hour minutes' => [DateFormatterUtils::DATE_FORMAT_US, DateFormatterUtils::TIME_FORMAT_12HR, '06/15/2026 2:30 pm', '06/15/2026 2:29 pm'],
        ];
    }

    #[DataProvider('earlierEndDates')]
    public function testEndBeforeStartIsRejected(int $format, int $timeFormat, string $start, string $end): void
    {
        $GLOBALS['date_display_format'] = $format;
        $GLOBALS['time_display_format'] = $timeFormat;

        self::assertSame(['End date cannot be before start date'], $this->errorsFor([
            'date' => $start,
            'date_end' => $end,
        ]));
    }

    /** @return array<string, array{int, string, string}> */
    public static function equalOrLaterEndDates(): array
    {
        return [
            'equal ISO minutes' => [DateFormatterUtils::DATE_FORMAT_ISO, '2026-06-15 14:30', '2026-06-15 14:30'],
            'later ISO minutes' => [DateFormatterUtils::DATE_FORMAT_ISO, '2026-06-15 14:30', '2026-06-15 14:31'],
            'later US date' => [DateFormatterUtils::DATE_FORMAT_US, '06/15/2026', '06/16/2026'],
            'later international date' => [DateFormatterUtils::DATE_FORMAT_INTL, '15/06/2026', '16/06/2026'],
        ];
    }

    #[DataProvider('equalOrLaterEndDates')]
    public function testEqualOrLaterEndIsAccepted(int $format, string $start, string $end): void
    {
        $GLOBALS['date_display_format'] = $format;

        self::assertSame([], $this->errorsFor([
            'date' => $start,
            'date_end' => $end,
        ]));
    }

    /** @return array<string, array{int, int, string, string, list<string>}> */
    public static function canonicalStoredEndDates(): array
    {
        return [
            // Parsing an explicit display time (H:i or g:i a) resets seconds to 00.
            // A stored :59 value is later within the same displayed minute.
            'ISO exact equality' => [DateFormatterUtils::DATE_FORMAT_ISO, DateFormatterUtils::TIME_FORMAT_24HR, '2026-06-15 14:30', '2026-06-15 14:30:00', []],
            'ISO same minute' => [DateFormatterUtils::DATE_FORMAT_ISO, DateFormatterUtils::TIME_FORMAT_24HR, '2026-06-15 14:30', '2026-06-15 14:30:59', []],
            'ISO later' => [DateFormatterUtils::DATE_FORMAT_ISO, DateFormatterUtils::TIME_FORMAT_24HR, '2026-06-15 14:30', '2026-06-15 14:31:00', []],
            'ISO earlier' => [DateFormatterUtils::DATE_FORMAT_ISO, DateFormatterUtils::TIME_FORMAT_24HR, '2026-06-15 14:30', '2026-06-15 14:29:59', ['End date cannot be before start date']],
            'US exact equality' => [DateFormatterUtils::DATE_FORMAT_US, DateFormatterUtils::TIME_FORMAT_24HR, '06/15/2026 14:30', '2026-06-15 14:30:00', []],
            'US same minute' => [DateFormatterUtils::DATE_FORMAT_US, DateFormatterUtils::TIME_FORMAT_24HR, '06/15/2026 14:30', '2026-06-15 14:30:59', []],
            'US later' => [DateFormatterUtils::DATE_FORMAT_US, DateFormatterUtils::TIME_FORMAT_24HR, '06/15/2026 14:30', '2026-06-15 14:31:00', []],
            'US earlier' => [DateFormatterUtils::DATE_FORMAT_US, DateFormatterUtils::TIME_FORMAT_24HR, '06/15/2026 14:30', '2026-06-15 14:29:59', ['End date cannot be before start date']],
            'international exact equality' => [DateFormatterUtils::DATE_FORMAT_INTL, DateFormatterUtils::TIME_FORMAT_24HR, '15/06/2026 14:30', '2026-06-15 14:30:00', []],
            'international same minute' => [DateFormatterUtils::DATE_FORMAT_INTL, DateFormatterUtils::TIME_FORMAT_24HR, '15/06/2026 14:30', '2026-06-15 14:30:59', []],
            'international later' => [DateFormatterUtils::DATE_FORMAT_INTL, DateFormatterUtils::TIME_FORMAT_24HR, '15/06/2026 14:30', '2026-06-15 14:31:00', []],
            'international earlier' => [DateFormatterUtils::DATE_FORMAT_INTL, DateFormatterUtils::TIME_FORMAT_24HR, '15/06/2026 14:30', '2026-06-15 14:29:59', ['End date cannot be before start date']],
            '12-hour exact equality' => [DateFormatterUtils::DATE_FORMAT_US, DateFormatterUtils::TIME_FORMAT_12HR, '06/15/2026 2:30 pm', '2026-06-15 14:30:00', []],
            '12-hour same minute' => [DateFormatterUtils::DATE_FORMAT_US, DateFormatterUtils::TIME_FORMAT_12HR, '06/15/2026 2:30 pm', '2026-06-15 14:30:59', []],
            '12-hour later' => [DateFormatterUtils::DATE_FORMAT_US, DateFormatterUtils::TIME_FORMAT_12HR, '06/15/2026 2:30 pm', '2026-06-15 14:31:00', []],
            '12-hour earlier' => [DateFormatterUtils::DATE_FORMAT_US, DateFormatterUtils::TIME_FORMAT_12HR, '06/15/2026 2:30 pm', '2026-06-15 14:29:59', ['End date cannot be before start date']],
        ];
    }

    /** @param list<string> $expected */
    #[DataProvider('canonicalStoredEndDates')]
    public function testCanonicalStoredEndIsComparedWithLocalizedStart(
        int $format,
        int $timeFormat,
        string $start,
        string $end,
        array $expected
    ): void {
        $GLOBALS['date_display_format'] = $format;
        $GLOBALS['time_display_format'] = $timeFormat;

        self::assertSame($expected, $this->errorsFor(['date' => $start, 'date_end' => $end]));
    }

    /** @return array<string, array{int, int, string, string}> */
    public static function invalidCanonicalStoredEndDates(): array
    {
        return [
            'impossible day rollover' => [DateFormatterUtils::DATE_FORMAT_ISO, DateFormatterUtils::TIME_FORMAT_24HR, '2026-02-28 14:30', '2026-02-30 14:30:00'],
            'impossible month rollover with US display' => [DateFormatterUtils::DATE_FORMAT_US, DateFormatterUtils::TIME_FORMAT_24HR, '06/15/2026 14:30', '2026-13-15 14:30:00'],
            'impossible time rollover with international display' => [DateFormatterUtils::DATE_FORMAT_INTL, DateFormatterUtils::TIME_FORMAT_24HR, '15/06/2026 14:30', '2026-06-15 24:30:00'],
            'wrong date width' => [DateFormatterUtils::DATE_FORMAT_ISO, DateFormatterUtils::TIME_FORMAT_24HR, '2026-06-15 14:30', '2026-6-15 14:30:00'],
            'wrong time width with 12-hour display' => [DateFormatterUtils::DATE_FORMAT_US, DateFormatterUtils::TIME_FORMAT_12HR, '06/15/2026 2:30 pm', '2026-06-15 4:30:00'],
            'trailing suffix' => [DateFormatterUtils::DATE_FORMAT_ISO, DateFormatterUtils::TIME_FORMAT_24HR, '2026-06-15 14:30', '2026-06-15 14:30:00junk'],
        ];
    }

    #[DataProvider('invalidCanonicalStoredEndDates')]
    public function testMalformedCanonicalStoredEndReportsFormatError(
        int $format,
        int $timeFormat,
        string $start,
        string $end
    ): void
    {
        $GLOBALS['date_display_format'] = $format;
        $GLOBALS['time_display_format'] = $timeFormat;

        self::assertSame(['Invalid end date format'], $this->errorsFor(['date' => $start, 'date_end' => $end]));
    }

    public function testLocalizedDisplayDateRolloverRemainsAccepted(): void
    {
        // Existing display parsing uses PHP's permissive calendar rollover.
        self::assertSame([], $this->errorsFor([
            'date' => '2026-02-28',
            'date_end' => '2026-02-30',
        ]));
    }

    /** @return array<string, array{int, int, string}> */
    public static function canonicalEndWithInvalidStart(): array
    {
        return [
            'ISO invalid start' => [DateFormatterUtils::DATE_FORMAT_ISO, DateFormatterUtils::TIME_FORMAT_24HR, 'not-a-date'],
            'US invalid start' => [DateFormatterUtils::DATE_FORMAT_US, DateFormatterUtils::TIME_FORMAT_24HR, 'not-a-date'],
            'international invalid start' => [DateFormatterUtils::DATE_FORMAT_INTL, DateFormatterUtils::TIME_FORMAT_24HR, 'not-a-date'],
            '12-hour invalid start' => [DateFormatterUtils::DATE_FORMAT_US, DateFormatterUtils::TIME_FORMAT_12HR, 'not-a-date'],
        ];
    }

    #[DataProvider('canonicalEndWithInvalidStart')]
    public function testCanonicalEndDoesNotHideInvalidStart(int $format, int $timeFormat, string $start): void
    {
        $GLOBALS['date_display_format'] = $format;
        $GLOBALS['time_display_format'] = $timeFormat;

        self::assertSame(['Invalid date format'], $this->errorsFor([
            'date' => $start,
            'date_end' => '2026-06-15 14:31:00',
        ]));
    }

    /** @return array<string, array{bool, ?string}> */
    public static function optionalEndDates(): array
    {
        return [
            'omitted' => [false, null],
            'null' => [true, null],
            'empty' => [true, ''],
        ];
    }

    #[DataProvider('optionalEndDates')]
    public function testOptionalEndDateIsAccepted(bool $includeEnd, ?string $end): void
    {
        $dates = ['date' => '2026-06-15'];
        if ($includeEnd) {
            $dates['date_end'] = $end;
        }

        self::assertSame([], $this->errorsFor($dates));
    }

    /** @return array<string, array{bool, ?string, string, list<string>}> */
    public static function invalidOrMissingStarts(): array
    {
        return [
            'invalid start, valid end' => [true, 'not-a-date', '2026-06-16', ['Invalid date format']],
            'invalid start and end' => [true, 'not-a-date', 'also-not-a-date', ['Invalid date format', 'Invalid end date format']],
            'missing start, valid end' => [false, null, '2026-06-16', ['Date is required']],
            'missing start, invalid end' => [false, null, 'not-a-date', ['Date is required', 'Invalid end date format']],
            'empty start, valid end' => [true, '', '2026-06-16', ['Date is required']],
        ];
    }

    /** @param list<string> $expected */
    #[DataProvider('invalidOrMissingStarts')]
    public function testEndIsValidatedIndependentlyOfInvalidOrMissingStart(
        bool $includeStart,
        ?string $start,
        string $end,
        array $expected
    ): void {
        $dates = ['date_end' => $end];
        if ($includeStart) {
            $dates['date'] = $start;
        }

        self::assertSame($expected, $this->errorsFor($dates));
    }
}
