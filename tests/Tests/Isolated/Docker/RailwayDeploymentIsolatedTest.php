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
        self::assertStringNotContainsString('OE_PASS', $dockerfile, 'no credentials baked into the image');
    }

    public function testRailwayConfigUsesTheRepositoryDockerfile(): void
    {
        $config = json_decode($this->read(self::RAILWAY_DIR . '/railway.json'), true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($config);
        self::assertSame(
            ['builder' => 'DOCKERFILE', 'dockerfilePath' => 'docker/railway/Dockerfile'],
            $config['build'] ?? null
        );
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
                'OPENEMR_SETTING_EMAIL_METHOD=SMTP',
                'OPENEMR_SETTING_SMTP_HOST=127.0.0.1',
                'OPENEMR_SETTING_SMTP_PORT=9',
                'OPENEMR_SETTING_payment_gateway=InHouse',
                'OPENEMR_SETTING_gateway_mode_production=0',
                'OPENEMR_SETTING_medex_enable=0',
                'OPENEMR_SETTING_phimail_enable=0',
                'OPENEMR_SETTING_portal_onsite_two_enable=0',
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
        self::assertStringContainsString('meta/health', $conf);
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
    private function runStart(array $env): array
    {
        self::assertFileExists(self::START_SCRIPT);
        $env += [
            'PATH' => getenv('PATH') ?: '/usr/bin:/bin',
            'RAILWAY_START_CHECK_ONLY' => '1',
            'OE_ROOT' => $this->workDir . '/oe',
            'SITES_TEMPLATE_DIR' => $this->workDir . '/template/sites',
            'APACHE_CONF_DIR' => $this->workDir . '/apache',
            'SITES_OWNER' => 'none',
        ];
        $process = proc_open(
            ['bash', self::START_SCRIPT],
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
