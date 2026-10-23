<?php

/**
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use InvalidArgumentException;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Services\CalendarFacilityQuery;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use UnexpectedValueException;

#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class CalendarFacilityRestrictionReadTest extends TestCase
{
    private const COUNT_SQL = "SELECT count(*) AS count FROM users_facility WHERE tablename = 'users' AND table_id = ?";
    private const UNRESTRICTED_SQL = 'SELECT f.id, f.name, f.color, f.inactive FROM facility AS f ORDER BY f.name DESC';
    private const RESTRICTED_SQL = "SELECT f.id, f.name, f.color, f.inactive " .
        "FROM facility AS f " .
        "JOIN users AS u ON u.id = ? " .
        "WHERE f.id = u.facility_id OR f.id IN " .
        "(SELECT DISTINCT uf.facility_id FROM users_facility AS uf WHERE uf.tablename = 'users' AND uf.table_id = u.id) " .
        "ORDER BY f.name DESC";
    private const INVALID_COUNT_MESSAGE = 'Unable to determine facility restriction count';

    protected function setUp(): void
    {
        $globals = OEGlobalsBag::getInstance();
        $globals->set('restrict_user_facility', false);
        $globals->set('gbl_fac_warehouse_restrictions', false);
    }

    /**
     * @return array<string, array{array<mixed>|false}>
     */
    public static function malformedCountProvider(): array
    {
        return [
            'no row' => [false],
            'empty row' => [[]],
            'missing count key' => [['other' => 0]],
            'null count' => [['count' => null]],
        ];
    }

    /** @param array<mixed>|false $countRow */
    #[DataProvider('malformedCountProvider')]
    public function testMalformedRestrictedCountFailsBeforeFacilityFetch(array|false $countRow): void
    {
        OEGlobalsBag::getInstance()->set('restrict_user_facility', true);
        /** @var list<array{sql: string, binds: array<mixed>}> $counts */
        $counts = [];
        $fetches = 0;
        $service = new CalendarFacilityQuery(
            static function (string $sql, array $binds) use (&$counts, $countRow): array|false {
                $counts[] = ['sql' => $sql, 'binds' => $binds];
                return $countRow;
            },
            static function (string $sql, array $binds) use (&$fetches): array {
                ++$fetches;
                return [];
            },
        );

        $failure = null;
        try {
            $service->getUserFacilities('uid-42', 'name DESC');
        } catch (UnexpectedValueException $exception) {
            $failure = $exception;
        }

        self::assertSame([['sql' => self::COUNT_SQL, 'binds' => ['uid-42']]], $counts);
        self::assertSame(0, $fetches, 'A malformed ACL count must stop every facility fetch');
        self::assertInstanceOf(UnexpectedValueException::class, $failure);
        self::assertSame(self::INVALID_COUNT_MESSAGE, $failure->getMessage());
    }

    /**
     * @return array<string, array{array<mixed>, bool}>
     */
    public static function usableCountProvider(): array
    {
        return [
            'integer zero' => [['count' => 0], false],
            'string zero' => [['count' => '0'], false],
            'integer positive' => [['count' => 2], true],
            'string positive' => [['count' => '2'], true],
            'non-null false remains unrestricted' => [['count' => false], false],
            'non-null empty string remains unrestricted' => [['count' => ''], false],
        ];
    }

    /** @param array<mixed> $countRow */
    #[DataProvider('usableCountProvider')]
    public function testUsableCountsPreserveSqlBindsAndReturnedRowOrder(array $countRow, bool $restricted): void
    {
        OEGlobalsBag::getInstance()->set('restrict_user_facility', true);
        $rows = [
            ['id' => 8, 'name' => 'Second', 'color' => '#888', 'inactive' => 0],
            ['id' => 3, 'name' => 'First', 'color' => '#333', 'inactive' => 1],
        ];
        /** @var list<array{sql: string, binds: array<mixed>}> $counts */
        $counts = [];
        /** @var list<array{sql: string, binds: array<mixed>}> $fetches */
        $fetches = [];
        $service = new CalendarFacilityQuery(
            static function (string $sql, array $binds) use (&$counts, $countRow): array {
                $counts[] = ['sql' => $sql, 'binds' => $binds];
                return $countRow;
            },
            static function (string $sql, array $binds) use (&$fetches, $rows): array {
                $fetches[] = ['sql' => $sql, 'binds' => $binds];
                return $rows;
            },
        );

        self::assertSame($rows, $service->getUserFacilities('uid-42', 'name DESC'));
        self::assertSame([['sql' => self::COUNT_SQL, 'binds' => ['uid-42']]], $counts);
        self::assertSame([[
            'sql' => $restricted ? self::RESTRICTED_SQL : self::UNRESTRICTED_SQL,
            'binds' => $restricted ? ['uid-42'] : [],
        ]], $fetches);
    }

    public function testDisabledCalendarRestrictionSkipsCount(): void
    {
        /** @var list<array{sql: string, binds: array<mixed>}> $fetches */
        $fetches = [];
        $rows = [['id' => 4, 'name' => 'Open']];
        $service = new CalendarFacilityQuery(
            static function (string $sql, array $binds): array {
                throw new RuntimeException('Count must not run');
            },
            static function (string $sql, array $binds) use (&$fetches, $rows): array {
                $fetches[] = ['sql' => $sql, 'binds' => $binds];
                return $rows;
            },
        );

        self::assertSame($rows, $service->getUserFacilities('uid-42', 'name DESC'));
        self::assertSame([['sql' => self::UNRESTRICTED_SQL, 'binds' => []]], $fetches);
    }

    /**
     * @return array<string, array{bool, bool, bool}>
     */
    public static function inventoryFlagProvider(): array
    {
        return [
            'warehouse on calendar off' => [false, true, true],
            'warehouse off calendar on' => [true, false, false],
        ];
    }

    #[DataProvider('inventoryFlagProvider')]
    public function testInventoryUsesWarehouseFlagIndependently(bool $calendarFlag, bool $warehouseFlag, bool $restricted): void
    {
        $globals = OEGlobalsBag::getInstance();
        $globals->set('restrict_user_facility', $calendarFlag);
        $globals->set('gbl_fac_warehouse_restrictions', $warehouseFlag);
        /** @var list<array{sql: string, binds: array<mixed>}> $counts */
        $counts = [];
        /** @var list<array{sql: string, binds: array<mixed>}> $fetches */
        $fetches = [];
        $rows = [['id' => 6, 'name' => 'Warehouse']];
        $service = new CalendarFacilityQuery(
            static function (string $sql, array $binds) use (&$counts): array {
                $counts[] = ['sql' => $sql, 'binds' => $binds];
                return ['count' => 1];
            },
            static function (string $sql, array $binds) use (&$fetches, $rows): array {
                $fetches[] = ['sql' => $sql, 'binds' => $binds];
                return $rows;
            },
        );

        self::assertSame($rows, $service->getUserFacilities('uid-42', 'name DESC', true));
        self::assertSame($restricted ? [['sql' => self::COUNT_SQL, 'binds' => ['uid-42']]] : [], $counts);
        self::assertSame([[
            'sql' => $restricted ? self::RESTRICTED_SQL : self::UNRESTRICTED_SQL,
            'binds' => $restricted ? ['uid-42'] : [],
        ]], $fetches);
    }

    public function testCountExceptionPropagatesWithoutFetchingFacilities(): void
    {
        OEGlobalsBag::getInstance()->set('restrict_user_facility', true);
        $failure = new RuntimeException('count query failed');
        $fetches = 0;
        $service = new CalendarFacilityQuery(
            static function (string $sql, array $binds) use ($failure): array {
                throw $failure;
            },
            static function (string $sql, array $binds) use (&$fetches): array {
                ++$fetches;
                return [];
            },
        );

        try {
            $service->getUserFacilities('uid-42');
            self::fail('Expected the injected count exception');
        } catch (RuntimeException $caught) {
            self::assertSame($failure, $caught);
        } finally {
            self::assertSame(0, $fetches);
        }
    }

    public function testFacilityFetchExceptionPropagatesUnchanged(): void
    {
        OEGlobalsBag::getInstance()->set('restrict_user_facility', true);
        $failure = new RuntimeException('facility fetch failed');
        /** @var list<array{sql: string, binds: array<mixed>}> $counts */
        $counts = [];
        $service = new CalendarFacilityQuery(
            static function (string $sql, array $binds) use (&$counts): array {
                $counts[] = ['sql' => $sql, 'binds' => $binds];
                return ['count' => 1];
            },
            static function (string $sql, array $binds) use ($failure): array {
                self::assertSame(self::RESTRICTED_SQL, $sql);
                self::assertSame(['uid-42'], $binds);
                throw $failure;
            },
        );

        try {
            $service->getUserFacilities('uid-42', 'name DESC');
            self::fail('Expected the injected facility fetch exception');
        } catch (RuntimeException $caught) {
            self::assertSame($failure, $caught);
        }
        self::assertSame([['sql' => self::COUNT_SQL, 'binds' => ['uid-42']]], $counts);
    }

    public function testInvalidSortIsRejectedBeforeRestrictedCount(): void
    {
        OEGlobalsBag::getInstance()->set('restrict_user_facility', true);
        $counts = 0;
        $fetches = 0;
        $service = new CalendarFacilityQuery(
            static function (string $sql, array $binds) use (&$counts): array {
                ++$counts;
                return ['count' => 1];
            },
            static function (string $sql, array $binds) use (&$fetches): array {
                ++$fetches;
                return [];
            },
        );

        try {
            $service->getUserFacilities('uid-42', 'id; DELETE FROM facility');
            self::fail('Expected invalid sort rejection');
        } catch (InvalidArgumentException $exception) {
            self::assertSame('Invalid facility sort order', $exception->getMessage());
        } finally {
            self::assertSame(0, $counts);
            self::assertSame(0, $fetches);
        }
    }
}
