<?php

/**
 * Native regression coverage for an absent document metadata row.
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use ADOConnection;
use ADORecordSet;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Services\DocumentService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionFunction;
use ReflectionMethod;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class DocumentReferenceReadTest extends TestCase
{
    private const METADATA_SQL = 'SELECT `name`, `mimetype` FROM `documents` WHERE `id` = ? AND `foreign_id` = ? AND `deleted` = 0';

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

        class_exists(DocumentService::class);

        self::assertSame(
            realpath(__DIR__ . '/../../../../src/Services/DocumentService.php'),
            (new ReflectionMethod(DocumentService::class, 'getFile'))->getFileName(),
        );
        self::assertSame(
            realpath(__DIR__ . '/../../../../library/sql.inc.php'),
            (new ReflectionFunction('sqlQuery'))->getFileName(),
        );
    }

    /**
     * A deleted row or another patient's row is represented by the same
     * absent result from the filtered metadata query. There is no live DB.
     *
     * @return array<string, array{int, int, array<mixed>|false, bool}>
     */
    public static function absentMetadataRows(): array
    {
        return [
            'missing document, EOF' => [73, 41, false, true],
            'missing document, false FetchRow' => [73, 42, false, false],
            'missing document, empty row' => [73, 43, [], false],
            'deleted document excluded by SQL' => [73, 44, false, true],
            'other patient document excluded by SQL' => [74, 41, false, true],
        ];
    }

    #[DataProvider('absentMetadataRows')]
    public function testAbsentMetadataReturnsFalseAfterOnlyTheBoundLookup(
        int $pid,
        int $did,
        array|false $row,
        bool $eof,
    ): void {
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

        // sqlQuery is the real library function. Its QueryUtils path must
        // execute exactly one bound lookup. Any later DB access from a
        // C_Document constructor or retrieval violates this expectation.
        $connection = $this->getMockBuilder(ADOConnection::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['Execute'])
            ->getMock();
        $connection->expects($this->once())
            ->method('Execute')
            ->with(self::METADATA_SQL, [$did, $pid], true)
            ->willReturn($result);
        OEGlobalsBag::getInstance()->set('adodb', ['db' => $connection]);

        // Avoid the DocumentService constructor: it reads the schema and
        // backfills UUIDs, neither of which belongs in an isolated read test.
        $service = (new ReflectionClass(DocumentService::class))->newInstanceWithoutConstructor();

        self::assertFalse($service->getFile($pid, $did));
    }
}
