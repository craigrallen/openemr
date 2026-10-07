<?php

/**
 * TEST DOUBLE for OpenEMR\OeUI\OemrUI in the History editor route test.
 *
 * Records the page settings; the real class renders Twig help/action markup below the container.
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

final readonly class OemrUIDouble
{
    /**
     * @param array<array-key, mixed> $arrOeUiSettings
     */
    public function __construct(array $arrOeUiSettings = [])
    {
        EditorRouteScenario::$uiSettings = $arrOeUiSettings;
    }

    public function oeBelowContainerDiv(): void
    {
        echo "<!-- TEST DOUBLE OemrUI::oeBelowContainerDiv -->\n";
    }
}
