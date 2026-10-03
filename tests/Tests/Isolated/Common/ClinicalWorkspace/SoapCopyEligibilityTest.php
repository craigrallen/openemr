<?php

/**
 * Isolated tests for server-side copy eligibility of the SOAP reference.
 *
 * The lock checks are injected stand-ins for the SoapLockState reads the
 * runtime wires; the form lookup returns synthetic forms rows.
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
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

final class SoapCopyEligibilityTest extends TestCase
{
    /** @var list<string> */
    private array $calls = [];

    /**
     * @param list<array<string, mixed>>|\Throwable $rows
     */
    private function eligibility(
        array|\Throwable $rows = [],
        bool|\Throwable $encounterLocked = false,
        bool|\Throwable $formLocked = false,
    ): SoapCopyEligibility {
        $this->calls = [];
        return new SoapCopyEligibility(
            function (int $formId) use ($rows): array {
                $this->calls[] = "lookup:$formId";
                if ($rows instanceof \Throwable) {
                    throw $rows;
                }
                return $rows;
            },
            function (int $encounter) use ($encounterLocked): bool {
                $this->calls[] = "encounter:$encounter";
                if ($encounterLocked instanceof \Throwable) {
                    throw $encounterLocked;
                }
                return $encounterLocked;
            },
            function (int $formsRowId, int $encounter) use ($formLocked): bool {
                $this->calls[] = "form:$formsRowId:$encounter";
                if ($formLocked instanceof \Throwable) {
                    throw $formLocked;
                }
                return $formLocked;
            },
            new NullLogger(),
        );
    }

    /**
     * @return array<string, mixed>
     */
    private static function formRow(mixed $id = '91', mixed $pid = '7', mixed $encounter = '300'): array
    {
        return ['id' => $id, 'pid' => $pid, 'encounter' => $encounter];
    }

    public function testNewNoteInUnlockedEncounterMayCopy(): void
    {
        $this->assertTrue($this->eligibility()->allowsCopy(7, 300, 0));
        $this->assertSame(['encounter:300'], $this->calls);
    }

    public function testNewNoteInLockedEncounterMayNotCopy(): void
    {
        $this->assertFalse($this->eligibility(encounterLocked: true)->allowsCopy(7, 300, 0));
    }

    public function testSavedUnlockedNoteMayCopyAndChecksTheFormsRowLock(): void
    {
        $this->assertTrue($this->eligibility([self::formRow()])->allowsCopy(7, 300, 55));
        // The ESign form lock is keyed by forms.id (91), not form_soap.id (55).
        $this->assertSame(['lookup:55', 'encounter:300', 'form:91:300'], $this->calls);
    }

    public function testSavedLockedNoteMayNotCopy(): void
    {
        $this->assertFalse($this->eligibility([self::formRow()], formLocked: true)->allowsCopy(7, 300, 55));
    }

    public function testSavedNoteInLockedEncounterMayNotCopy(): void
    {
        $this->assertFalse($this->eligibility([self::formRow()], encounterLocked: true)->allowsCopy(7, 300, 55));
    }

    public function testMissingPatientOrEncounterIsDeniedWithoutLookups(): void
    {
        $this->assertFalse($this->eligibility()->allowsCopy(0, 300, 0));
        $this->assertFalse($this->eligibility()->allowsCopy(7, 0, 0));
        $this->assertFalse($this->eligibility()->allowsCopy(7, 300, -1));
        $this->assertSame([], $this->calls);
    }

    /**
     * @param list<array<string, mixed>> $rows
     */
    #[DataProvider('untrustedOwnershipProvider')]
    public function testUntrustedOwnershipIsDeniedBeforeAnyLockCheck(array $rows): void
    {
        $this->assertFalse($this->eligibility($rows)->allowsCopy(7, 300, 55));
        $this->assertSame(['lookup:55'], $this->calls);
    }

    /**
     * @return array<string, array{list<array<string, mixed>>}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function untrustedOwnershipProvider(): array
    {
        return [
            'no row' => [[]],
            'two rows' => [[self::formRow(), self::formRow('92')]],
            'other patient' => [[self::formRow(pid: '8')]],
            'other encounter' => [[self::formRow(encounter: '301')]],
            'decimal forms id' => [[self::formRow(id: '91.5')]],
            'scientific forms id' => [[self::formRow(id: '9e1')]],
            'missing forms id' => [[['pid' => '7', 'encounter' => '300']]],
            'null pid' => [[self::formRow(pid: null)]],
        ];
    }

    public function testLookupFailureIsDenied(): void
    {
        $this->assertFalse($this->eligibility(new \RuntimeException('synthetic'))->allowsCopy(7, 300, 55));
    }

    public function testLockCheckFailureIsDenied(): void
    {
        $this->assertFalse($this->eligibility(encounterLocked: new \RuntimeException('synthetic'))->allowsCopy(7, 300, 0));
        $this->assertFalse(
            $this->eligibility([self::formRow()], formLocked: new \RuntimeException('synthetic'))->allowsCopy(7, 300, 55)
        );
    }

    public function testProgrammingErrorPropagatesInsteadOfDenying(): void
    {
        $eligibility = $this->eligibility(encounterLocked: new \Error('synthetic defect'));

        $this->expectException(\Error::class);
        $eligibility->allowsCopy(7, 300, 0);
    }
}
