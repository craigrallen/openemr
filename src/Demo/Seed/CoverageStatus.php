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

enum CoverageStatus: string
{
    case Seeded = 'seeded';
    case Gap = 'gap';
    case NotApplicable = 'not-applicable';
}
