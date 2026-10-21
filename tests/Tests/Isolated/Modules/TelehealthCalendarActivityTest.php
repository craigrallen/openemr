<?php

/**
 * Synthetic, isolated coverage of the Comlink telehealth session activity clock.
 * The module under test is loaded explicitly; the sibling vendor autoloader and
 * OpenEMR ServiceContainer are the only bootstrap dependencies.
 *
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Modules;

use Comlink\OpenEMR\Modules\TeleHealthModule\Util\CalendarUtils;
use DateTime;
use DateTimeImmutable;
use LogicException;
use OpenEMR\BC\ServiceContainer;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;
use ReflectionClass;

#[Group('isolated')]
#[Group('modules')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class TelehealthCalendarActivityTest extends TestCase
{
    private string $originalTimezone;

    protected function setUp(): void
    {
        $target = dirname(__DIR__, 4) . '/interface/modules/custom_modules/oe-module-comlink-telehealth/src/Util/CalendarUtils.php';
        require_once $target;
        self::assertSame(realpath($target), (new ReflectionClass(CalendarUtils::class))->getFileName());

        $this->originalTimezone = date_default_timezone_get();
        date_default_timezone_set('UTC');
        ServiceContainer::reset();
        ServiceContainer::override(LoggerInterface::class, new NullLogger());
    }

    protected function tearDown(): void
    {
        ServiceContainer::reset();
        date_default_timezone_set($this->originalTimezone);
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function invalidSessionProvider(): array
    {
        return [
            'missing key' => [[]],
            'null' => [['provider_last_update' => null]],
            'empty string' => [['provider_last_update' => '']],
            'integer' => [['provider_last_update' => 20240601]],
            'boolean' => [['provider_last_update' => false]],
            'float' => [['provider_last_update' => 1.5]],
            'array' => [['provider_last_update' => ['2024-06-01 12:00:00']]],
            'leading whitespace' => [['provider_last_update' => ' 2024-06-01 12:00:00']],
            'trailing whitespace' => [['provider_last_update' => '2024-06-01 12:00:00 ']],
            'trailing bytes' => [['provider_last_update' => '2024-06-01 12:00:00junk']],
            'embedded NUL' => [['provider_last_update' => "2024-06-01 12:00:00\0junk"]],
            'short month' => [['provider_last_update' => '2024-6-01 12:00:00']],
            'short hour' => [['provider_last_update' => '2024-06-01 2:00:00']],
            'wrong separator' => [['provider_last_update' => '2024/06/01 12:00:00']],
            'timezone suffix' => [['provider_last_update' => '2024-06-01 12:00:00Z']],
            'fractional seconds' => [['provider_last_update' => '2024-06-01 12:00:00.000000']],
            'zero date' => [['provider_last_update' => '0000-00-00 00:00:00']],
            'zero month' => [['provider_last_update' => '2024-00-01 12:00:00']],
            'zero day' => [['provider_last_update' => '2024-06-00 12:00:00']],
            'normalized non-leap day' => [['provider_last_update' => '2023-02-29 12:00:00']],
            'normalized April day' => [['provider_last_update' => '2024-04-31 12:00:00']],
            'month out of range' => [['provider_last_update' => '2024-13-01 12:00:00']],
            'hour out of range' => [['provider_last_update' => '2024-06-01 24:00:00']],
            'minute out of range' => [['provider_last_update' => '2024-06-01 12:60:00']],
            'second out of range' => [['provider_last_update' => '2024-06-01 12:00:60']],
            'year wider than format' => [['provider_last_update' => '10000-06-01 12:00:00']],
        ];
    }

    #[DataProvider('invalidSessionProvider')]
    public function testInvalidSessionReturnsFalseWithoutLogging(array $session): void
    {
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::never())->method('debug');
        ServiceContainer::override(LoggerInterface::class, $logger);

        self::assertFalse(CalendarUtils::isTelehealthSessionInActiveTimeRange(
            $session,
            new DateTimeImmutable('2024-06-01 12:00:10'),
        ));
    }

    public function testStringableObjectIsRejectedWithoutExecutingIt(): void
    {
        $value = new class {
            public function __toString(): string
            {
                throw new LogicException('Untrusted object behavior must not run');
            }
        };
        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects(self::never())->method('debug');
        ServiceContainer::override(LoggerInterface::class, $logger);

        self::assertFalse(CalendarUtils::isTelehealthSessionInActiveTimeRange(
            ['provider_last_update' => $value],
            new DateTimeImmutable('2024-06-01 12:00:10'),
        ));
    }

    /** @return array<string, array{string, string, bool}> */
    public static function sessionActivityProvider(): array
    {
        return [
            'recent' => ['2024-06-01 12:00:00', '2024-06-01 12:00:10', true],
            'stale' => ['2024-06-01 12:00:00', '2024-06-01 12:00:16', false],
            'future remains accepted' => ['2024-06-01 12:00:30', '2024-06-01 12:00:10', true],
            'one microsecond before expiry' => ['2024-06-01 12:00:00', '2024-06-01 12:00:14.999999', true],
            'exact expiry is inactive' => ['2024-06-01 12:00:00', '2024-06-01 12:00:15.000000', false],
            'one microsecond after expiry' => ['2024-06-01 12:00:00', '2024-06-01 12:00:15.000001', false],
            'leap day' => ['2024-02-29 12:00:00', '2024-02-29 12:00:10', true],
        ];
    }

    #[DataProvider('sessionActivityProvider')]
    public function testExactSessionTimestampUsesStrictFifteenSecondExpiry(string $value, string $clock, bool $expected): void
    {
        self::assertSame($expected, CalendarUtils::isTelehealthSessionInActiveTimeRange(
            ['provider_last_update' => $value],
            new DateTimeImmutable($clock),
        ));
    }

    /** @return array<string, array{string, string, string, bool}> */
    public static function localTimezoneProvider(): array
    {
        return [
            'UTC' => ['UTC', '2024-06-01 12:00:00', '2024-06-01 12:00:10+00:00', true],
            'Stockholm summer local time' => ['Europe/Stockholm', '2024-06-01 12:00:00', '2024-06-01 10:00:10+00:00', true],
            'Stockholm winter local time' => ['Europe/Stockholm', '2024-01-15 12:00:00', '2024-01-15 11:00:10+00:00', true],
            'Stockholm local stale time' => ['Europe/Stockholm', '2024-06-01 12:00:00', '2024-06-01 10:00:15+00:00', false],
        ];
    }

    #[DataProvider('localTimezoneProvider')]
    public function testSessionTimestampUsesServerLocalTimezone(string $timezone, string $value, string $clock, bool $expected): void
    {
        date_default_timezone_set($timezone);
        self::assertSame($expected, CalendarUtils::isTelehealthSessionInActiveTimeRange(
            ['provider_last_update' => $value],
            new DateTimeImmutable($clock),
        ));
    }

    public function testLastSeenHelperRetainsStrictExpiryAndDoesNotMutateArgumentOnRepeatedCalls(): void
    {
        $lastSeen = new DateTime('2024-06-01 12:00:00');
        $original = $lastSeen->format('Y-m-d H:i:s.u P');

        self::assertTrue(CalendarUtils::isUserLastSeenTimeInActiveRange($lastSeen, new DateTimeImmutable('2024-06-01 12:00:14.999999')));
        self::assertSame($original, $lastSeen->format('Y-m-d H:i:s.u P'));
        self::assertTrue(CalendarUtils::isUserLastSeenTimeInActiveRange($lastSeen, new DateTimeImmutable('2024-06-01 12:00:14.999999')));
        self::assertSame($original, $lastSeen->format('Y-m-d H:i:s.u P'));
        self::assertFalse(CalendarUtils::isUserLastSeenTimeInActiveRange($lastSeen, new DateTimeImmutable('2024-06-01 12:00:15.000000')));
        self::assertFalse(CalendarUtils::isUserLastSeenTimeInActiveRange($lastSeen, new DateTimeImmutable('2024-06-01 12:00:15.000001')));
        self::assertTrue(CalendarUtils::isUserLastSeenTimeInActiveRange($lastSeen, new DateTimeImmutable('2024-06-01 11:59:59')));
        self::assertSame($original, $lastSeen->format('Y-m-d H:i:s.u P'));
    }
}
