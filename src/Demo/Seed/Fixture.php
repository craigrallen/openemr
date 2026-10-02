<?php

/**
 * Validated synthetic fixture (see FixtureLoader for the rules it satisfies).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

final readonly class Fixture
{
    /**
     * @param array<string, mixed> $facility
     * @param list<array<string, mixed>> $staff
     * @param list<array<string, mixed>> $insurers
     * @param array<string, mixed> $lab
     * @param list<array<string, mixed>> $providerBlocks
     * @param list<array<string, mixed>> $clinicEvents
     * @param list<array<string, mixed>> $officeNotes
     * @param list<array<string, mixed>> $patients
     */
    public function __construct(
        public string $seedKey,
        public array $facility,
        public array $staff,
        public array $insurers,
        public array $lab,
        public array $providerBlocks,
        public array $clinicEvents,
        public array $officeNotes,
        public array $patients,
    ) {
    }

    /** Text marker embedded in every seeded row that has a free-text column. */
    public function marker(string $suffix = ''): string
    {
        return '[SYNTHETIC-DEMO-SEED ' . $this->seedKey . ']' . ($suffix === '' ? '' : ' ' . $suffix);
    }
}
