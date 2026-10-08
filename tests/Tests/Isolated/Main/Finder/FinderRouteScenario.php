<?php

/**
 * Fixed SYNTHETIC state, exact SQL doubles and call recorder for the finder route tests.
 *
 * Only the statements listed here are answered, matched on whitespace-normalised text and
 * exact binds; anything else fails closed. The patient read filters a SYNTHETIC table by the
 * bound pubpid prefix, and each encounter read returns the single row MySQL returns for an
 * ungrouped aggregate: NULL MAX() values and zero counts when no encounters exist.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Main\Finder;

final class FinderRouteScenario
{
    public const CSRF_KEY = 'synthetic-finder-csrf-private-key';

    public const PID = '9001';

    public const OTHER_PID = '9002';

    /** SYNTHETIC search term and patient name holding characters text()/attr() must escape. */
    public const SEARCH = "SYN-1'<x>";

    public const ESCAPED_SEARCH = 'SYN-1&#039;&lt;x&gt;';

    /** Starts with SEARCH, so it matches the bound "SEARCH%" prefix; text() keeps the quote. */
    public const PUBPID = "SYN-1'<x>-A";

    public const ESCAPED_PUBPID = 'SYN-1\'&lt;x&gt;-A';

    public const RAW_LNAME = 'Synthetic<b>';

    public const ESCAPED_NAME = 'Synthetic&lt;b&gt;, Alpha&amp;Co';

    private const PATIENT_SELECT = 'SELECT * FROM patient_data WHERE pubpid LIKE ? ORDER BY id ASC, lname ASC, fname ASC LIMIT ? OFFSET ?';

    private const PATIENT_COUNT = 'SELECT count(*) AS count FROM patient_data WHERE pubpid LIKE ?';

    private const ENCOUNTER_STATEMENTS = [
        "select max(form_encounter.date) as mydate, (to_days(current_date())-to_days(max(form_encounter.date))) as day_diff, (max(form_encounter.date) + interval 90 day) as next_appt, dayname(max(form_encounter.date) + interval 90 day) as next_appt_day from form_encounter join billing on billing.encounter = form_encounter.encounter and billing.pid = form_encounter.pid and billing.activity = 1 and billing.code_type not like 'COPAY' where form_encounter.pid = ?",
        "select max(form_encounter.date) as mydate, (to_days(current_date())-to_days(max(form_encounter.date))) as day_diff, (max(form_encounter.date) + interval 90 day) as next_appt, dayname(max(form_encounter.date) + interval 90 day) as next_appt_day from form_encounter where form_encounter.pid = ?",
        "select count(distinct date) as encounter_count from billing where code_type not like 'COPAY' and activity = 1 and pid = ?",
        'select count(date) as encounter_count from form_encounter where pid = ?',
    ];

    /** One-row aggregate results, in statement order, for a patient with no encounters. */
    public const NEVER_SEEN = [
        ['mydate' => null, 'day_diff' => null, 'next_appt' => null, 'next_appt_day' => null],
        ['mydate' => null, 'day_diff' => null, 'next_appt' => null, 'next_appt_day' => null],
        ['encounter_count' => '0'],
        ['encounter_count' => '0'],
    ];

    /** Billed visit 2026-09-01, later unbilled visit 2026-10-01; "today" is 2026-10-08. */
    public const SEEN = [
        ['mydate' => '2026-09-01 10:00:00', 'day_diff' => '37', 'next_appt' => '2026-11-30 10:00:00', 'next_appt_day' => 'Monday'],
        ['mydate' => '2026-10-01 09:00:00', 'day_diff' => '7', 'next_appt' => '2026-12-30 09:00:00', 'next_appt_day' => 'Wednesday'],
        ['encounter_count' => '2'],
        ['encounter_count' => '3'],
    ];

    public static bool $globalsLoaded = false;

    public static bool $aclDemo = true;

    /** @var list<list<string>|string> */
    public static array $headers = [];

    /** @var list<string> */
    public static array $acl = [];

    /** @var list<list<mixed>> */
    public static array $denials = [];

    /** @var list<string> */
    public static array $queries = [];

    /** @var list<array{level: int, output: string|false}> */
    public static array $outputAtDenial = [];

    /** @var list<string> */
    public static array $listTitles = [];

    /** @var list<array<string, string|null>> */
    public static array $encounterAggregates = self::SEEN;

    /** @var list<array<string, string|null>> */
    public static array $patientRows = [
        [
            'pid' => self::PID,
            'pubpid' => self::PUBPID,
            'lname' => self::RAW_LNAME,
            'fname' => 'Alpha&Co',
            'sex' => 'Female',
            'DOB' => '1980-02-03',
            'ss' => '',
            'phone_home' => '555-0100',
            'phone_biz' => '',
            'phone_contact' => '',
            'phone_cell' => '',
        ],
        [
            'pid' => self::OTHER_PID,
            'pubpid' => 'SYN-2',
            'lname' => 'Other',
            'fname' => 'Beta',
            'sex' => 'Male',
            'DOB' => '1975-06-07',
            'ss' => '',
            'phone_home' => '555-0199',
            'phone_biz' => '',
            'phone_contact' => '',
            'phone_cell' => '',
        ],
    ];

    /**
     * @return array<string, string|null>
     */
    public static function otherPatient(): array
    {
        return self::$patientRows[1];
    }

    /**
     * The exact statement log for an "ID" search returning $rows patients.
     *
     * @return list<string>
     */
    public static function expectedQueries(int $rows): array
    {
        $search = json_encode([self::SEARCH . '%'], JSON_THROW_ON_ERROR);
        $expected = [
            self::PATIENT_SELECT . ' ' . json_encode([self::SEARCH . '%', 100, 0], JSON_THROW_ON_ERROR),
            self::PATIENT_COUNT . ' ' . $search,
        ];
        for ($i = 0; $i < $rows; $i++) {
            foreach (self::ENCOUNTER_STATEMENTS as $statement) {
                $expected[] = $statement . ' ' . json_encode([self::PID], JSON_THROW_ON_ERROR);
            }
        }
        return $expected;
    }

    /**
     * Stands in for sqlQuery(); answers only the real _set_patient_inc_count() read.
     *
     * @return array<string, string>
     */
    public static function sqlQuery(string $statement, mixed $binds): array
    {
        $key = self::record($statement, $binds);
        if ($key === self::PATIENT_COUNT . ' ' . json_encode([self::SEARCH . '%'], JSON_THROW_ON_ERROR)) {
            return ['count' => (string) count(self::matchingPatients())];
        }
        throw new \LogicException('Finder route double: unrecorded sqlQuery statement');
    }

    /**
     * Stands in for sqlStatement(); answers the real getPatientId() read and, for the matching
     * patient only, the four per-row aggregate encounter reads.
     */
    public static function sqlStatement(string $statement, mixed $binds): FinderResultDouble
    {
        $key = self::record($statement, $binds);
        if ($key === self::PATIENT_SELECT . ' ' . json_encode([self::SEARCH . '%', 100, 0], JSON_THROW_ON_ERROR)) {
            return new FinderResultDouble(self::matchingPatients());
        }
        foreach (self::ENCOUNTER_STATEMENTS as $index => $encounter) {
            if ($key === $encounter . ' ' . json_encode([self::PID], JSON_THROW_ON_ERROR)) {
                return new FinderResultDouble([self::$encounterAggregates[$index]]);
            }
        }
        throw new \LogicException('Finder route double: unrecorded sqlStatement statement');
    }

    /**
     * @return array<string, string|null>|false
     */
    public static function sqlFetchArray(mixed $result): array|false
    {
        if (!$result instanceof FinderResultDouble) {
            throw new \LogicException('Finder route double: foreign result set');
        }
        return $result->next();
    }

    /**
     * The SYNTHETIC rows a "pubpid LIKE 'SEARCH%'" read selects (SEARCH holds no wildcards).
     *
     * @return list<array<string, string|null>>
     */
    private static function matchingPatients(): array
    {
        return array_values(array_filter(
            self::$patientRows,
            static fn (array $row): bool => str_starts_with($row['pubpid'] ?? '', self::SEARCH)
        ));
    }

    private static function record(string $statement, mixed $binds): string
    {
        $key = trim((string) preg_replace('/\s+/', ' ', $statement)) . ' ' . json_encode($binds, JSON_THROW_ON_ERROR);
        self::$queries[] = $key;
        return $key;
    }
}
