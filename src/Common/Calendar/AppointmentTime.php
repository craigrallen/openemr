<?php

/**
 * Appointment editor hour conversion.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Common\Calendar;

final class AppointmentTime
{
    public static function to24Hour(int $hour, int $meridiem): int
    {
        if ($meridiem === 1 && $hour === 12) {
            return 0;
        }

        if ($meridiem === 2 && $hour < 12) {
            return $hour + 12;
        }

        return $hour;
    }
}
