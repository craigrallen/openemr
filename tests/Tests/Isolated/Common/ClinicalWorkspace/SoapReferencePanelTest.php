<?php

/**
 * Isolated tests for the SOAP editor's optional reference panel context.
 *
 * The panel is optional: whatever fails while preparing it must come back
 * as an "unavailable" panel with copy denied, never as an exception that
 * would stop the SOAP editor from rendering. All rows are synthetic.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Common\ClinicalWorkspace;

use OpenEMR\Common\ClinicalWorkspace\SoapCopyEligibility;
use OpenEMR\Common\ClinicalWorkspace\SoapReference;
use OpenEMR\Common\ClinicalWorkspace\SoapReferencePanel;
use OpenEMR\Common\Database\SqlQueryException;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

final class SoapReferencePanelTest extends TestCase
{
    /** @var list<string> */
    private array $calls = [];

    /**
     * @param array{pid: int, encounter: int}|\Throwable|null $owner
     */
    private function panel(
        array|\Throwable|null $owner = ['pid' => 7, 'encounter' => 300],
        ?\Throwable $referenceFailure = null,
        ?\Throwable $lockFailure = null,
    ): SoapReferencePanel {
        $this->calls = [];
        return new SoapReferencePanel(
            function (int $formId) use ($owner): ?array {
                $this->calls[] = "owner:$formId";
                if ($owner instanceof \Throwable) {
                    throw $owner;
                }
                return $owner;
            },
            new SoapReference(
                function (string $sql, array $binds) use ($referenceFailure): array {
                    $this->calls[] = 'reference:' . implode(',', $binds);
                    if ($referenceFailure !== null) {
                        throw $referenceFailure;
                    }
                    return [[
                        'pid' => '7',
                        'encounter' => '201',
                        'encounter_date' => '2026-08-02 09:00:00',
                        'sensitivity' => 'normal',
                        'subjective' => 'Synthetic S',
                        'objective' => 'Synthetic O',
                        'assessment' => 'Synthetic A',
                        'plan' => 'Synthetic P',
                    ]];
                },
                static fn (): bool => true,
                static fn (string $level): bool => true,
                new NullLogger(),
            ),
            new SoapCopyEligibility(
                static fn (int $formId): array => [['id' => '91', 'pid' => '7', 'encounter' => '300']],
                function (int $encounter) use ($lockFailure): bool {
                    $this->calls[] = "lock:$encounter";
                    if ($lockFailure !== null) {
                        throw $lockFailure;
                    }
                    return false;
                },
                static fn (int $formsRowId, int $encounter): bool => false,
                new NullLogger(),
            ),
            new NullLogger(),
        );
    }

    public function testNewNoteUsesTheSessionEncounterWithoutAnOwnerLookup(): void
    {
        $context = $this->panel()->context(7, 300, 0);

        $this->assertSame('available', $context['soapReference']['status']);
        $this->assertTrue($context['soapCopyAllowed']);
        $this->assertSame(['reference:7,300,0,7,300', 'lock:300'], $this->calls);
    }

    public function testSavedNoteUsesItsOwnEncounterNotTheSessionEncounter(): void
    {
        $context = $this->panel(['pid' => 7, 'encounter' => 300])->context(7, 555, 12);

        $this->assertSame('available', $context['soapReference']['status']);
        $this->assertSame(['owner:12', 'reference:7,300,12,7,300', 'lock:300'], $this->calls);
    }

    public function testSavedNoteOfAnotherPatientIsUnavailableWithoutReading(): void
    {
        $context = $this->panel(['pid' => 8, 'encounter' => 300])->context(7, 300, 12);

        $this->assertSame(SoapReferencePanel::unavailable(), $context);
        $this->assertSame(['owner:12'], $this->calls);
    }

    public function testMissingOwnerIsUnavailable(): void
    {
        $this->assertSame(SoapReferencePanel::unavailable(), $this->panel(null)->context(7, 300, 12));
    }

    /**
     * The regression: an ownership read failure must be reported as an
     * unavailable panel, leaving the editor free to render.
     */
    public function testOwnershipReadFailureIsUnavailableAndDoesNotEscape(): void
    {
        $context = $this->panel(new SqlQueryException('', 'synthetic failure'))->context(7, 300, 12);

        $this->assertSame(SoapReferencePanel::unavailable(), $context);
        $this->assertSame(['owner:12'], $this->calls);
    }

    public function testReferenceReadFailureLeavesOnlyThePanelUnavailable(): void
    {
        $context = $this->panel(referenceFailure: new SqlQueryException('', 'synthetic failure'))->context(7, 300, 0);

        $this->assertSame('unavailable', $context['soapReference']['status']);
        $this->assertSame([], $context['soapReference']['notes']);
    }

    public function testLockReadFailureDeniesCopyButKeepsTheReference(): void
    {
        $context = $this->panel(lockFailure: new SqlQueryException('', 'synthetic failure'))->context(7, 300, 0);

        $this->assertSame('available', $context['soapReference']['status']);
        $this->assertFalse($context['soapCopyAllowed']);
    }

    public function testProgrammingErrorInOwnerLookupPropagates(): void
    {
        $panel = $this->panel(new \TypeError('synthetic defect'));

        $this->expectException(\TypeError::class);
        $panel->context(7, 300, 12);
    }

    public function testProgrammingErrorInLockReadPropagates(): void
    {
        $panel = $this->panel(lockFailure: new \Error('synthetic defect'));

        $this->expectException(\Error::class);
        $panel->context(7, 300, 0);
    }

    public function testUnavailableIsTheFailClosedShape(): void
    {
        $this->assertSame(
            [
                'soapReference' => ['status' => 'unavailable', 'withheld' => false, 'notes' => []],
                'soapCopyAllowed' => false,
            ],
            SoapReferencePanel::unavailable(),
        );
    }
}
