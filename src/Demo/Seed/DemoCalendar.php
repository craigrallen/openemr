<?php

/**
 * Resolves fixture day offsets relative to Monday of the current week.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Demo\Seed;

use DateTimeImmutable;
use Psr\Clock\ClockInterface;

final readonly class DemoCalendar
{
    public const MAX_OFFSET_DAYS = 21;

    private DateTimeImmutable $monday;

    public function __construct(private ClockInterface $clock)
    {
        $this->monday = $this->clock->now()->modify('monday this week')->setTime(0, 0);
    }

    public function day(int $offset): DateTimeImmutable
    {
        return $this->monday->modify(sprintf('%+d days', $offset));
    }

    public function at(int $offset, string $time): DateTimeImmutable
    {
        [$h, $m] = array_map('intval', explode(':', $time) + [1 => '0']);
        return $this->day($offset)->setTime($h, $m);
    }

    public function now(): DateTimeImmutable
    {
        return $this->clock->now();
    }
}
