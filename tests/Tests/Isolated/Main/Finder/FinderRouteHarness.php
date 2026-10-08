<?php

/**
 * Runs the REAL interface/main/finder routes without a database or session store.
 *
 * The routes resolve "../../globals.php" against the working directory and their other
 * includes against the kernel's project dir. The harness builds a temporary tree, points the
 * kernel at it and chdirs into <tmp>/a/b, so those includes land on the TEST DOUBLES written
 * below, while the route itself, xlt() (translation disabled), the escaping helpers,
 * CsrfUtils, OEGlobalsBag, the session wrapper and ClinicalWorkspaceAssets are the real code.
 *
 * Doubled (TEST-ONLY): interface/globals.php (sqlQuery, sqlStatement and sqlFetchArray, which
 * answer only the exact statements recorded in FinderRouteScenario and fail closed otherwise),
 * library/options.inc.php (getListItemTitle only), library/js/xl/select2.js.php (the real file
 * requires the checkout's vendor/autoload.php by relative path), and through guarded
 * class_alias: Header, AclMain and AccessDeniedHelper. Every double refuses to replace code
 * that is already loaded.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Main\Finder;

use OpenEMR\Common\Acl\AccessDeniedHelper;
use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Header;
use OpenEMR\Core\Kernel;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Tests\Isolated\Main\Finder\Doubles\FinderAccessDeniedHelperDouble;
use OpenEMR\Tests\Isolated\Main\Finder\Doubles\FinderAclMainDouble;
use OpenEMR\Tests\Isolated\Main\Finder\Doubles\FinderHeaderDouble;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

final class FinderRouteHarness
{
    /** SYNTHETIC web root holding characters attr() must escape. */
    public const WEB_ROOT = '/oe"finder&root';

    public const ESCAPED_WEB_ROOT = '/oe&quot;finder&amp;root';

    public const SELECT2_MARKER = '/* TEST DOUBLE select2.js.php */';

    /** Output-buffer level the route runs in, set by render(). */
    public static int $routeBufferLevel = 0;

    private const ALIASES = [
        AccessDeniedHelper::class => FinderAccessDeniedHelperDouble::class,
        AclMain::class => FinderAclMainDouble::class,
        Header::class => FinderHeaderDouble::class,
    ];

    private const SCENARIO = '\\' . FinderRouteScenario::class;

    private const TREE_PREFIX = 'oe-finder-route-';

    public static function repositoryRoot(): string
    {
        return dirname(__DIR__, 5);
    }

    public static function multiPatientsFinderPhp(): string
    {
        return self::repositoryRoot() . '/interface/main/finder/multi_patients_finder.php';
    }

    public static function patientSelectPhp(): string
    {
        return self::repositoryRoot() . '/interface/main/finder/patient_select.php';
    }

    /**
     * Temporary tree holding the include doubles; the route runs with cwd <root>/a/b.
     */
    public static function createTree(): string
    {
        $root = sys_get_temp_dir() . '/' . self::TREE_PREFIX . bin2hex(random_bytes(6));
        foreach (['/a/b', '/library/js/xl'] as $dir) {
            if (!mkdir($root . $dir, 0700, true)) {
                self::removeTree($root);
                throw new \RuntimeException('Could not create the finder route test tree');
            }
        }
        $s = self::SCENARIO;
        $files = [
            '/globals.php' => <<<PHP
                <?php
                // TEST DOUBLE for interface/globals.php (finder route test). No config, no DB.
                declare(strict_types=1);
                foreach (['sqlQuery', 'sqlStatement', 'sqlFetchArray'] as \$name) {
                    if (function_exists(\$name)) {
                        throw new \\LogicException('library/sql.inc.php is loaded; refusing to double it');
                    }
                }
                if (true) { // Run-time binding, after the guard above.
                    /** @return array<string, string> */
                    function sqlQuery(mixed \$statement, mixed \$binds = false): array
                    {
                        return {$s}::sqlQuery((string) \$statement, \$binds);
                    }
                    function sqlStatement(mixed \$statement, mixed \$binds = false): object
                    {
                        return {$s}::sqlStatement((string) \$statement, \$binds);
                    }
                    /** @return array<string, string|null>|false */
                    function sqlFetchArray(mixed \$result): array|false
                    {
                        return {$s}::sqlFetchArray(\$result);
                    }
                }
                {$s}::\$globalsLoaded = true;
                PHP,
            '/library/options.inc.php' => <<<PHP
                <?php
                // TEST DOUBLE for library/options.inc.php (finder route test).
                declare(strict_types=1);
                if (function_exists('getListItemTitle')) {
                    throw new \\LogicException('real layout options loaded; refusing to double getListItemTitle()');
                }
                if (true) {
                    function getListItemTitle(mixed \$list, mixed \$option): string
                    {
                        {$s}::\$listTitles[] = \$list . ':' . \$option;
                        return 'SYNTHETIC ' . \$list . ' ' . \$option;
                    }
                }
                PHP,
            '/library/js/xl/select2.js.php' => self::SELECT2_MARKER . "\n",
        ];
        try {
            foreach ($files as $path => $content) {
                if (file_put_contents($root . $path, $content) === false) {
                    throw new \RuntimeException('Could not write a finder route test double');
                }
            }
        } catch (\Throwable $error) {
            self::removeTree($root);
            throw $error;
        }
        return $root;
    }

    public static function removeTree(string $root): void
    {
        if (!str_starts_with(basename($root), self::TREE_PREFIX) || !is_dir($root)) {
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

    /**
     * Install the class doubles, kernel, translation switch and session, then chdir into the tree.
     */
    public static function boot(string $root): void
    {
        foreach (self::ALIASES as $real => $double) {
            if (class_exists($real, false)) {
                throw new \LogicException('Real class already loaded; refusing to alias a test double over it');
            }
            class_alias($double, $real);
        }
        $globals = OEGlobalsBag::getInstance();
        $globals->set('kernel', new Kernel($root, self::WEB_ROOT));
        $globals->set('disable_translation', true);
        $session = new Session(new MockArraySessionStorage());
        $session->set('csrf_private_key', FinderRouteScenario::CSRF_KEY);
        SessionWrapperFactory::getInstance()->setActiveSession($session);
        self::request([]);
        if (!chdir($root . '/a/b')) {
            throw new \RuntimeException('Could not enter the finder route test tree');
        }
    }

    /**
     * Present SYNTHETIC form input the way a POST to the route arrives.
     *
     * @param array<string, string> $input
     */
    public static function request(array $input): void
    {
        $_GET = [];
        $_POST = $input;
        $_REQUEST = $input;
    }

    /**
     * Include the route and return its output.
     */
    public static function render(string $page): string
    {
        $level = ob_get_level();
        ob_start();
        self::$routeBufferLevel = ob_get_level();
        try {
            (static function (string $page): void {
                require $page;
            })($page);
        } catch (\Throwable $error) {
            // Drop every buffer the route opened, so an include error never leaks partial output.
            while (ob_get_level() > $level) {
                ob_end_clean();
            }
            throw $error;
        }
        $html = ob_get_clean();
        if (!is_string($html)) {
            throw new \RuntimeException('No output buffer for the finder route');
        }
        return $html;
    }
}
