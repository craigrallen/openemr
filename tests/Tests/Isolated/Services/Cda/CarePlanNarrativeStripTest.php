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

    /** @return iterable<string, array{string, string}> */
    public static function narratives(): iterable
    {
        yield 'intervening words' => ['Before {|11|} keep this text {|22|} after', 'Before  keep this text  after'];
        yield 'no marker and XML escaping' => ['A & <B> "quoted"', 'A & <B> "quoted"'];
        yield 'single marker' => ['Before {|11|} after', 'Before  after'];
        yield 'adjacent markers' => ['Before {|11|}{|22|} after', 'Before  after'];
        yield 'multiline markers' => ["Before {|11|}\nkeep text\n{|22|} after", "Before \nkeep text\n after"];
        yield 'bracket excludes legacy match' => ['Before {|11]22|} after', 'Before {|11]22|} after'];
        yield 'unclosed marker remains literal' => ['Before {|11 after', 'Before {|11 after'];
        yield 'closed marker after unclosed prefix follows legacy grammar' => ['Before {|bad {|22|} after', 'Before  after'];
    }

    #[DataProvider('narratives')]
    #[RunInSeparateProcess]
    public function testNarrativeAcrossNativeOutputSections(string $description, string $expected): void
    {
        $rows = [];
        foreach (['care_plan', 'goal', 'health_concern', 'planned_procedure'] as $index => $type) {
            $rows[] = [
                'source' => 'care_plan', 'encounter' => '456', 'code' => 'SNOMED-CT:123',
                'codetext' => 'Example', 'description' => $description,
                'date' => '2026-10-24', 'moodCode' => 'INT', 'care_plan_type' => $type,
                'note_issues' => '', 'plan_status' => 'active', 'proposed_date' => '2026-11-01',
                'provenance_updated_by' => 7, 'modifydate' => '2026-10-24',
                'form_id' => 100 + $index,
            ];
        }

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
        foreach (['/root/planofcare/item', '/root/goals/item', '/root/health_concerns/concern'] as $path) {
            $nodes = $xpath->query($path);
            self::assertNotFalse($nodes);
            self::assertSame($path === '/root/planofcare/item' ? 2 : 1, $nodes->length, $path);
            foreach ($nodes as $node) {
                $narrative = $path === '/root/health_concerns/concern'
                    ? $node->getElementsByTagName('text')->item(0)?->textContent
                    : $node->getElementsByTagName('description')->item(0)?->textContent;
                self::assertSame(
                    $path === '/root/health_concerns/concern' ? '2026-10-24 ' . $expected : $expected,
                    $narrative,
                    $path
                );
            }
        }
        self::assertSame(1, substr_count($xml, '<moodCode>RQO</moodCode>'));
        self::assertStringContainsString('<proposed_date>2026-11-01</proposed_date>', $xml);
        self::assertStringContainsString('<sha_extension>' . $dispatch->formatUid('100' . $expected) . '</sha_extension>', $xml);
        if (str_contains($description, '&')) {
            self::assertStringContainsString('A &amp; &lt;B&gt; &quot;quoted&quot;', $xml);
        }
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
            public static function fetchRecords($sql, $binds = [], $noLog = false): array
            {
                $GLOBALS['carePlanQueryCalls'][] = [$sql, $binds, $noLog];
                return $GLOBALS['carePlanRows'];
            }
        }), QueryUtils::class);
        class_alias(get_class(new class () {
            public static function createMissingUuidsForTables(array $tables): void
            {
                $GLOBALS['carePlanUuidCalls'][] = $tables;
            }
        }), UuidRegistry::class);
        class_alias(get_class(new class () {
            public static function getCurrentAssessment(int $pid): ?array
            {
                $GLOBALS['carePlanSdohCalls'][] = $pid;
                return null;
            }
        }), HistorySdohService::class);

        // PHP has no runtime API to register a namespaced function. This child-only
        // function records the native social-history read and returns no row. It is
        // deliberately scoped to the production class namespace; it never calls SQL.
        eval('namespace Carecoordination\\Model; function sqlQuery($sql, $binds = []) { $GLOBALS["carePlanSqlCalls"][] = [$sql, $binds]; return false; }');
    }

    private function loadExactSourceMirror(): string
    {
        $root = dirname(__DIR__, 5);
        $source = $root . self::SOURCE;
        self::assertFileExists($source);
        $tree = sys_get_temp_dir() . '/oe-care-plan-' . bin2hex(random_bytes(8));
        $target = $tree . self::SOURCE;
        foreach ([dirname($target), $tree . '/custom', $tree . '/interface/forms/vitals'] as $directory) {
            if (!is_dir($directory) && !mkdir($directory, 0700, true)) {
                throw new \RuntimeException('Could not create isolated source mirror');
            }
        }
        try {
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
            require_once $target;
            self::assertSame(realpath($target), (new \ReflectionClass(EncounterccdadispatchTable::class))->getFileName());
        } catch (\Throwable $error) {
            self::removeTree($tree);
            throw $error;
        }
        return $tree;
    }

    private static function removeTree(string $tree): void
    {
        if (!str_starts_with(basename($tree), 'oe-care-plan-') || !is_dir($tree)) {
            return;
        }
        $items = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($tree, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($items as $item) {
            $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }
        rmdir($tree);
    }
}
