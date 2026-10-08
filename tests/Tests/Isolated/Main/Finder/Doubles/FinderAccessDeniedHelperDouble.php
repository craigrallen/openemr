<?php

/**
 * TEST DOUBLE for OpenEMR\Common\Acl\AccessDeniedHelper in the finder route tests.
 *
 * The real denyWithTemplate() audits the denial and exits; this records the arguments and
 * whatever the route has emitted so far, then throws, which honours the same never-returns
 * contract without a database or exit().
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

final class FinderAccessDeniedHelperDouble
{
    public static function denyWithTemplate(string $comment, string $pageTitle, string ...$rest): never
    {
        FinderRouteScenario::$denials[] = func_get_args();
        FinderRouteScenario::$outputAtDenial[] = ['level' => ob_get_level(), 'output' => ob_get_contents()];
        throw new AccessDeniedSentinel();
    }
}
