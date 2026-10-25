<?php

/** Regression coverage for laboratory result precision in the native QDM service. */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services\Qdm;

use OpenEMR\Cqm\Qdm\BaseTypes\Code;
use OpenEMR\Cqm\Qdm\BaseTypes\DateTime;
use OpenEMR\Cqm\Qdm\BaseTypes\Interval;
use OpenEMR\Cqm\Qdm\BaseTypes\Quantity;
use OpenEMR\Services\CodeTypesService;
use OpenEMR\Services\Qdm\Interfaces\QdmRequestInterface;
use OpenEMR\Services\Qdm\QdmRecord;
use OpenEMR\Services\Qdm\Services\LaboratoryTestService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class LaboratoryResultPrecisionTest extends TestCase
{
    protected function setUp(): void
    {
        // If an external loader reaches BaseService, its code-types include must
        // not issue its top-level database read. Keep this constant in the child.
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }

        $source = realpath(__DIR__ . '/../../../../../src/Services/Qdm/Services/LaboratoryTestService.php');
        self::assertIsString($source);
        self::assertSame($source, (new ReflectionClass(LaboratoryTestService::class))->getFileName());
    }

    /**
     * @param list<array{string, bool}> $expectedLookups
     */
    private function service(array $expectedLookups = [['LOINC', true]]): LaboratoryTestService
    {
        $request = $this->createMock(QdmRequestInterface::class);
        $request->expects($this->never())->method('getFilter');

        $codeTypes = $this->getMockBuilder(CodeTypesService::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getSystemForCodeType'])
            ->getMock();
        $index = 0;
        $codeTypes->expects($this->exactly(count($expectedLookups)))
            ->method('getSystemForCodeType')
            ->willReturnCallback(function (string $type, bool $useOid) use ($expectedLookups, &$index): string {
                self::assertArrayHasKey($index, $expectedLookups);
                self::assertSame($expectedLookups[$index++], [$type, $useOid]);
                return match ($type) {
                    'LOINC' => '2.16.840.1.113883.6.1',
                    'SNOMED-CT' => '2.16.840.1.113883.6.96',
                };
            });

        return new LaboratoryTestService($request, $codeTypes);
    }

    /** @return array<string, mixed> */
    private static function row(): array
    {
        return [
            'result' => 1.75,
            'units' => 'mg/dL',
            'date' => '2026-01-02 03:04:05',
            'date_end' => '2026-01-02 04:05:06',
            'procedure_code' => 'LOINC:1234-5',
        ];
    }

    /**
     * @param array<string, mixed> $row
     */
    private static function record(array $row): QdmRecord
    {
        return new QdmRecord($row, 42, 1);
    }

    /** @return array<string, array{int|float|string, int|float}> */
    public static function numericResults(): array
    {
        return [
            'fraction' => [1.75, 1.75],
            'small fraction' => [0.25, 0.25],
            'negative fraction' => [-2.75, -2.75],
            'fraction string' => ['1.75', 1.75],
            'small fraction string' => ['0.25', 0.25],
            'negative fraction string' => ['-2.75', -2.75],
            'whitespace numeric string' => [' 1.75 ', 1.75],
            'scientific numeric string' => ['2.5e-1', 0.25],
            'whole number' => [2, 2],
            'whole number string' => ['2', 2],
            'legacy nonnumeric prefix cast' => ['1.5 mg', 1],
            'case-sensitive Negative sentinel' => ['negative', 0],
        ];
    }

    #[DataProvider('numericResults')]
    public function testNumericResultKeepsItsValueAndUnit(int|float|string $input, int|float $expected): void
    {
        $row = self::row();
        $row['result'] = $input;
        $record = self::record($row);

        $model = $this->service()->makeQdmModel($record);
        $result = $model->result;

        self::assertInstanceOf(Quantity::class, $result);
        self::assertEquals($expected, $result->value);
        self::assertSame('mg/dL', $result->unit);
        self::assertSame($row, $record->getData());
    }

    /** @return array<string, array{bool|int|string|null, bool}> */
    public static function emptyResults(): array
    {
        return [
            'empty string' => ['', true],
            'null' => [null, true],
            'false' => [false, true],
            'integer zero' => [0, true],
            'string zero' => ['0', true],
            'missing key' => [null, false],
        ];
    }

    #[DataProvider('emptyResults')]
    public function testEmptyResultRetainsNegativeSentinel(bool|int|string|null $input, bool $present): void
    {
        $row = self::row();
        if ($present) {
            $row['result'] = $input;
        } else {
            unset($row['result']);
        }
        $record = self::record($row);

        $model = $this->service()->makeQdmModel($record);

        self::assertSame('Negative', $model->result);
        self::assertSame($row, $record->getData());
    }

    public function testExactNegativeUsesSnomedCode(): void
    {
        $row = self::row();
        $row['result'] = 'Negative';
        $record = self::record($row);

        $model = $this->service([['SNOMED-CT', true], ['LOINC', true]])->makeQdmModel($record);
        $result = $model->result;

        self::assertInstanceOf(Code::class, $result);
        self::assertSame('260385009', $result->code);
        self::assertSame('2.16.840.1.113883.6.96', $result->system);
        self::assertSame($row, $record->getData());
    }

    /** @return array<string, array{string, string|null, bool}> */
    public static function dateEnds(): array
    {
        return [
            'valid end' => ['2026-01-02 04:05:06', '2026-01-02 04:05:06', true],
            'empty end' => ['', null, false],
            'zero date end' => ['0000-00-00 00:00:00', '0000-00-00 00:00:00', false],
        ];
    }

    #[DataProvider('dateEnds')]
    public function testNativeDatesPeriodAndProcedureCodes(string $end, ?string $expectedHigh, bool $highClosed): void
    {
        $row = self::row();
        $row['date_end'] = $end;
        $row['procedure_code'] = 'LOINC:1234-5;SNOMED-CT:67890';
        $record = self::record($row);

        $model = $this->service([['LOINC', true], ['SNOMED-CT', true]])->makeQdmModel($record);

        self::assertInstanceOf(DateTime::class, $model->relevantDatetime);
        self::assertSame($row['date'], $model->relevantDatetime->date);
        self::assertInstanceOf(DateTime::class, $model->resultDatetime);
        self::assertSame($row['date'], $model->resultDatetime->date);
        self::assertInstanceOf(Interval::class, $model->relevantPeriod);
        self::assertInstanceOf(DateTime::class, $model->relevantPeriod->low);
        self::assertSame($row['date'], $model->relevantPeriod->low->date);
        self::assertInstanceOf(DateTime::class, $model->relevantPeriod->high);
        self::assertSame($expectedHigh, $model->relevantPeriod->high->date);
        self::assertTrue($model->relevantPeriod->lowClosed);
        self::assertSame($highClosed, $model->relevantPeriod->highClosed);
        self::assertCount(2, $model->dataElementCodes);
        self::assertSame('1234-5', $model->dataElementCodes[0]->code);
        self::assertSame('2.16.840.1.113883.6.1', $model->dataElementCodes[0]->system);
        self::assertSame('67890', $model->dataElementCodes[1]->code);
        self::assertSame('2.16.840.1.113883.6.96', $model->dataElementCodes[1]->system);
        self::assertSame($row, $record->getData());
    }

    public function testPatientColumnAndQuerySourceRemainAvailableWithoutExecutingSql(): void
    {
        $service = $this->service([]);

        self::assertSame('O.patient_id', $service->getPatientIdColumn());
        $sql = $service->getSqlStatement();
        self::assertStringContainsString('O.patient_id AS pid', $sql);
        self::assertStringContainsString('RES.result', $sql);
        self::assertStringContainsString('RES.units', $sql);
        self::assertStringContainsString('RES.date_end', $sql);
        self::assertStringContainsString("O.procedure_order_type = 'laboratory_test'", $sql);
    }
}
