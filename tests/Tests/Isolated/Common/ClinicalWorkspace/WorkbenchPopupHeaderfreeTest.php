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
 * OPEMR-49: the prior-auth deleter (a mutating GET) may additionally carry one
 * exact, screen-only presentation seam: a <style media="screen"> block right
 * after its opt-in and a body class marker. That seam alone is removed, once,
 * for that route only, before the opt-in removal; the result must equal the
 * frozen master-18647270 fixture byte for byte. Any other route is returned
 * unchanged. This shared test is also changed on parked PR121/PR122; those
 * changes are deliberately not imported here and need combined-train
 * reconciliation when the branches meet.
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

    private const PRIOR_AUTH_DELETER = 'interface/modules/custom_modules/oe-module-prior-authorizations/public/deleter.php';
    private const PRIOR_AUTH_FIXTURE = 'tests/fixtures/clinical-workspace/prior-auth-deleter.master-18647270.txt';
    private const PRIOR_AUTH_MARKER = 'oe-prior-auth-delete-popup';
    private const PRIOR_AUTH_OPT_IN_LINE = '    ' . self::OPT_IN . "\n";
    private const PRIOR_AUTH_BODY_ORIGINAL = "<body>\n";
    private const PRIOR_AUTH_BODY_APPROVED = '<body class="oe-prior-auth-delete-popup">' . "\n";
    private const PRIOR_AUTH_STYLE = '    <style media="screen">' . "\n"
        . '        html.oe-workbench-context body.oe-prior-auth-delete-popup {' . "\n"
        . '          background-color: var(--oe-wb-canvas, #f3f7f5);' . "\n"
        . '        }' . "\n"
        . "\n"
        . '        html.oe-workbench-context body.oe-prior-auth-delete-popup > p {' . "\n"
        . '          color: var(--oe-wb-ink, #17343b);' . "\n"
        . '          background-color: var(--oe-wb-paper, #fff);' . "\n"
        . '          box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);' . "\n"
        . '        }' . "\n"
        . '    </style>' . "\n";
    private const PRIOR_AUTH_ORIGINAL_SEAM = self::PRIOR_AUTH_OPT_IN_LINE . "</head>\n" . self::PRIOR_AUTH_BODY_ORIGINAL;
    private const PRIOR_AUTH_APPROVED_SEAM = self::PRIOR_AUTH_OPT_IN_LINE . self::PRIOR_AUTH_STYLE . "</head>\n" . self::PRIOR_AUTH_BODY_APPROVED;

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
     * Strict inverse of the OPEMR-49 presentation: removes the approved seam
     * exactly once. Null for a missing, relocated, duplicated or malformed
     * block or body marker, or for any leftover marker/style residue.
     */
    private static function priorAuthRestored(string $source): ?string
    {
        if (
            substr_count($source, self::PRIOR_AUTH_APPROVED_SEAM) !== 1
            || substr_count($source, self::PRIOR_AUTH_STYLE) !== 1
        ) {
            return null;
        }
        $restored = str_replace(self::PRIOR_AUTH_APPROVED_SEAM, self::PRIOR_AUTH_ORIGINAL_SEAM, $source);
        foreach ([self::PRIOR_AUTH_MARKER, '<style', '</style', 'media='] as $residue) {
            if (str_contains($restored, $residue)) {
                return null;
            }
        }
        return $restored;
    }

    /**
     * Route-specific presentation normalization, applied once before the
     * opt-in removal. Other routes are returned unchanged; the deleter is
     * returned unchanged only when it carries no trace of the presentation.
     */
    private static function normalizedPresentation(string $path, string $source): ?string
    {
        if ($path !== self::PRIOR_AUTH_DELETER) {
            return $source;
        }
        foreach ([self::PRIOR_AUTH_MARKER, '<style', '</style'] as $trace) {
            if (str_contains($source, $trace)) {
                return self::priorAuthRestored($source);
            }
        }
        return $source;
    }

    private static function withoutApprovedPresentation(string $path, string $source): string
    {
        $normalized = self::normalizedPresentation($path, $source);
        self::assertIsString($normalized, "$path carries a malformed or unapproved presentation");
        return $normalized;
    }

    private static function priorAuthBaseline(): string
    {
        foreach (self::migratedPages() as [$page, $baseline]) {
            if ($page === self::PRIOR_AUTH_DELETER) {
                return $baseline;
            }
        }
        self::fail('prior auth deleter pin missing');
    }

    /**
     * The exact approved future route, built from the frozen original.
     */
    private static function priorAuthCandidate(): string
    {
        $fixture = self::source(self::PRIOR_AUTH_FIXTURE);
        self::assertSame(1, substr_count($fixture, self::PRIOR_AUTH_ORIGINAL_SEAM), 'fixture seam must be unique');
        return str_replace(self::PRIOR_AUTH_ORIGINAL_SEAM, self::PRIOR_AUTH_APPROVED_SEAM, $fixture);
    }

    /**
     * Production acceptance: full restored-route equality with the frozen
     * fixture, the existing pin, and the exact approved candidate.
     */
    private static function priorAuthAccepted(string $candidate): bool
    {
        $restored = self::priorAuthRestored($candidate);
        return $restored !== null
            && $restored === self::source(self::PRIOR_AUTH_FIXTURE)
            && hash('sha256', self::withoutOptIn($restored)) === self::priorAuthBaseline()
            && $candidate === self::priorAuthCandidate();
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
        $normalized = self::withoutApprovedPresentation($path, self::source($path));
        $this->assertSame($baseline, hash('sha256', self::withoutOptIn($normalized)), "$path drifted beyond the opt-in");
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
        $deleter = self::PRIOR_AUTH_DELETER;
        return [
            'deleter: acl permission changed' => [$deleter, "aclCheckCore('admin', 'practice')", "aclCheckCore('admin', 'super')"],
            'deleter: csrf source changed' => [$deleter, 'checkCsrfInput(INPUT_GET', 'checkCsrfInput(INPUT_POST'],
            'deleter: delete id source changed' => [$deleter, '[$_GET[\'id\']]', '[$_REQUEST[\'id\']]'],
            'deleter: extra script in head' => [$deleter, "</head>\n", "    <script src=\"extra.js\"></script>\n</head>\n"],
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

        $digest = static function (string $source) use ($path, $optIn): string {
            if (!$optIn) {
                return hash('sha256', $source);
            }
            $normalized = self::normalizedPresentation($path, $source);
            return $normalized === null ? 'malformed presentation' : hash('sha256', self::withoutOptIn($normalized));
        };
        $source = self::source($path);
        $this->assertSame($baseline, $digest($source), "$path must match its pin before the edit");
        $this->assertSame(1, substr_count($source, $search), "$path: edit anchor must be unique");

        $edited = str_replace($search, $replace, $source);
        $this->assertNotSame($baseline, $digest($edited), "$path: unapproved edit must break the pin");
    }

    public function testPriorAuthFixtureMatchesTheExistingPin(): void
    {
        $fixture = self::source(self::PRIOR_AUTH_FIXTURE);
        $this->assertSame(self::priorAuthBaseline(), hash('sha256', self::withoutOptIn($fixture)));
        $this->assertSame(1, substr_count($fixture, self::PRIOR_AUTH_ORIGINAL_SEAM));
        foreach ([self::PRIOR_AUTH_MARKER, '<style', '</style', '<script', '<link'] as $residue) {
            $this->assertStringNotContainsString($residue, $fixture);
        }
    }

    public function testPriorAuthDeleterCarriesExactlyTheApprovedPresentation(): void
    {
        $this->assertSame(self::priorAuthCandidate(), self::source(self::PRIOR_AUTH_DELETER));
        $this->assertTrue(self::priorAuthAccepted(self::source(self::PRIOR_AUTH_DELETER)));
    }

    public function testPriorAuthDeleterRestoresToTheFrozenRoute(): void
    {
        $restored = self::withoutApprovedPresentation(self::PRIOR_AUTH_DELETER, self::source(self::PRIOR_AUTH_DELETER));
        $this->assertSame(self::source(self::PRIOR_AUTH_FIXTURE), $restored);
    }

    public function testPriorAuthUntouchedAndCandidateNormalizeCorrectly(): void
    {
        $fixture = self::source(self::PRIOR_AUTH_FIXTURE);
        $candidate = self::priorAuthCandidate();

        $this->assertNotSame($fixture, $candidate);
        $this->assertSame($fixture, self::normalizedPresentation(self::PRIOR_AUTH_DELETER, $fixture));
        $this->assertSame($fixture, self::normalizedPresentation(self::PRIOR_AUTH_DELETER, $candidate));
        $this->assertNull(self::priorAuthRestored($fixture));
        $this->assertSame($fixture, self::priorAuthRestored($candidate));
        $this->assertFalse(self::priorAuthAccepted($fixture));
        $this->assertTrue(self::priorAuthAccepted($candidate));
    }

    public function testPriorAuthNormalizationLeavesOtherRoutesUnchanged(): void
    {
        $pages = [];
        foreach (self::migratedPages() as [$page]) {
            $pages[] = $page;
        }
        foreach (self::excludedPages() as [$page]) {
            $pages[] = $page;
        }
        foreach ($pages as $page) {
            if ($page === self::PRIOR_AUTH_DELETER) {
                continue;
            }
            $source = self::source($page);
            $this->assertSame($source, self::normalizedPresentation($page, $source), $page);
        }

        $shot = 'interface/patient_file/summary/shot_record.php';
        $source = self::source($shot);
        $this->assertSame(1, substr_count($source, "  </head>\n"), 'shot record anchor must be unique');
        $injected = str_replace("  </head>\n", self::PRIOR_AUTH_STYLE . "  </head>\n", $source);
        $this->assertNotSame($source, $injected);
        $this->assertSame($injected, self::normalizedPresentation($shot, $injected), 'other routes are never stripped');
        $baseline = '';
        foreach (self::migratedPages() as [$page, $pin]) {
            if ($page === $shot) {
                $baseline = $pin;
            }
        }
        $this->assertNotSame($baseline, hash('sha256', self::withoutOptIn($injected)));
    }

    /**
     * Unapproved edits applied in memory to the synthetic approved candidate.
     *
     * @return array<string, array{string, string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function priorAuthMutants(): array
    {
        $style = self::PRIOR_AUTH_STYLE;
        $optIn = self::PRIOR_AUTH_OPT_IN_LINE;
        $body = self::PRIOR_AUTH_BODY_APPROVED;
        $canvas = '          background-color: var(--oe-wb-canvas, #f3f7f5);' . "\n";
        $ink = '          color: var(--oe-wb-ink, #17343b);' . "\n";
        $paper = '          background-color: var(--oe-wb-paper, #fff);' . "\n";
        $shadow = '          box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);' . "\n";
        return [
            'style block missing' => [$style, ''],
            'body marker missing' => [$body, self::PRIOR_AUTH_BODY_ORIGINAL],
            'block relocated after head' => [$style . "</head>\n", "</head>\n" . $style],
            'block relocated before opt-in' => [$optIn . $style, $style . $optIn],
            'block duplicated' => [$style, $style . $style],
            'blank line between rules removed' => ["        }\n\n        html", "        }\n        html"],
            'declaration indentation changed' => [$canvas, '        background-color: var(--oe-wb-canvas, #f3f7f5);' . "\n"],
            'closing brace dropped' => [$shadow . "        }\n", $shadow],
            'media widened to all' => ['<style media="screen">', '<style media="all">'],
            'media removed' => ['<style media="screen">', '<style>'],
            'canvas fallback changed' => ['var(--oe-wb-canvas, #f3f7f5)', 'var(--oe-wb-canvas, #fff)'],
            'ink token changed' => [$ink, '          color: var(--oe-wb-muted, #526a70);' . "\n"],
            'paper token swapped' => [$paper, $canvas],
            'box shadow removed' => [$shadow, ''],
            'important added' => ['var(--oe-wb-line, #d9e4e2);', 'var(--oe-wb-line, #d9e4e2) !important;'],
            'padding added' => [$paper, $paper . '          padding: 1rem;' . "\n"],
            'margin added' => [$canvas, $canvas . '          margin: 0;' . "\n"],
            'font added' => [$ink, $ink . '          font-family: Arial, sans-serif;' . "\n"],
            'workbench gate dropped' => ['html.oe-workbench-context body.oe-prior-auth-delete-popup {', 'body.oe-prior-auth-delete-popup {'],
            'child combinator widened' => ['body.oe-prior-auth-delete-popup > p {', 'body.oe-prior-auth-delete-popup p {'],
            'stylesheet link added' => ["    </style>\n", "    </style>\n" . '    <link rel="stylesheet" href="extra.css">' . "\n"],
            'head script added' => ["    </style>\n", "    </style>\n" . '    <script src="extra.js"></script>' . "\n"],
            'body script added' => [$body, $body . '    <script>window.close();</script>' . "\n"],
            'second asset bundle' => ["Header::setupAssets(['workbench-popup'])", "Header::setupAssets(['workbench-popup', 'no-bootstrap'])"],
            'setupHeader added' => [$optIn, '    <?php Header::setupHeader(); ?>' . "\n" . $optIn],
            'body class extended' => ['<body class="oe-prior-auth-delete-popup">', '<body class="oe-prior-auth-delete-popup container">'],
            'body attribute added' => ['<body class="oe-prior-auth-delete-popup">', '<body class="oe-prior-auth-delete-popup" onload="window.close()">'],
            'body class single-quoted' => ['<body class="oe-prior-auth-delete-popup">', "<body class='oe-prior-auth-delete-popup'>"],
            'marker copied onto html' => ['<html lang="en">', '<html lang="en" class="oe-prior-auth-delete-popup">'],
            'paragraph class added' => ['    <p><?php', '    <p class="m-2"><?php'],
            'acl permission changed' => ["aclCheckCore('admin', 'practice')", "aclCheckCore('admin', 'super')"],
            'acl check inverted' => ['if (!AclMain::', 'if (AclMain::'],
            'unauthorized message changed' => ["echo xlt('Unauthorized');", "echo xlt('Not allowed');"],
            'unauthorized die removed' => ["    die;\n", ''],
            'bootstrap depth changed' => ["dirname(__FILE__, 5) . '/globals.php'", "dirname(__FILE__, 4) . '/globals.php'"],
            'csrf source changed' => ['checkCsrfInput(INPUT_GET', 'checkCsrfInput(INPUT_POST'],
            'csrf no longer dies' => ['dieOnFail: true', 'dieOnFail: false'],
            'csrf check removed' => ['CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);' . "\n", ''],
            'delete table changed' => ['`module_prior_authorizations`', '`module_prior_authorizations_archive`'],
            'delete scope widened' => ['where `id` = ?', 'where `id` >= ?'],
            'delete id source changed' => ['[$_GET[\'id\']]', '[$_REQUEST[\'id\']]'],
            'session line removed' => ['$session = SessionWrapperFactory::getInstance()->getActiveSession();' . "\n", ''],
            'message text changed' => ['Click done, pls', 'Click Done'],
            'message spacing removed' => ['"<br> <br>" .  ', ''],
            'title changed' => ["xlt('Delete Record')", "xlt('Delete Prior Authorization')"],
            'viewport scaling changed' => ['user-scalable=no', 'user-scalable=yes'],
            'document language changed' => ['<html lang="en">', '<html lang="sv">'],
        ];
    }

    #[DataProvider('priorAuthMutants')]
    public function testPriorAuthUnapprovedEditsAreRejected(string $search, string $replace): void
    {
        $candidate = self::priorAuthCandidate();
        $this->assertTrue(self::priorAuthAccepted($candidate), 'approved candidate must be accepted before the edit');
        $this->assertSame(1, substr_count($candidate, $search), 'edit anchor must be unique');
        $edited = str_replace($search, $replace, $candidate);
        $this->assertNotSame($candidate, $edited, 'edit must change the candidate');

        $this->assertFalse(self::priorAuthAccepted($edited), 'unapproved edit must be rejected');
        $normalized = self::normalizedPresentation(self::PRIOR_AUTH_DELETER, $edited);
        $this->assertTrue(
            $normalized === null || hash('sha256', self::withoutOptIn($normalized)) !== self::priorAuthBaseline(),
            'unapproved edit must break the shared pin',
        );
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
