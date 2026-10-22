<?php

/**
 * Finite REPEAT_ON calendar window regression coverage.
 *
 * The three legacy functions below are extracted verbatim from their shipped
 * sources. Including pnuserapi.php or appointments.inc.php would execute their
 * application bootstrap. Only postcalendar_getDate is substituted, in this
 * test namespace, to pin the requested display month without a session.
 *
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Common\Calendar;

use DateInterval;
use DatePeriod;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
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
        $this->hadViewDate = array_key_exists('repeatOnWindowViewDate', $GLOBALS);
        $this->previousViewDate = $GLOBALS['repeatOnWindowViewDate'] ?? null;
        date_default_timezone_set('UTC');

        require_once __DIR__ . '/../../../../../interface/main/calendar/modules/PostCalendar/pnincludes/Date/Calc.php';

        // These constants are normally declared by common.api.php, whose
        // top-level module configuration cannot run in an isolated test.
        foreach (['NO_REPEAT' => 0, 'REPEAT' => 1, 'REPEAT_ON' => 2, 'REPEAT_DAYS' => 3] as $name => $value) {
            if (!defined($name)) {
                define($name, $value);
            }
        }

        $calendar = __DIR__ . '/../../../../../interface/main/calendar/modules/PostCalendar/';
        self::loadFunction($calendar . 'pnuserapi.php', 'calculateEvents');
        self::loadFunction($calendar . 'common.api.php', 'pcGetTopicName');
        self::loadFunction(__DIR__ . '/../../../../../library/appointments.inc.php', 'checkEvent');

        // A namespace-local seam: calculateEvents resolves this unqualified
        // call here, while its other calls use the extracted shipped functions.
        eval('namespace ' . __NAMESPACE__ . '; function postcalendar_getDate(): string {
            return $GLOBALS["repeatOnWindowViewDate"];
        }');
    }

    protected function tearDown(): void
    {
        date_default_timezone_set($this->previousTimezone);
        if ($this->hadViewDate) {
            $GLOBALS['repeatOnWindowViewDate'] = $this->previousViewDate;
        } else {
            unset($GLOBALS['repeatOnWindowViewDate']);
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

    /** @param array<string, mixed> $event
     *  @param list<string> $expected
     */
    private function assertOccurrences(string $first, string $last, string $viewDate, array $event, array $expected): void
    {
        $GLOBALS['repeatOnWindowViewDate'] = $viewDate;
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

        $calculator = __NAMESPACE__ . '\\calculateEvents';
        if (!function_exists($calculator)) {
            throw new RuntimeException('calculateEvents fixture did not load.');
        }
        /** @var array<string, list<array<string, mixed>>> $actual */
        $actual = $calculator($days, [$event], 'month');
        $populated = [];
        foreach ($actual as $date => $events) {
            if ($events !== []) {
                self::assertSame([$event], $events, "Unexpected event payload on $date");
                $populated[] = $date;
            }
        }
        self::assertSame($expected, $populated);
    }

    private static function loadFunction(string $path, string $name): void
    {
        $source = file_get_contents($path);
        if ($source === false || !preg_match('/\bfunction\s+&?\s*' . preg_quote($name, '/') . '\s*\(/', $source, $match, PREG_OFFSET_CAPTURE)) {
            throw new RuntimeException("Cannot locate $name in $path");
        }

        $start = $match[0][1];
        $fragment = substr($source, $start);
        $depth = 0;
        $opened = false;
        $length = 0;
        foreach (token_get_all('<?php ' . $fragment) as $token) {
            $text = is_array($token) ? $token[1] : $token;
            if ($text === '{') {
                $opened = true;
                ++$depth;
            } elseif ($text === '}') {
                --$depth;
                if ($opened && $depth === 0) {
                    $length += strlen($text);
                    break;
                }
            }
            $length += strlen($text);
        }
        if (!$opened || $depth !== 0) {
            throw new RuntimeException("Cannot isolate $name in $path");
        }

        // The injected opening tag belongs to token_get_all, not the source.
        $body = substr($fragment, 0, $length - strlen('<?php '));
        eval('namespace ' . __NAMESPACE__ . '; use \\Date_Calc; ' . $body);
    }
}
