<?php

/**
 * Search contract for surgery issue/encounter associations. The small SQLite
 * tables below model the relevant columns of sql/database.sql; search SQL is
 * produced by the unchanged SurgeryService and executed, not simulated.
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Common\Uuid\UuidRegistry;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Services\Search\StringSearchField;
use OpenEMR\Services\SurgeryService;
use OpenEMR\Validators\ProcessingResult;
use PDO;
use PDOStatement;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class SurgeryEncounterLinkTest extends TestCase
{
    private const PATIENT_UUID = '11111111-1111-4111-8111-111111111111';
    private const OTHER_PATIENT_UUID = '22222222-2222-4222-8222-222222222222';
    private const RECORDER_UUID = '33333333-3333-4333-8333-333333333333';
    private const SURGERY_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    private const FIRST_ENCOUNTER_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
    private const SECOND_ENCOUNTER_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
    private const THIRD_ENCOUNTER_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';

    /** @var list<array{string, list<mixed>}> */
    private array $calls = [];

    private ?PDO $database = null;

    protected function setUp(): void
    {
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
        if (!class_exists(\ADORecordSet_mysqli::class)) {
            $source = (new ReflectionClass(\ADOConnection::class))->getFileName();
            if (!is_string($source)) {
                self::fail('Cannot locate installed ADOdb driver');
            }
            require_once dirname($source) . '/drivers/adodb-mysqli.inc.php';
        }
        require_once __DIR__ . '/../../../../library/ADODB_mysqli_log.php';
        require_once __DIR__ . '/../../../../library/sql.inc.php';

        $db = $this->getMockBuilder(\ADODB_mysqli_log::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['Execute', 'ExecuteNoLog'])
            ->getMock();
        $db->method('Execute')->willReturnCallback(
            fn(string $sql, array|false $binds, bool $log): \ADORecordSet_mysqli => $this->execute($sql, $binds)
        );
        $db->method('ExecuteNoLog')->willReturnCallback(
            fn(string $sql, array|false $binds): \ADORecordSet_mysqli => $this->execute($sql, $binds)
        );
        OEGlobalsBag::getInstance()->set('adodb', ['db' => $db]);
    }

    public function testClinicalEncounterNumberProducesCorrectUuidAndConvertedRecord(): void
    {
        $this->installRelationalFixture();
        $rows = $this->rows($this->surgery()->search(['surgeries.id' => new StringSearchField('surgeries.id', '101')]));

        self::assertCount(1, $rows);
        self::assertSame(900, $rows[0]['eid']);
        self::assertSame(self::FIRST_ENCOUNTER_UUID, $rows[0]['euuid']);
        self::assertSame(self::SURGERY_UUID, $rows[0]['uuid']);
        self::assertSame(self::PATIENT_UUID, $rows[0]['puuid']);
        self::assertSame(self::RECORDER_UUID, $rows[0]['recorder_uuid']);
        self::assertSame('NPI-7', $rows[0]['recorder_npi']);
        self::assertSame('2026-01-02', $rows[0]['begdate']);
        self::assertSame('2026-01-03', $rows[0]['enddate']);
        self::assertSame('2026-01-04 12:00:00', $rows[0]['date_modified']);
        self::assertSame('active', $rows[0]['status']);
        $this->assertOnlyBoundReads([['101%']]);
    }

    public function testForeignPatientEncountersCannotAttachThroughEitherCollidingKey(): void
    {
        $this->installRelationalFixture();
        $rows = $this->rows($this->surgery()->search(['surgeries.id' => new StringSearchField('surgeries.id', '106')]));

        self::assertCount(1, $rows);
        self::assertNull($rows[0]['eid']);
        self::assertNull($rows[0]['euuid']);
        $this->assertOnlyBoundReads([['106%']]);
    }

    public function testUnassociatedAndUnmatchedSurgeriesKeepNullEncounterUuid(): void
    {
        $this->installRelationalFixture();
        $rows = $this->rows($this->surgery()->search(['surgeries.id' => new StringSearchField('surgeries.id', ['103', '104'])]));

        self::assertCount(2, $rows);
        $ids = array_column($rows, 'id');
        sort($ids);
        self::assertSame([103, 104], $ids);
        foreach ($rows as $row) {
            self::assertNull($row['eid']);
            self::assertNull($row['euuid']);
            self::assertSame('inactive', $row['status']);
        }
        $this->assertOnlyBoundReads([['103%', '104%']]);
    }

    public function testSamePatientMultipleAssociationsReturnTheirOwnEncounterUuids(): void
    {
        $this->installRelationalFixture();
        $rows = $this->rows($this->surgery()->search(['surgeries.id' => new StringSearchField('surgeries.id', '102')]));

        self::assertCount(2, $rows);
        $links = [];
        foreach ($rows as $row) {
            self::assertIsInt($row['eid']);
            self::assertIsString($row['euuid']);
            $links[$row['eid']] = $row['euuid'];
        }
        ksort($links);
        self::assertSame([902 => self::SECOND_ENCOUNTER_UUID, 903 => self::THIRD_ENCOUNTER_UUID], $links);
        $this->assertOnlyBoundReads([['102%']]);
    }

    public function testSearchFieldsBindAndAndOrFiltersThroughNativeBuilder(): void
    {
        $this->installRelationalFixture();
        $search = [
            'surgeries.title' => new StringSearchField('surgeries.title', 'Append'),
            'patient.fname' => new StringSearchField('patient.fname', 'Ada'),
        ];

        $andRows = $this->rows($this->surgery()->search($search));
        $orRows = $this->rows($this->surgery()->search($search, false));

        self::assertSame([101], array_column($andRows, 'id'));
        $orIds = array_values(array_unique(array_column($orRows, 'id')));
        sort($orIds);
        self::assertSame([101, 102, 103, 104, 106], $orIds);
        $this->assertOnlyBoundReads([['Append%', 'Ada%'], ['Append%', 'Ada%']]);
        self::assertStringContainsString(' AND ', $this->calls[0][0]);
        self::assertStringContainsString(' OR ', $this->calls[1][0]);
    }

    public function testSearchUsesQueryUtilsWithBoundReadEvenWithoutSqlite(): void
    {
        // This check runs on hosts without pdo_sqlite. It records the SQL
        // boundary only; it makes no claim about relational results.
        try {
            $this->surgery()->search(['surgeries.id' => new StringSearchField('surgeries.id', '101')]);
            self::fail('Recorder-only boundary should stop before fetching rows');
        } catch (\LogicException $exception) {
            self::assertSame('Recorder-only boundary has no database', $exception->getMessage());
        }
        $this->assertOnlyBoundReads([['101%']]);
    }

    private function surgery(): SurgeryService
    {
        // Both constructors initialize database/UUID state. Search itself
        // needs none of those fields; bypass only construction, not search.
        $service = (new ReflectionClass(SurgeryService::class))->newInstanceWithoutConstructor();
        self::assertInstanceOf(SurgeryService::class, $service);
        return $service;
    }

    /** @return list<array<array-key, mixed>> */
    private function rows(ProcessingResult $result): array
    {
        self::assertTrue($result->isValid());
        $rows = $result->getData();
        $typedRows = [];
        foreach ($rows as $row) {
            self::assertIsArray($row);
            $typedRows[] = $row;
        }
        return $typedRows;
    }

    /** @param list<list<mixed>> $expectedBinds */
    private function assertOnlyBoundReads(array $expectedBinds): void
    {
        self::assertCount(count($expectedBinds), $this->calls);
        foreach ($this->calls as $index => [$sql, $binds]) {
            self::assertMatchesRegularExpression('/^\s*SELECT\b/i', $sql);
            self::assertSame($expectedBinds[$index], $binds);
            self::assertSame(count($binds), substr_count($sql, '?'));
        }
    }

    private function installRelationalFixture(): void
    {
        if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
            self::markTestSkipped('pdo_sqlite is unavailable; controller must verify relational behavior on MariaDB');
        }
        $db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $db->exec('CREATE TABLE lists (id INTEGER PRIMARY KEY, date TEXT, begdate TEXT, enddate TEXT, title TEXT, diagnosis TEXT, uuid BLOB, pid INTEGER, comments TEXT, user TEXT, modifydate TEXT, type TEXT)');
        $db->exec('CREATE TABLE patient_data (pid INTEGER PRIMARY KEY, fname TEXT, lname TEXT, uuid BLOB)');
        $db->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, npi TEXT, uuid BLOB)');
        $db->exec('CREATE TABLE issue_encounter (pid INTEGER, list_id INTEGER, encounter INTEGER)');
        $db->exec('CREATE TABLE form_encounter (id INTEGER PRIMARY KEY, pid INTEGER, encounter INTEGER, uuid BLOB)');

        $this->insert($db, 'patient_data', ['pid', 'fname', 'lname', 'uuid'], [7, 'Ada', 'Patient', UuidRegistry::uuidToBytes(self::PATIENT_UUID)]);
        $this->insert($db, 'patient_data', ['pid', 'fname', 'lname', 'uuid'], [8, 'Bea', 'Other', UuidRegistry::uuidToBytes(self::OTHER_PATIENT_UUID)]);
        $this->insert($db, 'users', ['id', 'username', 'npi', 'uuid'], [3, 'surgeon', 'NPI-7', UuidRegistry::uuidToBytes(self::RECORDER_UUID)]);

        $this->insert($db, 'form_encounter', ['id', 'pid', 'encounter', 'uuid'], [40, 7, 900, UuidRegistry::uuidToBytes(self::FIRST_ENCOUNTER_UUID)]);
        $this->insert($db, 'form_encounter', ['id', 'pid', 'encounter', 'uuid'], [41, 7, 902, UuidRegistry::uuidToBytes(self::SECOND_ENCOUNTER_UUID)]);
        $this->insert($db, 'form_encounter', ['id', 'pid', 'encounter', 'uuid'], [42, 7, 903, UuidRegistry::uuidToBytes(self::THIRD_ENCOUNTER_UUID)]);
        // Both id and clinical number collide with issue references, but
        // this encounter belongs to patient 8 and must never attach.
        $this->insert($db, 'form_encounter', ['id', 'pid', 'encounter', 'uuid'], [900, 8, 901, UuidRegistry::uuidToBytes('cccccccc-cccc-4ccc-8ccc-ccccccccccc1')]);
        $this->insert($db, 'form_encounter', ['id', 'pid', 'encounter', 'uuid'], [901, 8, 906, UuidRegistry::uuidToBytes('cccccccc-cccc-4ccc-8ccc-ccccccccccc2')]);

        foreach ([
            [101, 'Appendectomy', '2026-01-03', 'surgery'],
            [102, 'Biopsy', '2026-02-03', 'surgery'],
            [103, 'Repair', null, 'surgery'],
            [104, 'Excision', null, 'surgery'],
            [105, 'Append note', null, 'medical_problem'],
            [106, 'Reduction', null, 'surgery'],
        ] as [$id, $title, $enddate, $type]) {
            $this->insert($db, 'lists', ['id', 'date', 'begdate', 'enddate', 'title', 'diagnosis', 'uuid', 'pid', 'comments', 'user', 'modifydate', 'type'], [
                $id, '2026-01-01', '2026-01-02', $enddate, $title, 'ICD10:Z01',
                UuidRegistry::uuidToBytes($id === 101 ? self::SURGERY_UUID : sprintf('aaaaaaaa-aaaa-4aaa-8aaa-%012d', $id)),
                7, 'fixture', 'surgeon', '2026-01-04 12:00:00', $type,
            ]);
        }
        foreach ([[7, 101, 900], [7, 102, 902], [7, 102, 903], [7, 104, 999], [7, 106, 901]] as $link) {
            $this->insert($db, 'issue_encounter', ['pid', 'list_id', 'encounter'], $link);
        }
        $this->database = $db;
    }

    /** @param array<array-key, mixed>|false $binds */
    private function execute(string $sql, array|false $binds): \ADORecordSet_mysqli
    {
        $values = $binds === false ? [] : array_values($binds);
        $this->calls[] = [$sql, $values];
        if (preg_match('/^\s*SELECT\b/i', $sql) !== 1) {
            throw new \LogicException('Surgery search attempted a write');
        }
        if ($this->database === null) {
            throw new \LogicException('Recorder-only boundary has no database');
        }
        $statement = $this->database->prepare($sql);
        if (!$statement instanceof PDOStatement) {
            throw new \LogicException('Failed to prepare surgery search');
        }
        $statement->execute($values);

        $rows = [];
        while (true) {
            $row = $statement->fetch(PDO::FETCH_ASSOC);
            if ($row === false) {
                break;
            }
            self::assertIsArray($row);
            $rows[] = $row;
        }
        $result = $this->getMockBuilder(\ADORecordSet_mysqli::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['FetchRow'])
            ->getMock();
        $result->EOF = $rows === [];
        $result->method('FetchRow')->willReturnCallback(static function () use (&$rows, $result): array|false {
            $row = array_shift($rows);
            $result->EOF = $rows === [];
            return $row ?? false;
        });
        return $result;
    }

    /**
     * @param list<string> $columns
     * @param list<mixed> $values
     */
    private function insert(PDO $db, string $table, array $columns, array $values): void
    {
        $sql = 'INSERT INTO ' . $table . ' (' . implode(', ', $columns) . ') VALUES (' . implode(', ', array_fill(0, count($values), '?')) . ')';
        $statement = $db->prepare($sql);
        if (!$statement instanceof PDOStatement) {
            throw new \LogicException('Failed to prepare fixture insert');
        }
        $statement->execute($values);
    }
}
