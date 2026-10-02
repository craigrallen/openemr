<?php

/**
 * Synthetic demo-data seeder CLI (TEST ENVIRONMENTS ONLY).
 *
 *   php contrib/util/demo-seed/demo-seed.php <inventory|dry-run|seed|verify> --site=<site>
 *       [--fixture=<path>] [--confirm-synthetic-seed=<site>]
 *
 * `seed` additionally requires the environment gate in SafetyGate and the
 * runtime safety marker (OPENEMR_DEMO_SEED_MARKER, default
 * /run/openemr-railway/ready.json) to match the database globals.
 * Exit codes: 0 ok, 1 verification failure, 2 refused/invalid, 3 error
 * (database/gateway exception, logged via the PSR-3 logger). PHP Errors are
 * not caught here; they reach OpenEMR's error handler with a non-zero exit.
 * Either way a seed run is rolled back before the process exits.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

use OpenEMR\BC\ServiceContainer;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Http\CurrentRequest;
use OpenEMR\Common\Http\HttpRestRequest;
use OpenEMR\Demo\Seed\CoverageManifest;
use OpenEMR\Demo\Seed\DemoCalendar;
use OpenEMR\Demo\Seed\DemoSeeder;
use OpenEMR\Demo\Seed\FixtureLoader;
use OpenEMR\Demo\Seed\InvalidFixtureException;
use OpenEMR\Demo\Seed\OpenEmrSeedGateway;
use OpenEMR\Demo\Seed\SafetyGate;
use OpenEMR\Demo\Seed\SeedConflictException;
use OpenEMR\Demo\Seed\SeedMode;
use OpenEMR\Demo\Seed\SeedRefusedException;
use OpenEMR\Demo\Seed\SeedVerifier;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(2);
}

require_once __DIR__ . '/../../../vendor/autoload.php';
// Production images ship an authoritative classmap built before src/Demo existed.
spl_autoload_register(static function (string $class): void {
    if (str_starts_with($class, 'OpenEMR\\Demo\\')) {
        $file = __DIR__ . '/../../../src/Demo/' . str_replace('\\', '/', substr($class, 13)) . '.php';
        if (is_file($file)) {
            require_once $file;
        }
    }
});

/** @param array<mixed> $data */
$out = static function (array $data): void {
    fwrite(STDOUT, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
};
$fail = static function (string $message, int $code): never {
    fwrite(STDERR, "demo-seed: {$message}\n");
    exit($code);
};

$request = HttpRestRequest::createFromGlobals();
$args = [];
foreach (array_slice($request->server->all('argv'), 1) as $arg) {
    if (!is_string($arg)) {
        $fail('command-line arguments must be strings.', 2);
    }
    $args[] = $arg;
}
$mode = SeedMode::tryFrom($args[0] ?? '') ?? $fail('usage: demo-seed.php <inventory|dry-run|seed|verify> --site=<site> [--fixture=<path>] [--confirm-synthetic-seed=<site>]', 2);
$option = static function (string $name, string $default = '') use ($args): string {
    foreach ($args as $a) {
        if (str_starts_with($a, "--{$name}=")) {
            return substr($a, strlen($name) + 3);
        }
    }
    return $default;
};
$site = $option('site');
if (preg_match('/^[A-Za-z0-9_-]+$/', $site) !== 1) {
    $fail('--site=<site> is required.', 2);
}

$env = getenv();
try {
    SafetyGate::assertAllowed($mode, $env, $args, PHP_SAPI, $site);
    $fixture = FixtureLoader::fromFile($option('fixture', FixtureLoader::defaultPath()));
} catch (SeedRefusedException | InvalidFixtureException $e) {
    $fail($e->getMessage(), 2);
}

// Bootstrap OpenEMR only after the environment gate passed. globals.php selects
// the site from the query string, so publish the validated --site there.
$request->query->set('site', $site);
$request->overrideGlobals();
CurrentRequest::set($request);
$ignoreAuth = true;
$sessionAllowWrite = true;
require_once __DIR__ . '/../../../interface/globals.php';

$gateway = new OpenEmrSeedGateway();
$clock = new class implements \Psr\Clock\ClockInterface {
    public function now(): \DateTimeImmutable
    {
        return new \DateTimeImmutable();
    }
};
$calendar = new DemoCalendar($clock);
/** @param list<scalar> $binds */
$count = static function (string $sql, array $binds = []): int {
    $value = QueryUtils::fetchSingleValue($sql, 'c', $binds);
    if (!is_numeric($value)) {
        throw new RuntimeException('Count query returned a non-numeric value.');
    }
    return (int) $value;
};
/**
 * @param list<mixed> $column
 * @return list<string>
 */
$strings = static function (array $column): array {
    $out = [];
    foreach ($column as $value) {
        if (!is_string($value)) {
            throw new RuntimeException('Expected a string column value.');
        }
        $out[] = $value;
    }
    return $out;
};

try {
    switch ($mode) {
        case SeedMode::Inventory:
            $registry = $strings(QueryUtils::fetchTableColumn("SELECT directory FROM registry WHERE state = 1 ORDER BY directory", 'directory'));
            $lbf = $strings(QueryUtils::fetchTableColumn("SELECT grp_form_id FROM layout_group_properties WHERE grp_group_id = '' AND grp_activity = 1 ORDER BY grp_form_id", 'grp_form_id'));
            $entries = [];
            foreach (CoverageManifest::entries() as $e) {
                $entries[] = ['key' => $e->key, 'status' => $e->status->value, 'tables' => $e->tables, 'reason' => $e->reason];
            }
            $out([
                'mode' => $mode->value,
                'patients_total' => $count('SELECT COUNT(*) AS c FROM patient_data'),
                'patients_synthetic' => $count('SELECT COUNT(*) AS c FROM patient_data WHERE genericname1 = ? AND genericval1 = ?', [DemoSeeder::PATIENT_MARKER_NAME, $fixture->seedKey]),
                'enabled_forms' => $registry,
                'lbf_forms' => $lbf,
                'unclassified' => CoverageManifest::unclassified($registry, $lbf),
                'coverage' => $entries,
            ]);
            exit(0);
        case SeedMode::DryRun:
            $report = (new DemoSeeder($gateway, $calendar))->plan($fixture);
            $out(['mode' => $mode->value, 'would_insert' => $report->all(), 'total' => $report->totalInserted(), 'skipped_existing' => $report->skipped]);
            exit(0);
        case SeedMode::Seed:
            $markerPath = $env['OPENEMR_DEMO_SEED_MARKER'] ?? '/run/openemr-railway/ready.json';
            $raw = is_file($markerPath) ? file_get_contents($markerPath) : false;
            $marker = is_string($raw) ? json_decode($raw, true) : null;
            $values = [];
            foreach (QueryUtils::fetchRecords('SELECT gl_name, gl_value FROM globals', [], true) as $g) {
                $name = $g['gl_name'] ?? null;
                $value = $g['gl_value'] ?? null;
                if (!is_string($name) || !is_string($value)) {
                    throw new RuntimeException('Unexpected non-string globals row.');
                }
                $values[$name] = $value;
            }
            SafetyGate::assertRuntimeMarker(is_array($marker) ? $marker : null, $values);
            $report = (new DemoSeeder($gateway, $calendar))->seed($fixture);
            $verify = (new SeedVerifier($gateway))->verify($fixture);
            $out(['mode' => $mode->value, 'inserted' => $report->all(), 'total' => $report->totalInserted(), 'skipped_existing' => $report->skipped, 'verify_failures' => $verify->failures]);
            exit($verify->failures === [] ? 0 : 1);
        case SeedMode::Verify:
            $verify = (new SeedVerifier($gateway))->verify($fixture);
            ksort($verify->counts);
            $out(['mode' => $mode->value, 'counts' => $verify->counts, 'failures' => $verify->failures]);
            exit($verify->failures === [] ? 0 : 1);
    }
} catch (SeedRefusedException | SeedConflictException | InvalidFixtureException $e) {
    $fail($e->getMessage(), 2);
} catch (RuntimeException | LogicException $e) {
    // Database and gateway failures; PHP Errors propagate to OpenEMR's error handler.
    ServiceContainer::getLogger()->error('demo-seed failed', ['mode' => $mode->value, 'exception' => $e]);
    $fail('seeding failed and was rolled back; see the OpenEMR log.', 3);
}
