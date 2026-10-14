<?php

/**
 * Runs the real interface/orders/find_order_popup.php without a database,
 * session or Header so Jest can execute its rendered output.
 *
 * The real escaping and translation helpers are loaded; the globals stub
 * reports disable_translation=true so xl() only runs xlCleanup(). The SQL
 * helpers return SYNTHETIC rows from the scenario and record every query
 * with its binds. Header::setupHeader() only echoes a marker comment.
 *
 * Usage: php find-order-popup-harness.php '<scenario json>' [route file]
 *   The optional route file (default: the shipped route) lets a test render a
 *   reconstructed baseline copy through the same stubs; it must be a file named
 *   find_order_popup.php inside the system temp directory.
 * CLI only: any other SAPI receives a 404 before anything else runs.
 *   {"get": {...}, "post": {...}, "rows": [...], "ptrow": {...}, "group": [...]}
 * stdout: route output; stderr: JSON log of SQL and QOE calls.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Js\Fixtures {
    final class FindOrderPopupHarness
    {
        /** @var list<array{string, mixed}> */
        public static array $log = [];

        /** @var array<string, mixed> */
        public static array $scenario = [];

        public static function record(string $kind, mixed $value): void
        {
            self::$log[] = [$kind, $value];
        }
    }

    final class FindOrderPopupGlobalsStub
    {
        public static function getInstance(): self
        {
            return new self();
        }

        public function getWebRoot(): string
        {
            return '/webroot';
        }

        public function getString(string $key): string
        {
            return $key === 'v_js_includes' ? '77' : '';
        }

        public function getBoolean(string $key): bool
        {
            return $key === 'disable_translation';
        }

        public function get(string $key): mixed
        {
            return null;
        }
    }

    final class FindOrderPopupHeaderStub
    {
        /** @param list<string> $assets */
        public static function setupHeader(array $assets = []): void
        {
            echo '<!-- Header::setupHeader ' . json_encode($assets) . " -->\n";
        }
    }
}

namespace {
    use OpenEMR\Tests\Js\Fixtures\FindOrderPopupHarness;

    // CLI only: a web request (any SAPI, whatever register_argc_argv says) gets a bare 404
    // before any alias, argument, include or SQL double is installed.
    if (PHP_SAPI !== 'cli') {
        http_response_code(404);
        exit(1);
    }

    $harnessScript = $_SERVER['SCRIPT_FILENAME'] ?? '';
    if (is_string($harnessScript) && realpath($harnessScript) === __FILE__) {
        $scenario = json_decode($argv[1] ?? '{}', true, 512, JSON_THROW_ON_ERROR);
        FindOrderPopupHarness::$scenario = is_array($scenario) ? $scenario : [];

        class_alias(\OpenEMR\Tests\Js\Fixtures\FindOrderPopupGlobalsStub::class, \OpenEMR\Core\OEGlobalsBag::class);
        class_alias(\OpenEMR\Tests\Js\Fixtures\FindOrderPopupHeaderStub::class, \OpenEMR\Core\Header::class);
        $repo = dirname(__DIR__, 3);
        spl_autoload_register(static function (string $class) use ($repo): void {
            $prefix = 'OpenEMR\\Common\\Assets\\';
            if (str_starts_with($class, $prefix)) {
                require $repo . '/src/Common/Assets/' . substr($class, strlen($prefix)) . '.php';
            }
        });
        require $repo . '/library/htmlspecialchars.inc.php';
        require $repo . '/library/translation.inc.php';

        function sqlQuery(string $sql, array $binds = []): array
        {
            FindOrderPopupHarness::record('sqlQuery', [$sql, $binds]);
            return FindOrderPopupHarness::$scenario['ptrow'] ?? [];
        }

        function sqlStatement(string $sql, array $binds = []): \ArrayIterator
        {
            FindOrderPopupHarness::record('sqlStatement', [$sql, $binds]);
            $key = str_contains($sql, 'parent = ?') ? 'group' : 'rows';
            return new \ArrayIterator(FindOrderPopupHarness::$scenario[$key] ?? []);
        }

        function sqlFetchArray(\ArrayIterator $res): array|false
        {
            if (!$res->valid()) {
                return false;
            }
            $row = $res->current();
            $res->next();
            return $row;
        }

        $_GET = FindOrderPopupHarness::$scenario['get'] ?? [];
        $_POST = FindOrderPopupHarness::$scenario['post'] ?? [];
        // Default request_order "GP": POST overrides GET.
        $_REQUEST = array_merge($_GET, $_POST);

        register_shutdown_function(static function (): void {
            fwrite(STDERR, json_encode(FindOrderPopupHarness::$log, JSON_THROW_ON_ERROR));
        });
        // The route's "../globals.php" resolves against this cwd; "qoe.inc.php" is found in it.
        chdir(__DIR__ . '/find-order-popup/cwd');
        set_include_path(__DIR__ . '/find-order-popup/cwd');
        // A route override must be a find_order_popup.php copy inside the system temp directory.
        $route = $repo . '/interface/orders/find_order_popup.php';
        if (isset($argv[2])) {
            $override = realpath($argv[2]);
            $temp = realpath(sys_get_temp_dir());
            if ($override === false || $temp === false || basename($override) !== 'find_order_popup.php' || !str_starts_with($override, $temp . DIRECTORY_SEPARATOR)) {
                fwrite(STDERR, "Unsupported route override\n");
                exit(1);
            }
            $route = $override;
        }
        require $route;
    }
}
