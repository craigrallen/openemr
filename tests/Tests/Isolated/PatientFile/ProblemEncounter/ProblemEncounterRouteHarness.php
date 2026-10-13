<?php

/**
 * Runs the REAL interface/patient_file/problem_encounter.php without a database.
 *
 * The route resolves "../globals.php" against the working directory and restoreSession.php
 * against $srcdir. The harness builds a temporary tree, points the kernel at it and chdirs into
 * <tmp>/a, so those includes land on the TEST DOUBLES written below, while the route itself,
 * getPatientData(), xl()/xlt()/xlj() (translation disabled), the escaping helpers, CsrfUtils,
 * OEGlobalsBag, the session wrapper and ClinicalWorkspaceAssets are the real code.
 *
 * Doubled (TEST-ONLY): interface/globals.php, sqlQuery()/sqlStatement()/sqlFetchArray(),
 * library/restoreSession.php, and through guarded class_alias: AclMain, AccessDeniedHelper,
 * Header, IssueTypeRegistry and PatientIssuesService. Every double refuses to replace code that
 * is already loaded, so a real implementation can never be shadowed silently.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\ProblemEncounter;

use OpenEMR\Common\Acl\AccessDeniedHelper;
use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Lists\IssueTypeRegistry;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Header;
use OpenEMR\Core\Kernel;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Services\PatientIssuesService;
use OpenEMR\Tests\Isolated\PatientFile\ProblemEncounter\Doubles\AccessDeniedHelperDouble;
use OpenEMR\Tests\Isolated\PatientFile\ProblemEncounter\Doubles\AclMainDouble;
use OpenEMR\Tests\Isolated\PatientFile\ProblemEncounter\Doubles\HeaderDouble;
use OpenEMR\Tests\Isolated\PatientFile\ProblemEncounter\Doubles\IssueTypeRegistryDouble;
use OpenEMR\Tests\Isolated\PatientFile\ProblemEncounter\Doubles\PatientIssuesServiceDouble;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

final class ProblemEncounterRouteHarness
{
    private const ALIASES = [
        AclMain::class => AclMainDouble::class,
        AccessDeniedHelper::class => AccessDeniedHelperDouble::class,
        Header::class => HeaderDouble::class,
        IssueTypeRegistry::class => IssueTypeRegistryDouble::class,
        PatientIssuesService::class => PatientIssuesServiceDouble::class,
    ];

    private const SCENARIO = '\\' . ProblemEncounterScenario::class;

    public static function repositoryRoot(): string
    {
        return dirname(__DIR__, 5);
    }

    public static function routePhp(): string
    {
        return self::repositoryRoot() . '/interface/patient_file/problem_encounter.php';
    }

    public static function createTree(): string
    {
        $root = sys_get_temp_dir() . '/oe-problem-encounter-route-' . bin2hex(random_bytes(6));
        foreach (['/a', '/library'] as $dir) {
            if (!mkdir($root . $dir, 0700, true)) {
                throw new \RuntimeException('Could not create the Issues and Encounters route test tree');
            }
        }
        $s = self::SCENARIO;
        $files = [
            '/globals.php' => <<<PHP
                <?php
                // TEST DOUBLE for interface/globals.php (Issues and Encounters route render test). No config, no DB.
                declare(strict_types=1);
                foreach (['sqlQuery', 'sqlStatement', 'sqlFetchArray'] as \$name) {
                    if (function_exists(\$name)) {
                        throw new \\LogicException('library/sql.inc.php is loaded; refusing to double it');
                    }
                }
                if (true) { // Run-time binding, after the guard above.
                    function sqlQuery(mixed \$statement, mixed \$binds = false): array|false
                    {
                        return {$s}::sqlQuery((string) \$statement, \$binds);
                    }
                    function sqlStatement(mixed \$statement, mixed \$binds = false): string
                    {
                        return {$s}::sqlStatement((string) \$statement, \$binds);
                    }
                    function sqlFetchArray(mixed \$result): array|false
                    {
                        return {$s}::sqlFetchArray(\$result);
                    }
                }
                {$s}::\$globalsLoaded = true;
                PHP,
            '/library/restoreSession.php' => "/* TEST DOUBLE library/restoreSession.php */\n",
        ];
        foreach ($files as $path => $content) {
            if (file_put_contents($root . $path, $content) === false) {
                throw new \RuntimeException('Could not write an Issues and Encounters route test double');
            }
        }
        return $root;
    }

    public static function removeTree(string $root): void
    {
        if (!str_starts_with(basename($root), 'oe-problem-encounter-route-') || !is_dir($root)) {
            return;
        }
        $items = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($items as $item) {
            if (!$item instanceof \SplFileInfo) {
                continue;
            }
            $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }
        rmdir($root);
    }

    public static function boot(string $root): void
    {
        foreach (self::ALIASES as $real => $double) {
            if (class_exists($real, false)) {
                throw new \LogicException('Real class already loaded; refusing to alias a test double over it');
            }
            class_alias($double, $real);
        }
        $globals = OEGlobalsBag::getInstance();
        $globals->set('kernel', new Kernel($root, '/openemr'));
        $globals->set('disable_translation', true);
        $session = new Session(new MockArraySessionStorage());
        $session->set('pid', ProblemEncounterScenario::PID);
        $session->set('csrf_private_key', 'SYNTHETIC-test-key');
        SessionWrapperFactory::getInstance()->setActiveSession($session);
        set_include_path('.');
        if (!chdir($root . '/a')) {
            throw new \RuntimeException('Could not enter the Issues and Encounters route test tree');
        }
    }

    /**
     * Include the real route in this process; $pid is the variable globals.php would set.
     *
     * @return array{string, ?\Throwable}
     */
    public static function render(): array
    {
        $pid = ProblemEncounterScenario::PID;
        $stopped = null;
        ob_start();
        try {
            require self::routePhp();
        } catch (\DomainException $e) {
            $stopped = $e;
        } finally {
            $html = ob_get_clean();
        }
        if (!is_string($html)) {
            throw new \RuntimeException('No output buffer for the Issues and Encounters route');
        }
        return [$html, $stopped];
    }
}
