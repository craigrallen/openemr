<?php

/**
 * TEST DOUBLE for IssueTypeRegistry: one synthetic issue type, no database.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\ProblemEncounter\Doubles;

final class IssueTypeRegistryDouble
{
    /**
     * @return array<string, list<string>>
     */
    public static function issueTypes(): array
    {
        return ['medical_problem' => ['Medical Problems', 'SYNTHETIC Problem', 'P']];
    }
}
