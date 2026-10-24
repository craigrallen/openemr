<?php

/**
 * Native, database-free characterization of referral body validation.
 *
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Services\PatientTransactionService;
use Particle\Validator\Rule\Datetime;
use Particle\Validator\Rule\IsString;
use Particle\Validator\Rule\LengthBetween;
use Particle\Validator\Rule\NotEmpty;
use Particle\Validator\Rule\Required;
use Particle\Validator\ValidationResult;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use stdClass;

#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class ReferralBodyValidationTest extends TestCase
{
    public static function setUpBeforeClass(): void
    {
        // BaseService loads code_types.inc.php when the service is autoloaded.
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
    }

    /** @return array<string, mixed> */
    private static function validReferral(): array
    {
        return [
            'type' => 'LBTref',
            'referralDate' => '2026-10-24',
            'body' => 'Reason for referral',
            'groupname' => 'Default',
            'referByNpi' => '1234567890',
        ];
    }

    private function service(): PatientTransactionService
    {
        return (new ReflectionClass(PatientTransactionService::class))->newInstanceWithoutConstructor();
    }

    /** @return array<string, array{mixed}> */
    public static function malformedBodyProvider(): array
    {
        return [
            'nonempty indexed array' => [['text']],
            'nonempty associative array' => [['text' => 'reason']],
            'plain object' => [new stdClass()],
        ];
    }

    #[DataProvider('malformedBodyProvider')]
    public function testMalformedBodyReturnsValidationError(mixed $body): void
    {
        $input = self::validReferral();
        $input['body'] = $body;

        $result = $this->service()->validate($input);

        self::assertInstanceOf(ValidationResult::class, $result);
        self::assertFalse($result->isValid());
        $messages = $result->getMessages();
        self::assertSame(['body'], array_keys($messages));
        self::assertSame([IsString::NOT_A_STRING => 'body must be a string'], $messages['body']);
        self::assertArrayNotHasKey('body', $result->getValues());
    }

    public function testLiveResourceBodyReturnsValidationError(): void
    {
        $resource = fopen('php://memory', 'r+');
        self::assertIsResource($resource);

        try {
            $input = self::validReferral();
            $input['body'] = $resource;

            $result = $this->service()->validate($input);

            self::assertInstanceOf(ValidationResult::class, $result);
            self::assertFalse($result->isValid());
            $messages = $result->getMessages();
            self::assertSame(['body'], array_keys($messages));
            self::assertSame([IsString::NOT_A_STRING => 'body must be a string'], $messages['body']);
            self::assertArrayNotHasKey('body', $result->getValues());
        } finally {
            fclose($resource);
        }
    }

    /** @return array<string, array{bool, mixed, string, string}> */
    public static function requiredBodyProvider(): array
    {
        return [
            'omitted' => [false, null, Required::NON_EXISTENT_KEY, 'body must be provided, but does not exist'],
            'null' => [true, null, NotEmpty::EMPTY_VALUE, 'body must not be empty'],
            'empty string' => [true, '', NotEmpty::EMPTY_VALUE, 'body must not be empty'],
            'empty array' => [true, [], NotEmpty::EMPTY_VALUE, 'body must not be empty'],
        ];
    }

    #[DataProvider('requiredBodyProvider')]
    public function testRequiredBodyRetainsEmptyValueRules(bool $present, mixed $body, string $reason, string $message): void
    {
        $input = self::validReferral();
        unset($input['body']);
        if ($present) {
            $input['body'] = $body;
        }

        $result = $this->service()->validate($input);

        self::assertInstanceOf(ValidationResult::class, $result);
        self::assertFalse($result->isValid());
        $messages = $result->getMessages();
        self::assertSame(['body'], array_keys($messages));
        self::assertIsArray($messages['body']);
        self::assertSame([$reason => $message], $messages['body']);
    }

    /** @return array<string, array{mixed, string}> */
    public static function shortScalarBodyProvider(): array
    {
        return [
            'literal string zero' => ['0', LengthBetween::TOO_SHORT],
            'integer zero' => [0, LengthBetween::TOO_SHORT],
            'false' => [false, LengthBetween::TOO_SHORT],
            'true' => [true, LengthBetween::TOO_SHORT],
            'single digit integer' => [7, LengthBetween::TOO_SHORT],
            'one-character Stringable' => ['stringable:A', LengthBetween::TOO_SHORT],
        ];
    }

    #[DataProvider('shortScalarBodyProvider')]
    public function testShortScalarBodyRetainsLengthError(mixed $body, string $reason): void
    {
        if ($body === 'stringable:A') {
            $body = new class {
                public function __toString(): string
                {
                    return 'A';
                }
            };
        }

        $input = self::validReferral();
        $input['body'] = $body;

        $result = $this->service()->validate($input);

        self::assertInstanceOf(ValidationResult::class, $result);
        self::assertFalse($result->isValid());
        $messages = $result->getMessages();
        self::assertSame(['body'], array_keys($messages));
        self::assertIsArray($messages['body']);
        self::assertSame([$reason => 'body must be 2 characters or longer'], $messages['body']);
    }

    /** @return array<string, array{string, bool, string|null}> */
    public static function textBodyProvider(): array
    {
        return [
            'one byte' => ['a', false, LengthBetween::TOO_SHORT],
            'two bytes' => ['ab', true, null],
            '150 bytes' => [str_repeat('a', 150), true, null],
            '151 bytes' => [str_repeat('a', 151), false, LengthBetween::TOO_LONG],
            'one two-byte character' => ['é', true, null],
            '150 multibyte bytes' => [str_repeat('é', 75), true, null],
            '151 multibyte bytes' => [str_repeat('é', 75) . 'a', false, LengthBetween::TOO_LONG],
            'one-byte newline' => ["\n", false, LengthBetween::TOO_SHORT],
            'two-byte newline' => ["a\n", true, null],
            'multiline text' => ["Line one\r\nLine two", true, null],
        ];
    }

    #[DataProvider('textBodyProvider')]
    public function testBodyUsesByteLengthAndPreservesText(string $body, bool $valid, ?string $reason): void
    {
        $input = self::validReferral();
        $input['body'] = $body;

        $result = $this->service()->validate($input);

        self::assertInstanceOf(ValidationResult::class, $result);
        self::assertSame($valid, $result->isValid());
        if ($valid) {
            self::assertSame([], $result->getMessages());
            self::assertSame($body, $result->getValues()['body']);
            return;
        }

        $messages = $result->getMessages();
        self::assertSame(['body'], array_keys($messages));
        self::assertIsArray($messages['body']);
        $message = $reason === LengthBetween::TOO_SHORT
            ? 'body must be 2 characters or longer'
            : 'body must be 150 characters or shorter';
        self::assertSame([$reason => $message], $messages['body']);
    }

    /** @return array<string, array{mixed}> */
    public static function acceptedBodyProvider(): array
    {
        return [
            'integer with two digits' => [12],
            'decimal' => [12.5],
            'Stringable object' => ['stringable:AB'],
        ];
    }

    #[DataProvider('acceptedBodyProvider')]
    public function testLegacyLengthCompatibleBodyKeepsOriginalValue(mixed $body): void
    {
        if ($body === 'stringable:AB') {
            $body = new class {
                public function __toString(): string
                {
                    return 'AB';
                }
            };
        }

        $input = self::validReferral();
        $input['body'] = $body;

        $result = $this->service()->validate($input);

        self::assertInstanceOf(ValidationResult::class, $result);
        self::assertTrue($result->isValid());
        self::assertSame([], $result->getMessages());
        self::assertSame($body, $result->getValues()['body']);
    }

    /** @return array<string, array{string, bool, mixed, string, string}> */
    public static function otherRequiredFieldsProvider(): array
    {
        return [
            'date omitted' => ['referralDate', false, null, Required::NON_EXISTENT_KEY, 'referralDate must be provided, but does not exist'],
            'date invalid' => ['referralDate', true, 'not-a-date', Datetime::INVALID_VALUE, 'referralDate must be a valid date'],
            'group omitted' => ['groupname', false, null, Required::NON_EXISTENT_KEY, 'groupname must be provided, but does not exist'],
            'group non-string' => ['groupname', true, 12, IsString::NOT_A_STRING, 'groupname must be a string'],
            'NPI omitted' => ['referByNpi', false, null, Required::NON_EXISTENT_KEY, 'referByNpi must be provided, but does not exist'],
            'NPI non-string' => ['referByNpi', true, 12, IsString::NOT_A_STRING, 'referByNpi must be a string'],
        ];
    }

    #[DataProvider('otherRequiredFieldsProvider')]
    public function testOtherRequiredFieldsStillReportTheirRules(string $field, bool $present, mixed $value, string $reason, string $message): void
    {
        $input = self::validReferral();
        unset($input[$field]);
        if ($present) {
            $input[$field] = $value;
        }

        $result = $this->service()->validate($input);

        self::assertInstanceOf(ValidationResult::class, $result);
        self::assertFalse($result->isValid());
        $messages = $result->getMessages();
        self::assertSame([$field], array_keys($messages));
        self::assertIsArray($messages[$field]);
        self::assertSame([$reason => $message], $messages[$field]);
    }

    public function testNonReferralTypeDoesNotApplyReferralRules(): void
    {
        $result = $this->service()->validate(['type' => 'other', 'body' => ['unvalidated']]);

        self::assertInstanceOf(ValidationResult::class, $result);
        self::assertTrue($result->isValid());
        self::assertSame([], $result->getMessages());
        self::assertSame([], $result->getValues());
    }
}
