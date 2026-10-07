<?php

/**
 * Executes the real history_full.php with guarded doubles and checks the emitted editor page.
 *
 * Covered: ACL checks (allowed path), patient/history reads, the real CSRF token, the head
 * asset block with real file versions, the route classes, the unchanged form/actions/hidden
 * fields and the renderer calls. Not covered: the deny branches (AccessDeniedHelper audits to
 * the database), newHistoryData() (writes) and the real layout renderer.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\History\Editor;

use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;
use OpenEMR\Tests\Isolated\PatientFile\History\Editor\Doubles\HeaderDouble;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class HistoryEditorRouteTest extends TestCase
{
    private string $root = '';

    private string $cwd = '';

    protected function setUp(): void
    {
        $cwd = getcwd();
        self::assertIsString($cwd);
        $this->cwd = $cwd;
        $this->root = EditorRouteHarness::createTree();
        EditorRouteHarness::boot($this->root);
    }

    protected function tearDown(): void
    {
        chdir($this->cwd);
        EditorRouteHarness::removeTree($this->root);
    }

    #[Test]
    public function theRouteEmitsTheWorkbenchHooksAroundAnUnchangedForm(): void
    {
        $html = EditorRouteHarness::render();
        $assets = new ClinicalWorkspaceAssets();
        $root = '/openemr/interface/clinical-workspace/';

        $headEnd = strpos($html, '</head>');
        self::assertIsInt($headEnd);
        $head = substr($html, 0, $headEnd);
        $link = '<link rel="stylesheet" media="screen" href="' . $root . 'history-editor.css?v=' . $assets->version('history-editor.css') . '">';
        $script = '<script src="' . $root . 'mode.js?v=' . $assets->version('mode.js') . '" defer></script>';
        self::assertNotSame('0', $assets->version('history-editor.css'));
        self::assertStringContainsString("</style>\n" . $link . "\n" . $script . "\n", $head);
        self::assertStringNotContainsString('workspace.css', $html);
        self::assertSame(1, substr_count($head, HeaderDouble::MARKER));
        self::assertLessThan(strpos($head, $link), strpos($head, HeaderDouble::MARKER));

        $token = substr(hash_hmac('sha256', 'default', EditorRouteScenario::CSRF_KEY), 0, 40);
        foreach (
            [
                '<body class="oe-clinical-history-editor">',
                '<div id="container_div" class="container-xl mt-3 oe-history-editor">',
                '<form action="history_save.php" id="HIS" name=\'history_form\' method=\'post\' onsubmit="submitme(0,event,\'HIS\',constraints)">',
                '<input type="hidden" name="csrf_token_form" value="' . $token . '" />',
                "<input type='hidden' name='mode' value='save' />",
                '<div class="btn-group oe-history-editor-actions">',
                '<button type="submit" class="btn btn-primary btn-save">Save</button>',
                '<a href="history.php" class="btn btn-secondary btn-cancel" onclick="top.restoreSession()">',
                '<div id="HIS" class="float-none mt-3">',
                '<script> var constraints = {}; </script>',
            ] as $fragment
        ) {
            self::assertSame(1, substr_count($html, $fragment), $fragment);
        }
        self::assertStringContainsString(EditorRouteScenario::fixture('his-tabs-nav.html'), $html);
        self::assertStringContainsString(EditorRouteScenario::fixture('his-tabs-data.html'), $html);
    }

    #[Test]
    public function theRouteMakesOnlyTheExpectedChecksReadsAndRendererCalls(): void
    {
        EditorRouteHarness::render();

        self::assertTrue(EditorRouteScenario::$globalsLoaded);
        self::assertSame(['["patients","med","",""]', '["patients","med","",["write","addonly"]]'], EditorRouteScenario::$acl);
        self::assertCount(2, EditorRouteScenario::$queries);
        self::assertStringContainsString('from patient_data', EditorRouteScenario::$queries[0]);
        self::assertStringContainsString('from history_data', EditorRouteScenario::$queries[1]);
        self::assertSame(['validation:HIS', 'constraints:HIS', 'tabs:HIS', 'data_editable:HIS', 'constraints:HIS'], EditorRouteScenario::$layout);
        self::assertSame([['datetime-picker', 'common', 'select2']], EditorRouteScenario::$headers);
        self::assertSame('history.php', EditorRouteScenario::$uiSettings['action_href'] ?? null);
    }

    #[Test]
    #[DataProvider('medAclProvider')]
    public function thePatientSquadIsReadOnlyWhenMedicalAccessIsGranted(bool $aclMed, int $queries): void
    {
        EditorRouteScenario::$aclMed = $aclMed;
        $html = EditorRouteHarness::render();

        self::assertCount($queries, EditorRouteScenario::$queries);
        self::assertStringContainsString('<body class="oe-clinical-history-editor">', $html);
    }

    /**
     * @return array<string, array{bool, int}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function medAclProvider(): array
    {
        return [
            'medical read granted' => [true, 2],
            'write-only access' => [false, 1],
        ];
    }

    #[Test]
    public function theParsedPageNestsTheTabsInsideTheFormSheet(): void
    {
        $html = EditorRouteHarness::render();
        $dom = new \DOMDocument();
        self::assertTrue(@$dom->loadHTML($html));
        $xpath = new \DOMXPath($dom);

        self::assertSame(1, self::nodeCount($xpath, "//div[@id='container_div']//form[@id='HIS']/div[@id='HIS']/ul[@class='tabNav']"));
        self::assertSame(4, self::nodeCount($xpath, "//form[@id='HIS']//div[@class='tabContainer']/div[contains(concat(' ', @class, ' '), ' tab ')]"));
        self::assertSame(1, self::nodeCount($xpath, "//form[@id='HIS']//a[contains(@class, 'text-body')]/div[@class='text-area']"));
    }

    #[Test]
    public function theRealSkipConditionAndSubmitHelpersAreEmitted(): void
    {
        $html = EditorRouteHarness::render();

        self::assertStringContainsString('function checkSkipConditions(', $html);
        self::assertStringContainsString('function submitme(', $html);
    }

    private static function nodeCount(\DOMXPath $xpath, string $query): int
    {
        $nodes = $xpath->query($query);
        self::assertInstanceOf(\DOMNodeList::class, $nodes);
        return $nodes->length;
    }
}
