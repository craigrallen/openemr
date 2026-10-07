<?php

/**
 * Runs the REAL interface/patient_file/history/history_full.php without a database or session store.
 *
 * history_full.php resolves "../../globals.php" against the working directory and its other
 * includes against $srcdir / the project dir. The harness builds a temporary tree, points the
 * kernel at it and chdirs into <tmp>/a/b, so those includes land on the TEST DOUBLES written
 * below, while history_full.php itself, history.inc.php, getPatientData(), getHistoryData(),
 * xl() (translation disabled), the escaping helpers, CsrfUtils, OEGlobalsBag, the session
 * wrapper, ClinicalWorkspaceAssets, options.js.php (checkSkipConditions and friends),
 * validation_script.js.php (submitme), options_listadd.inc.php and the datetimepicker settings
 * are the real code, reached through one-line include shims.
 *
 * Doubled (TEST-ONLY): interface/globals.php (sqlQuery only), library/options.inc.php
 * (getSmokeCodes, generate_layout_validation, display_layout_tabs and
 * display_layout_tabs_data_editable, the last two emitting the SYNTHETIC source-grounded
 * fixtures/*.html), library/validation/LBF_Validation.php (no constraints),
 * library/js/xl/select2.js.php (the real file requires the checkout's vendor/autoload.php by
 * relative path), summary/dashboard_header.php, and through guarded class_alias: AclMain,
 * Header and OemrUI. Every double refuses to replace code that is already loaded.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\History\Editor;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Header;
use OpenEMR\Core\Kernel;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\OeUI\OemrUI;
use OpenEMR\Tests\Isolated\PatientFile\History\Editor\Doubles\AclMainDouble;
use OpenEMR\Tests\Isolated\PatientFile\History\Editor\Doubles\HeaderDouble;
use OpenEMR\Tests\Isolated\PatientFile\History\Editor\Doubles\OemrUIDouble;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

final class EditorRouteHarness
{
    private const ALIASES = [
        AclMain::class => AclMainDouble::class,
        Header::class => HeaderDouble::class,
        OemrUI::class => OemrUIDouble::class,
    ];

    private const SCENARIO = '\\' . EditorRouteScenario::class;

    public static function repositoryRoot(): string
    {
        return dirname(__DIR__, 6);
    }

    public static function historyFullPhp(): string
    {
        return self::repositoryRoot() . '/interface/patient_file/history/history_full.php';
    }

    /**
     * Temporary tree holding the include doubles; history_full.php runs with cwd <root>/a/b.
     */
    public static function createTree(): string
    {
        $root = sys_get_temp_dir() . '/oe-history-editor-route-' . bin2hex(random_bytes(6));
        foreach (['/a/b', '/library/validation', '/library/js/xl', '/interface/patient_file/summary'] as $dir) {
            if (!mkdir($root . $dir, 0700, true)) {
                self::removeTree($root);
                throw new \RuntimeException('Could not create the History editor route test tree');
            }
        }
        $s = self::SCENARIO;
        $repo = var_export(self::repositoryRoot(), true);
        $files = [
            '/globals.php' => <<<PHP
                <?php
                // TEST DOUBLE for interface/globals.php (History editor route test). No config, no DB.
                declare(strict_types=1);
                if (function_exists('sqlQuery')) {
                    throw new \\LogicException('library/sql.inc.php is loaded; refusing to double sqlQuery()');
                } else {
                    function sqlQuery(mixed \$statement, mixed \$binds = false): array
                    {
                        return {$s}::sqlQuery((string) \$statement, \$binds);
                    }
                }
                {$s}::\$globalsLoaded = true;
                PHP,
            // history_full.php requires "history.inc.php" through include_path '.', so a copy of the
            // route outside the checkout (the harness baseline) still reaches the real file.
            '/a/b/history.inc.php' => "<?php\n// TEST SHIM: the real history.inc.php.\nrequire_once {$repo} . '/interface/patient_file/history/history.inc.php';\n",
            '/library/options.inc.php' => <<<PHP
                <?php
                // TEST DOUBLE for library/options.inc.php: fixtures copy the editable renderer's element shapes.
                declare(strict_types=1);
                foreach (['getSmokeCodes', 'generate_layout_validation', 'display_layout_tabs', 'display_layout_tabs_data_editable'] as \$name) {
                    if (function_exists(\$name)) {
                        throw new \\LogicException('real layout renderer already loaded; refusing to double it');
                    }
                }
                if (true) { // Run-time binding, after the guard above.
                    /** @return array<string, string> */
                    function getSmokeCodes(): array
                    {
                        return ['1' => 'SYNTHETIC smoke code'];
                    }
                    function generate_layout_validation(mixed \$form_id): void
                    {
                        {$s}::\$layout[] = 'validation:' . \$form_id;
                    }
                    function display_layout_tabs(mixed \$formtype, mixed \$result1, mixed \$result2 = ''): void
                    {
                        {$s}::\$layout[] = 'tabs:' . \$formtype;
                        echo {$s}::fixture('his-tabs-nav.html');
                    }
                    function display_layout_tabs_data_editable(mixed \$formtype, mixed \$result1, mixed \$result2 = ''): void
                    {
                        {$s}::\$layout[] = 'data_editable:' . \$formtype;
                        echo {$s}::fixture('his-tabs-data.html');
                    }
                }
                PHP,
            '/library/options.js.php' => "<?php\n// TEST SHIM: the real options.js.php.\nrequire {$repo} . '/library/options.js.php';\n",
            '/library/validation/LBF_Validation.php' => <<<PHP
                <?php
                // TEST DOUBLE for library/validation/LBF_Validation.php.
                declare(strict_types=1);
                if (class_exists('LBF_Validation', false)) {
                    throw new \\LogicException('real LBF_Validation loaded; refusing to double it');
                }
                if (true) {
                    final class LBF_Validation
                    {
                        public static function generate_validate_constraints(mixed \$form_id): string
                        {
                            {$s}::\$layout[] = 'constraints:' . \$form_id;
                            return '{}';
                        }
                    }
                }
                PHP,
            // Included from the route's scope, so the real file sees \$form_id and \$use_validate_js.
            '/library/validation/validation_script.js.php' => "<?php\n// TEST SHIM: the real validation_script.js.php.\nrequire {$repo} . '/library/validation/validation_script.js.php';\n",
            '/library/js/xl/select2.js.php' => "\"dir\":\"\",\n",
            '/library/js/xl/jquery-datetimepicker-2-5-4.js.php' => "<?php\n// TEST SHIM: the real datetimepicker settings, in the caller's scope.\nrequire {$repo} . '/library/js/xl/jquery-datetimepicker-2-5-4.js.php';\n",
            '/library/options_listadd.inc.php' => "<?php\n// TEST SHIM: the real list-add widget.\nrequire {$repo} . '/library/options_listadd.inc.php';\n",
            '/interface/patient_file/summary/dashboard_header.php' => "<div id=\"test-double-dashboard-header\">SYNTHETIC patient header</div>\n",
        ];
        try {
            foreach ($files as $path => $content) {
                if (file_put_contents($root . $path, $content) === false) {
                    throw new \RuntimeException('Could not write a History editor route test double');
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
        if (!str_starts_with(basename($root), 'oe-history-editor-route-') || !is_dir($root)) {
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
        $session->set('pid', EditorRouteScenario::PID);
        $session->set('csrf_private_key', EditorRouteScenario::CSRF_KEY);
        SessionWrapperFactory::getInstance()->setActiveSession($session);
        set_include_path('.');
        if (!chdir($root . '/a/b')) {
            throw new \RuntimeException('Could not enter the History editor route test tree');
        }
    }

    /**
     * Include a copy of the route (the checkout file by default) and return its output.
     */
    public static function render(?string $page = null): string
    {
        $level = ob_get_level();
        ob_start();
        try {
            (static function (string $page): void {
                require $page;
            })($page ?? self::historyFullPhp());
        } catch (\Throwable $error) {
            // Drop every buffer the route opened, so an include error never leaks partial output.
            while (ob_get_level() > $level) {
                ob_end_clean();
            }
            throw $error;
        }
        $html = ob_get_clean();
        if (!is_string($html)) {
            throw new \RuntimeException('No output buffer for the History editor route');
        }
        return $html;
    }
}
