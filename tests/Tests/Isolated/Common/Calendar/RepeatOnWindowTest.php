<?php

/**
 * Finite REPEAT_ON calendar window regression coverage.
 *
 * The shipped calendar and appointment sources are included by a CLI-only
 * fixture with fixed module configuration and an in-memory session.
 *
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Common\Calendar;

use DateInterval;
use DatePeriod;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use ErrorException;
use OpenEMR\Tests\Isolated\Common\Calendar\Fixtures\RepeatOnWindowFixture;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use ReflectionFunction;
use RuntimeException;

#[Group('isolated')]
#[Group('postcalendar')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class RepeatOnWindowTest extends TestCase
{
    private string $previousTimezone;

    private bool $hadViewDate;

    private mixed $previousViewDate;

    protected function setUp(): void
    {
        if (PHP_SAPI !== 'cli') {
            throw new RuntimeException('This calendar fixture is CLI only.');
        }

        $this->previousTimezone = date_default_timezone_get();
        $this->hadViewDate = array_key_exists('Date', $GLOBALS);
        $this->previousViewDate = $GLOBALS['Date'] ?? null;
        date_default_timezone_set('UTC');

        require_once __DIR__ . '/fixtures/repeat-on-window.php';
        $connection = $this->createMock(Connection::class);
        $moduleIdQuery = 'SELECT fixture_modules.pn_id FROM fixture_modules WHERE fixture_modules.pn_name = ?';
        $moduleInfoQuery = 'SELECT fixture_modules.pn_name, fixture_modules.pn_type, '
            . 'fixture_modules.pn_directory, fixture_modules.pn_regid, '
            . 'fixture_modules.pn_displayname, fixture_modules.pn_description, '
            . 'fixture_modules.pn_version FROM fixture_modules WHERE fixture_modules.pn_id = ?';
        $connection->expects(self::once())->method('fetchOne')->with(
            self::callback(static fn (string $sql): bool => preg_replace('/\s+/', ' ', trim($sql)) === $moduleIdQuery),
            ['PostCalendar']
        )->willReturn(1);
        $connection->expects(self::once())->method('fetchNumeric')->with(
            self::callback(static fn (string $sql): bool => preg_replace('/\s+/', ' ', trim($sql)) === $moduleInfoQuery),
            [1]
        )->willReturn(['PostCalendar', 0, 'PostCalendar', 1, 'PostCalendar', '', '1']);
        $forbiddenIo = [
            'executeQuery', 'executeCacheQuery', 'executeStatement', 'prepare',
            'insert', 'update', 'delete', 'lastInsertId', 'transactional',
            'beginTransaction', 'commit', 'rollBack', 'createSavepoint',
            'rollbackSavepoint', 'getNativeConnection', 'fetchAssociative',
            'fetchAllAssociative', 'fetchAllAssociativeIndexed',
            'fetchAllNumeric', 'fetchAllKeyValue', 'fetchFirstColumn',
        ];
        foreach ($forbiddenIo as $operation) {
            $connection->method($operation)->willThrowException(new RuntimeException("Unexpected DB operation: $operation"));
        }
        RepeatOnWindowFixture::load($connection);
        self::assertSame(
            realpath(__DIR__ . '/../../../../../interface/main/calendar/modules/PostCalendar/pnuserapi.php'),
            (new ReflectionFunction('calculateEvents'))->getFileName()
        );
    }

    protected function tearDown(): void
    {
        date_default_timezone_set($this->previousTimezone);
        if ($this->hadViewDate) {
            $GLOBALS['Date'] = $this->previousViewDate;
        } else {
            unset($GLOBALS['Date']);
        }
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function timezoneProvider(): array
    {
        return [
            'UTC' => ['UTC', '20270115'],
            'Europe Stockholm' => ['Europe/Stockholm', '20270115'],
        ];
    }

    #[DataProvider('timezoneProvider')]
    public function testJanuaryViewRetainsDecemberAndJanuaryLastTuesdays(string $timezone, string $viewDate): void
    {
        date_default_timezone_set($timezone);
        // January 2027 has six Sunday-to-Saturday rows: Dec 27 through Feb 6.
        $this->assertOccurrences(
            '2026-12-27', '2027-02-06', $viewDate,
            self::repeatOn('2026-12-29', '2027-01-26', number: 5),
            ['2026-12-29', '2027-01-26']
        );
    }

    public function testDecemberViewRetainsDecemberAndJanuaryFirstTuesdays(): void
    {
        // December 2023 has six rows: Nov 26 through Jan 6.
        $this->assertOccurrences(
            '2023-11-26', '2024-01-06', '20231215',
            self::repeatOn('2023-12-05', '2024-01-02', number: 1),
            ['2023-12-05', '2024-01-02']
        );
    }

    public function testFiniteStopIsInclusiveAndExclusionsStillApply(): void
    {
        // Jan 5 and Feb 2 are the first Tuesdays inside Jan's Dec 27-Feb 6 grid.
        $this->assertOccurrences(
            '2026-12-27', '2027-02-06', '20270115',
            self::repeatOn('2027-01-05', '2027-02-02', number: 1),
            ['2027-01-05', '2027-02-02']
        );
        $this->assertOccurrences(
            '2026-12-27', '2027-02-06', '20270115',
            self::repeatOn('2027-01-05', '2027-02-01', number: 1),
            ['2027-01-05']
        );
        $this->assertOccurrences(
            '2026-12-27', '2027-02-06', '20270115',
            self::repeatOn('2027-01-05', '2027-02-02', number: 1, exdate: '20270202'),
            ['2027-01-05']
        );
    }

    public function testFutureSeriesStartDoesNotBackfillEarlierMonth(): void
    {
        // December's displayed grid ends Jan 6; the series starts Jan 2.
        $this->assertOccurrences(
            '2023-11-26', '2024-01-06', '20231215',
            self::repeatOn('2024-01-02', '2024-02-28', number: 1),
            ['2024-01-02']
        );
    }

    public function testEveryTwoMonthsPreservesPhaseAcrossNewYear(): void
    {
        // Starting in November makes January the next active month in Dec's grid.
        $this->assertOccurrences(
            '2023-11-26', '2024-01-06', '20231215',
            self::repeatOn('2023-11-07', '2024-02-28', frequency: 2, number: 1),
            ['2024-01-02']
        );
    }

    public function testLastThursdayUsesLeapFebruaryAndSameYearMonth(): void
    {
        // February 2024 has five rows: Jan 28 through Mar 2.
        $this->assertOccurrences(
            '2024-01-28', '2024-03-02', '20240215',
            self::repeatOn('2024-01-25', '2024-02-29', number: 5, weekday: 4),
            ['2024-02-29']
        );
        // March 2024 has six rows: Feb 25 through Apr 6.
        $this->assertOccurrences(
            '2024-02-25', '2024-04-06', '20240315',
            self::repeatOn('2024-02-29', '2024-03-28', number: 5, weekday: 4),
            ['2024-02-29', '2024-03-28']
        );
    }

    public function testLegacySeriesStartInsideMonthBackfillsEarlierWeekday(): void
    {
        // Preserve the existing REPEAT_ON behavior: the rule can place an
        // occurrence before eventDate in its starting month. This assertion
        // records legacy behavior, not a policy decision about start dates.
        $this->assertOccurrences(
            '2024-01-28', '2024-03-02', '20240215',
            self::repeatOn('2024-02-20', '2024-03-31', number: 1),
            ['2024-02-06']
        );
    }

    public function testNullEndDateReturnsNoOccurrencesWithoutDiagnostics(): void
    {
        // A null-ended row can reach calculateEvents with a valid REPEAT_ON
        // specification; it does not authorize an indefinite recurrence.
        $this->assertOccurrences(
            '2024-01-28', '2024-03-02', '20240215',
            self::repeatOnWithEndDate(null),
            [],
            rejectDiagnostics: true
        );
    }

    public function testMissingAndZeroRepeatOnFieldsAreRejectedByCheckEvent(): void
    {
        foreach (['event_repeat_on_freq', 'event_repeat_on_num', 'event_repeat_on_day'] as $field) {
            $missing = self::repeatOn('2024-02-01', '2024-02-29', number: 1);
            $spec = unserialize($missing['recurrspec'], ['allowed_classes' => false]);
            self::assertIsArray($spec);
            unset($spec[$field]);
            $missing['recurrspec'] = serialize($spec);
            $this->assertOccurrences('2024-01-28', '2024-03-02', '20240215', $missing, []);
        }

        foreach (['event_repeat_on_freq', 'event_repeat_on_num'] as $field) {
            $zero = self::repeatOn('2024-02-01', '2024-02-29', number: 1);
            $spec = unserialize($zero['recurrspec'], ['allowed_classes' => false]);
            self::assertIsArray($spec);
            $spec[$field] = 0;
            $zero['recurrspec'] = serialize($spec);
            $this->assertOccurrences('2024-01-28', '2024-03-02', '20240215', $zero, []);
        }

        $nullWeekday = self::repeatOn('2024-02-01', '2024-02-29', number: 1);
        $spec = unserialize($nullWeekday['recurrspec'], ['allowed_classes' => false]);
        self::assertIsArray($spec);
        $spec['event_repeat_on_day'] = null;
        $nullWeekday['recurrspec'] = serialize($spec);
        $this->assertOccurrences('2024-01-28', '2024-03-02', '20240215', $nullWeekday, []);
    }

    public function testSundayZeroIsAValidRepeatOnWeekday(): void
    {
        $this->assertOccurrences(
            '2024-01-28', '2024-03-02', '20240215',
            self::repeatOn('2024-02-01', '2024-02-29', number: 1, weekday: 0),
            ['2024-02-04']
        );
    }

    public function testEveryTwoMonthsKeepsMidyearPhaseAcrossGridBounds(): void
    {
        $event = self::repeatOn('2024-01-02', '2024-06-30', frequency: 2, number: 1);
        // April's grid contains March 31, but the next active month is May.
        $this->assertOccurrences('2024-03-31', '2024-05-04', '20240415', $event, []);
        $this->assertOccurrences('2024-04-28', '2024-06-01', '20240515', $event, ['2024-05-07']);
    }

    public function testHistoricalUnflaggedDayOverflowRemainsDistinct(): void
    {
        // Jan 31 + one month overflows past February in the legacy series.
        $unflagged = self::repeatOn('2024-01-31', '2024-03-31', number: 1);
        $unflagged['recurrspec'] = serialize([
            'event_repeat_on_freq' => 1,
            'event_repeat_on_num' => 1,
            'event_repeat_on_day' => 2,
            'exdate' => '',
        ]);
        $this->assertOccurrences('2024-01-28', '2024-03-02', '20240215', $unflagged, []);
        $this->assertOccurrences(
            '2024-01-28', '2024-03-02', '20240215',
            self::repeatOn('2024-01-31', '2024-03-31', number: 1),
            ['2024-02-06']
        );
    }

    public function testNonRecurringEventIsPreserved(): void
    {
        $event = [
            'topic' => 0,
            'eventDate' => '2024-01-02',
            'startTime' => '09:00:00',
            'recurrtype' => 0, // NO_REPEAT from common.api.php
        ];
        $this->assertOccurrences('2023-11-26', '2024-01-06', '20231215', $event, ['2024-01-02']);
    }

    /** @return array{topic: int, eventDate: string, startTime: string, recurrtype: int, endDate: string, recurrspec: string} */
    private static function repeatOn(
        string $start,
        string $end,
        int $frequency = 1,
        int $number = 2,
        int $weekday = 2,
        string $exdate = ''
    ): array {
        return [
            'topic' => 0,
            'eventDate' => $start,
            'startTime' => '09:00:00',
            'recurrtype' => 2, // REPEAT_ON from common.api.php
            'endDate' => $end,
            'recurrspec' => serialize([
                'event_repeat_on_freq' => $frequency,
                'event_repeat_on_num' => $number,
                'event_repeat_on_day' => $weekday,
                'exdate' => $exdate,
                'rt2_pf_flag' => true,
            ]),
        ];
    }

    /** @return array<string, mixed> */
    private static function repeatOnWithEndDate(mixed $endDate): array
    {
        $event = self::repeatOn('2024-02-06', '2024-02-27', number: 1);
        $event['endDate'] = $endDate;
        return $event;
    }

    /** @param array<string, mixed> $event
     *  @param list<string> $expected
     */
    private function assertOccurrences(
        string $first,
        string $last,
        string $viewDate,
        array $event,
        array $expected,
        bool $rejectDiagnostics = false
    ): void
    {
        $GLOBALS['Date'] = $viewDate;
        // Check the supplied bounds against a Sunday-to-Saturday month grid
        // using PHP's calendar, independently of the shipped Date_Calc helper.
        $month = DateTimeImmutable::createFromFormat('!Ymd', $viewDate);
        if ($month === false) {
            throw new RuntimeException("Invalid view date: $viewDate");
        }
        $monthStart = $month->modify('first day of this month');
        $monthEnd = $month->modify('last day of this month');
        $gridStart = $monthStart->sub(new DateInterval('P' . $monthStart->format('w') . 'D'));
        $gridEnd = $monthEnd->add(new DateInterval('P' . (6 - (int) $monthEnd->format('w')) . 'D'));
        self::assertSame($gridStart->format('Y-m-d'), $first);
        self::assertSame($gridEnd->format('Y-m-d'), $last);
        self::assertContains((int) $gridStart->diff($gridEnd)->format('%a') + 1, [35, 42]);

        $days = [];
        $until = (new DateTimeImmutable($last))->add(new DateInterval('P1D'));
        foreach (new DatePeriod(new DateTimeImmutable($first), new DateInterval('P1D'), $until) as $day) {
            $days[$day->format('Y-m-d')] = [];
        }

        if ($rejectDiagnostics) {
            set_error_handler(static function (int $severity, string $message): never {
                throw new ErrorException($message, 0, $severity);
            });
            try {
                $actual = \calculateEvents($days, [$event], 'month');
            } finally {
                restore_error_handler();
            }
        } else {
            $actual = \calculateEvents($days, [$event], 'month');
        }
        self::assertIsArray($actual);
        $populated = [];
        foreach ($actual as $date => $events) {
            self::assertIsString($date);
            self::assertIsArray($events);
            if ($events !== []) {
                self::assertSame([$event], $events, "Unexpected event payload on $date");
                $populated[] = $date;
            }
        }
        self::assertSame($expected, $populated);
    }

}
