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
 * Doubled (TEST-ONLY): interface/globals.php (sqlQuery, sqlStatement and
 * sqlFetchArray) and interface/orders/qoe.inc.php (generate_qoe_html). Their
 * procedural adapters are generated per run into a temp tree, guarded against
 * the real functions, and delegate to typed methods here; the tree is removed
 * when the run ends.
 *
 * Usage: php find-order-popup-harness.php '<scenario json>' [route file]
 *   {"get": {...}, "post": {...}, "rows": [...], "ptrow": {...}, "group": [...]}
 *   The optional route file (default: the shipped route) lets a test render a
 *   reconstructed baseline copy through the same stubs; it must be a file named
 *   find_order_popup.php inside the system temp directory.
 * CLI only: any other SAPI receives a 404 before anything else runs.
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
    /**
     * @phpstan-type Row array<string, int|string|null>
     */
    final class FindOrderPopupResult
    {
        private int $position = 0;

        /**
         * @param list<Row> $rows
         */
        public function __construct(private readonly array $rows)
        {
        }

        /**
         * @return Row|false
         */
        public function fetch(): array|false
        {
            return $this->rows[$this->position++] ?? false;
        }
    }

    /**
     * Synthetic request and rows, parsed once from the scenario JSON.
     *
     * @phpstan-import-type Row from FindOrderPopupResult
     */
    final readonly class FindOrderPopupScenario
    {
        private const KEYS = ['get', 'post', 'rows', 'group', 'ptrow'];

        /**
         * @param array<string, string> $get
         * @param array<string, string> $post
         * @param list<Row> $rows
         * @param list<Row> $group
         * @param Row $ptrow
         */
        private function __construct(
            public array $get,
            public array $post,
            public array $rows,
            public array $group,
            public array $ptrow,
        ) {
        }

        /**
         * @throws \InvalidArgumentException when the scenario is not the documented shape
         */
        public static function parse(mixed $decoded): self
        {
            if (!is_array($decoded) || ($decoded !== [] && array_is_list($decoded))) {
                throw new \InvalidArgumentException('Invalid scenario');
            }
            foreach (array_keys($decoded) as $key) {
                if (!in_array($key, self::KEYS, true)) {
                    throw new \InvalidArgumentException('Invalid scenario');
                }
            }

            return new self(
                self::strings($decoded['get'] ?? []),
                self::strings($decoded['post'] ?? []),
                self::rows($decoded['rows'] ?? []),
                self::rows($decoded['group'] ?? []),
                self::row($decoded['ptrow'] ?? []),
            );
        }

        /**
         * @return array<string, string>
         */
        private static function strings(mixed $value): array
        {
            if (!is_array($value)) {
                throw new \InvalidArgumentException('Invalid scenario');
            }
            $out = [];
            foreach ($value as $key => $item) {
                if (!is_string($key) || !is_string($item)) {
                    throw new \InvalidArgumentException('Invalid scenario');
                }
                $out[$key] = $item;
            }
            return $out;
        }

        /**
         * @return list<Row>
         */
        private static function rows(mixed $value): array
        {
            if (!is_array($value) || !array_is_list($value)) {
                throw new \InvalidArgumentException('Invalid scenario');
            }
            return array_map(self::row(...), $value);
        }

        /**
         * @return Row
         */
        private static function row(mixed $value): array
        {
            if (!is_array($value)) {
                throw new \InvalidArgumentException('Invalid scenario');
            }
            $out = [];
            foreach ($value as $key => $item) {
                if (!is_string($key) || !(is_int($item) || is_string($item) || $item === null)) {
                    throw new \InvalidArgumentException('Invalid scenario');
                }
                $out[$key] = $item;
            }
            return $out;
        }
    }

    /**
     * @phpstan-import-type Row from FindOrderPopupResult
     */
    final class FindOrderPopupHarness
    {
        public const TREE_PREFIX = 'oe-find-order-popup-';

        /** @var list<array{string, mixed}> */
        public static array $log = [];

        private static ?FindOrderPopupScenario $scenario = null;

        public static function configure(FindOrderPopupScenario $scenario): void
        {
            self::$scenario = $scenario;
        }

        public static function record(string $kind, mixed $value): void
        {
            self::$log[] = [$kind, $value];
        }

        /**
         * @return Row
         */
        public static function sqlQuery(string $statement, mixed $binds): array
        {
            self::record('sqlQuery', [$statement, $binds]);
            return self::scenario()->ptrow;
        }

        public static function sqlStatement(string $statement, mixed $binds): FindOrderPopupResult
        {
            self::record('sqlStatement', [$statement, $binds]);
            $scenario = self::scenario();
            return new FindOrderPopupResult(str_contains($statement, 'parent = ?') ? $scenario->group : $scenario->rows);
        }

        /**
         * @return Row|false
         */
        public static function sqlFetchArray(mixed $result): array|false
        {
            if (!$result instanceof FindOrderPopupResult) {
                throw new \LogicException('sqlFetchArray() received a result this harness did not create');
            }
            return $result->fetch();
        }

        public static function generateQoeHtml(mixed $ptid, mixed $formid, mixed $prid, mixed $formseq): string
        {
            if (!is_int($ptid) || !is_int($formid) || !is_int($prid) || !is_int($formseq)) {
                throw new \LogicException('generate_qoe_html() expects integer arguments');
            }
            self::record('qoe', [$ptid, $formid, $prid, $formseq]);
            return sprintf('QOE-%d-%d-%d-%d', $ptid, $formid, $prid, $formseq);
        }

        /**
         * Temp tree holding the include doubles; the route runs with cwd <root>/cwd.
         */
        public static function createTree(): string
        {
            $root = sys_get_temp_dir() . '/' . self::TREE_PREFIX . bin2hex(random_bytes(6));
            if (!mkdir($root . '/cwd', 0700, true)) {
                throw new \RuntimeException('Could not create the find-order-popup test tree');
            }
            $s = '\\' . self::class;
            $files = [
                '/globals.php' => <<<PHP
                    <?php
                    // TEST DOUBLE for interface/globals.php (find-order-popup harness). No config, no DB.
                    declare(strict_types=1);
                    foreach (['sqlQuery', 'sqlStatement', 'sqlFetchArray'] as \$name) {
                        if (function_exists(\$name)) {
                            fwrite(STDERR, "\$name already exists; refusing to double it\\n");
                            exit(1);
                        }
                    }
                    if (true) { // Run-time binding, after the guard above.
                        function sqlQuery(mixed \$statement, mixed \$binds = []): array
                        {
                            return {$s}::sqlQuery((string) \$statement, \$binds);
                        }
                        function sqlStatement(mixed \$statement, mixed \$binds = []): object
                        {
                            return {$s}::sqlStatement((string) \$statement, \$binds);
                        }
                        function sqlFetchArray(mixed \$result): array|false
                        {
                            return {$s}::sqlFetchArray(\$result);
                        }
                    }
                    PHP,
                '/cwd/qoe.inc.php' => <<<PHP
                    <?php
                    // TEST DOUBLE for interface/orders/qoe.inc.php (find-order-popup harness).
                    declare(strict_types=1);
                    if (function_exists('generate_qoe_html')) {
                        fwrite(STDERR, "generate_qoe_html already exists; refusing to double it\\n");
                        exit(1);
                    }
                    if (true) {
                        function generate_qoe_html(mixed \$ptid, mixed \$formid, mixed \$prid, mixed \$formseq): string
                        {
                            return {$s}::generateQoeHtml(\$ptid, \$formid, \$prid, \$formseq);
                        }
                    }
                    PHP,
            ];
            foreach ($files as $path => $content) {
                if (file_put_contents($root . $path, $content) === false) {
                    self::removeTree($root);
                    throw new \RuntimeException('Could not write a find-order-popup test double');
                }
            }
            return $root;
        }

        public static function removeTree(string $root): void
        {
            foreach (['/cwd/qoe.inc.php', '/globals.php'] as $file) {
                if (is_file($root . $file)) {
                    unlink($root . $file);
                }
            }
            foreach (['/cwd', ''] as $dir) {
                if (is_dir($root . $dir)) {
                    rmdir($root . $dir);
                }
            }
        }

        private static function scenario(): FindOrderPopupScenario
        {
            return self::$scenario ?? throw new \LogicException('Harness not configured');
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
    use OpenEMR\Tests\Js\Fixtures\FindOrderPopupScenario;

    // CLI only: a web request (any SAPI, whatever register_argc_argv says) gets a bare 404
    // before any alias, argument, include or SQL double is installed.
    if (PHP_SAPI !== 'cli') {
        http_response_code(404);
        exit(1);
    }

    $harnessScript = $_SERVER['SCRIPT_FILENAME'] ?? '';
    if (is_string($harnessScript) && realpath($harnessScript) === __FILE__) {
        try {
            $scenario = FindOrderPopupScenario::parse(json_decode($argv[1] ?? '{}', true, 512, JSON_THROW_ON_ERROR));
        } catch (\JsonException | \InvalidArgumentException) {
            $scenario = null;
        }
        if ($scenario === null) {
            fwrite(STDERR, "Invalid scenario\n");
            exit(1);
        }
        FindOrderPopupHarness::configure($scenario);

        // A route override must be a find_order_popup.php copy inside the system temp directory.
        $repo = dirname(__DIR__, 3);
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

        class_alias(\OpenEMR\Tests\Js\Fixtures\FindOrderPopupGlobalsStub::class, \OpenEMR\Core\OEGlobalsBag::class);
        class_alias(\OpenEMR\Tests\Js\Fixtures\FindOrderPopupHeaderStub::class, \OpenEMR\Core\Header::class);
        spl_autoload_register(static function (string $class) use ($repo): void {
            $prefix = 'OpenEMR\\Common\\Assets\\';
            if (str_starts_with($class, $prefix)) {
                require $repo . '/src/Common/Assets/' . substr($class, strlen($prefix)) . '.php';
            }
        });
        require $repo . '/library/htmlspecialchars.inc.php';
        require $repo . '/library/translation.inc.php';

        $_GET = $scenario->get;
        $_POST = $scenario->post;
        // Default request_order "GP": POST overrides GET.
        $_REQUEST = array_merge($_GET, $_POST);

        $tree = FindOrderPopupHarness::createTree();
        register_shutdown_function(static function () use ($tree): void {
            chdir(sys_get_temp_dir());
            FindOrderPopupHarness::removeTree($tree);
            fwrite(STDERR, json_encode(FindOrderPopupHarness::$log, JSON_THROW_ON_ERROR));
        });
        // The route's "../globals.php" resolves against this cwd; "qoe.inc.php" is found in it.
        chdir($tree . '/cwd');
        set_include_path($tree . '/cwd');
        require $route;
    }
}
