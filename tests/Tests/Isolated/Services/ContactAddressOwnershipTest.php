<?php

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Common\ORDataObject\ContactAddress;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Services\ContactAddressService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class ContactAddressOwnershipTest extends TestCase
{
    private const TARGET_CONTACT = 41;
    private const FOREIGN_CONTACT = 99;
    private const ADDRESS_ID = 501;
    private const LINK_ID = 701;
    private const FOREIGN_LINK_ID = 702;
    private const SECOND_LINK_ID = 703;

    /** @var list<string> */
    private array $writes = [];

    /** @var list<string> */
    private array $reads = [];

    /** @var array<int, array<string, mixed>> */
    private array $links = [];

    /** @var array<string, mixed> */
    private array $targetContactRow = ['id' => self::TARGET_CONTACT, 'foreign_table_name' => 'patient_data', 'foreign_id' => 51];

    private bool $changeContactDuringAddressWrite = false;

    private int $nextId = 1000;

    protected function setUp(): void
    {
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
        $session = new Session(new MockArraySessionStorage());
        $session->set('authUser', 'synthetic-author');
        SessionWrapperFactory::getInstance()->setActiveSession($session);

        if (!class_exists(\ADORecordSet_mysqli::class)) {
            $source = (new \ReflectionClass(\ADOConnection::class))->getFileName();
            if (!is_string($source)) {
                self::fail('Cannot locate installed ADOdb driver');
            }
            require_once dirname($source) . '/drivers/adodb-mysqli.inc.php';
        }
        require_once __DIR__ . '/../../../../library/ADODB_mysqli_log.php';
        require_once __DIR__ . '/../../../../library/sql.inc.php';
        require_once __DIR__ . '/../../../../library/formdata.inc.php';
        require_once __DIR__ . '/../../../Fixtures/ContactAddressOwnershipSqlBoundary.php';

        $db = $this->getMockBuilder(\ADODB_mysqli_log::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['Execute', 'ExecuteNoLog', 'MetaTables', 'MetaPrimaryKeys', 'GenID'])
            ->getMock();
        $db->method('MetaTables')->willReturn(['contact', 'contact_address', 'addresses']);
        $db->method('MetaPrimaryKeys')->willReturn(['id']);
        $db->method('GenID')->willReturnCallback(fn(): int => $this->nextId++);
        $db->method('Execute')->willReturnCallback(
            fn(string $sql, array|false $binds, bool $log): \ADORecordSet_mysqli => $this->execute($sql, $binds, $log)
        );
        $db->method('ExecuteNoLog')->willReturnCallback(
            fn(string $sql, array|false $binds): \ADORecordSet_mysqli => $this->execute($sql, $binds, false)
        );
        OEGlobalsBag::getInstance()->set('adodb', ['db' => $db]);
    }

    /** @return iterable<string, array{string, string}> */
    public static function rejectedIds(): iterable
    {
        foreach (['UPDATE', 'INACTIVATE', 'DELETE', 'ADD'] as $action) {
            foreach (['foreign', 'missing', 'null-owner', 'zero-owner'] as $case) {
                yield "$action/$case" => [$action, $case];
            }
        }
    }

    #[DataProvider('rejectedIds')]
    public function testSuppliedIdMustBelongToTargetBeforeAnyWrite(string $action, string $case): void
    {
        $this->links = match ($case) {
            'foreign' => [self::LINK_ID => $this->linkRow(self::FOREIGN_CONTACT)],
            'missing' => [],
            'null-owner' => [self::LINK_ID => $this->linkRow(null)],
            'zero-owner' => [self::LINK_ID => $this->linkRow(0)],
            default => self::fail('Unexpected ownership case: ' . $case),
        };

        $saved = $this->service()->saveAddressesForContact(self::TARGET_CONTACT, [
            $this->input($action, self::LINK_ID),
        ]);

        self::assertSame([], $saved, 'Rejected ID must not be returned as a saved record');
        self::assertSame([], $this->writes, 'Ownership rejection must precede nested Address and Contact persistence');
        self::assertContains('contact_address:' . self::LINK_ID, $this->reads, 'Native link load must be exercised');
        self::assertNotContains('addresses:' . self::ADDRESS_ID, $this->reads, 'Rejected link must not load its nested address');
    }

    /** @return iterable<string, array{string}> */
    public static function existingActions(): iterable
    {
        foreach (['UPDATE', 'INACTIVATE', 'DELETE', 'ADD'] as $action) {
            yield $action => [$action];
        }
    }

    #[DataProvider('existingActions')]
    public function testSameOwnerActionsPersistNativeObjects(string $action): void
    {
        $this->links = [self::LINK_ID => $this->linkRow(self::TARGET_CONTACT)];

        $saved = $this->service()->saveAddressesForContact(self::TARGET_CONTACT, [
            $this->input($action, self::LINK_ID),
        ]);

        self::assertCount(1, $saved);
        self::assertInstanceOf(ContactAddress::class, $saved[0]);
        self::assertSame(self::LINK_ID, $saved[0]->get_id());
        self::assertSame(self::TARGET_CONTACT, $saved[0]->get_contact_id());
        self::assertSame(self::ADDRESS_ID, $saved[0]->get_address_id());
        // The model's author comes from the session; the actual table has created_by, not author.
        self::assertSame('synthetic-author', $saved[0]->get_author());
        self::assertSame('2023-01-02 03:04:05', $saved[0]->get_created_date()->format('Y-m-d H:i:s'));
        self::assertSame('Y', $saved[0]->get_is_primary());
        self::assertContains('contact_address:' . self::LINK_ID, $this->reads);
        $this->assertWroteTable('contact_address');
        $this->assertWroteTable('addresses');
        $this->assertWroteTable('contact');
        $linkWrite = $this->writeFor('contact_address');
        self::assertStringContainsString("`contact_id` = '41'", $linkWrite);
        self::assertStringContainsString("`id` = '701'", $linkWrite);
        self::assertStringContainsString("`address_id` = '501'", $linkWrite);
        self::assertStringContainsString("`created_date` = '2023-01-02 03:04:05'", $linkWrite);
        self::assertStringNotContainsString('`created_by` = ', $linkWrite);
        self::assertStringContainsString("`is_primary` = 'Y'", $linkWrite);
        self::assertStringContainsString("`status` = '" . (in_array($action, ['DELETE', 'INACTIVATE'], true) ? 'I' : 'A') . "'", $linkWrite);
        if (in_array($action, ['UPDATE', 'ADD'], true)) {
            self::assertSame('Replacement Street', $saved[0]->getAddress()->get_line1());
            self::assertSame('postal', $saved[0]->get_type());
            self::assertSame('work', $saved[0]->get_use());
            self::assertSame('Submitted note', $saved[0]->get_notes());
            self::assertSame(2, $saved[0]->get_priority());
            self::assertSame('2024-06-15', $saved[0]->get_period_start()->format('Y-m-d'));
            $periodEnd = $saved[0]->get_period_end();
            self::assertInstanceOf(\DateTime::class, $periodEnd);
            self::assertSame('2024-07-01', $periodEnd->format('Y-m-d'));
            foreach (["`type` = 'postal'", "`use` = 'work'", "`notes` = 'Submitted note'",
                "`priority` = '2'", "`period_start` = '2024-06-15", "`period_end` = '2024-07-01"] as $expected) {
                self::assertStringContainsString($expected, $linkWrite);
            }
            self::assertStringContainsString("`line1` = 'Replacement Street'", $this->writeFor('addresses'));
        } else {
            self::assertSame('both', $saved[0]->get_type());
            self::assertSame('home', $saved[0]->get_use());
            self::assertSame('Stored note', $saved[0]->get_notes());
            self::assertSame(7, $saved[0]->get_priority());
            self::assertSame('2023-02-03 04:05:06', $saved[0]->get_period_start()->format('Y-m-d H:i:s'));
            $periodEnd = $saved[0]->get_period_end();
            self::assertInstanceOf(\DateTime::class, $periodEnd);
            self::assertGreaterThan(new \DateTime('2023-12-31 05:06:07'), $periodEnd);
            self::assertStringContainsString(
                "`period_end` = '" . $periodEnd->format('Y-m-d H:i:s') . "'",
                $linkWrite
            );
            foreach (["`type` = 'both'", "`use` = 'home'", "`notes` = 'Stored note'",
                "`priority` = '7'", "`period_start` = '2023-02-03 04:05:06'"] as $expected) {
                self::assertStringContainsString($expected, $linkWrite);
            }
            self::assertStringContainsString("`line1` = 'Original Street'", $this->writeFor('addresses'));
        }
    }

    public function testAddWithoutIdCreatesNewNativeAddressAndLink(): void
    {
        $saved = $this->service()->saveAddressesForContact(self::TARGET_CONTACT, [$this->input('ADD', null)]);

        self::assertCount(1, $saved);
        self::assertInstanceOf(ContactAddress::class, $saved[0]);
        self::assertSame(self::TARGET_CONTACT, $saved[0]->get_contact_id());
        self::assertNotEmpty($saved[0]->get_id());
        self::assertSame('Replacement Street', $saved[0]->getAddress()->get_line1());
        $this->assertWroteTable('addresses');
        $this->assertWroteTable('contact_address');
        self::assertStringContainsString("`line1` = 'Replacement Street'", $this->writeFor('addresses'));
        self::assertStringContainsString("`contact_id` = '41'", $this->writeFor('contact_address'));
    }

    public function testEmptyAndMissingActionsAndMissingIdNonAddRemainSkipped(): void
    {
        $saved = $this->service()->saveAddressesForContact(self::TARGET_CONTACT, [
            $this->input('', self::LINK_ID),
            ['contact_address_id' => self::LINK_ID, 'line_1' => 'Ignored'],
            $this->input('UPDATE', null),
            $this->input('INACTIVATE', null),
            $this->input('DELETE', null),
        ]);

        self::assertSame([], $saved);
        self::assertSame([], $this->writes);
        self::assertNotContains('contact_address:' . self::LINK_ID, $this->reads);
    }

    public function testContactIsLoadedAfterNestedAddressWriteForSameOwner(): void
    {
        $this->links = [self::LINK_ID => $this->linkRow(self::TARGET_CONTACT)];
        $this->changeContactDuringAddressWrite = true;

        $saved = $this->service()->saveAddressesForContact(self::TARGET_CONTACT, [
            $this->input('UPDATE', self::LINK_ID),
        ]);

        self::assertCount(1, $saved);
        self::assertInstanceOf(ContactAddress::class, $saved[0]);
        self::assertSame('Replacement Street', $saved[0]->getAddress()->get_line1());
        self::assertContains('contact_address:' . self::LINK_ID, $this->reads);
        self::assertContains('addresses:' . self::ADDRESS_ID, $this->reads);
        self::assertCount(3, $this->writes);
        self::assertStringStartsWith('INSERT INTO addresses SET ', $this->writes[0]);
        self::assertStringStartsWith('INSERT INTO contact SET ', $this->writes[1]);
        self::assertStringStartsWith('INSERT INTO contact_address SET ', $this->writes[2]);
        $this->assertWroteTable('addresses');
        $this->assertWroteTable('contact');
        self::assertStringContainsString("`foreign_table_name` = 'related_person'", $this->writeFor('contact'));
        self::assertStringContainsString("`foreign_id` = '52'", $this->writeFor('contact'));
        self::assertStringNotContainsString("`foreign_id` = '51'", $this->writeFor('contact'));
    }

    public function testRejectedRowsDoNotStopLaterSameOwnerRow(): void
    {
        $this->links = [
            self::FOREIGN_LINK_ID => $this->linkRow(self::FOREIGN_CONTACT, self::FOREIGN_LINK_ID),
            self::LINK_ID => $this->linkRow(self::TARGET_CONTACT),
            self::SECOND_LINK_ID => $this->linkRow(self::TARGET_CONTACT, self::SECOND_LINK_ID),
        ];

        $saved = $this->service()->saveAddressesForContact(self::TARGET_CONTACT, [
            $this->input('UPDATE', self::FOREIGN_LINK_ID),
            $this->input('UPDATE', self::LINK_ID),
            $this->input('DELETE', self::FOREIGN_LINK_ID),
            $this->input('UPDATE', self::SECOND_LINK_ID),
        ]);

        self::assertCount(2, $saved);
        self::assertSame([self::LINK_ID, self::SECOND_LINK_ID], array_map(
            static function (mixed $link): mixed {
                self::assertInstanceOf(ContactAddress::class, $link);
                return $link->get_id();
            },
            $saved
        ));
        self::assertContains('contact_address:' . self::FOREIGN_LINK_ID, $this->reads);
        self::assertContains('contact_address:' . self::LINK_ID, $this->reads);
        self::assertContains('contact_address:' . self::SECOND_LINK_ID, $this->reads);
        self::assertSame(['addresses:' . self::ADDRESS_ID, 'addresses:' . self::ADDRESS_ID], array_values(array_filter(
            $this->reads,
            static fn(string $read): bool => str_starts_with($read, 'addresses:')
        )));
        self::assertCount(6, $this->writes);
        $linkWrites = array_values(array_filter(
            $this->writes,
            static fn(string $sql): bool => str_starts_with($sql, 'INSERT INTO contact_address SET ')
        ));
        self::assertCount(2, $linkWrites);
        self::assertStringContainsString("`id` = '701'", $linkWrites[0]);
        self::assertStringContainsString("`id` = '703'", $linkWrites[1]);
        self::assertStringNotContainsString("`id` = '702'", implode('\n', $this->writes));
    }

    public function testStringDatabaseOwnerAndIdsStillResolveSameOwner(): void
    {
        $this->links = [self::LINK_ID => array_replace($this->linkRow(self::TARGET_CONTACT), [
            'id' => (string) self::LINK_ID,
            'contact_id' => (string) self::TARGET_CONTACT,
            'address_id' => (string) self::ADDRESS_ID,
            'priority' => '7',
        ])];

        $saved = $this->service()->saveAddressesForContact(self::TARGET_CONTACT, [
            $this->input('UPDATE', self::LINK_ID),
        ]);

        self::assertCount(1, $saved);
        self::assertInstanceOf(ContactAddress::class, $saved[0]);
        self::assertSame((string) self::LINK_ID, $saved[0]->get_id());
        self::assertSame(self::TARGET_CONTACT, $saved[0]->get_contact_id());
        self::assertSame(self::ADDRESS_ID, $saved[0]->get_address_id());
        self::assertStringContainsString("`contact_id` = '41'", $this->writeFor('contact_address'));
    }

    public function testUnknownTargetContactIdIsNotVerifiedBeforeEmptyBatch(): void
    {
        // Contact retains a supplied ID even if populate finds no row. This service
        // does not currently establish target Contact existence for an empty batch.
        $saved = $this->service()->saveAddressesForContact(888, []);

        self::assertSame([], $saved);
        self::assertSame(['contact:888'], $this->reads);
        self::assertSame([], $this->writes);
    }

    /** @return array<string, mixed> */
    private function linkRow(?int $owner, int $id = self::LINK_ID): array
    {
        return ['id' => $id, 'contact_id' => $owner, 'address_id' => self::ADDRESS_ID,
            'priority' => 7, 'type' => 'both', 'use' => 'home', 'notes' => 'Stored note',
            'status' => 'A', 'is_primary' => 'Y', 'period_start' => '2023-02-03 04:05:06',
            'period_end' => '2023-12-31 05:06:07', 'created_date' => '2023-01-02 03:04:05',
            'created_by' => 17];
    }

    /** @return array<string, mixed> */
    private function input(string $action, ?int $id): array
    {
        $data = ['data_action' => $action, 'line_1' => 'Replacement Street',
            'city' => 'Test City', 'type' => 'postal', 'use' => 'work', 'status' => 'A',
            'notes' => 'Submitted note', 'priority' => 2, 'period_start' => '2024-06-15',
            'period_end' => '2024-07-01'];
        if ($id !== null) {
            $data['contact_address_id'] = $id;
        }
        return $data;
    }

    private function service(): ContactAddressService
    {
        // The parent constructor queries schema/list data. Only that setup is bypassed;
        // saveAddressesForContact and all three ORDataObject classes remain native.
        $service = new class extends ContactAddressService {
            public function __construct()
            {
            }

            /** @return array<string, string> */
            public function getValidAddressTypes(): array
            {
                return ['both' => 'Both', 'postal' => 'Postal'];
            }

            /** @return array<string, string> */
            public function getValidAddressUses(): array
            {
                return ['home' => 'Home', 'work' => 'Work'];
            }
        };
        $service->setLogger(new NullLogger());
        return $service;
    }

    /** @param array<mixed>|false $binds */
    private function execute(string $sql, array|false $binds, bool $log): \ADORecordSet_mysqli
    {
        $rows = [];
        if ($sql === 'SHOW TABLES') {
            self::assertFalse($log);
            $rows = [['Tables_in_test' => 'contact'], ['Tables_in_test' => 'contact_address'],
                ['Tables_in_test' => 'addresses']];
        } elseif (preg_match('/^SHOW COLUMNS FROM `(contact|contact_address|addresses)`$/', $sql, $match)) {
            self::assertTrue($log);
            $columns = match ($match[1]) {
                'contact' => ['id', 'foreign_table_name', 'foreign_id'],
                'contact_address' => ['id', 'contact_id', 'address_id', 'priority', 'type', 'use',
                    'notes', 'status', 'is_primary', 'period_start', 'period_end', 'inactivated_reason',
                    'created_date', 'created_by', 'updated_date', 'updated_by'],
                default => ['id', 'foreign_id', 'line1', 'city', 'zip'],
            };
            $rows = array_map(static fn(string $field): array => ['Field' => $field], $columns);
        } elseif ($sql === 'SELECT contact_id FROM contact_address WHERE id = ?') {
            self::assertTrue($log);
            self::assertIsArray($binds);
            self::assertCount(1, $binds);
            self::assertTrue(is_int($binds[0]) || is_string($binds[0]));
            self::assertTrue(is_numeric($binds[0]));
            $id = (int) $binds[0];
            $this->reads[] = 'contact_address:' . $id;
            $link = $this->links[$id] ?? null;
            $rows = $link === null ? [] : [['contact_id' => $link['contact_id']]];
        } elseif (preg_match('/^SELECT \* from `(contact|contact_address|addresses)` WHERE id = \?$/', $sql, $match)) {
            self::assertTrue($log);
            self::assertIsArray($binds);
            self::assertCount(1, $binds);
            $table = $match[1];
            self::assertTrue(is_int($binds[0]) || is_string($binds[0]));
            self::assertTrue(is_numeric($binds[0]));
            $id = (int) $binds[0];
            $this->reads[] = "$table:$id";
            $row = match ($table) {
                'contact' => $id === self::TARGET_CONTACT ? $this->targetContactRow
                    : ($id === self::FOREIGN_CONTACT
                        ? ['id' => $id, 'foreign_table_name' => 'patient_data', 'foreign_id' => 91] : null),
                'contact_address' => $this->links[$id] ?? null,
                default => $id === self::ADDRESS_ID
                    ? ['id' => $id, 'line1' => 'Original Street', 'city' => 'Old City', 'zip' => '10001'] : null,
            };
            $rows = $row === null ? [] : [$row];
        } elseif (preg_match('/^INSERT INTO (contact|contact_address|addresses) SET /', $sql)) {
            self::assertTrue($log);
            self::assertFalse($binds);
            $this->writes[] = $sql;
            if ($this->changeContactDuringAddressWrite && str_starts_with($sql, 'INSERT INTO addresses SET ')) {
                $this->targetContactRow['foreign_table_name'] = 'related_person';
                $this->targetContactRow['foreign_id'] = 52;
            }
        } else {
            self::fail('Unexpected native SQL: ' . $sql);
        }

        $result = $this->getMockBuilder(\ADORecordSet_mysqli::class)
            ->disableOriginalConstructor()->onlyMethods(['FetchRow'])->getMock();
        $result->EOF = $rows === [];
        $result->method('FetchRow')->willReturnCallback(static function () use (&$rows, $result): array|false {
            $row = array_shift($rows);
            $result->EOF = $rows === [];
            return $row ?? false;
        });
        return $result;
    }

    private function assertWroteTable(string $table): void
    {
        self::assertNotSame('', $this->writeFor($table), "Expected native $table persistence");
    }

    private function writeFor(string $table): string
    {
        foreach ($this->writes as $sql) {
            if (str_starts_with($sql, "INSERT INTO $table SET ")) {
                return $sql;
            }
        }
        return '';
    }
}
