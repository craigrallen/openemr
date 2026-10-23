<?php

/**
 * Isolated input validation regressions for SOAP notes.
 *
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Services\EncounterService;
use Particle\Validator\Rule\LengthBetween;
use Particle\Validator\ValidationResult;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class SoapNoteInputValidationTest extends TestCase
{
    public static function setUpBeforeClass(): void
    {
        // BaseService loads code_types.inc.php while EncounterService is autoloaded.
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
    }

    /** @return iterable<string, array{string}> */
    public static function soapFields(): iterable
    {
        foreach (['subjective', 'objective', 'assessment', 'plan'] as $field) {
            yield $field => [$field];
        }
    }

    /** @return iterable<string, array{string, mixed}> */
    public static function invalidValues(): iterable
    {
        foreach (['subjective', 'objective', 'assessment', 'plan'] as $field) {
            yield "$field: nonempty array" => [$field, ['ab']];
            yield "$field: object" => [$field, (object) ['text' => 'ab']];
            yield "$field: JSON integer" => [$field, json_decode('12', true)];
            yield "$field: JSON decimal" => [$field, json_decode('12.5', true)];
            yield "$field: JSON true" => [$field, json_decode('true', true)];
            yield "$field: JSON false" => [$field, json_decode('false', true)];
        }
    }

    #[DataProvider('invalidValues')]
    public function testNonStringValueProducesFieldValidationError(string $field, mixed $value): void
    {
        $input = [$field => $value];
        $original = $input;
        $result = $this->service()->validateSoapNote($input);
        self::assertInstanceOf(ValidationResult::class, $result);

        self::assertFalse($result->isValid());
        self::assertSame([$field], array_keys($result->getMessages()));
        self::assertNotEmpty($result->getMessages()[$field]);
        self::assertSame($original, $input);
    }

    #[DataProvider('soapFields')]
    public function testOptionalOmittedNullAndEmptyValuesRetainLegacyBehavior(string $field): void
    {
        foreach ([[], [$field => null], [$field => ''], [$field => []]] as $input) {
            $result = $this->service()->validateSoapNote($input);
            self::assertInstanceOf(ValidationResult::class, $result);

            self::assertTrue($result->isValid());
            self::assertSame([], $result->getMessages());
            self::assertSame($input, $result->getValues());
        }
    }

    /** @return iterable<string, array{string, int, bool}> */
    public static function byteLengths(): iterable
    {
        foreach (['subjective', 'objective', 'assessment', 'plan'] as $field) {
            foreach ([1 => false, 2 => true, 65535 => true, 65536 => false] as $length => $valid) {
                yield "$field: $length bytes" => [$field, $length, $valid];
            }
        }
    }

    #[DataProvider('byteLengths')]
    public function testAsciiByteBoundaries(string $field, int $length, bool $valid): void
    {
        $value = str_repeat('a', $length);
        $input = [$field => $value];
        $result = $this->service()->validateSoapNote($input);
        self::assertInstanceOf(ValidationResult::class, $result);

        self::assertSame($valid, $result->isValid());
        if ($valid) {
            self::assertSame([], $result->getMessages());
            self::assertSame($input, $result->getValues());
        } else {
            $reason = $length < 2 ? LengthBetween::TOO_SHORT : LengthBetween::TOO_LONG;
            self::assertArrayHasKey($reason, $result->getMessages()[$field]);
        }
    }

    /** @return iterable<string, array{string, string, bool}> */
    public static function multibyteLengths(): iterable
    {
        foreach (['subjective', 'objective', 'assessment', 'plan'] as $field) {
            yield "$field: one two-byte character" => [$field, 'é', true];
            yield "$field: 65535 bytes" => [$field, str_repeat('é', 32767) . 'a', true];
            yield "$field: 65536 bytes" => [$field, str_repeat('é', 32768), false];
        }
    }

    #[DataProvider('soapFields')]
    public function testUnicodeAndNewlinesArePreserved(string $field): void
    {
        $input = [$field => "Å\nβ\r\nend"];
        $result = $this->service()->validateSoapNote($input);
        self::assertInstanceOf(ValidationResult::class, $result);

        self::assertTrue($result->isValid());
        self::assertSame($input, $result->getValues());
    }

    #[DataProvider('multibyteLengths')]
    public function testMultibyteByteBoundary(string $field, string $value, bool $valid): void
    {
        $input = [$field => $value];
        $result = $this->service()->validateSoapNote($input);
        self::assertInstanceOf(ValidationResult::class, $result);

        self::assertSame($valid, $result->isValid());
        if ($valid) {
            self::assertSame($input, $result->getValues());
        } else {
            self::assertArrayHasKey(LengthBetween::TOO_LONG, $result->getMessages()[$field]);
        }
    }

    public function testFieldsReportIndependentErrorsAlongsideValidAndUnknownInput(): void
    {
        $input = [
            'subjective' => 'x',
            'objective' => "Line one\nLine two",
            'assessment' => ['invalid'],
            'plan' => str_repeat('p', 65536),
            'unexpected' => 'kept only in request',
        ];
        $original = $input;

        $result = $this->service()->validateSoapNote($input);
        self::assertInstanceOf(ValidationResult::class, $result);

        self::assertFalse($result->isValid());
        self::assertSame(['subjective', 'assessment', 'plan'], array_keys($result->getMessages()));
        self::assertSame(['objective' => "Line one\nLine two"], $result->getValues());
        self::assertSame($original, $input);
    }

    public function testUnknownFieldDoesNotCreateAnErrorOrValidatedValue(): void
    {
        $input = ['unknown' => ['anything']];
        $original = $input;
        $result = $this->service()->validateSoapNote($input);
        self::assertInstanceOf(ValidationResult::class, $result);

        self::assertTrue($result->isValid());
        self::assertSame([], $result->getMessages());
        self::assertSame([], $result->getValues());
        self::assertSame($original, $input);
    }

    private function service(): EncounterService
    {
        return (new ReflectionClass(EncounterService::class))->newInstanceWithoutConstructor();
    }
}
