<?php

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Common\Calendar;

use LogicException;
use OpenEMR\Common\Calendar\AppointmentTime;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

#[Group('isolated')]
#[Group('calendar')]
final class AppointmentTimeTest extends TestCase
{
    private const CLASS_FILE = __DIR__ . '/../../../../../src/Common/Calendar/AppointmentTime.php';
    private const EDITOR_FILE = __DIR__ . '/../../../../../interface/main/calendar/add_edit_event.php';
    private const ORIGINAL_SAVE_TIME_SHA256 = '66a261d7e3ca28c94b0b7e969dacedf01791eb2a80982596c7ad2b213fbb5239';
    private const CURRENT_CONVERSION = <<<'PHP'
        $meridiemValue = $_POST['form_ampm'] ?? null;
        $meridiem = is_string($meridiemValue) || is_int($meridiemValue) ? (int) $meridiemValue : 0;
        $tmph = AppointmentTime::to24Hour($tmph, $meridiem);
PHP;
    private const ORIGINAL_CONVERSION = <<<'PHP'
        if (!empty($_POST['form_ampm']) && ($_POST['form_ampm'] == '2' && $tmph < 12)) {
            $tmph += 12;
        }
PHP;

    protected function setUp(): void
    {
        self::assertFileExists(self::CLASS_FILE);
        require_once self::CLASS_FILE;
        $reflection = new ReflectionClass(AppointmentTime::class);
        $classFile = $reflection->getFileName();
        if (!is_string($classFile)) {
            throw new LogicException('AppointmentTime must be defined in a file.');
        }
        self::assertSame(realpath(self::CLASS_FILE), realpath($classFile));
        self::assertTrue($reflection->isFinal());
        self::assertTrue($reflection->getMethod('to24Hour')->isPublic());
        self::assertTrue($reflection->getMethod('to24Hour')->isStatic());
    }

    /** @return array<string, array{int, int, int}> */
    public static function twelveHourCases(): array
    {
        $cases = [];
        for ($hour = 1; $hour <= 12; ++$hour) {
            $cases["{$hour} AM"] = [$hour, 1, $hour === 12 ? 0 : $hour];
            $cases["{$hour} PM"] = [$hour, 2, $hour === 12 ? 12 : $hour + 12];
        }
        return $cases;
    }

    #[DataProvider('twelveHourCases')]
    public function testAllTwelveHourCombinations(int $hour, int $meridiem, int $expected): void
    {
        self::assertSame($expected, AppointmentTime::to24Hour($hour, $meridiem));
    }

    /** @return array<string, array{int, int, int}> */
    public static function passthroughCases(): array
    {
        return [
            'absent meridiem midnight' => [0, 0, 0],
            'absent meridiem noon' => [12, 0, 12],
            'absent meridiem late hour' => [23, 0, 23],
            'zero AM from availability callback' => [0, 1, 0],
            'zero PM keeps prior adjustment' => [0, 2, 12],
            '24 hour with absent meridiem' => [24, 0, 24],
            'unusual high AM hour' => [25, 1, 25],
            'unusual high PM hour' => [25, 2, 25],
            'negative hour unchanged' => [-1, 0, -1],
        ];
    }

    #[DataProvider('passthroughCases')]
    public function testExistingPassthroughAndUnusualValues(int $hour, int $meridiem, int $expected): void
    {
        self::assertSame($expected, AppointmentTime::to24Hour($hour, $meridiem));
    }

    public function testCallerCanRetainMinutesAndDurationAcrossMidnight(): void
    {
        $hour = AppointmentTime::to24Hour(12, 1);
        $minute = 37;
        $duration = 45;

        self::assertSame('0:37:00', "$hour:$minute:00");
        self::assertSame(82, $hour * 60 + $minute + $duration);
    }

    public function testSaveAndDuplicateEditorPathNarrowsMeridiemBeforeConversion(): void
    {
        $save = self::saveTimeSource();
        self::assertSame(1, substr_count($save, self::CURRENT_CONVERSION));
        self::assertMatchesRegularExpression('/\$tmph = \(int\) \$_POST\[\'form_hour\'\] \+ 0;\s+\$tmpm = \(int\) \$_POST\[\'form_minute\'\] \+ 0;/', $save);
        self::assertStringContainsString('is_string($meridiemValue) || is_int($meridiemValue) ? (int) $meridiemValue : 0', $save);
    }

    /** @return array<string, array{int, int, int}> */
    public static function additionalNativeConversionCases(): array
    {
        return [
            'midnight' => [12, 1, 0],
            'noon' => [12, 2, 12],
            'ordinary AM' => [9, 1, 9],
            'ordinary PM' => [9, 2, 21],
            'last AM hour' => [11, 1, 11],
            'last PM hour' => [11, 2, 23],
            '24 hour without meridiem' => [23, 0, 23],
            '24 hour midnight' => [0, 0, 0],
        ];
    }

    #[DataProvider('additionalNativeConversionCases')]
    public function testAdditionalNativeHelperCases(int $hour, int $meridiem, int $expected): void
    {
        self::assertSame($expected, AppointmentTime::to24Hour($hour, $meridiem));
    }

    public function testSaveTimeSourcePreservesOriginalBlockOutsideConversion(): void
    {
        self::assertTrue(self::preservesOriginalSaveTime(self::saveTimeSource()));
    }

    public function testSaveTimePreservationRejectsUnrelatedMutations(): void
    {
        $source = self::saveTimeSource();
        $mutations = [
            ['$duration = abs($_POST[\'form_duration\'])', '$duration = 0'],
            ['$tmpm = (int) $_POST[\'form_minute\'] + 0;', '$tmpm = 0;'],
            ['$endtime = "$tmph:$tmpm:00";', '$endtime = "$tmph:00:00";'],
            ['if ($_POST[\'form_allday\']) {', 'if (false) {'],
        ];
        foreach ($mutations as [$original, $mutation]) {
            self::assertSame(1, substr_count($source, $original));
            self::assertFalse(self::preservesOriginalSaveTime(str_replace($original, $mutation, $source)));
        }
    }

    private static function saveTimeSource(): string
    {
        $source = file_get_contents(self::EDITOR_FILE);
        self::assertIsString($source);
        $startMarker = '// Compute start and end time strings to be saved.';
        $endMarker = '// Set up working variables related to repeated events.';
        self::assertSame(1, substr_count($source, $startMarker));
        self::assertSame(1, substr_count($source, $endMarker));
        $start = strpos($source, $startMarker);
        self::assertNotFalse($start);
        $end = strpos($source, $endMarker, $start);
        self::assertNotFalse($end);
        return substr($source, $start, $end - $start);
    }

    private static function preservesOriginalSaveTime(string $source): bool
    {
        $normalized = str_replace(self::CURRENT_CONVERSION, self::ORIGINAL_CONVERSION, $source, $count);
        return $count === 1 && hash('sha256', $normalized) === self::ORIGINAL_SAVE_TIME_SHA256;
    }

    public function testAppointmentScriptHasIndependentFileVersionBeforeMarkup(): void
    {
        $source = file_get_contents(self::EDITOR_FILE);
        self::assertIsString($source);
        $markup = strpos($source, '<!DOCTYPE html>');
        self::assertNotFalse($markup);
        $setup = substr($source, 0, $markup);
        self::assertMatchesRegularExpression('/\$appointmentScriptVersion\s*=\s*.*?sprintf\(\s*[\'\"]%d[\'\"]\s*,/s', $setup);
        self::assertMatchesRegularExpression('/is_file\(\s*__DIR__\s*\.\s*[\'\"]\/add_edit_event\.js[\'\"]\s*\)/', $setup);
        self::assertMatchesRegularExpression('/filemtime\(\s*__DIR__\s*\.\s*[\'\"]\/add_edit_event\.js[\'\"]\s*\)/', $setup);
        self::assertMatchesRegularExpression('/(?:false\s*\?\s*[\'\"]0[\'\"]|\?\?\s*0|\?:\s*0)/', $setup);

        self::assertMatchesRegularExpression(
            '/<script\s+src="add_edit_event\.js\?v=<\?php\s+echo\s+attr\(\$appointmentScriptVersion\);\s*\?>"><\/script>/',
            $source
        );
    }
}
