<?php

/**
 * Unit-test SQL boundary double for the inherited Ccr and Carecoordination
 * zend module table classes.
 *
 * ClinicalModuleQueryContractsTest aliases this class over
 * OpenEMR\Common\Database\QueryUtils inside isolated child processes, before
 * the real QueryUtils is autoloaded, so the unchanged production module
 * classes execute their real query-building code against synthetic rows.
 * The double is fail-closed: every read, insert and statement must be
 * registered for its QueryUtils method, exact (whitespace-normalized) SQL and
 * exact bind list, otherwise it throws LogicException, so empty results and
 * permitted writes are declared explicitly. A call registered with failOn()
 * for the same method, SQL and binds throws SqlQueryException instead,
 * standing in for a database error. Every call, including a failing or
 * unexpected one, is recorded in order for exact assertion. All rows are
 * unit-test data, not clinical or live database content.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Modules;

use LogicException;
use OpenEMR\Common\Database\SqlQueryException;

final class ClinicalModuleQueryDouble
{
    /** @var list<array{string, string, list<mixed>}> method, whitespace-normalized SQL, binds */
    private static array $calls = [];

    /** @var list<array{string, list<mixed>, list<array<string, mixed>>}> SQL, binds, synthetic rows */
    private static array $fixtures = [];

    /** @var list<array{string, list<mixed>, int}> SQL, binds, synthetic insert id */
    private static array $insertIds = [];

    /** @var list<array{string, list<mixed>}> SQL, binds of permitted sqlStatementThrowException calls */
    private static array $statements = [];

    /** @var list<array{string, string, list<mixed>}> method, SQL, binds that simulate a database error */
    private static array $failing = [];

    private const METHODS = ['fetchRecords', 'sqlInsert', 'sqlStatementThrowException'];

    public static function reset(): void
    {
        self::$calls = [];
        self::$fixtures = [];
        self::$insertIds = [];
        self::$statements = [];
        self::$failing = [];
    }

    /**
     * @return list<array{string, string, list<mixed>}>
     *
     * @phpstan-impure
     */
    public static function calls(): array
    {
        return self::$calls;
    }

    /**
     * @param list<mixed> $binds
     * @param list<array<string, mixed>> $rows
     */
    public static function on(string $sql, array $binds, array $rows): void
    {
        self::$fixtures[] = [self::normalize($sql), $binds, $rows];
    }

    /**
     * @param list<mixed> $binds
     */
    public static function onInsert(string $sql, array $binds, int $id): void
    {
        self::$insertIds[] = [self::normalize($sql), $binds, $id];
    }

    /**
     * @param list<mixed> $binds
     */
    public static function onStatement(string $sql, array $binds): void
    {
        self::$statements[] = [self::normalize($sql), $binds];
    }

    /**
     * @param list<mixed> $binds
     */
    public static function failOn(string $method, string $sql, array $binds): void
    {
        if (!in_array($method, self::METHODS, true)) {
            throw new LogicException('Unknown QueryUtils method ' . $method);
        }
        self::$failing[] = [$method, self::normalize($sql), $binds];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function fetchRecords(string $sqlStatement, mixed $binds = [], bool $noLog = false): array
    {
        [$normalized, $bindList] = self::record('fetchRecords', $sqlStatement, $binds);
        foreach (array_reverse(self::$fixtures) as [$fixtureSql, $fixtureBinds, $rows]) {
            if ($fixtureSql === $normalized && $fixtureBinds === $bindList) {
                return $rows;
            }
        }
        throw new LogicException('Unexpected query: ' . $normalized . ' binds ' . json_encode($bindList));
    }

    public static function sqlInsert(string $statement, mixed $binds = []): int
    {
        [$normalized, $bindList] = self::record('sqlInsert', $statement, $binds);
        foreach (self::$insertIds as [$fixtureSql, $fixtureBinds, $id]) {
            if ($fixtureSql === $normalized && $fixtureBinds === $bindList) {
                return $id;
            }
        }
        throw new LogicException('Unexpected insert: ' . $normalized . ' binds ' . json_encode($bindList));
    }

    public static function sqlStatementThrowException(string $statement, mixed $binds = [], bool $noLog = false): bool
    {
        [$normalized, $bindList] = self::record('sqlStatementThrowException', $statement, $binds);
        foreach (self::$statements as [$fixtureSql, $fixtureBinds]) {
            if ($fixtureSql === $normalized && $fixtureBinds === $bindList) {
                return true;
            }
        }
        throw new LogicException('Unexpected statement: ' . $normalized . ' binds ' . json_encode($bindList));
    }

    public static function normalize(string $sql): string
    {
        return trim(preg_replace('/\s+/', ' ', $sql) ?? $sql);
    }

    /**
     * @return array{string, list<mixed>}
     */
    private static function record(string $method, string $sql, mixed $binds): array
    {
        $normalized = self::normalize($sql);
        $bindList = is_array($binds) ? array_values($binds) : [$binds];
        self::$calls[] = [$method, $normalized, $bindList];
        if (in_array([$method, $normalized, $bindList], self::$failing, true)) {
            throw new SqlQueryException($sql, 'Synthetic database failure');
        }
        return [$normalized, $bindList];
    }
}
