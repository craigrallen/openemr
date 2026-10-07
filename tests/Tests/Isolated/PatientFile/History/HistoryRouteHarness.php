<?php

/**
 * Runs the REAL interface/patient_file/history/history.php without a database or session store.
 *
 * history.php resolves "../../globals.php" against the working directory and its other
 * includes against $srcdir / the project dir. The harness builds a temporary tree, points the
 * kernel at it and chdirs into <tmp>/a/b, so those includes land on the TEST DOUBLES written
 * below, while history.php itself, history.inc.php, getPatientData(), getHistoryData(),
 * newHistoryData(), xl() (translation disabled), the escaping helpers, OEGlobalsBag, the
 * session wrapper and ClinicalWorkspaceAssets are the real code.
 *
 * Doubled (TEST-ONLY): interface/globals.php, sqlQuery() from library/sql.inc.php,
 * library/options.inc.php (getLayoutProperties/display_layout_tabs/display_layout_tabs_data,
 * emitting the same element shapes as the real renderer), library/options.js.php,
 * erx_patient_portal_js.php, summary/dashboard_header.php, and through guarded class_alias:
 * AclMain, Header, OemrUI, PatientMenuRole and SocialHistoryService. Every double refuses to
 * replace code that is already loaded, so a real implementation can never be shadowed silently.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\History;

use Composer\Autoload\ClassLoader;
use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Header;
use OpenEMR\Core\Kernel;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Menu\PatientMenuRole;
use OpenEMR\OeUI\OemrUI;
use OpenEMR\Services\SocialHistoryService;
use OpenEMR\Tests\Isolated\PatientFile\History\Doubles\AclMainDouble;
use OpenEMR\Tests\Isolated\PatientFile\History\Doubles\HeaderDouble;
use OpenEMR\Tests\Isolated\PatientFile\History\Doubles\OemrUIDouble;
use OpenEMR\Tests\Isolated\PatientFile\History\Doubles\PatientMenuRoleDouble;
use OpenEMR\Tests\Isolated\PatientFile\History\Doubles\SocialHistoryServiceDouble;
use PHPUnit\TextUI\Configuration\Registry;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;
use Symfony\Component\Process\Process;

final class HistoryRouteHarness
{
    public const DELIMITER = "\n--HISTORY-ROUTE-SCENARIO--\n";

    private const ALIASES = [
        AclMain::class => AclMainDouble::class,
        Header::class => HeaderDouble::class,
        OemrUI::class => OemrUIDouble::class,
        PatientMenuRole::class => PatientMenuRoleDouble::class,
        SocialHistoryService::class => SocialHistoryServiceDouble::class,
    ];

    private const SCENARIO = '\\' . HistoryRouteScenario::class;

    public static function repositoryRoot(): string
    {
        return dirname(__DIR__, 5);
    }

    public static function historyPhp(): string
    {
        return self::repositoryRoot() . '/interface/patient_file/history/history.php';
    }

    /**
     * Temporary tree holding the include doubles; history.php runs with cwd <root>/a/b.
     */
    public static function createTree(): string
    {
        $root = sys_get_temp_dir() . '/oe-history-route-' . bin2hex(random_bytes(6));
        foreach (['/a/b', '/library', '/interface/patient_file/summary'] as $dir) {
            if (!mkdir($root . $dir, 0700, true)) {
                throw new \RuntimeException('Could not create the History route test tree');
            }
        }
        $s = self::SCENARIO;
        $files = [
            '/globals.php' => <<<PHP
                <?php
                // TEST DOUBLE for interface/globals.php (History route render test). No config, no DB.
                declare(strict_types=1);
                // Declared conditionally so it binds at run time, after the guard (top-level
                // declarations would be bound at compile time, before any check could run).
                if (function_exists('sqlQuery')) {
                    throw new \\LogicException('library/sql.inc.php is loaded; refusing to double sqlQuery()');
                } else {
                    function sqlQuery(mixed \$statement, mixed \$binds = false): array|false
                    {
                        return {$s}::sqlQuery((string) \$statement, \$binds);
                    }
                }
                {$s}::\$globalsLoaded = true;
                PHP,
            '/library/options.inc.php' => <<<PHP
                <?php
                // TEST DOUBLE for library/options.inc.php: same element shapes as the real renderer.
                declare(strict_types=1);
                foreach (['getLayoutProperties', 'display_layout_tabs', 'display_layout_tabs_data'] as \$name) {
                    if (function_exists(\$name)) {
                        throw new \\LogicException('real layout renderer already loaded; refusing to double it');
                    }
                }
                if (true) { // Run-time binding, after the guard above.
                    function getLayoutProperties(mixed \$formtype, mixed &\$grparr, mixed \$sel = 'grp_title', mixed \$limit = null): void
                    {
                        {$s}::\$layout[] = 'properties:' . \$formtype . ':' . \$sel;
                        \$grparr = ['' => ['grp_size' => {$s}::\$grpSize]];
                    }
                    function display_layout_tabs(mixed \$formtype, mixed \$result1, mixed \$result2 = ''): void
                    {
                        {$s}::\$layout[] = 'tabs:' . \$formtype;
                        echo "<li class=\"current\">\\n<a href=\"#\" id=\"header_tab_General\">\\nGeneral</a>\\n</li>\\n";
                        echo "<li >\\n<a href=\"#\" id=\"header_tab_Lifestyle\">\\nLifestyle</a>\\n</li>\\n";
                    }
                    function display_layout_tabs_data(mixed \$formtype, mixed \$result1, mixed \$result2 = ''): void
                    {
                        {$s}::\$layout[] = 'data:' . \$formtype;
                        \$tobacco = is_array(\$result1) ? (string) (\$result1['tobacco'] ?? '') : '';
                        echo "<div class='tab current'>\\n<table border='0' cellpadding='0'>\\n";
                        echo "<tr><td class='label_custom' colspan='1' id='label_tobacco'><span id='label_tobacco'>Tobacco:</span>";
                        echo "</td><td class='text data' colspan='3' id='text_tobacco'  data-value='" . attr(\$tobacco) . "'>" . text(\$tobacco) . "</td></tr>\\n";
                        echo "</table>\\n</div>\\n<div class='tab'>\\n<table border='0' cellpadding='0'>\\n</table>\\n</div>\\n";
                    }
                }
                PHP,
            '/library/options.js.php' => "<!-- TEST DOUBLE library/options.js.php -->\n",
            '/interface/patient_file/erx_patient_portal_js.php' => "/* TEST DOUBLE erx_patient_portal_js.php */\n",
            '/interface/patient_file/summary/dashboard_header.php' => "<div id=\"test-double-dashboard-header\"></div>\n",
        ];
        foreach ($files as $path => $content) {
            if (file_put_contents($root . $path, $content) === false) {
                throw new \RuntimeException('Could not write a History route test double');
            }
        }
        return $root;
    }

    public static function removeTree(string $root): void
    {
        if (!str_starts_with(basename($root), 'oe-history-route-') || !is_dir($root)) {
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
        $globals->set('kernel', new Kernel($root, '/openemr'));
        $globals->set('disable_translation', true);
        $session = new Session(new MockArraySessionStorage());
        $session->set('pid', HistoryRouteScenario::PID);
        SessionWrapperFactory::getInstance()->setActiveSession($session);
        set_include_path('.');
        if (!chdir($root . '/a/b')) {
            throw new \RuntimeException('Could not enter the History route test tree');
        }
    }

    /**
     * Include the real route in this process and return its output and top-level variables.
     *
     * @return array{string, array<string, mixed>}
     */
    public static function renderInProcess(): array
    {
        ob_start();
        try {
            require self::historyPhp();
            $vars = get_defined_vars();
        } finally {
            $html = ob_get_clean();
        }
        if (!is_string($html)) {
            throw new \RuntimeException('No output buffer for the History route');
        }
        return [$html, $vars];
    }

    /**
     * Run the real route in a child PHP process, for branches that end with exit().
     *
     * @param array<string, mixed> $scenario
     * @return array{int, string, array<array-key, mixed>}
     */
    public static function renderInSubprocess(string $root, array $scenario): array
    {
        $runner = $root . '/runner.php';
        $code = "<?php\ndeclare(strict_types=1);\n// TEST runner for the History route render test.\n"
            . "require \$argv[1];\n"
            . self::SCENARIO . "::import(json_decode(\$argv[3], true, 512, JSON_THROW_ON_ERROR));\n"
            . '\\' . self::class . "::boot(\$argv[2]);\n"
            . "register_shutdown_function(static function (): void {\n"
            . "    echo " . var_export(self::DELIMITER, true) . " . json_encode(" . self::SCENARIO . "::export(), JSON_THROW_ON_ERROR);\n"
            . "});\n"
            . "require " . var_export(self::historyPhp(), true) . ";\n";
        if (file_put_contents($runner, $code) === false) {
            throw new \RuntimeException('Could not write the History route runner');
        }
        // Array arguments: no shell, every argument passed verbatim (scenario as one JSON argument).
        $process = new Process(
            [PHP_BINARY, '-d', 'display_errors=stderr', $runner, self::autoloadEntry(), $root,
                json_encode($scenario, JSON_THROW_ON_ERROR)],
            null,
            null,
            null,
            60.0
        );
        $process->run();
        $exit = $process->getExitCode();
        $stdout = $process->getOutput();
        $stderr = $process->getErrorOutput();
        if ($exit === null || $stderr !== '') {
            throw new \RuntimeException('History route subprocess failed: ' . $stderr);
        }
        $parts = explode(self::DELIMITER, $stdout);
        if (count($parts) !== 2) {
            throw new \RuntimeException('History route subprocess did not report its scenario');
        }
        $recorded = json_decode($parts[1], true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($recorded)) {
            throw new \RuntimeException('History route subprocess scenario is not an array');
        }
        return [$exit, $parts[0], $recorded];
    }

    /**
     * The same class loading the parent PHPUnit process used: its configured bootstrap if
     * any, otherwise the Composer autoloader that loaded PHPUnit.
     */
    private static function autoloadEntry(): string
    {
        $configuration = Registry::get();
        if ($configuration->hasBootstrap()) {
            return $configuration->bootstrap();
        }
        $loader = (new \ReflectionClass(ClassLoader::class))->getFileName();
        if ($loader === false) {
            throw new \RuntimeException('Composer ClassLoader has no file');
        }
        return dirname($loader, 2) . '/autoload.php';
    }
}
