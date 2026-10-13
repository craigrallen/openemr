<?php

/**
 * Runs the REAL interface/patient_file/void_dialog.php without a database or session.
 *
 * The route resolves "../globals.php" against the working directory and options.inc.php against
 * the kernel's src dir. The harness builds a temporary tree, points the kernel at it and runs the
 * route with cwd <tmp>/patient_file, so those two includes land on the TEST DOUBLES written below,
 * while the route itself, OEGlobalsBag, Kernel, ClinicalWorkspaceAssets, the escaping helpers and
 * xlt()/xla()/xlj() (translation disabled) are real code. The helpers are whichever copies of
 * library/htmlspecialchars.inc.php and library/translation.inc.php the active Composer autoloader
 * loaded; the harness does not pin them.
 *
 * Doubled (TEST-ONLY): interface/globals.php (only marks itself loaded), library/options.inc.php
 * (generate_form_field() for the exact Void Reason descriptor only, emitting a SYNTHETIC select)
 * and, through a guarded class_alias, Header. Every double refuses to replace code that is
 * already loaded and rejects unexpected arguments.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\VoidDialog;

use OpenEMR\Core\Header;
use OpenEMR\Core\Kernel;
use OpenEMR\Core\OEGlobalsBag;

final class VoidDialogRouteHarness
{
    /** SYNTHETIC web root holding characters attr() must escape. */
    public const WEB_ROOT = '/oe"void&root<x>';

    public const ESCAPED_WEB_ROOT = '/oe&quot;void&amp;root&lt;x&gt;';

    /** The route's generate_form_field() descriptor, the only one the double accepts. */
    public const REASON_DESCRIPTOR = [
        'data_type' => 1,
        'field_id' => 'reason',
        'list_id' => 'void_reasons',
        'empty_title' => 'Select Reason',
    ];

    /** SYNTHETIC option label holding characters the double must escape; not app data. */
    public const SYNTHETIC_REASON = 'SYNTHETIC <void> "reason" & co';

    public const ESCAPED_REASON_SELECT = '<select name="form_reason" id="form_reason">'
        . '<option value="">Select Reason</option>'
        . '<option value="SYNTHETIC &lt;void&gt; &quot;reason&quot; &amp; co">SYNTHETIC &lt;void&gt; "reason" &amp; co</option>'
        . '</select>';

    public static bool $globalsLoaded = false;

    /** @var list<list<string>|string> */
    public static array $headers = [];

    /** @var list<array{mixed, mixed}> */
    public static array $reasonFields = [];

    private const TREE_PREFIX = 'oe-void-route-';

    private const FILES = ['/globals.php', '/library/options.inc.php'];

    private const DIRS = ['/library', '/patient_file'];

    public static function repositoryRoot(): string
    {
        return dirname(__DIR__, 5);
    }

    public static function voidDialogPhp(): string
    {
        return self::repositoryRoot() . '/interface/patient_file/void_dialog.php';
    }

    /**
     * Temporary 0700 tree holding the include doubles; the route runs with cwd <root>/patient_file.
     */
    public static function createTree(): string
    {
        $tmp = realpath(sys_get_temp_dir());
        if ($tmp === false) {
            throw new \RuntimeException('No temporary directory for the void route test tree');
        }
        $root = $tmp . '/' . self::TREE_PREFIX . bin2hex(random_bytes(8));
        if (!mkdir($root, 0700)) {
            throw new \RuntimeException('Could not create the void route test tree');
        }
        $self = '\\' . self::class;
        $contents = [
            '/globals.php' => <<<PHP
                <?php
                // TEST DOUBLE for interface/globals.php (void route test). No config, DB or session.
                declare(strict_types=1);
                {$self}::\$globalsLoaded = true;
                PHP,
            '/library/options.inc.php' => <<<PHP
                <?php
                // TEST DOUBLE for library/options.inc.php (void route test).
                declare(strict_types=1);
                if (function_exists('generate_form_field')) {
                    throw new \\LogicException('real layout options loaded; refusing to double generate_form_field()');
                }
                if (true) { // Run-time binding, after the guard above.
                    function generate_form_field(mixed \$frow, mixed \$currvalue, mixed ...\$extra): void
                    {
                        {$self}::reasonField(\$frow, \$currvalue, \$extra);
                    }
                }
                PHP,
        ];
        try {
            foreach (self::DIRS as $dir) {
                if (!mkdir($root . $dir, 0700) || !chmod($root . $dir, 0700)) {
                    throw new \RuntimeException('Could not create a void route test directory');
                }
            }
            foreach ($contents as $path => $content) {
                if (file_put_contents($root . $path, $content) === false || !chmod($root . $path, 0600)) {
                    throw new \RuntimeException('Could not write a void route test double');
                }
            }
            if (!chmod($root, 0700)) {
                throw new \RuntimeException('Could not restrict the void route test tree');
            }
        } catch (\Throwable $error) {
            self::removeTree($root);
            throw $error;
        }
        return $root;
    }

    /**
     * Remove only the files and directories createTree() writes, and only inside the temp dir.
     */
    public static function removeTree(string $root): void
    {
        $tmp = realpath(sys_get_temp_dir());
        if (
            $tmp === false
            || dirname($root) !== $tmp
            || preg_match('/^' . self::TREE_PREFIX . '[0-9a-f]{16}$/', basename($root)) !== 1
            || is_link($root)
            || !is_dir($root)
        ) {
            return;
        }
        foreach (self::FILES as $file) {
            if (is_file($root . $file) && !is_link($root . $file)) {
                unlink($root . $file);
            }
        }
        foreach (self::DIRS as $dir) {
            if (is_dir($root . $dir) && !is_link($root . $dir)) {
                rmdir($root . $dir);
            }
        }
        if (!rmdir($root)) {
            throw new \RuntimeException('Void route test tree held unexpected entries; left in place');
        }
    }

    /**
     * Install the Header double, the kernel and the translation switch.
     */
    public static function boot(string $root): void
    {
        if (class_exists(Header::class, false)) {
            throw new \LogicException('Real Header already loaded; refusing to alias a test double over it');
        }
        class_alias(VoidDialogHeaderDouble::class, Header::class);
        $globals = OEGlobalsBag::getInstance();
        $globals->set('kernel', new Kernel($root, self::WEB_ROOT));
        $globals->set('disable_translation', true);
    }

    /**
     * Load the options.inc.php double on its own, to exercise its argument guard.
     */
    public static function loadOptionsDouble(string $root): void
    {
        require_once $root . '/library/options.inc.php';
    }

    /**
     * Include the route from <root>/patient_file and return its output; cwd and buffers are restored.
     */
    public static function render(string $root, string $page): string
    {
        if ($page !== self::voidDialogPhp() || !is_file($page)) {
            throw new \LogicException('Only the target void_dialog.php route may be rendered');
        }
        $cwd = getcwd();
        if ($cwd === false) {
            throw new \RuntimeException('No working directory to restore');
        }
        $level = ob_get_level();
        if (!chdir($root . '/patient_file')) {
            throw new \RuntimeException('Could not enter the void route test tree');
        }
        ob_start();
        try {
            (static function (string $page): void {
                require $page;
            })($page);
            $html = ob_get_clean();
        } catch (\Throwable $error) {
            while (ob_get_level() > $level) {
                ob_end_clean();
            }
            throw $error;
        } finally {
            chdir($cwd);
        }
        if (!is_string($html)) {
            throw new \RuntimeException('No output buffer for the void route');
        }
        return $html;
    }

    /**
     * Body of the generate_form_field() double: the exact reason descriptor and '' only.
     *
     * @param list<mixed> $extra
     */
    public static function reasonField(mixed $frow, mixed $currvalue, array $extra): void
    {
        if ($frow !== self::REASON_DESCRIPTOR || $currvalue !== '' || $extra !== []) {
            throw new \LogicException('Unexpected generate_form_field() arguments');
        }
        self::$reasonFields[] = [$frow, $currvalue];
        echo '<select name="form_reason" id="form_reason">'
            . '<option value="">Select Reason</option>'
            . '<option value="' . attr(self::SYNTHETIC_REASON) . '">' . text(self::SYNTHETIC_REASON) . '</option>'
            . '</select>';
    }
}
