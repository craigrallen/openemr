<?php

/**
 * Message input validation tests.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenCoreEMR Inc <https://opencoreemr.com/>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Services\MessageService;
use Particle\Validator\Failure;
use Particle\Validator\ValidationResult;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use stdClass;

class MessageInputValidationTest extends TestCase
{
    /** @var array<string, int> */
    private const MAX_LENGTHS = [
        'body' => 65535,
        'to' => 255,
        'from' => 255,
        'groupname' => 255,
        'title' => 255,
        'message_status' => 20,
    ];

    /** @return array<string, string> */
    private static function validMessage(): array
    {
        return [
            'body' => 'Message body',
            'to' => 'admin',
            'from' => 'sender',
            'groupname' => 'Default',
            'title' => 'Other',
            'message_status' => 'New',
        ];
    }

    /** @return iterable<string, array{string, string}> */
    public static function validStringCases(): iterable
    {
        foreach (self::MAX_LENGTHS as $field => $max) {
            yield "$field ASCII minimum" => [$field, 'ab'];
            yield "$field ASCII maximum" => [$field, str_repeat('a', $max)];
            yield "$field numeric text" => [$field, '42'];
            // Particle's lengthBetween uses strlen: one Swedish character occupies two bytes.
            yield "$field Swedish two-byte minimum" => [$field, 'å'];
            yield "$field Swedish byte maximum" => [
                $field,
                str_repeat('å', intdiv($max, 2)) . ($max % 2 === 0 ? '' : 'a'),
            ];
            yield "$field newline at minimum" => [$field, "A\n"];
        }
        yield 'body with multiple lines' => ['body', "Första raden\nAndra raden"];
    }

    #[Test]
    #[DataProvider('validStringCases')]
    public function acceptsValidStringsWithoutChangingTheirValues(string $field, string $value): void
    {
        $message = self::validMessage();
        $message[$field] = $value;
        $original = $message;

        $result = (new MessageService())->validate($message);

        self::assertInstanceOf(ValidationResult::class, $result);
        self::assertTrue($result->isValid(), "$field should accept this string");
        self::assertSame(array_keys($message), array_keys($result->getValues()));
        foreach ($message as $key => $inputValue) {
            self::assertTrue($inputValue === $result->getValues()[$key], "$key value changed");
        }
        self::assertTrue($message === $original, 'Validation changed the input array');
    }

    /** @return iterable<string, array{string, string}> */
    public static function invalidStringCases(): iterable
    {
        foreach (self::MAX_LENGTHS as $field => $max) {
            yield "$field ASCII too short" => [$field, 'a'];
            yield "$field empty" => [$field, ''];
            yield "$field ASCII too long" => [$field, str_repeat('a', $max + 1)];
            yield "$field Swedish over byte maximum" => [
                $field,
                str_repeat('å', intdiv($max, 2) + 1),
            ];
        }
    }

    #[Test]
    #[DataProvider('invalidStringCases')]
    public function rejectsStringsOutsideByteLengthBounds(string $field, string $value): void
    {
        $this->assertRejectedField($field, $value);
    }

    /** @return iterable<string, array{string, mixed}> */
    public static function malformedFieldCases(): iterable
    {
        foreach (array_keys(self::MAX_LENGTHS) as $field) {
            yield "$field nonempty array" => [$field, ['text']];
            yield "$field empty array" => [$field, []];
            yield "$field object" => [$field, new stdClass()];
            yield "$field true" => [$field, true];
            yield "$field false" => [$field, false];
            yield "$field integer" => [$field, 42];
            yield "$field float" => [$field, 4.2];
            yield "$field null" => [$field, null];
        }
    }

    #[Test]
    #[DataProvider('malformedFieldCases')]
    public function rejectsMalformedFieldTypesWithAValidationResult(string $field, mixed $value): void
    {
        $this->assertRejectedField($field, $value);
    }

    /** @return iterable<string, array{string}> */
    public static function requiredFields(): iterable
    {
        foreach (array_keys(self::MAX_LENGTHS) as $field) {
            yield $field => [$field];
        }
    }

    #[Test]
    #[DataProvider('requiredFields')]
    public function rejectsEachAbsentField(string $field): void
    {
        $message = self::validMessage();
        unset($message[$field]);
        $original = $message;

        $result = (new MessageService())->validate($message);

        $this->assertFailureForField($result, $field);
        self::assertTrue($message === $original, 'Validation changed the input array');
    }

    private function assertRejectedField(string $field, mixed $value): void
    {
        $message = self::validMessage();
        $message[$field] = $value;
        $original = $message;

        $result = (new MessageService())->validate($message);

        $this->assertFailureForField($result, $field);
        self::assertTrue($message === $original, 'Validation changed the input array');
    }

    private function assertFailureForField(mixed $result, string $field): void
    {
        self::assertInstanceOf(ValidationResult::class, $result);
        self::assertFalse($result->isValid(), "$field should be rejected");
        self::assertContains(
            $field,
            array_map(static fn (Failure $failure): string => $failure->getKey(), $result->getFailures()),
        );
    }
}
