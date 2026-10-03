<?php

/**
 * ESign lock state for the SOAP reference, read through the throwing query path.
 *
 * Applies the same rules and SQL as the ESign Encounter and Form Signable
 * isLocked() checks, which read through sqlQuery() and so end the request on
 * a database error. Reading through QueryUtils instead lets a failure reach
 * the caller's catch and deny copy. Read-only: it never signs or locks.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Common\ClinicalWorkspace;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Core\OEGlobalsBag;

final readonly class SoapLockState
{
    /** Latest lock signature for a signable row, as DbRow_Signable::isLocked() reads it. */
    private const LOCK_SQL = 'SELECT E.is_lock FROM esign_signatures E'
        . ' WHERE E.tid = ? AND E.table = ? AND E.is_lock = ?'
        . ' ORDER BY E.datetime DESC LIMIT 1';

    /** SignatureIF::ESIGN_LOCK */
    private const ESIGN_LOCK = 1;

    /**
     * @param \Closure(string, list<int|string>): list<array<mixed>> $fetch Throwing parameterized read
     * @param bool $lockEncounters      lock_esign_all
     * @param bool $lockIndividualForms lock_esign_individual
     */
    public function __construct(
        private \Closure $fetch,
        private bool $lockEncounters,
        private bool $lockIndividualForms,
    ) {
    }

    public static function fromRuntime(): self
    {
        $globals = OEGlobalsBag::getInstance();

        return new self(
            static fn (string $sql, array $binds): array => QueryUtils::fetchRecords($sql, $binds),
            $globals->getBoolean('lock_esign_all'),
            $globals->getBoolean('lock_esign_individual'),
        );
    }

    /**
     * Encounter_Signable::isLocked(): only when encounter locking is enabled.
     */
    public function isEncounterLocked(int $encounter): bool
    {
        return $this->lockEncounters && $this->hasLock($encounter, 'form_encounter');
    }

    /**
     * Form_Signable::isLocked(): the form's own lock (keyed by forms.id) when
     * individual locking is enabled, otherwise its encounter's lock.
     */
    public function isFormLocked(int $formsRowId, int $encounter): bool
    {
        return ($this->lockIndividualForms && $this->hasLock($formsRowId, 'forms'))
            || $this->isEncounterLocked($encounter);
    }

    private function hasLock(int $tableId, string $table): bool
    {
        // The query only returns lock rows, so any row means locked.
        return ($this->fetch)(self::LOCK_SQL, [$tableId, $table, self::ESIGN_LOCK]) !== [];
    }
}
