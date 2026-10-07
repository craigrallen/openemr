<?php

/**
 * Header-free popup pages and the shared workbench-popup asset.
 *
 * These pages render their own HTML document without Header::setupHeader(),
 * so the autoloaded workbench-popup bundle never reaches them. Genuine popup
 * documents opt in with Header::setupAssets(['workbench-popup']) inside their
 * own <head> (no Bootstrap/jQuery); non-HTML or pixel-registered outputs are
 * deliberately left untouched. The source guard hashes each page with only
 * the opt-in lines removed, so any other drift (ACL, CSRF, POST/delete,
 * PDF branches, inline styles, script order) fails here.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Common\ClinicalWorkspace;

use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Header;
use OpenEMR\Core\Kernel;
use OpenEMR\Core\OEGlobalsBag;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

final class WorkbenchPopupHeaderfreeTest extends TestCase
{
    private const OPT_IN = "<?php echo Header::setupAssets(['workbench-popup']); ?>";
    private const USE_HEADER = 'use OpenEMR\Core\Header;';

    private static function root(): string
    {
        return dirname(__DIR__, 5);
    }

    private static function source(string $path): string
    {
        $source = file_get_contents(self::root() . '/' . $path);
        self::assertIsString($source);
        return $source;
    }

    /**
     * Remove only the opt-in lines; everything else must be byte-identical
     * to the pre-migration source.
     */
    private static function withoutOptIn(string $source): string
    {
        $lines = preg_split('/(?<=\n)/', $source);
        self::assertIsArray($lines);
        $kept = array_filter(
            $lines,
            static fn (string $line): bool => !in_array(trim($line), [self::OPT_IN, self::USE_HEADER], true),
        );
        return implode('', $kept);
    }

    /**
     * @return array<string, array{string, string, list<string>}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function migratedPages(): array
    {
        // [path, baseline sha256 at 5619373, markers that must precede the opt-in]
        return [
            'dispense label (dlgopen)' => [
                'interface/drugs/dispense_drug.php',
                '65a545871d768db317f6250bed79e0be92ac191893deef70616a161814ffc481',
                ['die(text($e->getMessage()));', 'include_opener.js', '<head>', '</style>', '<title>'],
            ],
            'shot record html branch' => [
                'interface/patient_file/summary/shot_record.php',
                '908293a8a12eed11ed57772f8d04ef4974b067e8ee64eb1ed7de2db3b66f3910',
                ['$pdf->ezStream();', 'function printHTML(', '<head>', '</style>', '<title>'],
            ],
            'prior auth deleter (dlgopen)' => [
                'interface/modules/custom_modules/oe-module-prior-authorizations/public/deleter.php',
                'd29e1fb5695eb192dbfae5e210fd2346b49f401650fbf5a3545d9fd4bdfec10b',
                ['CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);', 'delete from `module_prior_authorizations`', '<head>', '<title>'],
            ],
        ];
    }

    /**
     * @return array<string, array{string, string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function excludedPages(): array
    {
        return [
            // html=1 overlays plotted text (body color: red) at pt coordinates on chart
            // images; the popup body ink would recolour it. pdf=1 streams a PDF whose
            // chart inputs imagepng() writes to temporary files, not a browser PNG.
            'growth chart png/pdf/registered html' => [
                'interface/forms/vitals/growthchart/chart.php',
                '9d7f087883b146dd0c78b520402abee722577bc1d33bc911a441f5c1271391ad',
            ],
            // Deprecated contrib utility: <html><body> with no <head>. It is a real popup
            // (contrib/util/dupecheck/index.php opens it via window.open()), left out of
            // this migration as an acknowledged scope gap rather than a non-entry point.
            'deprecated dupecheck merge' => [
                'contrib/util/dupecheck/mergerecords.php',
                '646b4df3765d6a1111bd741aa6fa4bd8b32bafa74a4d554dc5f65b66580855dd',
            ],
        ];
    }

    /**
     * @param list<string> $before
     */
    #[DataProvider('migratedPages')]
    public function testOptInSitsOnceInsideTheRenderedHead(string $path, string $baseline, array $before): void
    {
        $source = self::source($path);

        $this->assertSame(1, substr_count($source, self::OPT_IN), "$path must opt in exactly once");
        $this->assertSame(1, substr_count($source, self::USE_HEADER), "$path must import Header once");
        $this->assertStringNotContainsString('Header::setupHeader', $source, 'no second Bootstrap/jQuery bundle');
        $this->assertSame(1, substr_count($source, 'workbench-popup'), 'only the opt-in names the asset');

        $at = strpos($source, self::OPT_IN);
        $this->assertIsInt($at);
        $cursor = 0;
        foreach ($before as $marker) {
            $found = strpos($source, $marker, $cursor);
            $this->assertIsInt($found, "$path: '$marker' missing or out of order");
            $this->assertLessThan($at, $found, "$path: opt-in must follow '$marker'");
            $cursor = $found + 1;
        }
        $close = strpos($source, '</head>', $at);
        $this->assertIsInt($close);
        $this->assertSame($close, strpos($source, '</head>', $cursor), "$path: opt-in must close out the same <head>");
        $this->assertStringNotContainsString('<body', substr($source, $cursor, $at - $cursor));
    }

    /**
     * @param list<string> $before
     */
    #[DataProvider('migratedPages')]
    public function testNothingButTheOptInChanged(string $path, string $baseline, array $before): void
    {
        $this->assertSame($baseline, hash('sha256', self::withoutOptIn(self::source($path))), "$path drifted beyond the opt-in");
    }

    #[DataProvider('excludedPages')]
    public function testExcludedPagesStayUntouched(string $path, string $baseline): void
    {
        $source = self::source($path);
        $this->assertStringNotContainsString('workbench-popup', $source);
        $this->assertStringNotContainsString('Header::', $source);
        $this->assertSame($baseline, hash('sha256', $source), "$path must stay byte-identical");
    }

    #[RunInSeparateProcess]
    public function testRealHeaderDeliversOnlyThePopupBundle(): void
    {
        $globals = OEGlobalsBag::getInstance();
        $globals->set('kernel', new Kernel(self::root(), '/openemr'));
        $globals->set('webroot', '/openemr');
        $globals->set('v_js_includes', '77');
        SessionWrapperFactory::getInstance()->setActiveSession(new Session(new MockArraySessionStorage()));

        $expected = "\n"
            . "<link rel=\"stylesheet\"  href=\"/openemr/interface/clinical-workspace/popup.css?v=77\" />\n"
            . "\n"
            . "<script src=\"/openemr/interface/clinical-workspace/popup.js?v=77\" type=\"text/javascript\"></script>\n"
            . "\n";
        foreach (self::migratedPages() as [$path]) {
            $_SERVER['REQUEST_URI'] = '/openemr/' . $path . '?csrf_token_form=x';
            $this->assertSame($expected, Header::setupAssets(['workbench-popup']), $path);
        }
    }

    #[RunInSeparateProcess]
    public function testRealHeaderRendersTheVersionedReminderStylesheet(): void
    {
        $globals = OEGlobalsBag::getInstance();
        $globals->set('kernel', new Kernel(self::root(), '/openemr'));
        $globals->set('webroot', '/openemr');
        $globals->set('v_js_includes', '77');
        SessionWrapperFactory::getInstance()->setActiveSession(new Session(new MockArraySessionStorage()));

        $expected = "\n"
            . "<link rel=\"stylesheet\"  href=\"/openemr/interface/clinical-workspace/reminder-popup.css?v=77\" />\n"
            . "\n"
            . "\n";
        foreach (['interface/main/dated_reminders/dated_reminders_add.php', 'interface/main/dated_reminders/dated_reminders_log.php'] as $path) {
            $_SERVER['REQUEST_URI'] = '/openemr/' . $path;
            $this->assertSame($expected, Header::setupAssets(['workbench-reminder-popup']), $path);
        }
        $this->assertFileExists(self::root() . '/interface/clinical-workspace/reminder-popup.css');
    }
}
