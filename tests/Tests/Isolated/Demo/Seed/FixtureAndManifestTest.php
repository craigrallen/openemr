<?php

/**
 * Fixture validation and coverage-manifest honesty checks.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Demo\Seed;

use DateTimeImmutable;
use OpenEMR\Demo\Seed\CoverageManifest;
use OpenEMR\Demo\Seed\CoverageStatus;
use OpenEMR\Demo\Seed\DemoCalendar;
use OpenEMR\Demo\Seed\FixtureLoader;
use OpenEMR\Demo\Seed\InvalidFixtureException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Clock\ClockInterface;

final class FixtureAndManifestTest extends TestCase
{
    /** @return array<string, mixed> */
    private static function raw(): array
    {
        $json = file_get_contents(FixtureLoader::defaultPath());
        self::assertIsString($json);
        $data = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        self::assertIsArray($data);
        /** @var array<string, mixed> $data */
        return $data;
    }

    public function testDefaultFixtureIsValid(): void
    {
        $fixture = FixtureLoader::fromFile(FixtureLoader::defaultPath());
        self::assertSame('demo-v1', $fixture->seedKey);
        self::assertGreaterThanOrEqual(6, count($fixture->patients));
    }

    /**
     * @param callable(array<string, mixed>): array<string, mixed> $mutate
     */
    #[DataProvider('malformedProvider')]
    public function testMalformedFixturesAreRejected(callable $mutate): void
    {
        $this->expectException(InvalidFixtureException::class);
        FixtureLoader::fromArray($mutate(self::raw()));
    }

    /**
     * @return array<string, array{callable(array<string, mixed>): array<string, mixed>}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function malformedProvider(): array
    {
        return [
            'missing seed key' => [static function (array $f): array {
                unset($f['seed_key']);
                return $f;
            }],
            'real-looking email' => [static function (array $f): array {
                $f['patients'][0]['email'] = 'someone@example.se';
                return $f;
            }],
            'swedish personal identity number in notes' => [static function (array $f): array {
                $f['patients'][0]['notes'] = 'pnr 19121212-1212';
                return $f;
            }],
            'phone number' => [static function (array $f): array {
                $f['patients'][0]['phone_cell'] = '+46 70 123 45 67';
                return $f;
            }],
            'unsynthetic pubpid' => [static function (array $f): array {
                $f['patients'][0]['pubpid'] = '0001';
                return $f;
            }],
            'unsafe form column' => [static function (array $f): array {
                $f['patients'][0]['encounters'][0]['forms']['vitals']['pid; DROP'] = '1';
                return $f;
            }],
            'seeder managed column override' => [static function (array $f): array {
                $f['patients'][0]['encounters'][0]['forms']['vitals']['pid'] = '1';
                return $f;
            }],
            'unknown provider reference' => [static function (array $f): array {
                $f['patients'][0]['encounters'][0]['provider'] = 'nobody';
                return $f;
            }],
            'date too far from current week' => [static function (array $f): array {
                $f['patients'][0]['appointments'][0]['day'] = 400;
                return $f;
            }],
            'duplicate patient key' => [static function (array $f): array {
                $f['patients'][1]['pubpid'] = $f['patients'][0]['pubpid'];
                return $f;
            }],
        ];
    }

    public function testCalendarIsAnchoredToCurrentWeek(): void
    {
        $clock = new class implements ClockInterface {
            public function now(): DateTimeImmutable
            {
                return new DateTimeImmutable('2026-10-02 10:00:00'); // a Friday
            }
        };
        $cal = new DemoCalendar($clock);
        self::assertSame('2026-09-28', $cal->day(0)->format('Y-m-d'));
        self::assertSame('2026-10-05 09:30:00', $cal->at(7, '09:30')->format('Y-m-d H:i:s'));
    }

    public function testEveryEnabledRegistryFormAndLbfOfTheDeploymentIsClassified(): void
    {
        // Snapshot of the Railway testing runtime (8.5.0, schema 546), read-only inventory 2026-10-02.
        $registry = ['fee_sheet', 'misc_billing_options', 'newpatient', 'care_plan', 'clinical_instructions',
            'clinical_notes', 'eye_mag', 'functional_cognitive_status', 'group_attendance', 'newGroupEncounter',
            'observation', 'ros', 'reviewofs', 'soap', 'dictation', 'vitals', 'procedure_order',
            'questionnaire_assessments'];
        $lbf = ['DEM', 'FACUSR', 'HIS', 'LBTbill', 'LBTlegal', 'LBTphreq', 'LBTptreq', 'LBTref'];
        self::assertSame([], CoverageManifest::unclassified($registry, $lbf));
        self::assertNotSame([], CoverageManifest::unclassified(['brand_new_form'], []));
    }

    public function testManifestIsHonestAboutGaps(): void
    {
        $byKey = [];
        foreach (CoverageManifest::entries() as $entry) {
            $byKey[$entry->key] = $entry;
            if ($entry->status !== CoverageStatus::Seeded) {
                self::assertNotSame('', $entry->reason, "{$entry->key} needs a reason");
            }
        }
        self::assertSame(CoverageStatus::Gap, $byKey['form:eye_mag']->status);
        self::assertSame(CoverageStatus::NotApplicable, $byKey['form:group_attendance']->status);
        self::assertSame(CoverageStatus::Gap, $byKey['appointment:video']->status);
        self::assertSame(CoverageStatus::Seeded, $byKey['form:vitals']->status);
    }
}
