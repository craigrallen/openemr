<?php

/**
 * Facility lookup used by the legacy calendar facade.
 *
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Services;

use Closure;
use InvalidArgumentException;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Core\OEGlobalsBag;

final class CalendarFacilityQuery
{
    private static ?self $legacyInstance = null;

    /**
     * @param Closure(string, array<mixed>): (array<mixed>|false) $query
     * @param Closure(string, array<mixed>): list<array<mixed>> $fetchRecords
     */
    public function __construct(
        private readonly Closure $query,
        private readonly Closure $fetchRecords,
    ) {
    }

    public static function forLegacyContext(): self
    {
        return self::$legacyInstance ??= new self(
            static fn (string $sql, array $binds): array|false => QueryUtils::querySingleRow($sql, $binds),
            static fn (string $sql, array $binds): array => QueryUtils::fetchRecords($sql, $binds),
        );
    }

    /** Supply an offline SQL implementation for the legacy facade in isolated tests. */
    public static function setLegacyInstance(?self $instance): void
    {
        self::$legacyInstance = $instance;
    }

    /** @return list<array<mixed>> */
    public function getUserFacilities(mixed $uID, mixed $orderby = 'id', mixed $inventory = false): array
    {
        // SQL placeholders cannot bind identifiers. Use only fixed SQL fragments.
        if (!is_string($orderby) || !preg_match('/^\s*(id|name|color|inactive)(?:\s+(ASC|DESC))?\s*$/iD', $orderby, $sort)) {
            throw new InvalidArgumentException('Invalid facility sort order');
        }
        $sortColumn = match (strtolower($sort[1])) {
            'id' => 'f.id',
            'name' => 'f.name',
            'color' => 'f.color',
            'inactive' => 'f.inactive',
            default => throw new InvalidArgumentException('Invalid facility sort order'),
        };
        $sortDirection = isset($sort[2]) && strtoupper($sort[2]) === 'DESC' ? 'DESC' : 'ASC';
        $orderClause = $sortColumn . ' ' . $sortDirection;

        $restrict = $inventory ? OEGlobalsBag::getInstance()->getBoolean('gbl_fac_warehouse_restrictions') : OEGlobalsBag::getInstance()->getBoolean('restrict_user_facility');
        if ($restrict) {
            // No entries in this table means the user is not restricted.
            $countrow = ($this->query)(
                "SELECT count(*) AS count FROM users_facility WHERE " .
                "tablename = 'users' AND table_id = ?",
                [$uID]
            );
        }
        if (!$restrict || !isset($countrow['count']) || !$countrow['count']) {
            $sql = "SELECT f.id, f.name, f.color, f.inactive FROM facility AS f ORDER BY " . $orderClause;
            return ($this->fetchRecords)($sql, []);
        } else {
            $sql = "SELECT f.id, f.name, f.color, f.inactive " .
                "FROM facility AS f " .
                "JOIN users AS u ON u.id = ? " .
                "WHERE f.id = u.facility_id OR f.id IN " .
                "(SELECT DISTINCT uf.facility_id FROM users_facility AS uf WHERE uf.tablename = 'users' AND uf.table_id = u.id) " .
                "ORDER BY " . $orderClause;
            return ($this->fetchRecords)($sql, [$uID]);
        }
    }
}
