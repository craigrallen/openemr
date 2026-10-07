<?php

/**
 * Render the History and Lifestyle editor's workbench hooks from the real history_full.php source.
 *
 * The workbench presentation is confined to a head block that links the route stylesheet and
 * mode.js, plus three class names. This test cuts the head block verbatim out of
 * history_full.php and executes it alone with the real escaping helpers, the real OEGlobalsBag
 * web root and the real ClinicalWorkspaceAssets, so it can vary the web root and the asset
 * directory. It is not route coverage: Editor/HistoryEditorRouteTest executes the whole route
 * with guarded doubles for the database, ACL, header and layout renderer.
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
use OpenEMR\Core\Kernel;
use OpenEMR\Core\OEGlobalsBag;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class HistoryEditorAssetsTest extends TestCase
{
    // OEGlobalsBag writes both its singleton and $GLOBALS; process isolation keeps it local.

    private const PAGE = __DIR__ . '/../../../../../interface/patient_file/history/history_full.php';

    private const SHIPPED = __DIR__ . '/../../../../../interface/clinical-workspace';

    private const HEAD_START = '<?php $clinicalAssets = new \OpenEMR\Common\Assets\ClinicalWorkspaceAssets();';

    private const HEAD_END = " defer></script>\n";

    protected function setUp(): void
    {
        OEGlobalsBag::getInstance()->set('kernel', new Kernel(dirname(__DIR__, 5), '/openemr'));
    }

    #[Test]
    public function headBlockLinksTheScreenOnlyStylesheetAndModeScriptWithRealFileVersions(): void
    {
        $assets = new ClinicalWorkspaceAssets();
        $root = '/openemr/interface/clinical-workspace/';

        $expected = '<link rel="stylesheet" media="screen" href="' . $root . 'history-editor.css?v=' . $assets->version('history-editor.css') . '">'
            . '<script src="' . $root . 'mode.js?v=' . $assets->version('mode.js') . '" defer></script>';
        self::assertSame($expected, preg_replace('/>\s+</', '><', trim(self::renderHead('/openemr'))));

        // Every version is the real mtime of the shipped file, so a missing stylesheet cannot pass as '0'.
        foreach (['history-editor.css', 'mode.js'] as $name) {
            $path = self::SHIPPED . '/' . $name;
            self::assertFileExists($path);
            clearstatcache(true, $path);
            self::assertSame((string) filemtime($path), $assets->version($name));
        }
    }

    #[Test]
    #[DataProvider('webRootProvider')]
    public function headBlockEscapesTheConfiguredWebRoot(string $webRoot, string $expectedPrefix): void
    {
        $html = self::renderHead($webRoot);

        self::assertStringContainsString('href="' . $expectedPrefix . '/interface/clinical-workspace/history-editor.css?v=', $html);
        self::assertStringContainsString('src="' . $expectedPrefix . '/interface/clinical-workspace/mode.js?v=', $html);
    }

    /**
     * @return array<string, array{string, string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function webRootProvider(): array
    {
        return [
            'installed at the server root' => ['', ''],
            'installed under /openemr' => ['/openemr', '/openemr'],
            'web root needing attribute escaping' => ['/a"b&c', '/a&quot;b&amp;c'],
        ];
    }

    #[Test]
    public function headBlockNeverLinksTheSharedWorkspaceStylesheet(): void
    {
        $block = self::fragment(self::HEAD_START, self::HEAD_END);

        self::assertStringNotContainsString('workspace.css', $block);
        self::assertSame(1, substr_count($block, '<link '));
        self::assertSame(1, substr_count($block, '<script '));
    }

    #[Test]
    public function headBlockFollowsThePageStyleInsideTheHead(): void
    {
        $source = self::source();
        $open = strpos($source, '<head>');
        $close = strpos($source, '</head>');
        self::assertIsInt($open);
        self::assertIsInt($close);
        $head = substr($source, $open, $close - $open);

        self::assertStringContainsString("</style>\n" . self::fragment(self::HEAD_START, self::HEAD_END) . '<?php', $head);
    }

    #[Test]
    #[DataProvider('hookProvider')]
    public function routeHooksAppearExactlyOnce(string $markup): void
    {
        self::assertSame(1, substr_count(self::source(), $markup));
    }

    /**
     * @return array<string, array{string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function hookProvider(): array
    {
        return [
            'route body class' => ['<body class="oe-clinical-history-editor">'],
            'editor container' => ['<div id="container_div" class="container-xl mt-3 oe-history-editor">'],
            'action group' => ['<div class="btn-group oe-history-editor-actions">'],
        ];
    }

    #[Test]
    public function helperVersionsTheEditorStylesheetFromItsOwnFile(): void
    {
        $directory = sys_get_temp_dir() . '/oe-history-editor-assets-' . bin2hex(random_bytes(6));
        mkdir($directory);
        $path = $directory . '/history-editor.css';
        try {
            file_put_contents($path, '/* synthetic */');
            touch($path, 1_700_002_001);
            self::assertSame('1700002001', (new ClinicalWorkspaceAssets($directory))->version('history-editor.css'));
        } finally {
            unlink($path);
            rmdir($directory);
        }
    }

    #[Test]
    public function helperRejectsANearMissStylesheetName(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        (new ClinicalWorkspaceAssets())->version('history_editor.css');
    }

    private static function renderHead(string $webRoot): string
    {
        OEGlobalsBag::getInstance()->set('kernel', new Kernel(dirname(__DIR__, 5), $webRoot));
        $block = self::fragment(self::HEAD_START, self::HEAD_END);

        return self::capture('<?php use OpenEMR\Core\OEGlobalsBag; ?>' . $block);
    }

    private static function source(): string
    {
        $source = file_get_contents(self::PAGE);
        self::assertIsString($source);
        return $source;
    }

    /**
     * The single verbatim span of history_full.php from $start through the first following $end.
     */
    private static function fragment(string $start, string $end): string
    {
        $source = self::source();
        self::assertSame(1, substr_count($source, $start), 'fragment start must be unique: ' . $start);
        $from = strpos($source, $start);
        self::assertIsInt($from);
        $to = strpos($source, $end, $from);
        self::assertIsInt($to);
        return substr($source, $from, $to - $from + strlen($end));
    }

    private static function capture(string $code): string
    {
        $file = tempnam(sys_get_temp_dir(), 'oe-history-editor-fragment-');
        self::assertIsString($file);
        file_put_contents($file, $code);
        ob_start();
        try {
            (static function (string $file): void {
                include $file;
            })($file);
        } finally {
            $output = ob_get_clean();
            unlink($file);
        }
        self::assertIsString($output);
        return $output;
    }
}
