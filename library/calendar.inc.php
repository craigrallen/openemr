<?php

/**
 * Holds functions for the calendar, one is for holidays
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2005 Brady Miller <brady.g.miller@gmail.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
*/

use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Services\CalendarFacilityQuery;
use OpenEMR\Services\HolidayService;

// Returns an array of the facility ids and names that the user is allowed to access.
// Access might be for inventory purposes ($inventory=true) or calendar purposes.
//
function getUserFacilities($uID, $orderby = 'id', $inventory = false): array
{
    return CalendarFacilityQuery::forLegacyContext()->getUserFacilities($uID, $orderby, $inventory);
}

// Returns an array of warehouse IDs for the given user and facility.
function getUserFacWH($uID, $fID): array
{
    $res = sqlStatement(
        "SELECT warehouse_id FROM users_facility WHERE tablename = ? " .
        "AND table_id = ? AND facility_id = ?",
        ['users', $uID, $fID]
    );
    $returnVal = [];
    while ($row = sqlFetchArray($res)) {
        if ($row['warehouse_id'] === '') {
            continue;
        }
        $returnVal[] = $row['warehouse_id'];
    }
    return $returnVal;
}

 /**
 * Check if day is weekend day
 * @param int $day
 * @return bool
 */
function is_weekend_day($day): bool
{

    if (in_array($day, OEGlobalsBag::getInstance()->get('weekend_days'))) {
        return true;
    } else {
        return false;
    }
}

/**
 * Returns true when $date (YYYY-MM-DD or YYYY/MM/DD) is a holiday/closed date.
 */
function is_holiday(string $date): bool
{
    /** @var HolidayService|null $service */
    static $service = null;
    $service ??= HolidayService::createForLegacyContext();
    return $service->isHoliday($date);
}
