<?php

/**
 * Render the LBF form's workbench document hooks from the real new.php source.
 *
 * new.php is a procedural page that needs a session, the database and a layout, so it cannot
 * be rendered whole in an isolated test. Its workbench presentation is confined to three
 * fragments: the guard that decides which pages opt in, the guarded head block that links the
 * clinical workspace assets, and the body tag. Each fragment is cut verbatim out of new.php and
 * executed with the real escaping helpers, the real OEGlobalsBag web root and the real
 * ClinicalWorkspaceAssets, so the markup checked here is the markup the page emits.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Forms\LBF;

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
class LbfDocumentHooksTest extends TestCase
{
    // OEGlobalsBag writes both its singleton and $GLOBALS; process isolation keeps it local.

    private const NEW_PHP = __DIR__ . '/../../../../../interface/forms/LBF/new.php';

    private const SHIPPED = __DIR__ . '/../../../../../interface/clinical-workspace';

    protected function setUp(): void
    {
        OEGlobalsBag::getInstance()->set('kernel', new Kernel(dirname(__DIR__, 5), '/openemr'));
    }

    #[Test]
    #[DataProvider('pageKindProvider')]
    public function onlyStaffEncounterFormsOptIn(bool $isCore, bool $fromIssueForm, bool $fromTrendForm, bool $expected): void
    {
        $guard = self::fragment('$lbf_workbench_document = ', ";\n");
        $code = '<?php $is_core = ' . var_export($isCore, true)
            . '; $from_issue_form = ' . var_export($fromIssueForm, true)
            . '; $from_trend_form = ' . var_export($fromTrendForm, true)
            . '; ' . $guard . ' return $lbf_workbench_document;';

        self::assertSame($expected, self::execute($code));
    }

    /**
     * @return array<string, array{bool, bool, bool, bool}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function pageKindProvider(): array
    {
        return [
            'staff encounter form' => [true, false, false, true],
            'patient portal / portal dashboard / portal module' => [false, false, false, false],
            'issue-form tab inside add_edit_issue' => [true, true, false, false],
            'trend_form graph page' => [true, false, true, false],
            'portal issue form' => [false, true, false, false],
        ];
    }

    #[Test]
    public function headBlockLinksScreenOnlyAssetsWithRealFileVersions(): void
    {
        $html = self::renderHead(true);
        $assets = new ClinicalWorkspaceAssets();
        $root = '/openemr/interface/clinical-workspace/';

        $expected = '<link rel="stylesheet" media="screen" href="' . $root . 'workspace.css?v=' . $assets->version('workspace.css') . '">'
            . '<link rel="stylesheet" media="screen" href="' . $root . 'lbf-document.css?v=' . $assets->version('lbf-document.css') . '">'
            . '<script src="' . $root . 'mode.js?v=' . $assets->version('mode.js') . '" defer></script>';
        self::assertSame($expected, preg_replace('/>\s+</', '><', trim($html)));

        // Every version is the real mtime of the shipped file, so a missing stylesheet cannot pass as '0'.
        foreach (['workspace.css', 'lbf-document.css', 'mode.js'] as $name) {
            $path = self::SHIPPED . '/' . $name;
            self::assertFileExists($path);
            clearstatcache(true, $path);
            self::assertSame((string) filemtime($path), $assets->version($name));
        }
    }

    #[Test]
    public function headBlockEmitsNothingWhenThePageDoesNotOptIn(): void
    {
        self::assertSame('', trim(self::renderHead(false)));
    }

    #[Test]
    #[DataProvider('bodyProvider')]
    public function bodyTagAddsTheRouteClassOnlyForOptedInPagesAndKeepsTheIssueFormBackground(
        bool $document,
        bool $fromIssueForm,
        string $expected
    ): void {
        $body = self::fragment('<body class="body_top', "} ?>>");
        $code = '<?php $lbf_workbench_document = ' . var_export($document, true)
            . '; $from_issue_form = ' . var_export($fromIssueForm, true) . '; ?>' . $body;

        self::assertSame($expected, self::capture($code));
    }

    /**
     * @return array<string, array{bool, bool, string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function bodyProvider(): array
    {
        return [
            'staff encounter form' => [true, false, '<body class="body_top oe-clinical-lbf">'],
            'portal or trend page' => [false, false, '<body class="body_top">'],
            'issue-form tab' => [false, true, "<body class=\"body_top\" style='background-color:var(--white)'>"],
        ];
    }

    #[Test]
    public function documentAndActionWrappersCarryStableHooks(): void
    {
        $source = self::source();
        self::assertSame(1, substr_count($source, '<div class="container-xl oe-lbf-document">'));
        self::assertSame(1, substr_count($source, "<div class='row oe-lbf-actions'>"));
    }

    #[Test]
    public function helperRejectsANearMissStylesheetName(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        (new ClinicalWorkspaceAssets())->version('lbf_document.css');
    }

    private static function renderHead(bool $document): string
    {
        $block = self::fragment('<?php if ($lbf_workbench_document) {', "<?php } ?>");
        $code = '<?php use OpenEMR\Common\Assets\ClinicalWorkspaceAssets; use OpenEMR\Core\OEGlobalsBag; '
            . '$lbf_workbench_document = ' . var_export($document, true) . '; ?>' . $block;

        return self::capture($code);
    }

    private static function source(): string
    {
        $source = file_get_contents(self::NEW_PHP);
        self::assertIsString($source);
        return $source;
    }

    /**
     * The single verbatim span of new.php from $start through the first following $end.
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

    private static function execute(string $code): mixed
    {
        $file = tempnam(sys_get_temp_dir(), 'oe-lbf-fragment-');
        self::assertIsString($file);
        file_put_contents($file, $code);
        try {
            return (static fn (): mixed => include $file)();
        } finally {
            unlink($file);
        }
    }

    private static function capture(string $code): string
    {
        ob_start();
        try {
            self::execute($code);
        } finally {
            $output = ob_get_clean();
        }
        self::assertIsString($output);
        return $output;
    }
}
