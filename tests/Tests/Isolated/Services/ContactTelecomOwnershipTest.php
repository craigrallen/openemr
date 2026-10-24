<?php

/** Regression coverage for contact telecom ownership at the native save boundary. */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\ORDataObject\ContactTelecom;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Services\ContactTelecomService;
use OpenEMR\Services\ListService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;
use function OpenEMR\Common\ORDataObject\installContactTelecomOwnershipSqlBoundary;

/** Only database boundaries are doubled; the service and both data objects remain native. */
final class ContactTelecomOwnershipBoundary
{
    /** @var array<array-key, array<string, string|null>> */
    public static array $contacts = [];
    /** @var array<array-key, array<string, string|null>> */
    public static array $telecoms = [];
    /** @var list<array{string, list<string|int|null>}> */
    public static array $reads = [];
    /** @var list<array{string, list<string|int|null>}> */
    public static array $writes = [];
    public static bool $failWrite = false;

    /**
     * @param list<string|int|null> $binds
     * @return array<string, string|null>
     */
    public static function read(string $sql, array $binds): array
    {
        self::$reads[] = [$sql, $binds];
        if ($sql === 'SELECT `id` FROM `contact` WHERE `foreign_table_name` = ? AND `foreign_id` = ?') {
            return [];
        }
        if (preg_match('/^SELECT \* from `?(contact|contact_telecom)`? WHERE id = \?$/', $sql, $matches) !== 1) {
            throw new \LogicException('Unexpected SQL read: ' . $sql);
        }
        $rows = $matches[1] === 'contact' ? self::$contacts : self::$telecoms;
        return $rows[(string) $binds[0]] ?? [];
    }

    /** @param list<string|int|null> $binds */
    public static function write(string $sql, array $binds): bool
    {
        self::$writes[] = [$sql, $binds];
        if (self::$failWrite) {
            throw new \RuntimeException('Synthetic persistence failure');
        }
        if (str_starts_with($sql, 'INSERT INTO contact_telecom SET ')) {
            preg_match_all("/`([a-z_]+)` = '((?:\\\\.|[^'])*)'/", $sql, $matches, PREG_SET_ORDER);
            /** @var array<string, string> $fields */
            $fields = [];
            foreach ($matches as $match) {
                $fields[$match[1]] = stripslashes($match[2]);
            }
            if (!isset($fields['id'])) {
                throw new \LogicException('Telecom write did not contain an ID');
            }
            self::$telecoms[$fields['id']] = array_replace(self::$telecoms[$fields['id']] ?? [], $fields);
        }
        return true;
    }
}

/** Recording substitute for the static database methods used by native data objects. */
final class ContactTelecomOwnershipQueryRecorder
{
    public static int $generatedIds = 0;

    /** @return list<string> */
    public static function listTableFields(string $table): array
    {
        return match ($table) {
            'contact' => ['id', 'foreign_table_name', 'foreign_id'],
            'contact_telecom' => ['id', 'contact_id', 'system', 'use', 'value', 'notes', 'status', 'rank', 'is_primary'],
            default => throw new \LogicException('Unexpected table'),
        };
    }

    /** @param list<string|int|null> $binds */
    public static function sqlStatementThrowException(string $sql, array $binds = []): bool
    {
        return ContactTelecomOwnershipBoundary::write($sql, $binds);
    }

    public static function generateId(): int
    {
        self::$generatedIds++;
        return 901;
    }
}

final class ContactTelecomOwnershipLists extends ListService
{
    /**
     * @param mixed $list_name
     * @param mixed $search
     * @return list<array{option_id: string, title: string}>
     */
    public function getOptionsByListName($list_name, $search = []): array
    {
        return match ($list_name) {
            'telecom_systems' => [['option_id' => 'phone', 'title' => 'Phone']],
            'telecom_uses' => [['option_id' => 'home', 'title' => 'Home']],
            default => throw new \LogicException('Unexpected list lookup'),
        };
    }
}

final class ContactTelecomOwnershipTest extends TestCase
{
    protected function setUp(): void
    {
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
    }

    private function service(?LoggerInterface $logger = null): ContactTelecomService
    {
        // Function definitions run only in the isolated child, never during discovery.
        foreach (['sqlQuery', 'sqlStatement', 'escape_table_name', 'get_db', 'add_escape_custom'] as $name) {
            self::assertFalse(function_exists('OpenEMR\\Common\\ORDataObject\\' . $name));
        }
        installContactTelecomOwnershipSqlBoundary();

        self::assertFalse(class_exists(QueryUtils::class, false));
        self::assertTrue(class_alias(ContactTelecomOwnershipQueryRecorder::class, QueryUtils::class));

        $GLOBALS['adodb'] = ['db' => new class {
            /** @return list<string> */
            public function MetaPrimaryKeys(string $table): array
            {
                return ['id'];
            }
        }];
        $session = new Session(new MockArraySessionStorage());
        $session->set('authUser', 'synthetic-author');
        $factory = new SessionWrapperFactory('/synthetic-test');
        $factory->setActiveSession($session);
        (new \ReflectionProperty(SessionWrapperFactory::class, 'instances'))
            ->setValue(null, [SessionWrapperFactory::class => $factory]);

        ContactTelecomOwnershipBoundary::$contacts = [
            '41' => ['id' => '41', 'foreign_table_name' => 'patient_data', 'foreign_id' => '7'],
            '42' => ['id' => '42', 'foreign_table_name' => 'person', 'foreign_id' => '8'],
        ];
        ContactTelecomOwnershipBoundary::$telecoms = [
            '71' => ['id' => '71', 'contact_id' => '41', 'system' => 'phone', 'use' => 'home', 'value' => 'original', 'status' => 'A'],
            '72' => ['id' => '72', 'contact_id' => '42', 'system' => 'phone', 'use' => 'home', 'value' => 'other-owner', 'status' => 'A'],
        ];
        ContactTelecomOwnershipBoundary::$reads = [];
        ContactTelecomOwnershipBoundary::$writes = [];
        ContactTelecomOwnershipBoundary::$failWrite = false;
        ContactTelecomOwnershipQueryRecorder::$generatedIds = 0;

        // The constructor only loads metadata and a kernel. Its state is not needed by
        // saveTelecomsForContact, so bypass it while invoking the actual method body.
        $service = (new \ReflectionClass(ContactTelecomService::class))->newInstanceWithoutConstructor();
        $service->setLogger($logger ?? new NullLogger());
        (new \ReflectionProperty(ContactTelecomService::class, 'listService'))
            ->setValue($service, new ContactTelecomOwnershipLists());
        return $service;
    }

    /** @return array<string, array{string}> */
    public static function foreignOwnerActions(): array
    {
        return [
            'UPDATE' => ['UPDATE'],
            'INACTIVATE' => ['INACTIVATE'],
            'DELETE' => ['DELETE'],
            'ADD with existing ID' => ['ADD'],
        ];
    }

    #[DataProvider('foreignOwnerActions')]
    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testExistingOtherOwnerIdIsSkippedWithoutWrite(string $action): void
    {
        $service = $this->service();
        $before = ContactTelecomOwnershipBoundary::$telecoms['72'] ?? null;
        self::assertIsArray($before);

        self::assertSame([], $service->saveTelecomsForContact(41, [[
            'data_action' => $action,
            'contact_telecom_id' => '72',
            'value' => 'replacement',
        ]]));

        self::assertSame($before, ContactTelecomOwnershipBoundary::$telecoms['72']);
        self::assertSame([], ContactTelecomOwnershipBoundary::$writes);
        self::assertSame(42, (new ContactTelecom('72'))->get_contact_id());
    }

    /** @return array<string, array{string, string|null}> */
    public static function unownedRowActions(): array
    {
        $cases = [];
        foreach (['null owner' => null, 'zero owner' => '0'] as $ownerName => $ownerId) {
            foreach (['UPDATE', 'INACTIVATE', 'DELETE', 'ADD'] as $action) {
                $cases[$ownerName . ' ' . $action] = [$action, $ownerId];
            }
        }
        return $cases;
    }

    #[DataProvider('unownedRowActions')]
    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testExistingUnownedRowIsSkippedWithGenericWarning(string $action, ?string $ownerId): void
    {
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::once())
            ->method('warning')
            ->with('Skipping telecom with invalid ownership', ['index' => 0]);
        $service = $this->service($logger);
        ContactTelecomOwnershipBoundary::$telecoms['73'] = [
            'id' => '73', 'contact_id' => $ownerId, 'system' => 'phone',
            'use' => 'home', 'value' => 'unowned', 'status' => 'A',
        ];
        $before = ContactTelecomOwnershipBoundary::$telecoms['73'] ?? null;
        self::assertIsArray($before);

        self::assertSame([], $service->saveTelecomsForContact(41, [[
            'data_action' => $action, 'contact_telecom_id' => '73', 'value' => 'replacement',
        ]]));

        self::assertSame($before, ContactTelecomOwnershipBoundary::$telecoms['73']);
        self::assertSame([], ContactTelecomOwnershipBoundary::$writes);
        self::assertSame(0, ContactTelecomOwnershipQueryRecorder::$generatedIds);
    }

    #[DataProvider('foreignOwnerActions')]
    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testSameOwnerIdKeepsLegacyAction(string $action): void
    {
        $service = $this->service();
        $saved = $service->saveTelecomsForContact(41, [[
            'data_action' => $action,
            'contact_telecom_id' => '71',
            'value' => 'replacement',
        ]]);

        self::assertCount(1, $saved);
        self::assertInstanceOf(ContactTelecom::class, $saved[0]);
        self::assertSame(41, $saved[0]->get_contact_id());
        self::assertNotEmpty(ContactTelecomOwnershipBoundary::$writes);
        if ($action === 'DELETE' || $action === 'INACTIVATE') {
            self::assertSame('I', $saved[0]->get_status());
        } else {
            self::assertSame('replacement', $saved[0]->get_value());
        }
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testForeignRowIsSkippedWhileFollowingOwnedRowIsSaved(): void
    {
        $service = $this->service();
        $foreignBefore = ContactTelecomOwnershipBoundary::$telecoms['72'] ?? null;
        self::assertIsArray($foreignBefore);
        $saved = $service->saveTelecomsForContact(41, [
            ['data_action' => 'DELETE', 'contact_telecom_id' => '72'],
            ['data_action' => 'UPDATE', 'contact_telecom_id' => '71', 'value' => 'owned-update'],
        ]);

        self::assertCount(1, $saved);
        self::assertInstanceOf(ContactTelecom::class, $saved[0]);
        self::assertSame('71', $saved[0]->get_id());
        self::assertSame('owned-update', $saved[0]->get_value());
        self::assertSame($foreignBefore, ContactTelecomOwnershipBoundary::$telecoms['72']);
        self::assertNotEmpty(ContactTelecomOwnershipBoundary::$writes);
        foreach (ContactTelecomOwnershipBoundary::$writes as [$sql]) {
            self::assertStringNotContainsString("`id` = '72'", $sql);
        }
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testEmptyAndMissingIdInputDoNotWrite(): void
    {
        $service = $this->service();
        self::assertSame([], $service->saveTelecomsForContact(41, []));
        self::assertSame([], $service->saveTelecomsForContact(41, [
            ['data_action' => 'UPDATE', 'value' => 'ignored'],
            ['data_action' => 'DELETE'],
            ['value' => 'no-action'],
        ]));
        self::assertSame([], ContactTelecomOwnershipBoundary::$writes);
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testAddWithoutIdUsesNativeGeneratedIdAndPersists(): void
    {
        $service = $this->service();
        $saved = $service->saveTelecomsForContact(41, [[
            'data_action' => 'ADD', 'value' => 'new-number',
        ]]);

        self::assertCount(1, $saved);
        self::assertInstanceOf(ContactTelecom::class, $saved[0]);
        self::assertSame(901, $saved[0]->get_id());
        self::assertSame(41, $saved[0]->get_contact_id());
        self::assertSame('new-number', $saved[0]->get_value());
        self::assertSame(1, ContactTelecomOwnershipQueryRecorder::$generatedIds);
        $row = ContactTelecomOwnershipBoundary::$telecoms['901'] ?? null;
        self::assertIsArray($row);
        self::assertSame('901', $row['id'] ?? null);
        self::assertSame('41', $row['contact_id'] ?? null);
        self::assertSame('new-number', $row['value'] ?? null);
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testNonexistentConstructorRetainsIdWithoutPopulatingOwner(): void
    {
        $this->service();
        $telecom = new ContactTelecom('999');

        self::assertSame('999', $telecom->get_id());
        self::assertNull((new \ReflectionProperty(ContactTelecom::class, 'contact_id'))->getValue($telecom));
        self::assertSame([], ContactTelecomOwnershipBoundary::$writes);
    }

    /** @return array<string, array{string}> */
    public static function nonexistentIdActions(): array
    {
        return [
            'UPDATE' => ['UPDATE'],
            'INACTIVATE' => ['INACTIVATE'],
            'DELETE' => ['DELETE'],
            'ADD with supplied ID' => ['ADD'],
        ];
    }

    #[DataProvider('nonexistentIdActions')]
    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testNonexistentSuppliedIdIsSkippedWithoutWrite(string $action): void
    {
        $service = $this->service();

        self::assertSame([], $service->saveTelecomsForContact(41, [[
            'data_action' => $action, 'contact_telecom_id' => '999', 'value' => 'new',
        ]]));
        self::assertArrayNotHasKey('999', ContactTelecomOwnershipBoundary::$telecoms);
        self::assertSame([], ContactTelecomOwnershipBoundary::$writes);
        self::assertSame(0, ContactTelecomOwnershipQueryRecorder::$generatedIds);
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testNativePersistFailurePropagates(): void
    {
        $service = $this->service();
        ContactTelecomOwnershipBoundary::$failWrite = true;
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Synthetic persistence failure');
        $service->saveTelecomsForContact(41, [[
            'data_action' => 'UPDATE', 'contact_telecom_id' => '71', 'value' => 'replacement',
        ]]);
    }
}

namespace OpenEMR\Common\ORDataObject;

/** Install SQL substitutes only when the isolated test child enters service(). */
function installContactTelecomOwnershipSqlBoundary(): void
{
    /**
     * @param list<string|int|null> $binds
     * @return array<string, string|null>
     */
    function sqlQuery(string $sql, array $binds = []): array
    {
        return \OpenEMR\Tests\Isolated\Services\ContactTelecomOwnershipBoundary::read($sql, $binds);
    }

    function sqlStatement(string $sql): bool
    {
        return \OpenEMR\Tests\Isolated\Services\ContactTelecomOwnershipBoundary::write($sql, []);
    }

    function escape_table_name(string $table): string
    {
        return '`' . $table . '`';
    }

    function get_db(): object
    {
        $db = $GLOBALS['adodb']['db'] ?? null;
        if (!is_object($db)) {
            throw new \LogicException('Test database boundary was not installed');
        }
        return $db;
    }

    function add_escape_custom(string $value): string
    {
        return addslashes($value);
    }
}
