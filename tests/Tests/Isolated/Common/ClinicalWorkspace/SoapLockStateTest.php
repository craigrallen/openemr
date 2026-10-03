<?php

/**
 * Isolated tests for the SOAP reference's ESign lock reads.
 *
 * The fetcher is a stand-in for the throwing QueryUtils read; rows are
 * synthetic. Each case mirrors the ESign Encounter/Form Signable rules.
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
use OpenEMR\Common\ClinicalWorkspace\SoapLockState;
use OpenEMR\Common\Database\SqlQueryException;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

final class SoapLockStateTest extends TestCase
{
    /** @var list<array{string, list<int|string>}> */
    private array $queries = [];

    /**
     * @param array<string, list<array<string, mixed>>> $locksByTable keyed by "table:tid"
     */
    private function locks(
        bool $lockEncounters,
        bool $lockIndividualForms,
        array $locksByTable = [],
        ?\Throwable $failure = null,
    ): SoapLockState {
        $this->queries = [];
        return new SoapLockState(
            function (string $sql, array $binds) use ($locksByTable, $failure): array {
                $this->queries[] = [$sql, $binds];
                if ($failure !== null) {
                    throw $failure;
                }
                return $locksByTable[$binds[1] . ':' . $binds[0]] ?? [];
            },
            $lockEncounters,
            $lockIndividualForms,
        );
    }

    public function testLockReadIsParameterizedLikeTheESignSignable(): void
    {
        $locks = $this->locks(true, true, ['form_encounter:300' => [['is_lock' => '1']]]);

        $this->assertTrue($locks->isEncounterLocked(300));
        $this->assertCount(1, $this->queries);
        [$sql, $binds] = $this->queries[0];
        $this->assertSame([300, 'form_encounter', 1], $binds);
        $this->assertStringContainsString('FROM esign_signatures E', $sql);
        $this->assertStringContainsString('E.tid = ? AND E.table = ? AND E.is_lock = ?', $sql);
        $this->assertStringContainsString('ORDER BY E.datetime DESC LIMIT 1', $sql);
    }

    public function testEncounterLockIsIgnoredWhenEncounterLockingIsOff(): void
    {
        $locks = $this->locks(false, false, ['form_encounter:300' => [['is_lock' => '1']]]);

        $this->assertFalse($locks->isEncounterLocked(300));
        $this->assertFalse($locks->isFormLocked(91, 300));
        $this->assertSame([], $this->queries);
    }

    public function testUnlockedEncounterAndFormAreUnlocked(): void
    {
        $locks = $this->locks(true, true);

        $this->assertFalse($locks->isEncounterLocked(300));
        $this->assertFalse($locks->isFormLocked(91, 300));
        $this->assertSame(
            [[91, 'forms', 1], [300, 'form_encounter', 1]],
            array_column(array_slice($this->queries, 1), 1),
        );
    }

    public function testIndividuallyLockedFormIsLockedOnlyWhenIndividualLockingIsOn(): void
    {
        $rows = ['forms:91' => [['is_lock' => '1']]];

        $this->assertTrue($this->locks(false, true, $rows)->isFormLocked(91, 300));
        $this->assertFalse($this->locks(false, false, $rows)->isFormLocked(91, 300));
    }

    public function testFormInLockedEncounterIsLocked(): void
    {
        $this->assertTrue(
            $this->locks(true, false, ['form_encounter:300' => [['is_lock' => '1']]])->isFormLocked(91, 300),
        );
    }

    public function testQueryFailurePropagatesInsteadOfReadingAsUnlocked(): void
    {
        $locks = $this->locks(true, true, failure: new SqlQueryException('', 'synthetic failure'));

        $this->expectException(SqlQueryException::class);
        $locks->isEncounterLocked(300);
    }

    /**
     * A failing lock read must reach the eligibility catch and deny copy,
     * which only holds when the read throws rather than terminating.
     */
    public function testFailingLockReadDeniesCopy(): void
    {
        $locks = $this->locks(true, true, failure: new SqlQueryException('', 'synthetic failure'));
        $eligibility = new SoapCopyEligibility(
            static fn (int $formId): array => [['id' => '91', 'pid' => '7', 'encounter' => '300']],
            $locks->isEncounterLocked(...),
            $locks->isFormLocked(...),
            new NullLogger(),
        );

        $this->assertFalse($eligibility->allowsCopy(7, 300, 12));
        $this->assertFalse($eligibility->allowsCopy(7, 300, 0));
    }
}
