<?php

/**
 * TEST-ONLY stand-in for OpenEMR\Menu\PatientMenuRole, aliased by HistoryRouteHarness.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\History\Doubles;

final class PatientMenuRoleDouble
{
    public const MARKER = '<!-- TEST DOUBLE PatientMenuRole::displayHorizNavBarMenu -->';

    public function displayHorizNavBarMenu(): void
    {
        echo self::MARKER . "\n";
    }
}
