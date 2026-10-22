<?php

/**
 * Appointment conflict input validation tests.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Services\AppointmentService;
use Particle\Validator\ValidationResult;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class AppointmentConflictInputTest extends TestCase
{
    public static function setUpBeforeClass(): void
    {
        // BaseService loads code_types.inc.php when its class is loaded.
        // Its static-analysis path skips the top-level database query.
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function validAppointment(): array
    {
        return [
            'pc_catid' => 2,
            'pc_title' => 'Office visit',
            'pc_duration' => 900,
            'pc_hometext' => 'Visit',
            'pc_apptstatus' => '-',
            'pc_eventDate' => '2026-10-22',
            'pc_startTime' => '09:00',
            'pc_facility' => 1,
            'pc_billing_location' => 1,
        ];
    }

    /**
     * @param array<string, mixed> $appointment
     */
    private function validateAppointment(array $appointment): ValidationResult
    {
        $serviceClass = new ReflectionClass(AppointmentService::class);
        $this->assertSame(
            realpath(__DIR__ . '/../../../../src/Services/AppointmentService.php'),
            $serviceClass->getFileName(),
            'Validation must run from this checkout'
        );

        // The native constructor writes missing UUIDs to database tables.
        $service = $serviceClass->newInstanceWithoutConstructor();
        $original = $appointment;
        $result = $service->validate($appointment);

        $this->assertInstanceOf(ValidationResult::class, $result);
        $this->assertSame($original, $appointment, 'Validation must preserve the input array');
        return $result;
    }

    /**
     * @return array<string, array{int|float|string}>
     */
    public static function acceptedDurationProvider(): array
    {
        return [
            'positive integer' => [900],
            'positive numeric string' => ['900'],
            'category 2 zero integer' => [0],
            'category 2 zero string' => ['0'],
            'fractional number' => [1.5],
            'fractional numeric string' => ['1.5'],
            'exponent numeric string' => ['1e2'],
        ];
    }

    #[DataProvider('acceptedDurationProvider')]
    public function testAcceptsNonNegativeNumericDuration(int|float|string $duration): void
    {
        $appointment = $this->validAppointment();
        $appointment['pc_duration'] = $duration;

        $result = $this->validateAppointment($appointment);
        $this->assertTrue($result->isValid(), 'Numeric duration should remain valid');
        $this->assertArrayNotHasKey('pc_duration', $result->getMessages());
    }

    /**
     * @return array<string, array{int|float|string}>
     */
    public static function negativeDurationProvider(): array
    {
        return [
            'negative integer' => [-1],
            'negative numeric string' => ['-1'],
            'negative fraction' => [-0.5],
            'negative exponent string' => ['-1e2'],
        ];
    }

    #[DataProvider('negativeDurationProvider')]
    public function testRejectsNegativeDuration(int|float|string $duration): void
    {
        $appointment = $this->validAppointment();
        $appointment['pc_duration'] = $duration;

        $result = $this->validateAppointment($appointment);
        $this->assertFalse($result->isValid());
        $this->assertArrayHasKey('pc_duration', $result->getMessages());
    }

    /**
     * @return array<string, array{string}>
     */
    public static function validClockProvider(): array
    {
        return [
            'midnight' => ['00:00'],
            'morning' => ['09:00'],
            'last minute' => ['23:59'],
        ];
    }

    #[DataProvider('validClockProvider')]
    public function testAcceptsValidClock(string $startTime): void
    {
        $appointment = $this->validAppointment();
        $appointment['pc_startTime'] = $startTime;

        $result = $this->validateAppointment($appointment);
        $this->assertTrue($result->isValid());
        $this->assertArrayNotHasKey('pc_startTime', $result->getMessages());
    }

    /**
     * @return array<string, array{string}>
     */
    public static function invalidClockProvider(): array
    {
        return [
            'hour 24' => ['24:00'],
            'minute 60' => ['12:60'],
            'negative hour' => ['-1:00'],
            'letter in hour' => ['1a:00'],
            'wrong separator' => ['12-30'],
            'letters only' => ['abcde'],
            'single digit hour' => ['9:00'],
            'seconds included' => ['09:00:00'],
            'leading whitespace' => [' 9:00'],
            'trailing whitespace' => ['09:00 '],
            'embedded newline' => ["09:0\n"],
            'trailing newline' => ["09:00\n"],
        ];
    }

    /**
     * @return array<string, array{mixed}>
     */
    public static function invalidClockTypeProvider(): array
    {
        return [
            'numeric five digits' => [12345],
            'array' => [['09:00']],
            'null' => [null],
            'boolean' => [true],
        ];
    }

    #[DataProvider('invalidClockTypeProvider')]
    public function testRejectsNonStringClock(mixed $startTime): void
    {
        $appointment = $this->validAppointment();
        $appointment['pc_startTime'] = $startTime;

        $result = $this->validateAppointment($appointment);
        $this->assertFalse($result->isValid());
        $this->assertArrayHasKey('pc_startTime', $result->getMessages());
    }

    #[DataProvider('invalidClockProvider')]
    public function testRejectsMalformedOrImpossibleClock(string $startTime): void
    {
        $appointment = $this->validAppointment();
        $appointment['pc_startTime'] = $startTime;

        $result = $this->validateAppointment($appointment);
        $this->assertFalse($result->isValid());
        $this->assertArrayHasKey('pc_startTime', $result->getMessages());
    }

    /**
     * @return array<string, array{string}>
     */
    public static function nonNumericFieldProvider(): array
    {
        return [
            'category' => ['pc_catid'],
            'duration' => ['pc_duration'],
            'facility' => ['pc_facility'],
            'billing location' => ['pc_billing_location'],
        ];
    }

    #[DataProvider('nonNumericFieldProvider')]
    public function testRejectsNonNumericRequiredField(string $field): void
    {
        $appointment = $this->validAppointment();
        $appointment[$field] = 'not numeric';

        $result = $this->validateAppointment($appointment);
        $this->assertFalse($result->isValid());
        $this->assertArrayHasKey($field, $result->getMessages());
    }

    /**
     * @return array<string, array{string}>
     */
    public static function requiredFieldProvider(): array
    {
        return [
            'category' => ['pc_catid'],
            'title' => ['pc_title'],
            'duration' => ['pc_duration'],
            'home text' => ['pc_hometext'],
            'status' => ['pc_apptstatus'],
            'event date' => ['pc_eventDate'],
            'start time' => ['pc_startTime'],
            'facility' => ['pc_facility'],
            'billing location' => ['pc_billing_location'],
        ];
    }

    #[DataProvider('requiredFieldProvider')]
    public function testRejectsMissingRequiredField(string $field): void
    {
        $appointment = $this->validAppointment();
        unset($appointment[$field]);

        $result = $this->validateAppointment($appointment);
        $this->assertFalse($result->isValid());
        $this->assertArrayHasKey($field, $result->getMessages());
    }
}
