<?php

/**
 * TEST DOUBLE for OpenEMR\Common\Acl\AclMain in the finder route tests.
 *
 * Answers only the patients/demo check patient_select.php makes; any other check fails loudly.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Main\Finder\Doubles;

use OpenEMR\Tests\Isolated\Main\Finder\FinderRouteScenario;

final class FinderAclMainDouble
{
    public static function aclCheckCore(mixed $section, mixed $value, mixed $user = '', mixed $return_value = ''): bool
    {
        $call = json_encode([$section, $value, $user, $return_value], JSON_THROW_ON_ERROR);
        FinderRouteScenario::$acl[] = $call;
        return match ($call) {
            '["patients","demo","",""]' => FinderRouteScenario::$aclDemo,
            default => throw new \LogicException('Finder route double: unexpected ACL check'),
        };
    }
}
