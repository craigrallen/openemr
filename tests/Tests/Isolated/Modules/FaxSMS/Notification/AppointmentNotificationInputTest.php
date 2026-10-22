<?php

/**
 * Input contracts for the native appointment notification run() path.
 * Rows have the shape returned by faxsms_getAlertPatientData()/fetchEvents().
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Modules\FaxSMS\Notification;

use Composer\Autoload\ClassLoader;
use OpenEMR\Modules\FaxSMS\Controller\EmailClient;
use OpenEMR\Modules\FaxSMS\Enums\NotificationChannel;
use OpenEMR\Modules\FaxSMS\Notification\AppointmentNotificationRunner;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use Psr\Clock\ClockInterface;
use ReflectionClass;

// The production runner calls global text() while rendering a row. Load the
// real escaping helper; no notification helper, DB, or module bootstrap is run.
require_once dirname(__DIR__, 6) . '/library/htmlspecialchars.inc.php';

#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class AppointmentNotificationInputTest extends TestCase
{
    private string $previousTimezone;

    public static function setUpBeforeClass(): void
    {
        $loaders = ClassLoader::getRegisteredLoaders();
        $loader = reset($loaders);
        if (!$loader instanceof ClassLoader) {
            self::fail('Composer ClassLoader is required by the isolated runner.');
        }
        $loader->addPsr4(
            'OpenEMR\\Modules\\FaxSMS\\',
            dirname(__DIR__, 6) . '/interface/modules/custom_modules/oe-module-faxsms/src/'
        );
    }

    protected function setUp(): void
    {
        $this->previousTimezone = date_default_timezone_get();
        date_default_timezone_set('UTC');
    }

    protected function tearDown(): void
    {
        date_default_timezone_set($this->previousTimezone);
    }

    public function testRunnerUsesProductionSource(): void
    {
        $expected = realpath(
            dirname(__DIR__, 6)
            . '/interface/modules/custom_modules/oe-module-faxsms/src/Notification/AppointmentNotificationRunner.php'
        );
        $source = (new ReflectionClass(AppointmentNotificationRunner::class))->getFileName();
        self::assertIsString($expected);
        self::assertIsString($source);
        self::assertSame($expected, realpath($source));
    }

    /**
     * Each malformed value must be rejected before EmailClient::validEmail().
     * The first cases normalize to 2026-03-02 10:00:00 under strtotime(),
     * exactly 24 hours after the injected clock: a real RED on current code.
     *
     * @param array<string, mixed> $changes
     */
    #[DataProvider('malformedInputProvider')]
    public function testMalformedInputsNeverEnterDelivery(array $changes): void
    {
        $client = $this->emailClientExpectingChecks(0);
        $result = $this->runner([self::row($changes)], $client)->run();

        self::assertSame(1, $result->scanned);
        self::assertSame(0, $result->inWindow);
        self::assertSame(0, $result->sent);
        self::assertSame(0, $result->failed);
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function malformedInputProvider(): array
    {
        return [
            'February 30 rolls into March' => [['pc_eventDate' => '2026-02-30']],
            'non-leap February 29' => [['pc_eventDate' => '2026-02-29']],
            'leap February 30' => [['pc_eventDate' => '2028-02-30']],
            'zero month' => [['pc_eventDate' => '2026-00-02']],
            'zero day' => [['pc_eventDate' => '2026-03-00']],
            'zero year' => [['pc_eventDate' => '0000-03-02']],
            'whitespace around date' => [['pc_eventDate' => ' 2026-03-02 ']],
            'date trailing newline' => [['pc_eventDate' => "2026-03-02\n"]],
            'alternate date syntax' => [['pc_eventDate' => '03/02/2026']],
            'Unicode digits in date' => [['pc_eventDate' => '２０２６-03-02']],
            'whitespace around time' => [['pc_startTime' => ' 10:00:00 ']],
            'time trailing newline' => [['pc_startTime' => "10:00:00\n"]],
            'missing time' => [['pc_startTime' => null]],
            'empty time' => [['pc_startTime' => '']],
            'relative time' => [['pc_startTime' => '10am']],
            'invalid month' => [['pc_eventDate' => '2026-13-02']],
            'invalid hour' => [['pc_startTime' => '24:00:00']],
            'invalid minute' => [['pc_startTime' => '10:60:00']],
            'invalid second' => [['pc_startTime' => '10:00:60']],
            'fractional second' => [['pc_startTime' => '10:00:00.5']],
            'Unicode digits in time' => [['pc_startTime' => '１０:00:00']],
            'numeric date' => [['pc_eventDate' => 20260302]],
            'numeric time' => [['pc_startTime' => 100000]],
            'array date' => [['pc_eventDate' => ['2026-03-02']]],
            'array time' => [['pc_startTime' => ['10:00:00']]],
        ];
    }

    /**
     * Bare times and relative dates use the PHP process date under
     * strtotime(). A fixed earlier clock and wide lead time make their
     * normalized timestamps eligible regardless of the controller's run day.
     *
     * @param mixed $eventDate
     */
    #[DataProvider('implicitDateProvider')]
    public function testImplicitDatesNeverEnterDelivery(mixed $eventDate): void
    {
        $client = $this->emailClientExpectingChecks(0);
        $result = $this->runner(
            [self::row(['pc_eventDate' => $eventDate])],
            $client,
            '2000-01-01 00:00:00',
            10_000_000,
        )->run();

        self::assertSame(1, $result->scanned);
        self::assertSame(0, $result->inWindow);
    }

    /** @return array<string, array{mixed}> */
    public static function implicitDateProvider(): array
    {
        return [
            'missing date' => [null],
            'empty date' => [''],
            'relative date' => ['tomorrow'],
        ];
    }

    public function testAbsentKeysNeverEnterDelivery(): void
    {
        foreach (['pc_eventDate', 'pc_startTime'] as $key) {
            $row = self::row();
            unset($row[$key]);
            $client = $this->emailClientExpectingChecks(0);
            $result = $this->runner([$row], $client)->run();

            self::assertSame(1, $result->scanned);
            self::assertSame(0, $result->inWindow);
        }
    }

    /**
     * MySQL TIME values use HH:MM:SS; the existing parser also accepts
     * HH:MM, so both remain legitimate inputs for the current runner.
     *
     * @param list<array<string, mixed>> $rows
     */
    #[DataProvider('validInputProvider')]
    public function testValidInputRetainsCurrentWindowPolicy(array $rows, int $inWindow): void
    {
        $client = $this->emailClientExpectingChecks($inWindow);
        $result = $this->runner($rows, $client)->run();

        self::assertSame(count($rows), $result->scanned);
        self::assertSame($inWindow, $result->inWindow);
        self::assertSame(0, $result->sent);
        self::assertSame(0, $result->skippedInvalid);
        self::assertSame(0, $result->failed);
    }

    /** @return array<string, array{list<array<string, mixed>>, int}> */
    public static function validInputProvider(): array
    {
        return [
            'normal MySQL seconds at send time' => [[self::row()], 1],
            'HH:MM remains supported' => [[self::row(['pc_startTime' => '10:00'])], 1],
            'late tick catches up before start' => [[self::row(['pc_eventDate' => '2026-03-01', 'pc_startTime' => '11:00:00'])], 1],
            'future but too early for window' => [[self::row(['pc_eventDate' => '2026-03-03'])], 0],
            'already started' => [[self::row(['pc_eventDate' => '2026-03-01'])], 0],
            'exact start time' => [[self::row(['pc_eventDate' => '2026-03-01', 'pc_startTime' => '10:00:00'])], 0],
            'rounded window edge' => [[self::row(['pc_startTime' => '10:29:00'])], 1],
        ];
    }

    public function testLeapDayAtSendTimeIsAccepted(): void
    {
        $client = $this->emailClientExpectingChecks(1);
        $result = $this->runner(
            [self::row(['pc_eventDate' => '2028-02-29'])],
            $client,
            '2028-02-28 10:00:00',
        )->run();

        self::assertSame(1, $result->inWindow);
        self::assertSame(0, $result->sent);
    }

    public function testStockholmSpringDstNormalizationRetainsWindowPolicy(): void
    {
        date_default_timezone_set('Europe/Stockholm');
        // 02:30 does not occur on this date. strtotime() historically
        // normalizes it to 03:30, and the run-only lexical gate preserves it.
        self::assertSame(strtotime('2026-03-29 03:30:00'), strtotime('2026-03-29 02:30:00'));
        $client = $this->emailClientExpectingChecks(1);
        $result = $this->runner(
            [self::row(['pc_eventDate' => '2026-03-29', 'pc_startTime' => '02:30:00'])],
            $client,
            '2026-03-28 03:30:00',
        )->run();

        self::assertSame(1, $result->inWindow);
        self::assertSame(0, $result->sent);
    }

    public function testStockholmOrdinaryDateAtSendTimeIsAccepted(): void
    {
        date_default_timezone_set('Europe/Stockholm');
        $client = $this->emailClientExpectingChecks(1);
        $result = $this->runner(
            [self::row(['pc_eventDate' => '2026-04-15', 'pc_startTime' => '10:00:00'])],
            $client,
            '2026-04-14 10:00:00',
        )->run();

        self::assertSame(1, $result->inWindow);
        self::assertSame(0, $result->sent);
    }

    public function testMixedBatchScansValidRowsWhileRejectingMalformedRows(): void
    {
        $client = $this->emailClientExpectingChecks(2);
        $result = $this->runner([
            self::row(['pc_eventDate' => '2026-02-30']),
            self::row(),
            self::row(['pc_startTime' => '10am']),
            self::row(['pc_startTime' => '10:15:00']),
        ], $client)->run();

        self::assertSame(4, $result->scanned);
        self::assertSame(2, $result->inWindow);
        self::assertSame(0, $result->sent);
        self::assertSame(0, $result->failed);
    }

    private function emailClientExpectingChecks(int $count): EmailClient
    {
        $client = $this->getMockBuilder(EmailClient::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['validEmail', 'emailReminder'])
            ->getMock();
        $client->expects(self::exactly($count))->method('validEmail')->willReturn(true);
        $client->expects(self::never())->method('emailReminder');
        return $client;
    }

    /** @param list<array<string, mixed>> $rows */
    private function runner(
        array $rows,
        EmailClient $client,
        string $now = '2026-03-01 10:00:00',
        int $notificationHours = 24,
    ): AppointmentNotificationRunner
    {
        $clock = new class ($now) implements ClockInterface {
            private readonly \DateTimeZone $timezone;

            public function __construct(private readonly string $fixedNow)
            {
                $this->timezone = new \DateTimeZone(date_default_timezone_get());
            }

            public function now(): \DateTimeImmutable
            {
                return new \DateTimeImmutable($this->fixedNow, $this->timezone);
            }
        };

        return new class ($rows, $client, $clock, $notificationHours) extends AppointmentNotificationRunner {
            /** @param list<array<string, mixed>> $rows */
            public function __construct(
                private readonly array $rows,
                EmailClient $client,
                ClockInterface $clock,
                int $notificationHours,
            ) {
                parent::__construct(NotificationChannel::EMAIL, $client, $notificationHours, 1, true, '', 'test', clock: $clock);
            }

            protected function fetchPendingAppointments(): array
            {
                return $this->rows;
            }
        };
    }

    /**
     * @param array<string, mixed> $changes
     * @return array<string, mixed>
     */
    private static function row(array $changes = []): array
    {
        return array_replace([
            'pc_eventDate' => '2026-03-02',
            'pc_startTime' => '10:00:00',
            'email' => 'fixture@example.invalid',
        ], $changes);
    }
}
