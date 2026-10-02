<?php

/**
 * Subprocess probe for OpenEmrSeedGatewayDocumentTest. Bootstraps OpenEMR the
 * same way demo-seed.php does, injects a core Document whose persist() fails
 * AFTER the file is written, rolls the gateway transaction back and reports
 * DB/file state as JSON. All writes happen inside a rolled-back transaction.
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

$repo = OEGlobalsBag::getInstance()->get('oer_config')['documents']['repository'];
$files = static function () use ($repo): array {
    $out = [];
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($repo, FilesystemIterator::SKIP_DOTS)) as $f) {
        $out[] = (string) $f;
    }
    sort($out);
    return $out;
};
$count = static fn(string $t): int => (int) QueryUtils::fetchSingleValue("SELECT COUNT(*) AS c FROM `{$t}`", 'c', []);
$pid = (int) QueryUtils::fetchSingleValue("SELECT pid FROM patient_data WHERE pubpid LIKE 'SYNTH-DEMO-%' ORDER BY pid LIMIT 1", 'pid', []);
$category = (int) QueryUtils::fetchSingleValue("SELECT id FROM categories WHERE name = 'Medical Record'", 'id', []);

$sentinel = $repo . 'demo-seed-probe-preexisting.txt';
file_put_contents($sentinel, 'preexisting');
$before = ['documents' => $count('documents'), 'categories_to_documents' => $count('categories_to_documents'), 'uuid_registry' => $count('uuid_registry'), 'files' => $files()];

$result = ['pid' => $pid, 'category' => $category];
$failing = static fn(): \Document => new class extends \Document {
    public function persist($fid = ""): mixed
    {
        throw new \RuntimeException('injected persist failure after file write');
    }
};
$gateway = new OpenEmrSeedGateway($failing);
$gateway->begin();
try {
    $gateway->storeDocument($pid, $category, 'SYNTHETIC-probe.txt', 'text/plain', 'SYNTHETIC probe', 0, '');
    $result['threw'] = false;
} catch (\Throwable $e) {
    $result['threw'] = true;
    $result['previous'] = $e->getPrevious()?->getMessage();
}
$result['files_during'] = count($files()) - count($before['files']);
$gateway->rollback();

// Remote/CouchDB storage must be refused before anything is written.
$bag = OEGlobalsBag::getInstance();
$method = $bag->get('document_storage_method');
$bag->set('document_storage_method', \Document::STORAGE_METHOD_COUCHDB);
$gateway = new OpenEmrSeedGateway();
$gateway->begin();
try {
    $gateway->storeDocument($pid, $category, 'SYNTHETIC-probe2.txt', 'text/plain', 'SYNTHETIC probe', 0, '');
    $result['couch_refused'] = false;
} catch (\Throwable) {
    $result['couch_refused'] = true;
}
$gateway->rollback();
$bag->set('document_storage_method', $method);

$after = ['documents' => $count('documents'), 'categories_to_documents' => $count('categories_to_documents'), 'uuid_registry' => $count('uuid_registry'), 'files' => $files()];
$result['before'] = $before;
$result['after'] = $after;
$result['sentinel_intact'] = is_file($sentinel) && file_get_contents($sentinel) === 'preexisting';
unlink($sentinel);
echo json_encode($result), "\n";
