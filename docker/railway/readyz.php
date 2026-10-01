<?php

/**
 * Railway test server readiness gate: 200 only when startup verification has
 * completed, the site is installed and reachable, the safety globals still
 * read back as verified, and the web egress guard is active; 503 otherwise.
 * Unlike meta/health/readyz it never reports success for setup_required or
 * caught errors. Exempt from the HTTP boundary; reveals no details.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

require is_file(__DIR__ . '/railway-safety.php')
    ? __DIR__ . '/railway-safety.php'
    : '/usr/local/lib/openemr-railway/railway-safety.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');

$notReady = static function (string $reason): never {
    http_response_code(503);
    echo json_encode(['ready' => false, 'reason' => $reason]);
    exit;
};

$expected = railway_read_marker();
if ($expected === null) {
    $notReady('startup verification has not completed');
}
if (!railway_web_guard_active()) {
    $notReady('outbound network guard is not active');
}
try {
    $mismatched = railway_mismatched_settings(railway_connect(), $expected);
} catch (Throwable) {
    $notReady('database unavailable or site not configured');
}
if ($mismatched !== []) {
    $notReady('safety settings drifted');
}
echo json_encode(['ready' => true]);
