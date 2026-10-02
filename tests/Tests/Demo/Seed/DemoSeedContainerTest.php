<?php

/**
 * End-to-end test of contrib/util/demo-seed/demo-seed.php against a real,
 * DISPOSABLE OpenEMR database. Runs the CLI as a subprocess (real gate, real
 * bootstrap, real OpenEmrSeedGateway) and reads results back over mysqli.
 *
 * Refuses to run unless DEMO_SEED_CONTAINER_TEST=disposable-local and the
 * database starts with no synthetic patients. It writes to that database.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Demo\Seed;

use mysqli;
use PHPUnit\Framework\Attributes\Depends;
use PHPUnit\Framework\TestCase;

final class DemoSeedContainerTest extends TestCase
{
    private const SEED_KEY = 'SYNTHETIC-DEMO-SEED demo-v1';
    /** Tables the seeder writes, plus core side tables it drives. */
    private const TABLES = [
        'ar_activity', 'ar_session', 'billing', 'categories_to_documents', 'documents', 'facility', 'form_care_plan',
        'form_clinical_instructions', 'form_clinical_notes', 'form_dictation', 'form_encounter',
        'form_functional_cognitive_status', 'form_misc_billing_options', 'form_observation', 'form_reviewofs',
        'form_ros', 'form_soap', 'form_vitals', 'forms', 'history_data', 'immunizations', 'insurance_companies',
        'insurance_data', 'issue_encounter', 'lbt_data', 'lists', 'onotes', 'openemr_postcalendar_events',
        'patient_data', 'payments', 'pnotes', 'prescriptions', 'procedure_order', 'procedure_order_code',
        'procedure_providers', 'procedure_report', 'procedure_result', 'procedure_type', 'transactions',
        'users', 'uuid_registry',
    ];

    private static ?mysqli $db = null;

    private static function root(): string
    {
        return dirname(__DIR__, 4);
    }

    public static function setUpBeforeClass(): void
    {
        if (getenv('DEMO_SEED_CONTAINER_TEST') !== 'disposable-local') {
            self::markTestSkipped('Set DEMO_SEED_CONTAINER_TEST=disposable-local to run against a disposable database.');
        }
        $host = $port = $login = $pass = $dbase = '';
        require self::root() . '/sites/default/sqlconf.php';
        self::$db = new mysqli($host, $login, $pass, $dbase, (int) $port);
    }

    private static function db(): mysqli
    {
        return self::$db ?? throw new \LogicException('No database connection.');
    }

    private static function scalar(string $sql): string
    {
        $row = self::db()->query($sql)->fetch_row();
        return (string) ($row[0] ?? '');
    }

    /** @return array<string, int> */
    private static function counts(): array
    {
        $c = [];
        foreach (self::TABLES as $t) {
            $c[$t] = (int) self::scalar("SELECT COUNT(*) FROM `{$t}`");
        }
        return $c;
    }

    /**
     * @param array<string, string> $env
     * @return array{int, string, string}
     */
    private static function cli(string $mode, array $env = [], bool $confirm = false): array
    {
        $cmd = ['php', self::root() . '/contrib/util/demo-seed/demo-seed.php', $mode, '--site=default'];
        if ($confirm) {
            $cmd[] = '--confirm-synthetic-seed=default';
        }
        $base = ['PATH' => (string) getenv('PATH'), 'HOME' => (string) getenv('HOME')];
        $proc = proc_open($cmd, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, self::root(), $base + $env);
        self::assertIsResource($proc);
        $out = (string) stream_get_contents($pipes[1]);
        $err = (string) stream_get_contents($pipes[2]);
        return [proc_close($proc), $out, $err];
    }

    /** @return array<string, string> */
    private static function allowEnv(): array
    {
        return ['OPENEMR_DEMO_SEED_ALLOWED' => 'synthetic-test-only', 'OPENEMR_DEMO_SEED_TARGET' => 'local-dev'];
    }

    /** @return array<string, int> baseline counts */
    public function testPreconditionDatabaseHasNoSyntheticDataAndVerifyFails(): array
    {
        self::assertSame('0', self::scalar("SELECT COUNT(*) FROM patient_data WHERE genericname1 = 'synthetic_demo_seed'"), 'Restore the disposable baseline first.');
        [$code, , ] = self::cli('verify');
        self::assertSame(1, $code, 'verify must fail (RED) before seeding');
        return self::counts();
    }

    /** @param array<string, int> $baseline */
    #[Depends('testPreconditionDatabaseHasNoSyntheticDataAndVerifyFails')]
    public function testSeedWithoutGateIsRefusedAndWritesNothing(array $baseline): array
    {
        [$code, , $err] = self::cli('seed', [], true);
        self::assertSame(2, $code);
        self::assertStringContainsString('Refusing to write', $err);
        [$code] = self::cli('seed', self::allowEnv(), false);
        self::assertSame(2, $code, 'missing --confirm-synthetic-seed must refuse');
        [$code] = self::cli('seed', self::allowEnv() + ['APP_ENV' => 'production'], true);
        self::assertSame(2, $code, 'production marker must refuse');
        self::assertSame($baseline, self::counts());
        return $baseline;
    }

    /** @param array<string, int> $baseline */
    #[Depends('testSeedWithoutGateIsRefusedAndWritesNothing')]
    public function testConflictMidRunRollsBackEveryInsert(array $baseline): array
    {
        // An unmarked patient holding the LAST fixture pubpid: facility, users, lab,
        // calendar and earlier patients are inserted before the conflict is hit.
        $fixture = json_decode((string) file_get_contents(self::root() . '/contrib/util/demo-seed/fixtures/synthetic-demo-v1.json'), true);
        self::assertIsArray($fixture);
        $last = end($fixture['patients']);
        self::assertIsArray($last);
        $pubpid = self::db()->real_escape_string((string) $last['pubpid']);
        self::db()->query("INSERT INTO patient_data (pid, pubpid, fname, lname) VALUES (999999, '{$pubpid}', 'Unrelated', 'Existing')");
        $before = self::counts();
        $seqBefore = self::scalar('SELECT id FROM sequences');
        $docsDir = self::root() . '/sites/default/documents';
        // Empty directories are permitted after rollback; every file and its
        // contents must be unchanged, including documents present beforehand.
        $fileSnapshot = static function (string $directory): array {
            $files = [];
            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS));
            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $files[$file->getPathname()] = hash_file('sha256', $file->getPathname());
                }
            }
            ksort($files);
            return $files;
        };
        $filesBefore = $fileSnapshot($docsDir);
        [$code, , $err] = self::cli('seed', self::allowEnv(), true);
        self::assertSame($filesBefore, $fileSnapshot($docsDir), 'rollback must remove only its document files and preserve existing contents');
        $after = self::counts();
        $seqAfter = self::scalar('SELECT id FROM sequences');
        self::db()->query('DELETE FROM patient_data WHERE pid = 999999');
        self::assertSame(2, $code, $err);
        self::assertStringContainsString('reserved synthetic pubpid', $err);
        self::assertSame($before, $after, 'every insert, uuid_registry row and document row must roll back');
        self::assertSame($seqBefore, $seqAfter, 'sequences counter must roll back');
        self::assertSame($baseline, self::counts());
        return $baseline;
    }

    /** @param array<string, int> $baseline */
    #[Depends('testConflictMidRunRollsBackEveryInsert')]
    public function testDryRunWritesNothingAndSeedInsertsExactlyThePlan(array $baseline): array
    {
        [$code, $out] = self::cli('dry-run');
        self::assertSame(0, $code);
        $plan = json_decode($out, true);
        self::assertIsArray($plan);
        self::assertSame($baseline, self::counts(), 'dry-run must not write');

        [$code, $out, $err] = self::cli('seed', self::allowEnv(), true);
        self::assertSame(0, $code, $err . $out);
        $seeded = json_decode($out, true);
        self::assertIsArray($seeded);
        self::assertSame([], $seeded['verify_failures']);
        self::assertSame($plan['would_insert'], $seeded['inserted']);

        $after = self::counts();
        foreach ($plan['would_insert'] as $table => $n) {
            self::assertSame($baseline[$table] + $n, $after[$table], "row delta for {$table}");
        }
        return $after;
    }

    /** @param array<string, int> $seeded */
    #[Depends('testDryRunWritesNothingAndSeedInsertsExactlyThePlan')]
    public function testRerunIsIdempotentAndVerifyPasses(array $seeded): void
    {
        [$code, $out, $err] = self::cli('seed', self::allowEnv(), true);
        self::assertSame(0, $code, $err);
        $rerun = json_decode($out, true);
        self::assertIsArray($rerun);
        self::assertSame(0, $rerun['total']);
        self::assertGreaterThan(0, $rerun['skipped_existing']);
        self::assertSame($seeded, self::counts(), 'rerun must not duplicate anything');
        [$code, $out] = self::cli('verify');
        self::assertSame(0, $code, $out);
    }

    #[Depends('testRerunIsIdempotentAndVerifyPasses')]
    public function testUuidsAreUniqueAndRegistered(): void
    {
        $pids = "(SELECT pid FROM patient_data WHERE genericname1 = 'synthetic_demo_seed')";
        $seeded = [
            'patient_data' => "pid IN {$pids}", 'form_encounter' => "pid IN {$pids}", 'lists' => "pid IN {$pids}",
            'history_data' => "pid IN {$pids}", 'insurance_data' => "pid IN {$pids}", 'prescriptions' => "patient_id IN {$pids}",
            'immunizations' => "patient_id IN {$pids}", 'procedure_order' => "patient_id IN {$pids}",
            'openemr_postcalendar_events' => "pc_hometext LIKE '%" . self::SEED_KEY . "%'",
            'users' => "info LIKE '%" . self::SEED_KEY . "%'", 'facility' => "info LIKE '%" . self::SEED_KEY . "%'",
        ];
        foreach ($seeded as $t => $where) {
            self::assertNotSame('0', self::scalar("SELECT COUNT(*) FROM `{$t}` WHERE {$where}"), "{$t} has seeded rows");
            self::assertSame('0', self::scalar("SELECT COUNT(*) FROM `{$t}` WHERE {$where} AND (uuid IS NULL OR LENGTH(uuid) <> 16)"), "{$t} uuid present");
            self::assertSame('0', self::scalar("SELECT COUNT(*) - COUNT(DISTINCT uuid) FROM `{$t}` WHERE uuid IS NOT NULL"), "{$t} uuid unique");
            self::assertSame('0', self::scalar("SELECT COUNT(*) FROM `{$t}` x WHERE {$where} AND NOT EXISTS (SELECT 1 FROM uuid_registry r WHERE r.uuid = x.uuid AND r.table_name = '{$t}')"), "{$t} uuid registered");
        }
    }

    #[Depends('testRerunIsIdempotentAndVerifyPasses')]
    public function testSeededRowsAreLinkedAndOutboundSafe(): void
    {
        $pids = "(SELECT pid FROM patient_data WHERE genericname1 = 'synthetic_demo_seed')";
        self::assertSame('0', self::scalar("SELECT COUNT(*) FROM forms f WHERE f.pid IN {$pids} AND f.formdir = 'newpatient' AND NOT EXISTS (SELECT 1 FROM form_encounter e WHERE e.id = f.form_id AND e.pid = f.pid)"));
        self::assertSame('0', self::scalar("SELECT COUNT(*) FROM form_encounter e WHERE e.pid IN {$pids} AND NOT EXISTS (SELECT 1 FROM forms f WHERE f.formdir = 'newpatient' AND f.form_id = e.id)"));
        self::assertSame('0', self::scalar("SELECT COUNT(*) FROM ar_activity a WHERE a.pid IN {$pids} AND NOT EXISTS (SELECT 1 FROM ar_session s WHERE s.session_id = a.session_id)"));
        self::assertSame('0', self::scalar("SELECT COUNT(*) FROM patient_data WHERE pid IN {$pids} AND (phone_cell <> '' OR phone_home <> '' OR (email <> '' AND email NOT LIKE '%.invalid') OR allow_patient_portal <> 'NO' OR hipaa_allowsms <> 'NO' OR hipaa_allowemail <> 'NO')"));
        self::assertSame('4', self::scalar("SELECT COUNT(*) FROM users WHERE info LIKE '%SYNTHETIC-DEMO-SEED demo-v1%'"), 'non-vacuous: seeded staff found');
        self::assertSame('1', self::scalar("SELECT COUNT(*) FROM procedure_providers WHERE notes LIKE '%SYNTHETIC-DEMO-SEED demo-v1%'"), 'non-vacuous: seeded lab found');
        self::assertSame('6', self::scalar("SELECT COUNT(*) FROM patient_data WHERE pid IN {$pids}"), 'non-vacuous: seeded patients found');
        self::assertSame('0', self::scalar("SELECT COUNT(*) FROM users WHERE info LIKE '%SYNTHETIC-DEMO-SEED demo-v1%' AND (password <> '' OR id IN (SELECT id FROM users_secure))"), 'seeded staff must have no credentials');
        self::assertSame('0', self::scalar("SELECT COUNT(*) FROM prescriptions WHERE patient_id IN {$pids} AND (erx_source <> 0 OR erx_uploaded <> 0)"));
        self::assertSame('0', self::scalar("SELECT COUNT(*) FROM openemr_postcalendar_events WHERE pc_hometext LIKE '%SYNTHETIC-DEMO-SEED demo-v1%' AND (pc_sendalertsms <> 'NO' OR pc_sendalertemail <> 'NO')"));
        self::assertSame('0', self::scalar("SELECT COUNT(*) FROM procedure_providers WHERE notes LIKE '%SYNTHETIC-DEMO-SEED demo-v1%' AND (remote_host <> '' OR login <> '' OR password <> '')"));
    }

    #[Depends('testRerunIsIdempotentAndVerifyPasses')]
    public function testDocumentsAreStoredAndReadable(): void
    {
        $res = self::db()->query("SELECT d.id, d.url, d.storagemethod, d.foreign_id, c.category_id FROM documents d LEFT JOIN categories_to_documents c ON c.document_id = d.id WHERE d.foreign_id IN (SELECT pid FROM patient_data WHERE genericname1 = 'synthetic_demo_seed')");
        $n = 0;
        while ($row = $res->fetch_assoc()) {
            $n++;
            self::assertNotNull($row['category_id'], 'document category link');
            self::assertSame('0', (string) $row['storagemethod'], 'filesystem storage');
            $path = preg_replace('#^file://#', '', (string) $row['url']);
            self::assertIsString($path);
            self::assertFileExists($path);
        }
        self::assertSame(4, $n);
    }
}
