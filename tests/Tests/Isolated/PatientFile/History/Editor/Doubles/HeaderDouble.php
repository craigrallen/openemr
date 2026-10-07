<?php

/**
 * TEST DOUBLE for OpenEMR\Core\Header in the History editor route test.
 *
 * Records the requested assets and writes a marker where the real helper writes the theme
 * and script tags, so a caller can substitute real local assets.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\History\Editor\Doubles;

use OpenEMR\Tests\Isolated\PatientFile\History\Editor\EditorRouteScenario;

final class HeaderDouble
{
    public const MARKER = '<!--HISTORY-EDITOR-HEADER-DOUBLE-->';

    /**
     * @param list<string> $assets
     */
    public static function setupHeader(array $assets = []): void
    {
        EditorRouteScenario::$headers[] = $assets;
        echo self::MARKER . "\n";
    }
}
