<?php

/** SQL substitutes loaded only by the isolated contact telecom ownership test child. */

declare(strict_types=1);

namespace OpenEMR\Common\ORDataObject;

/**
 * @param list<string|int|null> $binds
 * @return array<string, mixed>|false
 */
function sqlQuery(string $sql, array $binds = []): array|false
{
    return \OpenEMR\Tests\Isolated\Services\ContactTelecomOwnershipBoundary::read($sql, $binds);
}

function sqlStatement(string $sql): bool
{
    return \OpenEMR\Tests\Isolated\Services\ContactTelecomOwnershipBoundary::write($sql, []);
}

function escape_table_name(mixed $table): string
{
    if (!is_string($table)) {
        throw new \LogicException('Expected a table name string');
    }
    return '`' . $table . '`';
}

function get_db(): \ADODB_mysqli_log
{
    $adodb = $GLOBALS['adodb'] ?? null;
    if (!is_array($adodb)) {
        throw new \LogicException('Test database boundary was not installed');
    }
    $db = $adodb['db'] ?? null;
    if (!$db instanceof \ADODB_mysqli_log) {
        throw new \LogicException('Test database boundary was not installed');
    }
    return $db;
}

function add_escape_custom(string $value): string
{
    return addslashes($value);
}
