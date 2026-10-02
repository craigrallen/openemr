<?php

/**
 * Parses and validates a synthetic fixture. Rejects anything that could look
 * like a real person or a deliverable contact, unsafe column names, dangling
 * references and dates far from the current week. Messages never echo values.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

use JsonException;

final class FixtureLoader
{
    /** Columns the seeder sets itself; fixtures may not override them. */
    public const MANAGED_COLUMNS = ['id', 'pid', 'encounter', 'user', 'groupname', 'authorized', 'activity', 'date', 'form_id', 'uuid', 'patient_id'];
    private const COLUMN = '/^[A-Za-z_][A-Za-z0-9_]{0,63}$/';
    /** Swedish personnummer/samordningsnummer shapes (YYMMDD-NNNN, YYYYMMDDNNNN, ...). */
    private const PERSONAL_NUMBER = '/(?<!\d)(\d{2})?\d{6}[-+]?\d{4}(?!\d)/';
    private const PHONE = '/\+\d[\d\s().-]{6,}|(?<!\d)0\d{1,3}[\s-]?\d{2,3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)/';
    private const PHONE_FIELDS = ['phone_home', 'phone_biz', 'phone_contact', 'phone_cell'];

    public static function defaultPath(): string
    {
        return dirname(__DIR__, 3) . '/contrib/util/demo-seed/fixtures/synthetic-demo-v1.json';
    }

    public static function fromFile(string $path): Fixture
    {
        $json = is_file($path) ? file_get_contents($path) : false;
        if ($json === false) {
            throw new InvalidFixtureException('Fixture file is not readable.');
        }
        try {
            $data = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new InvalidFixtureException('Fixture is not valid JSON.', 0, $e);
        }
        if (!is_array($data)) {
            throw new InvalidFixtureException('Fixture root must be an object.');
        }
        $root = [];
        foreach ($data as $k => $v) {
            $root[(string) $k] = $v;
        }
        return self::fromArray($root);
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): Fixture
    {
        $seedKey = Val::str($data, 'seed_key', '');
        if (preg_match('/^[a-z0-9-]{3,32}$/', $seedKey) !== 1) {
            throw new InvalidFixtureException('seed_key is missing or malformed.');
        }
        self::assertNoRealIdentifiers($data);

        $staff = Val::list($data, 'staff');
        $staffKeys = self::uniqueKeys($staff, 'key', 'staff');
        foreach ($staff as $s) {
            if (!str_starts_with(Val::str($s, 'username'), 'synth-') || !str_contains(Val::str($s, 'lname'), 'SYNTHETIC')) {
                throw new InvalidFixtureException('Staff must be visibly synthetic (synth- username, SYNTHETIC name).');
            }
        }
        $insurers = Val::list($data, 'insurers');
        $insurerKeys = self::uniqueKeys($insurers, 'key', 'insurers');
        $lab = Val::map($data, 'lab');
        $tests = Val::list($lab, 'tests');
        $testCodes = self::uniqueKeys($tests, 'code', 'lab tests');

        foreach (Val::list($data, 'provider_blocks') as $b) {
            self::assertRef($staffKeys, Val::str($b, 'provider'), 'provider block provider');
            self::assertNearWeek(Val::int($b, 'day'));
            self::assertNearWeek(Val::int($b, 'until_day', Val::int($b, 'day')));
        }
        foreach (Val::list($data, 'clinic_events') as $e) {
            self::assertNearWeek(Val::int($e, 'day'));
        }

        $patients = Val::list($data, 'patients');
        if ($patients === []) {
            throw new InvalidFixtureException('Fixture has no patients.');
        }
        self::uniqueKeys($patients, 'pubpid', 'patients');
        foreach ($patients as $p) {
            self::validatePatient($p, $staffKeys, $insurerKeys, $testCodes);
        }

        return new Fixture(
            $seedKey,
            Val::map($data, 'facility'),
            $staff,
            $insurers,
            $lab,
            Val::list($data, 'provider_blocks'),
            Val::list($data, 'clinic_events'),
            Val::list($data, 'office_notes'),
            $patients,
        );
    }

    /**
     * @param array<string, mixed> $p
     * @param list<string> $staff
     * @param list<string> $insurers
     * @param list<string> $tests
     */
    private static function validatePatient(array $p, array $staff, array $insurers, array $tests): void
    {
        if (preg_match('/^SYNTH-DEMO-\d{4}$/', Val::str($p, 'pubpid')) !== 1) {
            throw new InvalidFixtureException('Patient pubpid must match SYNTH-DEMO-NNNN.');
        }
        if (!str_contains(Val::str($p, 'lname'), 'SYNTHETIC')) {
            throw new InvalidFixtureException('Patient names must be visibly SYNTHETIC.');
        }
        if (!str_ends_with(Val::str($p, 'email'), '.invalid')) {
            throw new InvalidFixtureException('Patient email must use the reserved .invalid TLD.');
        }
        foreach (self::PHONE_FIELDS as $f) {
            if (Val::str($p, $f, '') !== '') {
                throw new InvalidFixtureException('Patient phone fields must be empty (placeholder is applied by the seeder).');
            }
        }
        self::assertRef($staff, Val::str($p, 'provider'), 'patient provider');
        foreach (Val::list($p, 'insurance') as $i) {
            self::assertRef($insurers, Val::str($i, 'insurer'), 'insurance insurer');
        }
        $encounters = Val::list($p, 'encounters');
        $encKeys = self::uniqueKeys($encounters, 'key', 'encounters');
        foreach ($encounters as $e) {
            self::assertRef($staff, Val::str($e, 'provider'), 'encounter provider');
            self::assertNearWeek(Val::int($e, 'day'));
            foreach (Val::map($e, 'forms') as $formdir => $payload) {
                if (!FormCatalog::isSeedable($formdir)) {
                    throw new InvalidFixtureException("Form '{$formdir}' is not seedable.");
                }
                $rows = is_array($payload) && array_is_list($payload) ? $payload : [$payload];
                foreach ($rows as $row) {
                    if (!is_array($row)) {
                        throw new InvalidFixtureException('Form payload must be an object.');
                    }
                    foreach (array_keys($row) as $column) {
                        $column = (string) $column;
                        if (preg_match(self::COLUMN, $column) !== 1 || in_array($column, self::MANAGED_COLUMNS, true)) {
                            throw new InvalidFixtureException('Form payload has an unsafe or seeder-managed column.');
                        }
                    }
                }
            }
            foreach (Val::list($e, 'payments') as $pay) {
                if (Val::str($pay, 'payer') === 'insurance') {
                    self::assertRef($insurers, Val::str($pay, 'insurer'), 'payment insurer');
                }
            }
            $order = Val::map($e, 'lab_order');
            foreach (Val::list($order, 'lab_tests') as $t) {
                self::assertRef($tests, Val::str($t, 'value'), 'lab test');
            }
        }
        foreach (['issues', 'prescriptions', 'documents'] as $section) {
            foreach (Val::list($p, $section) as $item) {
                if (isset($item['encounter'])) {
                    self::assertRef($encKeys, Val::str($item, 'encounter'), "{$section} encounter");
                }
            }
        }
        foreach (['appointments', 'prescriptions', 'immunizations', 'transactions'] as $section) {
            foreach (Val::list($p, $section) as $item) {
                self::assertNearWeek(Val::int($item, 'day'));
                if (isset($item['provider'])) {
                    self::assertRef($staff, Val::str($item, 'provider'), "{$section} provider");
                }
            }
        }
        foreach (Val::list($p, 'messages') as $m) {
            self::assertRef($staff, Val::str($m, 'to'), 'message recipient');
            self::assertRef($staff, Val::str($m, 'from'), 'message sender');
        }
        foreach (Val::list($p, 'transactions') as $t) {
            if (!in_array(Val::str($t, 'form_id'), FormCatalog::TRANSACTION_LAYOUTS, true)) {
                throw new InvalidFixtureException('Unknown transaction layout.');
            }
        }
    }

    private static function assertNearWeek(int $day): void
    {
        if (abs($day) > DemoCalendar::MAX_OFFSET_DAYS) {
            throw new InvalidFixtureException('Scheduled dates must be within three weeks of the current week.');
        }
    }

    /** @param list<string> $known */
    private static function assertRef(array $known, string $ref, string $what): void
    {
        if (!in_array($ref, $known, true)) {
            throw new InvalidFixtureException("Unknown reference for {$what}.");
        }
    }

    /**
     * @param list<array<string, mixed>> $items
     * @return list<string>
     */
    private static function uniqueKeys(array $items, string $field, string $what): array
    {
        $keys = array_map(static fn(array $i): string => Val::str($i, $field), $items);
        if (count($keys) !== count(array_unique($keys))) {
            throw new InvalidFixtureException("Duplicate {$field} in {$what}.");
        }
        return $keys;
    }

    /** @param array<mixed> $data */
    private static function assertNoRealIdentifiers(array $data): void
    {
        array_walk_recursive($data, static function (mixed $value): void {
            if (!is_string($value)) {
                return;
            }
            if (preg_match(self::PERSONAL_NUMBER, $value) === 1) {
                throw new InvalidFixtureException('Fixture contains a personal-identity-number-shaped value.');
            }
            if (preg_match(self::PHONE, $value) === 1) {
                throw new InvalidFixtureException('Fixture contains a phone-number-shaped value.');
            }
            if (preg_match('/[^\s@]+@[^\s@]+\.[A-Za-z]+$/', $value) === 1 && !str_ends_with($value, '.invalid')) {
                throw new InvalidFixtureException('Fixture email addresses must use the .invalid TLD.');
            }
        });
    }
}
