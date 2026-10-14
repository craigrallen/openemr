<?php

/**
 * Stand-in for interface/orders/qoe.inc.php when the find-order-popup harness
 * runs the real route. Records each call and returns a synthetic marker, so
 * the test sees exactly which arguments the route passed.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

function generate_qoe_html(int $ptid, int $formid, int $prid, int $formseq): string
{
    \OpenEMR\Tests\Js\Fixtures\FindOrderPopupHarness::record('qoe', [$ptid, $formid, $prid, $formseq]);

    return sprintf('QOE-%d-%d-%d-%d', $ptid, $formid, $prid, $formseq);
}
