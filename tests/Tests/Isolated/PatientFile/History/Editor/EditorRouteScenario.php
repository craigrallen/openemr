<?php

/**
 * Fixed SYNTHETIC state and call recorder for the History editor route test.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\History\Editor;

final class EditorRouteScenario
{
    public const PID = 7;

    public const CSRF_KEY = 'synthetic-csrf-private-key';

    public static bool $aclMed = true;

    public static bool $globalsLoaded = false;

    /** @var list<string> */
    public static array $queries = [];

    /** @var list<string> */
    public static array $acl = [];

    /** @var list<string> */
    public static array $layout = [];

    /** @var list<list<string>> */
    public static array $headers = [];

    /** @var array<array-key, mixed> */
    public static array $uiSettings = [];

    /**
     * Stands in for sqlQuery() from library/sql.inc.php. Only the reads history_full.php makes
     * through getPatientData() and getHistoryData() are answered; anything else fails loudly.
     *
     * @return array<string, string>
     */
    public static function sqlQuery(string $statement, mixed $binds): array
    {
        self::$queries[] = $statement;
        if ($binds !== [self::PID]) {
            throw new \LogicException('History editor route double: unexpected binds');
        }
        if (str_contains($statement, 'from patient_data')) {
            return ['squad' => ''];
        }
        if (str_contains($statement, 'from history_data')) {
            return ['pid' => (string) self::PID, 'tobacco' => ''];
        }
        throw new \LogicException('History editor route double: unexpected query');
    }

    public static function fixture(string $name): string
    {
        $markup = file_get_contents(__DIR__ . '/fixtures/' . $name);
        if (!is_string($markup)) {
            throw new \RuntimeException('Missing History editor fixture');
        }
        return $markup;
    }
}
