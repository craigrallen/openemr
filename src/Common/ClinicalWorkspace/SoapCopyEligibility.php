<?php

/**
 * Server-side decision on whether the SOAP reference may offer "copy to draft".
 *
 * Copy is offered only when the note being edited is positively known to be
 * unlocked under the existing ESign policy: the encounter lock for a new note,
 * and the encounter plus the saved form's own lock (keyed by forms.id) for a
 * saved note. Ambiguous ownership, a lookup failure or a lock-check failure
 * all deny. This only reads lock state; it never signs or locks anything.
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
use OpenEMR\Common\Database\QueryUtils;
use Psr\Log\LoggerInterface;

final readonly class SoapCopyEligibility
{
    /**
     * @param \Closure(int): list<array<mixed>> $findSoapFormRows   forms rows (id, pid, encounter) for a form_soap id
     * @param \Closure(int): bool               $isEncounterLocked  ESign encounter lock
     * @param \Closure(int, int): bool          $isFormLocked       ESign form lock by forms.id and encounter
     */
    public function __construct(
        private \Closure $findSoapFormRows,
        private \Closure $isEncounterLocked,
        private \Closure $isFormLocked,
        private LoggerInterface $logger,
    ) {
    }

    /**
     * Wired to the same ESign lock rules forms.php applies, read through the
     * throwing query path so a database error denies copy instead of ending
     * the request.
     */
    public static function fromRuntime(): self
    {
        $locks = SoapLockState::fromRuntime();

        return new self(
            static fn (int $formId): array => QueryUtils::fetchRecords(
                "SELECT id, pid, encounter FROM forms WHERE form_id = ? AND formdir = 'soap' AND deleted = 0 LIMIT 2",
                [$formId],
            ),
            $locks->isEncounterLocked(...),
            $locks->isFormLocked(...),
            ServiceContainer::getLogger(),
        );
    }

    /**
     * @param int $pid       Validated session patient
     * @param int $encounter Encounter of the note being edited
     * @param int $formId    form_soap id being edited (0 for a new note)
     */
    public function allowsCopy(int $pid, int $encounter, int $formId): bool
    {
        if ($pid <= 0 || $encounter <= 0 || $formId < 0) {
            return false;
        }

        try {
            $formsRowId = null;
            if ($formId > 0) {
                $formsRowId = $this->ownedFormsRowId($pid, $encounter, $formId);
                if ($formsRowId === null) {
                    return false;
                }
            }
            if (($this->isEncounterLocked)($encounter) !== false) {
                return false;
            }

            return $formsRowId === null || ($this->isFormLocked)($formsRowId, $encounter) === false;
        } catch (\RuntimeException $e) {
            $this->logger->error('SOAP reference copy eligibility could not be determined', ['exception' => $e]);
            return false;
        }
    }

    private function ownedFormsRowId(int $pid, int $encounter, int $formId): ?int
    {
        $rows = ($this->findSoapFormRows)($formId);
        if (count($rows) !== 1) {
            return null;
        }
        $row = $rows[0];
        $id = SoapRowValue::positiveInt($row['id'] ?? null);
        if (
            $id === null
            || SoapRowValue::positiveInt($row['pid'] ?? null) !== $pid
            || SoapRowValue::positiveInt($row['encounter'] ?? null) !== $encounter
        ) {
            return null;
        }

        return $id;
    }
}
