<?php

/**
 * Synthetic demo-data seeder (TEST ENVIRONMENTS ONLY).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

enum SeedMode: string
{
    case Inventory = 'inventory';
    case DryRun = 'dry-run';
    case Seed = 'seed';
    case Verify = 'verify';

    public function writes(): bool
    {
        return match ($this) {
            self::Seed => true,
            self::Inventory, self::DryRun, self::Verify => false,
        };
    }
}
