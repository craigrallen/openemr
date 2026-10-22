<?php

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Common\Calendar;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Result;
use OpenEMR\BC\Database;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Kernel;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Events\Appointments\AppointmentsFilterEvent;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use ReflectionFunction;
use RuntimeException;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

/**
 * A narrow ADODB surface for the native sqlStatement/sqlFetchArray functions.
 *
 * @phpstan-import-type Bindings from Database
 */
final readonly class AvailabilityQueryTransport
{
    public function __construct(private ?Database $database)
    {
    }

    /** @param Bindings $binds */
    public function Execute(string $sql, array $binds, bool $audit): AvailabilityRows
    {
        if ($this->database === null) {
            throw new RuntimeException('Unexpected availability query');
        }
        if (!$audit) {
            throw new RuntimeException('Availability query unexpectedly bypassed auditing');
        }
        return new AvailabilityRows($this->database->fetchAll($sql, $binds));
    }

    /** @param array<mixed> $arguments */
    public function __call(string $name, array $arguments): never
    {
        throw new RuntimeException('Unexpected database transport call: ' . $name);
    }
}

/** @phpstan-type EventRow array<string, mixed> */
final class AvailabilityRows
{
    /** @param array<array<string, mixed>> $rows */
    public function __construct(private array $rows)
    {
    }

    /** @return array<string, mixed>|false */
    public function FetchRow(): array|false
    {
        return array_shift($this->rows) ?? false;
    }

    /** @param array<mixed> $arguments */
    public function __call(string $name, array $arguments): never
    {
        throw new RuntimeException('Unexpected result transport call: ' . $name);
    }
}

#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class AvailableSlotsBoundaryTest extends TestCase
{
    private const ROOT = __DIR__ . '/../../../../../';

    /**
     * @return array<string, array{string, string, int|null, list<array{int, string, string, string}>, list<string>}>
     */
    public static function boundaries(): array
    {
        return [
            'lunch at 09:10 rejects partial 15 minute slot' => ['UTC', '2026-06-01', null, [[2, '09:00:00', '17:00:00', '2026-06-01'], [3, '09:10:00', '09:30:00', '2026-06-01']], []],
            'appointment at 09:10 rejects partial 15 minute slot' => ['UTC', '2026-06-01', null, [[2, '09:00:00', '17:00:00', '2026-06-01'], [5, '09:10:00', '09:30:00', '2026-06-01']], []],
            'exact fit at 09:15 is included' => ['UTC', '2026-06-01', null, [[2, '09:00:00', '17:00:00', '2026-06-01'], [3, '09:15:00', '09:30:00', '2026-06-01']], ['09:00:00']],
            'one second short of 09:15 is excluded' => ['UTC', '2026-06-01', null, [[2, '09:00:00', '17:00:00', '2026-06-01'], [3, '09:14:59', '09:30:00', '2026-06-01']], []],
            'smaller than half slot is excluded' => ['UTC', '2026-06-01', null, [[2, '09:00:00', '17:00:00', '2026-06-01'], [3, '09:07:00', '09:30:00', '2026-06-01']], []],
            'empty gap is excluded' => ['UTC', '2026-06-01', null, [[2, '09:00:00', '17:00:00', '2026-06-01'], [3, '09:00:00', '09:30:00', '2026-06-01']], []],
            'single office window ending at 09:10 rejects partial slot' => ['UTC', '2026-06-01', null, [[2, '09:00:00', '09:10:00', '2026-06-01']], []],
            'aligned 15 minute slots stay available' => ['UTC', '2026-06-01', null, [[2, '09:00:00', '17:00:00', '2026-06-01'], [5, '09:30:00', '09:45:00', '2026-06-01']], ['09:00:00', '09:15:00']],
            '30 minute interval rejects 09:20 lunch' => ['UTC', '2026-06-01', 30, [[2, '09:00:00', '17:00:00', '2026-06-01'], [3, '09:20:00', '09:45:00', '2026-06-01']], []],
            'aligned 30 minute interval stays available' => ['UTC', '2026-06-01', 30, [[2, '09:00:00', '17:00:00', '2026-06-01'], [3, '10:00:00', '10:30:00', '2026-06-01']], ['09:00:00', '09:30:00']],
            'different date does not join windows' => ['UTC', '2026-06-01', null, [[2, '09:00:00', '17:00:00', '2026-06-01'], [3, '09:10:00', '09:30:00', '2026-06-02']], []],
            'Stockholm spring change day' => ['Europe/Stockholm', '2026-03-29', null, [[2, '09:00:00', '17:00:00', '2026-03-29'], [3, '09:10:00', '09:30:00', '2026-03-29']], []],
            'Stockholm autumn change day' => ['Europe/Stockholm', '2026-10-25', null, [[2, '09:00:00', '17:00:00', '2026-10-25'], [3, '09:15:00', '09:30:00', '2026-10-25']], ['09:00:00']],
        ];
    }

    /**
     * @param list<array{int, string, string, string}> $events
     * @param list<string> $expectedTimes
     */
    #[DataProvider('boundaries')]
    public function testCompleteSlotsAtBusyBoundary(
        string $timezone,
        string $date,
        ?int $interval,
        array $events,
        array $expectedTimes,
    ): void {
        $this->assertSame('cli', PHP_SAPI);
        date_default_timezone_set($timezone);
        $this->loadNativeFunctions();
        $bag = OEGlobalsBag::getInstance();
        if ($interval !== null) {
            $bag->set('calendar_interval', $interval);
        }

        $rows = array_map(
            static fn(array $event): array => self::event($event[0], $event[1], $event[2], $event[3]),
            $events,
        );
        $this->installTransport($rows, $date, $date, null, null);

        $expected = array_map(
            static fn(string $time): array => self::slot($date, $time),
            $expectedTimes,
        );
        self::assertSame($expected, \getAvailableSlots($date, $date));
    }

    public function testProviderFacilityAndDateBindingsArePreserved(): void
    {
        $this->assertSame('cli', PHP_SAPI);
        date_default_timezone_set('UTC');
        $this->loadNativeFunctions();
        $rows = [
            self::event(2, '09:00:00', '17:00:00', '2026-06-01'),
            self::event(3, '09:15:00', '09:30:00', '2026-06-01'),
        ];
        $this->installTransport($rows, '2026-06-01', '2026-06-02', 42, 7);

        self::assertSame([self::slot('2026-06-01', '09:00:00')], \getAvailableSlots('2026-06-01', '2026-06-02', 42, 7));
    }

    public function testDifferentProviderDoesNotTruncateAdaSlots(): void
    {
        $this->assertSame('cli', PHP_SAPI);
        date_default_timezone_set('UTC');
        $this->loadNativeFunctions();
        $rows = [
            self::event(2, '09:00:00', '17:00:00', '2026-06-01'),
            self::event(5, '09:05:00', '09:30:00', '2026-06-01', 73),
            self::event(3, '09:30:00', '09:45:00', '2026-06-01'),
        ];
        $this->installTransport($rows, '2026-06-01', '2026-06-01', null, null);

        self::assertSame(
            [self::slot('2026-06-01', '09:00:00'), self::slot('2026-06-01', '09:15:00')],
            \getAvailableSlots('2026-06-01', '2026-06-01'),
        );
    }

    #[DataProvider('nonpositiveIntervals')]
    public function testNonpositiveIntervalReturnsBeforeFetching(int $interval): void
    {
        $this->assertSame('cli', PHP_SAPI);
        date_default_timezone_set('UTC');
        $this->loadNativeFunctions(false);
        OEGlobalsBag::getInstance()->set('calendar_interval', $interval);
        OEGlobalsBag::getInstance()->set('adodb', ['db' => new AvailabilityQueryTransport(null)]);

        self::assertSame([], \getAvailableSlots('2026-06-01', '2026-06-01'));
    }

    /** @return array<string, array{int}> */
    public static function nonpositiveIntervals(): array
    {
        return [
            'zero minutes' => [0],
            'negative fifteen minutes' => [-15],
        ];
    }

    private function loadNativeFunctions(bool $expectDispatch = true): void
    {
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
        $bag = OEGlobalsBag::getInstance();
        $bag->set('disable_translation', true);
        $bag->set('OE_SITE_DIR', self::ROOT . 'sites/default');
        SessionWrapperFactory::getInstance()->setActiveSession(new Session(new MockArraySessionStorage()));

        $dispatcher = $this->createMock(EventDispatcherInterface::class);
        if ($expectDispatch) {
            $dispatcher->expects(self::once())
                ->method('dispatch')
                ->with(self::isInstanceOf(AppointmentsFilterEvent::class), AppointmentsFilterEvent::EVENT_HANDLE)
                ->willReturnCallback(static fn(object $event): object => $event);
        } else {
            $dispatcher->expects(self::never())->method('dispatch');
        }
        $bag->set('kernel', new Kernel(dispatcher: $dispatcher));

        require_once self::ROOT . 'library/translation.inc.php';
        require_once self::ROOT . 'library/sql.inc.php';
        // Capture the native include-scope sort arrays in the global symbol table.
        $COMPARE_FUNCTION_HASH = [];
        $ORDERHASH = [];
        require_once self::ROOT . 'library/appointments.inc.php';
        $GLOBALS['COMPARE_FUNCTION_HASH'] = $COMPARE_FUNCTION_HASH;
        $GLOBALS['ORDERHASH'] = $ORDERHASH;

        foreach (['getAvailableSlots', 'fetchAllEvents', 'fetchEvents', 'sqlStatement', 'sqlFetchArray'] as $name) {
            $reflection = new ReflectionFunction($name);
            $file = $name === 'sqlStatement' || $name === 'sqlFetchArray' ? 'sql.inc.php' : 'appointments.inc.php';
            self::assertSame(realpath(self::ROOT . 'library/' . $file), $reflection->getFileName());
        }
    }

    /** @param list<array<string, mixed>> $rows */
    private function installTransport(array $rows, string $from, string $to, ?int $provider, ?int $facility): void
    {
        $result = $this->getMockBuilder(Result::class)->disableOriginalConstructor()->getMock();
        $result->expects(self::once())->method('fetchAllAssociative')->willReturn($rows);

        $connection = $this->getMockBuilder(Connection::class)->disableOriginalConstructor()->getMock();
        foreach (['executeStatement', 'prepare', 'insert', 'update', 'delete'] as $method) {
            $connection->expects(self::never())->method($method);
        }
        $connection->expects(self::once())->method('executeQuery')
            ->willReturnCallback(static function (string $sql, array $binds) use ($from, $to, $provider, $facility, $result): Result {
                $expectedSql = "SELECT " .
                    "e.pc_eventDate, e.pc_endDate, e.pc_startTime, e.pc_endTime, e.pc_duration, e.pc_recurrtype, e.pc_recurrspec, e.pc_recurrfreq, e.pc_catid, e.pc_eid, e.pc_gid, " .
                    "e.pc_title, e.pc_hometext, e.pc_apptstatus, " .
                    "p.fname, p.mname, p.lname, p.DOB, p.pid, p.pubpid, p.phone_home, p.phone_cell, " .
                    "p.street AS address1, p.street_line_2 AS address2," .
                    "p.hipaa_allowsms, p.phone_home, p.phone_cell, p.hipaa_voice, p.hipaa_allowemail, p.email, " .
                    "u.fname AS ufname, u.mname AS umname, u.lname AS ulname, u.id AS uprovider_id, " .
                    "f.name, " .
                    "c.pc_catname, c.pc_catid, e.pc_facility " .
                    "FROM openemr_postcalendar_events AS e " .
                    "LEFT OUTER JOIN facility AS f ON e.pc_facility = f.id " .
                    "LEFT OUTER JOIN patient_data AS p ON p.pid = e.pc_pid " .
                    "LEFT OUTER JOIN users AS u ON u.id = e.pc_aid " .
                    "LEFT OUTER JOIN openemr_postcalendar_categories AS c ON c.pc_catid = e.pc_catid " .
                    "WHERE ((e.pc_endDate >= ? AND e.pc_eventDate <= ? AND e.pc_recurrtype > '0') OR " .
                    "(e.pc_eventDate >= ? AND e.pc_eventDate <= ?))" .
                    ($provider !== null ? ' AND e.pc_aid = ?' : '') .
                    ($facility !== null ? ' AND e.pc_facility = ? AND u.facility_id = ?' : '') .
                    " AND 1 ORDER BY e.pc_eventDate, e.pc_startTime";
                self::assertSame($expectedSql, $sql);
                $expected = [$from, $to, $from, $to];
                if ($provider !== null) {
                    $expected[] = $provider;
                }
                if ($facility !== null) {
                    array_push($expected, $facility, $facility);
                }
                self::assertSame($expected, $binds);
                return $result;
            });

        $database = new Database($connection);
        OEGlobalsBag::getInstance()->set('adodb', ['db' => new AvailabilityQueryTransport($database)]);
    }

    /** @return array<string, mixed> */
    private static function event(int $category, string $start, string $end, string $date, int $provider = 42): array
    {
        return [
            'pc_eventDate' => $date,
            'pc_endDate' => $date,
            'pc_startTime' => $start,
            'pc_endTime' => $end,
            'pc_duration' => 60,
            'pc_recurrtype' => '0',
            'pc_catid' => $category,
            'uprovider_id' => $provider,
            'ufname' => $provider === 42 ? 'Ada' : 'Other',
            'ulname' => 'Lovelace',
            'umname' => 'M',
        ];
    }

    /** @return array<string, string> */
    private static function slot(string $date, string $time): array
    {
        return [
            'ulname' => 'Lovelace',
            'ufname' => 'Ada',
            'umname' => 'M',
            'pc_eventDate' => $date,
            'pc_startTime' => $time,
            'pc_endTime' => $time,
            'pc_catname' => 'Available',
        ];
    }
}
