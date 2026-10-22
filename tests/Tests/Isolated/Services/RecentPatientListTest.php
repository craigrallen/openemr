<?php

/**
 * Native, no-transport coverage for the recent-patient read side.
 * The writer serializes the original pid value, so accepted values retain type.
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use ADOConnection;
use ADORecordSet;
use ErrorException;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Services\PatientService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionFunction;
use ReflectionMethod;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class RecentPatientListTest extends TestCase
{
    private const RECENT_SQL = 'SELECT patients FROM recent_patients WHERE user_id = ?';
    private const USER_SQL = 'SELECT * FROM `users` WHERE `id` = ?';

    public static function setUpBeforeClass(): void
    {
        // BaseService loads code_types.inc.php, which loads the real sql.inc.php.
        // This existing guard skips both its top-level schema read and the
        // sql.inc.php connection setup; it does not replace either function.
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
    }

    protected function setUp(): void
    {
        parent::setUp();

        // Loading PatientService also includes the real sql.inc.php, whose
        // top-level code asks for a session before any query is executed.
        $storage = new MockArraySessionStorage();
        SessionWrapperFactory::getInstance()->setActiveSession(new Session($storage), $storage);
    }

    /**
     * @param list<array{string, array{int}, array<string, mixed>|false}> $reads
     */
    private function expectOnlyReads(array $reads): void
    {
        $results = [];
        foreach ($reads as [, , $row]) {
            $result = $this->getMockBuilder(ADORecordSet::class)
                ->disableOriginalConstructor()
                ->onlyMethods(['FetchRow'])
                ->getMock();
            $result->EOF = false;
            $result->expects($this->once())->method('FetchRow')->willReturn($row);
            $results[] = $result;
        }

        $connection = $this->getMockBuilder(ADOConnection::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['Execute'])
            ->getMock();
        $position = 0;
        $connection->expects($this->exactly(count($reads)))
            ->method('Execute')
            ->willReturnCallback(function ($sql, $binds, $insertNeedReturn) use ($reads, $results, &$position): ADORecordSet {
                $expected = $reads[$position];
                self::assertSame($expected[0], $sql, 'No other SQL may be executed');
                self::assertSame($expected[1], $binds, 'Query must bind exactly the intended user');
                self::assertTrue($insertNeedReturn);
                return $results[$position++];
            });
        OEGlobalsBag::getInstance()->set('adodb', ['db' => $connection]);
    }

    private function service(): PatientService
    {
        $method = new ReflectionMethod(PatientService::class, 'getRecentPatientList');
        self::assertSame(realpath(__DIR__ . '/../../../../src/Services/PatientService.php'), $method->getFileName());
        self::assertSame(realpath(__DIR__ . '/../../../../library/sql.inc.php'), (new ReflectionFunction('sqlQuery'))->getFileName());

        return (new ReflectionClass(PatientService::class))->newInstanceWithoutConstructor();
    }

    private function read(mixed $serialized, int $userId = 41, bool $rowExists = true): array
    {
        $this->expectOnlyReads([[self::RECENT_SQL, [$userId], $rowExists ? ['patients' => $serialized] : false]]);

        return $this->withoutDiagnostics(fn(): array => $this->service()->getRecentPatientList($userId));
    }

    /** @param callable(): array $read */
    private function withoutDiagnostics(callable $read): array
    {
        // A truncated serialization emits E_NOTICE/E_WARNING on some PHP
        // versions. It is a failure even if the method happens to return [].
        set_error_handler(static function (int $severity, string $message): never {
            throw new ErrorException($message, 0, $severity);
        });
        try {
            return $read();
        } finally {
            restore_error_handler();
        }
    }

    public function testMissingRowAndEmptyListReturnEmptyArray(): void
    {
        self::assertSame([], $this->read(false, rowExists: false));
        self::assertSame([], $this->read(serialize([])));
    }

    public function testValidLegacyValuesKeepOrderDuplicatesTypeAndSparseOuterKeys(): void
    {
        $oversized = '999999999999999999999999999999999999999';
        $stored = [
            9 => ['pid' => 7, 'name' => 'discard'],
            3 => ['pid' => '007', 'extra' => ['discard']],
            17 => ['pid' => 7],
            28 => ['pid' => $oversized],
            32 => ['pid' => '42'],
        ];

        self::assertSame(
            [['pid' => 7], ['pid' => '007'], ['pid' => 7], ['pid' => $oversized], ['pid' => '42']],
            $this->read(serialize($stored)),
        );
    }

    /** @return array<string, array{string}> */
    public static function malformedRoots(): array
    {
        return [
            'false' => [serialize(false)],
            'null' => [serialize(null)],
            'scalar integer' => [serialize(5)],
            'scalar string' => [serialize('7')],
            'object' => [serialize((object) ['pid' => 7])],
            'invalid' => ['not serialized'],
            'truncated' => ['a:1:{i:0;a:1:{s:3:"pid";i:7;}'],
            'leading newline' => ["\n" . serialize([['pid' => 7]])],
            'embedded NUL' => [serialize([['pid' => 7]]) . "\0"],
            'trailing junk' => [serialize([['pid' => 7]]) . 'junk'],
        ];
    }

    #[DataProvider('malformedRoots')]
    public function testMalformedRootReturnsEmptyArrayWithoutDiagnostic(string $serialized): void
    {
        self::assertSame([], $this->read($serialized));
    }

    /** @return array<string, array{mixed}> */
    public static function nonStringPersistedColumns(): array
    {
        return [
            'null column' => [null],
            'false column' => [false],
            'integer column' => [7],
            'array column' => [[['pid' => 7]]],
            'object column' => [(object) ['pid' => 7]],
        ];
    }

    #[DataProvider('nonStringPersistedColumns')]
    public function testNonStringPersistedColumnReturnsEmptyArrayWithoutDiagnostic(mixed $column): void
    {
        self::assertSame([], $this->read($column));
    }

    /** @return array<string, array{mixed}> */
    public static function malformedEntries(): array
    {
        return [
            'missing pid' => [['name' => 'x']],
            'nested pid array' => [['pid' => [7]]],
            'pid object' => [['pid' => (object) ['id' => 7]]],
            'null pid' => [['pid' => null]],
            'boolean pid' => [['pid' => true]],
            'float pid' => [['pid' => 7.0]],
            'zero integer' => [['pid' => 0]],
            'negative integer' => [['pid' => -7]],
            'zero string' => [['pid' => '0']],
            'leading-zero zero' => [['pid' => '000']],
            'negative string' => [['pid' => '-7']],
            'positive sign' => [['pid' => '+7']],
            'decimal point' => [['pid' => '7.0']],
            'exponent' => [['pid' => '7e2']],
            'whitespace' => [['pid' => ' 7']],
            'empty string' => [['pid' => '']],
            'alphabetic' => [['pid' => 'seven']],
            'scalar entry' => ['7'],
            'null entry' => [null],
            'object entry' => [(object) ['pid' => 7]],
        ];
    }

    #[DataProvider('malformedEntries')]
    public function testMalformedEntryIsDroppedWithoutDiagnostic(mixed $entry): void
    {
        self::assertSame(
            [['pid' => 11], ['pid' => '0012']],
            $this->read(serialize([['pid' => 11], $entry, ['pid' => '0012']])),
        );
    }

    public function testObjectCannotWakeDuringDeserialization(): void
    {
        RecentPatientWakeupProbe::$woke = false;
        $serialized = serialize([new RecentPatientWakeupProbe(), ['pid' => 23]]);
        self::assertSame([['pid' => 23]], $this->read($serialized));
        self::assertFalse(RecentPatientWakeupProbe::$woke);
    }

    public function testZeroUserIdUsesSessionAndOnlyItsUserLookup(): void
    {
        $session = $this->createMock(SessionInterface::class);
        $session->expects($this->once())->method('get')->with('authUserID')->willReturn(83);
        SessionWrapperFactory::getInstance()->setActiveSession($session);
        $this->expectOnlyReads([
            [self::USER_SQL, [83], ['id' => 83]],
            [self::RECENT_SQL, [83], ['patients' => serialize([['pid' => '0005']])]],
        ]);

        self::assertSame(
            [['pid' => '0005']],
            $this->withoutDiagnostics(fn(): array => $this->service()->getRecentPatientList()),
        );
    }
}

final class RecentPatientWakeupProbe
{
    public static bool $woke = false;

    public function __wakeup(): void
    {
        self::$woke = true;
    }
}
