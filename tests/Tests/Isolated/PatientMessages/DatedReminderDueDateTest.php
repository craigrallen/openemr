<?php

/**
 * Date validation at the native dated-reminder send boundary. A mocked ADODB
 * transport observes the real QueryUtils lookup; no reminder is persisted.
 *
 * @package OpenEMR
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientMessages;

use ADOConnection;
use ADORecordSet;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\OEGlobalsBag;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use ReflectionFunction;
use Symfony\Component\HttpFoundation\Session\SessionInterface;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class DatedReminderDueDateTest extends TestCase
{
    private const ROOT = __DIR__ . '/../../../..';

    private bool $hadAdodb = false;
    private mixed $originalAdodb = null;

    protected function setUp(): void
    {
        $this->hadAdodb = array_key_exists('adodb', $GLOBALS);
        $this->originalAdodb = $GLOBALS['adodb'] ?? null;

        // sql.inc.php supplies the real global SQL functions. This existing
        // OpenEMR switch skips its connection initialization in this child.
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
        self::assertTrue(OPENEMR_STATIC_ANALYSIS, 'SQL bootstrap must not open a connection');
        SessionWrapperFactory::getInstance()->setActiveSession($this->createMock(SessionInterface::class));
        require_once self::ROOT . '/library/sql.inc.php';
        require_once self::ROOT . '/library/dated_reminder_functions.php';

        self::assertSame(
            realpath(self::ROOT . '/library/dated_reminder_functions.php'),
            (new ReflectionFunction('sendReminder'))->getFileName(),
            'The test must call the native global sendReminder function'
        );
    }

    protected function tearDown(): void
    {
        if ($this->hadAdodb) {
            OEGlobalsBag::getInstance()->set('adodb', $this->originalAdodb);
        } else {
            OEGlobalsBag::getInstance()->remove('adodb');
            unset($GLOBALS['adodb']);
        }
    }

    /**
     * @return array<string, array{?string}>
     */
    public static function invalidDueDates(): array
    {
        return [
            'ordinary year February 29' => ['2023-02-29'],
            'non-leap century February 29' => ['1900-02-29'],
            'February 30' => ['2024-02-30'],
            'February 31' => ['2024-02-31'],
            'April 31' => ['2024-04-31'],
            'month zero' => ['2024-00-01'],
            'month thirteen' => ['2024-13-01'],
            'day zero' => ['2024-01-00'],
            'day thirty two' => ['2024-01-32'],
            'year zero' => ['0000-01-01'],
            'valid substring with prefix' => ['x2024-02-29'],
            'valid substring with suffix' => ['2024-02-29x'],
            'trailing line feed' => ["2024-02-29\n"],
            'trailing carriage return and line feed' => ["2024-02-29\r\n"],
            'trailing NUL' => ["2024-02-29\0"],
            'leading whitespace' => [' 2024-02-29'],
            'trailing whitespace' => ['2024-02-29 '],
            'timestamp suffix' => ['2024-02-29 12:34:56'],
            'single digit month' => ['2024-2-29'],
            'single digit day' => ['2024-02-9'],
            'Arabic-Indic digits' => ['٢٠٢٤-٠٢-٢٩'],
            'empty string' => [''],
            'null' => [null],
        ];
    }

    #[DataProvider('invalidDueDates')]
    public function testInvalidDueDateReturnsBeforeAnyDatabaseExecution(?string $dueDate): void
    {
        $database = $this->mockDatabase();
        $database->expects(self::never())->method('Execute');

        self::assertFalse(\sendReminder([7], 3, 'Follow up', $dueDate, 42, 2));
    }

    /**
     * @return array<string, array{string, int|string|array<int|string>, array<int|string>, int|string}>
     */
    public static function validDueDatesAndRecipients(): array
    {
        return [
            'leap day in 2000, patient zero' => ['2000-02-29', [7], [7], 0],
            'leap day in 2024, patient ID' => ['2024-02-29', [7], [7], 42],
            'non-leap century February 28' => ['1900-02-28', [7], [7], 42],
            'first Gregorian year' => ['0001-01-01', [7], [7], 42],
            'last four-digit year' => ['9999-12-31', [7], [7], 42],
            'ordinary date with typed recipient binds' => ['2026-10-27', [7, '8'], [7, '8'], '42'],
            'single recipient caller mode' => ['2026-10-27', '8', ['8'], 42],
        ];
    }

    /**
     * @param int|string|array<int|string> $sendTo
     * @param array<int|string> $expectedBinds
     */
    #[DataProvider('validDueDatesAndRecipients')]
    public function testValidDueDateReachesExactRecipientLookupWithoutWriting(
        string $dueDate,
        int|string|array $sendTo,
        array $expectedBinds,
        int|string $patientId
    ): void {
        $database = $this->mockDatabase();
        $recordSet = $this->getMockBuilder(ADORecordSet::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['FetchRow'])
            ->getMock();
        $recordSet->EOF = false;
        $recordSet->expects(self::once())->method('FetchRow')->willReturn(['cnt' => 0]);

        $placeholders = implode(',', array_fill(0, count($expectedBinds), '?'));
        $database->expects(self::once())
            ->method('Execute')
            ->with(
                self::identicalTo("SELECT COUNT(id) AS cnt FROM `users` WHERE `id` IN ($placeholders)"),
                self::identicalTo($expectedBinds)
            )
            ->willReturn($recordSet);

        self::assertFalse(\sendReminder($sendTo, 3, 'Follow up', $dueDate, $patientId, 2));
    }

    /**
     * @return array<string, array{mixed, mixed, mixed, mixed, mixed, mixed}>
     */
    public static function otherGuardFailures(): array
    {
        return [
            'empty recipients' => [[], 3, 'Follow up', '2024-02-29', 42, 2],
            'nonnumeric recipient' => [[7, 'invalid'], 3, 'Follow up', '2024-02-29', 42, 2],
            'priority above three' => [[7], 3, 'Follow up', '2024-02-29', 42, 4],
            'empty message' => [[7], 3, '', '2024-02-29', 42, 2],
            'message above 255 characters' => [[7], 3, str_repeat('a', 256), '2024-02-29', 42, 2],
            'nonnumeric patient' => [[7], 3, 'Follow up', '2024-02-29', 'patient-x', 2],
        ];
    }

    #[DataProvider('otherGuardFailures')]
    public function testOtherGuardFailuresStillAvoidDatabase(
        mixed $sendTo,
        mixed $fromId,
        mixed $message,
        mixed $dueDate,
        mixed $patientId,
        mixed $priority
    ): void {
        $database = $this->mockDatabase();
        $database->expects(self::never())->method('Execute');

        self::assertFalse(\sendReminder($sendTo, $fromId, $message, $dueDate, $patientId, $priority));
    }

    private function mockDatabase(): ADOConnection&MockObject
    {
        $database = $this->getMockBuilder(ADOConnection::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['Execute'])
            ->getMock();
        OEGlobalsBag::getInstance()->set('adodb', ['db' => $database]);

        return $database;
    }
}
