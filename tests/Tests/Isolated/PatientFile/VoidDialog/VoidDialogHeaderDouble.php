<?php

/**
 * TEST DOUBLE for OpenEMR\Core\Header in the void dialog route test.
 *
 * Accepts only the route's exact asset list, records it and writes a marker where the real
 * helper writes the theme and script tags. Anything else fails closed.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\VoidDialog;

final class VoidDialogHeaderDouble
{
    public const MARKER = '<!--VOID-DIALOG-HEADER-DOUBLE-->';

    public const ASSETS = ['common', 'datetime-picker', 'opener'];

    /**
     * @param list<string>|string $assets
     */
    public static function setupHeader(array|string $assets = []): void
    {
        if ($assets !== self::ASSETS) {
            throw new \LogicException('Unexpected Header::setupHeader() assets');
        }
        VoidDialogRouteHarness::$headers[] = $assets;
        echo self::MARKER . "\n";
    }
}
