<?php

/**
 * Unit-test SQL boundary double for the inherited zend module table classes.
 *
 * UpstreamModuleRegistryContractsTest aliases this class over
 * OpenEMR\Common\Database\QueryUtils inside isolated child processes, before
 * the real QueryUtils is autoloaded, so the unchanged production module
 * classes execute their real query-building code against synthetic rows.
 * Rows are matched on the exact (whitespace-normalized) SQL and binds; any
 * other query throws, so empty results must be declared explicitly. The
 * rows are labelled unit-test
 * data, not clinical or live database content.
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

final class ModuleRegistryQueryDouble
{
    /** @var list<array{string, string, list<mixed>}> method, whitespace-normalized SQL, binds */
    private static array $calls = [];

    /** @var list<array{string, list<mixed>, list<array<string, mixed>>}> SQL, binds, synthetic rows */
    private static array $fixtures = [];

    public static bool $failStatements = false;

    public static function reset(): void
    {
        self::$calls = [];
        self::$fixtures = [];
        self::$failStatements = false;
    }

    public static function forgetCalls(): void
    {
        self::$calls = [];
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
     * Bind lists of every recorded query, in call order.
     *
     * @return list<list<mixed>>
     *
     * @phpstan-impure
     */
    public static function binds(): array
    {
        return array_column(self::$calls, 2);
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
     * @return list<array<string, mixed>>
     */
    public static function fetchRecords(string $sqlStatement, mixed $binds = [], bool $noLog = false): array
    {
        return self::rowsFor('fetchRecords', $sqlStatement, $binds);
    }

    /**
     * @return array<string, mixed>|false
     */
    public static function querySingleRow(string $sql, mixed $params = [], bool $log = true): array|false
    {
        return self::rowsFor('querySingleRow', $sql, $params)[0] ?? false;
    }

    public static function sqlStatementThrowException(string $statement, mixed $binds = [], bool $noLog = false): bool
    {
        self::record('sqlStatementThrowException', $statement, $binds);
        if (self::$failStatements) {
            throw new SqlQueryException($statement, 'Synthetic statement failure');
        }
        return true;
    }

    public static function normalize(string $sql): string
    {
        return trim(preg_replace('/\s+/', ' ', $sql) ?? $sql);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function rowsFor(string $method, string $sql, mixed $binds): array
    {
        [$normalized, $bindList] = self::record($method, $sql, $binds);
        // The most recently registered fixture wins, so a test can move the
        // same query from an explicit empty result to a populated one.
        foreach (array_reverse(self::$fixtures) as [$fixtureSql, $fixtureBinds, $rows]) {
            if ($fixtureSql === $normalized && $fixtureBinds === $bindList) {
                return $rows;
            }
        }
        // Fail closed: a wrong query or bind list must never pass as an
        // empty result. Empty result sets need an explicit on(..., []).
        throw new LogicException('Unexpected query: ' . $normalized . ' binds ' . json_encode($bindList));
    }

    /**
     * @return array{string, list<mixed>}
     */
    private static function record(string $method, string $sql, mixed $binds): array
    {
        $normalized = self::normalize($sql);
        $bindList = is_array($binds) ? array_values($binds) : [$binds];
        self::$calls[] = [$method, $normalized, $bindList];
        return [$normalized, $bindList];
    }
}
