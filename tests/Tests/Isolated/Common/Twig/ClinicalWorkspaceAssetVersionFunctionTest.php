<?php

/**
 * Real Twig rendering of the clinicalWorkspaceAssetVersion() function and the encounter head
 * partial that uses it.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Common\Twig;

use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;
use OpenEMR\Common\Twig\TwigExtension;
use OpenEMR\Core\Kernel;
use OpenEMR\Core\OEGlobalsBag;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Twig\Environment;
use Twig\Error\RuntimeError;
use Twig\Loader\ArrayLoader;
use Twig\Loader\FilesystemLoader;
use Twig\Loader\LoaderInterface;
use Twig\TwigFunction;

#[Group('isolated')]
#[Group('twig')]
final class ClinicalWorkspaceAssetVersionFunctionTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/oe-clinical-twig-assets-' . bin2hex(random_bytes(6));
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
    public function rendersTheAssetModificationTime(): void
    {
        $this->writeAsset('encounter-document.css', 1_700_000_555);

        self::assertSame('1700000555', $this->renderString("{{ clinicalWorkspaceAssetVersion('encounter-document.css') }}"));
    }

    #[Test]
    public function rendersZeroForAMissingSupportedAsset(): void
    {
        self::assertSame('0', $this->renderString("{{ clinicalWorkspaceAssetVersion('encounter-document.css') }}"));
    }

    #[Test]
    public function refusesAnAssetOutsideTheAllowlist(): void
    {
        $this->writeAsset('other.css', 1_700_000_556);

        try {
            $this->renderString("{{ clinicalWorkspaceAssetVersion('other.css') }}");
            self::fail('Unsupported asset rendered');
        } catch (RuntimeError $error) {
            self::assertInstanceOf(\InvalidArgumentException::class, $error->getPrevious());
        }
    }

    #[Test]
    public function defaultsToTheShippedClinicalWorkspaceDirectory(): void
    {
        $shipped = dirname(__DIR__, 5) . '/interface/clinical-workspace/encounter-document.css';
        self::assertFileExists($shipped);
        clearstatcache(true, $shipped);
        $twig = new Environment(new ArrayLoader(['t' => "{{ clinicalWorkspaceAssetVersion('encounter-document.css') }}"]));
        $twig->addExtension(new TwigExtension(new OEGlobalsBag([]), new Kernel('/var/www/openemr', '/openemr')));

        self::assertSame((string) filemtime($shipped), $twig->render('t'));
    }

    #[Test]
    public function encounterHeadLinksTheSheetWithItsOwnVersionAndWorkspaceForScreenOnly(): void
    {
        $this->writeAsset('encounter-document.css', 1_700_000_557);
        $loader = new FilesystemLoader(dirname(__DIR__, 5) . '/interface/forms/newpatient/templates');
        $twig = $this->environment($loader, ['v_js_includes' => 82]);
        // The real helper emits the asset bundle through Header and the global asset config.
        $twig->addFunction(new TwigFunction('setupHeader', fn(): string => '<!-- setupHeader -->', ['is_safe' => ['html']]));

        $html = $twig->render('newpatient/partials/common/_head.html.twig', ['pageTitle' => 'Patient Encounter', 'language_direction' => 'ltr']);

        self::assertStringContainsString('<link rel="stylesheet" href="/openemr/interface/clinical-workspace/encounter-document.css?v=1700000557">', $html);
        self::assertStringContainsString('<link rel="stylesheet" href="/openemr/interface/clinical-workspace/workspace.css?v=82" media="screen">', $html);
        self::assertStringContainsString('<script src="/openemr/interface/clinical-workspace/mode.js?v=82" defer></script>', $html);
    }

    private function renderString(string $template): string
    {
        return $this->environment(new ArrayLoader(['t' => $template]))->render('t');
    }

    /**
     * @param array<string, mixed> $globals
     */
    private function environment(LoaderInterface $loader, array $globals = []): Environment
    {
        $twig = new Environment($loader, ['autoescape' => false]);
        $twig->addExtension(new TwigExtension(
            new OEGlobalsBag($globals),
            new Kernel('/var/www/openemr', '/openemr'),
            new ClinicalWorkspaceAssets($this->directory),
        ));

        return $twig;
    }

    private function writeAsset(string $name, int $mtime): void
    {
        $path = $this->directory . '/' . $name;
        file_put_contents($path, '/* ' . $mtime . ' */');
        touch($path, $mtime);
    }
}
