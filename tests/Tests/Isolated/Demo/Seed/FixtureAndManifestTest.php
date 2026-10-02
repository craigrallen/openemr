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
        $out = [];
        foreach ($data as $key => $value) {
            self::assertIsString($key, 'fixture root keys must be strings');
            $out[$key] = $value;
        }
        return $out;
    }

    /**
     * Return $data with the value at $path replaced; the path must already exist
     * below its last segment so a typo cannot silently make a case vacuous.
     *
     * @param array<string, mixed> $data
     * @param list<int|string> $path
     * @return array<string, mixed>
     */
    private static function with(array $data, string $key, array $path, mixed $value): array
    {
        $data[$key] = $path === [] ? $value : self::withIn($data[$key] ?? null, $path, $value);
        return $data;
    }

    /** @param non-empty-list<int|string> $path */
    private static function withIn(mixed $node, array $path, mixed $value): mixed
    {
        if (!is_array($node)) {
            throw new \LogicException('Fixture path does not exist.');
        }
        $key = array_shift($path);
        $node[$key] = $path === [] ? $value : self::withIn($node[$key] ?? null, $path, $value);
        return $node;
    }

    /**
     * @param array<string, mixed> $data
     * @param list<int|string> $path
     */
    private static function at(array $data, string $key, array $path): mixed
    {
        $node = $data[$key] ?? null;
        foreach ($path as $segment) {
            if (!is_array($node) || !array_key_exists($segment, $node)) {
                throw new \LogicException('Fixture path does not exist.');
            }
            $node = $node[$segment];
        }
        return $node;
    }

    public function testDefaultFixtureIsValid(): void
    {
        $fixture = FixtureLoader::fromFile(FixtureLoader::defaultPath());
        self::assertSame('demo-v1', $fixture->seedKey);
        self::assertGreaterThanOrEqual(6, count($fixture->patients));
    }

    /**
     * @param list<int|string> $path
     */
    #[DataProvider('malformedProvider')]
    public function testMalformedFixturesAreRejected(string $key, array $path, mixed $value): void
    {
        $this->expectException(InvalidFixtureException::class);
        FixtureLoader::fromArray(self::with(self::raw(), $key, $path, $value));
    }

    /**
     * @return array<string, array{string, list<int|string>, mixed}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function malformedProvider(): array
    {
        $vitals = [0, 'encounters', 0, 'forms', 'vitals'];
        return [
            'malformed seed key' => ['seed_key', [], 'Not A Key!'],
            'real-looking email' => ['patients', [0, 'email'], 'someone@example.se'],
            'swedish personal identity number in notes' => ['patients', [0, 'notes'], 'pnr 19121212-1212'],
            'phone number' => ['patients', [0, 'phone_cell'], '+46 70 123 45 67'],
            'unsynthetic pubpid' => ['patients', [0, 'pubpid'], '0001'],
            'unsafe form column' => ['patients', [...$vitals, 'pid; DROP'], '1'],
            'seeder managed column override' => ['patients', [...$vitals, 'pid'], '1'],
            'unknown provider reference' => ['patients', [0, 'encounters', 0, 'provider'], 'nobody'],
            'date too far from current week' => ['patients', [0, 'appointments', 0, 'day'], 400],
        ];
    }

    public function testMissingSeedKeyIsRejected(): void
    {
        $fixture = self::raw();
        unset($fixture['seed_key']);
        $this->expectException(InvalidFixtureException::class);
        FixtureLoader::fromArray($fixture);
    }

    public function testDuplicatePatientKeyIsRejected(): void
    {
        $fixture = self::raw();
        $this->expectException(InvalidFixtureException::class);
        FixtureLoader::fromArray(self::with($fixture, 'patients', [1, 'pubpid'], self::at($fixture, 'patients', [0, 'pubpid'])));
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
