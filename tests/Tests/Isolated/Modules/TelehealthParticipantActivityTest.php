<?php

/**
 * Isolated contract tests for the sparse participant list used by room polling.
 * The real service is loaded, but its constructor and provisioning methods are
 * never called.
 *
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Modules;

use Comlink\OpenEMR\Modules\TeleHealthModule\Services\ParticipantListService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use stdClass;

#[Group('isolated')]
#[Group('modules')]
final class TelehealthParticipantActivityTest extends TestCase
{
    private string $originalTimezone;

    protected function setUp(): void
    {
        require_once dirname(__DIR__, 4) . '/interface/modules/custom_modules/oe-module-comlink-telehealth/src/Services/ParticipantListService.php';
        $this->originalTimezone = date_default_timezone_get();
        date_default_timezone_set('Europe/Stockholm');
    }

    protected function tearDown(): void
    {
        date_default_timezone_set($this->originalTimezone);
    }

    private function service(): ParticipantListService
    {
        $source = dirname(__DIR__, 4) . '/interface/modules/custom_modules/oe-module-comlink-telehealth/src/Services/ParticipantListService.php';
        $reflection = new ReflectionClass(ParticipantListService::class);
        self::assertSame(realpath($source), $reflection->getFileName());
        self::assertTrue($reflection->getMethod('getSparseParticipantListFromSession')->isPublic());
        return $reflection->newInstanceWithoutConstructor();
    }

    /**
     * Calls the actual public API and records PHP warnings, including warnings
     * that a test runner might otherwise convert to exceptions or suppress.
     *
     * @param array<string, mixed> $session
     * @return array<mixed>
     */
    private function sparseList(array $session): array
    {
        $warnings = [];
        set_error_handler(static function (int $severity, string $message) use (&$warnings): bool {
            $warnings[] = [$severity, $message];
            return true;
        });
        try {
            $result = $this->service()->getSparseParticipantListFromSession($session);
        } finally {
            restore_error_handler();
        }
        self::assertSame([], $warnings, 'Sparse participant polling must not emit PHP warnings');
        return $result;
    }

    /** @return array<string, array{string, mixed}> */
    public static function invalidUpdateProvider(): array
    {
        $futureYear = (int) date('Y') + 2;
        $future = $futureYear . '-06-01 12:00:00';
        return [
            'null' => ['null', null],
            'integer' => ['integer', 42],
            'float' => ['float', 1.25],
            'boolean' => ['boolean', true],
            'array' => ['array', [$future]],
            'object' => ['object', new stdClass()],
            'unparseable string' => ['unparseable string', 'not-a-date'],
            'NUL byte' => ['NUL byte', $future . "\0"],
            'trailing text' => ['trailing text', $future . ' extra'],
            'leading whitespace' => ['leading whitespace', ' ' . $future],
            'trailing whitespace' => ['trailing whitespace', $future . ' '],
            'unpadded month' => ['unpadded month', $futureYear . '-6-01 12:00:00'],
            'unpadded day' => ['unpadded day', $futureYear . '-06-1 12:00:00'],
            'unpadded hour' => ['unpadded hour', $futureYear . '-06-01 2:00:00'],
            'unpadded minute' => ['unpadded minute', $futureYear . '-06-01 12:0:00'],
            'unpadded second' => ['unpadded second', $futureYear . '-06-01 12:00:0'],
            'overflow day' => ['overflow day', $futureYear . '-02-30 12:00:00'],
            'overflow month' => ['overflow month', $futureYear . '-13-01 12:00:00'],
            'overflow hour' => ['overflow hour', $futureYear . '-06-01 24:00:00'],
            'overflow minute' => ['overflow minute', $futureYear . '-06-01 12:60:00'],
            'overflow second' => ['overflow second', $futureYear . '-06-01 12:00:60'],
            'zero date' => ['zero date', $futureYear . '-00-00 12:00:00'],
            'zero year' => ['zero year', '0000-06-01 12:00:00'],
        ];
    }

    /**
     * @param mixed $update
     */
    #[DataProvider('invalidUpdateProvider')]
    public function testInvalidLastUpdateFailsClosedForEveryParticipant(string $case, mixed $update): void
    {
        foreach (['provider', 'patient', 'patient_related'] as $key) {
            $session = ['user_id' => 101, $key . '_start_time' => 'present', $key . '_last_update' => $update];
            $expected = [['role' => 'provider', 'inRoom' => 'N', 'id' => 101]];
            if ($key === 'patient') {
                $session['pid'] = 202;
                $expected[] = ['role' => 'patient', 'inRoom' => 'N', 'id' => 202];
            } elseif ($key === 'patient_related') {
                $session['pid_related'] = 303;
                $expected[] = ['role' => 'patient', 'inRoom' => 'N', 'id' => 303];
            }
            self::assertSame($expected, $this->sparseList($session), "$key: $case");
        }
    }

    public function testMissingOrEmptyStartAndUpdateReturnN(): void
    {
        $recent = (new \DateTimeImmutable('now'))->modify('-5 seconds')->format('Y-m-d H:i:s');
        foreach (['provider', 'patient', 'patient_related'] as $key) {
            $session = ['user_id' => 101, 'pid' => 202, 'pid_related' => 303];
            $expected = [
                ['role' => 'provider', 'inRoom' => 'N', 'id' => 101],
                ['role' => 'patient', 'inRoom' => 'N', 'id' => 202],
                ['role' => 'patient', 'inRoom' => 'N', 'id' => 303],
            ];
            foreach ([[], [$key . '_start_time' => ''], [$key . '_start_time' => 'present'],
                [$key . '_start_time' => 'present', $key . '_last_update' => ''],
                [$key . '_start_time' => 'present', $key . '_last_update' => '0'],
                [$key . '_start_time' => '', $key . '_last_update' => $recent]] as $fields) {
                self::assertSame($expected, $this->sparseList($session + $fields), $key);
            }
        }
    }

    public function testSparseWireOrderIdsAndRoomStatusUseLocalTimeAndFifteenSeconds(): void
    {
        $now = new \DateTimeImmutable('now');
        $recent = $now->modify('-5 seconds')->format('Y-m-d H:i:s');
        $stale = $now->modify('-60 seconds')->format('Y-m-d H:i:s');
        $future = $now->modify('+1 hour')->format('Y-m-d H:i:s');

        self::assertSame(
            [['role' => 'provider', 'inRoom' => 'N', 'id' => 101]],
            $this->sparseList(['user_id' => 101, 'pid' => null, 'pid_related' => 0])
        );

        self::assertSame(
            [
                ['role' => 'provider', 'inRoom' => 'Y', 'id' => 101],
                ['role' => 'patient', 'inRoom' => 'N', 'id' => 202],
                ['role' => 'patient', 'inRoom' => 'Y', 'id' => 303],
            ],
            $this->sparseList([
                'user_id' => 101,
                'pid' => 202,
                'pid_related' => 303,
                // A truthy start time is sufficient; only last_update is parsed.
                'provider_start_time' => 'not-a-date',
                'provider_last_update' => $recent,
                'patient_start_time' => 'present',
                'patient_last_update' => $stale,
                'patient_related_start_time' => 'present',
                'patient_related_last_update' => $future,
            ])
        );
    }

    public function testCanonicalDatesFarFromActivityBoundaryRemainValid(): void
    {
        $futureLeapYear = (int) date('Y') + 1;
        while ($futureLeapYear % 4 !== 0 || ($futureLeapYear % 100 === 0 && $futureLeapYear % 400 !== 0)) {
            $futureLeapYear++;
        }
        $session = [
            'user_id' => 101,
            'pid' => 202,
            'pid_related' => 303,
            'provider_start_time' => 'present',
            'provider_last_update' => $futureLeapYear . '-02-29 12:00:00',
            'patient_start_time' => 'present',
            'patient_last_update' => '2020-06-01 12:00:00',
            'patient_related_start_time' => 'present',
            'patient_related_last_update' => (new \DateTimeImmutable('now'))->modify('+1 hour')->format('Y-m-d H:i:s'),
        ];

        self::assertSame(
            [
                ['role' => 'provider', 'inRoom' => 'Y', 'id' => 101],
                ['role' => 'patient', 'inRoom' => 'N', 'id' => 202],
                ['role' => 'patient', 'inRoom' => 'Y', 'id' => 303],
            ],
            $this->sparseList($session)
        );
    }
}
