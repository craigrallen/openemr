<?php

/**
 * Railway test server: apply the mail/SMS/payment safety globals, read them
 * back, and only then write the readiness marker. Run by railway-serve.sh as
 * root before Apache starts; a non-zero exit keeps Apache down. Prints
 * setting names only, never database details.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

require __DIR__ . '/railway-safety.php';

$expected = [];
foreach (preg_split('/\s+/', trim(railway_env('RAILWAY_SAFETY_SETTINGS', ''))) ?: [] as $pair) {
    $parts = explode('=', $pair, 2);
    if (count($parts) === 2 && $parts[0] !== '') {
        $expected[$parts[0]] = $parts[1];
    }
}
if ($expected === []) {
    fwrite(STDERR, "safety verification failed: no safety settings supplied\n");
    exit(1);
}

try {
    $db = railway_connect();
    railway_apply_settings($db, $expected);
    $mismatched = railway_mismatched_settings($db, $expected);
} catch (Throwable) {
    fwrite(STDERR, "safety verification failed: database unavailable or site not configured\n");
    exit(1);
}
if ($mismatched !== []) {
    fwrite(STDERR, 'safety verification failed for: ' . implode(', ', $mismatched) . "\n");
    exit(1);
}

$marker = railway_marker_path();
if (!is_dir(dirname($marker)) && !mkdir(dirname($marker), 0755, true)) {
    fwrite(STDERR, "safety verification failed: cannot create readiness marker directory\n");
    exit(1);
}
$tmp = $marker . '.tmp';
$json = json_encode(['settings' => $expected, 'verified_at' => gmdate('c')], JSON_THROW_ON_ERROR);
if (file_put_contents($tmp, $json) === false || !chmod($tmp, 0644) || !rename($tmp, $marker)) {
    fwrite(STDERR, "safety verification failed: cannot write readiness marker\n");
    exit(1);
}
echo 'safety verified: ' . implode(', ', array_keys($expected)) . "\n";
