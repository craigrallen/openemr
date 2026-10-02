<?php

/**
 * SeedGateway backed by OpenEMR's own database layer (QueryUtils / ADODB).
 *
 * - Table and column names are validated against the live schema
 *   (QueryUtils::escapeTableName / escapeColumnName); values are always bound.
 * - Only INSERT and SELECT are issued (plus the core helpers the seeder needs:
 *   UuidRegistry, the `sequences` counter and Document storage, which are the
 *   same code paths the UI uses).
 * - transactional() runs the work inside QueryUtils::inTransaction() on the
 *   shared connection, so uuid_registry rows, sequence bumps and document rows
 *   roll back too. Document FILES are not transactional: when the work (or the
 *   commit) throws, the files this gateway wrote are deleted before the
 *   exception is rethrown; empty pid directories may remain. A hard crash
 *   between write and rollback can still orphan files; see docs/clinical-ui/DEMO-DATA.md.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Uuid\UuidRegistry;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Events\PatientDocuments\PatientDocumentStoreOffsite;
use RuntimeException;

final class OpenEmrSeedGateway implements SeedGateway
{
    private const IDENTIFIER = '/^[A-Za-z_][A-Za-z0-9_]{0,63}$/';

    /** @var array<string, bool> */
    private array $hasAutoIncrement = [];
    private bool $inTransaction = false;
    /** @var list<string> files written by storeDocument() in the open transaction */
    private array $writtenFiles = [];

    /** @var \Closure(): \Document */
    private readonly \Closure $documentFactory;

    /** @param (\Closure(): \Document)|null $documentFactory seam for injecting core Document failures in tests */
    public function __construct(?\Closure $documentFactory = null)
    {
        $this->documentFactory = $documentFactory ?? static fn(): \Document => new \Document();
    }

    /**
     * @template T
     * @param callable(): T $work
     * @return T
     */
    public function transactional(callable $work): mixed
    {
        if ($this->inTransaction) {
            throw new \LogicException('Nested seed transactions are not supported.');
        }
        $this->inTransaction = true;
        $this->writtenFiles = [];
        try {
            // Core commits on return and rolls back/rethrows observed failures.
            // The legacy driver does not surface every COMMIT failure; see the
            // documented test-only limitation rather than claiming acknowledgement.
            return QueryUtils::inTransaction($work);
        } catch (\Throwable $e) {
            // Document rows rolled back with the transaction; remove only the files this run wrote.
            $this->removeWrittenFiles();
            throw $e;
        } finally {
            $this->inTransaction = false;
            $this->writtenFiles = [];
        }
    }

    private function removeWrittenFiles(): void
    {
        foreach ($this->writtenFiles as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }
    }

    public function insert(string $table, array $row): int
    {
        if ($row === []) {
            throw new RuntimeException('Refusing an empty insert.');
        }
        $escapedTable = $this->table($table);
        $columns = [];
        foreach (array_keys($row) as $column) {
            $columns[] = $this->column($table, $column);
        }
        $sql = 'INSERT INTO ' . $escapedTable . ' (' . implode(', ', $columns) . ') VALUES ('
            . implode(', ', array_fill(0, count($row), '?')) . ')';
        $id = QueryUtils::sqlInsert($sql, array_values($row));
        return $this->autoIncrement($table) ? $id : 0;
    }

    public function findOne(string $table, array $criteria): ?array
    {
        [$where, $binds] = $this->where($table, $criteria);
        $rows = QueryUtils::fetchRecords('SELECT * FROM ' . $this->table($table) . $where . ' LIMIT 1', $binds, true);
        return $rows === [] ? null : $this->scalarRow($rows[0]);
    }

    public function findAll(string $table, array $criteria): array
    {
        [$where, $binds] = $this->where($table, $criteria);
        $rows = QueryUtils::fetchRecords('SELECT * FROM ' . $this->table($table) . $where, $binds, true);
        return array_map($this->scalarRow(...), $rows);
    }

    public function maxValue(string $table, string $column): int
    {
        $value = QueryUtils::fetchSingleValue(
            'SELECT COALESCE(MAX(' . $this->column($table, $column) . '), 0) AS m FROM ' . $this->table($table),
            'm',
        );
        return is_numeric($value) ? (int) $value : 0;
    }

    public function newUuid(string $table): string
    {
        $uuid = UuidRegistry::getRegistryForTable($table)->createUuid();
        if (strlen($uuid) !== 16) {
            throw new RuntimeException('UuidRegistry did not return a 16-byte uuid.');
        }
        return $uuid;
    }

    public function nextSequence(): int
    {
        $id = QueryUtils::generateId();
        if ($id <= 0) {
            throw new RuntimeException('The sequences counter did not advance.');
        }
        return $id;
    }

    public function storeDocument(int $pid, int $categoryId, string $filename, string $mimetype, string $data, int $encounter, string $docDate): int
    {
        // Core createDocument() never links an encounter and stamps docdate itself;
        // both arguments are accepted for the port but not applied (documented gap).
        $this->assertLocalDocumentStorage($mimetype);
        $document = ($this->documentFactory)();
        // Core persist() otherwise HelpfulDie()s (exit) on SQL failure, skipping rollback().
        $document->setThrowExceptionOnError(true);
        try {
            $error = $document->createDocument((string) $pid, $categoryId, $filename, $mimetype, $data);
        } catch (\Throwable $e) {
            // The file is written before the uuid/persist steps that can throw.
            $this->trackWrittenFile($document);
            throw new RuntimeException('Document storage failed.', 0, $e);
        }
        if ($error !== '') {
            // Error returns happen before the write (or name a file that already
            // existed), so the url is never ours to delete here.
            throw new RuntimeException('Document storage failed.');
        }
        $this->trackWrittenFile($document);
        $id = $document->get_id();
        if (!is_numeric($id) || (int) $id <= 0) {
            throw new RuntimeException('Document storage returned no id.');
        }
        return (int) $id;
    }

    private function trackWrittenFile(\Document $document): void
    {
        // The name is a drive uuid freshly registered in uuid_registry by this call.
        $url = $document->get_url();
        if (is_string($url) && str_starts_with($url, 'file://') && is_file(substr($url, 7))) {
            $this->writtenFiles[] = substr($url, 7);
        }
    }

    /**
     * Seeded documents go to the local filesystem only: no CouchDB, no offsite
     * listener, no ATNA audit egress, and no image thumbnails (whose failure
     * paths return after the main file is written).
     */
    private function assertLocalDocumentStorage(string $mimetype): void
    {
        $globals = OEGlobalsBag::getInstance();
        if (
            $globals->getInt('document_storage_method') !== \Document::STORAGE_METHOD_FILESYSTEM
            || $globals->getBoolean('documentStoredRemotely')
            || $globals->getBoolean('enable_atna_audit')
            || $globals->getKernel()->getEventDispatcher()->hasListeners(PatientDocumentStoreOffsite::REMOTE_STORAGE_LOCATION)
            || str_starts_with(strtolower($mimetype), 'image/')
        ) {
            throw new RuntimeException('Refusing document storage: only local filesystem storage of non-image documents is allowed.');
        }
    }

    private function table(string $table): string
    {
        if (preg_match(self::IDENTIFIER, $table) !== 1) {
            throw new RuntimeException('Unsafe table identifier.');
        }
        return QueryUtils::escapeTableName($table);
    }

    private function column(string $table, string $column): string
    {
        if (preg_match(self::IDENTIFIER, $column) !== 1) {
            throw new RuntimeException('Unsafe column identifier.');
        }
        $escaped = QueryUtils::escapeColumnName($column, [$table]);
        if ($escaped === '') {
            throw new RuntimeException("Column {$table}.{$column} does not exist in this schema.");
        }
        return $escaped; // already backtick-quoted and whitelisted against the table
    }

    private function autoIncrement(string $table): bool
    {
        return $this->hasAutoIncrement[$table] ??= QueryUtils::listAutoIncrementColumns($table) !== [];
    }

    /**
     * @param array<string, scalar|null> $criteria
     * @return array{string, list<scalar>}
     */
    private function where(string $table, array $criteria): array
    {
        $clauses = [];
        $binds = [];
        foreach ($criteria as $column => $value) {
            if ($value === null) {
                $clauses[] = $this->column($table, $column) . ' IS NULL';
                continue;
            }
            $clauses[] = $this->column($table, $column) . ' = ?';
            $binds[] = $value;
        }
        return [$clauses === [] ? '' : ' WHERE ' . implode(' AND ', $clauses), $binds];
    }

    /**
     * @param array<mixed> $row
     * @return array<string, scalar|null>
     */
    private function scalarRow(array $row): array
    {
        $out = [];
        foreach ($row as $key => $value) {
            $out[(string) $key] = is_scalar($value) || $value === null ? $value : null;
        }
        return $out;
    }
}
