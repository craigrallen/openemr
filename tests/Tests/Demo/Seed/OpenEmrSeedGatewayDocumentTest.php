<?php

/**
 * Regression: a core Document failure after the file is written must roll back
 * both the database rows and the newly written file, leave preexisting files
 * alone, and non-local document storage must be refused. Runs a probe in a
 * subprocess against a DISPOSABLE database; every write is rolled back.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Demo\Seed;

use PHPUnit\Framework\TestCase;

final class OpenEmrSeedGatewayDocumentTest extends TestCase
{
    public function testFailureAfterFileWriteRollsBackRowsAndOwnFileOnly(): void
    {
        if (getenv('DEMO_SEED_CONTAINER_TEST') !== 'disposable-local') {
            self::markTestSkipped('Set DEMO_SEED_CONTAINER_TEST=disposable-local to run against a disposable database.');
        }
        $output = shell_exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/probe/document-failure-probe.php') . ' 2>&1');
        $r = json_decode(is_string($output) ? trim((string) strrchr("\n" . trim($output), "\n")) : '', true);
        self::assertIsArray($r, 'probe output: ' . (string) $output);
        self::assertGreaterThan(0, $r['pid'], 'needs one seeded synthetic patient');
        self::assertTrue($r['threw'], 'injected persist failure must surface as an exception');
        self::assertSame('injected persist failure after file write', $r['previous']);
        self::assertSame(1, $r['files_during'], 'the file must have been written before the failure');
        self::assertSame($r['before'], $r['after'], 'rows, uuid_registry and files must all be restored');
        self::assertTrue($r['sentinel_intact'], 'preexisting repository file must be untouched');
        self::assertTrue($r['couch_refused'], 'non-filesystem storage must be refused');
    }
}
