<?php

/**
 * Regression coverage for the public HL7 v2 formatting helpers of the
 * unchanged DORN module GenHl7OrderBase class: delimiter escaping, segment
 * assembly (field separator, retained trailing empty fields, CR terminator)
 * and the scalar normalizers for dates, times, sex, priority, phone and
 * relation/race codes.
 *
 * Inputs are synthetic unit fixtures only; no orders, patients, results or
 * transmissions are built. The database-bound payer/guarantor loaders are
 * intentionally not exercised.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Modules;

use OpenEMR\Modules\Dorn\GenHl7OrderBase;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
#[Group('modules')]
final class Hl7OrderFormattingContractsTest extends TestCase
{
    private GenHl7OrderBase $hl7;
    private string $originalTimezone;

    protected function setUp(): void
    {
        require_once dirname(__DIR__, 4) . '/interface/modules/custom_modules/oe-module-dorn/src/GenHl7OrderBase.php';
        $this->originalTimezone = date_default_timezone_get();
        $this->hl7 = new GenHl7OrderBase();
    }

    protected function tearDown(): void
    {
        date_default_timezone_set($this->originalTimezone);
    }

    public function testTextEscapesEveryDelimiterOnceWithEscapeCharacterFirst(): void
    {
        self::assertSame(
            'a\\E\\b\\S\\c\\F\\d\\R\\e\\T\\f\\X0d\\gh',
            $this->hl7->hl7Text("a\\b^c|d~e&f\rg\nh"),
            'escape char is replaced first so generated \\S\\ etc. are not re-escaped; LF is dropped'
        );
        self::assertSame('plain text', $this->hl7->hl7Text('plain text'));
    }

    public function testFieldJoinsEscapedComponentsAndEscapesScalars(): void
    {
        self::assertSame('DOE\\T\\SON^JANE^Q', $this->hl7->buildHL7Field(['DOE&SON', 'JANE', 'Q']));
        self::assertSame('A\\S\\B', $this->hl7->buildHL7Field('A^B'));
    }

    public function testSegmentKeepsTrailingEmptyFieldsAndEndsWithCarriageReturn(): void
    {
        self::assertSame("PID|1||X^Y|\r", $this->hl7->buildHl7Segment('PID', ['1', '', 'X^Y', '']));
        self::assertSame("NTE\r", $this->hl7->buildHl7Segment('NTE', []));
    }

    public function testReplaceNewLineFlattensLineBreaksAndTrims(): void
    {
        self::assertSame("first  second third", $this->hl7->replaceNewLine("  first\r\nsecond\nthird \n"));
    }

    public function testDateTimeFormatsHonourExplicitOffsetsAndRejectInvalidStrings(): void
    {
        date_default_timezone_set('UTC');
        self::assertSame('20240305140709+1000', $this->hl7->hl7DateTime('2024-03-05 14:07:09+10:00'));
        self::assertSame('0830', $this->hl7->formatTime('2024-03-05T08:30:59-05:00'));
        self::assertSame('20240305', $this->hl7->formatDate('2024-03-05 23:59:59'));
        foreach (['2024-13-45', 'not-a-date-value'] as $invalid) {
            self::assertSame('', $this->hl7->hl7DateTime($invalid), $invalid);
            self::assertSame('', $this->hl7->formatTime($invalid), $invalid);
            self::assertSame('', $this->hl7->formatDate($invalid), $invalid);
        }
        self::assertSame('20240305', $this->hl7->hl7Date('2024-03-05'));
        self::assertSame('123456789', $this->hl7->hl7Zip(" 12345-6789 "));
    }

    public function testHl7TimeConvertsExplicitTimezoneIntoDefaultZoneAndTreatsEmptyAsBlank(): void
    {
        date_default_timezone_set('Australia/Sydney');
        self::assertSame('202403060107', $this->hl7->hl7Time('2024-03-05 14:07:09+00:00'), 'UTC input is rendered in AEDT (+11)');
        self::assertSame('', $this->hl7->hl7Time(''));
        self::assertSame('', $this->hl7->hl7Time(null));
    }

    /**
     * @return array<string, array{mixed, string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function sexProvider(): array
    {
        return [
            'female word' => ['female', 'F'],
            'lower m' => ['m', 'M'],
            'empty' => ['', 'U'],
            'null' => [null, 'U'],
            'other code' => ['X', 'U'],
        ];
    }

    #[DataProvider('sexProvider')]
    public function testSexMapsToMFOrUnknown(mixed $input, string $expected): void
    {
        self::assertSame($expected, $this->hl7->hl7Sex($input));
    }

    public function testPriorityIsStatOnlyForHighPrefix(): void
    {
        self::assertSame('S', $this->hl7->hl7Priority('high'));
        self::assertSame('S', $this->hl7->hl7Priority('H'));
        self::assertSame('R', $this->hl7->hl7Priority('normal'));
        self::assertSame('R', $this->hl7->hl7Priority(''));
    }

    public function testPhoneAndSsnExtractTrailingDigitGroups(): void
    {
        // Unit fixtures in the reserved 555-01xx range; not real numbers.
        self::assertSame('5555550100', $this->hl7->hl7Phone('(555) 555-0100 ext'));
        self::assertSame('5550100', $this->hl7->hl7Phone('555-0100'));
        self::assertSame('5550100', $this->hl7->hl7Phone('123-555-0100'), 'area code starting 1 is invalid so only the local number is kept');
        self::assertSame('', $this->hl7->hl7Phone('no digits'));
        self::assertSame('000000000', $this->hl7->hl7SSN('000-00-0000'));
        self::assertSame('', $this->hl7->hl7SSN('00-000'));
    }

    public function testRelationRaceAndWorkmanCodes(): void
    {
        self::assertSame('1', $this->hl7->hl7Relation('Self'));
        self::assertSame('1', $this->hl7->hl7Relation(''));
        self::assertSame('2', $this->hl7->hl7Relation('SPOUSE'));
        self::assertSame('3', $this->hl7->hl7Relation('child'));
        self::assertSame('8', $this->hl7->hl7Relation('other'));
        self::assertSame('grandparent', $this->hl7->hl7Relation('grandparent'), 'unknown relations pass through unchanged');

        self::assertSame('', $this->hl7->hl7Race(''));
        self::assertSame('2106-3', $this->hl7->hl7Race('White'));
        self::assertSame('2054-5', $this->hl7->hl7Race('black_or_afri_amer'));
        self::assertSame('1002-5', $this->hl7->hl7Race('amer_ind_or_alaska_native'));
        self::assertSame('unlisted', $this->hl7->hl7Race('unlisted'));

        self::assertSame('Y', $this->hl7->hl7Workman(15));
        self::assertSame('Y', $this->hl7->hl7Workman('15'));
        self::assertSame('N', $this->hl7->hl7Workman(14));
    }
}
