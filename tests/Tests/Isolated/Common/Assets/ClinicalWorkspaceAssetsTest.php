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
        $this->writeAsset('workspace.css', 1_700_000_000);
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
            'unlisted sibling' => ['workspace.css'],
            'parent traversal' => ['../appointment.css'],
            'traversal back into a listed name' => ['x/../mode.js'],
            'absolute path' => ['/etc/passwd'],
            'case variant' => ['Appointment.CSS'],
            'query suffix' => ['mode.js?v=1'],
            'trailing nul' => ["mode.js\0"],
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
    public function calendarWorkdayAssetsAreVersionedPerFile(): void
    {
        $this->writeAsset('calendar-workday.css', 1_700_000_700);
        $this->writeAsset('calendar-workday.js', 1_700_000_800);
        $assets = new ClinicalWorkspaceAssets($this->directory);

        self::assertSame('1700000700', $assets->version('calendar-workday.css'));
        self::assertSame('1700000800', $assets->version('calendar-workday.js'));
    }

    private function writeAsset(string $name, int $mtime): void
    {
        $path = $this->directory . '/' . $name;
        file_put_contents($path, '/* ' . $mtime . ' */');
        touch($path, $mtime);
    }
}
