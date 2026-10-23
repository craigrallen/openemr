<?php

/**
 * Native, no-transport coverage for clinical note linked input.
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use ADOConnection;
use ADORecordSet;
use InvalidArgumentException;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Common\Uuid\UuidRegistry;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Services\ClinicalNotesService;
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
final class ClinicalNoteLinkedInputTest extends TestCase
{
    private const FIRST_UUID = '550e8400-e29b-41d4-a716-446655440000';
    private const SECOND_UUID = '550e8400-e29b-41d4-a716-446655440001';

    public static function setUpBeforeClass(): void
    {
        if (!defined('OPENEMR_STATIC_ANALYSIS')) {
            define('OPENEMR_STATIC_ANALYSIS', true);
        }
    }

    protected function setUp(): void
    {
        parent::setUp();

        // BaseService includes the real sql.inc.php during autoload.
        $storage = new MockArraySessionStorage();
        SessionWrapperFactory::getInstance()->setActiveSession(new Session($storage), $storage);

        self::assertSame(
            realpath(__DIR__ . '/../../../../src/Services/ClinicalNotesService.php'),
            (new ReflectionMethod(ClinicalNotesService::class, 'saveLinkedDocuments'))->getFileName(),
        );
        self::assertSame(
            realpath(__DIR__ . '/../../../../src/Services/ClinicalNotesService.php'),
            (new ReflectionMethod(ClinicalNotesService::class, 'saveLinkedResults'))->getFileName(),
        );
        foreach (['getDocumentIdFromUuid', 'getProcedureResultIdFromUuid'] as $lookup) {
            self::assertSame(
                realpath(__DIR__ . '/../../../../src/Services/ClinicalNotesService.php'),
                (new ReflectionMethod(ClinicalNotesService::class, $lookup))->getFileName(),
            );
        }
        self::assertSame(
            realpath(__DIR__ . '/../../../../library/sql.inc.php'),
            (new ReflectionFunction('sqlStatementThrowException'))->getFileName(),
        );
    }

    /**
     * @return array<string, array{string, string, string, string, string}>
     */
    public static function linkKinds(): array
    {
        return [
            'documents' => [
                'saveLinkedDocuments',
                'DELETE FROM clinical_notes_documents WHERE clinical_note_id = ?',
                'SELECT id FROM documents WHERE uuid = ? AND deleted = 0',
                'id',
                'INSERT INTO clinical_notes_documents (clinical_note_id, document_id, created_by) VALUES (?, ?, ?)',
            ],
            'results' => [
                'saveLinkedResults',
                'DELETE FROM clinical_notes_procedure_results WHERE clinical_note_id = ?',
                'SELECT procedure_result_id FROM procedure_result WHERE uuid = ?',
                'procedure_result_id',
                'INSERT INTO clinical_notes_procedure_results (clinical_note_id, procedure_result_id, created_by) VALUES (?, ?, ?)',
            ],
        ];
    }

    private function service(): ClinicalNotesService
    {
        // Its constructor backfills missing UUIDs and must never run here.
        return (new ReflectionClass(ClinicalNotesService::class))->newInstanceWithoutConstructor();
    }

    /**
     * @param list<array{string, array<mixed>, array<string, mixed>|false|null}> $operations
     */
    private function expectSql(array $operations): void
    {
        $results = [];
        foreach ($operations as [, , $row]) {
            $result = $this->getMockBuilder(ADORecordSet::class)
                ->disableOriginalConstructor()
                ->onlyMethods(['FetchRow'])
                ->getMock();
            if ($row === null) {
                $result->EOF = true;
            } elseif ($row === false) {
                $result->EOF = false;
                $result->expects($this->once())->method('FetchRow')->willReturn(false);
            } else {
                $result->EOF = false;
                $result->expects($this->exactly(2))->method('FetchRow')
                    ->willReturnOnConsecutiveCalls($row, false);
            }
            $results[] = $result;
        }

        $connection = $this->getMockBuilder(ADOConnection::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['Execute'])
            ->getMock();
        $position = 0;
        $connection->expects($this->exactly(count($operations)))
            ->method('Execute')
            ->willReturnCallback(function ($sql, $binds, $insertNeedReturn) use ($operations, $results, &$position): ADORecordSet {
                self::assertSame($operations[$position][0], $sql, 'SQL order and target must match');
                self::assertSame($operations[$position][1], $binds, 'SQL bindings must match');
                self::assertTrue($insertNeedReturn);
                return $results[$position++];
            });
        OEGlobalsBag::getInstance()->set('adodb', ['db' => $connection]);
    }

    /**
     * @param array<mixed> $entries
     */
    private function save(string $method, array $entries): void
    {
        $this->service()->{$method}(73, $entries, 'linked_author');
    }

    #[DataProvider('linkKinds')]
    public function testValidLinksKeepLookupOrderDuplicatesBindingsAndUnknownSkips(
        string $method,
        string $delete,
        string $select,
        string $idColumn,
        string $insert,
    ): void {
        $firstBytes = UuidRegistry::uuidToBytes(self::FIRST_UUID);
        $secondBytes = UuidRegistry::uuidToBytes(self::SECOND_UUID);
        $this->expectSql([
            [$delete, [73], null],
            [$select, [$firstBytes], [$idColumn => 17]],
            [$insert, [73, 17, 'linked_author'], null],
            [$select, [$secondBytes], false],
            [$select, [$firstBytes], [$idColumn => 17]],
            [$insert, [73, 17, 'linked_author'], null],
        ]);

        $this->save($method, [
            ['uuid' => self::FIRST_UUID],
            ['uuid' => self::SECOND_UUID],
            ['uuid' => self::FIRST_UUID],
        ]);
    }

    #[DataProvider('linkKinds')]
    public function testEmptyListClearsExistingLinks(
        string $method,
        string $delete,
        string $select,
        string $idColumn,
        string $insert,
    ): void {
        $this->expectSql([[$delete, [73], null]]);
        $this->save($method, []);
    }

    #[DataProvider('linkKinds')]
    public function testAbsentEmptyAndScalarRowsAreSkippedWithoutLookup(
        string $method,
        string $delete,
        string $select,
        string $idColumn,
        string $insert,
    ): void {
        $this->expectSql([
            [$delete, [73], null],
            [$select, [UuidRegistry::uuidToBytes(self::FIRST_UUID)], [$idColumn => 29]],
            [$insert, [73, 29, 'linked_author'], null],
        ]);
        $this->save($method, [
            [], ['uuid' => null], ['uuid' => ''], ['uuid' => '0'],
            ['uuid' => 0], ['uuid' => 0.0], ['uuid' => false], ['uuid' => []],
            null, false, 4, 'unstructured row',
            ['uuid' => self::FIRST_UUID],
        ]);
    }

    /** @return array<string, array{mixed}> */
    public static function invalidUuidValues(): array
    {
        return [
            'nested array' => [[self::FIRST_UUID]],
            'nested object' => [(object) ['uuid' => self::FIRST_UUID]],
            'integer' => [42],
            'true' => [true],
            'float' => [1.5],
            'malformed text' => ['definitely-not-a-uuid'],
        ];
    }

    /**
     * @return array<string, array{string, mixed}>
     */
    public static function invalidInputsForBothMethods(): array
    {
        $inputs = [];
        foreach (['saveLinkedDocuments', 'saveLinkedResults'] as $method) {
            foreach (self::invalidUuidValues() as $label => [$value]) {
                $inputs[$method . ': ' . $label] = [$method, $value];
            }
        }
        return $inputs;
    }

    #[DataProvider('invalidInputsForBothMethods')]
    public function testLaterInvalidUuidCannotClearOrResolveEarlierLinkForEitherMethod(
        string $method,
        mixed $invalid,
    ): void {
        $this->expectSql([]);
        $this->expectException(InvalidArgumentException::class);
        $this->save($method, [
            ['uuid' => self::FIRST_UUID],
            ['uuid' => $invalid],
        ]);
    }

    #[DataProvider('linkKinds')]
    public function testNativeAcceptedUuidStringFormatsRemainAccepted(
        string $method,
        string $delete,
        string $select,
        string $idColumn,
        string $insert,
    ): void {
        // The native converter decides which spellings are supported. This
        // catches a new, narrower validation rule without copying its parser.
        $candidates = [
            strtoupper(self::FIRST_UUID),
            str_replace('-', '', self::FIRST_UUID),
            '{' . self::FIRST_UUID . '}',
            'urn:uuid:' . self::FIRST_UUID,
        ];
        $accepted = [];
        foreach ($candidates as $candidate) {
            try {
                $accepted[] = [$candidate, UuidRegistry::uuidToBytes($candidate)];
            } catch (InvalidArgumentException) {
                // Unsupported spellings are not part of the service contract.
            }
        }

        self::assertNotEmpty($accepted, 'The native converter must accept uppercase canonical UUIDs');
        $operations = [[$delete, [73], null]];
        foreach ($accepted as [, $bytes]) {
            $operations[] = [$select, [$bytes], [$idColumn => 31]];
            $operations[] = [$insert, [73, 31, 'linked_author'], null];
        }
        $this->expectSql($operations);
        $this->save($method, array_map(static fn(array $item): array => ['uuid' => $item[0]], $accepted));
    }
}
