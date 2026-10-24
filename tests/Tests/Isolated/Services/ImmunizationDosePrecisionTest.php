<?php

/**
 * Regression coverage for immunization result serialization.
 *
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Services\ImmunizationService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class ImmunizationDosePrecisionTest extends TestCase
{
    protected function setUp(): void
    {
        // Loading BaseService includes code_types.inc.php; skip its database query.
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
    }

    private function service(): ImmunizationService
    {
        // The constructor initializes UUIDs in the database. Serialization needs none of it.
        return (new ReflectionClass(ImmunizationService::class))->newInstanceWithoutConstructor();
    }

    /** @return array<string, array{int|float|string, float}> */
    public static function numericDoses(): array
    {
        return [
            'float half' => [0.5, 0.5],
            'string half' => ['0.5', 0.5],
            'float one and a quarter' => [1.25, 1.25],
            'string one and a quarter' => ['1.25', 1.25],
            'float three quarters' => [0.75, 0.75],
            'string one eighth' => ['0.125', 0.125],
            'float one tenth' => [0.1, 0.1],
            'string one tenth' => ['0.1', 0.1],
            'scientific numeric string' => ['1e-3', 0.001],
            'whole integer' => [2, 2.0],
            'whole numeric string' => ['2', 2.0],
            'zero integer' => [0, 0.0],
            'zero numeric string' => ['0', 0.0],
        ];
    }

    #[DataProvider('numericDoses')]
    public function testStoredNumericDoseRetainsItsValueAndUnit(int|float|string $dose, float $expected): void
    {
        $row = [
            'primarySource' => '1',
            'amount_administered' => $dose,
            'amount_administered_unit' => 'mL',
            'lot_number' => 'synthetic-lot',
        ];
        $original = $row;

        $result = $this->service()->createResultRecordFromDatabaseResult($row);

        self::assertIsFloat($result['amount_administered']);
        if ($expected === 0.1 || $expected === 0.001) {
            self::assertEqualsWithDelta($expected, $result['amount_administered'], 0.0000001);
        } else {
            self::assertEquals($expected, $result['amount_administered']);
        }
        self::assertSame('mL', $result['amount_administered_unit']);
        self::assertSame('synthetic-lot', $result['lot_number']);
        self::assertSame($original, $row);
    }

    public function testParentConvertsAllSixBinaryUuidsAndServiceConvertsDates(): void
    {
        $uuids = [
            'uuid' => '00000000-0000-4000-8000-000000000001',
            'puuid' => '00000000-0000-4000-8000-000000000002',
            'provider_uuid' => '00000000-0000-4000-8000-000000000003',
            'euuid' => '00000000-0000-4000-8000-000000000004',
            'facility_uuid' => '00000000-0000-4000-8000-000000000005',
            'facility_location_uuid' => '00000000-0000-4000-8000-000000000006',
        ];
        $row = [
            'primarySource' => '1',
            'amount_administered' => 0.5,
            'amount_administered_unit' => 'mL',
            'create_date' => '2026-01-02 03:04:05',
            'administered_date' => '2026-01-03 04:05:06',
            'expiration_date' => '2027-02-04',
            'education_date' => '2026-01-01',
        ];
        foreach ($uuids as $field => $uuid) {
            $row[$field] = pack('H*', str_replace('-', '', $uuid));
        }
        $original = $row;
        $timezone = date_default_timezone_get();
        date_default_timezone_set('UTC');
        try {
            $result = $this->service()->createResultRecordFromDatabaseResult($row);
        } finally {
            date_default_timezone_set($timezone);
        }

        foreach ($uuids as $field => $uuid) {
            self::assertSame($uuid, $result[$field]);
        }
        self::assertSame('2026-01-02T03:04:05+00:00', $result['create_date']);
        self::assertSame('2026-01-03T04:05:06+00:00', $result['administered_date']);
        self::assertSame('2027-02-04T00:00:00+00:00', $result['expiration_date']);
        self::assertSame('2026-01-01T00:00:00+00:00', $result['education_date']);
        self::assertTrue($result['primarySource']);
        self::assertIsFloat($result['amount_administered']);
        self::assertSame(0.5, $result['amount_administered']);
        self::assertSame('mL', $result['amount_administered_unit']);
        self::assertSame($original, $row);
    }

    /** @return array<string, array{int|string|null, bool}> */
    public static function primarySources(): array
    {
        return [
            'string one' => ['1', true],
            'string zero' => ['0', false],
            'integer one is not exact string' => [1, false],
            'null' => [null, false],
        ];
    }

    #[DataProvider('primarySources')]
    public function testPrimarySourceUsesExistingExactStringComparison(int|string|null $source, bool $expected): void
    {
        $result = $this->service()->createResultRecordFromDatabaseResult([
            'primarySource' => $source,
            'amount_administered' => 1,
        ]);

        self::assertSame($expected, $result['primarySource']);
    }

    public function testPresentNullDoseRetainsNumericZeroValue(): void
    {
        $result = $this->service()->createResultRecordFromDatabaseResult([
            'primarySource' => '1',
            'amount_administered' => null,
        ]);

        self::assertEquals(0, $result['amount_administered']);
        self::assertSame(0.0, $result['amount_administered']);
    }

    public function testAbsentDoseWarnsAndRetainsNumericZeroValue(): void
    {
        $service = $this->service();
        $warnings = [];
        set_error_handler(static function (int $severity, string $message) use (&$warnings): bool {
            $warnings[] = [$severity, $message];
            return true;
        });
        try {
            $result = $service->createResultRecordFromDatabaseResult(['primarySource' => '1']);
        } finally {
            restore_error_handler();
        }

        self::assertCount(1, $warnings);
        self::assertSame(E_WARNING, $warnings[0][0]);
        self::assertMatchesRegularExpression('/\bUndefined array key\b/i', $warnings[0][1]);
        self::assertStringContainsString('amount_administered', $warnings[0][1]);
        self::assertEquals(0, $result['amount_administered']);
        self::assertSame(0.0, $result['amount_administered']);
    }
}
