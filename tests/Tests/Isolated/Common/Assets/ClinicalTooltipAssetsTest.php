<?php

/**
 * Verify the shipped legacy tooltip is versioned from its own directory.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Common\Assets;

use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
class ClinicalTooltipAssetsTest extends TestCase
{
    #[Test]
    public function shippedTooltipUsesItsLibraryModificationTime(): void
    {
        $directory = dirname(__DIR__, 5) . '/library/js';
        $tooltip = $directory . '/ajtooltip.js';
        self::assertFileExists($tooltip);
        clearstatcache(true, $tooltip);

        self::assertSame(
            (string) filemtime($tooltip),
            (new ClinicalWorkspaceAssets($directory))->version('ajtooltip.js')
        );
    }
}
