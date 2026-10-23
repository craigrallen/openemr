<?php

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use ADOConnection;
use ADORecordSet;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Services\PatientPortalService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use ReflectionFunction;
use ReflectionMethod;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class PortalPatientLookupTest extends TestCase
{
    private const PATIENT_SQL = 'Select `pid`, `email`, `email_direct` From `patient_data` Where `pid` = ?';
    private const PORTAL_SQL = 'Select `pid`, `portal_username` From `patient_access_onsite` Where `pid` = ?';

    public static function setUpBeforeClass(): void
    {
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
    }

    protected function setUp(): void
    {
        parent::setUp();

        $storage = new MockArraySessionStorage();
        SessionWrapperFactory::getInstance()->setActiveSession(new Session($storage), $storage);
        require_once __DIR__ . '/../../../../library/sql.inc.php';

        self::assertSame(
            realpath(__DIR__ . '/../../../../src/Services/PatientPortalService.php'),
            (new ReflectionMethod(PatientPortalService::class, 'isValidPortalPatient'))->getFileName(),
        );
        self::assertSame(
            realpath(__DIR__ . '/../../../../library/sql.inc.php'),
            (new ReflectionFunction('sqlQuery'))->getFileName(),
        );
    }

    /** @return array<string, array{mixed}> */
    public static function falsyPids(): array
    {
        return [
            'null' => [null],
            'false' => [false],
            'integer zero' => [0],
            'string zero' => ['0'],
            'empty string' => [''],
            'empty array' => [[]],
        ];
    }

    #[DataProvider('falsyPids')]
    public function testFalsyPidDoesNotQuery(mixed $pid): void
    {
        $this->expectQueries([]);

        self::assertSame(['valid' => false], PatientPortalService::isValidPortalPatient($pid));
    }

    /** @return array<string, array{array<mixed>|false, bool}> */
    public static function absentPatientRows(): array
    {
        return [
            'recordset EOF' => [false, true],
            'FetchRow false' => [false, false],
            'FetchRow empty array' => [[], false],
        ];
    }

    /** @param array<mixed>|false $row */
    #[DataProvider('absentPatientRows')]
    public function testAbsentPatientStopsBeforePortalLookup(array|false $row, bool $eof): void
    {
        $this->expectQueries([
            [self::PATIENT_SQL, [73], $row, $eof],
        ]);

        self::assertSame(['valid' => false], PatientPortalService::isValidPortalPatient(73));
    }

    /** @return array<string, array{array<mixed>|false, bool}> */
    public static function absentPortalRows(): array
    {
        return [
            'recordset EOF' => [false, true],
            'FetchRow false' => [false, false],
            'FetchRow empty array' => [[], false],
        ];
    }

    /** @param array<mixed>|false $row */
    #[DataProvider('absentPortalRows')]
    public function testAbsentPortalPreservesPatientFields(array|false $row, bool $eof): void
    {
        $patient = ['pid' => 73, 'email' => 'person@example.test', 'email_direct' => null];
        $this->expectQueries([
            [self::PATIENT_SQL, [73], $patient, false],
            [self::PORTAL_SQL, [73], $row, $eof],
        ]);

        self::assertSame($patient + ['valid' => false], PatientPortalService::isValidPortalPatient(73));
    }

    /**
     * @return array<string, array{int|string, array<mixed>, array<mixed>, bool}>
     */
    public static function portalAccounts(): array
    {
        return [
            'integer PID and username' => [73, ['pid' => 73, 'email' => 'a@example.test', 'email_direct' => 'direct@example.test'], ['pid' => 73, 'portal_username' => 'person'], true],
            'string PID and username' => ['73', ['pid' => 73, 'email' => null, 'email_direct' => 'direct@example.test'], ['pid' => 73, 'portal_username' => 'person'], true],
            'string PID with leading zero' => ['0073', ['pid' => '73', 'email' => null, 'email_direct' => null], ['pid' => '073', 'portal_username' => 'person'], true],
            'different account' => [73, ['pid' => 73, 'email' => 'a@example.test', 'email_direct' => null], ['pid' => 74, 'portal_username' => 'other'], false],
            'empty username' => [73, ['pid' => 73, 'email' => null, 'email_direct' => 'direct@example.test'], ['pid' => 73, 'portal_username' => ''], false],
            'string zero username' => [73, ['pid' => 73, 'email' => 'a@example.test', 'email_direct' => null], ['pid' => 73, 'portal_username' => '0'], false],
        ];
    }

    /**
     * @param array<mixed> $patient
     * @param array<mixed> $portal
     */
    #[DataProvider('portalAccounts')]
    public function testPortalAccountEligibilityPreservesPatientFields(int|string $pid, array $patient, array $portal, bool $valid): void
    {
        $this->expectQueries([
            [self::PATIENT_SQL, [$pid], $patient, false],
            [self::PORTAL_SQL, [$patient['pid']], $portal, false],
        ]);

        self::assertSame($patient + ['valid' => $valid], PatientPortalService::isValidPortalPatient($pid));
    }

    /**
     * @param array<int, array{string, array<mixed>, array<mixed>|false, bool}> $queries
     */
    private function expectQueries(array $queries): void
    {
        $results = [];
        foreach ($queries as [, , $row, $eof]) {
            $result = $this->getMockBuilder(ADORecordSet::class)
                ->disableOriginalConstructor()
                ->onlyMethods(['FetchRow'])
                ->getMock();
            $result->EOF = $eof;
            if ($eof) {
                $result->expects($this->never())->method('FetchRow');
            } else {
                $result->expects($this->once())->method('FetchRow')->willReturn($row);
            }
            $results[] = $result;
        }

        $connection = $this->getMockBuilder(ADOConnection::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['Execute'])
            ->getMock();
        $index = 0;
        $connection->expects($this->exactly(count($queries)))
            ->method('Execute')
            ->willReturnCallback(function ($statement, $binds, $log) use ($queries, $results, &$index) {
                self::assertSame($queries[$index][0], $statement);
                self::assertSame($queries[$index][1], $binds);
                self::assertTrue($log);
                return $results[$index++];
            });
        OEGlobalsBag::getInstance()->set('adodb', ['db' => $connection]);
    }
}
