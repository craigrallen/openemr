<?php

/**
 * Seeder behaviour against an in-memory gateway: linkage, idempotency,
 * rollback, non-destruction and absence of credentials/outbound effects.
 *
 * Real-schema validation runs against MariaDB (see docs/clinical-ui/DEMO-DATA.md).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Demo\Seed;

use DateTimeImmutable;
use OpenEMR\Demo\Seed\DemoCalendar;
use OpenEMR\Demo\Seed\DemoSeeder;
use OpenEMR\Demo\Seed\FixtureLoader;
use OpenEMR\Demo\Seed\SeedConflictException;
use OpenEMR\Demo\Seed\SeedVerifier;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Clock\ClockInterface;
use RuntimeException;

final class DemoSeederTest extends TestCase
{
    private InMemorySeedGateway $db;
    private DemoSeeder $seeder;

    protected function setUp(): void
    {
        $this->db = new InMemorySeedGateway();
        $this->seeder = new DemoSeeder($this->db, new DemoCalendar(self::clock('2026-10-02 10:00:00')));
    }

    private static function clock(string $now): ClockInterface
    {
        return new class (new DateTimeImmutable($now)) implements ClockInterface {
            public function __construct(private readonly DateTimeImmutable $now)
            {
            }

            public function now(): DateTimeImmutable
            {
                return $this->now;
            }
        };
    }

    private static function fixture(): \OpenEMR\Demo\Seed\Fixture
    {
        return FixtureLoader::fromFile(FixtureLoader::defaultPath());
    }

    public function testSeedCreatesLinkedRecordsThatVerify(): void
    {
        $report = $this->seeder->seed(self::fixture());

        self::assertGreaterThan(0, $report->inserted('patient_data'));
        self::assertGreaterThan(0, $report->inserted('form_encounter'));
        $verify = (new SeedVerifier($this->db))->verify(self::fixture());
        self::assertSame([], $verify->failures, implode("\n", $verify->failures));

        // Every forms row links an existing encounter and an existing form row.
        foreach ($this->db->rows('forms') as $form) {
            self::assertNotNull($this->db->findOne('form_encounter', ['encounter' => $form['encounter'], 'pid' => $form['pid']]));
        }
        // Billing and payments link to real encounters of the same patient.
        foreach ($this->db->rows('ar_activity') as $act) {
            self::assertNotNull($this->db->findOne('form_encounter', ['encounter' => $act['encounter'], 'pid' => $act['pid']]));
            self::assertNotNull($this->db->findOne('ar_session', ['session_id' => $act['session_id']]));
        }
        // Lab chain: result -> report -> order -> encounter.
        foreach ($this->db->rows('procedure_result') as $res) {
            $rep = $this->db->findOne('procedure_report', ['procedure_report_id' => $res['procedure_report_id']]);
            self::assertNotNull($rep);
            $ord = $this->db->findOne('procedure_order', ['procedure_order_id' => $rep['procedure_order_id']]);
            self::assertNotNull($ord);
            self::assertNotNull($this->db->findOne('form_encounter', ['encounter' => $ord['encounter_id']]));
        }
        // Each document has a category link.
        foreach ($this->db->rows('documents') as $doc) {
            self::assertNotNull($this->db->findOne('categories_to_documents', ['document_id' => $doc['id']]));
        }
    }

    public function testAppointmentsCoverRequiredStatusesAndRecurringBlocksNearCurrentWeek(): void
    {
        $this->seeder->seed(self::fixture());
        $statuses = array_column($this->db->rows('openemr_postcalendar_events'), 'pc_apptstatus');
        foreach (['>', 'x', '?', '@', '-', '%'] as $required) {
            self::assertContains($required, $statuses, "missing appointment status {$required}");
        }
        $recurring = array_filter($this->db->rows('openemr_postcalendar_events'), fn(array $e): bool => $e['pc_recurrtype'] !== 0);
        self::assertNotEmpty($recurring);
        foreach ($this->db->rows('openemr_postcalendar_events') as $event) {
            $date = new DateTimeImmutable((string) $event['pc_eventDate']);
            self::assertGreaterThanOrEqual(new DateTimeImmutable('2026-09-14'), $date);
            self::assertLessThanOrEqual(new DateTimeImmutable('2026-10-18'), $date);
        }
    }

    /**
     * Deleting any seeded table (or its non-encounter subset) must make verification fail.
     *
     * @param array<string, string> $criteria
     */
    #[DataProvider('deletionProvider')]
    public function testVerifierFailsWhenSeededRecordsAreRemoved(string $table, array $criteria): void
    {
        $this->seeder->seed(self::fixture());
        $this->db->deleteWhere($table, $criteria);
        $verify = (new SeedVerifier($this->db))->verify(self::fixture());
        self::assertNotSame([], $verify->failures, "verifier passed with {$table} removed");
    }

    /**
     * @return array<string, array{string, array<string, string>}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function deletionProvider(): array
    {
        $cases = [];
        foreach (['form_vitals', 'form_soap', 'form_ros', 'form_reviewofs', 'form_dictation', 'form_misc_billing_options',
            'form_clinical_instructions', 'form_clinical_notes', 'form_observation', 'form_care_plan',
            'form_functional_cognitive_status', 'billing', 'payments', 'ar_activity', 'ar_session', 'procedure_order',
            'procedure_order_code', 'procedure_report', 'procedure_result', 'documents', 'categories_to_documents',
            'lbt_data', 'lists', 'prescriptions', 'immunizations', 'pnotes', 'transactions', 'insurance_data',
            'history_data', 'openemr_postcalendar_events', 'procedure_type', 'onotes', 'issue_encounter'] as $table) {
            $cases[$table] = [$table, []];
        }
        $cases['non-encounter forms rows'] = ['forms', ['formdir' => 'vitals']];
        $cases['procedure_order forms rows'] = ['forms', ['formdir' => 'procedure_order']];
        return $cases;
    }

    public function testLabResultCodeIsBareLoinc(): void
    {
        $this->seeder->seed(self::fixture());
        $codes = array_map(static fn(array $r): string => (string) $r['result_code'], $this->db->rows('procedure_result'));
        self::assertNotSame([], $codes);
        foreach ($codes as $code) {
            self::assertMatchesRegularExpression('/^\d{1,7}-\d$/', $code);
        }
    }

    public function testPartiallySeededPatientIsRefusedWithoutMutation(): void
    {
        $this->seeder->seed(self::fixture());
        $this->db->deleteWhere('procedure_result');
        $before = $this->db->tableCounts();
        try {
            $this->seeder->seed(self::fixture());
            self::fail('incomplete synthetic patient must be refused');
        } catch (SeedConflictException $e) {
            self::assertStringContainsString('incomplete', $e->getMessage());
        }
        self::assertSame($before, $this->db->tableCounts());
    }

    public function testPatientMissingIssueEncounterLinksIsRefusedWithoutMutation(): void
    {
        $this->seeder->seed(self::fixture());
        self::assertNotSame([], $this->db->rows('issue_encounter'));
        $this->db->deleteWhere('issue_encounter');
        $before = $this->db->tableCounts();
        try {
            $this->seeder->seed(self::fixture());
            self::fail('synthetic patient missing issue_encounter links must be refused');
        } catch (SeedConflictException $e) {
            self::assertStringContainsString('incomplete', $e->getMessage());
        }
        self::assertSame($before, $this->db->tableCounts());
    }

    public function testVerifierRequiresEachIssueEncounterLinkToTheFixtureEncounter(): void
    {
        $this->seeder->seed(self::fixture());
        $links = $this->db->rows('issue_encounter');
        self::assertNotSame([], $links);
        // Re-point one link at a different (valid) encounter number: count still matches, link does not.
        $this->db->updateWhere('issue_encounter', ['id' => $links[0]['id']], ['encounter' => 999999]);
        $verify = (new SeedVerifier($this->db))->verify(self::fixture());
        self::assertNotSame([], $verify->failures);
    }

    public function testPatientFromDifferentFixtureVersionIsRefusedWithoutMutation(): void
    {
        $this->seeder->seed(self::fixture());
        $this->db->updateWhere('patient_data', ['pubpid' => 'SYNTH-DEMO-0002'], ['genericval1' => 'synthetic-demo-v0']);
        $before = $this->db->tableCounts();
        try {
            $this->seeder->seed(self::fixture());
            self::fail('different fixture version must be refused');
        } catch (SeedConflictException $e) {
            self::assertStringContainsString('different fixture version', $e->getMessage());
        }
        self::assertSame($before, $this->db->tableCounts());
        self::assertSame('synthetic-demo-v0', $this->db->findOne('patient_data', ['pubpid' => 'SYNTH-DEMO-0002'])['genericval1'] ?? null);
    }

    public function testRerunIsIdempotent(): void
    {
        $this->seeder->seed(self::fixture());
        $before = $this->db->tableCounts();
        $second = $this->seeder->seed(self::fixture());
        self::assertSame($before, $this->db->tableCounts());
        self::assertSame(0, $second->totalInserted());
        self::assertGreaterThan(0, $second->skipped);
    }

    public function testPreexistingHumanRecordWithSameKeyIsNeverTouchedAndAbortsSeeding(): void
    {
        $this->db->insert('patient_data', ['pid' => 7, 'pubpid' => 'SYNTH-DEMO-0001', 'fname' => 'Real', 'lname' => 'Person', 'genericname1' => '', 'genericval1' => '']);
        $before = $this->db->tableCounts();
        try {
            $this->seeder->seed(self::fixture());
            self::fail('conflict expected');
        } catch (SeedConflictException) {
            self::assertSame($before, $this->db->tableCounts());
            self::assertSame('Real', $this->db->findOne('patient_data', ['pid' => 7])['fname'] ?? null);
        }
    }

    public function testFailureMidRunRollsBackEverything(): void
    {
        $this->db->failOnInsertNumber = 40;
        try {
            $this->seeder->seed(self::fixture());
            self::fail('injected failure expected');
        } catch (RuntimeException) {
            self::assertSame([], array_filter($this->db->tableCounts()));
            self::assertSame(0, $this->db->openTransactions);
        }
    }

    public function testDryRunWritesNothing(): void
    {
        $plan = $this->seeder->plan(self::fixture());
        self::assertGreaterThan(0, $plan->totalInserted());
        self::assertSame([], array_filter($this->db->tableCounts()));
    }

    public function testNoCredentialsOrOutboundChannelsAreCreated(): void
    {
        $this->seeder->seed(self::fixture());
        self::assertSame([], $this->db->rows('users_secure'));
        foreach ($this->db->rows('users') as $user) {
            self::assertSame('', $user['password'] ?? '');
            self::assertMatchesRegularExpression('/(^$|\.invalid$)/', (string) ($user['email'] ?? ''));
        }
        foreach ($this->db->rows('patient_data') as $patient) {
            self::assertMatchesRegularExpression('/\.invalid$/', (string) $patient['email']);
            self::assertSame('NO', $patient['hipaa_allowsms']);
            self::assertSame('NO', $patient['hipaa_allowemail']);
            self::assertSame('', $patient['ss']);
            self::assertStringStartsWith('SYNTH', (string) $patient['pubpid']);
            foreach (['phone_home', 'phone_cell', 'phone_biz', 'phone_contact'] as $phone) {
                self::assertMatchesRegularExpression('/^(|000-000-0000)$/', (string) $patient[$phone]);
            }
        }
        foreach ($this->db->rows('prescriptions') as $rx) {
            self::assertSame(0, $rx['erx_uploaded']);
            self::assertSame('', (string) ($rx['prescriptionguid'] ?? ''));
        }
        foreach ($this->db->rows('openemr_postcalendar_events') as $event) {
            self::assertSame('NO', $event['pc_sendalertsms']);
            self::assertSame('NO', $event['pc_sendalertemail']);
        }
        foreach ($this->db->rows('procedure_providers') as $lab) {
            self::assertSame('', $lab['remote_host']);
            self::assertSame('', $lab['login']);
            self::assertSame('', $lab['password']);
        }
    }
}
