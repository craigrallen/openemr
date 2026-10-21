<?php

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Common\Calendar;

use LogicException;
use OpenEMR\Common\Calendar\AppointmentTime;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use UnexpectedValueException;

#[Group('isolated')]
#[Group('calendar')]
final class AppointmentTimeTest extends TestCase
{
    private const CLASS_FILE = __DIR__ . '/../../../../../src/Common/Calendar/AppointmentTime.php';
    private const EDITOR_FILE = __DIR__ . '/../../../../../interface/main/calendar/add_edit_event.php';

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

    public function testSaveAndDuplicateEditorPathUsesConversionAfterExistingIntegerParse(): void
    {
        $source = file_get_contents(self::EDITOR_FILE);
        self::assertIsString($source);
        $start = strpos($source, 'if (!empty($_POST[\'form_action\']) && ($_POST[\'form_action\'] == "duplicate" || $_POST[\'form_action\'] == "save"))');
        self::assertNotFalse($start);
        $end = strpos($source, '$duration = abs($_POST[\'form_duration\'])', $start);
        self::assertNotFalse($end);
        $save = substr($source, $start, $end - $start);

        self::assertMatchesRegularExpression(
            '/\$tmph\s*=\s*\(int\)\s*\$_POST\[\'form_hour\'\].*?AppointmentTime::to24Hour\(\$tmph,\s*\(int\)\s*\(\$_POST\[\'form_ampm\'\]\s*\?\?\s*0\)\)/s',
            $save
        );
    }

    /** @return array<string, array{string, string, string, ?string, string, string, string, int}> */
    public static function saveTimeCases(): array
    {
        return [
            'save midnight' => ['save', '12', '37', '1', '0', '0:37:00', '1:22:00', 45],
            'duplicate midnight' => ['duplicate', '12', '37', '1', '0', '0:37:00', '1:22:00', 45],
            'save noon' => ['save', '12', '37', '2', '0', '12:37:00', '13:22:00', 45],
            'duplicate noon' => ['duplicate', '12', '37', '2', '0', '12:37:00', '13:22:00', 45],
            'ordinary AM' => ['save', '9', '37', '1', '0', '9:37:00', '10:22:00', 45],
            'ordinary PM' => ['duplicate', '9', '37', '2', '0', '21:37:00', '22:22:00', 45],
            '24 hour without meridiem' => ['save', '23', '37', null, '0', '23:37:00', '24:22:00', 45],
            'all day' => ['save', '12', '37', '1', '1', '0:0:00', '24:0:00', 1440],
        ];
    }

    #[DataProvider('saveTimeCases')]
    public function testActualSaveTimeSourceInIsolation(
        string $action,
        string $hour,
        string $minute,
        ?string $meridiem,
        string $allDay,
        string $expectedStart,
        string $expectedEnd,
        int $expectedDuration
    ): void {
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
        $saveTimeSource = substr($source, $start, $end - $start);

        $previousPost = $_POST;
        try {
            $_POST = [
                'form_action' => $action,
                'form_allday' => $allDay,
                'form_hour' => $hour,
                'form_minute' => $minute,
                'form_duration' => '45',
            ];
            if ($meridiem !== null) {
                $_POST['form_ampm'] = $meridiem;
            }
            $actual = (static function () use ($saveTimeSource): array {
                $result = eval('use OpenEMR\\Common\\Calendar\\AppointmentTime; '
                    . $saveTimeSource . ' return [$starttime, $endtime, $duration];');
                if (!is_array($result)) {
                    throw new UnexpectedValueException('Appointment time source must return an array.');
                }
                return $result;
            })();
            self::assertSame([$expectedStart, $expectedEnd, $expectedDuration], $actual);
        } finally {
            $_POST = $previousPost;
        }
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
