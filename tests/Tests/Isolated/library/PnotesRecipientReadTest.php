<?php

/**
 * Native recipient-read checks for patient notes. Malformed rows below are
 * defensive cases; the ordinary SELECT returns all three selected columns.
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\library;

use OpenEMR\Common\Database\SqlQueryException;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\OEGlobalsBag;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

#[Group('isolated')]
#[Group('security')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class PnotesRecipientReadTest extends TestCase
{
    private const NOTE_SQL = 'SELECT `id`, `user`, `assigned_to` FROM pnotes WHERE id = ? AND deleted != 1';
    private const PORTAL_SQL = 'SELECT `id` FROM users WHERE portal_user = 1 AND username = ? AND active = 1';

    protected function setUp(): void
    {
        // sql.inc.php supplies the real legacy entry points used by QueryUtils.
        // Its static-analysis mode skips database construction.
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
        SessionWrapperFactory::getInstance()->setActiveSession(new Session(new MockArraySessionStorage()));
        if (!class_exists(\ADORecordSet_mysqli::class)) {
            require_once __DIR__ . '/../../../../vendor/adodb/adodb-php/drivers/adodb-mysqli.inc.php';
        }
        require_once __DIR__ . '/../../../../library/ADODB_mysqli_log.php';
        require_once __DIR__ . '/../../../../library/sql.inc.php';
        require_once __DIR__ . '/../../../../library/pnotes.inc.php';
    }

    #[DataProvider('unusableNoteRows')]
    public function testAbsentOrWrongNoteDeniesBeforePortalLookup(array|false $noteRow): void
    {
        $this->installRows([[$noteRow]], [[self::NOTE_SQL, [42]]]);

        self::assertFalse($this->withoutPhpNotices(static fn(): bool => \checkPnotesNoteId(42, 'alice')));
    }

    /** @return array<string, array{array<string, mixed>|false}> */
    public static function unusableNoteRows(): array
    {
        return [
            'no result' => [false],
            'empty row' => [[]],
            'missing id' => [['user' => 'alice', 'assigned_to' => 'portal-user']],
            'empty id' => [['id' => '', 'user' => 'alice', 'assigned_to' => 'portal-user']],
            'zero id' => [['id' => 0, 'user' => 'alice', 'assigned_to' => 'portal-user']],
            'different id' => [['id' => 43, 'user' => 'alice', 'assigned_to' => 'portal-user']],
        ];
    }

    #[DataProvider('incompleteRecipientRows')]
    public function testIncompleteRecipientMetadataDeniesWithoutNoticeOrPortalLookup(array $noteRow): void
    {
        $this->installRows([[$noteRow]], [[self::NOTE_SQL, [42]]]);

        self::assertFalse($this->withoutPhpNotices(static fn(): bool => \checkPnotesNoteId(42, 'alice')));
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function incompleteRecipientRows(): array
    {
        return [
            'missing owner' => [['id' => 42, 'assigned_to' => 'alice']],
            'null owner' => [['id' => 42, 'user' => null, 'assigned_to' => 'alice']],
            'missing assignee' => [['id' => 42, 'user' => 'alice']],
            'null assignee' => [['id' => 42, 'user' => 'alice', 'assigned_to' => null]],
        ];
    }

    #[DataProvider('directRecipients')]
    public function testCompleteDirectRecipientKeepsLooseIdentityAndSkipsPortalLookup(
        array $noteRow,
        string $user
    ): void {
        $this->installRows([[$noteRow]], [[self::NOTE_SQL, [42]]]);

        self::assertTrue($this->withoutPhpNotices(static fn(): bool => \checkPnotesNoteId(42, $user)));
    }

    /** @return array<string, array{array<string, mixed>, string}> */
    public static function directRecipients(): array
    {
        return [
            'owner with string id' => [['id' => '42', 'user' => 'alice', 'assigned_to' => 'bob'], 'alice'],
            'assignee with padded numeric id' => [['id' => '042', 'user' => 'bob', 'assigned_to' => 'alice'], 'alice'],
            'loose numeric owner' => [['id' => 42, 'user' => 42, 'assigned_to' => 'bob'], '42'],
            'loose numeric assignee' => [['id' => 42, 'user' => 'bob', 'assigned_to' => 42], '42'],
            'portal-user is direct assignee' => [['id' => 42, 'user' => 'bob', 'assigned_to' => 'portal-user'], 'portal-user'],
        ];
    }

    #[DataProvider('portalOutcomes')]
    public function testPortalAssigneeUsesExistingActivePortalUserPredicate(
        array|false $portalRow,
        bool $expected
    ): void {
        $this->installRows(
            [[['id' => 42, 'user' => 'bob', 'assigned_to' => 'portal-user']], [$portalRow]],
            [[self::NOTE_SQL, [42]], [self::PORTAL_SQL, ['alice']]]
        );

        self::assertSame($expected, $this->withoutPhpNotices(static fn(): bool => \checkPnotesNoteId(42, 'alice')));
    }

    /** @return array<string, array{array<string, mixed>|false, bool}> */
    public static function portalOutcomes(): array
    {
        return [
            'eligible user' => [['id' => '7'], true],
            'missing user' => [false, false],
            'inactive user filtered by SQL' => [false, false],
            'nonportal user filtered by SQL' => [false, false],
            'empty user row' => [[], false],
            'empty user id' => [['id' => ''], false],
        ];
    }

    public function testUnrelatedNonportalAssigneeStillPerformsExistingLookupAndDenies(): void
    {
        $this->installRows(
            [[['id' => 42, 'user' => 'bob', 'assigned_to' => 'carol']], [['id' => 7]]],
            [[self::NOTE_SQL, [42]], [self::PORTAL_SQL, ['alice']]]
        );

        self::assertFalse($this->withoutPhpNotices(static fn(): bool => \checkPnotesNoteId(42, 'alice')));
    }

    #[DataProvider('failingLookup')]
    public function testSqlFailurePropagates(string $failedSql, array $expectedCalls): void
    {
        $rows = $failedSql === self::NOTE_SQL
            ? [false]
            : [[['id' => 42, 'user' => 'bob', 'assigned_to' => 'portal-user']], false];
        $this->installRows($rows, $expectedCalls);
        OEGlobalsBag::getInstance()->set('last_mysql_error', 'synthetic SQL failure');

        try {
            $this->withoutPhpNotices(static fn(): bool => \checkPnotesNoteId(42, 'alice'));
            self::fail('Expected the SQL error to propagate');
        } catch (SqlQueryException $e) {
            self::assertSame($failedSql, $e->getSqlStatement());
            self::assertStringContainsString('synthetic SQL failure', $e->getMessage());
        }
    }

    /** @return array<string, array{string, list<array{string, list<int|string>}>}> */
    public static function failingLookup(): array
    {
        return [
            'note query' => [self::NOTE_SQL, [[self::NOTE_SQL, [42]]]],
            'portal query' => [self::PORTAL_SQL, [[self::NOTE_SQL, [42]], [self::PORTAL_SQL, ['alice']]]],
        ];
    }

    /**
     * Run the real QueryUtils path through the native ADODB wrapper and recordset.
     * Each response is a single row; false from Execute represents a SQL error.
     * An unexpected dependent query fails at the Execute boundary.
     *
     * @param list<array{array<string, mixed>|false}|false> $responses
     * @param list<array{string, list<int|string>}> $expectedCalls
     */
    private function installRows(array $responses, array $expectedCalls): void
    {
        $transport = $this->getMockBuilder(\ADODB_mysqli_log::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['Execute'])
            ->getMock();
        $transport->expects(self::exactly(count($expectedCalls)))
            ->method('Execute')
            ->willReturnCallback(function (string $sql, array $binds, bool $log) use (&$responses, &$expectedCalls) {
                $expected = array_shift($expectedCalls);
                self::assertNotNull($expected, 'Unexpected dependent SQL query');
                self::assertSame($expected[0], $sql);
                self::assertSame($expected[1], $binds);
                self::assertTrue($log);

                $response = array_shift($responses);
                self::assertNotNull($response, 'No transport response for SQL query');
                if ($response === false) {
                    return false;
                }

                $result = $this->getMockBuilder(\ADORecordSet_mysqli::class)
                    ->disableOriginalConstructor()
                    ->onlyMethods(['FetchRow'])
                    ->getMock();
                $result->EOF = false;
                $result->expects(self::once())->method('FetchRow')->willReturn($response[0]);
                return $result;
            });
        OEGlobalsBag::getInstance()->set('adodb', ['db' => $transport]);
    }

    /** @param callable(): bool $action */
    private function withoutPhpNotices(callable $action): bool
    {
        set_error_handler(static function (int $severity, string $message): never {
            throw new \ErrorException($message, 0, $severity);
        });
        try {
            return $action();
        } finally {
            restore_error_handler();
        }
    }
}
