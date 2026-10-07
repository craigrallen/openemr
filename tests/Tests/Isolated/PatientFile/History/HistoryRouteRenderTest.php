<?php

/**
 * Renders the REAL interface/patient_file/history/history.php and checks its presentation hooks.
 *
 * The route file is included as-is (never copied or eval'd) from a temporary working
 * directory whose ../../globals.php and $srcdir/project-dir includes are TEST DOUBLES; see
 * HistoryRouteHarness for exactly what is real and what is doubled. Patient, ACL, layout and
 * history data are SYNTHETIC. This is not database, ACL, runtime or clinical acceptance.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\History;

use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;
use OpenEMR\Tests\Isolated\PatientFile\History\Doubles\HeaderDouble;
use OpenEMR\Tests\Isolated\PatientFile\History\Doubles\OemrUIDouble;
use OpenEMR\Tests\Isolated\PatientFile\History\Doubles\PatientMenuRoleDouble;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class HistoryRouteRenderTest extends TestCase
{
    // Class aliases, the kernel, the session and cwd are process-wide; each test gets its own process.

    private const WEBROOT = '/openemr/interface/clinical-workspace/';

    private string $root = '';

    private string $cwd = '';

    protected function setUp(): void
    {
        $cwd = getcwd();
        self::assertIsString($cwd);
        $this->cwd = $cwd;
        $this->root = HistoryRouteHarness::createTree();
    }

    protected function tearDown(): void
    {
        chdir($this->cwd);
        HistoryRouteHarness::removeTree($this->root);
    }

    #[Test]
    public function realTargetSourcesAreTheOnesUnderTest(): void
    {
        $root = realpath(HistoryRouteHarness::repositoryRoot());
        self::assertIsString($root);
        self::assertSame($root . '/interface/patient_file/history/history.php', realpath(HistoryRouteHarness::historyPhp()));
        self::assertSame(
            $root . '/src/Common/Assets/ClinicalWorkspaceAssets.php',
            (new \ReflectionClass(ClinicalWorkspaceAssets::class))->getFileName()
        );
    }

    #[Test]
    public function writerSeesScreenOnlyAssetsRouteClassesTabsAndEdit(): void
    {
        [$html, $vars] = $this->render(['grpSize' => 14]);
        $assets = new ClinicalWorkspaceAssets();

        // The route's own instantiation line ran and produced the real helper.
        self::assertInstanceOf(ClinicalWorkspaceAssets::class, $vars['clinicalAssets'] ?? null);

        $link = '<link rel="stylesheet" media="screen" href="' . self::WEBROOT . 'history-document.css?v='
            . $assets->version('history-document.css') . '">';
        $script = '<script src="' . self::WEBROOT . 'mode.js?v=' . $assets->version('mode.js') . '" defer></script>';
        self::assertSame(1, substr_count($html, $link . "\n" . $script . "\n"));
        self::assertSame(2, substr_count($html, '/interface/clinical-workspace/'));
        self::assertStringNotContainsString('workspace.css', str_replace('history-document.css', '', $html));
        self::assertSame(1, substr_count($html, 'media="screen"'));

        // Per-file versions are the shipped files' real mtimes, never the missing-file '0'.
        foreach (['history-document.css', 'mode.js'] as $name) {
            $path = HistoryRouteHarness::repositoryRoot() . '/interface/clinical-workspace/' . $name;
            clearstatcache(true, $path);
            self::assertSame((string) filemtime($path), $assets->version($name));
            self::assertNotSame('0', $assets->version($name));
        }

        // Order: header, configured HIS font override, then the asset block, then </head>.
        $override = "#HIS .data td {\n  font-size: 1.19rem;\n}";
        self::assertSame(1, substr_count($html, $override));
        foreach (['.groupname', '.label', '.data'] as $selector) {
            self::assertSame(1, substr_count($html, "#HIS {$selector} {\n  font-size: 1.19rem;\n}"));
        }
        $order = [strpos($html, HeaderDouble::MARKER), strpos($html, $override), strpos($html, $link), strpos($html, '</head>')];
        self::assertSame($order, array_values(array_filter($order, is_int(...))));
        $sorted = $order;
        sort($sorted);
        self::assertSame($sorted, $order);

        self::assertSame(1, substr_count($html, "<body class=\"oe-clinical-history-document\">\n"));
        self::assertSame(1, substr_count($html, '<div id="container_div" class="container mt-3 oe-history-document">'));
        self::assertMatchesRegularExpression(
            '~<div class="row oe-history-actions">\s*<div class="col-sm-12">\s*<div class="btn-group">\s*'
            . '<a href="history_full\.php" class="btn btn-primary btn-edit" onclick="top\.restoreSession\(\)">\s*Edit\s*</a>~',
            $html
        );
        self::assertSame(1, substr_count($html, PatientMenuRoleDouble::MARKER));
        self::assertSame(1, substr_count($html, 'id="test-double-dashboard-header"'));

        // Generated tabs and data reach the page unchanged, inside the original containers.
        self::assertMatchesRegularExpression('~<div id="HIS">\s*<ul class="tabNav">\s*<li class="current">\s*<a href="#" id="header_tab_General">~', $html);
        self::assertStringContainsString("<div class=\"tabContainer\">\n                    <div class='tab current'>", $html);
        self::assertStringContainsString("data-value='SYNTHETIC tobacco value'>SYNTHETIC tobacco value</td>", $html);
        self::assertSame(1, substr_count($html, 'tabbify();'));
        self::assertSame(1, substr_count($html, 'checkSkipConditions();'));
        self::assertStringContainsString(OemrUIDouble::BELOW, $html);
        self::assertSame('history_dashboard_help.php', HistoryRouteScenario::$uiSettings['help_file_name'] ?? null);
        self::assertSame(['"common"'], HistoryRouteScenario::$headers);
        self::assertSame(['properties:HIS:grp_size', 'tabs:HIS', 'data:HIS'], HistoryRouteScenario::$layout);
        self::assertSame([], HistoryRouteScenario::$created);
    }

    #[Test]
    public function defaultLayoutEmitsNoFontOverrideButKeepsTheAssetBlock(): void
    {
        [$html] = $this->render([]);

        self::assertStringNotContainsString('font-size', $html);
        self::assertMatchesRegularExpression('~<style>\s*</style>\s*<link rel="stylesheet" media="screen" href="[^"]+history-document\.css\?v=\d+">~', $html);
        self::assertStringContainsString('<body class="oe-clinical-history-document">', $html);
    }

    #[Test]
    public function readOnlyViewerGetsTheDocumentWithoutTheEditAction(): void
    {
        [$html] = $this->render(['aclWrite' => false]);

        self::assertStringNotContainsString('oe-history-actions', $html);
        self::assertStringNotContainsString('history_full.php', $html);
        self::assertStringNotContainsString(PatientMenuRoleDouble::MARKER, $html);
        self::assertStringContainsString('<div id="container_div" class="container mt-3 oe-history-document">', $html);
        self::assertStringContainsString('id="header_tab_General"', $html);
    }

    #[Test]
    public function missingHistoryRowStillCreatesOneOnThisGetAsBefore(): void
    {
        HistoryRouteScenario::$history = false;
        [$html] = $this->render([]);

        // Pre-existing behaviour, unchanged by this slice: a page view inserts a history row.
        self::assertSame([['pid' => HistoryRouteScenario::PID]], HistoryRouteScenario::$created);
        self::assertCount(2, array_filter(HistoryRouteScenario::$queries, static fn (string $q): bool => str_contains($q, 'from history_data')));
        self::assertStringContainsString("data-value='SYNTHETIC created row'", $html);
        self::assertStringContainsString('<body class="oe-clinical-history-document">', $html);
    }

    /**
     * @param array<string, mixed> $scenario
     */
    #[Test]
    #[DataProvider('deniedProvider')]
    public function deniedViewerStopsBeforeAnyHistoryReadOrLayout(array $scenario, int $aclChecks): void
    {
        [$exit, $html, $recorded] = HistoryRouteHarness::renderInSubprocess($this->root, $scenario);

        self::assertSame(0, $exit);
        self::assertTrue($recorded['globalsLoaded'] ?? false);
        self::assertStringEndsWith("<p>(History not authorized)</p>\n</body>\n</html>\n", $html);
        self::assertSame(1, substr_count($html, '<link rel="stylesheet" media="screen" href="' . self::WEBROOT . 'history-document.css?v='));
        self::assertStringContainsString('<body class="oe-clinical-history-document">', $html);
        self::assertStringNotContainsString('tabNav', $html);
        self::assertStringNotContainsString('btn-edit', $html);
        $queries = $recorded['queries'] ?? null;
        self::assertIsArray($queries);
        self::assertSame([], array_values(array_filter($queries, static fn (mixed $q): bool => is_string($q) && str_contains($q, 'history_data'))));
        // Only the head's HIS font-override lookup ran; no tabs or tab data were rendered.
        self::assertSame(['properties:HIS:grp_size'], $recorded['layout'] ?? null);
        self::assertSame([], $recorded['created'] ?? null);
        $acl = $recorded['acl'] ?? null;
        self::assertIsArray($acl);
        self::assertCount($aclChecks, $acl);
    }

    /**
     * @return array<string, array{array<string, mixed>, int}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function deniedProvider(): array
    {
        return [
            'no patients/med read access' => [['aclMed' => false], 1],
            'patient in a squad the user cannot see' => [['squad' => HistoryRouteScenario::SQUAD, 'aclSquad' => false], 2],
        ];
    }

    /**
     * @param array<string, mixed> $scenario
     * @return array{string, array<string, mixed>}
     */
    private function render(array $scenario): array
    {
        HistoryRouteScenario::import($scenario);
        HistoryRouteHarness::boot($this->root);
        return HistoryRouteHarness::renderInProcess();
    }
}
