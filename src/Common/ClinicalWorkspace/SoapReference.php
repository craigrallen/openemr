<?php

/**
 * Read-only reference to the same patient's previous SOAP notes.
 *
 * Shown beside the SOAP editor as reference only: nothing here writes, and
 * every state other than an authorized result fails closed so a permission or
 * query failure, or any malformed or mismatched row, is never presented as
 * "no earlier notes".
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Common\ClinicalWorkspace;

use OpenEMR\BC\ServiceContainer;
use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use Psr\Log\LoggerInterface;

/**
 * @phpstan-type SoapSections array{subjective: string, objective: string, assessment: string, plan: string}
 * @phpstan-type SoapReferenceNote array{encounter: int, date: string, sections: SoapSections}
 * @phpstan-type SoapReferenceResult array{
 *     status: 'available'|'none'|'denied'|'unavailable',
 *     withheld: bool,
 *     notes: list<SoapReferenceNote>,
 * }
 */
final readonly class SoapReference
{
    public const MAX_NOTES = 5;

    private const SECTIONS = ['subjective', 'objective', 'assessment', 'plan'];

    /**
     * Every join repeats the patient so a row can only come from that patient's
     * encounter and form. Notes dated after the current encounter are excluded;
     * with no current encounter row the bound is the present. The candidate
     * limit is a constant: it leaves room for sensitivity-withheld rows while
     * keeping the read bounded.
     */
    private const SQL = 'SELECT f.pid, f.encounter, fe.date AS encounter_date, fe.sensitivity,'
        . ' s.subjective, s.objective, s.assessment, s.plan'
        . ' FROM forms AS f'
        . ' INNER JOIN form_soap AS s ON s.id = f.form_id AND s.pid = f.pid'
        . ' INNER JOIN form_encounter AS fe ON fe.encounter = f.encounter AND fe.pid = f.pid'
        . " WHERE f.pid = ? AND f.formdir = 'soap' AND f.deleted = 0"
        . ' AND f.encounter <> ? AND f.form_id <> ?'
        . ' AND fe.date <= COALESCE((SELECT cur.date FROM form_encounter AS cur'
        . ' WHERE cur.pid = ? AND cur.encounter = ?), NOW())'
        . ' ORDER BY fe.date DESC, f.encounter DESC, f.id DESC'
        . ' LIMIT 25';

    /**
     * @param \Closure(string, list<int>): list<array<mixed>> $fetch       Parameterized read
     * @param \Closure(): bool                                 $canViewSoap Form ACL for the soap form
     * @param \Closure(string): bool                           $canViewSensitivity Encounter sensitivity ACL
     */
    public function __construct(
        private \Closure $fetch,
        private \Closure $canViewSoap,
        private \Closure $canViewSensitivity,
        private LoggerInterface $logger,
    ) {
    }

    /**
     * Wired to the real database and the same ACL checks load_form.php and
     * view_form.php apply before an encounter form is shown. The form ACL is
     * AclMain::aclCheckForm('soap') with its registry read moved to the
     * throwing query path: aclCheckForm() reads through sqlQuery(), which
     * ends the request on a database error instead of throwing.
     */
    public static function fromRuntime(): self
    {
        return new self(
            static fn (string $sql, array $binds): array => QueryUtils::fetchRecords($sql, $binds),
            static function (): bool {
                $registry = QueryUtils::querySingleRow('SELECT aco_spec FROM registry WHERE directory = ?', ['soap']);
                // As in aclCheckForm(): no registry row or no aco_spec means no form ACO applies.
                return AclMain::aclCheckAcoSpec(is_array($registry) ? ($registry['aco_spec'] ?? null) : null);
            },
            static fn (string $sensitivity): bool => AclMain::aclCheckCore('sensitivities', $sensitivity),
            ServiceContainer::getLogger(),
        );
    }

    /**
     * @param int $pid              Validated session patient
     * @param int $currentEncounter Encounter of the note being edited (0 when none)
     * @param int $currentFormId    SOAP form being edited (0 for a new note)
     *
     * @return SoapReferenceResult
     */
    public function forPatient(int $pid, int $currentEncounter, int $currentFormId): array
    {
        if ($pid <= 0 || $currentEncounter < 0 || $currentFormId < 0) {
            return self::result('unavailable');
        }

        try {
            if (($this->canViewSoap)() !== true) {
                return self::result('denied');
            }
            $rows = ($this->fetch)(
                self::SQL,
                [$pid, $currentEncounter, $currentFormId, $pid, $currentEncounter],
            );

            // Parse every row of the bounded result before using any: one
            // untrustworthy row means the whole source is untrustworthy.
            $parsed = [];
            foreach ($rows as $row) {
                $entry = $this->parseRow($row, $pid, $currentEncounter);
                if ($entry === null) {
                    return self::result('unavailable');
                }
                $parsed[] = $entry;
            }

            $notes = [];
            $withheld = false;
            foreach ($parsed as [$note, $sensitivity]) {
                if (count($notes) >= self::MAX_NOTES) {
                    break;
                }
                // Same rule as view_form.php: NULL or '' needs no sensitivity ACL.
                if ($sensitivity !== null && $sensitivity !== '' && ($this->canViewSensitivity)($sensitivity) !== true) {
                    $withheld = true;
                    continue;
                }
                $notes[] = $note;
            }
        } catch (\RuntimeException $e) {
            $this->logger->error('Previous SOAP reference could not be loaded', ['exception' => $e]);
            return self::result('unavailable');
        }

        if ($notes === []) {
            return self::result($withheld ? 'denied' : 'none', $withheld);
        }

        return ['status' => 'available', 'withheld' => $withheld, 'notes' => $notes];
    }

    /**
     * Every column the query selects must be present with its schema type.
     * Clinical sections are nullable TEXT, so NULL reads as empty; ids and the
     * encounter date are required. Returns null for anything else.
     *
     * @param array<mixed> $row
     *
     * @return array{SoapReferenceNote, ?string}|null
     */
    private function parseRow(array $row, int $pid, int $currentEncounter): ?array
    {
        $rowPid = SoapRowValue::positiveInt($row['pid'] ?? null);
        $encounter = SoapRowValue::positiveInt($row['encounter'] ?? null);
        $date = SoapRowValue::sqlDate($row['encounter_date'] ?? null);
        if ($rowPid === null || $encounter === null || $date === null) {
            $this->logger->warning('Previous SOAP reference received a malformed row');
            return null;
        }
        if ($rowPid !== $pid || $encounter === $currentEncounter) {
            // The query already excludes these; seeing one means the source is wrong.
            $this->logger->warning('Previous SOAP reference received a row outside its scope');
            return null;
        }
        if (!array_key_exists('sensitivity', $row)) {
            return null;
        }
        $sensitivity = $row['sensitivity'];
        if ($sensitivity !== null && !is_string($sensitivity)) {
            return null;
        }

        $sections = [];
        foreach (self::SECTIONS as $name) {
            if (!array_key_exists($name, $row)) {
                return null;
            }
            $text = $row[$name];
            if ($text !== null && !is_string($text)) {
                return null;
            }
            $sections[$name] = $text ?? '';
        }

        return [['encounter' => $encounter, 'date' => $date, 'sections' => $sections], $sensitivity];
    }

    /**
     * @param 'available'|'none'|'denied'|'unavailable' $status
     *
     * @return SoapReferenceResult
     */
    private static function result(string $status, bool $withheld = false): array
    {
        return ['status' => $status, 'withheld' => $withheld, 'notes' => []];
    }
}
