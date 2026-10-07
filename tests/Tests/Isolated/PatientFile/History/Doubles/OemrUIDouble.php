<?php

/**
 * TEST-ONLY stand-in for OpenEMR\OeUI\OemrUI, aliased by HistoryRouteHarness.
 *
 * Records the page's settings. oeContainer() returns 'container', which is what the real class
 * returns for a non-expandable page such as History.
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

final readonly class OemrUIDouble
{
    public const BELOW = '<!-- TEST DOUBLE OemrUI::oeBelowContainerDiv -->';

    /**
     * @param array<array-key, mixed> $settings
     */
    public function __construct(array $settings = [])
    {
        HistoryRouteScenario::$uiSettings = $settings;
    }

    public function oeContainer(): string
    {
        return 'container';
    }

    public function oeBelowContainerDiv(): void
    {
        echo self::BELOW;
    }
}
