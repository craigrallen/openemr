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
use PHPUnit\Framework\TestCase;
use ReflectionClass;

#[Group('isolated')]
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

        /** @var list<string> $errors Legacy service return type does not specify its elements. */
        $errors = $this->service->validateObservationData(array_merge($observation, $dates));
        return $errors;
    }

    /** @return array<string, array{int, string, string}> */
    public static function invalidEndDates(): array
    {
        return [
            'ISO' => [DateFormatterUtils::DATE_FORMAT_ISO, '2026-06-15', 'not-a-date'],
            'US' => [DateFormatterUtils::DATE_FORMAT_US, '06/15/2026', 'not-a-date'],
            'international' => [DateFormatterUtils::DATE_FORMAT_INTL, '15/06/2026', 'not-a-date'],
            // The validator uses the formatter's default includeSeconds=false.
            'seconds are not accepted by the default 24-hour parser' => [
                DateFormatterUtils::DATE_FORMAT_ISO,
                '2026-06-15 14:30',
                '2026-06-15 14:31:00',
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
