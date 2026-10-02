<?php

/**
 * Transactional in-memory SeedGateway for isolated seeder tests.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Demo\Seed;

use OpenEMR\Demo\Seed\SeedGateway;
use RuntimeException;

final class InMemorySeedGateway implements SeedGateway
{
    private const AUTO_ID = [
        'patient_data' => 'id', 'form_encounter' => 'id', 'forms' => 'id', 'openemr_postcalendar_events' => 'pc_eid',
        'lists' => 'id', 'issue_encounter' => 'id', 'prescriptions' => 'id', 'procedure_providers' => 'ppid',
        'procedure_type' => 'procedure_type_id', 'procedure_order' => 'procedure_order_id',
        'procedure_report' => 'procedure_report_id', 'procedure_result' => 'procedure_result_id',
        'documents' => 'id', 'insurance_companies' => 'id', 'insurance_data' => 'id', 'billing' => 'id',
        'ar_session' => 'session_id', 'payments' => 'id', 'pnotes' => 'id', 'onotes' => 'id', 'form_vitals' => 'id',
        'form_soap' => 'id', 'form_ros' => 'id', 'form_reviewofs' => 'id', 'form_clinical_notes' => 'id',
        'form_observation' => 'id', 'form_clinical_instructions' => 'id', 'form_dictation' => 'id',
        'form_misc_billing_options' => 'id', 'history_data' => 'id', 'transactions' => 'id', 'immunizations' => 'id',
        'users' => 'id', 'facility' => 'id',
    ];

    /** @var array<string, list<array<string, scalar|null>>> */
    private array $tables = [];
    /** Pre-existing deployment reference data (mirrors the Railway inventory); excluded from tableCounts(). */
    private array $reference = [];
    /** @var list<array<string, list<array<string, scalar|null>>>> */
    private array $snapshots = [];
    private int $sequence = 0;
    private int $inserts = 0;
    public int $openTransactions = 0;
    public int $failOnInsertNumber = 0;

    public function __construct()
    {
        $cats = ['no_show' => [1, 0], 'in_office' => [2, 0], 'out_of_office' => [3, 0], 'vacation' => [4, 0],
            'office_visit' => [5, 900], 'holidays' => [6, 86400], 'closed' => [7, 86400], 'lunch' => [8, 3600],
            'established_patient' => [9, 900], 'new_patient' => [10, 1800], 'reserved' => [11, 900],
            'health_and_behavioral_assessment' => [12, 900], 'preventive_care_services' => [13, 900],
            'ophthalmological_services' => [14, 900]];
        foreach ($cats as $constant => [$id, $duration]) {
            $this->reference['openemr_postcalendar_categories'][] = ['pc_catid' => $id, 'pc_constant_id' => $constant, 'pc_duration' => $duration];
        }
        foreach (['Lab Report' => 2, 'Medical Record' => 3, 'Patient Information' => 4, 'Patient Photograph' => 10] as $name => $id) {
            $this->reference['categories'][] = ['id' => $id, 'name' => $name];
        }
        foreach (['refer_date', 'refer_from', 'refer_to', 'body', 'refer_diag'] as $field) {
            $this->reference['layout_options'][] = ['form_id' => 'LBTref', 'field_id' => $field];
        }
        foreach (['LBTptreq', 'LBTphreq', 'LBTlegal', 'LBTbill'] as $form) {
            $this->reference['layout_options'][] = ['form_id' => $form, 'field_id' => 'body'];
        }
    }

    public function begin(): void
    {
        $this->snapshots[] = $this->tables;
        $this->openTransactions++;
    }

    public function commit(): void
    {
        array_pop($this->snapshots);
        $this->openTransactions--;
    }

    public function rollback(): void
    {
        $this->tables = array_pop($this->snapshots) ?? [];
        $this->openTransactions--;
    }

    public function insert(string $table, array $row): int
    {
        $this->inserts++;
        if ($this->failOnInsertNumber > 0 && $this->inserts === $this->failOnInsertNumber) {
            throw new RuntimeException('injected failure');
        }
        $id = 0;
        $idColumn = self::AUTO_ID[$table] ?? null;
        if ($idColumn !== null && !isset($row[$idColumn])) {
            $id = count($this->tables[$table] ?? []) + 1;
            $row[$idColumn] = $id;
        }
        $this->tables[$table][] = $row;
        return $id;
    }

    public function findOne(string $table, array $criteria): ?array
    {
        return $this->findAll($table, $criteria)[0] ?? null;
    }

    public function findAll(string $table, array $criteria): array
    {
        return array_values(array_filter(
            $this->tables[$table] ?? $this->reference[$table] ?? [],
            static function (array $row) use ($criteria): bool {
                foreach ($criteria as $column => $value) {
                    if (!array_key_exists($column, $row) || (string) $row[$column] !== (string) $value) {
                        return false;
                    }
                }
                return true;
            }
        ));
    }

    public function maxValue(string $table, string $column): int
    {
        $values = array_map(static fn(array $r): int => (int) ($r[$column] ?? 0), $this->tables[$table] ?? []);
        return $values === [] ? 0 : max($values);
    }

    public function newUuid(string $table): string
    {
        return random_bytes(16);
    }

    public function nextSequence(): int
    {
        return ++$this->sequence;
    }

    public function storeDocument(int $pid, int $categoryId, string $filename, string $mimetype, string $data, int $encounter, string $docDate): int
    {
        $id = $this->maxValue('documents', 'id') + 1;
        $this->insert('documents', ['id' => $id, 'foreign_id' => $pid, 'name' => $filename, 'mimetype' => $mimetype,
            'size' => strlen($data), 'encounter_id' => $encounter, 'docdate' => $docDate, 'url' => "memory://{$pid}/{$filename}"]);
        $this->insert('categories_to_documents', ['category_id' => $categoryId, 'document_id' => $id]);
        return $id;
    }

    /** Test-only mutation: remove rows matching $criteria (all rows when empty). */
    public function deleteWhere(string $table, array $criteria = []): void
    {
        $this->tables[$table] = array_values(array_filter(
            $this->tables[$table] ?? [],
            static fn(array $row): bool => $criteria !== [] && array_diff_assoc(array_map('strval', $criteria), array_map('strval', array_intersect_key($row, $criteria))) !== [],
        ));
    }

    /** Test-only mutation: set $values on rows matching $criteria. */
    public function updateWhere(string $table, array $criteria, array $values): void
    {
        foreach ($this->tables[$table] ?? [] as $i => $row) {
            if (array_diff_assoc(array_map('strval', $criteria), array_map('strval', array_intersect_key($row, $criteria))) === []) {
                $this->tables[$table][$i] = $values + $row;
            }
        }
    }

    /** @return list<array<string, scalar|null>> */
    public function rows(string $table): array
    {
        return $this->tables[$table] ?? [];
    }

    /** @return array<string, int> */
    public function tableCounts(): array
    {
        $counts = array_map('count', $this->tables);
        ksort($counts);
        return $counts;
    }
}
