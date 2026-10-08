<?php

/**
 * TEST DOUBLE for OpenEMR\Core\Header in the finder route tests.
 *
 * Records the requested assets and writes a marker where the real helper writes the theme
 * and script tags.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Main\Finder\Doubles;

use OpenEMR\Tests\Isolated\Main\Finder\FinderRouteScenario;

final class FinderHeaderDouble
{
    public const MARKER = '<!--FINDER-HEADER-DOUBLE-->';

    /**
     * @param list<string>|string $assets
     */
    public static function setupHeader(array|string $assets = []): void
    {
        FinderRouteScenario::$headers[] = $assets;
        echo self::MARKER . "\n";
    }
}
