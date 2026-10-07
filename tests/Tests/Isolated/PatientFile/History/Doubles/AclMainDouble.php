<?php

/**
 * TEST-ONLY stand-in for OpenEMR\Common\Acl\AclMain, aliased by HistoryRouteHarness.
 *
 * Answers only the three checks history.php makes; any other check fails loudly.
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

final class AclMainDouble
{
    public static function aclCheckCore(mixed $section, mixed $value, mixed $user = '', mixed $return_value = ''): bool
    {
        $call = json_encode([$section, $value, $user, $return_value], JSON_THROW_ON_ERROR);
        HistoryRouteScenario::$acl[] = $call;
        return match ($call) {
            '["patients","med","",""]' => HistoryRouteScenario::$aclMed,
            '["patients","med","",["write","addonly"]]' => HistoryRouteScenario::$aclWrite,
            '["squads","' . HistoryRouteScenario::SQUAD . '","",""]' => HistoryRouteScenario::$aclSquad,
            default => throw new \LogicException('History route test double: unexpected ACL check'),
        };
    }
}
