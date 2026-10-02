<?php

/**
 * Result of SeedVerifier: per-entry-type counts and linkage failures.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

final class VerifyReport
{
    /** @var array<string, int> */
    public array $counts = [];
    /** @var list<string> */
    public array $failures = [];

    public function count(string $type, int $by = 1): void
    {
        $this->counts[$type] = ($this->counts[$type] ?? 0) + $by;
    }

    public function expect(bool $ok, string $type, string $what): void
    {
        if (!$ok) {
            $this->failures[] = "{$type}: {$what}";
        }
    }

    public function expectCount(int $expected, int $actual, string $type, string $what): void
    {
        $this->expect($expected === $actual, $type, "{$what} expected {$expected}, found {$actual}");
    }

    public function fail(string $what): void
    {
        $this->failures[] = $what;
    }
}
