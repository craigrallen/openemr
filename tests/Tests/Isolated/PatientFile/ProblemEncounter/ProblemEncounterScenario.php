<?php

/**
 * Recorded state and SYNTHETIC data for the Issues and Encounters route render test.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\ProblemEncounter;

final class ProblemEncounterScenario
{
    public const PID = 900001;

    /** @var array<string, bool> */
    public static array $aclAnswers = [];

    /** @var list<string> */
    public static array $acl = [];

    /** @var list<array{string, string}> */
    public static array $denied = [];

    /** @var list<string> */
    public static array $headers = [];

    /** @var list<array{string, mixed}> */
    public static array $queries = [];

    public static int $serviceCreated = 0;

    public static bool $globalsLoaded = false;

    /** @var array<string, string> */
    public static array $patient = ['fname' => 'SYNTHETIC', 'lname' => 'Patient', 'squad' => ''];

    /** @var array<string, list<array<string, string>>> */
    public static array $rows = [];

    public static function grantAll(): void
    {
        self::$aclAnswers = [
            '["encounters","notes","","write"]' => true,
            '["encounters","notes_a","","write"]' => true,
            '["patients","med","","write"]' => true,
        ];
        self::$rows = [
            'lists' => [['id' => '41', 'type' => 'medical_problem', 'title' => 'SYNTHETIC issue <b>', 'comments' => 'SYNTHETIC note']],
            'form_encounter' => [['encounter' => '77', 'date' => '2000-01-02 03:04:05', 'reason' => 'SYNTHETIC reason']],
            'issue_encounter' => [['list_id' => '41', 'encounter' => '77']],
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function sqlQuery(string $statement, mixed $binds): array
    {
        self::$queries[] = [$statement, $binds];
        return self::$patient;
    }

    public static function sqlStatement(string $statement, mixed $binds): string
    {
        self::$queries[] = [$statement, $binds];
        if (preg_match('/FROM (lists|form_encounter|issue_encounter) WHERE pid = \?/', $statement, $m) !== 1) {
            throw new \LogicException('Issues and Encounters test double: unexpected statement');
        }
        return $m[1];
    }

    /**
     * @return array<string, string>|false
     */
    public static function sqlFetchArray(mixed $result): array|false
    {
        if (!is_string($result) || !array_key_exists($result, self::$rows)) {
            throw new \LogicException('Issues and Encounters test double: unknown result set');
        }
        return array_shift(self::$rows[$result]) ?? false;
    }
}
