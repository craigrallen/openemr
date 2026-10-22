<?php

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Calendar;

use OpenEMR\PostCalendar\ViewModel\CalendarViewModel;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\TestCase;
use Twig\Environment;
use Twig\Loader\FilesystemLoader;
use Twig\TwigFilter;

#[Group('isolated')]
#[Group('postcalendar')]
final class CalendarEventEditorAccessTest extends TestCase
{
    private const SHARED = 'calendar/default/views/_calendar_screen_js.html.twig';

    private static function root(): string
    {
        return dirname(__DIR__, 4);
    }

    private static function renderSharedScript(): string
    {
        $twig = new Environment(new FilesystemLoader(self::root() . '/templates'), ['cache' => false]);
        // The shipped template uses these production escaping functions. Register only
        // its two filters, with no application container or database initialization.
        $twig->addFilter(new TwigFilter('js_escape', \js_escape(...)));
        $twig->addFilter(new TwigFilter('attr_url', \attr_url(...)));

        return $twig->render(self::SHARED, [
            'webroot' => '/oe',
            'viewtype' => 'day',
            'Date' => '20261001',
            'timeslotCss' => '20px',
            'timeslotHeightVal' => 20,
            'isHolidayDay' => false,
            'calendarSidebarVersion' => '1',
        ]);
    }

    public function testShippedSharedScriptEnhancesOnlyNativeEventTimeAnchorsInAppointments(): void
    {
        $html = self::renderSharedScript();

        self::assertStringContainsString('a.event_time:not([href])', $html);
        self::assertStringContainsString('.event_appointment', $html);
        self::assertStringContainsString('tabindex', $html);
        self::assertStringContainsString('role', $html);
        self::assertStringContainsString('keydown', $html);
        self::assertStringContainsString('event_time_click', $html);
    }

    public function testAllScreenViewsIncludeSharedScriptAndPrintViewsDoNot(): void
    {
        foreach (['day', 'week', 'month'] as $view) {
            $source = file_get_contents(self::root() . "/templates/calendar/default/views/$view/ajax_template.html.twig");
            self::assertIsString($source);
            self::assertSame(1, substr_count($source, "{% include '" . self::SHARED . "' %}"), $view);
        }

        foreach (['day_print', 'week_print', 'month_print'] as $view) {
            $source = file_get_contents(self::root() . "/templates/calendar/default/views/$view/outlook_ajax_template.html.twig");
            self::assertIsString($source);
            self::assertStringNotContainsString(self::SHARED, $source, $view);
            self::assertStringNotContainsString('event_time_click', $source, $view);
        }
    }

    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function testNativeAnchorHelperRetainsOriginalClickTextAndTitle(): void
    {
        $GLOBALS['disable_translation'] = true;
        $html = CalendarViewModel::eventTimeAnchorHtml('10:00 <early>');

        self::assertSame(
            "<a class='event_time' onclick='event_time_click(this)' title='Click to edit'>10:00 &lt;early&gt;</a>",
            $html
        );
        self::assertStringNotContainsString('href=', $html);
        self::assertStringNotContainsString('tabindex=', $html);
    }
}
