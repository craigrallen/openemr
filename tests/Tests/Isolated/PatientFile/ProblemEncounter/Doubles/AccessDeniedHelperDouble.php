<?php

/**
 * TEST DOUBLE for AccessDeniedHelper: records the denial and stops the route by throwing.
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

final class AccessDeniedHelperDouble
{
    public const SIGNAL = 'TEST DOUBLE access denied';

    public static function denyWithTemplate(string $comment, string $pageTitle, string $auditEvent = 'security-access-denied'): never
    {
        ProblemEncounterScenario::$denied[] = [$comment, $pageTitle];
        throw new \DomainException(self::SIGNAL);
    }
}
