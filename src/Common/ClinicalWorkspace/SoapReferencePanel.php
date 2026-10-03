<?php

/**
 * Template context for the SOAP editor's optional previous-notes panel.
 *
 * soapReference holds same-patient earlier notes; soapCopyAllowed is the
 * only signal that lets the panel offer "copy to draft", and is true only
 * when the note being edited is known to be unlocked. The current encounter
 * is the saved note's own encounter, or the session encounter for a new
 * note. The panel is optional: a runtime exception (such as a database read
 * failure) degrades it to "unavailable" with copy denied and never prevents
 * the editor itself from rendering. Errors and other defects propagate.
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
use OpenEMR\Common\Forms\EncounterFormAccess;
use Psr\Log\LoggerInterface;

/**
 * @phpstan-import-type SoapReferenceResult from SoapReference
 * @phpstan-type SoapReferencePanelContext array{soapReference: SoapReferenceResult, soapCopyAllowed: bool}
 */
final readonly class SoapReferencePanel
{
    /**
     * @param \Closure(int): (array{pid: int, encounter: int}|null) $findOwner Owner of a saved SOAP form; throws on read failure
     */
    public function __construct(
        private \Closure $findOwner,
        private SoapReference $reference,
        private SoapCopyEligibility $copyEligibility,
        private LoggerInterface $logger,
    ) {
    }

    /**
     * Every read goes through the throwing QueryUtils path (fetchFormOwner
     * uses querySingleRow), so a database error reaches the catch below.
     */
    public static function fromRuntime(): self
    {
        return new self(
            static fn (int $formId): ?array => EncounterFormAccess::fetchFormOwner($formId, 'soap'),
            SoapReference::fromRuntime(),
            SoapCopyEligibility::fromRuntime(),
            ServiceContainer::getLogger(),
        );
    }

    /**
     * @param int $pid              Validated session patient
     * @param int $sessionEncounter Session encounter, used for a new note
     * @param int $formId           form_soap id being edited (0 for a new note)
     *
     * @return SoapReferencePanelContext
     */
    public function context(int $pid, int $sessionEncounter, int $formId): array
    {
        try {
            $encounter = $sessionEncounter;
            if ($formId > 0) {
                $owner = ($this->findOwner)($formId);
                if ($owner === null || $owner['pid'] !== $pid) {
                    return self::unavailable();
                }
                $encounter = $owner['encounter'];
            }

            return [
                'soapReference' => $this->reference->forPatient($pid, $encounter, $formId),
                'soapCopyAllowed' => $this->copyEligibility->allowsCopy($pid, $encounter, $formId),
            ];
        } catch (\RuntimeException $e) {
            $this->logger->error('SOAP reference panel could not be prepared', ['exception' => $e]);
            return self::unavailable();
        }
    }

    /**
     * @return SoapReferencePanelContext
     */
    public static function unavailable(): array
    {
        return [
            'soapReference' => ['status' => 'unavailable', 'withheld' => false, 'notes' => []],
            'soapCopyAllowed' => false,
        ];
    }
}
