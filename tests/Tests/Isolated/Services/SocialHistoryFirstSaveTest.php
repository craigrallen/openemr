<?php

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Kernel;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Events\Services\ServiceSaveEvent;
use OpenEMR\Services\SocialHistoryService;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use Symfony\Component\EventDispatcher\EventDispatcher;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class SocialHistoryFirstSaveTest extends TestCase
{
    private const READ_SQL = 'select * from history_data where  pid=? order by date DESC limit 0,1';
    private const REGISTRY_INSERT = 'INSERT INTO `uuid_registry` (`uuid`, `table_name`, `table_id`, `table_vertical`, `couchdb`, `document_drive`, `mapped`, `created`) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())';

    private EventDispatcher $dispatcher;

    protected function setUp(): void
    {
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
        $session = new Session(new MockArraySessionStorage());
        $session->set('authUserID', 17);
        SessionWrapperFactory::getInstance()->setActiveSession($session);
        $this->dispatcher = new EventDispatcher();
        OEGlobalsBag::getInstance()->set('kernel', new Kernel(dispatcher: $this->dispatcher));
        OEGlobalsBag::getInstance()->set('lastidado', 0);

        if (!class_exists(\ADORecordSet_mysqli::class)) {
            $adodbSource = (new \ReflectionClass(\ADOConnection::class))->getFileName();
            if (!is_string($adodbSource)) {
                self::fail('Cannot locate the installed ADOdb source');
            }
            require_once dirname($adodbSource) . '/drivers/adodb-mysqli.inc.php';
        }
        require_once __DIR__ . '/../../../../library/ADODB_mysqli_log.php';
        require_once __DIR__ . '/../../../../library/sql.inc.php';
    }

    public function testFirstSaveWithSubmittedFieldsUsesMethodPid(): void
    {
        $this->assertAppendFromMissingRow(['tobacco' => 'never', 'alcohol' => 'none'],
            'insert into history_data set pid = ?, date = NOW(), uuid = ? , `tobacco` = ?, `alcohol` = ?, `id` = ?, `created_by` = ?',
            ['never', 'none', '', 17]);
    }

    public function testFirstSaveWithNoChangesStillUsesMethodPid(): void
    {
        $this->assertAppendFromMissingRow([], 'insert into history_data set pid = ?, date = NOW(), uuid = ? , `id` = ?, `created_by` = ?', ['', 17]);
    }

    public function testExistingHistoryAppendsWithUntouchedFieldsAndFreshAttribution(): void
    {
        $oldUuid = str_repeat('o', 16);
        $uuid = null;
        $events =& $this->recordSaveEvents();
        $assertFinished = $this->installDatabase([
            $this->readRow(41, [
                'id' => 9, 'uuid' => $oldUuid, 'pid' => 41, 'date' => '2020-01-01 00:00:00',
                'tobacco' => 'former', 'alcohol' => 'none',
            ]),
            $this->uniqueUuidCheck('uuid_registry', $uuid),
            $this->uniqueUuidCheck('history_data', $uuid),
            $this->registryInsert($uuid),
            $this->historyInsert(
                'insert into history_data set pid = ?, date = NOW(), uuid = ? , `id` = ?, `tobacco` = ?, `alcohol` = ?, `created_by` = ?',
                [41, '', 'current', 'none', 17], $uuid
            ),
        ]);

        $result = $this->service()->updateHistoryDataForPatientPid(41, ['tobacco' => 'current']);
        $assertFinished();
        self::assertSame(41, $result['pid']);
        self::assertSame(915, $result['id']);
        self::assertSame($uuid, $result['uuid']);
        self::assertNotSame($oldUuid, $result['uuid']);
        self::assertSame('none', $result['alcohol']);
        self::assertSame(17, $result['created_by']);
        self::assertArrayNotHasKey('date', $result);
        self::assertCount(2, $events);
        self::assertSame(ServiceSaveEvent::EVENT_PRE_SAVE, $events[0]['type']);
        self::assertSame('', $events[0]['data']['id']);
        self::assertSame($oldUuid, $events[0]['data']['uuid']);
        self::assertArrayNotHasKey('date', $events[0]['data']);
        self::assertSame(ServiceSaveEvent::EVENT_POST_SAVE, $events[1]['type']);
        self::assertSame($result, $events[1]['data']);
    }

    public function testNonnumericPidCannotInsertWhenHistoryIsMissing(): void
    {
        $events =& $this->recordSaveEvents();
        $assertFinished = $this->installDatabase([$this->readRow('not-a-pid', false)]);
        try {
            $this->service()->updateHistoryDataForPatientPid('not-a-pid', ['tobacco' => 'never']);
            self::fail('Nonnumeric PID should be rejected');
        } catch (\InvalidArgumentException $exception) {
            self::assertSame('pid must be a valid number', $exception->getMessage());
        } finally {
            $assertFinished();
        }
        self::assertCount(1, $events);
        self::assertSame(ServiceSaveEvent::EVENT_PRE_SAVE, $events[0]['type']);
    }

    public function testExistingRowRetainsCurrentSubmittedPidMergeSemantics(): void
    {
        $uuid = null;
        $assertFinished = $this->installDatabase([
            $this->readRow(41, ['id' => 9, 'uuid' => str_repeat('o', 16), 'pid' => 41, 'date' => '2020-01-01 00:00:00']),
            $this->uniqueUuidCheck('uuid_registry', $uuid),
            $this->uniqueUuidCheck('history_data', $uuid),
            $this->registryInsert($uuid),
            $this->historyInsert(
                'insert into history_data set pid = ?, date = NOW(), uuid = ? , `id` = ?, `created_by` = ?',
                [42, '', 17], $uuid
            ),
        ]);

        $result = $this->service()->updateHistoryDataForPatientPid(41, ['pid' => 42]);
        $assertFinished();
        self::assertSame(42, $result['pid']);
    }

    /**
     * @param array<string, mixed> $fields
     * @param list<mixed> $extraBinds
     */
    private function assertAppendFromMissingRow(array $fields, string $insertSql, array $extraBinds): void
    {
        $uuid = null;
        $events =& $this->recordSaveEvents();
        $assertFinished = $this->installDatabase([
            $this->readRow(41, false),
            $this->uniqueUuidCheck('uuid_registry', $uuid),
            $this->uniqueUuidCheck('history_data', $uuid),
            $this->registryInsert($uuid),
            $this->historyInsert($insertSql, array_merge([41], $extraBinds), $uuid),
        ]);

        $result = $this->service()->updateHistoryDataForPatientPid(41, $fields);
        $assertFinished();
        self::assertSame(41, $result['pid']);
        self::assertSame(915, $result['id']);
        self::assertSame($uuid, $result['uuid']);
        self::assertSame(17, $result['created_by']);
        self::assertArrayNotHasKey('date', $result);
        foreach ($fields as $key => $value) {
            self::assertSame($value, $result[$key]);
        }
        self::assertCount(2, $events);
        self::assertSame(ServiceSaveEvent::EVENT_PRE_SAVE, $events[0]['type']);
        self::assertSame(41, $events[0]['data']['pid']);
        self::assertSame('', $events[0]['data']['id']);
        self::assertSame(17, $events[0]['data']['created_by']);
        self::assertSame(ServiceSaveEvent::EVENT_POST_SAVE, $events[1]['type']);
        self::assertSame($result, $events[1]['data']);
    }

    private function service(): SocialHistoryService
    {
        return (new \ReflectionClass(SocialHistoryService::class))->newInstanceWithoutConstructor();
    }

    /** @return list<array{type: string, data: array<string, mixed>}> */
    private function &recordSaveEvents(): array
    {
        $events = [];
        foreach ([ServiceSaveEvent::EVENT_PRE_SAVE, ServiceSaveEvent::EVENT_POST_SAVE] as $type) {
            $this->dispatcher->addListener($type, static function (ServiceSaveEvent $event) use (&$events, $type): void {
                self::assertInstanceOf(SocialHistoryService::class, $event->getService());
                $events[] = ['type' => $type, 'data' => $event->getSaveData()];
            });
        }
        return $events;
    }

    /**
     * @param array<string, mixed>|false $row
     * @return \Closure(string, array<mixed>|false, bool): list<array<string, mixed>>
     */
    private function readRow(int|string $pid, array|false $row): \Closure
    {
        return static function (string $sql, array|false $binds, bool $noLog) use ($pid, $row): array {
            self::assertFalse($noLog);
            self::assertSame(self::READ_SQL, $sql);
            self::assertSame([$pid], $binds);
            return $row === false ? [] : [$row];
        };
    }

    /** @return \Closure(string, array<mixed>|false, bool): list<array<string, mixed>> */
    private function uniqueUuidCheck(string $table, ?string &$uuid): \Closure
    {
        return static function (string $sql, array|false $binds, bool $noLog) use ($table, &$uuid): array {
            self::assertTrue($noLog);
            self::assertSame('SELECT `uuid` FROM `' . $table . '` WHERE `uuid` = ?', $sql);
            if ($binds === false || count($binds) !== 1 || !is_string($binds[0])) {
                self::fail('Expected one binary UUID bind');
            }
            self::assertSame(16, strlen($binds[0]));
            if ($uuid === null) {
                $uuid = $binds[0];
            } else {
                self::assertSame($uuid, $binds[0]);
            }
            return [];
        };
    }

    /** @return \Closure(string, array<mixed>|false, bool): list<array<string, mixed>> */
    private function registryInsert(?string &$uuid): \Closure
    {
        return static function (string $sql, array|false $binds, bool $noLog) use (&$uuid): array {
            self::assertFalse($noLog);
            self::assertSame(self::REGISTRY_INSERT, $sql);
            self::assertSame([$uuid, 'history_data', 'id', '', '', 0, 0], $binds);
            return [];
        };
    }

    /** @param list<mixed> $bindsAfterPidAndUuid
     *  @return \Closure(string, array<mixed>|false, bool): list<array<string, mixed>>
     */
    private function historyInsert(string $expectedSql, array $bindsAfterPidAndUuid, ?string &$uuid): \Closure
    {
        return static function (string $sql, array|false $binds, bool $noLog) use ($expectedSql, $bindsAfterPidAndUuid, &$uuid): array {
            self::assertFalse($noLog);
            self::assertSame($expectedSql, $sql);
            $expectedBinds = $bindsAfterPidAndUuid;
            array_splice($expectedBinds, 1, 0, [$uuid]);
            self::assertSame($expectedBinds, $binds);
            OEGlobalsBag::getInstance()->set('lastidado', 915);
            return [];
        };
    }

    /**
     * @param list<\Closure(string, array<mixed>|false, bool): (list<array<string, mixed>>|false)> $operations
     * @return \Closure(): void
     */
    private function installDatabase(array $operations): \Closure
    {
        $transport = $this->getMockBuilder(\ADODB_mysqli_log::class)
            ->disableOriginalConstructor()->onlyMethods(['Execute', 'ExecuteNoLog'])->getMock();
        $execute = function (string $sql, array|false $binds, bool $noLog) use (&$operations): \ADORecordSet_mysqli|false {
            $next = array_shift($operations);
            if (!$next instanceof \Closure) {
                self::fail('Unexpected SQL operation: ' . $sql);
            }
            $rows = $next($sql, $binds, $noLog);
            if ($rows === false) {
                return false;
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
        };
        $transport->method('Execute')->willReturnCallback(
            /** @param array<mixed>|false $binds */
            static function (string $sql, array|false $binds, bool $log) use ($execute): \ADORecordSet_mysqli|false {
                self::assertTrue($log);
                return $execute($sql, $binds, false);
            }
        );
        $transport->method('ExecuteNoLog')->willReturnCallback(
            /** @param array<mixed>|false $binds */
            static fn(string $sql, array|false $binds): \ADORecordSet_mysqli|false => $execute($sql, $binds, true)
        );
        OEGlobalsBag::getInstance()->set('adodb', ['db' => $transport]);

        return static function () use (&$operations): void {
            self::assertSame([], $operations, 'Expected SQL operation was not reached');
        };
    }
}
