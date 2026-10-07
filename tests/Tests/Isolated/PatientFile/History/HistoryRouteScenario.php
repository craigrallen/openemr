<?php

/**
 * Inputs and recorded calls for the History route render test doubles.
 *
 * TEST-ONLY. Every value here is synthetic; nothing represents a real patient, ACL or database.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\History;

final class HistoryRouteScenario
{
    public const PID = 7;

    public const SQUAD = 'synthetic-squad';

    public static bool $aclMed = true;

    public static bool $aclWrite = true;

    public static bool $aclSquad = true;

    public static string $squad = '';

    /** @var array<string, string>|false */
    public static array|false $history = ['pid' => '7', 'tobacco' => 'SYNTHETIC tobacco value'];

    public static ?int $grpSize = null;

    public static bool $globalsLoaded = false;

    /** @var list<string> */
    public static array $queries = [];

    /** @var list<string> */
    public static array $acl = [];

    /** @var list<string> */
    public static array $layout = [];

    /** @var list<mixed> */
    public static array $created = [];

    /** @var list<string> */
    public static array $headers = [];

    /** @var array<array-key, mixed> */
    public static array $uiSettings = [];

    /**
     * Stands in for sqlQuery() from library/sql.inc.php. Only the two reads history.php makes
     * through getPatientData() and getHistoryData() are answered; anything else fails loudly.
     *
     * @return array<string, string>|false
     */
    public static function sqlQuery(string $statement, mixed $binds): array|false
    {
        self::$queries[] = $statement;
        if ($binds !== [self::PID]) {
            throw new \LogicException('History route test double: unexpected binds');
        }
        if (str_contains($statement, 'from patient_data')) {
            return ['squad' => self::$squad];
        }
        if (str_contains($statement, 'from history_data')) {
            return self::$history;
        }
        throw new \LogicException('History route test double: unexpected query');
    }

    /**
     * @return array<string, mixed>
     */
    public static function export(): array
    {
        return [
            'aclMed' => self::$aclMed,
            'aclWrite' => self::$aclWrite,
            'aclSquad' => self::$aclSquad,
            'squad' => self::$squad,
            'history' => self::$history,
            'grpSize' => self::$grpSize,
            'globalsLoaded' => self::$globalsLoaded,
            'queries' => self::$queries,
            'acl' => self::$acl,
            'layout' => self::$layout,
            'created' => self::$created,
            'headers' => self::$headers,
        ];
    }

    /**
     * @param array<array-key, mixed> $input
     */
    public static function import(array $input): void
    {
        self::$aclMed = ($input['aclMed'] ?? true) === true;
        self::$aclWrite = ($input['aclWrite'] ?? true) === true;
        self::$aclSquad = ($input['aclSquad'] ?? true) === true;
        $squad = $input['squad'] ?? '';
        self::$squad = is_string($squad) ? $squad : '';
        $grpSize = $input['grpSize'] ?? null;
        self::$grpSize = is_int($grpSize) ? $grpSize : null;
    }
}
