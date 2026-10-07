<?php

/**
 * TEST-ONLY stand-in for OpenEMR\Services\SocialHistoryService, aliased by HistoryRouteHarness.
 *
 * The real newHistoryData() (library/patient.inc.php) calls create(); this double records the
 * insert instead of writing to a database, then makes the follow-up read return a row.
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

final class SocialHistoryServiceDouble
{
    public function create(mixed $record): void
    {
        HistoryRouteScenario::$created[] = $record;
        HistoryRouteScenario::$history = ['pid' => '7', 'tobacco' => 'SYNTHETIC created row'];
    }
}
