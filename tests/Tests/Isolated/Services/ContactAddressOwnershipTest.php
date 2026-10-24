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

    /** @var list<string> */
    private array $writes = [];

    /** @var list<string> */
    private array $reads = [];

    /** @var array<int, array<string, mixed>> */
    private array $links = [];

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
        self::assertContains('contact_address:' . self::LINK_ID, $this->reads);
        $this->assertWroteTable('contact_address');
        $this->assertWroteTable('addresses');
        $this->assertWroteTable('contact');
        $linkWrite = $this->writeFor('contact_address');
        self::assertStringContainsString("`contact_id` = '41'", $linkWrite);
        self::assertStringContainsString("`id` = '701'", $linkWrite);
        self::assertStringContainsString("`status` = '" . (in_array($action, ['DELETE', 'INACTIVATE'], true) ? 'I' : 'A') . "'", $linkWrite);
        if (in_array($action, ['UPDATE', 'ADD'], true)) {
            self::assertSame('Replacement Street', $saved[0]->getAddress()->get_line1());
            self::assertStringContainsString("`line1` = 'Replacement Street'", $this->writeFor('addresses'));
        } else {
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

    /** @return array<string, mixed> */
    private function linkRow(?int $owner): array
    {
        return ['id' => self::LINK_ID, 'contact_id' => $owner, 'address_id' => self::ADDRESS_ID,
            'type' => 'both', 'use' => 'home', 'status' => 'A'];
    }

    /** @return array<string, mixed> */
    private function input(string $action, ?int $id): array
    {
        $data = ['data_action' => $action, 'line_1' => 'Replacement Street',
            'city' => 'Test City', 'type' => 'both', 'use' => 'home', 'status' => 'A'];
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

            public function getValidAddressTypes(): array
            {
                return ['both' => 'Both'];
            }

            public function getValidAddressUses(): array
            {
                return ['home' => 'Home'];
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
                'contact_address' => ['id', 'contact_id', 'address_id', 'type', 'use', 'status'],
                'addresses' => ['id', 'foreign_id', 'line1', 'city', 'zip'],
            };
            $rows = array_map(static fn(string $field): array => ['Field' => $field], $columns);
        } elseif (preg_match('/^SELECT \* from `(contact|contact_address|addresses)` WHERE id = \?$/', $sql, $match)) {
            self::assertTrue($log);
            self::assertIsArray($binds);
            self::assertCount(1, $binds);
            $table = $match[1];
            $id = (int) $binds[0];
            $this->reads[] = "$table:$id";
            $row = match ($table) {
                'contact' => in_array($id, [self::TARGET_CONTACT, self::FOREIGN_CONTACT], true)
                    ? ['id' => $id, 'foreign_table_name' => 'patient_data', 'foreign_id' => 51] : null,
                'contact_address' => $this->links[$id] ?? null,
                'addresses' => $id === self::ADDRESS_ID
                    ? ['id' => $id, 'line1' => 'Original Street', 'city' => 'Old City', 'zip' => '10001'] : null,
            };
            $rows = $row === null ? [] : [$row];
        } elseif (preg_match('/^INSERT INTO (contact|contact_address|addresses) SET /', $sql)) {
            self::assertTrue($log);
            self::assertFalse($binds);
            $this->writes[] = $sql;
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
