<?php

/**
 * Input safety and compatibility tests for the native holiday CSV parser.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenCoreEMR Inc <https://opencoreemr.com/>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Services;

use OpenEMR\Services\HolidayCsvParser;
use OpenEMR\Services\HolidayRow;
use OpenEMR\Services\InvalidHolidayCsvException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
class HolidayCsvInputSafetyTest extends TestCase
{
    /** @var list<string> */
    private array $tempFiles = [];
    private bool $hadDisableTranslation;
    private mixed $previousDisableTranslation;
    private string $previousTimezone;

    protected function setUp(): void
    {
        $this->hadDisableTranslation = array_key_exists('disable_translation', $GLOBALS);
        $this->previousDisableTranslation = $GLOBALS['disable_translation'] ?? null;
        $this->previousTimezone = date_default_timezone_get();
        $GLOBALS['disable_translation'] = true;
        date_default_timezone_set('America/New_York');
    }

    protected function tearDown(): void
    {
        if ($this->hadDisableTranslation) {
            $GLOBALS['disable_translation'] = $this->previousDisableTranslation;
        } else {
            unset($GLOBALS['disable_translation']);
        }
        date_default_timezone_set($this->previousTimezone);

        foreach ($this->tempFiles as $path) {
            if (is_file($path)) {
                unlink($path);
            }
        }
        $this->tempFiles = [];
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function interiorNulDateCells(): iterable
    {
        yield 'hyphen unquoted' => ["2026-\0" . '12-25'];
        yield 'hyphen quoted' => ['"' . "2026-\0" . '12-25"'];
        yield 'slash unquoted' => ["2026/12/\0" . '25'];
        yield 'slash quoted' => ['"' . "2026/12/\0" . '25"'];
    }

    #[DataProvider('interiorNulDateCells')]
    public function testInteriorNulInFirstDateIsARegularRowError(string $dateCell): void
    {
        $rows = [];
        $error = null;
        try {
            foreach ($this->parseString($dateCell . ",Bad\n") as $row) {
                $rows[] = $row;
            }
        } catch (InvalidHolidayCsvException $e) {
            $error = $e;
        }

        self::assertSame([], $rows, 'An invalid first row must not be yielded');
        self::assertInstanceOf(InvalidHolidayCsvException::class, $error);
        self::assertSame(1, $error->rowNumber);
        self::assertSame('Row 1: Invalid date format in CSV', $error->getMessage());
    }

    #[DataProvider('interiorNulDateCells')]
    public function testInteriorNulAfterHeaderAndValidRowPreservesStreamedPrefix(string $dateCell): void
    {
        $csv = "date,description\n2026-12-24,Valid prefix\n" . $dateCell . ",Bad\n";
        $rows = [];
        $error = null;
        try {
            foreach ($this->parseString($csv) as $row) {
                $rows[] = $row;
            }
        } catch (InvalidHolidayCsvException $e) {
            $error = $e;
        }

        self::assertCount(1, $rows, 'The valid prefix must be yielded before the error');
        self::assertSame('2026-12-24', $rows[0]->dateForStorage());
        self::assertSame('Valid prefix', $rows[0]->description);
        self::assertInstanceOf(InvalidHolidayCsvException::class, $error);
        self::assertSame(3, $error->rowNumber);
        self::assertSame('Row 3: Invalid date format in CSV', $error->getMessage());
    }

    /**
     * @return iterable<string, array{string, string}>
     */
    public static function acceptedDates(): iterable
    {
        yield 'canonical hyphen' => ['2026-12-25', '2026-12-25'];
        yield 'canonical slash' => ['2026/12/25', '2026-12-25'];
        yield 'leap day hyphen' => ['2024-02-29', '2024-02-29'];
        yield 'leap day slash' => ['2024/02/29', '2024-02-29'];
        yield 'zero year' => ['0000-01-01', '0000-01-01'];
    }

    #[DataProvider('acceptedDates')]
    public function testAcceptedDatesKeepMidnightAndDefaultTimezone(string $input, string $stored): void
    {
        $rows = iterator_to_array($this->parseString($input . ",Holiday\n"), false);

        self::assertCount(1, $rows);
        self::assertSame($stored, $rows[0]->dateForStorage());
        self::assertSame('00:00:00', $rows[0]->date->format('H:i:s'));
        self::assertSame('America/New_York', $rows[0]->date->getTimezone()->getName());
        self::assertSame('Holiday', $rows[0]->description);
    }

    /**
     * @return iterable<string, array{string, string}>
     */
    public static function trimmedDateCells(): iterable
    {
        yield 'hyphen leading and trailing NUL' => ["\0 2026-12-25 \0", '2026-12-25'];
        yield 'slash leading and trailing NUL' => ["\0 2026/12/25 \0", '2026-12-25'];
    }

    #[DataProvider('trimmedDateCells')]
    public function testEdgeNulsAndWhitespaceAreStillTrimmed(string $dateCell, string $stored): void
    {
        $rows = iterator_to_array($this->parseString('"' . $dateCell . '"' . ",Holiday\n"), false);

        self::assertCount(1, $rows);
        self::assertSame($stored, $rows[0]->dateForStorage());
    }

    public function testDescriptionKeepsInteriorNulAndTrimsItsEdges(): void
    {
        $rows = iterator_to_array(
            $this->parseString("2026-12-25,\" \0First\0Second\0 \"\n"),
            false,
        );

        self::assertCount(1, $rows);
        self::assertSame('First' . "\0" . 'Second', $rows[0]->description);
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function invalidCalendarDates(): iterable
    {
        yield 'non leap day' => ['2025-02-29'];
        yield 'overflow day' => ['2026-02-30'];
        yield 'slash overflow day' => ['2026/12/32'];
    }

    #[DataProvider('invalidCalendarDates')]
    public function testInvalidCalendarDatesAreNotNormalized(string $dateCell): void
    {
        $error = null;
        try {
            iterator_to_array($this->parseString($dateCell . ",Bad\n"), false);
        } catch (InvalidHolidayCsvException $e) {
            $error = $e;
        }

        self::assertInstanceOf(InvalidHolidayCsvException::class, $error);
        self::assertSame(1, $error->rowNumber);
        self::assertSame('Row 1: Invalid date format in CSV', $error->getMessage());
    }

    public function testBomHeaderAndBlankRowsStillAllowData(): void
    {
        $csv = "\xEF\xBB\xBFdate,description\n\n,ignored\n2026-12-25,Christmas\n";
        $rows = iterator_to_array($this->parseString($csv), false);

        self::assertCount(1, $rows);
        self::assertSame('2026-12-25', $rows[0]->dateForStorage());
        self::assertSame('Christmas', $rows[0]->description);
    }

    /** @return iterable<int, HolidayRow> */
    private function parseString(string $csv): iterable
    {
        $path = tempnam(sys_get_temp_dir(), 'holiday-csv-input-');
        if ($path === false) {
            self::fail('tempnam failed');
        }
        $this->tempFiles[] = $path;
        $written = file_put_contents($path, $csv);
        self::assertSame(strlen($csv), $written);

        return (new HolidayCsvParser())->parse($path);
    }
}
