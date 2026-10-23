<?php

/**
 * List input validation at the service boundary used by list POST and PUT.
 *
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Services\ListService;
use Particle\Validator\Rule\LengthBetween;
use Particle\Validator\ValidationResult;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use stdClass;

class ListInputValidationTest extends TestCase
{
    private ListService $service;

    protected function setUp(): void
    {
        $this->service = new ListService();
    }

    /** @return array<string, mixed> */
    private static function validList(): array
    {
        return ['title' => 'Asthma', 'type' => 'medical_problem', 'pid' => '42'];
    }

    /**
     * Each supplied shape previously reached strlen() and raised TypeError.
     * Both REST write paths call this method before their database operation.
     */
    #[DataProvider('malformedTextProvider')]
    public function testMalformedTextReturnsFieldError(string $field, mixed $value): void
    {
        $data = self::validList();
        $data[$field] = $value;

        $result = $this->service->validate($data);

        $this->assertInstanceOf(ValidationResult::class, $result);
        $this->assertFalse($result->isValid());
        $messages = $result->getMessages();
        $this->assertIsArray($messages);
        $this->assertArrayHasKey($field, $messages);
        $this->assertIsArray($messages[$field]);
        $this->assertNotEmpty($messages[$field]);
    }

    /** @return array<string, array{string, mixed}> */
    public static function malformedTextProvider(): array
    {
        return [
            'title nonempty array' => ['title', ['bad']],
            'type nonempty array' => ['type', ['bad']],
            'diagnosis nonempty array' => ['diagnosis', ['bad']],
            'title plain object' => ['title', new stdClass()],
            'type plain object' => ['type', new stdClass()],
            'diagnosis plain object' => ['diagnosis', new stdClass()],
        ];
    }

    #[DataProvider('resourceFieldProvider')]
    public function testResourceReturnsFieldError(string $field): void
    {
        $resource = fopen('php://memory', 'r+');
        $this->assertIsResource($resource);

        try {
            $data = self::validList();
            $data[$field] = $resource;

            $result = $this->service->validate($data);

            $this->assertInstanceOf(ValidationResult::class, $result);
            $this->assertFalse($result->isValid());
            $messages = $result->getMessages();
            $this->assertIsArray($messages);
            $this->assertArrayHasKey($field, $messages);
            $this->assertIsArray($messages[$field]);
            $this->assertNotEmpty($messages[$field]);
        } finally {
            fclose($resource);
        }
    }

    /** @return array<string, array{string}> */
    public static function resourceFieldProvider(): array
    {
        return [
            'title resource' => ['title'],
            'type resource' => ['type'],
            'diagnosis resource' => ['diagnosis'],
        ];
    }

    #[DataProvider('requiredEmptyProvider')]
    public function testRequiredTextRejectsAbsentAndEmptyValues(string $field, bool $present, mixed $value): void
    {
        $data = self::validList();
        unset($data[$field]);
        if ($present) {
            $data[$field] = $value;
        }

        $result = $this->service->validate($data);

        $this->assertInstanceOf(ValidationResult::class, $result);
        $this->assertFalse($result->isValid());
        $messages = $result->getMessages();
        $this->assertIsArray($messages);
        $this->assertArrayHasKey($field, $messages);
        $this->assertIsArray($messages[$field]);
        $this->assertNotEmpty($messages[$field]);
    }

    /** @return array<string, array{string, bool, mixed}> */
    public static function requiredEmptyProvider(): array
    {
        $cases = [];
        foreach (['title', 'type'] as $field) {
            $cases["$field omitted"] = [$field, false, null];
            $cases["$field null"] = [$field, true, null];
            $cases["$field empty string"] = [$field, true, ''];
            $cases["$field empty array"] = [$field, true, []];
            $cases["$field string zero"] = [$field, true, '0'];
            $cases["$field integer zero"] = [$field, true, 0];
            $cases["$field false"] = [$field, true, false];
        }
        return $cases;
    }

    #[DataProvider('optionalEmptyProvider')]
    public function testOptionalDiagnosisAcceptsAbsentAndEmptyValues(bool $present, mixed $value): void
    {
        $data = self::validList();
        if ($present) {
            $data['diagnosis'] = $value;
        }

        $result = $this->service->validate($data);

        $this->assertInstanceOf(ValidationResult::class, $result);
        $this->assertTrue($result->isValid());
        $this->assertSame([], $result->getMessages());
    }

    /** @return array<string, array{bool, mixed}> */
    public static function optionalEmptyProvider(): array
    {
        return [
            'omitted' => [false, null],
            'null' => [true, null],
            'empty string' => [true, ''],
            'empty array' => [true, []],
        ];
    }

    #[DataProvider('textLengthProvider')]
    public function testTextUsesExistingByteLengthBounds(string $field, string $value, bool $valid): void
    {
        $data = self::validList();
        $data[$field] = $value;

        $result = $this->service->validate($data);

        $this->assertInstanceOf(ValidationResult::class, $result);
        $this->assertSame($valid, $result->isValid());
        $messages = $result->getMessages();
        $this->assertIsArray($messages);
        if ($valid) {
            $this->assertSame([], $messages);
            $this->assertSame($value, $result->getValues()[$field]);
            return;
        }

        $this->assertArrayHasKey($field, $messages);
        $this->assertIsArray($messages[$field]);
        $tooShort = strlen($value) < 2;
        $reason = $tooShort ? LengthBetween::TOO_SHORT : LengthBetween::TOO_LONG;
        $message = $field . ($tooShort ? ' must be 2 characters or longer' : ' must be 255 characters or shorter');
        $this->assertSame([$reason => $message], $messages[$field]);
    }

    /** @return array<string, array{string, string, bool}> */
    public static function textLengthProvider(): array
    {
        $cases = [];
        foreach (['title', 'type', 'diagnosis'] as $field) {
            $cases["$field one byte"] = [$field, 'a', false];
            $cases["$field two bytes"] = [$field, 'ab', true];
            $cases["$field 255 bytes"] = [$field, str_repeat('a', 255), true];
            $cases["$field 256 bytes"] = [$field, str_repeat('a', 256), false];
            $cases["$field unicode two bytes"] = [$field, 'é', true];
            $cases["$field unicode 256 bytes"] = [$field, str_repeat('é', 128), false];
            $cases["$field newline one byte"] = [$field, "\n", false];
            $cases["$field newline two bytes"] = [$field, "a\n", true];
        }
        return $cases;
    }

    #[DataProvider('acceptedScalarProvider')]
    public function testScalarAndStringableValuesKeepTheirOriginalType(string $field, mixed $value): void
    {
        $data = self::validList();
        $data[$field] = $value;

        $result = $this->service->validate($data);

        $this->assertInstanceOf(ValidationResult::class, $result);
        $this->assertTrue($result->isValid());
        $this->assertSame([], $result->getMessages());
        $this->assertSame($value, $result->getValues()[$field]);
    }

    /** @return array<string, array{string, mixed}> */
    public static function acceptedScalarProvider(): array
    {
        $stringable = new class {
            public function __toString(): string
            {
                return 'AB';
            }
        };

        $cases = [];
        foreach (['title', 'type', 'diagnosis'] as $field) {
            $cases["$field integer"] = [$field, 12];
            $cases["$field float"] = [$field, 12.5];
            $cases["$field Stringable"] = [$field, $stringable];
        }
        return $cases;
    }

    #[DataProvider('shortScalarProvider')]
    public function testShortScalarsKeepLengthFailure(string $field, mixed $value): void
    {
        $data = self::validList();
        $data[$field] = $value;

        $result = $this->service->validate($data);

        $this->assertInstanceOf(ValidationResult::class, $result);
        $this->assertFalse($result->isValid());
        $messages = $result->getMessages();
        $this->assertIsArray($messages);
        $this->assertArrayHasKey($field, $messages);
        $this->assertIsArray($messages[$field]);
        $this->assertSame(
            [LengthBetween::TOO_SHORT => "$field must be 2 characters or longer"],
            $messages[$field]
        );
    }

    /** @return array<string, array{string, mixed}> */
    public static function shortScalarProvider(): array
    {
        $shortStringable = new class {
            public function __toString(): string
            {
                return 'A';
            }
        };

        $cases = [];
        foreach (['title', 'type', 'diagnosis'] as $field) {
            $cases["$field one-digit integer"] = [$field, 7];
            $cases["$field true"] = [$field, true];
            $cases["$field short Stringable"] = [$field, $shortStringable];
        }
        return $cases;
    }

    /** @param array<string, mixed> $changes */
    #[DataProvider('pidAndDateProvider')]
    public function testPidAndDateRulesRemainInForce(array $changes, bool $valid, ?string $errorField): void
    {
        $result = $this->service->validate(array_replace(self::validList(), $changes));

        $this->assertInstanceOf(ValidationResult::class, $result);
        $this->assertSame($valid, $result->isValid());
        $messages = $result->getMessages();
        $this->assertIsArray($messages);
        if ($valid) {
            $this->assertSame([], $messages);
            foreach ($changes as $field => $value) {
                $this->assertSame($value, $result->getValues()[$field]);
            }
            return;
        }

        $this->assertNotNull($errorField);
        $this->assertArrayHasKey($errorField, $messages);
        $this->assertIsArray($messages[$errorField]);
        $this->assertNotEmpty($messages[$errorField]);
    }

    /** @return array<string, array{array<string, mixed>, bool, ?string}> */
    public static function pidAndDateProvider(): array
    {
        return [
            'numeric pid integer' => [['pid' => 42], true, null],
            'numeric pid string' => [['pid' => '42'], true, null],
            'nonnumeric pid' => [['pid' => 'patient'], false, 'pid'],
            'valid begin date' => [['begdate' => '2024-02-29 12:30:00'], true, null],
            'valid end date' => [['enddate' => '2024-02-29 12:30:00'], true, null],
            'invalid begin date' => [['begdate' => 'yesterday'], false, 'begdate'],
            'invalid end date' => [['enddate' => 'yesterday'], false, 'enddate'],
        ];
    }
}
