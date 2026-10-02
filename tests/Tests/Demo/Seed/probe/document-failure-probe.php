<?php

/**
 * Subprocess probe for OpenEmrSeedGatewayDocumentTest. Bootstraps OpenEMR the
 * same way demo-seed.php does, injects a core Document whose persist() fails
 * AFTER the file is written inside OpenEmrSeedGateway::transactional(), and
 * reports DB/file state as JSON. All writes happen inside a rolled-back transaction.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Demo\Seed\OpenEmrSeedGateway;

if (PHP_SAPI !== 'cli' || getenv('DEMO_SEED_CONTAINER_TEST') !== 'disposable-local') {
    fwrite(STDERR, "refused\n");
    exit(2);
}
$_GET['site'] = 'default';
$ignoreAuth = true;
$sessionAllowWrite = true;
require_once dirname(__DIR__, 5) . '/interface/globals.php';

$bag = OEGlobalsBag::getInstance();
$oerConfig = $bag->get('oer_config');
$repo = is_array($oerConfig) && is_array($oerConfig['documents'] ?? null) ? ($oerConfig['documents']['repository'] ?? null) : null;
if (!is_string($repo) || !is_dir($repo)) {
    fwrite(STDERR, "document repository is not configured\n");
    exit(1);
}
/** @return list<string> */
$files = static function () use ($repo): array {
    $out = [];
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($repo, FilesystemIterator::SKIP_DOTS)) as $f) {
        if (!$f instanceof SplFileInfo) {
            throw new UnexpectedValueException('Directory iterator yielded a non-file entry.');
        }
        $out[] = $f->getPathname();
    }
    sort($out);
    return $out;
};
// Null (no row) reads as 0; anything other than an integer or digit string is an error.
$toInt = static function (mixed $value): int {
    if ($value === null) {
        return 0;
    }
    if (is_int($value)) {
        return $value;
    }
    if (is_string($value) && ctype_digit($value)) {
        return (int) $value;
    }
    throw new UnexpectedValueException('Expected an integer column value.');
};
$count = static fn(string $t): int => $toInt(QueryUtils::fetchSingleValue("SELECT COUNT(*) AS c FROM `{$t}`", 'c', []));
$pid = $toInt(QueryUtils::fetchSingleValue("SELECT pid FROM patient_data WHERE pubpid LIKE 'SYNTH-DEMO-%' ORDER BY pid LIMIT 1", 'pid', []));
$category = $toInt(QueryUtils::fetchSingleValue("SELECT id FROM categories WHERE name = 'Medical Record'", 'id', []));

$sentinel = $repo . 'demo-seed-probe-preexisting.txt';
file_put_contents($sentinel, 'preexisting');
$before = ['documents' => $count('documents'), 'categories_to_documents' => $count('categories_to_documents'), 'uuid_registry' => $count('uuid_registry'), 'files' => $files()];

$result = ['pid' => $pid, 'category' => $category, 'threw' => false, 'previous' => null, 'files_during' => null];
$failing = static fn(): \Document => new class extends \Document {
    public function persist(mixed $fid = ""): mixed
    {
        throw new \RuntimeException('injected persist failure after file write');
    }
};
// transactional() rolls the DB back and deletes the files it wrote before rethrowing,
// so the written-file count is captured inside the work, before that cleanup runs.
$gateway = new OpenEmrSeedGateway($failing);
try {
    $gateway->transactional(static function () use ($gateway, $pid, $category, $files, $before, &$result): void {
        try {
            $gateway->storeDocument($pid, $category, 'SYNTHETIC-probe.txt', 'text/plain', 'SYNTHETIC probe', 0, '');
        } finally {
            $result['files_during'] = count($files()) - count($before['files']);
        }
        // Unexpected success: still roll back (no 'previous', so the test fails).
        throw new RuntimeException('probe: storeDocument did not fail');
    });
} catch (RuntimeException $e) {
    $result['threw'] = true;
    $result['previous'] = $e->getPrevious()?->getMessage();
}

// Remote/CouchDB storage must be refused before anything is written.
$method = $bag->get('document_storage_method');
$bag->set('document_storage_method', \Document::STORAGE_METHOD_COUCHDB);
$stored = false;
$gateway = new OpenEmrSeedGateway();
try {
    $gateway->transactional(static function () use ($gateway, $pid, $category, &$stored): void {
        $gateway->storeDocument($pid, $category, 'SYNTHETIC-probe2.txt', 'text/plain', 'SYNTHETIC probe', 0, '');
        $stored = true;
        // Unexpected success: force the rollback so nothing is committed.
        throw new RuntimeException('probe: CouchDB storage was not refused');
    });
} catch (RuntimeException) {
    // Refused only if the throw came from storeDocument, not from the forced rollback.
} finally {
    $bag->set('document_storage_method', $method);
}

$result['couch_refused'] = !$stored;

$after = ['documents' => $count('documents'), 'categories_to_documents' => $count('categories_to_documents'), 'uuid_registry' => $count('uuid_registry'), 'files' => $files()];
$result['before'] = $before;
$result['after'] = $after;
$result['sentinel_intact'] = is_file($sentinel) && file_get_contents($sentinel) === 'preexisting';
unlink($sentinel);
echo json_encode($result), "\n";
