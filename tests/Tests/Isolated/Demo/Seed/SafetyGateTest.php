<?php

/**
 * Safety gate for the synthetic demo-data seeder: fails closed by default.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Demo\Seed;

use OpenEMR\Demo\Seed\SafetyGate;
use OpenEMR\Demo\Seed\SeedMode;
use OpenEMR\Demo\Seed\SeedRefusedException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SafetyGateTest extends TestCase
{
    private const ALLOWED_ENV = [
        'OPENEMR_DEMO_SEED_ALLOWED' => 'synthetic-test-only',
        'OPENEMR_DEMO_SEED_TARGET' => 'railway-testing',
        'RAILWAY_ENVIRONMENT_NAME' => 'testing',
    ];
    private const CONFIRM = ['--confirm-synthetic-seed=default'];

    public function testWritesAreDeniedByDefault(): void
    {
        $this->expectException(SeedRefusedException::class);
        SafetyGate::assertAllowed(SeedMode::Seed, [], [], 'cli', 'default');
    }

    public function testExplicitTestEnvironmentWithConfirmationIsAllowed(): void
    {
        SafetyGate::assertAllowed(SeedMode::Seed, self::ALLOWED_ENV, self::CONFIRM, 'cli', 'default');
        $this->addToAssertionCount(1);
    }

    /**
     * @param array<string, string> $env
     * @param list<string> $argv
     */
    #[DataProvider('deniedProvider')]
    public function testDenied(array $env, array $argv, string $sapi): void
    {
        $this->expectException(SeedRefusedException::class);
        SafetyGate::assertAllowed(SeedMode::Seed, $env, $argv, $sapi, 'default');
    }

    /**
     * @return array<string, array{array<string, string>, list<string>, string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function deniedProvider(): array
    {
        return [
            'production railway environment' => [
                ['RAILWAY_ENVIRONMENT_NAME' => 'production'] + self::ALLOWED_ENV, self::CONFIRM, 'cli',
            ],
            'unknown railway environment' => [
                ['RAILWAY_ENVIRONMENT_NAME' => 'staging'] + self::ALLOWED_ENV, self::CONFIRM, 'cli',
            ],
            'production app env' => [['APP_ENV' => 'prod'] + self::ALLOWED_ENV, self::CONFIRM, 'cli'],
            'allow flag wrong value' => [
                ['OPENEMR_DEMO_SEED_ALLOWED' => '1'] + self::ALLOWED_ENV, self::CONFIRM, 'cli',
            ],
            'unknown target' => [['OPENEMR_DEMO_SEED_TARGET' => 'prod'] + self::ALLOWED_ENV, self::CONFIRM, 'cli'],
            'local target inside railway' => [
                ['OPENEMR_DEMO_SEED_TARGET' => 'local-dev'] + self::ALLOWED_ENV, self::CONFIRM, 'cli',
            ],
            'missing confirmation' => [self::ALLOWED_ENV, [], 'cli'],
            'confirmation for other site' => [self::ALLOWED_ENV, ['--confirm-synthetic-seed=other'], 'cli'],
            'web sapi' => [self::ALLOWED_ENV, self::CONFIRM, 'apache2handler'],
        ];
    }

    public function testLocalDevTargetOutsideRailwayIsAllowed(): void
    {
        $env = ['OPENEMR_DEMO_SEED_ALLOWED' => 'synthetic-test-only', 'OPENEMR_DEMO_SEED_TARGET' => 'local-dev'];
        SafetyGate::assertAllowed(SeedMode::Seed, $env, self::CONFIRM, 'cli', 'default');
        $this->addToAssertionCount(1);
    }

    public function testReadOnlyModesNeedNoWriteAuthorisationButStillRequireCli(): void
    {
        foreach ([SeedMode::Inventory, SeedMode::DryRun, SeedMode::Verify] as $mode) {
            SafetyGate::assertAllowed($mode, [], [], 'cli', 'default');
        }
        $this->expectException(SeedRefusedException::class);
        SafetyGate::assertAllowed(SeedMode::Verify, [], [], 'fpm-fcgi', 'default');
    }

    /** @return array<string, string> */
    private static function canonicalDatabase(): array
    {
        return SafetyGate::CANONICAL_SETTINGS + SafetyGate::REQUIRED_DISABLED;
    }

    public function testCanonicalMarkerAndSafeDatabaseAreAllowed(): void
    {
        SafetyGate::assertRuntimeMarker(['settings' => SafetyGate::CANONICAL_SETTINGS], self::canonicalDatabase());
        $this->addToAssertionCount(1);
    }

    public function testCanonicalSettingsMatchRailwayStartScript(): void
    {
        $script = file_get_contents(__DIR__ . '/../../../../../docker/railway/railway-start.sh');
        self::assertIsString($script);
        self::assertSame(1, preg_match('/^SAFETY_SETTINGS=\((.*?)^\)/ms', $script, $m));
        $settings = [];
        foreach (preg_split('/\s+/', trim($m[1])) ?: [] as $pair) {
            [$name, $value] = explode('=', $pair, 2);
            $settings[$name] = $value;
        }
        self::assertSame($settings, SafetyGate::CANONICAL_SETTINGS);
    }

    /**
     * @param array<mixed>|null $marker
     * @param array<string, string> $database
     */
    #[DataProvider('unsafeRuntimeProvider')]
    public function testUnsafeOrIncompleteRuntimeIsRefused(?array $marker, array $database): void
    {
        $this->expectException(SeedRefusedException::class);
        SafetyGate::assertRuntimeMarker($marker, $database);
    }

    /**
     * @return array<string, array{array<mixed>|null, array<string, string>}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function unsafeRuntimeProvider(): array
    {
        $canonical = SafetyGate::CANONICAL_SETTINGS;
        $db = SafetyGate::CANONICAL_SETTINGS + SafetyGate::REQUIRED_DISABLED;
        $missingKey = $canonical;
        unset($missingKey['phimail_enable']);
        $dbMissing = $db;
        unset($dbMissing['erx_enable']);
        return [
            'missing marker' => [null, $db],
            'empty marker settings' => [['settings' => []], $db],
            'arbitrary matching marker with eRx on' => [['settings' => ['erx_enable' => '1']], ['erx_enable' => '1'] + $db],
            'marker missing a canonical key' => [['settings' => $missingKey], $db],
            'marker with an unsafe value' => [['settings' => ['medex_enable' => '1'] + $canonical], ['medex_enable' => '1'] + $db],
            'marker with an extra key' => [['settings' => $canonical + ['erx_enable' => '1']], $db],
            'database eRx enabled' => [['settings' => $canonical], ['erx_enable' => '1'] + $db],
            'database eRx flag absent' => [['settings' => $canonical], $dbMissing],
            'database mail diverges from marker' => [['settings' => $canonical], ['EMAIL_METHOD' => 'SENDMAIL'] + $db],
        ];
    }

    public function testRefusalMessageNeverEchoesEnvironmentValues(): void
    {
        $env = ['OPENEMR_DEMO_SEED_ALLOWED' => 'hunter2-secret-value'] + self::ALLOWED_ENV;
        try {
            SafetyGate::assertAllowed(SeedMode::Seed, $env, self::CONFIRM, 'cli', 'default');
            self::fail('expected refusal');
        } catch (SeedRefusedException $e) {
            self::assertStringNotContainsString('hunter2-secret-value', $e->getMessage());
        }
    }
}
