<?php

/**
 * Per-table insert counts of one seeding (or dry-run) pass. Contains no values.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

final class SeedReport
{
    /** @var array<string, int> */
    private array $inserted = [];
    public int $skipped = 0;
    /** @var list<string> */
    public array $notes = [];

    public function count(string $table): void
    {
        $this->inserted[$table] = ($this->inserted[$table] ?? 0) + 1;
    }

    public function inserted(string $table): int
    {
        return $this->inserted[$table] ?? 0;
    }

    public function totalInserted(): int
    {
        return array_sum($this->inserted);
    }

    /** @return array<string, int> */
    public function all(): array
    {
        $copy = $this->inserted;
        ksort($copy);
        return $copy;
    }
}
