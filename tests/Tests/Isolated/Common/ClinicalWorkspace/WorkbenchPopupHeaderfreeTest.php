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
 * PDF branches, inline styles, script order) fails here. The dispense label alone
 * first strips its exact approved OPEMR-48 screen style and body marker; any other
 * shape of that addition is left in place and breaks the same pin.
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
    private const DISPENSE = 'interface/drugs/dispense_drug.php';
    private const DISPENSE_OPT_IN_LINE = '   ' . self::OPT_IN . "\n";
    // OPEMR-48: the only approved prescription label addition besides the opt-in.
    private const DISPENSE_SCREEN_STYLE = "<style media=\"screen\">\n"
        . "html.oe-workbench-context body.oe-prescription-label-popup {\n"
        . "  background-color: var(--oe-wb-canvas, #f3f7f5);\n"
        . "}\n"
        . "\n"
        . "html.oe-workbench-context body.oe-prescription-label-popup > center > table {\n"
        . "  background-color: var(--oe-wb-paper, #fff);\n"
        . "}\n"
        . "</style>\n";
    private const DISPENSE_ORIGINAL_BODY = "</head>\n<body leftmargin='0' topmargin='0' marginwidth='0' marginheight='0'>\n";
    private const DISPENSE_MARKED_BODY = "</head>\n<body class=\"oe-prescription-label-popup\" leftmargin='0' topmargin='0' marginwidth='0' marginheight='0'>\n";

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
     * Exact inverse of the approved prescription label screen presentation: the
     * style block directly after the opt-in plus the body marker, both present once.
     * Any other shape, or any other page, is returned untouched so it drifts.
     */
    private static function withoutDispensePresentation(string $path, string $source): string
    {
        $styled = self::DISPENSE_OPT_IN_LINE . self::DISPENSE_SCREEN_STYLE;
        if (
            $path !== self::DISPENSE
            || substr_count($source, $styled) !== 1
            || substr_count($source, self::DISPENSE_SCREEN_STYLE) !== 1
            || substr_count($source, self::DISPENSE_MARKED_BODY) !== 1
            || substr_count($source, 'oe-prescription-label-popup') !== 3
        ) {
            return $source;
        }
        return str_replace(
            [$styled, self::DISPENSE_MARKED_BODY],
            [self::DISPENSE_OPT_IN_LINE, self::DISPENSE_ORIGINAL_BODY],
            $source,
        );
    }

    private static function withDispensePresentation(string $source): string
    {
        self::assertSame(1, substr_count($source, self::DISPENSE_OPT_IN_LINE));
        self::assertSame(1, substr_count($source, self::DISPENSE_ORIGINAL_BODY));
        return str_replace(
            [self::DISPENSE_OPT_IN_LINE, self::DISPENSE_ORIGINAL_BODY],
            [self::DISPENSE_OPT_IN_LINE . self::DISPENSE_SCREEN_STYLE, self::DISPENSE_MARKED_BODY],
            $source,
        );
    }

    private static function dispenseBaseline(): string
    {
        foreach (self::migratedPages() as [$page, $baseline]) {
            if ($page === self::DISPENSE) {
                return $baseline;
            }
        }
        self::fail('dispense label pin missing');
    }

    private static function dispenseDigest(string $source): string
    {
        return hash('sha256', self::withoutOptIn(self::withoutDispensePresentation(self::DISPENSE, $source)));
    }

    /**
     * @return array<string, array{string, string, list<string>}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function migratedPages(): array
    {
        // [path, baseline sha256 at 5619373 unless noted, markers that must precede the opt-in]
        return [
            'dispense label (dlgopen)' => [
                'interface/drugs/dispense_drug.php',
                '65a545871d768db317f6250bed79e0be92ac191893deef70616a161814ffc481',
                ['die(text($e->getMessage()));', 'include_opener.js', '<head>', '</style>', '<title>'],
            ],
            // Re-pinned to blob 58522b32 at upstream fork baseline
            // 9cbb8eec161f8ffff529503260999f1ac31f6d1c, whose only delta from 5619373
            // is convertToDataArray() gaining a PHPDoc and an `: array` return type.
            // Pre-upstream digest at 5619373 (blob d77f75de):
            // 908293a8a12eed11ed57772f8d04ef4974b067e8ee64eb1ed7de2db3b66f3910
            'shot record html branch' => [
                'interface/patient_file/summary/shot_record.php',
                '5843a40221f20779a1abd9cbce5c015a32e7e412de6cfd36b1669455677294b3',
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
            // Re-pinned to blob 7c8a9ea0 at upstream fork baseline
            // 9cbb8eec161f8ffff529503260999f1ac31f6d1c, whose only delta from 5619373
            // is return types on unitsWt/unitsDist (string), convertHeightToUs/
            // convertWeightToUs (float) and convertpoint (array), plus ten redundant
            // (string) casts dropped from imagestring() calls. Pre-upstream digest at
            // 5619373 (blob 59d4d517):
            // 9d7f087883b146dd0c78b520402abee722577bc1d33bc911a441f5c1271391ad
            'growth chart png/pdf/registered html' => [
                'interface/forms/vitals/growthchart/chart.php',
                '2eb9f7afdb5dfb3b4f3b16fc94562a31e54b7a571614e99cd38d17618aa9bf1d',
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
        $source = self::withoutDispensePresentation($path, self::source($path));
        $this->assertSame($baseline, hash('sha256', self::withoutOptIn($source)), "$path drifted beyond the opt-in");
    }

    #[DataProvider('excludedPages')]
    public function testExcludedPagesStayUntouched(string $path, string $baseline): void
    {
        $source = self::source($path);
        $this->assertStringNotContainsString('workbench-popup', $source);
        $this->assertStringNotContainsString('Header::', $source);
        $this->assertSame($baseline, hash('sha256', $source), "$path must stay byte-identical");
    }

    /**
     * Unapproved edits applied in memory to the current sources.
     *
     * @return array<string, array{string, string, string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function unapprovedEdits(): array
    {
        $shot = 'interface/patient_file/summary/shot_record.php';
        $chart = 'interface/forms/vitals/growthchart/chart.php';
        $dispense = 'interface/drugs/dispense_drug.php';
        return [
            'dispense: acl guard altered' => [$dispense, "AclMain::aclCheckCore('admin', 'drugs')", "AclMain::aclCheckCore('patients', 'med')"],
            'dispense: sale query scope altered' => [$dispense, '"s.sale_id = ? AND " .', '"s.pid = ? AND " .'],
            'dispense: label escaping dropped' => [$dispense, 'nl2br(text($label_text))', 'nl2br($label_text)'],
            'dispense: label width altered' => [$dispense, "style='width: 200pt'", "style='width: 100%'"],
            'dispense: print callback dropped' => [$dispense, " win.printLogPrint(window);\n", ''],
            'shot: patient scope dropped' => [$shot, ' where p.pid = ?", [$pid]);', ' where 1 = 1", []);'],
            'shot: pre-upstream signature restored' => [$shot, 'function convertToDataArray($data_array): array', 'function convertToDataArray($data_array)'],
            'shot: extra asset in head' => [$shot, "  </head>\n", "<?php echo Header::setupAssets(['no-bootstrap']); ?>\n  </head>\n"],
            'shot: pdf margins altered' => [$shot, '$pdf->ezSetMargins(72, 30, 50, 30);', '$pdf->ezSetMargins(36, 30, 50, 30);'],
            'chart: acl guard altered' => [$chart, "AclMain::aclCheckCore('patients', 'med')", "AclMain::aclCheckCore('patients', 'demo')"],
            'chart: unit conversion altered' => [$chart, 'return $height * 0.393701;', 'return $height * 0.3937;'],
            'chart: dropped gd cast restored' => [$chart, '$datatable_hc_offset), $datatable_y, unitsDist($head_circ), $color);', '$datatable_hc_offset), $datatable_y, (string) unitsDist($head_circ), $color);'],
            'chart: return type removed' => [$chart, 'function convertpoint($coord): array', 'function convertpoint($coord)'],
            'chart: extra asset in head' => [$chart, "    </head>\n", "    <script src=\"extra.js\"></script>\n    </head>\n"],
            'chart: pdf margins altered' => [$chart, '$pdf->ezSetMargins(0, 0, 0, 0);', '$pdf->ezSetMargins(5, 5, 5, 5);'],
        ];
    }

    #[DataProvider('unapprovedEdits')]
    public function testUnapprovedEditsBreakThePins(string $path, string $search, string $replace): void
    {
        $pins = [];
        foreach (self::migratedPages() as [$page, $baseline]) {
            $pins[$page] = [$baseline, true];
        }
        foreach (self::excludedPages() as [$page, $baseline]) {
            $pins[$page] = [$baseline, false];
        }
        $this->assertArrayHasKey($path, $pins);
        [$baseline, $optIn] = $pins[$path];

        $digest = static fn (string $source): string => hash('sha256', $optIn ? self::withoutOptIn(self::withoutDispensePresentation($path, $source)) : $source);
        $source = self::source($path);
        $this->assertSame($baseline, $digest($source), "$path must match its pin before the edit");
        $this->assertSame(1, substr_count($source, $search), "$path: edit anchor must be unique");

        $edited = str_replace($search, $replace, $source);
        $this->assertNotSame($baseline, $digest($edited), "$path: unapproved edit must break the pin");
    }

    public function testDispensePresentationIsTheOnlyNormalizedAddition(): void
    {
        $baseline = self::dispenseBaseline();
        $original = self::withoutDispensePresentation(self::DISPENSE, self::source(self::DISPENSE));
        $this->assertSame($baseline, hash('sha256', self::withoutOptIn($original)));
        $this->assertSame(0, substr_count($original, 'oe-prescription-label-popup'));
        $this->assertSame($original, self::withoutDispensePresentation(self::DISPENSE, $original), 'the untouched original is left as is');

        $candidate = self::withDispensePresentation($original);
        $this->assertNotSame($original, $candidate);
        $this->assertSame($original, self::withoutDispensePresentation(self::DISPENSE, $candidate));
        $this->assertSame($baseline, self::dispenseDigest($candidate));
        $this->assertNotSame($baseline, hash('sha256', self::withoutOptIn($candidate)), 'the raw pin still sees the addition');

        foreach (self::migratedPages() as [$page]) {
            if ($page !== self::DISPENSE) {
                $other = self::source($page);
                $this->assertSame($other, self::withoutDispensePresentation($page, $other), "$page is never normalized");
            }
        }
        $this->assertSame($candidate, self::withoutDispensePresentation('interface/patient_file/summary/shot_record.php', $candidate));
    }

    /**
     * Malformed or extra prescription label additions, applied to the approved candidate.
     *
     * @return array<string, array{string, string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function malformedDispensePresentations(): array
    {
        $styled = self::DISPENSE_OPT_IN_LINE . self::DISPENSE_SCREEN_STYLE;
        $scope = 'html.oe-workbench-context body.oe-prescription-label-popup';
        $marker = 'class="oe-prescription-label-popup"';
        return [
            'style block without body marker' => [self::DISPENSE_MARKED_BODY, self::DISPENSE_ORIGINAL_BODY],
            'body marker without style block' => [$styled, self::DISPENSE_OPT_IN_LINE],
            'style block duplicated' => [self::DISPENSE_SCREEN_STYLE, self::DISPENSE_SCREEN_STYLE . self::DISPENSE_SCREEN_STYLE],
            'style block before the opt-in' => [$styled, self::DISPENSE_SCREEN_STYLE . self::DISPENSE_OPT_IN_LINE],
            'marker duplicated' => [$marker, 'class="oe-prescription-label-popup oe-prescription-label-popup"'],
            'marker drops legacy margins' => [$marker . " leftmargin='0' ", $marker . ' '],
            'media print' => ['<style media="screen">', '<style media="print">'],
            'media dropped' => ['<style media="screen">', '<style>'],
            'generic body scope' => [$scope . " {\n", "body {\n"],
            'ink override' => ["  background-color: var(--oe-wb-canvas, #f3f7f5);\n", "  color: var(--oe-wb-ink, #17343b);\n  background-color: var(--oe-wb-canvas, #f3f7f5);\n"],
            'paper padding' => ["  background-color: var(--oe-wb-paper, #fff);\n", "  background-color: var(--oe-wb-paper, #fff);\n  padding: 4pt;\n"],
            'extra rule reaching the separator' => ["}\n</style>\n</head>\n", "}\n\n$scope > center > table td[style] {\n  background-color: inherit;\n}\n</style>\n</head>\n"],
            'label width altered' => ["style='width: 200pt'", "style='width: 100%'"],
            'labtop size altered' => ["    font-size: 7pt;\n", "    font-size: 8pt;\n"],
            'acl guard altered' => ["AclMain::aclCheckCore('admin', 'drugs')", "AclMain::aclCheckCore('patients', 'med')"],
            'sale query scope altered' => ['"s.sale_id = ? AND " .', '"s.pid = ? AND " .'],
            'label escaping dropped' => ['nl2br(text($label_text))', 'nl2br($label_text)'],
            'print callback dropped' => [" win.printLogPrint(window);\n", ''],
        ];
    }

    #[DataProvider('malformedDispensePresentations')]
    public function testMalformedDispensePresentationsBreakThePin(string $search, string $replace): void
    {
        $candidate = self::withDispensePresentation(self::withoutDispensePresentation(self::DISPENSE, self::source(self::DISPENSE)));
        $this->assertSame(self::dispenseBaseline(), self::dispenseDigest($candidate));
        $this->assertSame(1, substr_count($candidate, $search), 'edit anchor must be unique');

        $edited = str_replace($search, $replace, $candidate);
        $this->assertNotSame(self::dispenseBaseline(), self::dispenseDigest($edited), 'malformed presentation must break the pin');
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
