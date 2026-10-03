<?php

/**
 * Strict parsing of database row values used by the SOAP reference.
 *
 * Rows arrive as strings or native ints depending on the driver. These
 * helpers accept only the exact shapes the schema produces, so a decimal,
 * scientific, padded or out-of-range value is rejected rather than truncated.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Common\ClinicalWorkspace;

final class SoapRowValue
{
    /**
     * A positive integer id, or null when the value is anything else.
     */
    public static function positiveInt(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value > 0 ? $value : null;
        }
        if (!is_string($value) || preg_match('/^[1-9][0-9]*$/D', $value) !== 1) {
            return null;
        }
        $parsed = filter_var($value, FILTER_VALIDATE_INT);

        return is_int($parsed) ? $parsed : null;
    }

    /**
     * The calendar date of a SQL DATE or DATETIME value as Y-m-d, or null when
     * the value is not a real date and time in that shape (including
     * 0000-00-00 and out-of-range hours, minutes or seconds).
     */
    public static function sqlDate(mixed $value): ?string
    {
        if (
            !is_string($value)
            || preg_match('/^(\d{4})-(\d{2})-(\d{2})(?: ([01]\d|2[0-3]):[0-5]\d:[0-5]\d)?$/D', $value, $m) !== 1
            || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])
        ) {
            return null;
        }

        return substr($value, 0, 10);
    }
}
