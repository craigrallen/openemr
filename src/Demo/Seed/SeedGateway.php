<?php

/**
 * Narrow persistence port used by the demo seeder and verifier.
 *
 * Only structured equality lookups and inserts: the seeder never issues UPDATE
 * or DELETE, so it cannot modify or remove pre-existing records.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

interface SeedGateway
{
    /**
     * Run $work using the gateway's transaction implementation: request commit
     * when it returns, roll back writes and gateway-owned document files when
     * it throws, then rethrow. Nested calls are not supported. Commit
     * acknowledgement is limited by the underlying database driver; this port
     * does not promise to detect failures the driver does not report.
     *
     * @template T
     * @param callable(): T $work
     * @return T
     */
    public function transactional(callable $work): mixed;

    /**
     * @param array<string, scalar|null> $row
     * @return int auto-increment id, or 0 when the table has none
     */
    public function insert(string $table, array $row): int;

    /**
     * @param array<string, scalar|null> $criteria
     * @return array<string, scalar|null>|null
     */
    public function findOne(string $table, array $criteria): ?array;

    /**
     * @param array<string, scalar|null> $criteria
     * @return list<array<string, scalar|null>>
     */
    public function findAll(string $table, array $criteria): array;

    public function maxValue(string $table, string $column): int;

    /** Binary 16-byte UUID registered for $table. */
    public function newUuid(string $table): string;

    /** Next value of OpenEMR's shared `sequences` counter (encounter numbers, form group ids). */
    public function nextSequence(): int;

    /** Store a patient document through OpenEMR's document storage; returns documents.id. */
    public function storeDocument(int $pid, int $categoryId, string $filename, string $mimetype, string $data, int $encounter, string $docDate): int;
}
