<?php

/**
 * Inserts the synthetic demo fixture as real, linked OpenEMR records.
 *
 * - Insert-only: never updates or deletes. A pre-existing row that uses a
 *   reserved synthetic natural key but lacks the seed marker aborts the run.
 * - Idempotent: reference rows are reused by natural key + marker; a marked
 *   patient (pubpid + genericname1/genericval1) is skipped only when its whole
 *   subtree verifies against the fixture. An incomplete patient, or one marked
 *   by a different fixture version, aborts the run without changes.
 * - Atomic: one transaction; any failure rolls back every insert.
 * - No outbound effects: no credentials, no eRx flags, no alert flags, no lab
 *   transport, .invalid emails and empty phone numbers.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

use DateTimeImmutable;
use Throwable;

final class DemoSeeder
{
    public const PATIENT_MARKER_NAME = 'synthetic_demo_seed';

    private SeedGateway $db;
    private SeedReport $report;
    private Fixture $fixture;
    /** @var array<string, array{id: int, username: string}> */
    private array $users = [];
    private int $facilityId = 0;
    private string $facilityName = '';
    /** @var array<string, int> */
    private array $insurers = [];
    private int $labId = 0;
    /** @var array<string, array<string, mixed>> */
    private array $tests = [];
    /** @var array<string, array{id: int, duration: int}> */
    private array $calendarCategories = [];
    private string $now;

    public function __construct(private readonly SeedGateway $gateway, private readonly DemoCalendar $calendar)
    {
        $this->db = $gateway;
        $this->report = new SeedReport();
        $this->now = $calendar->now()->format('Y-m-d H:i:s');
    }

    public function seed(Fixture $fixture): SeedReport
    {
        return $this->execute($fixture, $this->gateway);
    }

    /** Dry-run: resolves every reference against the database and counts inserts without writing. */
    public function plan(Fixture $fixture): SeedReport
    {
        return $this->execute($fixture, new DryRunSeedGateway($this->gateway));
    }

    private function execute(Fixture $fixture, SeedGateway $db): SeedReport
    {
        $this->db = $db;
        $this->fixture = $fixture;
        $this->report = new SeedReport();
        $this->users = [];
        $this->insurers = [];
        $this->tests = [];
        $this->calendarCategories = [];
        $db->begin();
        try {
            $this->run();
            $db->commit();
        } catch (Throwable $e) {
            $db->rollback();
            throw $e;
        }
        return $this->report;
    }

    private function run(): void
    {
        $f = $this->fixture;
        $this->seedFacility($f->facility);
        foreach ($f->staff as $s) {
            $this->seedUser($s);
        }
        foreach ($f->insurers as $i) {
            $this->seedInsurer($i);
        }
        $this->seedLab($f->lab);
        foreach ($f->providerBlocks as $b) {
            $this->seedProviderBlock($b);
        }
        foreach ($f->clinicEvents as $e) {
            $this->seedClinicEvent($e);
        }
        foreach ($f->officeNotes as $n) {
            $body = Val::str($n, 'body') . ' ' . $f->marker('onote:' . Val::str($n, 'key'));
            if ($this->db->findOne('onotes', ['body' => $body]) === null) {
                $this->insert('onotes', ['date' => $this->now, 'body' => $body, 'user' => $this->frontDesk()['username'], 'groupname' => 'Default', 'activity' => 1]);
            }
        }
        foreach ($f->patients as $p) {
            $this->seedPatient($p);
        }
    }

    /** @param array<string, scalar|null> $row */
    private function insert(string $table, array $row): int
    {
        $id = $this->db->insert($table, $row);
        $this->report->count($table);
        return $id;
    }

    /**
     * Reuse a marked row with the given natural key, refuse an unmarked one.
     *
     * @param array<string, scalar|null> $naturalKey
     * @return array<string, scalar|null>|null existing marked row
     */
    private function existing(string $table, array $naturalKey, string $markerColumn): ?array
    {
        $row = $this->db->findOne($table, $naturalKey);
        if ($row === null) {
            return null;
        }
        if (!str_contains((string) ($row[$markerColumn] ?? ''), $this->fixture->marker())) {
            throw new SeedConflictException("A pre-existing {$table} record uses a reserved synthetic key; it was not modified and seeding was aborted.");
        }
        $this->report->skipped++;
        return $row;
    }

    /** @param array<string, mixed> $f */
    private function seedFacility(array $f): void
    {
        $name = Val::str($f, 'name');
        $this->facilityName = $name;
        $row = $this->existing('facility', ['name' => $name], 'info');
        if ($row !== null) {
            $this->facilityId = (int) $row['id'];
            return;
        }
        $this->facilityId = $this->insert('facility', [
            'uuid' => $this->db->newUuid('facility'), 'name' => $name, 'phone' => '', 'fax' => '',
            'street' => Val::str($f, 'street'), 'city' => Val::str($f, 'city'), 'state' => '',
            'postal_code' => Val::str($f, 'postal_code'), 'country_code' => Val::str($f, 'country_code'),
            'federal_ein' => '', 'website' => '', 'email' => '', 'service_location' => 1, 'billing_location' => 1,
            'accepts_assignment' => 1, 'pos_code' => Val::int($f, 'pos_code'), 'attn' => '', 'domain_identifier' => '',
            'facility_npi' => '', 'facility_taxonomy' => '', 'tax_id_type' => '', 'color' => '#99FFFF',
            'primary_business_entity' => 0, 'facility_code' => 'SYNTH', 'info' => $this->fixture->marker('facility'),
            'inactive' => 0, 'date_created' => $this->now, 'last_updated' => $this->now,
        ]);
    }

    /** @param array<string, mixed> $s */
    private function seedUser(array $s): void
    {
        $username = Val::str($s, 'username');
        $row = $this->existing('users', ['username' => $username], 'info');
        $id = $row !== null ? (int) $row['id'] : $this->insert('users', [
            'uuid' => $this->db->newUuid('users'), 'username' => $username, 'password' => '',
            'authorized' => Val::int($s, 'authorized'), 'info' => $this->fixture->marker('user:' . Val::str($s, 'key')),
            'source' => null, 'fname' => Val::str($s, 'fname'), 'mname' => '', 'lname' => Val::str($s, 'lname'), 'suffix' => '',
            'federaltaxid' => '', 'federaldrugid' => '', 'upin' => '', 'facility' => $this->facilityName,
            'facility_id' => $this->facilityId, 'see_auth' => 1, 'active' => 1, 'npi' => '', 'title' => Val::str($s, 'title'),
            'specialty' => Val::str($s, 'specialty'), 'billname' => '', 'email' => '', 'email_direct' => '', 'url' => '',
            'assistant' => '', 'organization' => '', 'valedictory' => '', 'street' => '', 'streetb' => '', 'city' => '',
            'state' => '', 'zip' => '', 'phone' => '', 'fax' => '', 'phonew1' => '', 'phonew2' => '', 'phonecell' => '',
            'notes' => 'SYNTHETIC DEMO STAFF - no login credentials.', 'cal_ui' => 3, 'taxonomy' => '207Q00000X',
            'calendar' => Val::int($s, 'calendar'), 'abook_type' => '', 'default_warehouse' => '', 'irnpool' => '',
            'main_menu_role' => 'standard', 'patient_menu_role' => 'standard', 'portal_user' => 0,
            'date_created' => $this->now, 'last_updated' => $this->now,
        ]);
        $this->users[Val::str($s, 'key')] = ['id' => $id, 'username' => $username];
    }

    /** @param array<string, mixed> $i */
    private function seedInsurer(array $i): void
    {
        $name = Val::str($i, 'name');
        $row = $this->existing('insurance_companies', ['name' => $name], 'attn');
        if ($row !== null) {
            $this->insurers[Val::str($i, 'key')] = (int) $row['id'];
            return;
        }
        $id = $this->db->nextSequence(); // InsuranceCompany ids come from generate_id()
        $this->insert('insurance_companies', [
            'id' => $id, 'uuid' => $this->db->newUuid('insurance_companies'), 'name' => $name,
            'attn' => 'SYNTHETIC DEMO ' . $this->fixture->marker('insurer'), 'cms_id' => '',
            'ins_type_code' => Val::int($i, 'ins_type_code'), 'x12_receiver_id' => '', 'x12_default_partner_id' => null,
            'alt_cms_id' => '', 'inactive' => 0, 'date_created' => $this->now, 'last_updated' => $this->now,
        ]);
        $this->insurers[Val::str($i, 'key')] = $id;
    }

    /** @param array<string, mixed> $lab */
    private function seedLab(array $lab): void
    {
        $name = Val::str($lab, 'name');
        $row = $this->existing('procedure_providers', ['name' => $name], 'notes');
        $fresh = $row === null;
        $this->labId = !$fresh ? (int) $row['ppid'] : $this->insert('procedure_providers', [
            'uuid' => $this->db->newUuid('procedure_providers'), 'name' => $name, 'npi' => '', 'send_app_id' => '',
            'send_fac_id' => '', 'recv_app_id' => '', 'recv_fac_id' => '', 'DorP' => 'D', 'direction' => 'B',
            'protocol' => 'DL', 'remote_host' => '', 'login' => '', 'password' => '', 'orders_path' => '',
            'results_path' => '', 'notes' => 'SYNTHETIC DEMO LAB - no transport configured. ' . $this->fixture->marker('lab'),
            'lab_director' => 0, 'active' => 1, 'type' => null, 'date_created' => $this->now, 'last_updated' => $this->now,
        ]);
        $group = 0;
        if ($fresh) {
            $group = $this->insert('procedure_type', $this->procedureType(0, 'SYNTHETIC demo panel', 'SYN-GRP', 'grp', [], 1));
        }
        foreach (Val::list($lab, 'tests') as $seq => $t) {
            $code = Val::str($t, 'code');
            $existing = $this->db->findOne('procedure_type', ['lab_id' => $this->labId, 'procedure_code' => $code, 'procedure_type' => 'ord']);
            if ($existing === null) {
                $ord = $this->insert('procedure_type', $this->procedureType($group, Val::str($t, 'name'), $code, 'ord', $t, $seq + 1));
                $this->insert('procedure_type', $this->procedureType($ord, Val::str($t, 'name'), $code, 'res', $t, 1));
            }
            $this->tests[$code] = $t;
        }
    }

    /**
     * @param array<string, mixed> $t
     * @return array<string, scalar|null>
     */
    private function procedureType(int $parent, string $name, string $code, string $type, array $t, int $seq): array
    {
        return [
            'parent' => $parent, 'name' => $name, 'lab_id' => $this->labId, 'procedure_code' => $code,
            'procedure_type' => $type, 'body_site' => '', 'specimen' => '', 'route_admin' => '', 'laterality' => '',
            'description' => 'SYNTHETIC DEMO', 'standard_code' => Val::str($t, 'standard_code', ''), 'related_code' => '',
            'units' => Val::str($t, 'units', ''), 'range' => Val::str($t, 'range', ''), 'seq' => $seq, 'activity' => 1,
            'notes' => '', 'transport' => null, 'procedure_type_name' => 'laboratory_test',
        ];
    }

    /** @return array{id: int, duration: int} */
    private function category(string $constant): array
    {
        if (!isset($this->calendarCategories[$constant])) {
            $row = $this->db->findOne('openemr_postcalendar_categories', ['pc_constant_id' => $constant]);
            if ($row === null) {
                throw new InvalidFixtureException("Calendar category '{$constant}' does not exist in this deployment.");
            }
            $this->calendarCategories[$constant] = ['id' => (int) $row['pc_catid'], 'duration' => (int) $row['pc_duration']];
        }
        return $this->calendarCategories[$constant];
    }

    /** @return array{id: int, username: string} */
    private function user(string $key): array
    {
        return $this->users[$key] ?? throw new InvalidFixtureException('Unknown staff reference.');
    }

    /** @return array{id: int, username: string} */
    private function frontDesk(): array
    {
        return $this->user(Val::str($this->fixture->staff[array_key_last($this->fixture->staff)], 'key'));
    }

    /**
     * @param array<string, scalar|null> $extra
     * @return array<string, scalar|null>
     */
    private function event(string $categoryConstant, DateTimeImmutable $start, int $minutes, string $title, string $marker, int $providerId, array $extra = []): array
    {
        $cat = $this->category($categoryConstant);
        $seconds = $minutes > 0 ? $minutes * 60 : $cat['duration'];
        $noRepeat = ['event_repeat_freq' => '', 'event_repeat_freq_type' => '', 'event_repeat_on_num' => '1',
            'event_repeat_on_day' => '0', 'event_repeat_on_freq' => '0', 'exdate' => ''];
        return $extra + [
            'uuid' => $this->db->newUuid('openemr_postcalendar_events'), 'pc_catid' => $cat['id'], 'pc_multiple' => 0,
            'pc_aid' => (string) $providerId, 'pc_pid' => '', 'pc_gid' => 0, 'pc_title' => $title, 'pc_time' => $this->now,
            'pc_hometext' => $marker, 'pc_comments' => 0, 'pc_counter' => 0, 'pc_topic' => 1,
            'pc_informant' => (string) $this->frontDesk()['id'], 'pc_eventDate' => $start->format('Y-m-d'),
            'pc_endDate' => $start->format('Y-m-d'), 'pc_duration' => $seconds, 'pc_recurrtype' => 0,
            'pc_recurrspec' => serialize($noRepeat), 'pc_recurrfreq' => 0, 'pc_startTime' => $start->format('H:i:s'),
            'pc_endTime' => $start->modify("+{$seconds} seconds")->format('H:i:s'), 'pc_alldayevent' => 0,
            'pc_location' => serialize(['event_location' => '', 'event_street1' => '', 'event_street2' => '', 'event_city' => '', 'event_state' => '', 'event_postal' => '']),
            'pc_conttel' => '', 'pc_contname' => '', 'pc_contemail' => '', 'pc_website' => '', 'pc_fee' => '',
            'pc_eventstatus' => 1, 'pc_sharing' => 1, 'pc_language' => '', 'pc_apptstatus' => '-', 'pc_prefcatid' => 0,
            'pc_facility' => $this->facilityId, 'pc_sendalertsms' => 'NO', 'pc_sendalertemail' => 'NO',
            'pc_billing_location' => $this->facilityId, 'pc_room' => '',
        ];
    }

    /** @param array<string, mixed> $b */
    private function seedProviderBlock(array $b): void
    {
        $marker = $this->fixture->marker('block:' . Val::str($b, 'key'));
        if ($this->db->findOne('openemr_postcalendar_events', ['pc_hometext' => $marker]) !== null) {
            $this->report->skipped++;
            return;
        }
        $start = $this->calendar->at(Val::int($b, 'day'), Val::str($b, 'time'));
        $extra = [];
        if (Val::str($b, 'repeat') === 'workday') {
            $extra = ['pc_recurrtype' => 1, 'pc_endDate' => $this->calendar->day(Val::int($b, 'until_day'))->format('Y-m-d'),
                'pc_recurrspec' => serialize(['event_repeat_freq' => '1', 'event_repeat_freq_type' => '4', 'event_repeat_on_num' => '1',
                    'event_repeat_on_day' => '0', 'event_repeat_on_freq' => '0', 'exdate' => ''])];
        }
        if (Val::bool($b, 'allday')) {
            $extra += ['pc_alldayevent' => 1];
        }
        $this->insert('openemr_postcalendar_events', $this->event(
            Val::str($b, 'category'),
            $start,
            Val::int($b, 'minutes'),
            Val::str($b, 'title'),
            $marker,
            $this->user(Val::str($b, 'provider'))['id'],
            $extra,
        ));
    }

    /** @param array<string, mixed> $e */
    private function seedClinicEvent(array $e): void
    {
        foreach ($this->fixture->staff as $s) {
            if (Val::int($s, 'calendar') !== 1 || Val::int($s, 'authorized') !== 1) {
                continue;
            }
            $marker = $this->fixture->marker('clinic:' . Val::str($e, 'key') . ':' . Val::str($s, 'key'));
            if ($this->db->findOne('openemr_postcalendar_events', ['pc_hometext' => $marker]) !== null) {
                $this->report->skipped++;
                continue;
            }
            $this->insert('openemr_postcalendar_events', $this->event(
                Val::str($e, 'category'),
                $this->calendar->day(Val::int($e, 'day')),
                0,
                Val::str($e, 'title'),
                $marker,
                $this->user(Val::str($s, 'key'))['id'],
                ['pc_alldayevent' => 1],
            ));
        }
    }

    /** @param array<string, mixed> $p */
    private function seedPatient(array $p): void
    {
        $pubpid = Val::str($p, 'pubpid');
        $existing = $this->db->findOne('patient_data', ['pubpid' => $pubpid]);
        if ($existing !== null) {
            if (($existing['genericname1'] ?? '') !== self::PATIENT_MARKER_NAME) {
                throw new SeedConflictException('A pre-existing patient uses a reserved synthetic pubpid; it was not modified and seeding was aborted.');
            }
            if (($existing['genericval1'] ?? '') !== $this->fixture->seedKey) {
                throw new SeedConflictException("Synthetic patient {$pubpid} was seeded by a different fixture version; it was not modified and seeding was aborted.");
            }
            if ((new SeedVerifier($this->db))->verifyPatient($this->fixture, $p) !== []) {
                throw new SeedConflictException("Synthetic patient {$pubpid} exists but is incomplete or differs from the fixture; it was not modified and seeding was aborted. Restore the pre-seed backup before re-seeding.");
            }
            $this->report->skipped++;
            return;
        }
        $provider = $this->user(Val::str($p, 'provider'));
        $pid = $this->db->maxValue('patient_data', 'pid') + 1;
        $this->insert('patient_data', [
            'uuid' => $this->db->newUuid('patient_data'), 'title' => '', 'language' => Val::str($p, 'language'),
            'financial' => '', 'fname' => Val::str($p, 'fname'), 'lname' => Val::str($p, 'lname'), 'mname' => '',
            'DOB' => Val::str($p, 'dob'), 'street' => Val::str($p, 'street'), 'postal_code' => Val::str($p, 'postal_code'),
            'city' => Val::str($p, 'city'), 'state' => '', 'country_code' => 'SE', 'drivers_license' => '', 'ss' => '',
            'occupation' => '', 'phone_home' => '', 'phone_biz' => '', 'phone_contact' => '', 'phone_cell' => '',
            'pharmacy_id' => 0, 'status' => '', 'contact_relationship' => '', 'date' => $this->now, 'sex' => Val::str($p, 'sex'),
            'referrer' => '', 'referrerID' => '', 'providerID' => $provider['id'], 'ref_providerID' => 0,
            'email' => Val::str($p, 'email'), 'email_direct' => '', 'ethnoracial' => '', 'race' => '', 'ethnicity' => '',
            'religion' => '', 'interpreter' => '', 'migrantseasonal' => '', 'family_size' => '', 'monthly_income' => '',
            'billing_note' => '', 'homeless' => '', 'pubpid' => $pubpid, 'pid' => $pid,
            'genericname1' => self::PATIENT_MARKER_NAME, 'genericval1' => $this->fixture->seedKey,
            'genericname2' => '', 'genericval2' => '', 'hipaa_mail' => 'NO', 'hipaa_voice' => 'NO', 'hipaa_notice' => 'NO',
            'hipaa_message' => '', 'hipaa_allowsms' => 'NO', 'hipaa_allowemail' => 'NO', 'squad' => '', 'fitness' => 0,
            'referral_source' => '', 'pricelevel' => 'standard', 'regdate' => $this->calendar->day(-14)->format('Y-m-d'),
            'allow_imm_reg_use' => 'NO', 'allow_imm_info_share' => 'NO', 'allow_health_info_ex' => 'NO',
            'allow_patient_portal' => 'NO', 'deceased_reason' => '', 'cmsportal_login' => '', 'county' => '',
            'dupscore' => -9, 'created_by' => $provider['id'], 'updated_by' => $provider['id'], 'last_updated' => $this->now,
        ]);
        $this->seedHistory($pid, Val::columns(Val::map($p, 'history')), $provider['id']);
        foreach (Val::list($p, 'insurance') as $ins) {
            $this->seedInsurance($pid, $p, $ins);
        }
        $encounters = [];
        foreach (Val::list($p, 'encounters') as $e) {
            $encounters[Val::str($e, 'key')] = $this->seedEncounter($pid, $e);
        }
        foreach (Val::list($p, 'issues') as $issue) {
            $this->seedIssue($pid, $issue, $provider, $encounters);
        }
        foreach (Val::list($p, 'prescriptions') as $rx) {
            $this->seedPrescription($pid, $rx, $provider, $encounters);
        }
        foreach (Val::list($p, 'immunizations') as $imm) {
            $this->seedImmunization($pid, $imm, $provider);
        }
        foreach (Val::list($p, 'appointments') as $a) {
            $start = $this->calendar->at(Val::int($a, 'day'), Val::str($a, 'time'));
            $this->insert('openemr_postcalendar_events', $this->event(
                Val::str($a, 'category'),
                $start,
                0,
                Val::str($a, 'title'),
                $this->fixture->marker('appt:' . $pubpid),
                $this->user(Val::str($a, 'provider'))['id'],
                ['pc_pid' => (string) $pid, 'pc_apptstatus' => Val::str($a, 'status')],
            ));
        }
        foreach (Val::list($p, 'documents') as $doc) {
            $encounter = isset($doc['encounter']) ? $encounters[Val::str($doc, 'encounter')] : 0;
            $this->seedDocument($pid, $doc, $encounter);
        }
        foreach (Val::list($p, 'messages') as $m) {
            $from = $this->user(Val::str($m, 'from'));
            $to = $this->user(Val::str($m, 'to'));
            $body = date('Y-m-d H:i', strtotime($this->now) ?: 0) . " ({$from['username']} to {$to['username']}) "
                . Val::str($m, 'body') . ' ' . $this->fixture->marker('msg');
            $this->insert('pnotes', [
                'date' => $this->now, 'body' => $body, 'pid' => $pid, 'user' => $from['username'], 'groupname' => 'Default',
                'activity' => 1, 'authorized' => 0, 'title' => Val::str($m, 'title'), 'assigned_to' => $to['username'],
                'deleted' => 0, 'message_status' => Val::str($m, 'status'), 'portal_relation' => null, 'is_msg_encrypted' => 0,
                'update_by' => $from['id'], 'update_date' => $this->now,
            ]);
        }
        foreach (Val::list($p, 'transactions') as $t) {
            $this->seedTransaction($pid, $t, $provider);
        }
    }

    /** procedure_result.result_code holds the bare LOINC code (FhirObservationLaboratoryService adds the system). */
    public static function bareLoinc(string $standardCode): string
    {
        return str_starts_with($standardCode, 'LOINC:') ? substr($standardCode, 6) : $standardCode;
    }

    /** @param array<string, string> $history */
    private function seedHistory(int $pid, array $history, int $userId): void
    {
        $row = ['uuid' => $this->db->newUuid('history_data'), 'date' => $this->now, 'pid' => $pid, 'created_by' => $userId];
        foreach ($history as $column => $value) {
            $this->assertColumn($column);
            $row[$column] = $value;
        }
        $this->insert('history_data', $row);
    }

    private function assertColumn(string $column): void
    {
        if (preg_match('/^[A-Za-z_][A-Za-z0-9_]{0,63}$/', $column) !== 1 || in_array($column, FixtureLoader::MANAGED_COLUMNS, true)) {
            throw new InvalidFixtureException('Unsafe or seeder-managed column in fixture.');
        }
    }

    /**
     * @param array<string, mixed> $p
     * @param array<string, mixed> $ins
     */
    private function seedInsurance(int $pid, array $p, array $ins): void
    {
        $this->insert('insurance_data', [
            'uuid' => $this->db->newUuid('insurance_data'), 'type' => Val::str($ins, 'type'),
            'provider' => (string) $this->insurers[Val::str($ins, 'insurer')], 'plan_name' => 'SYNTHETIC Demo Plan',
            'policy_number' => Val::str($ins, 'policy_number'), 'group_number' => Val::str($ins, 'group_number'),
            'subscriber_lname' => Val::str($p, 'lname'), 'subscriber_mname' => '', 'subscriber_fname' => Val::str($p, 'fname'),
            'subscriber_relationship' => 'self', 'subscriber_ss' => '', 'subscriber_DOB' => Val::str($p, 'dob'),
            'subscriber_street' => Val::str($p, 'street'), 'subscriber_postal_code' => Val::str($p, 'postal_code'),
            'subscriber_city' => Val::str($p, 'city'), 'subscriber_state' => '', 'subscriber_country' => 'SE',
            'subscriber_phone' => '', 'subscriber_employer' => '', 'subscriber_employer_street' => '',
            'subscriber_employer_postal_code' => '', 'subscriber_employer_state' => '', 'subscriber_employer_country' => '',
            'subscriber_employer_city' => '', 'copay' => Val::str($ins, 'copay'),
            'date' => $this->calendar->day(-365)->format('Y-m-d'), 'pid' => $pid, 'subscriber_sex' => Val::str($p, 'sex'),
            'accept_assignment' => 'TRUE', 'policy_type' => '', 'date_end' => null,
        ]);
    }

    /** @param array<string, mixed> $e */
    private function seedEncounter(int $pid, array $e): int
    {
        $provider = $this->user(Val::str($e, 'provider'));
        $when = $this->calendar->at(Val::int($e, 'day'), Val::str($e, 'time'));
        $date = $when->format('Y-m-d H:i:s');
        $encounter = $this->db->nextSequence();
        $feId = $this->insert('form_encounter', [
            'uuid' => $this->db->newUuid('form_encounter'), 'date' => $date, 'reason' => Val::str($e, 'reason'),
            'facility' => $this->facilityName, 'facility_id' => $this->facilityId, 'pid' => $pid, 'encounter' => $encounter,
            'onset_date' => $date, 'sensitivity' => 'normal', 'billing_note' => '',
            'pc_catid' => $this->category(Val::str($e, 'category'))['id'], 'last_level_billed' => 0, 'last_level_closed' => 0,
            'stmt_count' => 0, 'provider_id' => $provider['id'], 'supervisor_id' => 0, 'invoice_refno' => '',
            'referral_source' => '', 'billing_facility' => $this->facilityId, 'pos_code' => 11, 'class_code' => 'AMB',
            'date_end' => null,
        ]);
        $this->linkForm($pid, $encounter, $date, 'New Patient Encounter', $feId, 'newpatient', $provider);

        foreach (Val::map($e, 'forms') as $formdir => $payload) {
            $this->seedForm($pid, $encounter, $date, $formdir, $payload, $provider);
        }
        $this->seedFees($pid, $encounter, $date, Val::list($e, 'fees'), $provider);
        $copay = Val::map($e, 'copay');
        if ($copay !== []) {
            $this->insert('payments', [
                'pid' => $pid, 'dtime' => $date, 'encounter' => $encounter, 'user' => $this->frontDesk()['username'],
                'method' => Val::str($copay, 'method'), 'source' => 'SYNTHETIC', 'amount1' => Val::str($copay, 'amount'),
                'amount2' => '0.00', 'posted1' => '0.00', 'posted2' => '0.00',
            ]);
        }
        $this->seedPayments($pid, $encounter, $when, Val::list($e, 'payments'));
        $order = Val::map($e, 'lab_order');
        if ($order !== []) {
            $this->seedLabOrder($pid, $encounter, $when, $order, $provider);
        }
        return $encounter;
    }

    /** @param array{id: int, username: string} $provider */
    private function linkForm(int $pid, int $encounter, string $date, string $name, int $formId, string $formdir, array $provider): void
    {
        $this->insert('forms', [
            'date' => $date, 'encounter' => $encounter, 'form_name' => $name, 'form_id' => $formId, 'pid' => $pid,
            'user' => $provider['username'], 'groupname' => 'Default', 'authorized' => 1, 'deleted' => 0,
            'formdir' => $formdir, 'therapy_group_id' => null, 'issue_id' => 0, 'provider_id' => $provider['id'],
        ]);
    }

    /** @param array{id: int, username: string} $provider */
    private function seedForm(int $pid, int $encounter, string $date, string $formdir, mixed $payload, array $provider): void
    {
        [$table, $formName, $grouping, $style] = FormCatalog::get($formdir);
        if (!is_array($payload)) {
            throw new InvalidFixtureException('Form payload must be an object or list.');
        }
        /** @var list<array<string, mixed>> $rows */
        $rows = array_is_list($payload) ? $payload : [$payload];
        $groupId = match ($grouping) {
            'form_id' => $this->db->maxValue($table, 'form_id') + 1, // ClinicalNotesService convention
            'id' => $this->db->maxValue($table, 'id') + 1,
            default => 0,
        };
        $linkId = $groupId;
        foreach ($rows as $fields) {
            $row = match ($style) {
                'ros' => ['pid' => $pid, 'activity' => 1, 'date' => $date],
                'instr' => ['pid' => $pid, 'encounter' => (string) $encounter, 'user' => $provider['username'], 'activity' => 1],
                default => ['date' => substr($date, 0, $style === 'notes' ? 10 : 19), 'pid' => $pid, 'user' => $provider['username'],
                    'groupname' => 'Default', 'authorized' => 1, 'activity' => 1],
            };
            if ($style === 'notes') {
                $row['encounter'] = (string) $encounter;
            } elseif ($style === 'std+enc') {
                $row['encounter'] = $encounter;
            }
            if ($grouping === 'form_id') {
                $row['form_id'] = $groupId;
            } elseif ($grouping === 'id') {
                $row['id'] = $groupId;
            }
            if (in_array($table, FormCatalog::UUID_TABLES, true)) {
                $row['uuid'] = $this->db->newUuid($table);
            }
            foreach (Val::columns($fields) as $column => $value) {
                $this->assertColumn($column);
                $row[$column] = $value;
            }
            $id = $this->insert($table, $row);
            if ($grouping === 'single') {
                $linkId = $id;
            }
        }
        $this->linkForm($pid, $encounter, $date, $formName, $linkId, $formdir, $provider);
    }

    /**
     * @param list<array<string, mixed>> $fees
     * @param array{id: int, username: string} $provider
     */
    private function seedFees(int $pid, int $encounter, string $date, array $fees, array $provider): void
    {
        foreach ($fees as $fee) {
            $this->insert('billing', [
                'date' => $date, 'code_type' => Val::str($fee, 'code_type'), 'code' => Val::str($fee, 'code'), 'pid' => $pid,
                'provider_id' => $provider['id'], 'user' => $provider['id'], 'groupname' => 'Default', 'authorized' => 1,
                'encounter' => $encounter, 'code_text' => Val::str($fee, 'text'), 'billed' => 0, 'activity' => 1,
                'payer_id' => null, 'bill_process' => 0, 'modifier' => '', 'units' => 1, 'fee' => Val::str($fee, 'fee'),
                'justify' => Val::str($fee, 'justify', ''), 'target' => '', 'x12_partner_id' => 0, 'ndc_info' => '',
                'notecodes' => '', 'pricelevel' => 'standard', 'revenue_code' => '',
            ]);
        }
    }

    /** @param list<array<string, mixed>> $payments */
    private function seedPayments(int $pid, int $encounter, DateTimeImmutable $when, array $payments): void
    {
        $sequence = 0;
        $poster = $this->frontDesk();
        foreach ($payments as $pay) {
            $isInsurance = Val::str($pay, 'payer') === 'insurance';
            $amount = Val::str($pay, 'amount');
            $postDate = $when->modify($isInsurance ? '+1 day' : '+0 day')->format('Y-m-d');
            $session = $this->insert('ar_session', [
                'payer_id' => $isInsurance ? $this->insurers[Val::str($pay, 'insurer')] : 0, 'user_id' => $poster['id'],
                'closed' => 0, 'reference' => Val::str($pay, 'reference', 'SYNTHETIC'), 'check_date' => $postDate,
                'deposit_date' => $postDate, 'pay_total' => $amount, 'modified_time' => $this->now, 'global_amount' => '0.00',
                'payment_type' => $isInsurance ? 'insurance' : 'patient',
                'description' => 'SYNTHETIC DEMO payment ' . $this->fixture->marker('pay'),
                'adjustment_code' => $isInsurance ? 'insurance_payment' : 'patient_payment', 'post_to_date' => $postDate,
                'patient_id' => $isInsurance ? 0 : $pid, 'payment_method' => Val::str($pay, 'method'),
            ]);
            $activity = [
                'pid' => $pid, 'encounter' => $encounter, 'code_type' => 'CPT4', 'code' => Val::str($pay, 'code'),
                'modifier' => '', 'payer_type' => $isInsurance ? 1 : 0, 'post_time' => $this->now, 'post_user' => $poster['id'],
                'session_id' => $session, 'memo' => '', 'pay_amount' => $amount, 'adj_amount' => '0.00',
                'modified_time' => $this->now, 'follow_up' => '', 'follow_up_note' => '',
                'account_code' => $isInsurance ? 'IPP' : 'PP', 'reason_code' => null, 'deleted' => null, 'post_date' => $postDate,
                'payer_claim_number' => null,
            ];
            $this->insert('ar_activity', ['sequence_no' => ++$sequence] + $activity);
            $adjustment = Val::str($pay, 'adjustment', '');
            if ($adjustment !== '') {
                $this->insert('ar_activity', ['sequence_no' => ++$sequence, 'memo' => 'Synthetic contractual adjustment',
                    'pay_amount' => '0.00', 'adj_amount' => $adjustment, 'account_code' => ''] + $activity);
            }
        }
    }

    /**
     * @param array<string, mixed> $order
     * @param array{id: int, username: string} $provider
     */
    private function seedLabOrder(int $pid, int $encounter, DateTimeImmutable $when, array $order, array $provider): void
    {
        $date = $when->format('Y-m-d H:i:s');
        $orderId = $this->insert('procedure_order', [
            'uuid' => $this->db->newUuid('procedure_order'), 'provider_id' => $provider['id'], 'patient_id' => $pid,
            'encounter_id' => $encounter, 'date_collected' => $date, 'date_ordered' => $date, 'order_priority' => 'normal',
            'order_status' => 'complete', 'patient_instructions' => 'SYNTHETIC DEMO ORDER - not transmitted.',
            'activity' => 1, 'control_id' => '', 'lab_id' => $this->labId, 'specimen_type' => '', 'specimen_location' => '',
            'specimen_volume' => '', 'clinical_hx' => '', 'external_id' => '', 'history_order' => '0',
            'order_diagnosis' => Val::str($order, 'diagnosis'), 'billing_type' => '', 'specimen_fasting' => '',
            'order_psc' => 0, 'order_abn' => 'not_required', 'collector_id' => 0, 'account' => '', 'account_facility' => 0,
            'provider_number' => '', 'procedure_order_type' => 'laboratory_test', 'order_intent' => 'order',
        ]);
        $this->linkForm($pid, $encounter, $date, 'Procedure Order', $orderId, 'procedure_order', $provider);
        $results = [];
        foreach (Val::list($order, 'results') as $r) {
            $results[Val::str($r, 'code')] = $r;
        }
        $reportDate = $when->modify('+4 hours')->format('Y-m-d H:i:s');
        foreach (Val::list($order, 'lab_tests') as $i => $t) {
            $code = Val::str($t, 'value');
            $test = $this->tests[$code];
            $seq = $i + 1;
            $this->insert('procedure_order_code', [
                'procedure_order_id' => $orderId, 'procedure_order_seq' => $seq, 'procedure_code' => $code,
                'procedure_name' => Val::str($test, 'name'), 'procedure_source' => '1',
                'diagnoses' => Val::str($order, 'diagnosis'), 'do_not_send' => 0, 'procedure_order_title' => 'Laboratory',
                'procedure_type' => 'laboratory_test', 'transport' => null,
            ]);
            if (!isset($results[$code])) {
                continue;
            }
            $reportId = $this->insert('procedure_report', [
                'uuid' => $this->db->newUuid('procedure_report'), 'procedure_order_id' => $orderId,
                'procedure_order_seq' => $seq, 'date_collected' => $date, 'date_collected_tz' => '',
                'date_report' => $reportDate, 'date_report_tz' => '', 'source' => $provider['id'], 'specimen_num' => '',
                'report_status' => 'final', 'review_status' => 'reviewed',
                'report_notes' => 'SYNTHETIC DEMO RESULT ' . $this->fixture->marker('lab'),
            ]);
            $this->insert('procedure_result', [
                'uuid' => $this->db->newUuid('procedure_result'), 'procedure_report_id' => $reportId,
                'result_data_type' => 'N', 'result_code' => self::bareLoinc(Val::str($test, 'standard_code')),
                'result_text' => Val::str($test, 'name'), 'date' => $reportDate, 'facility' => '',
                'units' => Val::str($test, 'units'), 'result' => Val::str($results[$code], 'value'),
                'range' => Val::str($test, 'range'), 'abnormal' => Val::str($results[$code], 'abnormal'),
                'comments' => 'Synthetic value', 'document_id' => 0, 'result_status' => 'final',
            ]);
        }
    }

    /**
     * @param array<string, mixed> $issue
     * @param array{id: int, username: string} $provider
     * @param array<string, int> $encounters
     */
    private function seedIssue(int $pid, array $issue, array $provider, array $encounters): void
    {
        $begin = $this->calendar->day(Val::int($issue, 'day'))->format('Y-m-d H:i:s');
        $listId = $this->insert('lists', [
            'uuid' => $this->db->newUuid('lists'), 'date' => $this->now, 'type' => Val::str($issue, 'type'), 'subtype' => '',
            'title' => Val::str($issue, 'title'), 'begdate' => $begin, 'enddate' => null, 'returndate' => null,
            'occurrence' => 0, 'classification' => 0, 'referredby' => '', 'extrainfo' => '',
            'diagnosis' => Val::str($issue, 'diagnosis', ''), 'activity' => 1,
            'comments' => 'SYNTHETIC DEMO ' . $this->fixture->marker('issue'), 'pid' => $pid,
            'user' => $provider['username'], 'groupname' => 'Default', 'outcome' => 0, 'destination' => '',
            'reaction' => Val::str($issue, 'reaction', ''), 'verification' => 'confirmed',
            'severity_al' => Val::str($issue, 'severity_al', ''),
        ]);
        if (isset($issue['encounter'])) {
            $this->insert('issue_encounter', [
                'uuid' => $this->db->newUuid('issue_encounter'), 'pid' => $pid, 'list_id' => $listId,
                'encounter' => $encounters[Val::str($issue, 'encounter')], 'resolved' => 0, 'created_by' => $provider['id'],
                'updated_by' => $provider['id'], 'created_at' => $this->now, 'updated_at' => $this->now,
            ]);
        }
    }

    /**
     * @param array<string, mixed> $rx
     * @param array{id: int, username: string} $provider
     * @param array<string, int> $encounters
     */
    private function seedPrescription(int $pid, array $rx, array $provider, array $encounters): void
    {
        $day = $this->calendar->day(Val::int($rx, 'day'))->format('Y-m-d');
        $this->insert('prescriptions', [
            'uuid' => $this->db->newUuid('prescriptions'), 'patient_id' => $pid, 'filled_by_id' => null, 'pharmacy_id' => null,
            'date_added' => $this->now, 'date_modified' => $this->now, 'provider_id' => $provider['id'],
            'encounter' => isset($rx['encounter']) ? $encounters[Val::str($rx, 'encounter')] : null,
            'start_date' => $day, 'drug' => Val::str($rx, 'drug'), 'drug_id' => 0, 'rxnorm_drugcode' => Val::str($rx, 'rxnorm'),
            'form' => 0, 'dosage' => Val::str($rx, 'dosage'), 'quantity' => Val::str($rx, 'quantity'), 'size' => '',
            'unit' => 0, 'route' => Val::str($rx, 'route'), 'interval' => 0, 'substitute' => 0,
            'refills' => Val::int($rx, 'refills'), 'per_refill' => 0, 'filled_date' => null, 'medication' => 0,
            'note' => Val::str($rx, 'note'), 'active' => 1, 'datetime' => $this->now, 'user' => $provider['username'],
            'site' => 'default', 'prescriptionguid' => '', 'erx_source' => 0, 'erx_uploaded' => 0, 'drug_info_erx' => null,
            'txDate' => $day, 'usage_category' => 'community', 'usage_category_title' => 'Home/Community',
            'request_intent' => 'order', 'request_intent_title' => 'Order', 'created_by' => $provider['id'],
            'updated_by' => $provider['id'],
        ]);
    }

    /**
     * @param array<string, mixed> $imm
     * @param array{id: int, username: string} $provider
     */
    private function seedImmunization(int $pid, array $imm, array $provider): void
    {
        $when = $this->calendar->at(Val::int($imm, 'day'), '10:00')->format('Y-m-d H:i:s');
        $this->insert('immunizations', [
            'uuid' => $this->db->newUuid('immunizations'), 'patient_id' => $pid, 'administered_date' => $when,
            'immunization_id' => 0, 'cvx_code' => Val::str($imm, 'cvx'), 'manufacturer' => Val::str($imm, 'manufacturer'),
            'lot_number' => Val::str($imm, 'lot'), 'administered_by_id' => $provider['id'], 'administered_by' => '',
            'education_date' => substr($when, 0, 10), 'vis_date' => substr($when, 0, 10),
            'note' => Val::str($imm, 'note') . ' ' . $this->fixture->marker('imm'), 'create_date' => $this->now,
            'update_date' => $this->now, 'created_by' => $provider['id'], 'updated_by' => $provider['id'],
            'amount_administered' => 0.5, 'amount_administered_unit' => 'ml', 'expiration_date' => null,
            'route' => 'intramuscular', 'administration_site' => '', 'added_erroneously' => 0,
            'completion_status' => 'Completed', 'information_source' => 'new_immunization_record',
            'ordering_provider' => $provider['id'], 'encounter_id' => null,
        ]);
    }

    /** @param array<string, mixed> $doc */
    private function seedDocument(int $pid, array $doc, int $encounter): void
    {
        $category = $this->db->findOne('categories', ['name' => Val::str($doc, 'category')]);
        if ($category === null) {
            throw new InvalidFixtureException('Document category does not exist in this deployment.');
        }
        $this->db->storeDocument(
            $pid,
            (int) $category['id'],
            Val::str($doc, 'name'),
            'text/plain',
            Val::str($doc, 'text') . "\n" . $this->fixture->marker('doc') . "\n",
            $encounter,
            $this->calendar->now()->format('Y-m-d'),
        );
        $this->report->count('documents');
    }

    /**
     * @param array<string, mixed> $t
     * @param array{id: int, username: string} $provider
     */
    private function seedTransaction(int $pid, array $t, array $provider): void
    {
        $layout = Val::str($t, 'form_id');
        $fields = Val::columns(Val::map($t, 'fields'));
        foreach (array_keys($fields) as $fieldId) {
            if ($this->db->findOne('layout_options', ['form_id' => $layout, 'field_id' => $fieldId]) === null) {
                throw new InvalidFixtureException('Transaction field is not defined in this deployment\'s layout.');
            }
        }
        $id = $this->insert('transactions', [
            'date' => $this->calendar->at(Val::int($t, 'day'), '12:00')->format('Y-m-d H:i:s'), 'title' => $layout,
            'pid' => $pid, 'user' => $provider['username'], 'groupname' => 'Default', 'authorized' => 1,
        ]);
        foreach ($fields as $fieldId => $value) {
            if (str_starts_with($value, '@day:')) {
                $value = $this->calendar->day((int) substr($value, 5))->format('Y-m-d');
            } elseif (str_starts_with($value, '@user:')) {
                $value = (string) $this->user(substr($value, 6))['id'];
            }
            $this->insert('lbt_data', ['form_id' => $id, 'field_id' => $fieldId, 'field_value' => $value]);
        }
    }
}
