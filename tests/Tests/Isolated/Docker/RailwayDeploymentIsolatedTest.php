<?php

/**
 * Isolated test: the Railway test-server deployment builds this checkout,
 * refuses insecure credentials, keeps installer scripts off the web and
 * disables outbound messaging/payments by default.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Docker;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Process\Process;

class RailwayDeploymentIsolatedTest extends TestCase
{
    private const REPO_ROOT = __DIR__ . '/../../../..';
    private const RAILWAY_DIR = self::REPO_ROOT . '/docker/railway';
    private const START_SCRIPT = self::RAILWAY_DIR . '/railway-start.sh';
    private const READYZ_PATH = '/meta/railway/readyz';

    private const STRONG_ROOT = 'Rt7uQ2vX9pL4mN8sK3wE6yA1';
    private const STRONG_DB = 'Db5hJ8kL2nP6qR9tV3xZ7cF4';
    private const STRONG_ADMIN = 'Ad3mF6gH9jK2lM5nP8qR1sT4';

    private string $workDir;

    protected function setUp(): void
    {
        $this->workDir = sys_get_temp_dir() . '/oe-railway-' . bin2hex(random_bytes(6));
        mkdir($this->workDir . '/template/sites/default/documents', 0700, true);
        file_put_contents($this->workDir . '/template/sites/default/sqlconf.php', "<?php\n\$config = 0;\n");
        mkdir($this->workDir . '/oe/sites', 0700, true);
        mkdir($this->workDir . '/apache', 0700, true);
        mkdir($this->workDir . '/php', 0700, true);
        file_put_contents(
            $this->workDir . '/mountinfo',
            "22 1 0:21 / / rw - overlay overlay rw\n"
            . '98 22 254:1 / ' . $this->workDir . "/oe/sites rw,relatime - ext4 /dev/vdb rw\n"
        );
        file_put_contents($this->workDir . '/mountinfo-none', "22 1 0:21 / / rw - overlay overlay rw\n");
    }

    protected function tearDown(): void
    {
        self::runCommand(['rm', '-rf', $this->workDir]);
    }

    public function testDockerfileBuildsThisCheckoutWithUpstreamStartup(): void
    {
        $dockerfile = $this->read(self::RAILWAY_DIR . '/Dockerfile');

        self::assertMatchesRegularExpression('/^COPY \. \/openemr$/m', $dockerfile, 'must build the checked-out fork');
        self::assertStringNotContainsString('git clone https://github.com/openemr/openemr', $dockerfile);
        self::assertStringContainsString('composer install --no-dev', $dockerfile);
        self::assertStringContainsString('npm run build', $dockerfile);
        self::assertStringContainsString('docker/release/openemr.sh', $dockerfile);
        self::assertStringContainsString('docker/release/auto_configure.php', $dockerfile);
        self::assertStringContainsString('ARG RAILWAY_GIT_COMMIT_SHA', $dockerfile);
        self::assertStringContainsString('/root/source-commit', $dockerfile);
        self::assertStringContainsString('railway-start.sh', $dockerfile);
        self::assertStringNotContainsString('Dockerfile.dockerignore', $dockerfile);
        self::assertStringNotContainsString('OE_PASS', $dockerfile, 'no credentials baked into the image');
    }

    public function testRailwayConfigUsesTheRepositoryDockerfileAndReadinessGate(): void
    {
        $config = json_decode($this->read(self::RAILWAY_DIR . '/railway.json'), true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($config);
        self::assertSame(
            ['builder' => 'DOCKERFILE', 'dockerfilePath' => 'docker/railway/Dockerfile'],
            $config['build'] ?? null
        );
        $deploy = $config['deploy'] ?? null;
        self::assertIsArray($deploy);
        self::assertSame(self::READYZ_PATH, $deploy['healthcheckPath'] ?? null, 'readiness, not the 200-on-error meta health');
    }

    /**
     * Railway builds from GitHub's source archive, which honours export-ignore:
     * every build input the Dockerfile copies from docker/ must survive it.
     */
    public function testEveryDockerfileBuildInputSurvivesTheSourceArchive(): void
    {
        preg_match_all('/^COPY (?!--from)(?:--\S+ )*(.+) \S+$/m', $this->read(self::RAILWAY_DIR . '/Dockerfile'), $matches);
        $sources = ['docker/railway/Dockerfile'];
        foreach ($matches[1] as $list) {
            foreach (preg_split('/\s+/', trim($list)) ?: [] as $source) {
                if (str_starts_with($source, 'docker/')) {
                    $sources[] = rtrim($source, '/');
                }
            }
        }
        self::assertGreaterThan(5, count($sources));
        $archived = $this->archivedPaths('docker');
        foreach ($sources as $source) {
            self::assertFileExists(self::REPO_ROOT . '/' . $source);
            $found = in_array($source, $archived, true) || in_array($source . '/', $archived, true);
            self::assertTrue($found, $source . ' would be missing from the Railway source archive');
        }
    }

    /**
     * Lists what `git archive` would ship for the working tree (staged, with
     * .gitattributes, into a scratch copy of the index), as GitHub's tarball does for a pushed commit.
     *
     * @return list<string>
     */
    private function archivedPaths(string $pathspec): array
    {
        $git = 'git -C ' . escapeshellarg(self::REPO_ROOT);
        $index = $this->workDir . '/index';
        $script = 'set -e; cp "$(' . $git . ' rev-parse --path-format=absolute --git-path index)" ' . escapeshellarg($index) . '; '
            . 'export GIT_INDEX_FILE=' . escapeshellarg($index) . '; '
            . $git . ' add -A -- .gitattributes ' . escapeshellarg($pathspec) . '; '
            . $git . ' archive --format=tar "$(' . $git . ' write-tree)" -- ' . escapeshellarg($pathspec) . ' | tar tf -';
        [$code, $output] = self::runCommand(['bash', '-c', $script]);
        self::assertSame(0, $code, 'git archive listing failed');
        return array_values(array_filter(explode("\n", $output), static fn(string $line): bool => $line !== ''));
    }

    /**
     * The hadolint CI job lints every docker/**\/Dockerfile* path, so nothing
     * but real Dockerfiles may use that name.
     */
    public function testOnlyRealDockerfilesMatchTheHadolintGlob(): void
    {
        $paths = glob(self::RAILWAY_DIR . '/Dockerfile*') ?: [];
        self::assertSame([self::RAILWAY_DIR . '/Dockerfile'], $paths);
        self::assertMatchesRegularExpression('/^FROM /m', $this->read($paths[0]));
    }

    public function testApacheBoundaryIsAdditiveToFilesystemDenials(): void
    {
        $boundary = 'Hb9xW2cV5bN8mQ1zL4kJ7hG3';
        [$code, $output] = $this->runStart(['OE_HTTP_BOUNDARY_USER' => 'tester', 'OE_HTTP_BOUNDARY_PASS' => $boundary] + $this->strongEnv());
        self::assertSame(0, $code, $output);
        $conf = $this->read($this->workDir . '/apache/zz-railway-boundary.conf');
        self::assertStringContainsString('AuthMerging And', $conf);
        self::assertStringNotContainsString('Require all granted', $conf, 'a grant in a Location would override Files/Directory denials');
        self::assertStringContainsString(self::READYZ_PATH, $conf);
    }

    public function testRestrictiveUmaskDoesNotLeakIntoUpstreamStartup(): void
    {
        $this->writeStubEntrypoint("umask\n");
        [$code, $output] = $this->runStart(
            ['OE_HTTP_BOUNDARY_PASS' => 'Hb9xW2cV5bN8mQ1zL4kJ7hG3', 'RAILWAY_START_CHECK_ONLY' => '0'] + $this->strongEnv(),
            'umask 0022; '
        );
        self::assertSame(0, $code, $output);
        self::assertMatchesRegularExpression('/^0022$/m', $output, 'upstream must create TEMPsql_upgrade.php readable by apache');
    }

    public function testUpstreamOutputIsRedactedOnEveryStream(): void
    {
        $boundary = 'Hb9xW2cV5bN8mQ1zL4kJ7hG3';
        $this->writeStubEntrypoint(
            "echo \"unable to execute SQL: CREATE USER IDENTIFIED BY '\${MYSQL_PASS}'\"\n"
            . "echo \"root \${MYSQL_ROOT_PASS} admin \${OE_PASS} boundary \${OE_HTTP_BOUNDARY_PASS}\" >&2\n"
            . "exit 3\n"
        );
        [$code, $output] = $this->runStart(['OE_HTTP_BOUNDARY_PASS' => $boundary, 'RAILWAY_START_CHECK_ONLY' => '0'] + $this->strongEnv());
        self::assertSame(3, $code, 'upstream failure must propagate');
        self::assertStringContainsString("IDENTIFIED BY '[REDACTED]'", $output);
        self::assertSame(4, substr_count($output, '[REDACTED]'), $output);
        $this->assertNoSecretsIn($output);
        self::assertStringNotContainsString($boundary, $output);
    }

    public function testRefusesWhenSitesIsNotAPersistentMount(): void
    {
        [$code, $output] = $this->runStart(['MOUNTINFO_FILE' => $this->workDir . '/mountinfo-none'] + $this->strongEnv());
        self::assertNotSame(0, $code, $output);
        self::assertStringContainsString('REFUSING', $output);
        self::assertStringContainsString('not a mounted volume', $output);
        self::assertFileDoesNotExist($this->workDir . '/oe/sites/default/sqlconf.php');
    }

    public function testWebEgressGuardDisablesNetworkPrimitives(): void
    {
        $ini = self::RAILWAY_DIR . '/php-railway-egress.ini';
        self::assertFileExists($ini);
        $probe = 'echo json_encode([ini_get("allow_url_fopen"), array_map("function_exists", '
            . '["curl_exec", "curl_multi_exec", "fsockopen", "pfsockopen", "stream_socket_client", "socket_connect", '
            . '"mail", "exec", "shell_exec", "system", "passthru", "popen", "proc_open"])]);';
        [, $result] = self::runCommand(['php', '-c', $ini, '-r', $probe], ['PHP_INI_SCAN_DIR' => '']);
        self::assertSame('["",[false,false,false,false,false,false,false,false,false,false,false,false,false]]', trim($result));
    }

    /**
     * The egress ini must disable every function the guard requires, so the
     * guard and the configuration it verifies cannot drift apart.
     */
    public function testEgressIniDisablesEveryRequiredFunction(): void
    {
        $required = $this->requiredDisabledFunctions();
        foreach (['shell_exec', 'popen', 'system', 'passthru', 'pfsockopen', 'stream_socket_server', 'socket_create', 'socket_sendmsg', 'mb_send_mail', 'pcntl_exec'] as $function) {
            self::assertContains($function, $required, $function . ' must be in the required set');
        }
        $ini = parse_ini_file(self::RAILWAY_DIR . '/php-railway-egress.ini');
        self::assertIsArray($ini);
        self::assertIsString($ini['disable_functions'] ?? null);
        $disabled = explode(',', $ini['disable_functions']);
        self::assertSame([], array_values(array_diff($required, $disabled)), 'egress ini misses required functions');
    }

    /**
     * Reviewer probe: a configuration missing any one required function
     * (e.g. shell_exec or popen left available) must not pass the guard.
     *
     * @return array<string, array{string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function requiredFunctionProvider(): array
    {
        $cases = [];
        foreach (self::requiredDisabledFunctionsFromSource() as $function) {
            $cases[$function] = [$function];
        }
        return $cases;
    }

    #[DataProvider('requiredFunctionProvider')]
    public function testGuardRejectsConfigurationLeavingAnyRequiredFunctionAvailable(string $available): void
    {
        $disabled = array_values(array_diff($this->requiredDisabledFunctions(), [$available]));
        $ini = ['allow_url_fopen=0', 'allow_url_include=0', 'disable_functions=' . implode(',', $disabled)];
        $violations = $this->guardViolations($ini);
        [, $exists] = self::runCommand(['php', '-n', ...self::iniArgs($ini), '-r', 'echo json_encode(function_exists($argv[1]));', $available]);
        if (trim($exists) !== 'true') {
            self::assertNotContains('function ' . $available, $violations);
            return;
        }
        self::assertContains('function ' . $available, $violations, 'guard accepted an incomplete restriction set');
    }

    public function testGuardRejectsUrlStreams(): void
    {
        $violations = $this->guardViolations(['allow_url_fopen=1', 'disable_functions=' . implode(',', $this->requiredDisabledFunctions())]);
        self::assertContains('ini allow_url_fopen', $violations);
    }

    /**
     * PHP 8.5 has no disable_classes, so SOAP (and Redis) must be absent from
     * the web configuration altogether; with every function disabled, a loaded
     * SoapClient is the only thing left to reject.
     */
    public function testGuardRejectsAvailableSoapClientAndNothingElseUnderFullFunctionSet(): void
    {
        $violations = $this->guardViolations([
            'allow_url_fopen=0',
            'allow_url_include=0',
            'disable_functions=' . implode(',', $this->requiredDisabledFunctions()),
        ]);
        [, $classes] = self::runCommand(['php', '-n', '-r', 'echo json_encode(array_values(array_filter(["SoapClient", "Redis"], "class_exists")));']);
        $loaded = json_decode($classes, true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($loaded);
        $expected = array_map(static fn(mixed $class): string => 'class ' . (is_string($class) ? $class : ''), $loaded);
        self::assertSame($expected, $violations);
    }

    public function testWebIniDirExcludesSoapAndRedisButKeepsOtherExtensions(): void
    {
        $src = $this->workDir . '/php/conf.d';
        $dest = $this->workDir . '/php/railway-web.d';
        mkdir($src, 0700, true);
        $files = [
            '00_curl.ini' => "extension=curl\n",
            '01_soap.ini' => "extension=soap\n",
            '02_mysqli.ini' => "extension=mysqli\n",
            '20_redis.ini' => "extension=redis\n",
            '21_quoted_soap.ini' => "; comment\n extension = \"soap.so\"\n",
            '99-railway.ini' => "expose_php = Off\n",
        ];
        foreach ($files as $name => $body) {
            file_put_contents($src . '/' . $name, $body);
        }
        [$code, $out] = self::runCommand(['bash', self::RAILWAY_DIR . '/railway-web-ini.sh', $src, $dest]);
        self::assertSame(0, $code, $out);
        $kept = array_map(basename(...), glob($dest . '/*.ini') ?: []);
        self::assertSame(['00_curl.ini', '02_mysqli.ini', '99-railway.ini'], $kept);
    }

    public function testDockerfileServesWebPhpOnlyFromTheFilteredIniDir(): void
    {
        $dockerfile = $this->read(self::RAILWAY_DIR . '/Dockerfile');
        self::assertStringContainsString('railway-web-ini.sh', $dockerfile);
        $serve = $this->read(self::RAILWAY_DIR . '/railway-serve.sh');
        self::assertMatchesRegularExpression('/^export PHP_INI_SCAN_DIR="\$\{web_ini_dir\}"$/m', $serve, 'web PHP must not also scan the CLI conf.d');
        self::assertStringContainsString('railway_web_guard_active()', $serve, 'startup must use the same guard as readiness');
        self::assertStringContainsString('railway_web_guard_active()', $this->read(self::RAILWAY_DIR . '/readyz.php'));
    }

    /**
     * Synthetic controlled receiver on loopback: an unguarded PHP reaches it
     * (positive control); PHP under the web egress restrictions does not,
     * through any function or URL-stream transport.
     */
    public function testGuardedPhpCannotReachControlledReceiver(): void
    {
        $server = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
        self::assertIsResource($server, $errstr ?? 'receiver listen failed');
        stream_set_blocking($server, false);
        $name = stream_socket_get_name($server, false);
        self::assertIsString($name);
        $target = 'tcp://' . $name;
        $url = 'http://' . $name . '/';
        $probe = '$t = $argv[1]; $u = $argv[2]; $tries = ['
            . 'fn() => fsockopen($t), fn() => pfsockopen($t), fn() => stream_socket_client($t), '
            . 'fn() => file_get_contents($u), fn() => fopen($u, "r"), fn() => shell_exec("curl -s --max-time 1 " . $u), '
            . 'fn() => popen("curl -s --max-time 1 " . $u, "r"), fn() => (new SoapClient(null, ["location" => $u, "uri" => "urn:x", "connection_timeout" => 2]))->__soapCall("x", []), '
            . 'fn() => (function () use ($u) { $c = curl_init($u); curl_setopt($c, CURLOPT_TIMEOUT, 1); curl_exec($c); })()]; '
            . 'foreach ($tries as $try) { try { @$try(); } catch (Throwable) {} }';

        $this->runProbe($probe, [], $target, $url);
        self::assertGreaterThan(0, $this->drainConnections($server), 'positive control: unguarded PHP must reach the receiver');

        $this->runProbe($probe, $this->guardIni(), $target, $url, withoutSoap: true);
        self::assertSame(0, $this->drainConnections($server), 'guarded PHP reached the controlled receiver');
        fclose($server);
    }

    public function testLogSecretScanDetectsSecretAfterLargeOutput(): void
    {
        // > 64 KiB pipe buffer before the secret, so an early-exiting grep
        // would SIGPIPE the producer.
        $this->writeFakeDocker('python3 -c "import sys; sys.stdout.write(\'x\' * 2000000 + \'\\n\')"; echo "leak ${OE_PASS} here"; python3 -c "import sys; sys.stdout.write(\'y\' * 2000000 + \'\\n\')"');
        [$code, $output] = $this->runLogScan();
        self::assertNotSame(0, $code, 'secret after large output must be detected: ' . $output);
    }

    public function testLogSecretScanFailsWhenLogsCannotBeRetrieved(): void
    {
        $this->writeFakeDocker('echo "Error response from daemon: No such container" >&2; exit 1');
        [$code, $output] = $this->runLogScan();
        self::assertNotSame(0, $code, 'retrieval failure must fail the check: ' . $output);
    }

    public function testLogSecretScanPassesCleanLargeOutput(): void
    {
        $this->writeFakeDocker('python3 -c "import sys; sys.stdout.write(\'x\' * 2000000 + \'\\n\')"; echo "[REDACTED]"');
        [$code, $output] = $this->runLogScan();
        self::assertSame(0, $code, $output);
    }

    public function testAcceptanceUsesTheLogScanHelper(): void
    {
        $acceptance = $this->read(self::RAILWAY_DIR . '/acceptance-test.sh');
        self::assertStringContainsString('acceptance-lib.sh', $acceptance);
        self::assertDoesNotMatchRegularExpression('/!\s*docker logs[^\n]*\|\s*grep -q/', $acceptance);
    }

    public function testReadinessReportsNotReadyWithoutVerifiedMarker(): void
    {
        $readyz = self::RAILWAY_DIR . '/readyz.php';
        self::assertFileExists($readyz);
        [, $result] = self::runCommand(['php', '-n', $readyz], ['RAILWAY_READY_MARKER' => $this->workDir . '/absent.json']);
        $body = json_decode($result, true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($body);
        self::assertFalse($body['ready'] ?? null);
        self::assertSame('startup verification has not completed', $body['reason'] ?? null);
    }

    public function testDockerfileServesOnlyAfterVerification(): void
    {
        $dockerfile = $this->read(self::RAILWAY_DIR . '/Dockerfile');
        self::assertStringContainsString('exec /usr/local/bin/railway-serve.sh', $dockerfile);
        self::assertStringContainsString('railway-verify.php', $dockerfile);
        $serve = $this->read(self::RAILWAY_DIR . '/railway-serve.sh');
        self::assertMatchesRegularExpression('/railway-verify\.php.*\n(.*\n)*.*PHP_INI_SCAN_DIR.*\n(.*\n)*exec \/usr\/sbin\/httpd -D FOREGROUND/', $serve);
    }

    public function testReadinessIsServedAtAnExtensionlessPathAndThePhpUrlIsDenied(): void
    {
        $conf = $this->read(self::RAILWAY_DIR . '/openemr-railway.conf');
        self::assertStringContainsString('AliasMatch "^' . self::READYZ_PATH . '$" "/var/www/localhost/htdocs/openemr/meta/railway/readyz.php"', $conf);
        self::assertMatchesRegularExpression('#<Location "' . preg_quote(self::READYZ_PATH, '#') . '\.php">\s*Require all denied\s*</Location>#', $conf);
        self::assertStringNotContainsString('.php', self::READYZ_PATH, 'Railway rejects healthcheck paths ending in .php');
    }

    public function testApacheDeniesInstallerAndSetupScripts(): void
    {
        $conf = $this->read(self::RAILWAY_DIR . '/openemr-railway.conf');
        foreach (['setup', 'admin', 'auto_configure', 'sql_upgrade', 'sql_patch', 'acl_upgrade', 'ippf_upgrade'] as $script) {
            self::assertStringContainsString($script, $conf, $script . '.php must be denied');
        }
        self::assertStringContainsString('Require all denied', $conf);
        self::assertStringContainsString('contrib/util/installScripts', $conf);
    }

    public function testPhpMailIsDisabled(): void
    {
        self::assertMatchesRegularExpression(
            '/^sendmail_path\s*=\s*\/bin\/false$/m',
            $this->read(self::RAILWAY_DIR . '/php-railway.ini')
        );
    }

    /**
     * @return array<string, array{array<string, string>}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function insecureEnvironmentProvider(): array
    {
        $strong = [
            'MYSQL_HOST' => 'mariadb.railway.internal',
            'MYSQL_ROOT_PASS' => self::STRONG_ROOT,
            'MYSQL_PASS' => self::STRONG_DB,
            'OE_USER' => 'oe-test-admin',
            'OE_PASS' => self::STRONG_ADMIN,
        ];
        return [
            'admin password missing' => [array_diff_key($strong, ['OE_PASS' => true])],
            'admin password is upstream default' => [['OE_PASS' => 'pass'] + $strong],
            'admin password too short' => [['OE_PASS' => 'Short1'] + $strong],
            'root password is upstream default' => [['MYSQL_ROOT_PASS' => 'root'] + $strong],
            'db password is upstream default' => [['MYSQL_PASS' => 'openemr'] + $strong],
            'db host missing' => [array_diff_key($strong, ['MYSQL_HOST' => true])],
            'admin user is upstream default' => [['OE_USER' => 'admin'] + $strong],
            'manual web setup requested' => [['MANUAL_SETUP' => 'yes'] + $strong],
            'admin password with equals sign' => [['OE_PASS' => 'Ad3mF6gH9jK2=lM5nP8qR1sT4'] + $strong],
            'db password with whitespace' => [['MYSQL_PASS' => 'Db5hJ8kL2nP6 qR9tV3xZ7cF4'] + $strong],
            'root password with quote' => [['MYSQL_ROOT_PASS' => "Rt7uQ2vX9pL4'mN8sK3wE6yA1"] + $strong],
            'admin password with dollar' => [['OE_PASS' => 'Ad3mF6gH9jK2$lM5nP8qR1sT4'] + $strong],
            'admin user with whitespace' => [['OE_USER' => 'oe test admin'] + $strong],
            'db host with whitespace' => [['MYSQL_HOST' => 'mariadb railway'] + $strong],
        ];
    }

    /**
     * @param array<string, string> $env
     */
    #[DataProvider('insecureEnvironmentProvider')]
    public function testStartRefusesInsecureEnvironment(array $env): void
    {
        [$code, $output] = $this->runStart($env);

        self::assertNotSame(0, $code, 'start must refuse: ' . $output);
        self::assertStringContainsString('REFUSING', $output);
        $this->assertNoSecretsIn($output);
        self::assertFileDoesNotExist($this->workDir . '/oe/sites/default/sqlconf.php', 'no seeding on refusal');
    }

    public function testStartSeedsEmptySitesVolumeAndAppliesSafetySettings(): void
    {
        [$code, $output] = $this->runStart($this->strongEnv());

        self::assertSame(0, $code, $output);
        self::assertFileExists($this->workDir . '/oe/sites/default/sqlconf.php');
        self::assertDirectoryExists($this->workDir . '/oe/sites/default/documents');
        foreach (
            [
                'EMAIL_METHOD=SMTP',
                'SMTP_HOST=127.0.0.1',
                'SMTP_PORT=9',
                'payment_gateway=InHouse',
                'gateway_mode_production=0',
                'medex_enable=0',
                'phimail_enable=0',
                'portal_onsite_two_enable=0',
            ] as $setting
        ) {
            self::assertStringContainsString('safety: ' . $setting, $output);
        }
        $this->assertNoSecretsIn($output);
    }

    public function testStartDoesNotOverwriteAnExistingSitesVolume(): void
    {
        mkdir($this->workDir . '/oe/sites/default', 0700, true);
        file_put_contents($this->workDir . '/oe/sites/default/sqlconf.php', "<?php\n\$config = 1;\n");

        [$code, $output] = $this->runStart($this->strongEnv());

        self::assertSame(0, $code, $output);
        self::assertStringContainsString('$config = 1;', $this->read($this->workDir . '/oe/sites/default/sqlconf.php'));
    }

    public function testOptionalHttpBoundaryProtectsAllButHealth(): void
    {
        $boundary = 'Hb9xW2cV5bN8mQ1zL4kJ7hG3';
        [$code, $output] = $this->runStart(['OE_HTTP_BOUNDARY_USER' => 'tester', 'OE_HTTP_BOUNDARY_PASS' => $boundary] + $this->strongEnv());

        self::assertSame(0, $code, $output);
        self::assertStringNotContainsString($boundary, $output);
        $conf = $this->read($this->workDir . '/apache/zz-railway-boundary.conf');
        self::assertStringContainsString('AuthType Basic', $conf);
        self::assertStringNotContainsString('meta/health', $conf, 'health exemption must not grant past denials');
        $htpasswd = $this->read($this->workDir . '/apache/railway-boundary.htpasswd');
        self::assertStringStartsWith('tester:$apr1$', $htpasswd);
        self::assertStringNotContainsString($boundary, $htpasswd);
    }

    public function testNoHttpBoundaryFileWithoutPassword(): void
    {
        [$code, $output] = $this->runStart($this->strongEnv());

        self::assertSame(0, $code, $output);
        self::assertFileDoesNotExist($this->workDir . '/apache/zz-railway-boundary.conf');
    }

    /**
     * @return array<string, string>
     */
    private function strongEnv(): array
    {
        return [
            'MYSQL_HOST' => 'mariadb.railway.internal',
            'MYSQL_ROOT_PASS' => self::STRONG_ROOT,
            'MYSQL_PASS' => self::STRONG_DB,
            'OE_USER' => 'oe-test-admin',
            'OE_PASS' => self::STRONG_ADMIN,
        ];
    }

    /**
     * @param array<string, string> $env
     * @return array{int, string}
     */
    private function runStart(array $env, string $prelude = ''): array
    {
        self::assertFileExists(self::START_SCRIPT);
        $env += [
            'PATH' => getenv('PATH') ?: '/usr/bin:/bin',
            'RAILWAY_START_CHECK_ONLY' => '1',
            'OE_ROOT' => $this->workDir . '/oe',
            'SITES_TEMPLATE_DIR' => $this->workDir . '/template/sites',
            'APACHE_CONF_DIR' => $this->workDir . '/apache',
            'SITES_OWNER' => 'none',
            'MOUNTINFO_FILE' => $this->workDir . '/mountinfo',
        ];
        // Unset inherited credentials the case did not supply.
        $env += array_fill_keys(['MYSQL_HOST', 'MYSQL_ROOT_PASS', 'MYSQL_PASS', 'OE_USER', 'OE_PASS', 'OE_HTTP_BOUNDARY_PASS', 'MANUAL_SETUP'], false);
        return self::runCommand(['bash', '-c', $prelude . 'exec bash ' . escapeshellarg(self::START_SCRIPT) . ' 2>&1'], $env);
    }

    /**
     * @return list<string>
     */
    private function requiredDisabledFunctions(): array
    {
        $functions = self::requiredDisabledFunctionsFromSource();
        self::assertNotSame([], $functions);
        return $functions;
    }

    /**
     * @return list<string>
     */
    private static function requiredDisabledFunctionsFromSource(): array
    {
        $script = 'require ' . var_export(self::RAILWAY_DIR . '/railway-safety.php', true) . '; echo json_encode(RAILWAY_WEB_DISABLED_FUNCTIONS);';
        [, $json] = self::runCommand(['php', '-n', '-r', $script]);
        $functions = json_decode($json, true);
        return is_array($functions) ? array_values(array_filter($functions, is_string(...))) : [];
    }

    /**
     * @return list<string>
     */
    private function guardIni(): array
    {
        return ['allow_url_fopen=0', 'allow_url_include=0', 'disable_functions=' . implode(',', $this->requiredDisabledFunctions())];
    }

    /**
     * @param list<string> $ini
     * @return list<string>
     */
    private function guardViolations(array $ini): array
    {
        $script = 'require ' . var_export(self::RAILWAY_DIR . '/railway-safety.php', true) . '; echo json_encode(railway_web_guard_violations());';
        [, $json] = self::runCommand(['php', '-n', ...self::iniArgs($ini), '-r', $script]);
        $violations = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($violations);
        return array_values(array_filter($violations, is_string(...)));
    }

    /**
     * @param list<string> $ini
     */
    private function runProbe(string $probe, array $ini, string $target, string $url, bool $withoutSoap = false): void
    {
        if ($withoutSoap) {
            // The host PHP may have SOAP compiled in, which the container's web
            // configuration excludes; mirror that by removing the class.
            $probe = str_replace('fn() => (new SoapClient(', 'fn() => (new RailwayNoSoapClient(', $probe);
        }
        self::runCommand(['php', '-n', ...self::iniArgs($ini), '-d', 'default_socket_timeout=1', '-r', $probe, $target, $url], [], 60);
    }

    /**
     * @param resource $server
     */
    private function drainConnections($server): int
    {
        $count = 0;
        while (($conn = @stream_socket_accept($server, 0.2)) !== false) {
            $count++;
            fclose($conn);
        }
        return $count;
    }

    private function writeFakeDocker(string $body): void
    {
        mkdir($this->workDir . '/bin', 0700, true);
        file_put_contents($this->workDir . '/bin/docker', "#!/usr/bin/env bash\n" . $body . "\n");
        chmod($this->workDir . '/bin/docker', 0700);
    }

    /**
     * @return array{int, string}
     */
    private function runLogScan(): array
    {
        $lib = self::RAILWAY_DIR . '/acceptance-lib.sh';
        self::assertFileExists($lib);
        $script = 'set -euo pipefail; source ' . escapeshellarg($lib) . '; '
            . 'if logs_free_of_secrets app ' . escapeshellarg($this->workDir . '/app.log') . '; then exit 0; else exit 1; fi';
        $env = [
            'PATH' => $this->workDir . '/bin:' . (getenv('PATH') ?: '/usr/bin:/bin'),
            'MYSQL_ROOT_PASS' => self::STRONG_ROOT,
            'MYSQL_PASS' => self::STRONG_DB,
            'OE_PASS' => self::STRONG_ADMIN,
            'OE_HTTP_BOUNDARY_PASS' => 'Hb9xW2cV5bN8mQ1zL4kJ7hG3',
        ];
        return self::runCommand(['bash', '-c', $script], $env);
    }

    /**
     * @param list<string> $command
     * @param array<string, string|false> $env merged over the inherited environment; false unsets
     * @return array{int, string} exit code and stdout followed by stderr
     */
    private static function runCommand(array $command, array $env = [], float $timeout = 120): array
    {
        $process = new Process($command, null, $env, null, $timeout);
        $process->run();
        return [$process->getExitCode() ?? -1, $process->getOutput() . $process->getErrorOutput()];
    }

    /**
     * @param list<string> $ini
     * @return list<string>
     */
    private static function iniArgs(array $ini): array
    {
        $args = [];
        foreach ($ini as $setting) {
            $args[] = '-d';
            $args[] = $setting;
        }
        return $args;
    }

    private function writeStubEntrypoint(string $body): void
    {
        file_put_contents($this->workDir . '/oe/openemr.sh', "#!/usr/bin/env bash\n" . $body);
        chmod($this->workDir . '/oe/openemr.sh', 0700);
    }

    private function assertNoSecretsIn(string $output): void
    {
        foreach ([self::STRONG_ROOT, self::STRONG_DB, self::STRONG_ADMIN, 'Short1'] as $secret) {
            self::assertStringNotContainsString($secret, $output, 'secret leaked to log');
        }
    }

    private function read(string $path): string
    {
        self::assertFileExists($path);
        $contents = file_get_contents($path);
        self::assertIsString($contents);
        return $contents;
    }
}
