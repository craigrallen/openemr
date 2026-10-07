<?php

/**
 * Isolated tests for ClinicalWorkspaceAssets per-file cache versions.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Common\Assets;

use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
class ClinicalWorkspaceAssetsTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/oe-clinical-assets-' . bin2hex(random_bytes(6));
        mkdir($this->directory);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory . '/*') ?: [] as $file) {
            unlink($file);
        }
        rmdir($this->directory);
    }

    #[Test]
    public function versionIsTheFileModificationTime(): void
    {
        $this->writeAsset('appointment.css', 1_700_000_000);
        $this->writeAsset('mode.js', 1_700_000_123);

        $assets = new ClinicalWorkspaceAssets($this->directory);

        self::assertSame('1700000000', $assets->version('appointment.css'));
        self::assertSame('1700000123', $assets->version('mode.js'));
    }

    #[Test]
    public function versionFollowsAChangedFile(): void
    {
        $this->writeAsset('visit-history.css', 1_700_000_000);
        $assets = new ClinicalWorkspaceAssets($this->directory);
        self::assertSame('1700000000', $assets->version('visit-history.css'));

        $this->writeAsset('visit-history.css', 1_700_086_400);

        self::assertSame('1700086400', $assets->version('visit-history.css'));
    }

    #[Test]
    public function missingSupportedAssetFallsBackToZero(): void
    {
        $assets = new ClinicalWorkspaceAssets($this->directory);

        self::assertSame('0', $assets->version('ajtooltip.js'));
    }

    #[Test]
    public function directoryInPlaceOfAnAssetFallsBackToZero(): void
    {
        mkdir($this->directory . '/mode.js');
        try {
            self::assertSame('0', (new ClinicalWorkspaceAssets($this->directory))->version('mode.js'));
        } finally {
            rmdir($this->directory . '/mode.js');
        }
    }

    #[Test]
    #[DataProvider('unsupportedAssetProvider')]
    public function unsupportedAssetIsRejected(string $asset): void
    {
        // A real file at the requested location proves rejection is by name, not by absence.
        $this->writeAsset('unlisted.css', 1_700_000_000);
        $assets = new ClinicalWorkspaceAssets($this->directory);

        $this->expectException(\InvalidArgumentException::class);
        $assets->version($asset);
    }

    /**
     * @return array<string, array{string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function unsupportedAssetProvider(): array
    {
        return [
            'empty name' => [''],
            'unlisted sibling' => ['unlisted.css'],
            'parent traversal' => ['../appointment.css'],
            'traversal back into a listed name' => ['x/../mode.js'],
            'absolute path' => ['/etc/passwd'],
            'case variant' => ['Appointment.CSS'],
            'query suffix' => ['mode.js?v=1'],
            'near-miss lbf stylesheet' => ['lbf_document.css'],
            'lbf stylesheet outside the workspace' => ['../forms/LBF/lbf-document.css'],
            'trailing nul' => ["mode.js\0"],
            'near-miss global messages stylesheet' => ['global_messages.css'],
        ];
    }

    #[Test]
    public function defaultDirectoryIsTheShippedClinicalWorkspace(): void
    {
        $shipped = dirname(__DIR__, 5) . '/interface/clinical-workspace/appointment.css';
        self::assertFileExists($shipped);
        clearstatcache(true, $shipped);

        self::assertSame(
            (string) filemtime($shipped),
            (new ClinicalWorkspaceAssets())->version('appointment.css')
        );
    }

    #[Test]
    public function visitHistoryKeyboardScriptIsVersioned(): void
    {
        $this->writeAsset('visit-history.js', 1_700_000_456);

        self::assertSame('1700000456', (new ClinicalWorkspaceAssets($this->directory))->version('visit-history.js'));
    }

    #[Test]
    public function calendarSidebarScriptIsVersionedFromItsOwnFile(): void
    {
        $this->writeAsset('calendar-sidebar.js', 1_700_000_789);
        $assets = new ClinicalWorkspaceAssets($this->directory);
        self::assertSame('1700000789', $assets->version('calendar-sidebar.js'));

        $this->writeAsset('calendar-sidebar.js', 1_700_090_000);
        self::assertSame('1700090000', $assets->version('calendar-sidebar.js'));

        $shipped = dirname(__DIR__, 5) . '/interface/clinical-workspace/calendar-sidebar.js';
        self::assertFileExists($shipped);
        clearstatcache(true, $shipped);
        self::assertSame((string) filemtime($shipped), (new ClinicalWorkspaceAssets())->version('calendar-sidebar.js'));
    }

    #[Test]
    public function calendarWorkdayAssetsAreVersionedPerFile(): void
    {
        $this->writeAsset('calendar-workday.css', 1_700_000_700);
        $this->writeAsset('calendar-workday.js', 1_700_000_800);
        $assets = new ClinicalWorkspaceAssets($this->directory);

        self::assertSame('1700000700', $assets->version('calendar-workday.css'));
        self::assertSame('1700000800', $assets->version('calendar-workday.js'));
    }

    #[Test]
    public function finderStylesheetIsVersioned(): void
    {
        $this->writeAsset('finder.css', 1_700_000_789);

        self::assertSame('1700000789', (new ClinicalWorkspaceAssets($this->directory))->version('finder.css'));
    }

    #[Test]
    public function shippedFinderStylesheetIsVersioned(): void
    {
        $shipped = dirname(__DIR__, 5) . '/interface/clinical-workspace/finder.css';
        self::assertFileExists($shipped);
        clearstatcache(true, $shipped);

        self::assertSame((string) filemtime($shipped), (new ClinicalWorkspaceAssets())->version('finder.css'));
    }

    #[Test]
    public function soapDocumentAssetsAreVersionedIndependently(): void
    {
        $this->writeAsset('soap-document.css', 1_700_000_789);
        $this->writeAsset('soap-document.js', 1_700_000_790);
        $assets = new ClinicalWorkspaceAssets($this->directory);

        self::assertSame('1700000789', $assets->version('soap-document.css'));
        self::assertSame('1700000790', $assets->version('soap-document.js'));
    }

    #[Test]
    public function encounterDocumentStylesheetIsVersionedPerFile(): void
    {
        $this->writeAsset('encounter-document.css', 1_700_000_910);
        $this->writeAsset('workspace.css', 1_700_000_911);
        $assets = new ClinicalWorkspaceAssets($this->directory);

        self::assertSame('1700000910', $assets->version('encounter-document.css'));
        self::assertSame('1700000911', $assets->version('workspace.css'));
    }

    #[Test]
    public function shippedEncounterDocumentStylesheetIsVersioned(): void
    {
        $shipped = dirname(__DIR__, 5) . '/interface/clinical-workspace/encounter-document.css';
        self::assertFileExists($shipped);
        clearstatcache(true, $shipped);

        self::assertSame((string) filemtime($shipped), (new ClinicalWorkspaceAssets())->version('encounter-document.css'));
    }

    #[Test]
    public function lbfDocumentStylesheetIsVersionedPerFile(): void
    {
        $this->writeAsset('lbf-document.css', 1_700_001_101);
        $this->writeAsset('encounter-document.css', 1_700_001_102);
        $assets = new ClinicalWorkspaceAssets($this->directory);

        self::assertSame('1700001101', $assets->version('lbf-document.css'));
        self::assertSame('1700001102', $assets->version('encounter-document.css'));
    }

    #[Test]
    public function shippedLbfDocumentStylesheetIsVersioned(): void
    {
        $shipped = dirname(__DIR__, 5) . '/interface/clinical-workspace/lbf-document.css';
        self::assertFileExists($shipped);
        clearstatcache(true, $shipped);

        self::assertSame((string) filemtime($shipped), (new ClinicalWorkspaceAssets())->version('lbf-document.css'));
    }

    #[Test]
    public function historyDocumentStylesheetIsVersionedPerFile(): void
    {
        $this->writeAsset('history-document.css', 1_700_001_201);
        $this->writeAsset('workspace.css', 1_700_001_202);
        $assets = new ClinicalWorkspaceAssets($this->directory);

        self::assertSame('1700001201', $assets->version('history-document.css'));
        self::assertSame('1700001202', $assets->version('workspace.css'));
    }

    #[Test]
    public function missingHistoryDocumentStylesheetVersionIsZero(): void
    {
        self::assertSame('0', (new ClinicalWorkspaceAssets($this->directory))->version('history-document.css'));
    }

    #[Test]
    public function shippedHistoryDocumentStylesheetIsVersioned(): void
    {
        $shipped = dirname(__DIR__, 5) . '/interface/clinical-workspace/history-document.css';
        self::assertFileExists($shipped);
        clearstatcache(true, $shipped);

        self::assertSame((string) filemtime($shipped), (new ClinicalWorkspaceAssets())->version('history-document.css'));
    }

    #[Test]
    public function recordWorkspaceStylesheetIsVersionedPerFile(): void
    {
        $this->writeAsset('workspace.css', 1_700_000_901);

        self::assertSame('1700000901', (new ClinicalWorkspaceAssets($this->directory))->version('workspace.css'));
    }

    #[Test]
    public function shippedWorkspaceStylesheetIsVersioned(): void
    {
        $shipped = dirname(__DIR__, 5) . '/interface/clinical-workspace/workspace.css';
        self::assertFileExists($shipped);
        clearstatcache(true, $shipped);

        self::assertSame((string) filemtime($shipped), (new ClinicalWorkspaceAssets())->version('workspace.css'));
    }

    #[Test]
    public function patientMessagesStylesheetIsVersioned(): void
    {
        $this->writeAsset('patient-messages.css', 1_700_001_001);

        self::assertSame('1700001001', (new ClinicalWorkspaceAssets($this->directory))->version('patient-messages.css'));
    }

    #[Test]
    public function shippedPatientMessagesStylesheetIsVersioned(): void
    {
        $shipped = dirname(__DIR__, 5) . '/interface/clinical-workspace/patient-messages.css';
        self::assertFileExists($shipped);
        clearstatcache(true, $shipped);

        self::assertSame((string) filemtime($shipped), (new ClinicalWorkspaceAssets())->version('patient-messages.css'));
    }

    #[Test]
    public function globalMessagesStylesheetIsVersionedPerFile(): void
    {
        $this->writeAsset('global-messages.css', 1_700_001_201);
        $this->writeAsset('patient-messages.css', 1_700_001_202);
        $assets = new ClinicalWorkspaceAssets($this->directory);

        self::assertSame('1700001201', $assets->version('global-messages.css'));
        self::assertSame('1700001202', $assets->version('patient-messages.css'));
    }

    #[Test]
    public function shippedGlobalMessagesStylesheetIsVersioned(): void
    {
        $shipped = dirname(__DIR__, 5) . '/interface/clinical-workspace/global-messages.css';
        self::assertFileExists($shipped);
        clearstatcache(true, $shipped);

        self::assertSame((string) filemtime($shipped), (new ClinicalWorkspaceAssets())->version('global-messages.css'));
    }

    #[Test]
    public function globalMessagesAndHistoryDocumentStylesheetsAreBothSupported(): void
    {
        $this->writeAsset('global-messages.css', 1_700_002_001);
        $this->writeAsset('history-document.css', 1_700_002_002);
        $assets = new ClinicalWorkspaceAssets($this->directory);

        self::assertSame('1700002001', $assets->version('global-messages.css'));
        self::assertSame('1700002002', $assets->version('history-document.css'));

        $this->writeAsset('history-document.css', 1_700_002_100);
        self::assertSame('1700002001', $assets->version('global-messages.css'));
        self::assertSame('1700002100', $assets->version('history-document.css'));

        unlink($this->directory . '/global-messages.css');
        self::assertSame('0', $assets->version('global-messages.css'));
        self::assertSame('1700002100', $assets->version('history-document.css'));

        foreach (['history_document.css', 'global_messages.css', '../clinical-workspace/history-document.css'] as $unsupported) {
            try {
                $assets->version($unsupported);
                self::fail('Expected rejection of ' . $unsupported);
            } catch (\InvalidArgumentException) {
                // Rejected by name, as required.
            }
        }
    }

    #[Test]
    public function shippedSoapDocumentAssetsExist(): void
    {
        $assets = new ClinicalWorkspaceAssets();

        self::assertNotSame('0', $assets->version('soap-document.css'));
        self::assertNotSame('0', $assets->version('soap-document.js'));
    }

    private function writeAsset(string $name, int $mtime): void
    {
        $path = $this->directory . '/' . $name;
        file_put_contents($path, '/* ' . $mtime . ' */');
        touch($path, $mtime);
    }
}
