<?php

/**
 * Guards the SOAP reference's runtime wiring against legacy die-on-error reads.
 *
 * sqlQuery()/sqlStatement() report a database error through HelpfulDie(),
 * which ends the request before any try/catch can run, so an optional panel
 * built on them could take the SOAP editor down with it. The ESign API and
 * aclCheckForm() read through those functions. The panel's runtime wiring
 * must use the throwing QueryUtils path instead.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Common\ClinicalWorkspace;

use OpenEMR\Common\ClinicalWorkspace\SoapCopyEligibility;
use OpenEMR\Common\ClinicalWorkspace\SoapLockState;
use OpenEMR\Common\ClinicalWorkspace\SoapReference;
use OpenEMR\Common\ClinicalWorkspace\SoapReferencePanel;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SoapReferenceRuntimeWiringTest extends TestCase
{
    /** Lower-cased names whose database errors terminate the request. */
    private const DIE_ON_ERROR = [
        'sqlquery',
        'sqlstatement',
        'sqlstatementnolog',
        'sqlquerynolog',
        'sqlfetcharray',
        'getregistryentrybydirectory',
        'aclcheckform',
        'esign',
    ];

    /**
     * @param class-string $class
     */
    #[DataProvider('runtimeClassProvider')]
    public function testRuntimeWiringAvoidsDieOnErrorReads(string $class): void
    {
        $file = (new \ReflectionClass($class))->getFileName();
        $this->assertIsString($file);
        $source = file_get_contents($file);
        $this->assertIsString($source);

        $found = [];
        foreach (\PhpToken::tokenize($source) as $token) {
            if (!$token->is([T_STRING, T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED])) {
                continue;
            }
            foreach (explode('\\', strtolower(ltrim($token->text, '\\'))) as $part) {
                if (in_array($part, self::DIE_ON_ERROR, true)) {
                    $found[] = $token->text . ' on line ' . $token->line;
                }
            }
        }

        $this->assertSame([], $found, $file);
    }

    /**
     * @return array<string, array{class-string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function runtimeClassProvider(): array
    {
        return [
            'reference' => [SoapReference::class],
            'copy eligibility' => [SoapCopyEligibility::class],
            'lock state' => [SoapLockState::class],
            'panel' => [SoapReferencePanel::class],
        ];
    }
}
