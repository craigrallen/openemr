<?php

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Common\Database\SqlQueryException;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Services\DrugSalesService;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class DrugSalesMissingDrugTest extends TestCase
{
    private const ENCOUNTER_SQL = 'SELECT count(*) AS count from form_encounter WHERE pid = ? AND encounter = ?';
    private const WAREHOUSE_SQL = 'SELECT default_warehouse FROM users WHERE username = ?';
    private const DRUG_SQL = 'SELECT allow_combining, reorder_point, name, dispensable FROM drugs WHERE drug_id = ?';
    private const INVENTORY_SQL = "SELECT di.*, lo.option_id, lo.seq FROM drug_inventory AS di LEFT JOIN list_options AS lo ON lo.list_id = 'warehouse' AND lo.option_id = di.warehouse_id AND lo.activity = 1 WHERE di.drug_id = ? AND di.destroy_date IS NULL AND di.on_hand != 0 ORDER BY di.warehouse_id != ?, lo.seq, di.expiration, di.lot_number, di.inventory_id";
    private const SINGLE_WAREHOUSE_INVENTORY_SQL = "SELECT di.*, lo.option_id, lo.seq FROM drug_inventory AS di LEFT JOIN list_options AS lo ON lo.list_id = 'warehouse' AND lo.option_id = di.warehouse_id AND lo.activity = 1 WHERE di.drug_id = ? AND di.destroy_date IS NULL AND di.on_hand != 0 AND di.warehouse_id = ? ORDER BY di.warehouse_id != ?, lo.seq, di.expiration, di.lot_number, di.inventory_id";
    private const NONDISPENSABLE_INSERT = 'INSERT INTO drug_sales ( uuid, drug_id, inventory_id, prescription_id, pid, encounter, user, sale_date, quantity, fee, created_by, updated_by ) VALUES ( ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    private const UUID_REGISTRY_INSERT = 'INSERT INTO `uuid_registry` (`uuid`, `table_name`, `table_id`, `table_vertical`, `couchdb`, `document_drive`, `mapped`, `created`) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())';

    protected function setUp(): void
    {
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
        $session = new Session(new MockArraySessionStorage());
        $session->set('authUser', 'pharmacist');
        $session->set('authUserID', 17);
        SessionWrapperFactory::getInstance()->setActiveSession($session);
        OEGlobalsBag::getInstance()->set('pid', 41);
        OEGlobalsBag::getInstance()->set('lastidado', 0);
        OEGlobalsBag::getInstance()->set('SELL_FROM_ONE_WAREHOUSE', false);
        OEGlobalsBag::getInstance()->set('gbl_auto_destroy_lots', false);
        OEGlobalsBag::getInstance()->set('disable_translation', true);
        OEGlobalsBag::getInstance()->set('practice_return_email_path', 'pharmacy@example.test');

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

    public function testMissingDrugInventoryCheckReturnsFalseWithoutEffects(): void
    {
        $assertFinished = $this->installDatabase([
            $this->rows(self::WAREHOUSE_SQL, ['pharmacist'], [['default_warehouse' => 'main']]),
            $this->rows(self::DRUG_SQL, [73], []),
        ]);
        $service = $this->serviceWithoutEmail();

        $warnings = [];
        $result = $this->recordMissingDrugWarnings(static fn(): mixed => $service->sellDrug(
            73, 2, 12.50, 41, 0, 0, '2026-10-24', '', '', true
        ), $warnings);
        self::assertFalse($result);
        $assertFinished();
        self::assertSame([], $warnings, 'Missing drug must not emit PHP warnings');
    }

    public function testMissingDrugSaleReturnsZeroWithoutEffects(): void
    {
        $assertFinished = $this->installDatabase([
            $this->rows(self::ENCOUNTER_SQL, [41, 82], [['count' => 1]]),
            $this->rows(self::WAREHOUSE_SQL, ['pharmacist'], [['default_warehouse' => 'main']]),
            $this->rows(self::DRUG_SQL, [73], []),
        ]);
        $service = $this->serviceWithoutEmail();

        $warnings = [];
        $result = $this->recordMissingDrugWarnings(static fn(): mixed => $service->sellDrug(
            73, 2, 12.50, 41, 82, 29, '2026-10-24'
        ), $warnings);
        self::assertSame(0, $result);
        $assertFinished();
        self::assertSame([], $warnings, 'Missing drug must not emit PHP warnings');
    }

    public function testExistingNondispensableDrugStillPassesInventoryCheck(): void
    {
        $assertFinished = $this->installDatabase([
            $this->rows(self::WAREHOUSE_SQL, ['pharmacist'], [['default_warehouse' => 'main']]),
            $this->rows(self::DRUG_SQL, [73], [$this->drugRow(0)]),
        ]);
        $service = $this->serviceWithoutEmail();

        self::assertTrue($this->withoutPhpWarnings(static fn(): mixed => $service->sellDrug(
            73, 2, 12.50, 41, 0, 0, '2026-10-24', '', '', true
        )));
        $assertFinished();
    }

    public function testExistingNondispensableDrugSaleKeepsUuidAndBoundAttribution(): void
    {
        $uuid = null;
        $assertFinished = $this->installDatabase([
            $this->rows(self::ENCOUNTER_SQL, [41, 82], [['count' => 1]]),
            $this->rows(self::WAREHOUSE_SQL, ['pharmacist'], [['default_warehouse' => 'main']]),
            $this->rows(self::DRUG_SQL, [73], [$this->drugRow(0)]),
            /**
             * @param array<mixed>|false $binds
             * @return list<array<string, mixed>>
             */
            function (string $sql, array|false $binds, bool $noLog) use (&$uuid): array {
                self::assertTrue($noLog);
                self::assertSame('SELECT `uuid` FROM `uuid_registry` WHERE `uuid` = ?', $sql);
                if ($binds === false || count($binds) !== 1 || !is_string($binds[0])) {
                    self::fail('Expected one binary UUID bind');
                }
                self::assertSame(16, strlen($binds[0]));
                $uuid = $binds[0];
                return [];
            },
            /**
             * @param array<mixed>|false $binds
             * @return list<array<string, mixed>>
             */
            function (string $sql, array|false $binds, bool $noLog) use (&$uuid): array {
                self::assertTrue($noLog);
                self::assertSame('SELECT `uuid` FROM `drug_sales` WHERE `uuid` = ?', $sql);
                self::assertSame([$uuid], $binds);
                return [];
            },
            /**
             * @param array<mixed>|false $binds
             * @return list<array<string, mixed>>
             */
            function (string $sql, array|false $binds, bool $noLog) use (&$uuid): array {
                self::assertFalse($noLog);
                self::assertSame(self::UUID_REGISTRY_INSERT, $sql);
                self::assertSame([$uuid, 'drug_sales', 'sale_id', '', '', 0, 0], $binds);
                return [];
            },
            /**
             * @param array<mixed>|false $binds
             * @return list<array<string, mixed>>
             */
            function (string $sql, array|false $binds, bool $noLog) use (&$uuid): array {
                self::assertFalse($noLog);
                self::assertSame(self::NONDISPENSABLE_INSERT, $sql);
                self::assertSame([$uuid, 73, 29, 41, 82, 'pharmacist', '2026-10-24', 2, 12.50, 17, 17], $binds);
                OEGlobalsBag::getInstance()->set('lastidado', 915);
                return [];
            },
        ]);
        $service = $this->serviceWithoutEmail();

        self::assertSame(915, $this->withoutPhpWarnings(static fn(): mixed => $service->sellDrug(
            73, 2, 12.50, 41, 82, 29, '2026-10-24'
        )));
        $assertFinished();
    }

    public function testDispensableDrugWithoutStockFailsInventoryCheckWithBoundWarehouse(): void
    {
        OEGlobalsBag::getInstance()->set('SELL_FROM_ONE_WAREHOUSE', true);
        $warehouse = "main' OR 1=1 --";
        $assertFinished = $this->installDatabase([
            $this->rows(self::DRUG_SQL, [73], [$this->drugRow(1)]),
            $this->rows(self::SINGLE_WAREHOUSE_INVENTORY_SQL, [73, $warehouse, $warehouse], []),
        ]);
        $service = $this->serviceWithoutEmail();

        self::assertFalse($this->withoutPhpWarnings(static fn(): mixed => $service->sellDrug(
            73, 2, 12.50, 41, 0, 0, '2026-10-24', '', $warehouse, true
        )));
        $assertFinished();
    }

    public function testDispensableDrugWithoutStockReturnsZeroBeforeWrites(): void
    {
        $assertFinished = $this->installDatabase([
            $this->rows(self::ENCOUNTER_SQL, [41, 82], [['count' => 1]]),
            $this->rows(self::WAREHOUSE_SQL, ['pharmacist'], [['default_warehouse' => 'main']]),
            $this->rows(self::DRUG_SQL, [73], [$this->drugRow(1)]),
            $this->rows(self::INVENTORY_SQL, [73, 'main'], []),
        ]);
        $service = $this->serviceWithoutEmail();

        self::assertSame(0, $this->withoutPhpWarnings(static fn(): mixed => $service->sellDrug(
            73, 2, 12.50, 41, 82, 29, '2026-10-24'
        )));
        $assertFinished();
    }

    public function testDispensableDrugWithUsableStockPassesInventoryCheckWithoutWrites(): void
    {
        $assertFinished = $this->installDatabase([
            $this->rows(self::WAREHOUSE_SQL, ['pharmacist'], [['default_warehouse' => 'main']]),
            $this->rows(self::DRUG_SQL, [73], [$this->drugRow(1)]),
            $this->rows(self::INVENTORY_SQL, [73, 'main'], [[
                'inventory_id' => 501,
                'warehouse_id' => 'main',
                'seq' => 1,
                'on_hand' => 3,
                'expiration' => '2027-12-31',
                'lot_number' => 'LOT-1',
            ]]),
        ]);
        $service = $this->serviceWithoutEmail();

        self::assertTrue($this->withoutPhpWarnings(static fn(): mixed => $service->sellDrug(
            73, 2, 12.50, 41, 0, 0, '2026-10-24', '', '', true
        )));
        $assertFinished();
    }

    public function testMissingEncounterStopsBeforeProductLookup(): void
    {
        $assertFinished = $this->installDatabase([]);
        $service = $this->serviceWithoutEmail();

        $this->expectException(\InvalidArgumentException::class);
        try {
            $this->withoutPhpWarnings(static fn(): mixed => $service->sellDrug(73, 2, 12.50, 41, 0, 29, '2026-10-24'));
        } finally {
            $assertFinished();
        }
    }

    public function testMismatchedPatientStopsBeforeProductLookup(): void
    {
        $assertFinished = $this->installDatabase([
            $this->rows(self::ENCOUNTER_SQL, [41, 82], [['count' => 0]]),
        ]);
        $logger = $this->createMock(\Psr\Log\LoggerInterface::class);
        $logger->expects(self::once())->method('error')->with(
            'Drug dispensing error: Encounter does not exist or does not belong to patient',
            ['patient_id' => 41, 'encounter_id' => 82]
        );
        $service = $this->getMockBuilder(DrugSalesService::class)
            ->disableOriginalConstructor()->onlyMethods(['getLogger', 'send_drug_email'])->getMock();
        $service->method('getLogger')->willReturn($logger);
        $service->expects(self::never())->method('send_drug_email');

        $this->expectException(\Exception::class);
        try {
            $this->withoutPhpWarnings(static fn(): mixed => $service->sellDrug(73, 2, 12.50, 41, 82, 29, '2026-10-24'));
        } finally {
            $assertFinished();
        }
    }

    public function testProductSqlFailurePropagates(): void
    {
        $assertFinished = $this->installDatabase([
            $this->rows(self::WAREHOUSE_SQL, ['pharmacist'], [['default_warehouse' => 'main']]),
            $this->rows(self::DRUG_SQL, [73], false),
        ]);
        OEGlobalsBag::getInstance()->set('last_mysql_error', 'synthetic drug lookup failure');
        $service = $this->serviceWithoutEmail();

        try {
            $this->withoutPhpWarnings(static fn(): mixed => $service->sellDrug(
                73, 2, 12.50, 41, 0, 0, '2026-10-24', '', '', true
            ));
            self::fail('Expected SQL failure');
        } catch (SqlQueryException $e) {
            self::assertSame(self::DRUG_SQL, $e->getSqlStatement());
        }
        $assertFinished();
    }

    /** @return array{allow_combining: int, reorder_point: int, name: string, dispensable: int} */
    private function drugRow(int $dispensable): array
    {
        return ['allow_combining' => 0, 'reorder_point' => 0, 'name' => 'Existing product', 'dispensable' => $dispensable];
    }

    private function serviceWithoutEmail(): DrugSalesService
    {
        $service = $this->getMockBuilder(DrugSalesService::class)
            ->disableOriginalConstructor()->onlyMethods(['send_drug_email'])->getMock();
        $service->expects(self::never())->method('send_drug_email');
        return $service;
    }

    /**
     * @param list<mixed> $binds
     * @param list<array<string, mixed>>|false $rows
     * @return \Closure(string, array<mixed>|false, bool): (list<array<string, mixed>>|false)
     */
    private function rows(string $expectedSql, array $binds, array|false $rows): \Closure
    {
        /**
         * @param array<mixed>|false $actualBinds
         * @return list<array<string, mixed>>|false
         */
        return static function (string $sql, array|false $actualBinds, bool $noLog) use ($expectedSql, $binds, $rows): array|false {
            self::assertFalse($noLog);
            self::assertSame($expectedSql, $sql);
            self::assertSame($binds, $actualBinds);
            return $rows;
        };
    }

    /**
     * Each expected operation consumes one response. Unexpected SQL, including
     * any inventory, UUID, or sale write, fails at the transport boundary.
     *
     * @param list<\Closure(string, array<mixed>|false, bool): (list<array<string, mixed>>|false)> $operations
     * @return \Closure(): void
     */
    private function installDatabase(array $operations): \Closure
    {
        $transport = $this->getMockBuilder(\ADODB_mysqli_log::class)
            ->disableOriginalConstructor()->onlyMethods(['Execute', 'ExecuteNoLog'])->getMock();
        /** @var \Closure(string, array<mixed>|false, bool): (\ADORecordSet_mysqli|false) $execute */
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

    /** @param callable(): mixed $action */
    private function withoutPhpWarnings(callable $action): mixed
    {
        set_error_handler(static function (int $severity, string $message): never {
            throw new \ErrorException($message, 0, $severity);
        });
        try {
            return $action();
        } finally {
            restore_error_handler();
        }
    }

    /**
     * @param callable(): mixed $action
     * @param list<string> $warnings
     */
    private function recordMissingDrugWarnings(callable $action, array &$warnings): mixed
    {
        set_error_handler(static function (int $severity, string $message) use (&$warnings): bool {
            if ($severity === E_WARNING && (
                $message === 'Undefined array key 0'
                || $message === 'Trying to access array offset on value of type null'
                || $message === 'Trying to access array offset on null'
            )) {
                $warnings[] = $message;
                return true;
            }
            throw new \ErrorException($message, 0, $severity);
        });
        try {
            return $action();
        } finally {
            restore_error_handler();
        }
    }
}
