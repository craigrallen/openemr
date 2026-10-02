<?php

/**
 * One user-visible entry type and how the demo seed covers it.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

final readonly class CoverageEntry
{
    public function __construct(
        public string $key,
        public string $label,
        public string $menu,
        public string $tables,
        public CoverageStatus $status,
        public string $reason = '',
    ) {
    }
}
