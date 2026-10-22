<?php

/** CLI-only configuration for loading the shipped calendar functions in an isolated process. */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Common\Calendar\Fixtures;

use Doctrine\DBAL\Connection;
use OpenEMR\BC\Database;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\OEGlobalsBag;
use PHPUnit\Framework\MockObject\MockObject;
use ReflectionFunction;
use ReflectionProperty;
use RuntimeException;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

if (PHP_SAPI !== 'cli') {
    throw new RuntimeException('Calendar source fixture is CLI only.');
}

final class RepeatOnWindowFixture
{
    public static function load(Connection $mockConnection): void
    {
        if (!$mockConnection instanceof MockObject) {
            throw new RuntimeException('Calendar database transport must be a PHPUnit mock.');
        }

        $root = dirname(__DIR__, 6);
        $api = $root . '/interface/main/calendar/includes/pnAPI.php';
        $mod = $root . '/interface/main/calendar/includes/pnMod.php';
        $calendar = $root . '/interface/main/calendar/modules/PostCalendar/pnuserapi.php';
        $databaseSource = $root . '/src/BC/Database.php';
        foreach ([$api, $mod, $calendar, $databaseSource] as $source) {
            if (realpath($source) !== $source || !is_file($source)) {
                throw new RuntimeException('Calendar fixture source is missing or redirected.');
            }
        }

        // Inspect the transport and legacy lookup paths before executing either include.
        $apiSource = file_get_contents($api);
        $modSource = file_get_contents($mod);
        $databaseText = file_get_contents($databaseSource);
        if (
            $apiSource === false || $modSource === false || $databaseText === false
            || !str_contains($apiSource, 'return Database::instance()->getDbalConnection();')
            || !str_contains($modSource, '$conn = pnDBGetConn();')
            || !str_contains($modSource, 'function pnModGetIDFromName(')
            || !str_contains($modSource, 'function pnModGetInfo(')
            || !str_contains($databaseText, 'private static ?Database $instance = null;')
            || !str_contains($databaseText, 'private readonly Connection $conn,')
        ) {
            throw new RuntimeException('Legacy database path differs from the inspected fixture contract.');
        }

        $instance = new Database($mockConnection);
        $singleton = new ReflectionProperty(Database::class, 'instance');
        if ($singleton->getValue() !== null) {
            throw new RuntimeException('Database singleton was already initialized.');
        }
        $singleton->setValue(null, $instance);
        $connection = new ReflectionProperty(Database::class, 'conn');
        if (Database::instance() !== $instance || $connection->getValue($instance) !== $mockConnection) {
            throw new RuntimeException('Legacy database transport is not the PHPUnit connection mock.');
        }

        // pnAPI.php extracts process superglobals at top level. Keep them empty.
        $_REQUEST = $_ENV = $_SERVER = $_POST = $_GET = $_COOKIE = $_SESSION = $_FILES = [];
        $GLOBALS['pntable'] = [
            'modules' => 'fixture_modules',
            'modules_column' => [
                'id' => 'fixture_modules.pn_id',
                'name' => 'fixture_modules.pn_name',
                'type' => 'fixture_modules.pn_type',
                'directory' => 'fixture_modules.pn_directory',
                'regid' => 'fixture_modules.pn_regid',
                'displayname' => 'fixture_modules.pn_displayname',
                'description' => 'fixture_modules.pn_description',
                'version' => 'fixture_modules.pn_version',
            ],
        ];
        $GLOBALS['pnmodvar'] = ['PostCalendar' => array_fill_keys([
            'pcUsePopups', 'pcUseInternationalDates', 'pcEventsOpenInNewWindow',
            'pcDayHighlightColor', 'pcFirstDayOfWeek', 'pcEventDateFormat',
            'pcTime24Hours', 'pcAllowDirectSubmit', 'pcDisplayTopics',
            'pcAllowSiteWide', 'pcAllowUserCalendar', 'pcTimeIncrement',
            'pcListHowManyEvents', 'pcTemplate', 'pcShowEventsInYear',
            'pcUseCache', 'pcCacheLifetime', 'pcDefaultView', 'pcSafeMode',
            'pcNotifyAdmin', 'pcNotifyEmail',
        ], 0)];
        foreach (['Date', 'jumpday', 'jumpmonth', 'jumpyear', 'jumpdate'] as $input) {
            $GLOBALS[$input] = null;
        }

        $globals = OEGlobalsBag::getInstance();
        $globals->set('fileroot', $root);
        $globals->set('srcdir', $root . '/library');
        $globals->set('disable_translation', true);
        SessionWrapperFactory::getInstance()->setActiveSession(new Session(new MockArraySessionStorage()));
        if (!function_exists('xl')) {
            throw new RuntimeException('Composer bootstrap did not load xl().');
        }

        require_once $api;
        require_once $mod;
        foreach (['pnVarPrepForOS', 'pnVarCleanFromInput', 'pnDBGetConn'] as $name) {
            if ((new ReflectionFunction($name))->getFileName() !== $api) {
                throw new RuntimeException("Unexpected source for $name.");
            }
        }
        foreach (['pnModGetVar', 'pnModGetIDFromName', 'pnModGetInfo'] as $name) {
            if ((new ReflectionFunction($name))->getFileName() !== $mod) {
                throw new RuntimeException("Unexpected source for $name.");
            }
        }
        if (\pnDBGetConn() !== $mockConnection) {
            throw new RuntimeException('Legacy pnDBGetConn bypassed the mock.');
        }

        $previousDirectory = getcwd();
        if ($previousDirectory === false || !chdir($root . '/interface/main/calendar')) {
            throw new RuntimeException('Cannot enter fixed calendar source directory.');
        }
        try {
            require_once $calendar;
        } finally {
            chdir($previousDirectory);
        }
    }
}
