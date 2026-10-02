<?php

/**
 * Read-through, write-nothing gateway used by dry-run mode.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

final class DryRunSeedGateway implements SeedGateway
{
    private int $fakeId = 0;
    /** @var array<string, int> */
    private array $max = [];

    public function __construct(private readonly SeedGateway $inner)
    {
    }

    public function begin(): void
    {
    }

    public function commit(): void
    {
    }

    public function rollback(): void
    {
    }

    public function insert(string $table, array $row): int
    {
        return ++$this->fakeId;
    }

    public function findOne(string $table, array $criteria): ?array
    {
        return $this->inner->findOne($table, $criteria);
    }

    public function findAll(string $table, array $criteria): array
    {
        return $this->inner->findAll($table, $criteria);
    }

    public function maxValue(string $table, string $column): int
    {
        $key = "{$table}.{$column}";
        $this->max[$key] = ($this->max[$key] ?? $this->inner->maxValue($table, $column)) + 1;
        return $this->max[$key] - 1;
    }

    public function newUuid(string $table): string
    {
        return random_bytes(16);
    }

    public function nextSequence(): int
    {
        return ++$this->fakeId;
    }

    public function storeDocument(int $pid, int $categoryId, string $filename, string $mimetype, string $data, int $encounter, string $docDate): int
    {
        return ++$this->fakeId;
    }
}
