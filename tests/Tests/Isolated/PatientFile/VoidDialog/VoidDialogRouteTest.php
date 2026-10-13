<?php

/**
 * Executes the real interface/patient_file/void_dialog.php with guarded doubles.
 *
 * Covered: the route include from this checkout, the Header options, the screen-only stylesheet
 * link with an escaped web root and the real file version, the presentation classes, the
 * unchanged form, notes input, Submit/Cancel controls and DoSubmit() script, and the exact
 * generate_form_field() descriptor. Not covered: the real layout field renderer (doubled),
 * the real Header asset tags, browser behaviour, keyboard, a real opener and print.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\VoidDialog;

use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;
use OpenEMR\Core\Header;
use OpenEMR\Core\OEGlobalsBag;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class VoidDialogRouteTest extends TestCase
{
    private string $root = '';

    protected function setUp(): void
    {
        $this->root = VoidDialogRouteHarness::createTree();
        VoidDialogRouteHarness::boot($this->root);
    }

    protected function tearDown(): void
    {
        VoidDialogRouteHarness::removeTree($this->root);
    }

    #[Test]
    public function theRealRouteRunsFromThisCheckoutWithTheOriginalHeaderAndReasonField(): void
    {
        $route = VoidDialogRouteHarness::voidDialogPhp();
        $cwd = getcwd();

        $html = VoidDialogRouteHarness::render($this->root, $route);

        self::assertSame(VoidDialogRouteHarness::repositoryRoot() . '/interface/patient_file/void_dialog.php', $route);
        self::assertSame(realpath($route), $route);
        self::assertContains($route, get_included_files());
        self::assertSame($cwd, getcwd());
        self::assertTrue(VoidDialogRouteHarness::$globalsLoaded);
        self::assertSame([['common', 'datetime-picker', 'opener']], VoidDialogRouteHarness::$headers);
        self::assertSame([[VoidDialogRouteHarness::REASON_DESCRIPTOR, '']], VoidDialogRouteHarness::$reasonFields);
        foreach ([ClinicalWorkspaceAssets::class => '/src/Common/Assets/ClinicalWorkspaceAssets.php', OEGlobalsBag::class => '/src/Core/OEGlobalsBag.php'] as $class => $file) {
            self::assertSame(VoidDialogRouteHarness::repositoryRoot() . $file, (new \ReflectionClass($class))->getFileName());
        }
        self::assertSame(VoidDialogHeaderDouble::class, (new \ReflectionClass(Header::class))->getName());
        self::assertSame(1, substr_count($html, VoidDialogRouteHarness::ESCAPED_REASON_SELECT));
        self::assertStringNotContainsString(VoidDialogRouteHarness::SYNTHETIC_REASON, $html);
    }

    #[Test]
    public function theHeadLinksTheScreenStylesheetOnceWithAnEscapedWebRootAfterTheHeader(): void
    {
        $html = VoidDialogRouteHarness::render($this->root, VoidDialogRouteHarness::voidDialogPhp());

        $headEnd = strpos($html, '</head>');
        self::assertIsInt($headEnd);
        $head = substr($html, 0, $headEnd);
        $version = (new ClinicalWorkspaceAssets())->version('void-dialog.css');
        self::assertMatchesRegularExpression('/^[1-9]\d*$/', $version);
        $link = '<link rel="stylesheet" media="screen" href="' . VoidDialogRouteHarness::ESCAPED_WEB_ROOT
            . '/interface/clinical-workspace/void-dialog.css?v=' . $version . '">';
        self::assertSame(1, substr_count($html, $link));
        self::assertSame(1, substr_count($html, 'void-dialog.css'));
        self::assertSame(1, substr_count($html, '<link '));
        self::assertStringNotContainsString(VoidDialogRouteHarness::WEB_ROOT, $html);
        self::assertSame(1, substr_count($head, VoidDialogHeaderDouble::MARKER));
        self::assertLessThan(strpos($head, $link), strpos($head, VoidDialogHeaderDouble::MARKER));
        self::assertLessThan(strpos($head, '<title>Void Dialog</title>'), strpos($head, $link));
    }

    #[Test]
    public function theBodyKeepsTheClassesFormControlsAndRawSubmitHandler(): void
    {
        $html = VoidDialogRouteHarness::render($this->root, VoidDialogRouteHarness::voidDialogPhp());

        $script = <<<'JS'
            function DoSubmit() {
              var f = document.forms[0];
              if (opener.closed || !opener.voidwrap) {
                alert("The destination form was closed; I cannot act on your selection.");
              }
              else if (f.form_reason.selectedIndex == 0) {
                alert("Please specify Void Reason.");
                return false;
              }
              else if (f.form_notes.value.trim() == '') {
                alert("Please specify Void Notes.");
                return false;
              }
              else {
                opener.voidwrap(f.form_reason.value, f.form_notes.value);
              }
              window.close();
              return false;
            };
            JS;
        foreach (
            [
                $script,
                '<body class="oe-void-dialog">',
                '<div class="container-fluid oe-void-document">',
                "<form method='post'>",
                "<table border='0' class='oe-void-fields'>",
                "<td valign='top' nowrap><b>Void Reason:</b></td>",
                "<td valign='top' nowrap><b>Void Notes:</b></td>",
                "<input type='text' size='40' name='form_notes' maxlength='80' value='' style='width:100%' />",
                "<p class='oe-void-actions'>\n",
                "<input type='button' value='Submit' onclick='DoSubmit()' />&nbsp;\n",
                "<input type='button' value='Cancel' onclick='window.close()' />\n",
            ] as $fragment
        ) {
            self::assertSame(1, substr_count($html, $fragment), $fragment);
        }

        $dom = new \DOMDocument();
        self::assertTrue(@$dom->loadHTML($html));
        $xpath = new \DOMXPath($dom);
        self::assertSame(1, self::nodeCount($xpath, '//form'));
        self::assertSame(1, self::nodeCount($xpath, "//body[@class='oe-void-dialog']/div[@class='container-fluid oe-void-document']/form/center/table[@class='oe-void-fields']//select[@name='form_reason']"));
        self::assertSame(1, self::nodeCount($xpath, "//form//p[@class='oe-void-actions']"));
        self::assertSame(3, self::nodeCount($xpath, '//form//input'));
        self::assertSame(0, self::nodeCount($xpath, "//input[@type='submit'] | //button"));
    }

    #[Test]
    public function theSeamsRefuseUnexpectedArguments(): void
    {
        VoidDialogRouteHarness::loadOptionsDouble($this->root);
        self::assertTrue(function_exists('generate_form_field'));
        /** @var callable(mixed, mixed, mixed...): void $generate the variadic double from loadOptionsDouble(), not the production two-argument renderer */
        $generate = 'generate_form_field';
        $wrong = ['list_id' => 'other_list'] + VoidDialogRouteHarness::REASON_DESCRIPTOR;

        foreach (
            [
                static fn() => $generate($wrong, ''),
                static fn() => $generate(VoidDialogRouteHarness::REASON_DESCRIPTOR, 'SYNTHETIC'),
                static fn() => $generate(VoidDialogRouteHarness::REASON_DESCRIPTOR, '', 'extra'),
                static fn(): string => Header::setupHeader(['common', 'opener']),
            ] as $index => $call
        ) {
            ob_start();
            try {
                $call();
                self::fail('Seam accepted unexpected arguments: case ' . $index);
            } catch (\LogicException) {
                // Expected: the seam fails closed.
            } finally {
                self::assertSame('', ob_get_clean());
            }
        }
        self::assertSame([], VoidDialogRouteHarness::$reasonFields);
        self::assertSame([], VoidDialogRouteHarness::$headers);
    }

    private static function nodeCount(\DOMXPath $xpath, string $query): int
    {
        $nodes = $xpath->query($query);
        self::assertInstanceOf(\DOMNodeList::class, $nodes);
        return $nodes->length;
    }
}
