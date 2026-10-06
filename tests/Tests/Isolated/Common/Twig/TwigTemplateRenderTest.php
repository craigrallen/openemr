<?php

/**
 * Render Twig templates with known parameters and compare output to fixtures.
 *
 * The compilation test (TwigTemplateCompilationTest) verifies that every
 * template parses and references valid filters/functions, but never renders
 * templates with actual data. This test fills that gap: it renders real
 * templates with fixture data and asserts the full HTML output matches
 * an expected file, catching structural bugs like wrong attributes, missing
 * prefixes, or broken escaping.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Michael A. Smith <michael@opencoreemr.com>
 * @copyright Copyright (c) 2026 OpenCoreEMR Inc <https://opencoreemr.com/>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Isolated\Common\Twig;

use OpenEMR\Common\Twig\TwigContainer;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\PostCalendar\PostCalendarTwigExtension;
use OpenEMR\Services\Patient\DuplicatePatientColumn;
use OpenEMR\Services\Patient\DuplicatePatientGroup;
use OpenEMR\Services\Patient\DuplicatePatientRow;
use OpenEMR\Services\Patient\PatientMergeResult;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Twig\Environment;
use Twig\TwigFunction;

#[Group('isolated')]
#[Group('twig')]
class TwigTemplateRenderTest extends TestCase
{
    private static ?Environment $twig = null;

    /**
     * @param array<string, mixed> $values
     * @return array<string, mixed>
     */
    private static function billingCardDetailsParameters(array $values): array
    {
        return array_merge([
            'id' => 'billing_ps_expand',
            'title' => 'Billing',
            'initiallyCollapsed' => false,
            'forceAlwaysOpen' => false,
            'hideBtn' => true,
            'card_bg_color' => '',
            'card_text_color' => '',
            'btnLabel' => false,
            'btnLink' => 'test',
            'prependedInjection' => '',
            'appendedInjection' => '',
        ], $values);
    }

    /**
     * Shape of display_layout_tabs() output (library/options.inc.php) for a site whose
     * layout renames and adds DEM groups. Stands in for the DB-backed renderer.
     */
    private const DEMOGRAPHICS_TAB_ROW = "<li class=\"current\">\n"
        . "<a href=\"#\" id=\"header_tab_Who\">\nWho</a>\n</li>\n"
        . "<li >\n<a href=\"#\" id=\"header_tab_Contact\">\nContact</a>\n</li>\n"
        . "<li >\n<a href=\"#\" id=\"header_tab_Clinic Extras\">\nClinic Extras</a>\n</li>\n";

    /**
     * Shape of display_layout_tabs_data() output: arbitrary colspans, a subgroup heading with
     * its spacer, a long unbroken value, a link, a bordered field, an empty value and a warning.
     */
    private const DEMOGRAPHICS_TAB_DATA = "<div class='tab current'>\n<table border='0' cellpadding='0'>\n"
        . "<tr><td class='label_custom' colspan='1' id='label_fname'><span class='text-nowrap mr-2'><span id='label_fname'>Name:</span></span></td>"
        . "<td class='text data' colspan='3' id='text_fname'  data-value='Synthetic'><span id='text_fname' style='display: none'>Synthetic</span>Synthetic Example-Patient</td></tr>\n"
        . "<tr><td class='label' style='background-color: var(--gray300); padding: 4px' colspan='4'>Identifiers</td></tr>\n"
        . "<tr><td class='label' style='height: 5px' colspan='4'></td></tr>\n"
        . "<tr><td class='label_custom' colspan='1' id='label_ss'><span class='text-nowrap mr-2'><span id='label_ss'>S.S.:</span></span></td>"
        . "<td class='text data' colspan='1' id='text_ss'  data-value=''><span id='text_ss' style='display: none'></span>&nbsp;</td>"
        . "<td class='label_custom' colspan='1' id='label_DOB'><span class='text-nowrap mr-2'><span id='label_DOB'>DOB:</span></span></td>"
        . "<td class='text data' colspan='1' id='text_DOB'  data-value='1970-01-01' style='border: 1px solid var(--gray400)'><span id='text_DOB' style='display: none'>1970-01-01</span>1970-01-01</td></tr>\n"
        . "</table>\n</div>\n"
        . "<div class='tab'>\n<table border='0' cellpadding='0'>\n"
        . "<tr><td class='label_custom' colspan='1' id='label_email'><span class='text-nowrap mr-2'><span id='label_email'>Email:</span></span></td>"
        . "<td class='text data' colspan='3' id='text_email'  data-value='synthetic.patient.with.a.very.long.unbroken.address@example-clinic-domain.invalid'><span id='text_email' style='display: none'>synthetic.patient.with.a.very.long.unbroken.address@example-clinic-domain.invalid</span><a href='mailto:synthetic.patient.with.a.very.long.unbroken.address@example-clinic-domain.invalid'>synthetic.patient.with.a.very.long.unbroken.address@example-clinic-domain.invalid</a></td></tr>\n"
        . "</table>\n</div>\n"
        . "<div class='tab'>\n<table border='0' cellpadding='0'>\n"
        . "<tr><td class='label_custom' colspan='1' id='label_userlist1'><span class='text-nowrap mr-2'><span id='label_userlist1'>Clinic Extra:</span></span></td>"
        . "<td class='text data' colspan='3' id='text_userlist1'  data-value='x'><span id='text_userlist1' style='display: none'>x</span><span class='text-danger'>Unverified</span></td></tr>\n"
        . "</table>\n</div>\n";

    /** @var list<array{string, mixed, mixed}> */
    private static array $layoutTabCalls = [];

    /**
     * The rendering globals as they were before this class first touched them.
     *
     * Captured at the first mutation rather than in setUpBeforeClass(), because PHPUnit resolves
     * data providers before any class fixture runs and this provider has to set them to build the
     * duplicate-report columns.
     *
     * @var array<string, array{present: bool, value: mixed}>|null
     */
    private static ?array $globalsSnapshot = null;

    /** Mirrors DuplicatePatientService::HIGHLIGHT_THRESHOLD; kept local so fixtures stay stable. */
    private const HIGHLIGHT = 17;

    /**
     * Stand-in for the release value version.php assigns to v_js_includes.
     *
     * Pinned so fixtures render a stable cache-buster: a template that drops
     * `?v={{ assetVersion|attr_url }}` shows up as a fixture diff rather than
     * rendering an empty `?v=` that asserts nothing.
     */
    private const ASSET_VERSION = 82;

    protected function setUp(): void
    {
        self::applyRenderingGlobals();
        self::applyAssetVersion();
    }

    /**
     * PHPUnit runs these tests in the same process as everything else, so the globals this class
     * needs must not outlive it.
     */
    public static function tearDownAfterClass(): void
    {
        if (self::$globalsSnapshot === null) {
            return;
        }

        $globals = OEGlobalsBag::getInstance();
        foreach (self::$globalsSnapshot as $key => $original) {
            if ($original['present']) {
                $globals->set($key, $original['value']);
                continue;
            }
            $globals->remove($key);
            // The singleton reads $GLOBALS as its source of truth, so restoring a key to "absent"
            // has to clear it there too -- remove() alone only empties the bag's own array.
            unset($GLOBALS[$key]);
        }

        self::$globalsSnapshot = null;
        self::$twig = null;
    }

    /**
     * Set the globals rendering needs, remembering what they were the first time round.
     *
     * fileroot and date_display_format keep any value the surrounding suite already established;
     * disable_translation is forced so xl() returns the source string and xlt()/xla() apply only
     * escaping, rather than reaching for the translation tables.
     */
    private static function applyRenderingGlobals(): void
    {
        $globals = OEGlobalsBag::getInstance();

        if (self::$globalsSnapshot === null) {
            self::$globalsSnapshot = [];
            foreach (['fileroot', 'date_display_format', 'disable_translation', 'v_js_includes'] as $key) {
                self::$globalsSnapshot[$key] = [
                    'present' => $globals->has($key),
                    'value' => $globals->get($key),
                ];
            }
        }

        if (!$globals->has('fileroot')) {
            $globals->set('fileroot', self::fileroot());
        }
        if (!$globals->has('date_display_format')) {
            $globals->set('date_display_format', 0);
        }
        $globals->set('disable_translation', true);
    }

    /**
     * Pin the asset cache-buster to ASSET_VERSION.
     *
     * Deliberately not folded into applyRenderingGlobals(): renderCaseProvider() calls that, and
     * PHPUnit resolves every data provider before any test runs, so setting v_js_includes there
     * pins it for the whole process before this class's tests -- and before unrelated ones.
     * TwigExtensionIsolatedTest::testGetGlobals asserts assetVersion is null and would fail.
     * applyRenderingGlobals() still snapshots the key, so tearDownAfterClass restores it.
     */
    private static function applyAssetVersion(): void
    {
        OEGlobalsBag::getInstance()->set('v_js_includes', self::ASSET_VERSION);
    }

    /**
     * @param array<string, mixed> $parameters
     */
    #[Test]
    #[DataProvider('renderCaseProvider')]
    public function templateRendersExpectedOutput(string $templateName, array $parameters, string $fixturePath): void
    {
        $twig = self::twigEnvironment();
        // Normalize immediately so fixtures and comparisons use the same form.
        // Twig's block processing leaves trailing whitespace on empty lines;
        // stripping it here keeps fixture files clean for pre-commit hooks.
        $rendered = self::normalizeTrailingWhitespace(
            $twig->render($templateName, $parameters)
        );

        // @codeCoverageIgnoreStart
        if (getenv('UPDATE_FIXTURES') === '1') {
            file_put_contents($fixturePath, $rendered);
            self::markTestSkipped("Fixture updated: $fixturePath");
        }
        // @codeCoverageIgnoreEnd

        $expected = file_get_contents($fixturePath);
        self::assertIsString($expected, "Failed to read fixture: $fixturePath");
        self::assertSame(
            $expected,
            $rendered,
            "Rendered output does not match fixture: $fixturePath\n"
            . "If you modified this template, update fixtures with: composer update-twig-fixtures\n"
            . "Review the changes with `git diff` before committing."
        );
    }

    /**
     * Every dashboard card's toggle reports the body's real initial state, keeps its Bootstrap
     * target, and a forced-open (critical) card can never render with a hidden body.
     */
    #[Test]
    #[DataProvider('cardCollapseStateProvider')]
    public function cardToggleMatchesInitialBodyState(bool $initiallyCollapsed, bool $forceAlwaysOpen, bool $expectOpen): void
    {
        $html = self::twigEnvironment()->render('patient/card/care_plan.html.twig', [
            'id' => 'card_care_plan',
            'title' => 'Care Plan',
            'initiallyCollapsed' => $initiallyCollapsed,
            'forceAlwaysOpen' => $forceAlwaysOpen,
            'auth' => false,
            'card_bg_color' => '',
            'card_text_color' => '',
            'pid' => 1,
            'rows' => [],
            'mostRecentDate' => null,
            'encounter' => null,
        ]);

        $dom = new \DOMDocument();
        self::assertTrue($dom->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NOERROR | LIBXML_NONET));
        $xpath = new \DOMXPath($dom);
        $toggles = $xpath->query('//h6[contains(@class, "card-title")]/a[@aria-controls="card_care_plan"]');
        self::assertNotFalse($toggles);
        self::assertSame(1, $toggles->length);
        $toggle = $toggles->item(0);
        self::assertInstanceOf(\DOMElement::class, $toggle);
        $body = $dom->getElementById('card_care_plan');
        self::assertInstanceOf(\DOMElement::class, $body);
        $bodyClasses = explode(' ', $body->getAttribute('class'));
        $icons = $xpath->query('.//i', $toggle);
        self::assertNotFalse($icons);
        $icon = $icons->item(0);
        self::assertInstanceOf(\DOMElement::class, $icon);
        $iconClasses = preg_split('/\s+/', trim($icon->getAttribute('class'))) ?: [];

        self::assertContains('collapse', $bodyClasses);
        self::assertSame($expectOpen, in_array('show', $bodyClasses, true));
        self::assertSame($expectOpen ? 'true' : 'false', $toggle->getAttribute('aria-expanded'));
        self::assertContains($expectOpen ? 'fa-compress' : 'fa-expand', $iconClasses);
        self::assertSame('#card_care_plan', $icon->getAttribute('data-target'));
        if ($forceAlwaysOpen) {
            self::assertFalse($toggle->hasAttribute('data-toggle'));
            return;
        }
        self::assertSame('collapse', $toggle->getAttribute('data-toggle'));
        self::assertSame('#card_care_plan', $toggle->getAttribute('data-target'));
    }

    /**
     * @return array<string, array{bool, bool, bool}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function cardCollapseStateProvider(): array
    {
        return [
            'open by preference' => [false, false, true],
            'collapsed by preference' => [true, false, false],
            'always open' => [false, true, true],
            'always open ignores a collapsed preference' => [true, true, true],
        ];
    }

    /**
     * The day/week/month sidebar toggle is a named button controlling the sidebar, keeps its
     * original href/handler, and the state helper loads after that handler on screen views only.
     */
    #[Test]
    public function calendarScreenSidebarToggleIsNamedAndWired(): void
    {
        $twig = self::twigEnvironment();
        $cases = iterator_to_array(self::renderCaseProvider());
        foreach (['day', 'week', 'month'] as $view) {
            self::assertArrayHasKey("calendar {$view}-screen empty", $cases);
            self::assertArrayHasKey("calendar {$view}_print empty", $cases);
            [$template, $parameters] = $cases["calendar {$view}-screen empty"];
            $html = $twig->render($template, $parameters);

            self::assertSame(1, preg_match('/<a id="menu-toggle"[^>]*>/', $html, $match), $view);
            $tag = $match[0];
            foreach (
                [
                    'href="#"',
                    'role="button"',
                    'aria-controls="bottomLeft"',
                    'aria-label="Toggle Calendar Sidebar"',
                    'title="Toggle Calendar Sidebar"',
                ] as $attribute
            ) {
                self::assertStringContainsString($attribute, $tag, $view);
            }
            self::assertStringContainsString('<div id="bottomLeft" class="sidebar-wrapper">', $html, $view);

            $original = strpos($html, '$("#wrapper").toggleClass("toggled");');
            // Versioned by the helper file's own mtime (CalendarRenderDataBuilder), not the global assetVersion.
            $helper = strpos($html, '<script src="/interface/clinical-workspace/calendar-sidebar.js?v=1700000321"></script>');
            self::assertStringNotContainsString('calendar-sidebar.js?v=' . self::ASSET_VERSION, $html, $view);
            self::assertIsInt($original, $view);
            self::assertIsInt($helper, $view);
            self::assertGreaterThan($original, $helper, $view);

            [$printTemplate, $printParameters] = $cases["calendar {$view}_print empty"];
            self::assertStringNotContainsString('calendar-sidebar.js', $twig->render($printTemplate, $printParameters), $view);
        }
    }

    /**
     * The day-screen workday summary carries the slot geometry the builder used, every
     * label the script requires (and no current-time "next" labels), and its assets; the
     * toolbar anchors it proxies keep their original handlers.
     */
    #[Test]
    public function calendarDayScreenWorkdaySummaryMetadata(): void
    {
        $twig = self::twigEnvironment();
        $cases = iterator_to_array(self::renderCaseProvider());
        [$template, $parameters] = $cases['calendar day-screen empty'];
        $html = $twig->render($template, array_merge($parameters, [
            'timeRows' => [
                ['hour' => 8, 'minute' => 0, 'startampm' => 1, 'isOnTheHour' => true, 'displayLabel' => '8:00'],
                ['hour' => 8, 'minute' => 15, 'startampm' => 1, 'isOnTheHour' => false, 'displayLabel' => '8:15'],
            ],
            'timeslotHeightVal' => 20,
            'workdayCssVersion' => '1700000700',
            'workdayJsVersion' => '1700000800',
        ]));

        self::assertSame(1, preg_match('/<section id="oe-calendar-workday"[^>]*>/', $html, $match));
        $tag = $match[0];
        foreach (
            [
                ' hidden ',
                'aria-labelledby="oe-cal-workday-title"',
                'data-date="20260315"',
                'data-slot-start-min="480"',
                'data-slot-interval-min="15"',
                'data-slot-height="20"',
                'data-l-count-one="1 booking · Providers: {providers}"',
                'data-l-count="{count} bookings · Providers: {providers}"',
                'data-l-empty="No bookings for the selected providers on this day"',
                'data-l-unavailable="No schedule loaded"',
                'data-l-first="First booking"',
                'data-l-time-unknown="Start time not available"',
            ] as $attribute
        ) {
            self::assertStringContainsString($attribute, $tag);
        }
        self::assertDoesNotMatchRegularExpression('/data-l-(next|none-remaining)=/', $tag);
        self::assertStringNotContainsString('data-is-today', $tag);

        self::assertStringContainsString('data-oe-workday-action="new-appointment" title="New Appointment" onclick="newEvt(1, 9, 00, &quot;20260315&quot;, 0, 0)"', $html);
        self::assertStringContainsString('data-oe-workday-action="today" onclick="GoToToday(theform);"', $html);
        self::assertStringContainsString('<button type="button" class="btn btn-sm btn-outline-secondary" data-role="today" hidden>', $html);
        self::assertStringContainsString('<link rel="stylesheet" href="/interface/clinical-workspace/calendar-workday.css?v=1700000700">', $html);
        self::assertStringContainsString('<script src="/interface/clinical-workspace/calendar-workday.js?v=1700000800"></script>', $html);
        // The global cache-buster must not stand in for the per-file versions.
        self::assertStringNotContainsString('calendar-workday.css?v=' . self::ASSET_VERSION, $html);

        // Without slot rows the geometry is left empty so the script withholds times.
        $empty = $twig->render($template, $parameters);
        self::assertStringContainsString('data-slot-start-min="" data-slot-interval-min=""', $empty);
        self::assertStringContainsString('data-slot-height=""', $empty);

        // On today the original Today anchor is absent, and so is its proxy.
        $today = $twig->render($template, array_merge($parameters, ['isToday' => true]));
        self::assertStringNotContainsString('data-oe-workday-action="today"', $today);
        self::assertStringNotContainsString('data-role="today"', $today);
    }

    /**
     * Provide [templateName, parameters, fixturePath] for each render test case.
     *
     * To add a new test case:
     * 1. Add a yield below with the template name, parameters, and fixture path.
     * 2. Generate the expected output file:
     *    composer update-twig-fixtures
     * 3. Review the generated fixture with `git diff` and commit it.
     *
     * @return iterable<string, array{string, array<string, mixed>, string}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function renderCaseProvider(): iterable
    {
        // Data providers run before setUp(), and building the duplicate-report columns calls xl().
        // Without this, xl() reaches for the translation tables and fails in an isolated run.
        self::applyRenderingGlobals();

        $fixtureDir = __DIR__ . '/fixtures/render';

        yield 'portal/partial/_nav_icon local link (defaults)' => [
            'portal/partial/_nav_icon.html.twig',
            [
                'id'      => 'test-nav',
                'url'     => 'testSection',
                'navText' => 'Test Nav',
                'icon'    => 'home',
            ],
            $fixtureDir . '/nav-icon-local-link.html',
        ];

        yield 'portal/partial/_nav_icon external link' => [
            'portal/partial/_nav_icon.html.twig',
            [
                'id'        => 'test-nav',
                'url'       => 'https://example.com',
                'navText'   => 'External',
                'icon'      => 'globe',
                'localLink' => false,
            ],
            $fixtureDir . '/nav-icon-external-link.html',
        ];

        yield 'oauth2/ehr-launch-autosubmit' => [
            'oauth2/ehr-launch-autosubmit.html.twig',
            [
                'endpoint' => '/oauth2/launch',
            ],
            $fixtureDir . '/ehr-launch-autosubmit.html',
        ];

        yield 'portal/login/autologin pin required' => [
            'portal/login/autologin.html.twig',
            [
                'pagetitle'              => 'Telehealth Login',
                'images_static_relative' => '/public/images',
                'pin_required'           => 1,
                'action'                 => '/portal/autologin',
                'csrf_token'             => 'test-csrf-token',
                'service_auth'           => 'test-auth-value',
            ],
            $fixtureDir . '/autologin-pin-required.html',
        ];

        yield 'portal/login/autologin no pin' => [
            'portal/login/autologin.html.twig',
            [
                'pagetitle'              => 'Telehealth Login',
                'images_static_relative' => '/public/images',
                'pin_required'           => false,
                'action'                 => '/portal/autologin',
                'csrf_token'             => 'test-csrf-token',
                'service_auth'           => 'test-auth-value',
            ],
            $fixtureDir . '/autologin-no-pin.html',
        ];

        // Appointments card test cases - verify display flag behavior
        // When user lacks permission, demographics.php doesn't render the card at all.
        // These tests verify the template correctly handles the display flags.

        yield 'patient/card/appointments all sections hidden' => [
            'patient/card/appointments.html.twig',
            [
                'title'               => 'Appointments',
                'id'                  => 'appointments_ps_expand',
                'initiallyCollapsed'  => false,
                'btnLabel'            => 'Add',
                'btnLink'             => 'return newEvt()',
                'linkMethod'          => 'javascript',
                'appts'               => [],
                'recurrAppts'         => [],
                'pastAppts'           => [],
                'displayAppts'        => false,
                'displayRecurrAppts'  => false,
                'displayPastAppts'    => false,
                'extraApptDate'       => '',
                'therapyGroupCategories' => [],
                'auth'                => false,
                'resNotNull'          => false,
            ],
            $fixtureDir . '/appointments-all-hidden.html',
        ];

        yield 'patient/card/appointments future only with empty list' => [
            'patient/card/appointments.html.twig',
            [
                'title'               => 'Appointments',
                'id'                  => 'appointments_ps_expand',
                'initiallyCollapsed'  => false,
                'btnLabel'            => 'Add',
                'btnLink'             => 'return newEvt()',
                'linkMethod'          => 'javascript',
                'appts'               => [],
                'recurrAppts'         => [],
                'pastAppts'           => [],
                'displayAppts'        => true,
                'displayRecurrAppts'  => false,
                'displayPastAppts'    => false,
                'extraApptDate'       => '',
                'therapyGroupCategories' => [],
                'auth'                => true,
                'resNotNull'          => true,
            ],
            $fixtureDir . '/appointments-future-empty.html',
        ];

        // The dashboard preference/care-team cards render the Edit pencil with
        // linkMethod 'javascript': the href stays '#' and the expression goes
        // in an onclick. A literal 'javascript:' href would be stripped to '#'
        // by |safe_href and lose the behavior entirely.
        yield 'patient/card/appointments edit button via javascript linkMethod' => [
            'patient/card/appointments.html.twig',
            [
                'title'               => 'Appointments',
                'id'                  => 'appointments_ps_expand',
                'initiallyCollapsed'  => false,
                'btnLabel'            => 'Edit',
                'btnClass'            => 'js-card-toggle-edit',
                'btnLink'             => 'event.preventDefault();',
                'linkMethod'          => 'javascript',
                'appts'               => [],
                'recurrAppts'         => [],
                'pastAppts'           => [],
                'displayAppts'        => false,
                'displayRecurrAppts'  => false,
                'displayPastAppts'    => false,
                'extraApptDate'       => '',
                'therapyGroupCategories' => [],
                'auth'                => true,
                'resNotNull'          => false,
            ],
            $fixtureDir . '/appointments-edit-javascript-link.html',
        ];

        // Calendar render cases — see CalendarRenderDataBuilder for the
        // shape each template iterates. Print views are tested with empty
        // events; the per-event content path is unit-covered by
        // CalendarRenderDataBuilderTest. Screen views are tested with
        // empty events because their per-event decoration runs through
        // dateformat() (DB-dependent).
        $emptyMini = ['monthLabel' => 'March 2026', 'weeks' => []];
        $defaultDowList = [0, 1, 2, 3, 4, 5, 6];
        $defaultDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        yield 'calendar month_print empty' => [
            'calendar/default/views/month_print/outlook_ajax_template.html.twig',
            [
                'providers'         => [['id' => 1, 'fname' => 'Alice', 'lname' => 'Smith']],
                'dowList'           => $defaultDowList,
                'A_SHORT_DAY_NAMES' => $defaultDayNames,
                'dateLabel'         => 'March 2026',
                'dayHeaderDates'    => [],
                'currentMonthMini'  => $emptyMini,
                'nextMonthMini'     => ['monthLabel' => 'April 2026', 'weeks' => []],
                'A_EVENTS'          => [],
                'dowOfDate'         => [],
            ],
            $fixtureDir . '/calendar-month-print-empty.html',
        ];

        yield 'calendar week_print empty' => [
            'calendar/default/views/week_print/outlook_ajax_template.html.twig',
            [
                'providers'         => [['id' => 1, 'fname' => 'Alice', 'lname' => 'Smith', 'dayPairs' => []]],
                'dowList'           => $defaultDowList,
                'A_SHORT_DAY_NAMES' => $defaultDayNames,
                'dateRange'         => ['firstMonth' => 'March', 'firstDay' => '15', 'lastMonth' => 'March', 'lastDay' => '21'],
                'currentMonthMini'  => $emptyMini,
                'nextMonthMini'     => ['monthLabel' => 'April 2026', 'weeks' => []],
            ],
            $fixtureDir . '/calendar-week-print-empty.html',
        ];

        yield 'calendar day_print empty' => [
            'calendar/default/views/day_print/outlook_ajax_template.html.twig',
            [
                'providers'         => [['id' => 1, 'fname' => 'Alice', 'lname' => 'Smith', 'events' => []]],
                'dowList'           => $defaultDowList,
                'A_SHORT_DAY_NAMES' => $defaultDayNames,
                'dateHeader'        => ['dateLabel' => '15 March 2026', 'weekdayLabel' => 'Sunday'],
                'currentMonthMini'  => $emptyMini,
                'nextMonthMini'     => ['monthLabel' => 'April 2026', 'weeks' => []],
                'timeRows'          => [],
                'timeslotCss'       => '20px',
            ],
            $fixtureDir . '/calendar-day-print-empty.html',
        ];

        // Screen views share a large set of chrome variables (nav URLs,
        // chevron icons, monthSelectorHtml, facility picker, provider
        // picker). Empty providersGrid / dayColumns + empty facilities
        // / provinfo render the page chrome only — the per-event paths
        // are covered by CalendarRenderDataBuilderTest.
        $screenCommon = [
            'dowList'                 => $defaultDowList,
            'A_SHORT_DAY_NAMES'       => $defaultDayNames,
            'prevMonth'               => '20260201',
            'nextMonth'               => '20260401',
            'prevMonthName'           => 'February',
            'nextMonthName'           => 'April',
            'currentMiniCal'          => $emptyMini,
            'monthSelectorHtml'       => '<select id="monthPicker"></select>',
            'showFacilitySelect'      => false,
            'showAllFacilitiesOption' => true,
            'pc_facility'             => 0,
            'facilities'              => [],
            'provinfo'                => [],
            'selectedUsernames'       => [],
            'chevron_icon_left'       => 'fa-chevron-left',
            'chevron_icon_right'      => 'fa-chevron-right',
            'isToday'                 => false,
            'webroot'                 => '',
            'body_class'              => '',
            'calendarSidebarVersion'  => '1700000321',
        ];

        yield 'calendar month-screen empty' => [
            'calendar/default/views/month/ajax_template.html.twig',
            array_merge($screenCommon, [
                'viewtype'           => 'month',
                'Date'               => '20260315',
                'currentMonthLabel'  => 'March 2026',
                'PREV_MONTH_URL'     => '?prev',
                'NEXT_MONTH_URL'     => '?next',
                'providersGrid'      => [],
            ]),
            $fixtureDir . '/calendar-month-screen-empty.html',
        ];

        yield 'calendar day-screen empty' => [
            'calendar/default/views/day/ajax_template.html.twig',
            array_merge($screenCommon, [
                'viewtype'        => 'day',
                'Date'            => '20260315',
                'dayHeaderLabel'  => 'Sunday March 15 2026',
                'PREV_DAY_URL'    => '?prev',
                'NEXT_DAY_URL'    => '?next',
                'timeRows'        => [],
                'timeslotCss'     => '20px',
                'providers'       => [],
                'workdayCssVersion' => '1700000700',
                'workdayJsVersion' => '1700000800',
            ]),
            $fixtureDir . '/calendar-day-screen-empty.html',
        ];

        yield 'calendar week-screen empty' => [
            'calendar/default/views/week/ajax_template.html.twig',
            array_merge($screenCommon, [
                'viewtype'        => 'week',
                'Date'            => '20260315',
                'weekHeaderLabel' => 'Mar 15 - Mar 21 2026',
                'PREV_WEEK_URL'   => '?prev',
                'NEXT_WEEK_URL'   => '?next',
                'timeRows'        => [],
                'timeslotCss'     => '20px',
                'providers'       => [],
            ]),
            $fixtureDir . '/calendar-week-screen-empty.html',
        ];

        yield 'patient/card/appointments with future appointments' => [
            'patient/card/appointments.html.twig',
            [
                'title'               => 'Appointments',
                'id'                  => 'appointments_ps_expand',
                'initiallyCollapsed'  => false,
                'btnLabel'            => 'Add',
                'btnLink'             => 'return newEvt()',
                'linkMethod'          => 'javascript',
                'appts'               => [
                    [
                        'pc_catid'      => 5,
                        'pc_catname'    => 'Office Visit',
                        'pc_hometext'   => '',
                        'pc_recurrtype' => 0,
                        'jsEvent'       => '123,456',
                        'dayName'       => 'Monday',
                        'pc_eventDate'  => '2026-03-15',
                        'pc_eventTime'  => '10:00',
                        'displayMeridiem' => 'AM',
                        'uname'         => 'Dr. Smith',
                        'pc_status'     => '-',
                        'bgColor'       => '#ffffff',
                    ],
                ],
                'recurrAppts'         => [],
                'pastAppts'           => [],
                'displayAppts'        => true,
                'displayRecurrAppts'  => false,
                'displayPastAppts'    => false,
                'extraApptDate'       => '',
                'therapyGroupCategories' => [],
                'auth'                => true,
                'resNotNull'          => true,
            ],
            $fixtureDir . '/appointments-with-future.html',
        ];

        // Install Code Set page. The first case covers the post-upload render (messages of both
        // types, a selected code type, the replace checkbox reflecting an unchecked submission and
        // the RXCUI help paragraph); the second covers a module-only install where core's own
        // importers have been filtered out.
        yield 'super/load_codes with messages' => [
            'super/load_codes.html.twig',
            [
                'csrfToken'          => 'test-csrf-token',
                'messages'           => [
                    'success' => ['Code set load successful.', 'Codes inserted: 12, codes updated: 3'],
                    'error'   => ['The code set could not be imported. Check the system log for details.'],
                ],
                'supportedCodeTypes' => ['RXCUI', 'LOINC', 'ICPC2'],
                'selectedCodeType'   => 'LOINC',
                'formReplace'        => false,
                'maxFileSize'        => 350000000,
                'showRxcuiHelp'      => true,
            ],
            $fixtureDir . '/load-codes-with-messages.html',
        ];

        yield 'super/load_codes without rxcui' => [
            'super/load_codes.html.twig',
            [
                'csrfToken'          => 'test-csrf-token',
                'messages'           => [],
                'supportedCodeTypes' => ['ICPC2'],
                'selectedCodeType'   => '',
                'formReplace'        => true,
                'maxFileSize'        => 350000000,
                'showRxcuiHelp'      => false,
            ],
            $fixtureDir . '/load-codes-no-rxcui.html',
        ];

        // Merge Patients page. The template has two mutually exclusive states -- the chart-picker
        // form and the report of a merge that has already run -- and the form itself changes
        // depending on whether the duplicate manager supplied both charts.
        yield 'patient_file/merge_patients empty form' => [
            'patient_file/merge_patients.html.twig',
            [
                'csrfToken'            => 'test-csrf-token',
                'pid1'                 => 0,
                'pid2'                 => 0,
                'targetPid'            => 0,
                'sourcePid'            => 0,
                'targetLabel'          => 'Click to select',
                'sourceLabel'          => 'Click to select',
                'dryRun'               => false,
                'requireIdentityMatch' => true,
                'mergeResult'          => null,
            ],
            $fixtureDir . '/merge-patients-empty-form.html',
        ];

        yield 'patient_file/merge_patients prefilled from duplicate manager' => [
            'patient_file/merge_patients.html.twig',
            [
                'csrfToken'            => 'test-csrf-token',
                'pid1'                 => 7,
                'pid2'                 => 12,
                'targetPid'            => 7,
                'sourcePid'            => 12,
                'targetLabel'          => "O'Brien, Mary (7)",
                'sourceLabel'          => 'Obrien, Mary (12)',
                'dryRun'               => true,
                // The duplicate manager has already vetted SSN/DOB, so the page does not warn
                // about them and the merge will not enforce them.
                'requireIdentityMatch' => false,
                'mergeResult'          => null,
            ],
            $fixtureDir . '/merge-patients-prefilled.html',
        ];

        // Once a merge has run the controller renders the report state alone -- the form variables
        // are deliberately absent, because the source chart it would point at no longer exists.
        yield 'patient_file/merge_patients successful merge' => [
            'patient_file/merge_patients.html.twig',
            [
                'mergeResult' => PatientMergeResult::completed([
                    'Changing patient ID for document scan.pdf',
                    'DELETE FROM `history_data` WHERE `pid` = ? (1)',
                    'UPDATE `billing` SET `pid` = ? WHERE `pid` = ? (4)',
                    'Merge complete.',
                ]),
            ],
            $fixtureDir . '/merge-patients-complete.html',
        ];

        yield 'patient_file/merge_patients aborted merge' => [
            'patient_file/merge_patients.html.twig',
            [
                'mergeResult' => PatientMergeResult::failed(
                    ['Changing patient ID for document scan.pdf'],
                    'Target and source DOB do not match'
                ),
            ],
            $fixtureDir . '/merge-patients-aborted.html',
        ];

        // Duplicate Patient Management report. The empty case covers the page chrome an install
        // with no duplicates sees; the populated case covers group separation, the two different
        // action menus, and both highlight styles.
        $dupActions = [
            'markUnique' => 'U',
            'recompute' => 'R',
            'mergeKeep' => 'MK',
            'mergeDiscard' => 'MD',
        ];

        yield 'patient_file/manage_dup_patients no duplicates' => [
            'patient_file/manage_dup_patients.html.twig',
            [
                'csrfToken' => 'test-csrf-token',
                'siteId' => 'default',
                'columns' => DuplicatePatientColumn::defaults(),
                'groups' => [],
                'actions' => $dupActions,
            ],
            $fixtureDir . '/manage-dup-patients-empty.html',
        ];

        yield 'patient_file/manage_dup_patients two groups' => [
            'patient_file/manage_dup_patients.html.twig',
            [
                'csrfToken' => 'test-csrf-token',
                'siteId' => 'default',
                'columns' => DuplicatePatientColumn::defaults(),
                'groups' => self::renderedGroups([
                    new DuplicatePatientGroup(
                        1,
                        DuplicatePatientRow::forPrimary(self::duplicatePatientRow([
                            'pid' => '7',
                            'pubpid' => 'PUB7',
                            'dupscore' => '20',
                        ]), self::HIGHLIGHT),
                        [
                            DuplicatePatientRow::forMatch(self::duplicatePatientRow([
                                'pid' => '9',
                                'pubpid' => 'PUB9',
                                'dupscore' => '20',
                                'myscore' => '20',
                            ]), 7, self::HIGHLIGHT),
                        ]
                    ),
                    new DuplicatePatientGroup(
                        2,
                        DuplicatePatientRow::forPrimary(self::duplicatePatientRow([
                            'pid' => '21',
                            'pubpid' => 'PUB21',
                            'dupscore' => '13',
                            'lname' => "O'Brien",
                            'fname' => 'Sean',
                        ]), self::HIGHLIGHT),
                        [
                            DuplicatePatientRow::forMatch(self::duplicatePatientRow([
                                'pid' => '22',
                                'pubpid' => 'PUB22',
                                'dupscore' => '13',
                                'myscore' => '14',
                                'lname' => "O'Brian",
                                'fname' => 'Sean',
                            ]), 21, self::HIGHLIGHT),
                        ]
                    ),
                ]),
                'actions' => $dupActions,
            ],
            $fixtureDir . '/manage-dup-patients-groups.html',
        ];

        $reasonCodeStatii = [
            '' => ['code' => '', 'description' => 'Select a status code'],
            'negated' => ['code' => 'negated', 'description' => 'Negated'],
        ];

        yield 'forms/care_plan reason row (empty)' => [
            '/forms/care_plan/templates/partials/_reason_row.html.twig',
            [
                'row' => [],
                'rowIndex' => 1,
                'reasonCodeStatii' => $reasonCodeStatii,
            ],
            $fixtureDir . '/care-plan-reason-row-empty.html',
        ];

        yield 'forms/care_plan reason row (populated)' => [
            '/forms/care_plan/templates/partials/_reason_row.html.twig',
            [
                'row' => [
                    'reason_code' => 'SNOMED-CT:183932001',
                    'reason_description' => 'Procedure contraindicated',
                    'reason_status' => 'negated',
                    'reason_date_low' => '2026-01-05 09:00',
                    'reason_date_high' => '2026-02-05 09:00',
                ],
                'rowIndex' => 2,
                'reasonCodeStatii' => $reasonCodeStatii,
            ],
            $fixtureDir . '/care-plan-reason-row-populated.html',
        ];

        yield 'forms/care_plan row actions' => [
            '/forms/care_plan/templates/partials/_actions.html.twig',
            ['rowIndex' => 1],
            $fixtureDir . '/care-plan-actions.html',
        ];

        yield 'forms/care_plan report' => [
            '/forms/care_plan/templates/care_plan_report.html.twig',
            [
                'rows' => [
                    [
                        'user' => 'admin',
                        'care_plan_type' => 'plan_of_care',
                        'plan_engagement_category' => 'active',
                        'code' => 'SNOMED-CT:168731009',
                        'codetext' => 'Standard chest x-ray',
                        'description' => "First line\nSecond line",
                        'date' => '2026-01-05 09:00:00',
                    ],
                ],
            ],
            $fixtureDir . '/care-plan-report.html',
        ];

        yield 'patient/card care plan empty' => [
            'patient/card/care_plan.html.twig',
            [
                'id' => 'card_care_plan',
                'title' => 'Care Plan',
                'initiallyCollapsed' => false,
                'forceAlwaysOpen' => false,
                'auth' => false,
                'card_bg_color' => '',
                'card_text_color' => '',
                'pid' => 1,
                'rows' => [],
                'mostRecentDate' => null,
                'encounter' => null,
            ],
            $fixtureDir . '/care-plan-card-empty.html',
        ];

        yield 'patient/card care plan populated' => [
            'patient/card/care_plan.html.twig',
            [
                'id' => 'card_care_plan',
                'title' => 'Care Plan',
                'initiallyCollapsed' => false,
                'forceAlwaysOpen' => false,
                'auth' => false,
                'card_bg_color' => '',
                'card_text_color' => '',
                'pid' => 1,
                'rows' => [
                    [
                        'user' => 'admin',
                        'care_plan_type' => 'plan_of_care',
                        'code' => 'SNOMED-CT:168731009',
                        'codetext' => 'Standard chest x-ray',
                        'description' => "First line\nSecond line",
                        'date' => '2026-01-05 09:00:00',
                    ],
                ],
                'mostRecentDate' => '2026-01-05',
                'encounter' => 12,
            ],
            $fixtureDir . '/care-plan-card-populated.html',
        ];

        yield 'patient/card demographics custom layout groups' => [
            'patient/card/tab_base.html.twig',
            self::demographicsCardParameters(),
            $fixtureDir . '/demographics-card-custom-groups.html',
        ];

        yield 'patient/card care plan collapsed' => [
            'patient/card/care_plan.html.twig',
            [
                'id' => 'card_care_plan',
                'title' => 'Care Plan',
                'initiallyCollapsed' => true,
                'forceAlwaysOpen' => false,
                'auth' => false,
                'card_bg_color' => '',
                'card_text_color' => '',
                'pid' => 1,
                'rows' => [],
                'mostRecentDate' => null,
                'encounter' => null,
            ],
            $fixtureDir . '/care-plan-card-collapsed.html',
        ];

        foreach (self::cardDetailsCases() as $name => $case) {
            yield 'patient/card details ' . $name => [$case['template'], $case['parameters'], $fixtureDir . '/' . $case['fixture']];
        }

        // The SOAP form calls getters on a FormSOAP; a stand-in keeps the render database-free.
        // Saved text includes markup and whitespace that |text must escape and keep.
        yield 'forms/soap soap_form saved note' => [
            '/forms/soap/templates/soap_form.twig',
            [
                'FORM_ACTION' => '/openemr',
                'assetVersion' => self::ASSET_VERSION,
                'soapDocumentAssets' => [
                    'css' => '1700000789',
                    'js' => '1700000790',
                    'referenceCss' => '1700000791',
                    'referenceJs' => '1700000792',
                ],
                'soapCopyAllowed' => true,
                // Synthetic previous note with markup-like text: the fixture
                // must show it only as an escaped attribute payload.
                'soapReference' => [
                    'status' => 'available',
                    'withheld' => true,
                    'notes' => [[
                        'encounter' => 41,
                        'date' => '2026-09-01',
                        'sections' => [
                            'subjective' => '<script>alert(1)</script>',
                            'objective' => "a & 'b'",
                            'assessment' => '',
                            'plan' => "line one\nline two",
                        ],
                    ]],
                ],
                'DONT_SAVE_LINK' => '/openemr/interface/patient_file/encounter/encounter_top.php',
                'data' => new class {
                    public function get_subjective(): string
                    {
                        return "  pt reports <b>pain</b> & \"fatigue\"\n\n  since Monday  ";
                    }

                    public function get_objective(): string
                    {
                        return "\tBP 120/80";
                    }

                    public function get_assessment(): string
                    {
                        return '';
                    }

                    public function get_plan(): string
                    {
                        return "line one\nline two";
                    }

                    public function get_id(): int
                    {
                        return 12;
                    }

                    public function get_activity(): int
                    {
                        return 1;
                    }

                    public function get_pid(): int
                    {
                        return 7;
                    }
                },
            ],
            $fixtureDir . '/soap-form-saved-note.html',
        ];

        // No reference context and no copy eligibility: the panel must render
        // "could not be loaded" with copy denied, never "no earlier notes".
        yield 'forms/soap soap_form new note without reference context' => [
            '/forms/soap/templates/soap_form.twig',
            [
                'FORM_ACTION' => '/openemr',
                'assetVersion' => self::ASSET_VERSION,
                'soapDocumentAssets' => [
                    'css' => '1700000789',
                    'js' => '1700000790',
                    'referenceCss' => '1700000791',
                    'referenceJs' => '1700000792',
                ],
                'DONT_SAVE_LINK' => '/openemr/interface/patient_file/encounter/encounter_top.php',
                'data' => new class {
                    public function get_subjective(): string
                    {
                        return "  pt reports <b>pain</b> & \"fatigue\"\n\n  since Monday  ";
                    }

                    public function get_objective(): string
                    {
                        return "\tBP 120/80";
                    }

                    public function get_assessment(): string
                    {
                        return '';
                    }

                    public function get_plan(): string
                    {
                        return "line one\nline two";
                    }

                    public function get_id(): int
                    {
                        return 12;
                    }

                    public function get_activity(): int
                    {
                        return 1;
                    }

                    public function get_pid(): int
                    {
                        return 7;
                    }
                },
            ],
            $fixtureDir . '/soap-form-new-note-no-reference.html',
        ];
    }

    /**
     * Render each group's cells against core's default columns, the way the controller does.
     *
     * @param list<DuplicatePatientGroup> $groups
     *
     * @return list<DuplicatePatientGroup>
     *
     * @codeCoverageIgnore Only reached from the data provider, which runs before instrumentation.
     */
    private static function renderedGroups(array $groups): array
    {
        $columns = DuplicatePatientColumn::defaults();
        foreach ($groups as $group) {
            foreach ($group->getRows() as $row) {
                $row->renderCells($columns);
            }
        }

        return $groups;
    }

    /**
     * A patient_data row shaped the way DuplicatePatientRow expects.
     *
     * @param array<string, mixed> $overrides
     *
     * @return array<string, mixed>
     *
     * @codeCoverageIgnore Only reached from the data provider, which runs before instrumentation.
     */
    private static function duplicatePatientRow(array $overrides = []): array
    {
        return array_merge([
            'pid' => '1',
            'pubpid' => 'PUB1',
            'dupscore' => '13',
            'lname' => 'Nakamura',
            'fname' => 'Aiko',
            'mname' => 'R',
            'DOB' => '1984-11-02',
            'sex' => 'Female',
            'email' => 'aiko@example.com',
            'phone_home' => '555-1000',
            'phone_biz' => '',
            'phone_cell' => '555-2000',
            'regdate' => '2020-04-01',
            'street' => '12 Elm St',
        ], $overrides);
    }

    /**
     * Build and cache the Twig environment with stubs for isolated render testing.
     *
     * Stubs setupHeader() because the real implementation needs the kernel and
     * event dispatcher, which aren't available in isolated tests. Render tests
     * verify template structure, not header generation.
     *
     */
    /**
     * The workbench wrapper adds one hook around the legacy layout output and changes nothing
     * inside it: renderer arguments, tab markup, IDs, values and the ul/div sibling order that
     * library/js/common.js navigates all survive byte-for-byte.
     */
    #[Test]
    public function demographicsCardWrapsLegacyLayoutOutputUnchanged(): void
    {
        self::$layoutTabCalls = [];
        $parameters = self::demographicsCardParameters();
        $template = (new \ReflectionClass(\OpenEMR\Patient\Cards\DemographicsViewCard::class))->getConstant('TEMPLATE_FILE');
        self::assertIsString($template);
        $html = self::twigEnvironment()->render($template, $parameters);

        self::assertSame([
            ['tabRow:DEM', $parameters['result'], $parameters['result2']],
            ['tabData:DEM', $parameters['result'], $parameters['result2']],
        ], self::$layoutTabCalls);
        self::assertSame(1, substr_count($html, self::DEMOGRAPHICS_TAB_ROW));
        self::assertSame(1, substr_count($html, self::DEMOGRAPHICS_TAB_DATA));

        $dom = new \DOMDocument();
        self::assertTrue($dom->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NOERROR | LIBXML_NONET));
        $xpath = new \DOMXPath($dom);
        $wrappers = $xpath->query('//div[@id="card_demographics"]//div[@class="oe-demographics-facts"]');
        self::assertNotFalse($wrappers);
        self::assertSame(1, $wrappers->length);
        $wrapper = $wrappers->item(0);
        self::assertInstanceOf(\DOMElement::class, $wrapper);
        self::assertSame('oe-demographics-facts', $wrapper->getAttribute('id'));

        $tabNav = $wrapper->firstElementChild;
        self::assertInstanceOf(\DOMElement::class, $tabNav);
        self::assertSame('ul', $tabNav->tagName);
        self::assertSame('tabNav', $tabNav->getAttribute('class'));
        $tabContainer = $tabNav->nextElementSibling;
        self::assertInstanceOf(\DOMElement::class, $tabContainer);
        self::assertSame('tabContainer', $tabContainer->getAttribute('class'));
        self::assertNull($tabContainer->nextElementSibling);

        $current = $xpath->query('.//li[@class="current"]/a/@id', $tabNav);
        self::assertNotFalse($current);
        $tabIds = [];
        foreach ($current as $idNode) {
            self::assertInstanceOf(\DOMAttr::class, $idNode);
            $tabIds[] = $idNode->value;
        }
        self::assertSame(['header_tab_Who'], $tabIds);
        $values = $xpath->query('.//td[contains(@class, "data")]/@data-value', $tabContainer);
        self::assertNotFalse($values);
        self::assertCount(5, $values);
    }

    #[Test]
    public function nonDemographicsTabCardKeepsOriginalLayoutWithoutFactsWrapper(): void
    {
        self::$layoutTabCalls = [];
        $parameters = self::demographicsCardParameters();
        $parameters['tabID'] = 'HIS';
        $html = self::twigEnvironment()->render('patient/card/tab_base.html.twig', $parameters);
        self::assertStringNotContainsString('oe-demographics-facts', $html);
        self::assertSame([
            ['tabRow:HIS', $parameters['result'], $parameters['result2']],
            ['tabData:HIS', $parameters['result'], $parameters['result2']],
        ], self::$layoutTabCalls);
    }

    /**
     * The secondary dashboard cards gain workbench hook classes on elements they already render
     * and nothing else: removing the hook tokens reproduces the pre-hook output byte-for-byte, and
     * every form, control, CSRF field, action value and link survives in the same multiset.
     *
     * @param list<string> $expectedHooks
     */
    #[Test]
    #[DataProvider('cardDetailsHookProvider')]
    public function cardDetailsHooksLeaveLegacyOutputAndControlsUntouched(string $case, array $expectedHooks): void
    {
        $definition = self::cardDetailsCases()[$case];
        $html = self::normalizeTrailingWhitespace(
            self::twigEnvironment()->render($definition['template'], $definition['parameters'])
        );
        $legacy = file_get_contents(__DIR__ . '/fixtures/render/card-details-legacy/' . $definition['fixture']);
        self::assertIsString($legacy);

        $xpath = self::xpathFor($html);
        $cardId = $definition['parameters']['id'];
        self::assertIsString($cardId);
        $cardBody = $xpath->query('//div[@id="' . $cardId . '"]');
        self::assertNotFalse($cardBody);
        self::assertSame(1, $cardBody->length);
        $cardBodyNode = $cardBody->item(0);
        self::assertInstanceOf(\DOMElement::class, $cardBodyNode);

        $hooks = $xpath->query('.//*[contains(concat(" ", normalize-space(@class), " "), " oe-card-details ")]', $cardBodyNode);
        self::assertNotFalse($hooks);
        $modifiers = [];
        foreach ($hooks as $hook) {
            self::assertInstanceOf(\DOMElement::class, $hook);
            $ancestorHooks = $xpath->query('ancestor::*[contains(concat(" ", normalize-space(@class), " "), " oe-card-details ")]', $hook);
            self::assertNotFalse($ancestorHooks);
            self::assertSame(0, $ancestorHooks->length);
            self::assertSame(1, preg_match('/(?:^| )(oe-card-details--[a-z-]+)(?: |$)/', $hook->getAttribute('class'), $match));
            $modifiers[] = $match[1];
        }
        self::assertSame($expectedHooks, $modifiers);
        // No hook leaks onto the card chrome or anywhere outside the collapsible body.
        self::assertSame(count($expectedHooks), substr_count($html, ' oe-card-details '));

        self::assertSame($legacy, self::stripCardDetailsHooks($html));

        $controls = self::controlSignatures($xpath, $cardBodyNode);
        self::assertSame(self::controlSignatures(self::xpathFor($legacy), null, $cardId), $controls);
        // Every interactive control in the body sits inside a hooked region, so the scoped
        // styles reach it; none is orphaned outside the wrapper.
        $outside = $xpath->query(
            './/*[self::form or self::input or self::select or self::textarea or self::button or self::a]'
            . '[not(ancestor::*[contains(concat(" ", normalize-space(@class), " "), " oe-card-details ")])]',
            $cardBodyNode,
        );
        self::assertNotFalse($outside);
        self::assertSame(0, $outside->length);
        foreach ($definition['requiredControls'] as $required) {
            self::assertContains($required, $controls);
        }
    }

    /**
     * @return array<string, array{string, list<string>}>
     *
     * @codeCoverageIgnore Data providers run before coverage instrumentation starts.
     */
    public static function cardDetailsHookProvider(): array
    {
        return [
            'care experience populated' => ['preference care experience populated', ['oe-card-details--preference', 'oe-card-details--preference-edit']],
            'treatment empty' => ['preference treatment empty', ['oe-card-details--preference', 'oe-card-details--preference-edit']],
            'care experience read only' => ['preference care experience read only', ['oe-card-details--preference']],
            'treatment unauthorized' => ['preference treatment unauthorized', ['oe-card-details--preference']],
            'care plan empty' => ['care plan empty', ['oe-card-details--care-plan']],
            'care plan populated' => ['care plan populated', ['oe-card-details--care-plan']],
            'billing full' => ['billing full', ['oe-card-details--billing']],
            'billing minimal' => ['billing minimal', ['oe-card-details--billing']],
        ];
    }

    #[Test]
    public function cardDetailsCasesRenderTheTemplatesTheDashboardCardsSelect(): void
    {
        $selected = [];
        foreach ([
            \OpenEMR\Patient\Cards\CareExperiencePreferenceViewCard::class,
            \OpenEMR\Patient\Cards\TreatmentPreferenceViewCard::class,
            \OpenEMR\Patient\Cards\CarePlanViewCard::class,
            \OpenEMR\Patient\Cards\BillingViewCard::class,
        ] as $cardClass) {
            $template = (new \ReflectionClass($cardClass))->getConstant('TEMPLATE_FILE');
            self::assertIsString($template);
            $selected[] = $template;
        }
        $rendered = array_values(array_unique(array_column(self::cardDetailsCases(), 'template')));
        sort($selected);
        sort($rendered);
        self::assertSame(array_values(array_unique($selected)), $rendered);
    }

    private static function stripCardDetailsHooks(string $html): string
    {
        return (string) preg_replace('/ oe-card-details(?: oe-card-details--[a-z-]+)?(?=")/', '', $html);
    }

    private static function xpathFor(string $html): \DOMXPath
    {
        $dom = new \DOMDocument();
        self::assertTrue($dom->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NOERROR | LIBXML_NONET));
        return new \DOMXPath($dom);
    }

    /**
     * Sorted multiset of every form and control: tag, type, name, value, method and action, plus
     * the js- hooks and Bootstrap targets the inline scripts and card toggles bind to.
     *
     * @return list<string>
     */
    private static function controlSignatures(\DOMXPath $xpath, ?\DOMElement $context, string $bodyId = ''): array
    {
        if ($context === null) {
            $body = $xpath->query('//div[@id="' . $bodyId . '"]');
            self::assertNotFalse($body);
            $context = $body->item(0);
            self::assertInstanceOf(\DOMElement::class, $context);
        }
        $nodes = $xpath->query('.//*[self::form or self::input or self::select or self::textarea or self::button or self::option or self::a]', $context);
        self::assertNotFalse($nodes);
        $signatures = [];
        foreach ($nodes as $node) {
            self::assertInstanceOf(\DOMElement::class, $node);
            $jsHooks = array_values(array_filter(
                preg_split('/\s+/', $node->getAttribute('class')) ?: [],
                static fn (string $class): bool => str_starts_with($class, 'js-'),
            ));
            $signatures[] = implode('|', [
                $node->tagName,
                $node->getAttribute('type'),
                $node->getAttribute('name'),
                $node->getAttribute('id'),
                $node->getAttribute('value'),
                $node->getAttribute('method'),
                $node->getAttribute('action'),
                $node->hasAttribute('required') ? 'required' : '',
                $node->hasAttribute('checked') ? 'checked' : '',
                implode(' ', $jsHooks),
                $node->getAttribute('data-pref'),
            ]);
        }
        sort($signatures);
        return $signatures;
    }

    /**
     * SYNTHETIC parameters for the secondary dashboard cards. Values mimic what the card classes
     * pass (see their getTemplateVariables()) but no database, ACL or session stands behind them:
     * auth/can_write are set directly to reach each template branch.
     *
     * @return array<string, array{template: string, parameters: array<string, mixed>, fixture: string, requiredControls: list<string>}>
     *
     * @codeCoverageIgnore Shared with data providers that run before coverage instrumentation starts.
     */
    private static function cardDetailsCases(): array
    {
        $preference = static fn (string $type, string $id, bool $auth, bool $canWrite, array $preferences, ?string $message): array => [
            'id' => $id,
            'title' => $type === 'care_experience' ? 'Care Experience Preferences' : 'Treatment Intervention Preferences',
            'initiallyCollapsed' => false,
            'forceAlwaysOpen' => false,
            'card_bg_color' => '',
            'card_text_color' => '',
            'btnClass' => 'js-card-toggle-edit',
            'btnLabel' => 'Edit',
            'btnLink' => 'event.preventDefault();',
            'linkMethod' => 'javascript',
            'type' => $type,
            'pid' => 1,
            'auth' => $auth,
            'can_write' => $canWrite,
            'webroot' => '/openemr',
            'csrf_token' => 'synthetic-csrf-token',
            'preferences' => $preferences,
            'loinc_codes' => [
                ['loinc_code' => '00000-1', 'display_name' => 'SYNTHETIC preference category'],
                ['loinc_code' => '00000-2', 'display_name' => 'SYNTHETIC preference category with a deliberately long display name'],
            ],
            'current_datetime' => '2026-01-02T03:04',
            'message' => $message,
        ];
        $rows = [
            [
                'id' => 501, 'effective_datetime' => '2026-01-05 09:00:00', 'recorded_date' => '2026-01-05 09:00:00',
                'observation_code' => '00000-1', 'observation_code_text' => 'SYNTHETIC preference category',
                'code_display' => 'SYNTHETIC preference category', 'value_type' => 'coded', 'value_code' => 'SYN-A',
                'value_display' => 'SYNTHETIC coded answer', 'value_boolean' => null, 'value_text' => null,
                'status' => 'final', 'note' => 'SYNTHETIC note',
            ],
            [
                'id' => 502, 'effective_datetime' => null, 'recorded_date' => '2026-01-06 10:00:00',
                'observation_code' => '00000-2', 'observation_code_text' => 'SYNTHETIC yes/no preference',
                'code_display' => 'SYNTHETIC yes/no preference', 'value_type' => 'boolean', 'value_code' => null,
                'value_display' => null, 'value_boolean' => '1', 'value_text' => null,
                'status' => 'preliminary', 'note' => '',
            ],
            [
                'id' => 503, 'effective_datetime' => '2026-01-07 11:00:00', 'recorded_date' => '2026-01-07 11:00:00',
                'observation_code' => '00000-2', 'observation_code_text' => 'SYNTHETIC free text preference',
                'code_display' => 'SYNTHETIC free text preference', 'value_type' => 'text', 'value_code' => null,
                'value_display' => null, 'value_boolean' => null,
                'value_text' => 'SYNTHETIC-free-text-answer-without-any-break-points-to-exercise-overflow-wrapping-in-the-card',
                'status' => 'entered-in-error', 'note' => '',
            ],
            [
                'id' => 504, 'effective_datetime' => '2026-01-08 12:00:00', 'recorded_date' => '2026-01-08 12:00:00',
                'observation_code' => '00000-1', 'observation_code_text' => 'SYNTHETIC unanswered preference',
                'code_display' => 'SYNTHETIC unanswered preference', 'value_type' => 'boolean', 'value_code' => null,
                'value_display' => null, 'value_boolean' => '0', 'value_text' => null,
                'status' => 'amended', 'note' => '',
            ],
            [
                'id' => 505, 'effective_datetime' => '2026-01-09 13:00:00', 'recorded_date' => '2026-01-09 13:00:00',
                'observation_code' => '00000-1', 'observation_code_text' => 'SYNTHETIC unspecified preference',
                'code_display' => 'SYNTHETIC unspecified preference', 'value_type' => 'coded', 'value_code' => null,
                'value_display' => null, 'value_boolean' => null, 'value_text' => null,
                'status' => 'synthetic-custom-status', 'note' => '',
            ],
        ];
        $sig = static fn (
            string $tag,
            string $type = '',
            string $name = '',
            string $id = '',
            string $value = '',
            string $method = '',
            bool $required = false,
            bool $checked = false,
            string $js = '',
        ): string => implode('|', [$tag, $type, $name, $id, $value, $method, '', $required ? 'required' : '', $checked ? 'checked' : '', $js, '']);
        $saveForm = static fn (string $type): array => [
            $sig('form', id: $type . '-form', method: 'post'),
            $sig('input', 'hidden', 'csrf_token', value: 'synthetic-csrf-token'),
            $sig('input', 'hidden', 'pref_type', value: $type),
            $sig('input', 'hidden', 'action', value: 'save'),
            $sig('input', 'hidden', 'id', $type . '-id'),
            $sig('select', name: 'observation_code', id: $type . '-observation_code', required: true),
            $sig('input', 'text', 'effective_datetime', $type . '-effective_datetime', '2026-01-02T03:04', required: true),
            $sig('select', name: 'status', id: $type . '-status'),
            $sig('input', 'radio', 'value_type', $type . '-vt-coded', 'coded', checked: true, js: 'js-value-type-radio'),
            $sig('input', 'radio', 'value_type', $type . '-vt-text', 'text', js: 'js-value-type-radio'),
            $sig('input', 'radio', 'value_type', $type . '-vt-boolean', 'boolean', js: 'js-value-type-radio'),
            $sig('select', name: 'value_code', id: $type . '-value_code'),
            $sig('input', 'hidden', 'value_code_system', $type . '-value_code_system'),
            $sig('input', 'hidden', 'value_display', $type . '-value_display'),
            $sig('textarea', name: 'value_text', id: $type . '-value_text'),
            $sig('select', name: 'value_boolean', id: $type . '-value_boolean'),
            $sig('textarea', name: 'note', id: $type . '-note'),
            $sig('button', 'submit'),
            $sig('button', 'button', js: 'js-cancel-edit'),
        ];
        $carePlan = static fn (array $rows, ?string $date, ?int $encounter): array => [
            'id' => 'card_care_plan',
            'title' => 'Care Plan',
            'initiallyCollapsed' => false,
            'forceAlwaysOpen' => false,
            'auth' => false,
            'card_bg_color' => '',
            'card_text_color' => '',
            'pid' => 1,
            'rows' => $rows,
            'mostRecentDate' => $date,
            'encounter' => $encounter,
        ];
        $billing = self::billingCardDetailsParameters(...);

        return [
            'preference care experience populated' => [
                'template' => 'patient/card/preference_card_inline.html.twig',
                'parameters' => $preference('care_experience', 'carepref_ps_expand', true, true, $rows, 'SYNTHETIC preference saved'),
                'fixture' => 'preference-card-care-experience-populated.html',
                'requiredControls' => array_merge($saveForm('care_experience'), [
                    $sig('form', method: 'post'),
                    $sig('input', 'hidden', 'action', value: 'delete'),
                    $sig('input', 'hidden', 'id', value: '501'),
                    $sig('input', 'hidden', 'id', value: '505'),
                    $sig('button', 'submit'),
                ]),
            ],
            'preference treatment empty' => [
                'template' => 'patient/card/preference_card_inline.html.twig',
                'parameters' => $preference('treatment_intervention', 'treatmentpref_ps_expand', true, true, [], null),
                'fixture' => 'preference-card-treatment-empty.html',
                'requiredControls' => $saveForm('treatment_intervention'),
            ],
            'preference care experience read only' => [
                'template' => 'patient/card/preference_card_inline.html.twig',
                'parameters' => $preference('care_experience', 'carepref_ps_expand', true, false, $rows, null),
                'fixture' => 'preference-card-care-experience-read-only.html',
                'requiredControls' => [],
            ],
            'preference treatment unauthorized' => [
                'template' => 'patient/card/preference_card_inline.html.twig',
                'parameters' => $preference('treatment_intervention', 'treatmentpref_ps_expand', false, true, $rows, null),
                'fixture' => 'preference-card-treatment-unauthorized.html',
                'requiredControls' => [],
            ],
            'care plan empty' => [
                'template' => 'patient/card/care_plan.html.twig',
                'parameters' => $carePlan([], null, null),
                'fixture' => 'care-plan-card-empty.html',
                'requiredControls' => [],
            ],
            'care plan populated' => [
                'template' => 'patient/card/care_plan.html.twig',
                'parameters' => $carePlan([
                    [
                        'user' => 'SYNTHETIC-author',
                        'care_plan_type' => 'plan_of_care',
                        'plan_engagement_category' => 'synthetic',
                        'code' => 'SNOMED-CT:000000000',
                        'codetext' => 'SYNTHETIC code text',
                        'description' => "SYNTHETIC first line\nSYNTHETIC-description-without-any-break-points-to-exercise-overflow-wrapping",
                        'date' => '2026-01-05 09:00:00',
                    ],
                ], '2026-01-05', 12),
                'fixture' => 'care-plan-card-details-populated.html',
                'requiredControls' => [$sig('a', js: 'js-care-plan-goto-encounter')],
            ],
            'billing full' => [
                'template' => 'patient/card/billing.html.twig',
                'parameters' => $billing([
                    'patientBalance' => 12.5,
                    'insuranceBalance' => 40,
                    'totalBalance' => 52.5,
                    'collectionBalance' => 7,
                    'unallocated' => 3,
                    'billingNote' => 'SYNTHETIC-billing-note-without-any-break-points-to-exercise-overflow-wrapping-in-the-card',
                    'provider' => true,
                    'insName' => 'SYNTHETIC Insurance Company',
                    'copay' => '20.00',
                    'effDate' => '2026-01-01',
                    'effDateEnd' => '2026-12-31',
                ]),
                'fixture' => 'billing-card-full.html',
                'requiredControls' => [],
            ],
            'billing minimal' => [
                'template' => 'patient/card/billing.html.twig',
                'parameters' => $billing([
                    'patientBalance' => 0,
                    'insuranceBalance' => 0,
                    'totalBalance' => 0,
                    'collectionBalance' => 0,
                    'unallocated' => 0,
                ]),
                'fixture' => 'billing-card-minimal.html',
                'requiredControls' => [],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function demographicsCardParameters(): array
    {
        return [
            'id' => 'card_demographics',
            'tabID' => 'DEM',
            'title' => 'Demographics',
            'initiallyCollapsed' => false,
            'forceAlwaysOpen' => false,
            'auth' => true,
            'btnLabel' => 'Edit',
            'btnLink' => 'demographics_full.php',
            'linkMethod' => 'html',
            'requireRestore' => true,
            'btnClass' => 'btn btn-sm btn-link',
            'card_bg_color' => '',
            'card_text_color' => '',
            'card' => new class {
                public function canAdd(): bool
                {
                    return false;
                }

                public function canEdit(): bool
                {
                    return true;
                }
            },
            'result' => ['pid' => 1, 'fname' => 'Synthetic', 'DOB' => '1970-01-01'],
            'result2' => ['pid' => 1, 'name' => ''],
        ];
    }

    private static function twigEnvironment(): Environment
    {
        if (self::$twig !== null) {
            return self::$twig;
        }

        self::applyRenderingGlobals();
        self::applyAssetVersion();

        // Also load interface/ so encounter form templates resolve under the same
        // names they use in production, e.g. /forms/care_plan/templates/x.html.twig.
        $twigContainer = new TwigContainer(self::fileroot() . '/interface');
        $twig = $twigContainer->getTwig();

        // getListItemTitle() reads list_options from the database. Stub it so
        // templates resolving list values render isolated, with the lookup visible
        // in the fixture as [list_id:option_id].
        $twig->addFunction(new TwigFunction(
            'getListItemTitle',
            fn (string $listId, ?string $optionId): string => '[' . $listId . ':' . ($optionId ?? '') . ']',
        ));

        // Override setupHeader() before the first render initializes extensions.
        // The real function requires $kernel for event dispatching; the stub
        // returns an HTML comment so templates that extend base.html.twig
        // render without the full application bootstrap, and the fixture files
        // show exactly where the real function's output would appear.
        $twig->addFunction(new TwigFunction(
            'setupHeader',
            fn (): string => '<!-- setupHeader stub -->',
            ['is_safe' => ['html']]
        ));

        // csrfTokenRaw() derives the token from the session's CSRF key, which
        // isolated tests do not have. A fixed token keeps the hidden field
        // visible in fixtures without a session.
        $twig->addFunction(new TwigFunction(
            'csrfTokenRaw',
            fn (string $subject = 'default'): string => 'test-csrf-token',
        ));

        // tabRow()/tabData() read the patient's layout from the database. Stub them with the
        // legacy renderer's markup so the demographics card renders isolated; the calls are
        // recorded so tests can prove the arguments reach the renderer unchanged.
        $twig->addFunction(new TwigFunction(
            'tabRow',
            function (string $formType, mixed $result1, mixed $result2): string {
                self::$layoutTabCalls[] = ['tabRow:' . $formType, $result1, $result2];
                return self::DEMOGRAPHICS_TAB_ROW;
            },
        ));
        $twig->addFunction(new TwigFunction(
            'tabData',
            function (string $formType, mixed $result1, mixed $result2): string {
                self::$layoutTabCalls[] = ['tabData:' . $formType, $result1, $result2];
                return self::DEMOGRAPHICS_TAB_DATA;
            },
        ));

        // PostCalendar templates use pc_sort_events and
        // pc_event_time_anchor — register the extension that supplies
        // them so calendar render cases parse and render correctly.
        $twig->addExtension(new PostCalendarTwigExtension());

        self::$twig = $twig;
        return $twig;
    }

    /**
     * Strip trailing whitespace from each line.
     *
     */
    private static function normalizeTrailingWhitespace(string $text): string
    {
        return implode("\n", array_map(rtrim(...), explode("\n", $text)));
    }

    /** @codeCoverageIgnore */
    private static function fileroot(): string
    {
        return dirname(__DIR__, 5);
    }
}
