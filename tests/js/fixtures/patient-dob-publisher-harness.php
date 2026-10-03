<?php

/**
 * Runs the real OpenEMR\Patient\PatientDobContext publisher guard without a
 * database so Jest can feed its output into the real setPatient proxy.
 *
 * The label closure here only echoes the validated Y-m-d value; the chart
 * pages pass their own translated oeFormatShortDate()/age closure, which needs
 * globals and is not exercised here.
 *
 * Usage: php patient-dob-publisher-harness.php '<json DOB_YMD value>'
 * Prints the JSON-encoded str_dob that the chart page would publish.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

require dirname(__DIR__, 3) . '/src/Patient/PatientDobContext.php';

use OpenEMR\Patient\PatientDobContext;

$dobYmd = json_decode($argv[1] ?? 'null', false, 2, JSON_THROW_ON_ERROR);
echo json_encode(
    PatientDobContext::headerString($dobYmd, fn(string $dob): string => ' DOB: ' . $dob),
    JSON_THROW_ON_ERROR
);
