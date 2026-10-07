<?php

/**
 * TEST DOUBLE for OpenEMR\Common\Acl\AclMain in the History editor route test.
 *
 * Answers only the two checks history_full.php makes; any other check fails loudly.
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

final class AclMainDouble
{
    public static function aclCheckCore(mixed $section, mixed $value, mixed $user = '', mixed $return_value = ''): bool
    {
        $call = json_encode([$section, $value, $user, $return_value], JSON_THROW_ON_ERROR);
        EditorRouteScenario::$acl[] = $call;
        return match ($call) {
            '["patients","med","",""]' => EditorRouteScenario::$aclMed,
            '["patients","med","",["write","addonly"]]' => true,
            default => throw new \LogicException('History editor route double: unexpected ACL check'),
        };
    }
}
