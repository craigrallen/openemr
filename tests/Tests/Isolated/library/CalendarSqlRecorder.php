<?php

/**
 * Capture buffer for the calendar facility query's offline SQL adapter.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\library;

use OpenEMR\Services\CalendarFacilityQuery;

final class CalendarSqlRecorder
{
    /** @var list<array{sql: string, binds: array<mixed>}> */
    public static array $queries = [];

    /** @var list<array{sql: string, binds: array<mixed>}> */
    public static array $statements = [];

    /** @var array<string, mixed> */
    public static array $countRow = ['count' => 0];

    /** @var list<array<string, mixed>> */
    public static array $rows = [];

    public static function reset(): void
    {
        self::$queries = [];
        self::$statements = [];
        self::$countRow = ['count' => 0];
        self::$rows = [];
    }

    public static function createQuery(): CalendarFacilityQuery
    {
        return new CalendarFacilityQuery(
            static function (string $sql, array $binds): array {
                self::$queries[] = ['sql' => $sql, 'binds' => $binds];
                return self::$countRow;
            },
            static function (string $sql, array $binds): array {
                self::$statements[] = ['sql' => $sql, 'binds' => $binds];
                $rows = self::$rows;
                self::$rows = [];
                return $rows;
            },
        );
    }
}
