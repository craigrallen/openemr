<?php

/** Regression coverage for employer history inserts without a database or session I/O. */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Common\Uuid\UuidRegistry;
use OpenEMR\Services\BaseService;
use OpenEMR\Services\EmployerService;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionProperty;
use Symfony\Component\HttpFoundation\Session\SessionInterface;

/** Only the database boundary is replaced; both service methods remain native. */
final class EmployerHistoryQueryRecorder
{
    /** @var list<array<string, mixed>> */
    public static array $rows = [];
    /** @var list<array{string, list<mixed>}> */
    public static array $reads = [];
    /** @var list<array{string, list<mixed>}> */
    public static array $writes = [];

    /** @param list<mixed> $binds
     *  @return list<array<string, mixed>>
     */
    public static function fetchRecords(string $sql, array $binds = [], bool $noLog = false): array
    {
        self::$reads[] = [$sql, $binds];
        return self::$rows;
    }

    /** @param list<mixed> $binds */
    public static function sqlInsert(string $sql, array $binds = []): int
    {
        self::$writes[] = [$sql, $binds];
        return 314;
    }
}

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class EmployerMissingHistoryTest extends TestCase
{
    private const SELECT_SQL = 'select * from employer_data where pid = ? order by date DESC limit 0,1';
    private const UUID = 'synthetic-uuid-16';

    protected function setUp(): void
    {
        self::assertFalse(class_exists(QueryUtils::class, false));
        self::assertTrue(class_alias(EmployerHistoryQueryRecorder::class, QueryUtils::class));
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
        EmployerHistoryQueryRecorder::$rows = [];
        EmployerHistoryQueryRecorder::$reads = [];
        EmployerHistoryQueryRecorder::$writes = [];

        $session = $this->createMock(SessionInterface::class);
        $session->method('get')->with('authUserID')->willReturn(73);
        $factory = new SessionWrapperFactory('/synthetic-test');
        $factory->setActiveSession($session);
        $instances = new ReflectionProperty(SessionWrapperFactory::class, 'instances');
        $instances->setValue(null, [SessionWrapperFactory::class => $factory]);
    }

    private function service(): EmployerService
    {
        $service = (new ReflectionClass(EmployerService::class))->newInstanceWithoutConstructor();
        $schema = [
            'id', 'uuid', 'name', 'street', 'street_line_2', 'postal_code',
            'city', 'state', 'country', 'date', 'pid', 'start_date', 'end_date',
            'occupation', 'industry', 'created_by',
        ];
        (new ReflectionProperty(BaseService::class, 'fields'))->setValue($service, $schema);
        (new ReflectionProperty(BaseService::class, 'autoIncrements'))->setValue($service, [['Field' => 'id']]);

        $uuids = $this->createMock(UuidRegistry::class);
        $uuids->expects($this->once())->method('createUuid')->willReturn(self::UUID);
        $service->setUuidRegistry($uuids);
        return $service;
    }

    /** @return array<array-key, mixed> */
    private function oneInsert(): array
    {
        self::assertCount(1, EmployerHistoryQueryRecorder::$writes);
        [$sql, $binds] = EmployerHistoryQueryRecorder::$writes[0];
        self::assertStringStartsWith('INSERT INTO employer_data SET ', $sql);
        self::assertStringEndsWith(', `date` = NOW()', $sql);
        preg_match_all('/`([a-z_0-9]+)` = \?/', $sql, $matches);
        $columns = $matches[1];
        self::assertCount(count($columns), $binds);
        self::assertNotContains('date', $columns);
        self::assertNotContains('id', $columns);
        $values = array_combine($columns, $binds);
        self::assertIsArray($values);
        return $values;
    }

    public function testMissingHistoryRetainsSubmittedEmployerAndServerBindings(): void
    {
        $service = $this->service();
        self::assertSame(314, $service->updateEmployerData(501, [
            'name' => 'Acme Clinic',
            'street' => '12 Test Lane',
            'street_line_2' => 'Suite 4',
            'postal_code' => '12345',
            'city' => 'Testville',
            'pid' => 999,
            'created_by' => 888,
            'uuid' => 'hostile-uuid',
            'date' => '1999-01-01',
            'unknown_column' => 'must be filtered by BaseService',
        ], false));

        self::assertSame([[self::SELECT_SQL, [501]]], EmployerHistoryQueryRecorder::$reads);
        self::assertSame([
            'name' => 'Acme Clinic', 'street' => '12 Test Lane',
            'street_line_2' => 'Suite 4', 'postal_code' => '12345',
            'city' => 'Testville', 'pid' => 501, 'created_by' => 73,
            'uuid' => self::UUID,
        ], $this->oneInsert());
    }

    public function testMissingHistoryUsesPatientOccupationAndIndustryIncludingEmptyOverrides(): void
    {
        $service = $this->service();
        self::assertSame(314, $service->updateEmployerData(502, [
            'name' => 'Example Employer', 'occupation' => 'hostile occupation',
            'industry' => 'hostile industry',
        ], false, ['occupation' => '', 'industry' => 'care']));

        self::assertSame([[self::SELECT_SQL, [502]]], EmployerHistoryQueryRecorder::$reads);
        self::assertSame([
            'name' => 'Example Employer', 'occupation' => '', 'industry' => 'care',
            'pid' => 502, 'created_by' => 73, 'uuid' => self::UUID,
        ], $this->oneInsert());
    }

    public function testExistingHistoryKeepsOriginalFieldFilteringAndLegacyEmptyValues(): void
    {
        EmployerHistoryQueryRecorder::$rows = [[
            'id' => 9, 'name' => 'Old name', 'street' => 'Old street',
            'pid' => 501, 'created_by' => 17, 'date' => '2020-01-01',
            'uuid' => 'old-uuid',
        ]];
        $service = $this->service();
        self::assertSame(314, $service->updateEmployerData(501, [
            'name' => '0', 'street' => null, 'city' => 'new-only field',
            'pid' => 999, 'created_by' => 888, 'date' => '1999-01-01',
            'uuid' => 'hostile-uuid',
        ], false));

        self::assertSame([[self::SELECT_SQL, [501]]], EmployerHistoryQueryRecorder::$reads);
        self::assertSame([
            'name' => '', 'street' => '', 'pid' => 501,
            'created_by' => 73, 'uuid' => self::UUID,
        ], $this->oneInsert());
    }

    public function testCreateSkipsHistoryReadAndKeepsInsertContract(): void
    {
        $service = $this->service();
        self::assertSame(314, $service->updateEmployerData(503, [
            'name' => 'New employer', 'pid' => 999, 'created_by' => 888,
            'date' => '1999-01-01', 'uuid' => 'hostile-uuid',
            'unknown_column' => 'discard',
        ], true));

        self::assertSame([], EmployerHistoryQueryRecorder::$reads);
        self::assertSame([
            'name' => 'New employer', 'pid' => 503,
            'created_by' => 73, 'uuid' => self::UUID,
        ], $this->oneInsert());
    }

    public function testMostRecentReturnsFalseForNativeNoRowResult(): void
    {
        $service = (new ReflectionClass(EmployerService::class))->newInstanceWithoutConstructor();
        self::assertFalse($service->getMostRecentEmployerData(504));
        self::assertSame([[self::SELECT_SQL, [504]]], EmployerHistoryQueryRecorder::$reads);
        self::assertSame([], EmployerHistoryQueryRecorder::$writes);
    }
}
