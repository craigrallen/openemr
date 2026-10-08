<?php

/**
 * Executes the real interface/main/finder/multi_patients_finder.php with guarded doubles.
 *
 * Covered: the empty-picker branch (no ?patients=), the picker stylesheet link with an escaped
 * web root and the real file version, the picker classes and the unchanged search fields,
 * actions, results table and CSRF token. Not covered: the ?patients= branch, because
 * CsrfUtils::checkCsrfInput(INPUT_GET) reads filter_input(), which never sees a CLI request
 * and dies; reaching it would need a production change.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Main\Finder;

use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;
use OpenEMR\Tests\Isolated\Main\Finder\Doubles\FinderHeaderDouble;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class MultiPatientsFinderRouteTest extends TestCase
{
    private string $root = '';

    private string $cwd = '';

    protected function setUp(): void
    {
        $cwd = getcwd();
        self::assertIsString($cwd);
        $this->cwd = $cwd;
        $this->root = FinderRouteHarness::createTree();
        FinderRouteHarness::boot($this->root);
    }

    protected function tearDown(): void
    {
        chdir($this->cwd);
        FinderRouteHarness::removeTree($this->root);
    }

    #[Test]
    public function theHeadLinksThePickerStylesheetWithAnEscapedWebRootAfterTheHeader(): void
    {
        $html = FinderRouteHarness::render(FinderRouteHarness::multiPatientsFinderPhp());
        $assets = new ClinicalWorkspaceAssets();

        $headEnd = strpos($html, '</head>');
        self::assertIsInt($headEnd);
        $head = substr($html, 0, $headEnd);
        $version = $assets->version('patient-picker-popup.css');
        self::assertNotSame('0', $version);
        $link = '<link rel="stylesheet" media="screen" href="' . FinderRouteHarness::ESCAPED_WEB_ROOT
            . '/interface/clinical-workspace/patient-picker-popup.css?v=' . $version . '">';
        self::assertSame(1, substr_count($head, $link));
        self::assertStringNotContainsString(FinderRouteHarness::WEB_ROOT . '/interface', $html);
        self::assertSame(1, substr_count($head, FinderHeaderDouble::MARKER));
        self::assertLessThan(strpos($head, $link), strpos($head, FinderHeaderDouble::MARKER));
        self::assertLessThan(strpos($head, '<style>'), strpos($head, $link));
        self::assertSame([['select2', 'opener']], FinderRouteScenario::$headers);
        self::assertTrue(FinderRouteScenario::$globalsLoaded);
    }

    #[Test]
    public function theBodyKeepsTheOriginalFieldsActionsAndEmptyResults(): void
    {
        $html = FinderRouteHarness::render(FinderRouteHarness::multiPatientsFinderPhp());
        $token = substr(hash_hmac('sha256', 'default', FinderRouteScenario::CSRF_KEY), 0, 40);

        foreach (
            [
                '<body class="oe-patient-picker">',
                '<div class="container-fluid oe-picker-sheet">',
                '<div id="searchCriteria" class="oe-picker-search">',
                '<form class="oe-picker-form">',
                '<select id="by-name" name="by-name" class="input-sm">',
                '<select id="by-id" name="by-id" class="input-sm">',
                '<div class="btn-group oe-picker-actions" role="group" aria-label="Form Buttons">',
                '<button id="add-to-list" type="button" class="btn btn-primary btn-add btn-sm">Add to list</button>',
                '<button id="send-patients" type="button" class="btn btn-primary btn-save btn-sm" onclick="selPatients()">OK</button>',
                '<table id="results-table" class="table table-sm oe-picker-table">',
                "var patientsList = [];\n$('#results-table').hide();",
                FinderRouteHarness::SELECT2_MARKER,
            ] as $fragment
        ) {
            self::assertSame(1, substr_count($html, $fragment), $fragment);
        }
        // select2 lookup plus the by-id and by-name change handlers.
        self::assertSame(3, substr_count($html, "url: 'multi_patients_finder_ajax.php',"));
        self::assertSame(3, substr_count($html, 'csrf_token_form: "' . $token . '"'));

        $dom = new \DOMDocument();
        self::assertTrue(@$dom->loadHTML($html));
        $xpath = new \DOMXPath($dom);
        self::assertSame(1, self::nodeCount($xpath, "//div[@id='searchCriteria']/form//select[@id='by-name']"));
        self::assertSame(1, self::nodeCount($xpath, "//div[contains(@class, 'oe-picker-results')]/table[@id='results-table']/tbody[@id='searchResults']"));
        self::assertSame(0, self::nodeCount($xpath, "//tbody[@id='searchResults']/tr"));
        self::assertSame(6, self::nodeCount($xpath, "//thead[@id='searchResultsHeader']/tr/th"));
    }

    private static function nodeCount(\DOMXPath $xpath, string $query): int
    {
        $nodes = $xpath->query($query);
        self::assertInstanceOf(\DOMNodeList::class, $nodes);
        return $nodes->length;
    }
}
