<?php

/**
 * TEST-ONLY stand-in for OpenEMR\Core\Header, aliased by HistoryRouteHarness.
 *
 * Emits a visible marker instead of the theme/asset tags, which need the full kernel config.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\History\Doubles;

use OpenEMR\Tests\Isolated\PatientFile\History\HistoryRouteScenario;

final class HeaderDouble
{
    public const MARKER = '<!-- TEST DOUBLE Header::setupHeader -->';

    public static function setupHeader(mixed $assets = [], bool $echoOutput = true): void
    {
        HistoryRouteScenario::$headers[] = json_encode($assets, JSON_THROW_ON_ERROR);
        echo self::MARKER . "\n";
    }
}
