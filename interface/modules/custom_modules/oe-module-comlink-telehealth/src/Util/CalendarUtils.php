<?php

/**
 * Contains Helper methods for working with the calendar
 *
 * @package openemr
 * @link      https://www.open-emr.org
 * @author    Stephen Nielson <stephen@nielson.org>
 * @copyright Copyright (c) 2021 Comlink
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace Comlink\OpenEMR\Modules\TeleHealthModule\Util;

use OpenEMR\BC\ServiceContainer;
use OpenEMR\Common\Database\QueryUtils;

class CalendarUtils
{
    /**
     * Checks if the given date is within the two hour safe range for a TeleHealth appointment
     * @param \DateTime $dateTime
     * @return bool
     * @throws \Exception
     */
    public static function isAppointmentDateTimeInSafeRange(\DateTime $dateTime): bool
    {
        $beforeTime = (new \DateTime())->sub(new \DateInterval("PT2H"));
        $afterTime = (new \DateTime())->add(new \DateInterval("PT2H"));
        return $dateTime >= $beforeTime && $dateTime <= $afterTime;
    }

    /**
     * @param array<mixed> $session
     * @return bool
     */
    public static function isTelehealthSessionInActiveTimeRange(array $session, ?\DateTimeImmutable $now = null): bool
    {
        $lastUpdate = $session['provider_last_update'] ?? null;
        if (!is_string($lastUpdate) || str_contains($lastUpdate, "\0") || str_starts_with($lastUpdate, '0000')) {
            return false;
        }

        $dateTime = \DateTime::createFromFormat('!Y-m-d H:i:s', $lastUpdate);
        $errors = \DateTime::getLastErrors();
        if ($dateTime === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))
            || $dateTime->format('Y-m-d H:i:s') !== $lastUpdate
        ) {
            return false;
        }

        return CalendarUtils::isUserLastSeenTimeInActiveRange($dateTime, $now);
    }

    public static function isUserLastSeenTimeInActiveRange(\DateTime $dateTime, ?\DateTimeImmutable $now = null): bool
    {
        $currentDateTime = $now ?? new \DateTimeImmutable();
        ServiceContainer::getLogger()->debug("checking time ", ['user_last_update_time' => $currentDateTime->format("Y-m-d H:i:s"), 'now' => $currentDateTime->format("Y-m-d H:i:s")]);
        return $currentDateTime < (clone $dateTime)->add(new \DateInterval("PT15S"));
    }

    public static function getCalendarCategory($id)
    {
        $sql = "select pc_catid,pc_constant_id,pc_catname,pc_catcolor,pc_catdesc,pc_recurrtype,pc_enddate,pc_recurrspec"
            . " ,pc_recurrfreq,pc_duration,pc_end_date_flag,pc_end_date_type,pc_end_all_day,pc_dailylimit,pc_cattype"
            . " ,pc_active,pc_seq,aco_spec"
            . " from openemr_postcalendar_categories "
            . " WHERE pc_catid = ? ";
        $records = QueryUtils::fetchRecords($sql, [$id]);
        if (!empty($records)) {
            return $records[0];
        }
        return null;
    }
}
