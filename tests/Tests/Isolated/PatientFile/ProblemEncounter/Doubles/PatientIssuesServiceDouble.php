<?php

/**
 * TEST DOUBLE for PatientIssuesService: any mutation on a page view fails the test.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\ProblemEncounter\Doubles;

use OpenEMR\Tests\Isolated\PatientFile\ProblemEncounter\ProblemEncounterScenario;

final class PatientIssuesServiceDouble
{
    public function __construct()
    {
        ProblemEncounterScenario::$serviceCreated++;
    }

    /**
     * @param array<array-key, mixed> $encountersByListId
     */
    public function replacePatientEncounterIssues(mixed $pid, array $encountersByListId, mixed $userId): never
    {
        throw new \LogicException('Issues and Encounters test double: mutation attempted on a page view');
    }
}
