<?php

/**
 * Native getPlanOfCare() narrative regression tests. The child loads an exact source
 * mirror so the dispatch class's two relative includes resolve to inert files.
 * Database boundaries return synthetic rows; no application bootstrap or SQL runs.
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services\Cda;

use Carecoordination\Model\EncounterccdadispatchTable;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Common\Uuid\UuidRegistry;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Services\SDOH\HistorySdohService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

#[Group('isolated')]
#[PreserveGlobalState(false)]
final class CarePlanNarrativeStripTest extends TestCase
{
    private const SOURCE = '/interface/modules/zend_modules/module/Carecoordination/src/Carecoordination/Model/EncounterccdadispatchTable.php';

    /** @return iterable<string, array{string, string, string}> */
    public static function narratives(): iterable
    {
        $cases = [
            'intervening words' => ['Before {|11|} keep this text {|22|} after', 'Before  keep this text  after'],
            'no marker and XML escaping' => ['A & <B> "quoted"', 'A & <B> "quoted"'],
            'single marker' => ['Before {|11|} after', 'Before  after'],
            'adjacent markers' => ['Before {|11|}{|22|} after', 'Before  after'],
            'multiline markers' => ["Before {|11|}\nkeep text\n{|22|} after", "Before \nkeep text\n after"],
            'bracket excludes legacy match' => ['Before {|11]22|} after', 'Before {|11]22|} after'],
            'unclosed marker remains literal' => ['Before {|11 after', 'Before {|11 after'],
            'closed marker after unclosed prefix follows legacy grammar' => ['Before {|bad {|22|} after', 'Before  after'],
        ];
        foreach ($cases as $name => [$description, $expected]) {
            foreach (['care_plan', 'goal', 'health_concern', 'planned_procedure'] as $type) {
                yield "$name / $type" => [$description, $expected, $type];
            }
        }
    }

    #[DataProvider('narratives')]
    #[RunInSeparateProcess]
    public function testNarrativeInNativeOutputSection(string $description, string $expected, string $type): void
    {
        $rows = [[
            'source' => 'care_plan', 'encounter' => '456', 'code' => 'SNOMED-CT:123',
            'codetext' => 'Example', 'description' => $description,
            'date' => '2026-10-24', 'moodCode' => 'INT', 'care_plan_type' => $type,
            'note_issues' => '', 'plan_status' => 'active', 'proposed_date' => '2026-11-01',
            'provenance_updated_by' => 7, 'modifydate' => '2026-10-24',
            'form_id' => 100,
        ]];

        $this->installBoundaries($rows);
        $tree = $this->loadExactSourceMirror();
        try {
            OEGlobalsBag::getInstance()->set('disable_translation', true);
            $session = new Session(new MockArraySessionStorage());
            $session->set('site_id', 'test-site');
            SessionWrapperFactory::getInstance()->setActiveSession($session);
            $dispatch = new class () extends EncounterccdadispatchTable {
                public function getAuthorXmlForRecord($recordAuthor, $pid, $encounter): string
                {
                    return '<author>recorded</author>';
                }
            };
            $xml = $dispatch->getPlanOfCare('123', '456');
        } finally {
            self::removeTree($tree);
        }

        self::assertSame([['lists']], $GLOBALS['carePlanUuidCalls']);
        self::assertSame([123], $GLOBALS['carePlanSdohCalls']);
        self::assertCount(1, $GLOBALS['carePlanQueryCalls']);
        self::assertStringContainsString('FROM forms AS f', $GLOBALS['carePlanQueryCalls'][0][0]);
        self::assertStringContainsString('LEFT JOIN form_care_plan AS fcp', $GLOBALS['carePlanQueryCalls'][0][0]);
        self::assertSame(['Plan_of_Care_Type', '123', 'care_plan', 0], $GLOBALS['carePlanQueryCalls'][0][1]);
        self::assertCount(1, $GLOBALS['carePlanSqlCalls']);
        self::assertSame(['123'], $GLOBALS['carePlanSqlCalls'][0][1]);
        self::assertStringContainsString('FROM form_history_sdoh', $GLOBALS['carePlanSqlCalls'][0][0]);

        $document = new \DOMDocument();
        self::assertTrue($document->loadXML('<root>' . $xml . '</root>'));
        $xpath = new \DOMXPath($document);
        $path = match ($type) {
            'goal' => '/root/goals/item',
            'health_concern' => '/root/health_concerns/concern',
            default => '/root/planofcare/item',
        };
        $nodes = $xpath->query($path);
        self::assertNotFalse($nodes);
        self::assertCount(1, $nodes, $type);
        $narrative = $type === 'health_concern'
            ? $nodes->item(0)?->getElementsByTagName('text')->item(0)?->textContent
            : $nodes->item(0)?->getElementsByTagName('description')->item(0)?->textContent;
        self::assertSame($type === 'health_concern' ? '2026-10-24 ' . $expected : $expected, $narrative, $type);
        if ($type === 'planned_procedure') {
            self::assertSame('RQO', $nodes->item(0)?->getElementsByTagName('moodCode')->item(0)?->textContent);
        }
        if ($type === 'care_plan' || $type === 'planned_procedure') {
            self::assertSame('2026-11-01', $nodes->item(0)?->getElementsByTagName('proposed_date')->item(0)?->textContent);
        }
        self::assertStringContainsString('<sha_extension>' . $dispatch->formatUid('100' . $expected) . '</sha_extension>', $xml);
        if (str_contains($description, '&')) {
            self::assertStringContainsString('A &amp; &lt;B&gt; &quot;quoted&quot;', $xml);
        }
    }

    #[RunInSeparateProcess]
    public function testFilteredEmptyEncounterListReturnsBeforeAnyDataAccess(): void
    {
        $this->installBoundaries([]);
        $tree = $this->loadExactSourceMirror();
        try {
            $session = new Session(new MockArraySessionStorage());
            SessionWrapperFactory::getInstance()->setActiveSession($session);
            $dispatch = new EncounterccdadispatchTable();
            $dispatch->searchFiltered = true;
            $xml = $dispatch->getPlanOfCare('123', '456');
        } finally {
            self::removeTree($tree);
        }

        self::assertSame('<planofcare></planofcare><goals></goals><health_concerns></health_concerns>', $xml);
        self::assertSame([], $GLOBALS['carePlanUuidCalls']);
        self::assertSame([], $GLOBALS['carePlanQueryCalls']);
        self::assertSame([], $GLOBALS['carePlanSqlCalls']);
        self::assertSame([], $GLOBALS['carePlanSdohCalls']);
    }

    /** @param array<int, array<string, mixed>> $rows */
    private function installBoundaries(array $rows): void
    {
        foreach ([QueryUtils::class, UuidRegistry::class, HistorySdohService::class] as $class) {
            self::assertFalse(class_exists($class, false), $class . ' was loaded before the child boundary');
        }
        self::assertTrue(function_exists('xmlEscape'), 'Load the native escaping helper through the external bootstrap');
        self::assertFalse(function_exists('sqlQuery'), 'A live SQL helper must never reach this child');
        self::assertFalse(function_exists('Carecoordination\\Model\\sqlQuery'));

        $GLOBALS['carePlanUuidCalls'] = [];
        $GLOBALS['carePlanSqlCalls'] = [];
        // Anonymous classes are created only when a child executes this method.
        // Guarding class_exists(..., false) above prevents a real loaded class
        // from being replaced silently; the parent registers no aliases.
        $GLOBALS['carePlanRows'] = $rows;
        $GLOBALS['carePlanQueryCalls'] = [];
        $GLOBALS['carePlanSdohCalls'] = [];
        class_alias(get_class(new class () {
            /**
             * @param array<int, mixed> $binds
             * @return list<array<string, mixed>>
             */
            public static function fetchRecords(string $sql, array $binds = [], bool $noLog = false): array
            {
                $GLOBALS['carePlanQueryCalls'][] = [$sql, $binds, $noLog];
                return $GLOBALS['carePlanRows'];
            }
        }), QueryUtils::class);
        class_alias(get_class(new class () {
            /** @param list<string> $tables */
            public static function createMissingUuidsForTables(array $tables): void
            {
                $GLOBALS['carePlanUuidCalls'][] = $tables;
            }
        }), UuidRegistry::class);
        class_alias(get_class(new class () {
            /** @return array<string, mixed>|null */
            public static function getCurrentAssessment(int $pid): ?array
            {
                $GLOBALS['carePlanSdohCalls'][] = $pid;
                return null;
            }
        }), HistorySdohService::class);
    }

    private function loadExactSourceMirror(): string
    {
        $root = dirname(__DIR__, 5);
        $source = $root . self::SOURCE;
        self::assertFileExists($source);
        $tempRoot = realpath(sys_get_temp_dir());
        if ($tempRoot === false) {
            throw new \RuntimeException('Could not resolve temporary directory');
        }
        $tree = $tempRoot . '/oe-care-plan-' . bin2hex(random_bytes(8));
        $target = $tree . self::SOURCE;
        $createdRoot = false;
        try {
            if (!mkdir($tree, 0700)) {
                throw new \RuntimeException('Could not create isolated source mirror root');
            }
            $createdRoot = true;
            foreach ([dirname($target), $tree . '/custom', $tree . '/interface/forms/vitals'] as $directory) {
                if (!is_dir($directory) && !mkdir($directory, 0700, true)) {
                    throw new \RuntimeException('Could not create isolated source mirror');
                }
            }
            $bytes = file_get_contents($source);
            if ($bytes === false || file_put_contents($target, $bytes) === false) {
                throw new \RuntimeException('Could not mirror dispatch source');
            }
            self::assertSame($bytes, file_get_contents($target), 'Mirrored production bytes changed');
            foreach (['/custom/code_types.inc.php', '/interface/forms/vitals/report.php'] as $stub) {
                if (file_put_contents($tree . $stub, "<?php\n// Inert relative include for isolated source mirror.\n") === false) {
                    throw new \RuntimeException('Could not create inert relative include');
                }
            }
            $sqlBoundary = <<<'PHP'
<?php

namespace Carecoordination\Model;

/**
 * @param string $statement
 * @param array<int, mixed>|false $binds
 * @return false
 */
function sqlQuery($statement, $binds = false)
{
    $GLOBALS['carePlanSqlCalls'][] = [$statement, $binds];
    return false;
}
PHP;
            $sqlBoundaryFile = $tree . '/sql-boundary.php';
            if (file_put_contents($sqlBoundaryFile, $sqlBoundary) === false) {
                throw new \RuntimeException('Could not create inert SQL boundary');
            }
            require $sqlBoundaryFile;
            require_once $target;
            self::assertSame(realpath($target), (new \ReflectionClass(EncounterccdadispatchTable::class))->getFileName());
        } catch (\Throwable $error) {
            if ($createdRoot) {
                self::removeTree($tree);
            }
            throw $error;
        }
        return $tree;
    }

    private static function removeTree(string $tree): void
    {
        $tempRoot = realpath(sys_get_temp_dir());
        if ($tempRoot === false || dirname($tree) !== $tempRoot
            || preg_match('/^oe-care-plan-[0-9a-f]{16}$/', basename($tree)) !== 1
            || is_link($tree) || !is_dir($tree)) {
            return;
        }
        $items = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($tree, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($items as $item) {
            $item->isDir() && !$item->isLink() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }
        rmdir($tree);
    }
}
