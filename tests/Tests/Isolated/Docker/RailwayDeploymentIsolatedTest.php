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

class RailwayDeploymentIsolatedTest extends TestCase
{
    private const REPO_ROOT = __DIR__ . '/../../../..';
    private const RAILWAY_DIR = self::REPO_ROOT . '/docker/railway';
    private const START_SCRIPT = self::RAILWAY_DIR . '/railway-start.sh';
    private const READYZ_PATH = '/meta/railway/readyz.php';

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
        exec('rm -rf ' . escapeshellarg($this->workDir));
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
        exec('bash -c ' . escapeshellarg($script), $lines, $code);
        self::assertSame(0, $code, 'git archive listing failed');
        return $lines;
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
        $result = shell_exec('PHP_INI_SCAN_DIR= php -c ' . escapeshellarg($ini) . ' -r ' . escapeshellarg($probe));
        self::assertIsString($result);
        self::assertSame('["",[false,false,false,false,false,false,false,false,false,false,false,false,false]]', trim($result));
    }

    public function testReadinessReportsNotReadyWithoutVerifiedMarker(): void
    {
        $readyz = self::RAILWAY_DIR . '/readyz.php';
        self::assertFileExists($readyz);
        $env = 'RAILWAY_READY_MARKER=' . escapeshellarg($this->workDir . '/absent.json') . ' ';
        $result = shell_exec($env . 'php -n ' . escapeshellarg($readyz));
        self::assertIsString($result);
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
        $process = proc_open(
            ['bash', '-c', $prelude . 'exec bash ' . escapeshellarg(self::START_SCRIPT)],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['redirect', 1]],
            $pipes,
            null,
            $env
        );
        self::assertIsResource($process);
        fclose($pipes[0]);
        $output = stream_get_contents($pipes[1]);
        self::assertIsString($output);
        fclose($pipes[1]);
        return [proc_close($process), $output];
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
