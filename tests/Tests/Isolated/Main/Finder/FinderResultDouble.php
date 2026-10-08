<?php

/**
 * TEST DOUBLE result set handed out by the finder route sqlStatement() double.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Main\Finder;

final class FinderResultDouble
{
    /**
     * @param list<array<string, string|null>> $rows
     */
    public function __construct(private array $rows)
    {
    }

    /**
     * @return array<string, string|null>|false
     */
    public function next(): array|false
    {
        return array_shift($this->rows) ?? false;
    }
}
