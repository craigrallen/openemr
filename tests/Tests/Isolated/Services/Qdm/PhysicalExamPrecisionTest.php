<?php

/** Regression coverage for native physical exam result precision. */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services\Qdm;

use ErrorException;
use LogicException;
use OpenEMR\Cqm\Qdm\BaseTypes\DateTime;
use OpenEMR\Cqm\Qdm\BaseTypes\Interval;
use OpenEMR\Cqm\Qdm\BaseTypes\Quantity;
use OpenEMR\Cqm\Qdm\PhysicalExamPerformed;
use OpenEMR\Services\CodeTypesService;
use OpenEMR\Services\Qdm\Interfaces\QdmRequestInterface;
use OpenEMR\Services\Qdm\QdmRecord;
use OpenEMR\Services\Qdm\Services\PhysicalExamService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class PhysicalExamPrecisionTest extends TestCase
{
    protected function setUp(): void
    {
        // A loader reaching BaseService must skip CodeTypesService's top-level DB read.
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }

        $source = realpath(__DIR__ . '/../../../../../src/Services/Qdm/Services/PhysicalExamService.php');
        self::assertIsString($source);
        self::assertSame($source, (new ReflectionClass(PhysicalExamService::class))->getFileName());
    }

    /** @param list<array{string, bool}> $lookups */
    private function service(array $lookups = []): PhysicalExamService
    {
        $request = $this->createMock(QdmRequestInterface::class);
        $request->expects($this->never())->method('getFilter');

        $codeTypes = $this->getMockBuilder(CodeTypesService::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getSystemForCodeType'])
            ->getMock();
        $index = 0;
        $codeTypes->expects($this->exactly(count($lookups)))
            ->method('getSystemForCodeType')
            ->willReturnCallback(function (string $type, bool $useOid) use ($lookups, &$index): string {
                self::assertArrayHasKey($index, $lookups);
                self::assertSame($lookups[$index++], [$type, $useOid]);
                return match ($type) {
                    'LOINC' => '2.16.840.1.113883.6.1',
                    'SNOMED-CT' => '2.16.840.1.113883.6.96',
                    default => throw new LogicException('Unexpected code type: ' . $type),
                };
            });

        return new PhysicalExamService($request, $codeTypes);
    }

    /** @return array<string, mixed> */
    private static function row(): array
    {
        return [
            'ob_value' => '1.75',
            'ob_unit' => 'cm',
            'date' => '2026-01-02 03:04:05',
            'date_end' => '2026-01-02 04:05:06',
            'code' => '',
            'ob_reason_code' => '',
            'ob_reason_status' => '',
        ];
    }

    /** @param array<string, mixed> $row */
    private static function record(array $row): QdmRecord
    {
        return new QdmRecord($row, 42, 7);
    }

    /** @return array<string, array{int|float|string, int|float}> */
    public static function finiteNumbers(): array
    {
        $cases = [
            'native fraction' => [1.75, 1.75],
            'native small fraction' => [0.25, 0.25],
            'native negative fraction' => [-2.75, -2.75],
            'decimal string' => ['1.75', 1.75],
            'small decimal string' => ['0.25', 0.25],
            'negative decimal string' => ['-2.75', -2.75],
            'whitespace decimal string' => ['  -2.75  ', -2.75],
            'positive exponent' => ['2.5e-1', 0.25],
            'negative exponent' => ['-2.5E+0', -2.5],
            'native zero' => [0, 0],
            'integer string zero' => ['0', 0],
            'decimal zero' => ['0.0', 0.0],
            'negative decimal zero' => ['-0.0', 0.0],
            'native negative zero' => [-0.0, 0.0],
            'native integer' => [42, 42],
            'integer string' => [' 00042 ', 42],
            'signed integer string' => ['-00042', -42],
            'native maximum' => [PHP_INT_MAX, PHP_INT_MAX],
            'native minimum' => [PHP_INT_MIN, PHP_INT_MIN],
            'maximum string' => [(string) PHP_INT_MAX, PHP_INT_MAX],
            'minimum string' => [(string) PHP_INT_MIN, PHP_INT_MIN],
        ];
        if (PHP_INT_SIZE >= 8) {
            $cases['integer above float precision'] = [9007199254740993, 9007199254740993];
            $cases['negative integer above float precision'] = [-9007199254740993, -9007199254740993];
            $cases['integer string above float precision'] = ['9007199254740993', 9007199254740993];
            $cases['negative integer string above float precision'] = ['-9007199254740993', -9007199254740993];
        }
        return $cases;
    }

    #[DataProvider('finiteNumbers')]
    public function testFiniteNumbersRetainValueTypeUnitAndSerialization(int|float|string $input, int|float $expected): void
    {
        $row = self::row();
        $row['ob_value'] = $input;
        $record = self::record($row);

        $model = $this->service()->makeQdmModel($record);

        self::assertInstanceOf(PhysicalExamPerformed::class, $model);
        self::assertInstanceOf(Quantity::class, $model->result);
        self::assertSame($expected, $model->result->value);
        self::assertSame('cm', $model->result->unit);
        self::assertSerializedQuantity($model, $expected);
        self::assertSame($row, $record->getData());
    }

    /** @return array<string, array{bool|int|float|string|null, bool}> */
    public static function legacyInputs(): array
    {
        return [
            'empty string' => ['', true],
            'null' => [null, true],
            'missing value' => [null, false],
            'false' => [false, true],
            'true' => [true, true],
            'text' => ['not measured', true],
            'numeric prefix with units' => ['1.75 cm', true],
            'positive infinity' => [INF, true],
            'negative infinity' => [-INF, true],
            'not a number' => [NAN, true],
            'positive overflow string' => ['1e309', true],
            'negative overflow string' => ['-1e309', true],
            'positive out-of-range exponent' => ['1e20', true],
            'negative out-of-range exponent' => ['-1e20', true],
            'positive out-of-range integer string' => [PHP_INT_MAX . '0', true],
            'negative out-of-range integer string' => [PHP_INT_MIN . '0', true],
            'positive out-of-range native float' => [1e20, true],
            'negative out-of-range native float' => [-1e20, true],
        ];
    }

    #[DataProvider('legacyInputs')]
    public function testUnsupportedInputsRetainOriginalIntegerCastDiagnosticsAndQuantity(
        bool|int|float|string|null $input,
        bool $present
    ): void {
        $row = self::row();
        if ($present) {
            $row['ob_value'] = $input;
        } else {
            unset($row['ob_value']);
        }
        $record = self::record($row);

        [$expected, $castWarnings] = self::recordWarnings(static fn (): int => (int) $input);
        [$model, $modelWarnings] = self::recordWarnings(fn () => $this->service()->makeQdmModel($record));
        self::assertInstanceOf(PhysicalExamPerformed::class, $model);
        self::assertInstanceOf(Quantity::class, $model->result);
        self::assertSame($expected, $model->result->value);
        self::assertSame('cm', $model->result->unit);
        self::assertSame($present ? $castWarnings : ['Undefined array key "ob_value"'], $modelWarnings);
        self::assertSerializedQuantity($model, $expected);

        $actual = $record->getData();
        if (is_float($input) && is_nan($input)) {
            self::assertArrayHasKey('ob_value', $actual);
            self::assertIsFloat($actual['ob_value']);
            self::assertNan($actual['ob_value']);
            unset($row['ob_value'], $actual['ob_value']);
        }
        self::assertSame($row, $actual);
    }

    /**
     * @template T
     * @param callable(): T $operation
     * @return array{T, list<string>}
     */
    private static function recordWarnings(callable $operation): array
    {
        $warnings = [];
        set_error_handler(static function (int $severity, string $message) use (&$warnings): bool {
            if ($severity !== E_WARNING) {
                throw new ErrorException($message, 0, $severity);
            }
            $warnings[] = $message;
            return true;
        });
        try {
            $result = $operation();
        } finally {
            restore_error_handler();
        }
        return [$result, $warnings];
    }

    public function testParentModelPropagatesIdsDatesCodesNegationAndUnit(): void
    {
        $row = self::row();
        $row['ob_value'] = '2.5';
        $row['ob_unit'] = 'mmHg';
        $row['code'] = 'LOINC:1234-5;SNOMED-CT:67890';
        $row['ob_reason_code'] = 'SNOMED-CT:11111';
        $row['ob_reason_status'] = 'negated';
        $row['ob_code'] = 'LOINC:ignored';
        $row['description'] = 'irrelevant description';
        $record = self::record($row);

        $model = $this->service([
            ['SNOMED-CT', true],
            ['LOINC', true],
            ['SNOMED-CT', true],
        ])->makeQdmModel($record);

        self::assertInstanceOf(PhysicalExamPerformed::class, $model);
        self::assertSame('000000000000000000000007', $model->_id);
        self::assertSame($model->_id, $model->id);
        self::assertInstanceOf(DateTime::class, $model->relevantDatetime);
        self::assertSame($row['date'], $model->relevantDatetime->date);
        self::assertInstanceOf(DateTime::class, $model->authorDatetime);
        self::assertSame($row['date'], $model->authorDatetime->date);
        self::assertInstanceOf(Interval::class, $model->relevantPeriod);
        self::assertSame($row['date'], $model->relevantPeriod->low->date);
        self::assertSame($row['date_end'], $model->relevantPeriod->high->date);
        self::assertTrue($model->relevantPeriod->lowClosed);
        self::assertTrue($model->relevantPeriod->highClosed);
        self::assertNull($model->reason);
        self::assertSame('11111', $model->negationRationale->code);
        self::assertSame('2.16.840.1.113883.6.96', $model->negationRationale->system);
        self::assertCount(2, $model->dataElementCodes);
        self::assertSame('1234-5', $model->dataElementCodes[0]->code);
        self::assertSame('2.16.840.1.113883.6.1', $model->dataElementCodes[0]->system);
        self::assertSame('67890', $model->dataElementCodes[1]->code);
        self::assertSame('2.16.840.1.113883.6.96', $model->dataElementCodes[1]->system);
        self::assertInstanceOf(Quantity::class, $model->result);
        self::assertSame(2.5, $model->result->value);
        self::assertSame('mmHg', $model->result->unit);
        self::assertSame($row, $record->getData());
    }

    private static function assertSerializedQuantity(PhysicalExamPerformed $model, int|float $expected): void
    {
        self::assertInstanceOf(Quantity::class, $model->result);
        $json = json_encode($model, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION);
        $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        self::assertIsArray($decoded);
        self::assertArrayHasKey('result', $decoded);
        $result = $decoded['result'];
        self::assertIsArray($result);
        self::assertArrayHasKey('_type', $result);
        self::assertArrayHasKey('value', $result);
        self::assertArrayHasKey('unit', $result);
        self::assertSame('QDM::Quantity', $result['_type']);
        self::assertSame($expected, $result['value']);
        self::assertSame($model->result->unit, $result['unit']);
    }
}
