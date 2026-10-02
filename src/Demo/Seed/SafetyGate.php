<?php

/**
 * Fail-closed authorisation for the synthetic demo-data seeder.
 *
 * Writing requires ALL of: CLI SAPI, OPENEMR_DEMO_SEED_ALLOWED=synthetic-test-only,
 * an allow-listed OPENEMR_DEMO_SEED_TARGET consistent with the Railway environment
 * name, no production marker in any environment-name variable, and
 * --confirm-synthetic-seed=<site>. Before the first write the Railway runtime
 * safety marker must record the canonical settings and the database must hold
 * them plus eRx disabled (assertRuntimeMarker).
 * Refusal messages name the failed rule only, never a variable's value.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

final class SafetyGate
{
    public const ALLOW_VALUE = 'synthetic-test-only';
    /** Target => required RAILWAY_ENVIRONMENT_NAME (null = must be absent). */
    private const TARGETS = ['railway-testing' => 'testing', 'local-dev' => null];
    private const ENV_NAME_VARIABLES = ['APP_ENV', 'OPENEMR_ENV', 'RAILWAY_ENVIRONMENT_NAME', 'OPENEMR_DEMO_SEED_TARGET'];

    /**
     * @param array<string, string> $env
     * @param list<string> $argv
     */
    public static function assertAllowed(SeedMode $mode, array $env, array $argv, string $sapi, string $site): void
    {
        if ($sapi !== 'cli') {
            throw new SeedRefusedException('The demo seeder runs from the command line only.');
        }
        if (!$mode->writes()) {
            return;
        }
        foreach (self::ENV_NAME_VARIABLES as $name) {
            if (preg_match('/prod|live/i', $env[$name] ?? '') === 1) {
                throw new SeedRefusedException("Refusing to write: {$name} names a production environment.");
            }
        }
        if (($env['OPENEMR_DEMO_SEED_ALLOWED'] ?? '') !== self::ALLOW_VALUE) {
            throw new SeedRefusedException('Refusing to write: OPENEMR_DEMO_SEED_ALLOWED is not set to the required value.');
        }
        $target = $env['OPENEMR_DEMO_SEED_TARGET'] ?? '';
        if (!array_key_exists($target, self::TARGETS)) {
            throw new SeedRefusedException('Refusing to write: OPENEMR_DEMO_SEED_TARGET is not an allow-listed test target.');
        }
        $railwayEnv = $env['RAILWAY_ENVIRONMENT_NAME'] ?? null;
        if ($railwayEnv !== self::TARGETS[$target]) {
            throw new SeedRefusedException('Refusing to write: RAILWAY_ENVIRONMENT_NAME does not match the declared target.');
        }
        if (!in_array('--confirm-synthetic-seed=' . $site, $argv, true)) {
            throw new SeedRefusedException('Refusing to write: pass --confirm-synthetic-seed=<site> for the target site.');
        }
    }

    /**
     * The outbound-safety globals railway-start.sh hands to railway-verify.php
     * (SAFETY_SETTINGS). Kept in lockstep by SafetyGateTest.
     */
    public const CANONICAL_SETTINGS = [
        'EMAIL_METHOD' => 'SMTP',
        'SMTP_HOST' => '127.0.0.1',
        'SMTP_PORT' => '9',
        'payment_gateway' => 'InHouse',
        'gateway_mode_production' => '0',
        'medex_enable' => '0',
        'phimail_enable' => '0',
        'portal_onsite_two_enable' => '0',
    ];

    /** Further outbound globals (eRx, emailed prescriptions) that must be explicitly off in the database. */
    public const REQUIRED_DISABLED = [
        'erx_enable' => '0',
        'erx_upload_active' => '0',
        'rx_send_email' => '0',
    ];

    /**
     * Seeding requires the Railway runtime marker (ready.json written by
     * railway-verify.php) to record exactly CANONICAL_SETTINGS, and the database
     * to hold CANONICAL_SETTINGS and REQUIRED_DISABLED. The expected values are
     * fixed here; nothing supplied by the marker or environment can widen them.
     *
     * @param array<mixed>|null $marker decoded ready.json
     * @param array<string, string> $databaseValues gl_name => gl_value
     */
    public static function assertRuntimeMarker(?array $marker, array $databaseValues): void
    {
        $settings = $marker['settings'] ?? null;
        if (!is_array($settings) || $settings === []) {
            throw new SeedRefusedException('Refusing to write: the test-runtime safety marker is missing.');
        }
        $recorded = [];
        foreach ($settings as $name => $value) {
            if (!is_string($name) || !is_scalar($value)) {
                throw new SeedRefusedException('Refusing to write: the test-runtime safety marker is malformed.');
            }
            $recorded[$name] = (string) $value;
        }
        ksort($recorded);
        $canonical = self::CANONICAL_SETTINGS;
        ksort($canonical);
        if ($recorded !== $canonical) {
            throw new SeedRefusedException('Refusing to write: the runtime marker does not record the canonical outbound-safety settings.');
        }
        foreach (self::CANONICAL_SETTINGS + self::REQUIRED_DISABLED as $name => $expected) {
            if (($databaseValues[$name] ?? null) !== $expected) {
                throw new SeedRefusedException('Refusing to write: outbound mail/SMS/payment/eRx globals in the database are not in the canonical safe state.');
            }
        }
    }
}
