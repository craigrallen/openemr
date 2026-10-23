<?php

/**
 * Isolated regression coverage for calculated vital source lineage grouping.
 *
 * @package   OpenEMR
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Common\Uuid\UuidRegistry;
use OpenEMR\Services\VitalsCalculatedService;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class CalculatedVitalsSourceReadTest extends TestCase
{
    private const CALCULATION_A = '10000000-0000-4000-8000-000000000001';
    private const CALCULATION_B = '10000000-0000-4000-8000-000000000002';
    private const SOURCE_A = '20000000-0000-4000-8000-000000000001';
    private const SOURCE_B = '20000000-0000-4000-8000-000000000002';
    private const SOURCE_C = '20000000-0000-4000-8000-000000000003';
    private const PATIENT = '30000000-0000-4000-8000-000000000001';
    private const ENCOUNTER = '40000000-0000-4000-8000-000000000001';
    private const CREATOR = '50000000-0000-4000-8000-000000000001';
    private const UPDATER = '60000000-0000-4000-8000-000000000001';

    public static function setUpBeforeClass(): void
    {
        // BaseService loads code_types.inc.php at class load. Keep its database
        // branch disabled before autoloading the service in this child process.
        $_SESSION = [];
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
    }

    /**
     * @param list<array<string, mixed>> $rows
     * @return list<array<string, mixed>>
     */
    private function group(array $rows): array
    {
        $method = new ReflectionMethod(VitalsCalculatedService::class, 'groupCalculationRecords');
        self::assertSame(VitalsCalculatedService::class, $method->getDeclaringClass()->getName());
        $file = $method->getDeclaringClass()->getFileName();
        self::assertIsString($file);
        self::assertSame(
            realpath(dirname(__DIR__, 4) . '/src/Services/VitalsCalculatedService.php'),
            realpath($file)
        );

        $service = (new ReflectionClass(VitalsCalculatedService::class))->newInstanceWithoutConstructor();
        $actual = $method->invoke($service, $rows);
        self::assertIsArray($actual);
        self::assertTrue(array_is_list($actual));
        foreach ($actual as $record) {
            self::assertIsArray($record);
            foreach (array_keys($record) as $key) {
                self::assertIsString($key);
            }
            self::assertArrayHasKey('parent_observation_uuid', $record);
            self::assertIsArray($record['parent_observation_uuid']);
            self::assertTrue(array_is_list($record['parent_observation_uuid']));
            foreach ($record['parent_observation_uuid'] as $source) {
                self::assertIsString($source);
            }
            self::assertArrayHasKey('components', $record);
            self::assertIsArray($record['components']);
            self::assertTrue(array_is_list($record['components']));
            foreach ($record['components'] as $component) {
                self::assertIsArray($component);
            }
        }

        /** @var list<array<string, mixed>> $actual */
        return $actual;
    }

    /** @return array<string, mixed> */
    private static function row(
        string $calculationUuid,
        ?string $sourceUuid,
        ?string $column,
        string $value,
        int $componentOrder
    ): array {
        return [
            'uuid' => UuidRegistry::uuidToBytes($calculationUuid),
            'date_start' => '2026-10-20 08:00:00',
            'date_end' => '2026-10-20 08:30:00',
            'created_at' => '2026-10-20 09:00:00',
            'last_updated' => '2026-10-21 10:00:00',
            'created_by' => '17',
            'created_by_uuid' => UuidRegistry::uuidToBytes(self::CREATOR),
            'updated_by' => '18',
            'updated_by_uuid' => UuidRegistry::uuidToBytes(self::UPDATER),
            'calculation_id' => $calculationUuid === self::CALCULATION_A ? 'bp-Mean3Day' : 'bp-MeanLast5',
            'encounter' => '41',
            'euuid' => UuidRegistry::uuidToBytes(self::ENCOUNTER),
            'pid' => '42',
            'puuid' => UuidRegistry::uuidToBytes(self::PATIENT),
            'source_vital_uuid' => $sourceUuid === null || $sourceUuid === ''
                ? $sourceUuid
                : UuidRegistry::uuidToBytes($sourceUuid),
            'vitals_column' => $column,
            'value' => $value,
            'value_string' => null,
            'value_unit' => 'mm[Hg]',
            'component_order' => (string) $componentOrder,
        ];
    }

    public function testInterleavedJoinRowsKeepSourceLineageAndComponentsPerCalculation(): void
    {
        $rows = [
            self::row(self::CALCULATION_A, null, 'bps', '121', 2),
            self::row(self::CALCULATION_B, self::SOURCE_C, 'bps', '130', 2),
            self::row(self::CALCULATION_A, self::SOURCE_A, 'bpd', '81', 1),
            self::row(self::CALCULATION_B, null, 'bpd', '85', 1),
            self::row(self::CALCULATION_A, '', 'bps', '121', 2),
            self::row(self::CALCULATION_A, self::SOURCE_B, 'bps', '121', 2),
            self::row(self::CALCULATION_B, self::SOURCE_C, 'bps', '130', 2),
            self::row(self::CALCULATION_A, self::SOURCE_A, 'bpd', '81', 1),
            self::row(self::CALCULATION_B, self::SOURCE_B, 'bpd', '85', 1),
            self::row(self::CALCULATION_A, null, null, '', 0),
        ];

        $actual = $this->group($rows);
        self::assertCount(2, $actual);
        $expectedFirst = [
            'uuid' => self::CALCULATION_A,
            'date_start' => '2026-10-20 08:00:00',
            'date_end' => '2026-10-20 08:30:00',
            'created_at' => '2026-10-20 09:00:00',
            'updated_at' => '2026-10-21 10:00:00',
            'created_by' => '17',
            'created_by_uuid' => self::CREATOR,
            'updated_by' => '18',
            'updated_by_uuid' => self::UPDATER,
            'calculation_id' => 'bp-Mean3Day',
            'encounter' => '41',
            'euuid' => self::ENCOUNTER,
            'pid' => '42',
            'puuid' => self::PATIENT,
            'parent_observation_uuid' => [self::SOURCE_A, self::SOURCE_B],
            'components' => [
                ['vitals_column' => 'bpd', 'value' => 81.0, 'value_string' => null, 'value_unit' => 'mm[Hg]', 'component_order' => 1],
                ['vitals_column' => 'bps', 'value' => 121.0, 'value_string' => null, 'value_unit' => 'mm[Hg]', 'component_order' => 2],
            ],
        ];
        self::assertSame($expectedFirst, $actual[0]);

        $expectedSecond = $expectedFirst;
        $expectedSecond['uuid'] = self::CALCULATION_B;
        $expectedSecond['calculation_id'] = 'bp-MeanLast5';
        $expectedSecond['parent_observation_uuid'] = [self::SOURCE_C, self::SOURCE_B];
        $expectedSecond['components'] = [
            ['vitals_column' => 'bpd', 'value' => 85.0, 'value_string' => null, 'value_unit' => 'mm[Hg]', 'component_order' => 1],
            ['vitals_column' => 'bps', 'value' => 130.0, 'value_string' => null, 'value_unit' => 'mm[Hg]', 'component_order' => 2],
        ];
        self::assertSame($expectedSecond, $actual[1]);
    }

    public function testEntirelySourceLessCalculationDoesNotInheritInterleavedSources(): void
    {
        $missingSourceRow = self::row(self::CALCULATION_A, null, 'bps', '121', 2);
        unset($missingSourceRow['source_vital_uuid']);

        $rows = [
            self::row(self::CALCULATION_A, null, 'bps', '121', 2),
            self::row(self::CALCULATION_B, self::SOURCE_C, 'bps', '130', 2),
            self::row(self::CALCULATION_A, '', 'bpd', '81', 1),
            self::row(self::CALCULATION_B, self::SOURCE_B, 'bpd', '85', 1),
            $missingSourceRow,
        ];

        $actual = $this->group($rows);
        self::assertCount(2, $actual);
        $expectedSourceLess = [
            'uuid' => self::CALCULATION_A,
            'date_start' => '2026-10-20 08:00:00',
            'date_end' => '2026-10-20 08:30:00',
            'created_at' => '2026-10-20 09:00:00',
            'updated_at' => '2026-10-21 10:00:00',
            'created_by' => '17',
            'created_by_uuid' => self::CREATOR,
            'updated_by' => '18',
            'updated_by_uuid' => self::UPDATER,
            'calculation_id' => 'bp-Mean3Day',
            'encounter' => '41',
            'euuid' => self::ENCOUNTER,
            'pid' => '42',
            'puuid' => self::PATIENT,
            'parent_observation_uuid' => [],
            'components' => [
                ['vitals_column' => 'bpd', 'value' => 81.0, 'value_string' => null, 'value_unit' => 'mm[Hg]', 'component_order' => 1],
                ['vitals_column' => 'bps', 'value' => 121.0, 'value_string' => null, 'value_unit' => 'mm[Hg]', 'component_order' => 2],
            ],
        ];
        self::assertSame($expectedSourceLess, $actual[0]);

        $expectedSourced = $expectedSourceLess;
        $expectedSourced['uuid'] = self::CALCULATION_B;
        $expectedSourced['calculation_id'] = 'bp-MeanLast5';
        $expectedSourced['parent_observation_uuid'] = [self::SOURCE_C, self::SOURCE_B];
        $expectedSourced['components'] = [
            ['vitals_column' => 'bpd', 'value' => 85.0, 'value_string' => null, 'value_unit' => 'mm[Hg]', 'component_order' => 1],
            ['vitals_column' => 'bps', 'value' => 130.0, 'value_string' => null, 'value_unit' => 'mm[Hg]', 'component_order' => 2],
        ];
        self::assertSame($expectedSourced, $actual[1]);
    }

    public function testEmptyRowsProduceNoCalculatedRecords(): void
    {
        self::assertSame([], $this->group([]));
    }
}
