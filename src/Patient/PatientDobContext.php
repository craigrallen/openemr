<?php

/**
 * Builds the str_dob value that chart pages publish to the workbench header
 * through left_nav.setPatient().
 *
 * The header treats an empty str_dob as "DOB unknown". Without this guard a
 * patient with no usable DOB published the translated labels with no values
 * (" DOB:  Age: "), which the header could not tell apart from a real DOB
 * without parsing translated text.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Patient;

final class PatientDobContext
{
    /**
     * Returns the caller's DOB/age label for a valid DOB, or '' when the DOB
     * is missing, zero or not a real calendar date.
     *
     * @param \Closure(string): string $label Builds the page's existing
     *        translated label from the validated Y-m-d DOB.
     */
    public static function headerString(mixed $dobYmd, \Closure $label): string
    {
        $dob = self::validYmd($dobYmd);
        return $dob === null ? '' : $label($dob);
    }

    /**
     * Returns the DOB as Y-m-d when it is a real calendar date, otherwise null.
     */
    public static function validYmd(mixed $dobYmd): ?string
    {
        if (!is_string($dobYmd) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $dobYmd) !== 1) {
            return null;
        }
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $dobYmd);
        // Round-trip rejects 0000-00-00 and overflow dates such as 2020-02-30;
        // year 0000 is MySQL's zero-date family, not a real DOB.
        if ($date === false || $date->format('Y-m-d') !== $dobYmd || str_starts_with($dobYmd, '0000')) {
            return null;
        }
        return $dobYmd;
    }
}
