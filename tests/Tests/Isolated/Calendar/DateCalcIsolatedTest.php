<?php

/**
 * Regression coverage for the inherited PostCalendar Date_Calc helper.
 *
 * Oracles are known Gregorian calendar facts (weekdays, leap rules, month
 * lengths) and Julian Day Numbers derived independently via
 * DateTimeImmutable, not values read back from Date_Calc itself.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Calendar;

use Date_Calc;
use DateTimeImmutable;
use DateTimeZone;
use Locale;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
#[Group('postcalendar')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class DateCalcIsolatedTest extends TestCase
{
    /** Julian Day Number of the Unix epoch, 1970-01-01. */
    private const UNIX_EPOCH_JDN = 2440588;

    private string $previousTimezone;

    private string $previousLocale;

    protected function setUp(): void
    {
        // Each test runs in its own child process without inherited global
        // state, so this process-wide constant never leaks into other suites.
        // common.api.php normally defines it from the PostCalendar
        // first-day-of-week setting; Monday (1) is the documented default.
        \define('DATE_CALC_BEGIN_WEEKDAY', 1);
        require_once __DIR__ . '/../../../../interface/main/calendar/modules/PostCalendar/pnincludes/Date/Calc.php';

        $this->previousTimezone = date_default_timezone_get();
        $this->previousLocale = Locale::getDefault();
        date_default_timezone_set('UTC');
        Locale::setDefault('en_US');
    }

    protected function tearDown(): void
    {
        date_default_timezone_set($this->previousTimezone);
        Locale::setDefault($this->previousLocale);
    }

    /**
     * @return array<string, array{string, string, string, float}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function knownWeekdayProvider(): array
    {
        return [
            'gregorian reform day'      => ['15', '10', '1582', 5.0],
            '1600 leap day'             => ['29', '02', '1600', 2.0],
            '1900 not a leap year'      => ['01', '03', '1900', 4.0],
            'y2k eve'                   => ['31', '12', '1999', 5.0],
            'y2k'                       => ['01', '01', '2000', 6.0],
            '2000 leap day'             => ['29', '02', '2000', 2.0],
            '2024 leap day'             => ['29', '02', '2024', 4.0],
            'unix 32-bit overflow date' => ['19', '01', '2038', 2.0],
            '2100 not a leap year'      => ['01', '03', '2100', 1.0],
        ];
    }

    #[DataProvider('knownWeekdayProvider')]
    public function testDayOfWeekAndDayNumberRoundTripMatchGregorianCalendar(
        string $day,
        string $month,
        string $year,
        float $weekday,
    ): void {
        $date = new DateTimeImmutable("{$year}-{$month}-{$day}", new DateTimeZone('UTC'));
        $jdn = intdiv($date->getTimestamp(), 86400) + self::UNIX_EPOCH_JDN;

        self::assertSame($weekday, Date_Calc::dayOfWeek($day, $month, $year));
        self::assertSame((float) $jdn, Date_Calc::dateToDays($day, $month, $year));
        self::assertSame("{$year}-{$month}-{$day}", Date_Calc::daysToDate($jdn, '%Y-%m-%d'));
    }

    public function testLeapYearMonthLengthAndDateValidity(): void
    {
        self::assertTrue(Date_Calc::isLeapYear('2000'));
        self::assertTrue(Date_Calc::isLeapYear('2024'));
        self::assertFalse(Date_Calc::isLeapYear('1900'));
        self::assertFalse(Date_Calc::isLeapYear('2023'));
        self::assertFalse(Date_Calc::isLeapYear('24'), 'two-digit years are rejected');

        self::assertSame(29, Date_Calc::daysInMonth('02', '2000'));
        self::assertSame(28, Date_Calc::daysInMonth('02', '1900'));
        self::assertSame(30, Date_Calc::daysInMonth('04', '2023'));
        self::assertSame(31, Date_Calc::daysInMonth('12', '2023'));

        self::assertTrue(Date_Calc::isValidDate('29', '02', '2024'));
        self::assertFalse(Date_Calc::isValidDate('29', '02', '2023'));
        self::assertFalse(Date_Calc::isValidDate('31', '04', '2024'));
        self::assertFalse(Date_Calc::isValidDate('01', '13', '2024'));
        self::assertFalse(Date_Calc::isValidDate('1a', '01', '2024'));
    }

    public function testQuarterCenturyAndDateDifference(): void
    {
        self::assertSame(1, Date_Calc::quarterOfYear('31', '03', '2024'));
        self::assertSame(2, Date_Calc::quarterOfYear('01', '04', '2024'));
        self::assertSame(4, Date_Calc::quarterOfYear('31', '12', '2024'));

        self::assertSame('2007', Date_Calc::defaultCentury('7'));
        self::assertSame('2050', Date_Calc::defaultCentury('50'));
        self::assertSame('1951', Date_Calc::defaultCentury('51'));

        self::assertSame(366, Date_Calc::dateDiff('01', '01', '2000', '01', '01', '2001'));
        self::assertSame(2, Date_Calc::dateDiff('01', '03', '2024', '28', '02', '2024'));
        self::assertSame(-1, Date_Calc::dateDiff('30', '02', '2024', '01', '01', '2024'));
        self::assertSame(-1, Date_Calc::dateDiff('01', '01', '2024', '31', '04', '2024'));
    }

    public function testMonthBoundaryNavigationAcrossYearsAndLeapFebruary(): void
    {
        self::assertSame('20250101', Date_Calc::beginOfNextMonth('15', '12', '2024'));
        self::assertSame('20240201', Date_Calc::beginOfNextMonth('31', '01', '2024'));
        self::assertSame('20240229', Date_Calc::endOfNextMonth('31', '01', '2024'));
        self::assertSame('20240131', Date_Calc::endOfNextMonth('15', '12', '2023'));
        self::assertSame('20231201', Date_Calc::beginOfPrevMonth('15', '01', '2024'));
        self::assertSame('20240201', Date_Calc::beginOfPrevMonth('15', '03', '2024'));
        self::assertSame('20230228', Date_Calc::endOfPrevMonth('15', '03', '2023'));
        self::assertSame('20231231', Date_Calc::endOfPrevMonth('15', '01', '2024'));
        self::assertSame('2024-02-01', Date_Calc::beginOfMonth('02', '2024', '%Y-%m-%d'));
    }

    public function testDayAndWeekdayStepping(): void
    {
        self::assertSame('20240229', Date_Calc::nextDay('28', '02', '2024'));
        self::assertSame('20000101', Date_Calc::nextDay('31', '12', '1999'));
        self::assertSame('20230228', Date_Calc::prevDay('01', '03', '2023'));
        self::assertSame('19991231', Date_Calc::prevDay('01', '01', '2000'));

        // 2024-10-04 is a Friday, 10-05 a Saturday, 10-06 a Sunday, 10-07 a Monday.
        self::assertSame('20241007', Date_Calc::nextWeekday('04', '10', '2024'));
        self::assertSame('20241007', Date_Calc::nextWeekday('05', '10', '2024'));
        self::assertSame('20241003', Date_Calc::nextWeekday('02', '10', '2024'));
        self::assertSame('20241004', Date_Calc::prevWeekday('07', '10', '2024'));
        self::assertSame('20241004', Date_Calc::prevWeekday('06', '10', '2024'));
        self::assertSame('20241002', Date_Calc::prevWeekday('03', '10', '2024'));
    }

    /**
     * @return array<string, array{int, bool, string, string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function dayOfWeekSearchProvider(): array
    {
        // Anchor: Wednesday 2024-10-02.
        return [
            'same weekday, strictly next/prev' => [3, false, '20241009', '20240925'],
            'same weekday, inclusive'          => [3, true, '20241002', '20241002'],
            'earlier weekday (Monday)'         => [1, false, '20241007', '20240930'],
            'later weekday (Friday)'           => [5, false, '20241004', '20240927'],
        ];
    }

    #[DataProvider('dayOfWeekSearchProvider')]
    public function testNextAndPrevDayOfWeek(int $dow, bool $inclusive, string $next, string $prev): void
    {
        self::assertSame($next, Date_Calc::nextDayOfWeek($dow, '02', '10', '2024', '%Y%m%d', $inclusive));
        self::assertSame($prev, Date_Calc::prevDayOfWeek($dow, '02', '10', '2024', '%Y%m%d', $inclusive));
    }

    public function testMondayStartWeekBoundaries(): void
    {
        // 2024-10-06 is a Sunday (the Monday-start special case); 10-02 a Wednesday.
        self::assertSame('20240930', Date_Calc::beginOfWeek('06', '10', '2024'));
        self::assertSame('20240930', Date_Calc::beginOfWeek('02', '10', '2024'));
        self::assertSame('20241006', Date_Calc::endOfWeek('02', '10', '2024'));
        self::assertSame('20241007', Date_Calc::beginOfNextWeek('02', '10', '2024'));
        self::assertSame('20240923', Date_Calc::beginOfPrevWeek('02', '10', '2024'));
        self::assertSame('20241230', Date_Calc::beginOfNextWeek('28', '12', '2024'));

        self::assertSame(
            ['2024-12-30', '2024-12-31', '2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05'],
            Date_Calc::getCalendarWeek('31', '12', '2024', '%Y-%m-%d'),
        );
    }

    public function testMondayStartMonthGrid(): void
    {
        // September 2024 starts on a Sunday, so it spans six Monday-start rows.
        self::assertSame(0.0, Date_Calc::firstOfMonthWeekday('09', '2024'));
        self::assertSame(6.0, Date_Calc::weeksInMonth('09', '2024'));
        // February 2021 starts on a Monday and has exactly 28 days.
        self::assertSame(4.0, Date_Calc::weeksInMonth('02', '2021'));
        // February 2015 starts on a Sunday: one leading day plus four full weeks.
        self::assertSame(5.0, Date_Calc::weeksInMonth('02', '2015'));

        self::assertSame(
            self::mondayStartGrid('2024-08-26', 6),
            Date_Calc::getCalendarMonth('09', '2024', '%Y-%m-%d'),
        );

        $year = Date_Calc::getCalendarYear('2024', '%Y-%m-%d');
        self::assertCount(12, $year);
        // 2024-01-01 is a Monday, so January's grid starts on the 1st.
        self::assertSame(self::mondayStartGrid('2024-01-01', 5), $year[0]);
        self::assertSame(self::mondayStartGrid('2024-01-29', 5), $year[1]);
        // 2024-12-01 is a Sunday, so December needs six rows ending 2025-01-05.
        self::assertSame(self::mondayStartGrid('2024-11-25', 6), $year[11]);
    }

    public function testNthWeekdayOfMonth(): void
    {
        self::assertSame('20000108', Date_Calc::NWeekdayOfMonth('2', '6', '01', '2000'));
        self::assertSame('2024-02-29', Date_Calc::NWeekdayOfMonth('5', '4', '02', '2024', '%Y-%m-%d'));
        self::assertSame(-1, Date_Calc::NWeekdayOfMonth('5', '1', '02', '2024'));
    }

    public function testDateFormatTokens(): void
    {
        // 2024-02-29: Thursday, day 60 of the year, JDN 2460370.
        self::assertSame(
            "Thu Thursday Feb February 29 29 2460370 60 02 4 24 2024 % %q|\n|\t",
            Date_Calc::dateFormat('29', '02', '2024', '%a %A %b %B %d %e %E %j %m %w %y %Y %% %q|%n|%t'),
        );
    }

    public function testMonthAndWeekdayNames(): void
    {
        $months = Date_Calc::getMonthNames();
        self::assertCount(12, $months);
        self::assertSame('January', $months[1]);
        self::assertSame('December', $months[12]);
        self::assertSame(
            [0 => 'Sunday', 1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday', 6 => 'Saturday'],
            Date_Calc::getWeekDays(),
        );

        self::assertSame('September', Date_Calc::getMonthFullname('09'));
        self::assertSame('Sep', Date_Calc::getMonthAbbrname('09'));
        self::assertSame('Thursday', Date_Calc::getWeekdayFullname('29', '02', '2024'));
        self::assertSame('Th', Date_Calc::getWeekdayAbbrname('29', '02', '2024', 2));
        self::assertSame(8, Date_Calc::getMonthFromFullName('AUG'));
        self::assertSame(0, Date_Calc::getMonthFromFullName('notamonth'));
    }

    public function testJulianDateAndWeekOfYearStepping(): void
    {
        self::assertSame(60, Date_Calc::julianDate('29', '02', '2024'));
        self::assertSame(60, Date_Calc::julianDate('01', '03', '2023'));
        self::assertSame(366, Date_Calc::julianDate('31', '12', '2024'));

        // Legacy non-ISO numbering: only these explicit 2024 dates are pinned
        // (Jan 1 is week 1; seven days later is one week later). No general
        // week-numbering contract is claimed; the documented "first Sunday
        // starts week one" rule does not hold: 2024-12-31 yields week 54.
        self::assertSame(1.0, Date_Calc::weekOfYear('01', '01', '2024'));
        self::assertSame(
            Date_Calc::weekOfYear('15', '05', '2024') + 1.0,
            Date_Calc::weekOfYear('22', '05', '2024'),
        );
    }

    public function testCurrentDateHelpersAndRelativeDateChecks(): void
    {
        $before = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $now = Date_Calc::dateNow('%Y-%m-%d');
        $parts = [Date_Calc::getYear(), Date_Calc::getMonth(), Date_Calc::getDay()];
        $after = new DateTimeImmutable('now', new DateTimeZone('UTC'));

        self::assertContains($now, [$before->format('Y-m-d'), $after->format('Y-m-d')]);
        self::assertContains(implode('-', $parts), [$before->format('Y-m-d'), $after->format('Y-m-d')]);

        self::assertTrue(Date_Calc::isFutureDate('01', '01', '9999'));
        self::assertFalse(Date_Calc::isPastDate('01', '01', '9999'));
        self::assertTrue(Date_Calc::isPastDate('01', '01', '1000'));
        self::assertFalse(Date_Calc::isFutureDate('01', '01', '1000'));
    }

    /**
     * Expected calendar grid built from DateTimeImmutable, independent of Date_Calc.
     *
     * @return list<list<string>>
     */
    private static function mondayStartGrid(string $firstMonday, int $rows): array
    {
        $day = new DateTimeImmutable($firstMonday, new DateTimeZone('UTC'));
        $grid = [];
        for ($row = 0; $row < $rows; $row++) {
            $week = [];
            for ($column = 0; $column < 7; $column++) {
                $week[] = $day->format('Y-m-d');
                $day = $day->modify('+1 day');
            }
            $grid[] = $week;
        }
        return $grid;
    }
}
