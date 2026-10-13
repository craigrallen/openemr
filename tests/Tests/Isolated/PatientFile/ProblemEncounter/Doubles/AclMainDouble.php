<?php

/**
 * TEST DOUBLE for AclMain in the Issues and Encounters route render test.
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

final class AclMainDouble
{
    public static function aclCheckCore(mixed $section, mixed $value, mixed $user = '', mixed $return_value = ''): bool
    {
        $call = json_encode([$section, $value, $user, $return_value], JSON_THROW_ON_ERROR);
        ProblemEncounterScenario::$acl[] = $call;
        return ProblemEncounterScenario::$aclAnswers[$call]
            ?? throw new \LogicException('Issues and Encounters test double: unexpected ACL check');
    }
}
