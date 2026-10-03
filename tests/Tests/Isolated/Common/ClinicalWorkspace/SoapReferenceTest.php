<?php

/**
 * Isolated tests for the same-patient previous SOAP reference.
 *
 * All rows are synthetic fixtures handed to the injected fetcher; no database.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Common\ClinicalWorkspace;

use OpenEMR\Common\ClinicalWorkspace\SoapReference;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

final class SoapReferenceTest extends TestCase
{
    /** @var list<array{string, list<int>}> */
    private array $queries = [];

    /**
     * @param list<array<string, mixed>> $rows
     */
    private function reference(
        array $rows,
        bool $formAllowed = true,
        ?\Closure $sensitivity = null,
        ?\Throwable $failure = null,
    ): SoapReference {
        $this->queries = [];
        return new SoapReference(
            function (string $sql, array $binds) use ($rows, $failure): array {
                $this->queries[] = [$sql, $binds];
                if ($failure !== null) {
                    throw $failure;
                }
                return $rows;
            },
            static fn (): bool => $formAllowed,
            $sensitivity ?? static fn (string $level): bool => true,
            new NullLogger(),
        );
    }

    /**
     * @param array<string, mixed> $overrides
     *
     * @return array<string, mixed>
     */
    private static function row(int $pid, int $encounter, string $date, array $overrides = []): array
    {
        return array_merge([
            'pid' => (string) $pid,
            'encounter' => (string) $encounter,
            'encounter_date' => $date . ' 09:00:00',
            'sensitivity' => 'normal',
            'subjective' => 'Synthetic S ' . $encounter,
            'objective' => 'Synthetic O ' . $encounter,
            'assessment' => 'Synthetic A ' . $encounter,
            'plan' => 'Synthetic P ' . $encounter,
        ], $overrides);
    }

    public function testQueryIsParameterizedAndScopedToPatientExcludingCurrentEncounterAndForm(): void
    {
        $this->reference([])->forPatient(7, 300, 55);

        $this->assertCount(1, $this->queries);
        [$sql, $binds] = $this->queries[0];
        $this->assertSame([7, 300, 55, 7, 300], $binds);
        $this->assertStringContainsString('f.pid = ?', $sql);
        $this->assertStringContainsString('fe.pid = f.pid', $sql);
        $this->assertStringContainsString('s.pid = f.pid', $sql);
        $this->assertStringContainsString("f.formdir = 'soap'", $sql);
        $this->assertStringContainsString('f.deleted = 0', $sql);
        $this->assertStringContainsString('f.encounter <> ?', $sql);
        $this->assertStringContainsString('f.form_id <> ?', $sql);
        $this->assertStringContainsString('ORDER BY fe.date DESC', $sql);
        $this->assertStringNotContainsString('7', str_replace(['LIMIT 25'], '', $sql));
    }

    public function testOtherPatientRowFailsTheWholeResultClosed(): void
    {
        $result = $this->reference([
            self::row(8, 201, '2026-09-01', ['plan' => 'OTHER PATIENT']),
            self::row(7, 200, '2026-08-01'),
        ])->forPatient(7, 300, 0);

        $this->assertSame('unavailable', $result['status']);
        $this->assertSame([], $result['notes']);
        $this->assertStringNotContainsString('OTHER PATIENT', (string) json_encode($result));
    }

    public function testLeakedCurrentEncounterRowIsUnavailableNotNone(): void
    {
        $result = $this->reference([self::row(7, 300, '2026-09-01')])->forPatient(7, 300, 0);

        $this->assertSame('unavailable', $result['status']);
        $this->assertSame([], $result['notes']);
    }

    public function testFormAclDenialFailsClosedWithoutQuerying(): void
    {
        $result = $this->reference([self::row(7, 200, '2026-08-01')], formAllowed: false)->forPatient(7, 300, 0);

        $this->assertSame('denied', $result['status']);
        $this->assertSame([], $result['notes']);
        $this->assertSame([], $this->queries);
    }

    public function testMissingPatientFailsClosedWithoutQuerying(): void
    {
        $result = $this->reference([self::row(7, 200, '2026-08-01')])->forPatient(0, 300, 0);

        $this->assertSame('unavailable', $result['status']);
        $this->assertSame([], $this->queries);
    }

    public function testQueryFailureIsUnavailableNotEmpty(): void
    {
        $result = $this->reference([], failure: new \RuntimeException('synthetic'))->forPatient(7, 300, 0);

        $this->assertSame('unavailable', $result['status']);
        $this->assertSame([], $result['notes']);
    }

    public function testAclExceptionIsUnavailable(): void
    {
        $reference = new SoapReference(
            static fn (string $sql, array $binds): array => [],
            static function (): bool {
                throw new \RuntimeException('synthetic acl failure');
            },
            static fn (string $level): bool => true,
            new NullLogger(),
        );

        $this->assertSame('unavailable', $reference->forPatient(7, 300, 0)['status']);
    }

    /**
     * A programming error is a defect, not a degraded data source: it must
     * not be swallowed into an "unavailable" panel.
     */
    public function testProgrammingErrorPropagates(): void
    {
        $reference = $this->reference([], failure: new \TypeError('synthetic defect'));

        $this->expectException(\TypeError::class);
        $reference->forPatient(7, 300, 0);
    }

    /**
     * A PHP warning promoted to ErrorException is also a defect signal, not
     * a database failure, so it must not degrade to "unavailable".
     */
    public function testPromotedWarningPropagates(): void
    {
        $reference = $this->reference([], failure: new \ErrorException('synthetic warning'));

        $this->expectException(\ErrorException::class);
        $reference->forPatient(7, 300, 0);
    }

    public function testSensitivityDeniedNotesAreWithheldAndNeverReportedAsNoNotes(): void
    {
        $allowNormalOnly = static fn (string $level): bool => $level === 'normal';

        $onlyRestricted = $this->reference(
            [self::row(7, 200, '2026-08-01', ['sensitivity' => 'high'])],
            sensitivity: $allowNormalOnly,
        )->forPatient(7, 300, 0);
        $this->assertSame('denied', $onlyRestricted['status']);
        $this->assertTrue($onlyRestricted['withheld']);
        $this->assertSame([], $onlyRestricted['notes']);

        $mixed = $this->reference(
            [self::row(7, 201, '2026-08-02', ['sensitivity' => 'high']), self::row(7, 200, '2026-08-01')],
            sensitivity: $allowNormalOnly,
        )->forPatient(7, 300, 0);
        $this->assertSame('available', $mixed['status']);
        $this->assertTrue($mixed['withheld']);
        $this->assertSame([200], array_column($mixed['notes'], 'encounter'));
    }

    public function testReturnsAtMostFiveInSourceOrderWithProvenance(): void
    {
        $rows = [];
        foreach ([210, 209, 208, 207, 206, 205, 204] as $i => $encounter) {
            $rows[] = self::row(7, $encounter, sprintf('2026-08-%02d', 20 - $i));
        }

        $result = $this->reference($rows)->forPatient(7, 300, 0);

        $this->assertCount(SoapReference::MAX_NOTES, $result['notes']);
        $this->assertSame([210, 209, 208, 207, 206], array_column($result['notes'], 'encounter'));
        $this->assertSame('2026-08-20', $result['notes'][0]['date']);
        $this->assertFalse($result['withheld']);
    }

    public function testTextIsReturnedVerbatimForEscapingAtRenderTime(): void
    {
        $text = "<script>alert(1)</script>\nline two & \"quotes\"";
        $result = $this->reference([self::row(7, 200, '2026-08-01', ['plan' => $text, 'objective' => null])])
            ->forPatient(7, 300, 0);

        $this->assertSame($text, $result['notes'][0]['sections']['plan']);
        $this->assertSame('', $result['notes'][0]['sections']['objective']);
    }

    /**
     * A malformed row anywhere in a non-empty result means the source cannot be
     * trusted: the panel must say "could not be loaded", never "no earlier notes",
     * and must not show the valid rows beside it.
     *
     * @param array<string, mixed> $overrides
     * @param list<string>         $remove
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('malformedRowProvider')]
    public function testMalformedRowFailsClosedAsUnavailable(array $overrides, array $remove): void
    {
        $bad = self::row(7, 201, '2026-08-02', $overrides);
        foreach ($remove as $key) {
            unset($bad[$key]);
        }

        $result = $this->reference([self::row(7, 202, '2026-08-03'), $bad])->forPatient(7, 300, 0);

        $this->assertSame('unavailable', $result['status']);
        $this->assertFalse($result['withheld']);
        $this->assertSame([], $result['notes']);
    }

    /**
     * @return array<string, array{array<string, mixed>, list<string>}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function malformedRowProvider(): array
    {
        return [
            'missing pid' => [[], ['pid']],
            'missing encounter' => [[], ['encounter']],
            'missing encounter date' => [[], ['encounter_date']],
            'missing sensitivity column' => [[], ['sensitivity']],
            'missing plan column' => [[], ['plan']],
            'missing subjective column' => [[], ['subjective']],
            'decimal encounter' => [['encounter' => '201.5'], []],
            'scientific encounter' => [['encounter' => '2e2'], []],
            'float encounter' => [['encounter' => 201.0], []],
            'padded encounter' => [['encounter' => ' 201'], []],
            'zero encounter' => [['encounter' => '0'], []],
            'negative encounter' => [['encounter' => '-201'], []],
            'overflowing encounter' => [['encounter' => '99999999999999999999'], []],
            'decimal pid' => [['pid' => '7.0'], []],
            'scientific pid' => [['pid' => '7e0'], []],
            'null encounter date' => [['encounter_date' => null], []],
            'zero encounter date' => [['encounter_date' => '0000-00-00 00:00:00'], []],
            'impossible encounter date' => [['encounter_date' => '2026-02-30 09:00:00'], []],
            'impossible encounter hour' => [['encounter_date' => '2026-08-02 24:00:00'], []],
            'impossible encounter minute' => [['encounter_date' => '2026-08-02 09:60:00'], []],
            'impossible encounter second' => [['encounter_date' => '2026-08-02 09:00:60'], []],
            'year zero encounter date' => [['encounter_date' => '0000-08-02'], []],
            'iso-t encounter date' => [['encounter_date' => '2026-08-02T09:00:00'], []],
            'words encounter date' => [['encounter_date' => 'yesterday'], []],
            'integer sensitivity' => [['sensitivity' => 1], []],
            'boolean sensitivity' => [['sensitivity' => false], []],
            'array sensitivity' => [['sensitivity' => ['high']], []],
            'integer section' => [['plan' => 42], []],
            'array section' => [['objective' => ['x']], []],
        ];
    }

    public function testNullOrEmptySensitivityFollowsViewFormAndNeedsNoSensitivityAcl(): void
    {
        $checked = [];
        $result = $this->reference(
            [
                self::row(7, 202, '2026-08-03', ['sensitivity' => null]),
                self::row(7, 201, '2026-08-02', ['sensitivity' => '']),
            ],
            sensitivity: static function (string $level) use (&$checked): bool {
                $checked[] = $level;
                return false;
            },
        )->forPatient(7, 300, 0);

        $this->assertSame('available', $result['status']);
        $this->assertSame([202, 201], array_column($result['notes'], 'encounter'));
        $this->assertSame([], $checked);
    }

    public function testNativeIntegerAndDateOnlyValuesAreAccepted(): void
    {
        $result = $this->reference([
            self::row(7, 200, '2026-08-01', ['pid' => 7, 'encounter' => 200, 'encounter_date' => '2026-08-01']),
        ])->forPatient(7, 300, 0);

        $this->assertSame('available', $result['status']);
        $this->assertSame(200, $result['notes'][0]['encounter']);
        $this->assertSame('2026-08-01', $result['notes'][0]['date']);
    }

    public function testNegativeCurrentIdsFailClosedWithoutQuerying(): void
    {
        $this->assertSame('unavailable', $this->reference([])->forPatient(7, -1, 0)['status']);
        $this->assertSame('unavailable', $this->reference([])->forPatient(7, 300, -5)['status']);
        $this->assertSame([], $this->queries);
    }
}
