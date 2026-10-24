<?php

/**
 * Elapsed-display regression coverage for the patient tracker service.
 *
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use DateTimeImmutable;
use OpenEMR\Services\PatientTrackerService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class PatientTrackerIntervalTest extends TestCase
{
    private string $previousTimezone;
    private bool $hadDisableTranslation;
    private mixed $previousDisableTranslation;

    protected function setUp(): void
    {
        // Loading BaseService includes code_types.inc.php, whose top-level SQL
        // read is skipped only with this constant. Each test has a fresh child
        // process because the constant cannot be undone.
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }

        $this->previousTimezone = date_default_timezone_get();
        $this->hadDisableTranslation = array_key_exists('disable_translation', $GLOBALS);
        $this->previousDisableTranslation = $GLOBALS['disable_translation'] ?? null;
        $GLOBALS['disable_translation'] = true;

        // Use OpenEMR's real xl() in its untranslated mode. This avoids a
        // translation-cache lookup or SQL query while retaining the production
        // unit words. These tests do not assert translated-language wording.
        require_once dirname(__DIR__, 4) . '/library/translation.inc.php';
        date_default_timezone_set('UTC');
    }

    protected function tearDown(): void
    {
        date_default_timezone_set($this->previousTimezone);
        if ($this->hadDisableTranslation) {
            $GLOBALS['disable_translation'] = $this->previousDisableTranslation;
        } else {
            unset($GLOBALS['disable_translation']);
        }
    }

    /**
     * Expected text is literal contract data, independent of the formatter.
     * The minute-only mode rounds the remaining seconds without carrying a
     * rounded 60 minutes into the next unit.
     *
     * @return array<string, array{int, string, string}>
     */
    public static function elapsedSeconds(): array
    {
        return [
            'zero' => [0, '', ''],
            'one second' => [1, '', '1 second'],
            'twenty-nine seconds' => [29, '', '29 seconds'],
            'half minute' => [30, '1 minute', '30 seconds'],
            'fifty-nine seconds' => [59, '1 minute', '59 seconds'],
            'one minute' => [60, '1 minute', '1 minute'],
            'minute and second' => [61, '1 minute', '1 minute, 1 second'],
            'minute and fifty-nine seconds' => [119, '2 minutes', '1 minute, 59 seconds'],
            'two minutes' => [120, '2 minutes', '2 minutes'],
            'fifty-nine minutes and fifty-nine seconds' => [3599, '60 minutes', '59 minutes, 59 seconds'],
            'one hour' => [3600, '1 hour', '1 hour'],
            'hour and second' => [3601, '1 hour', '1 hour, 1 second'],
            'hour and minute' => [3660, '1 hour, 1 minute', '1 hour, 1 minute'],
            'hour minute second' => [3661, '1 hour, 1 minute', '1 hour, 1 minute, 1 second'],
            'hour and fifty-nine minutes fifty-nine seconds' => [7199, '1 hour, 60 minutes', '1 hour, 59 minutes, 59 seconds'],
            'two hours' => [7200, '2 hours', '2 hours'],
            'one second short of day' => [86399, '23 hours, 60 minutes', '23 hours, 59 minutes, 59 seconds'],
            'one day' => [86400, '1 day', '1 day'],
            'day and second' => [86401, '1 day', '1 day, 1 second'],
            'day and minute' => [86460, '1 day, 1 minute', '1 day, 1 minute'],
            'day minute second' => [86461, '1 day, 1 minute', '1 day, 1 minute, 1 second'],
            'day and hour' => [90000, '1 day, 1 hour', '1 day, 1 hour'],
            'day hour second' => [90001, '1 day, 1 hour', '1 day, 1 hour, 1 second'],
            'day hour minute second' => [90061, '1 day, 1 hour, 1 minute', '1 day, 1 hour, 1 minute, 1 second'],
            'two days' => [172800, '2 days', '2 days'],
        ];
    }

    #[DataProvider('elapsedSeconds')]
    public function testElapsedSecondsInBothDisplayModes(
        int $elapsedSeconds,
        string $withoutSeconds,
        string $withSeconds,
    ): void {
        $from = new DateTimeImmutable('2026-01-15T12:00:00+00:00');
        $to = $from->setTimestamp($from->getTimestamp() + $elapsedSeconds);
        $fromText = $from->format('Y-m-d H:i:sP');
        $toText = $to->format('Y-m-d H:i:sP');

        self::assertSame($withoutSeconds, PatientTrackerService::get_Tracker_Time_Interval($fromText, $toText));
        self::assertSame($withSeconds, PatientTrackerService::get_Tracker_Time_Interval($fromText, $toText, true));
    }

    public function testBackwardTimestampIsEmptyInBothModes(): void
    {
        $later = '2026-01-15 12:00:01+00:00';
        $earlier = '2026-01-15 12:00:00+00:00';

        self::assertSame('', PatientTrackerService::get_Tracker_Time_Interval($later, $earlier));
        self::assertSame('', PatientTrackerService::get_Tracker_Time_Interval($later, $earlier, true));
    }

    /** @return array<string, array{string, string, string, string}> */
    public static function timezoneIntervals(): array
    {
        return [
            'UTC exact day' => ['2026-03-29 00:00:00+00:00', '2026-03-30 00:00:00+00:00', '1 day', '1 day'],
            'Stockholm spring clock jump' => ['2026-03-29 01:59:30+01:00', '2026-03-29 03:00:30+02:00', '1 minute', '1 minute'],
            'Stockholm spring local dates span 23 hours' => ['2026-03-29 00:00:00+01:00', '2026-03-30 00:00:00+02:00', '23 hours', '23 hours'],
            'Stockholm autumn clock repeat' => ['2026-10-25 02:59:30+02:00', '2026-10-25 02:00:30+01:00', '1 minute', '1 minute'],
            'Stockholm autumn local dates span 25 hours' => ['2026-10-25 00:00:00+02:00', '2026-10-26 00:00:00+01:00', '1 day, 1 hour', '1 day, 1 hour'],
        ];
    }

    #[DataProvider('timezoneIntervals')]
    public function testExplicitOffsetTimestampsUseElapsedSecondsAcrossDst(
        string $from,
        string $to,
        string $withoutSeconds,
        string $withSeconds,
    ): void {
        date_default_timezone_set('Europe/Stockholm');

        self::assertSame($withoutSeconds, PatientTrackerService::get_Tracker_Time_Interval($from, $to));
        self::assertSame($withSeconds, PatientTrackerService::get_Tracker_Time_Interval($from, $to, true));
    }
}
