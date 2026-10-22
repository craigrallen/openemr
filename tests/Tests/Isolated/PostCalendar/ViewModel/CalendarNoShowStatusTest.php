<?php

/**
 * @package   OpenEMR
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PostCalendar\ViewModel;

use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\PostCalendar\ViewModel\CalendarRenderDataBuilder;
use OpenEMR\PostCalendar\ViewModel\CalendarViewModel;
use OpenEMR\PostCalendar\ViewModel\ViewType;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

#[Group('isolated')]
#[Group('postcalendar')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class CalendarNoShowStatusTest extends TestCase
{
    private const BADGE = '~ <span\s+class=[\'\"]badge badge-danger oe-calendar-no-show[\'\"]\s*>No show</span>~';

    protected function setUp(): void
    {
        $GLOBALS['disable_translation'] = true;
    }

    /** @return array<string, mixed> */
    private function patientEvent(int|string $catid = 5): array
    {
        return [
            'eid' => 73,
            'aid' => 1,
            'catid' => $catid,
            'catname' => 'Office Visit',
            'catcolor' => '#aabbcc',
            'pccattype' => '1',
            'startTime' => '09:30:00',
            'duration' => 1800,
            'pid' => 42,
            'patient_name' => 'Doe, Jane',
            'patient_address' => '<unsafe>',
            'patient_dob' => '',
            'title' => '<visit>',
            'hometext' => '',
            'apptstatus' => '?',
            'facility_row' => ['id' => 1, 'name' => 'Main Clinic'],
            'eventViewClass' => 'custom-visit',
        ];
    }

    /**
     * @param array<string, mixed> $event
     * @return array{content: string, tooltip: string, extraClass?: string}
     */
    private function screenContent(ViewType $view, array $event): array
    {
        $vm = new CalendarViewModel(viewType: $view, firstDayOfWeek: 0);

        return match ($view) {
            ViewType::Day => $vm->buildDayScreenEventContent($event, 5, '/tpl/img', '/openemr', true),
            ViewType::Week => $vm->buildWeekScreenEventContent($event, 5, '/tpl/img', '/openemr', true, '-toggled'),
            ViewType::Month => $vm->buildMonthScreenEventContent($event, '2026-03-15', 5, '/tpl/img', '/openemr'),
            default => self::fail('A screen view is required'),
        };
    }

    /** @return iterable<string, array{ViewType}> */
    public static function screenViews(): iterable
    {
        yield 'day' => [ViewType::Day];
        yield 'week' => [ViewType::Week];
        yield 'month' => [ViewType::Month];
    }

    /** @return iterable<string, array{ViewType, int}> */
    public static function ordinaryVisitCategories(): iterable
    {
        foreach ([ViewType::Day, ViewType::Week, ViewType::Month] as $view) {
            yield $view->value . ' category 5' => [$view, 5];
            yield $view->value . ' category 42' => [$view, 42];
        }
    }

    private static function badgeCount(string $html): int
    {
        $count = preg_match_all(self::BADGE, $html);
        self::assertIsInt($count);
        return $count;
    }

    private static function withoutBadge(string $html): string
    {
        $result = preg_replace(self::BADGE, '', $html);
        self::assertIsString($result);
        return $result;
    }

    #[DataProvider('ordinaryVisitCategories')]
    public function testPatientStatusQuestionMarkAddsOneTextBadgeWithoutChangingExistingContent(ViewType $view, int $catid): void
    {
        $event = $this->patientEvent($catid);
        $before = $event;
        $actual = $this->screenContent($view, $event);
        $ordinary = $this->screenContent($view, [...$event, 'apptstatus' => '-']);

        self::assertSame($before, $event, 'Rendering must not mutate the supplied event');
        self::assertSame(1, self::badgeCount($actual['content']));
        self::assertStringContainsString('badge-danger', $actual['content']);
        self::assertStringContainsString('>No show</span>', $actual['content']);
        self::assertStringContainsString('</a> <span class="badge badge-danger oe-calendar-no-show"', $actual['content']);
        self::assertStringContainsString("data-pid='42'", $actual['content']);
        self::assertStringContainsString("href='javascript:goPid(", $actual['content']);
        self::assertStringContainsString("class='event_time'", $actual['content']);
        self::assertStringContainsString("onclick='event_time_click(this)'", $actual['content']);
        self::assertStringContainsString('&lt;unsafe&gt;', $actual['content']);
        self::assertStringNotContainsString('<unsafe>', $actual['content']);
        self::assertSame($ordinary['tooltip'], $actual['tooltip']);
        if ($view !== ViewType::Month) {
            self::assertStringContainsString('&nbsp;?', $actual['content']);
            self::assertArrayHasKey('extraClass', $ordinary);
            self::assertArrayHasKey('extraClass', $actual);
            self::assertSame($ordinary['extraClass'], $actual['extraClass']);
            $expected = str_replace('&nbsp;-', '&nbsp;?', $ordinary['content']);
        } else {
            $expected = $ordinary['content'];
        }
        self::assertSame($expected, self::withoutBadge($actual['content']));
    }

    /** @return iterable<string, array{mixed}> */
    public static function otherStatuses(): iterable
    {
        yield 'ordinary' => ['-'];
        yield 'blank' => [''];
        yield 'different status' => ['@'];
        yield 'leading space' => [' ?'];
        yield 'trailing space' => ['? '];
        yield 'null' => [null];
        yield 'array' => [['?']];
        yield 'object' => [(object) ['value' => '?']];
    }

    #[DataProvider('otherStatuses')]
    public function testOnlyExactStringStatusGetsBadge(mixed $status): void
    {
        foreach ([ViewType::Day, ViewType::Week, ViewType::Month] as $view) {
            $event = [...$this->patientEvent(), 'apptstatus' => $status];
            $actual = $this->screenContent($view, $event);
            self::assertSame(0, self::badgeCount($actual['content']));
            $ordinary = $this->screenContent($view, [...$event, 'apptstatus' => '-']);
            $expected = $view === ViewType::Month
                ? $ordinary['content']
                : str_replace('&nbsp;-', '&nbsp;' . (is_string($status) ? $status : ''), $ordinary['content']);
            self::assertSame($expected, $actual['content']);
            self::assertSame($ordinary['tooltip'], $actual['tooltip']);
        }
    }

    #[DataProvider('screenViews')]
    public function testMissingStatusDoesNotGetBadge(ViewType $view): void
    {
        $event = $this->patientEvent();
        unset($event['apptstatus']);
        self::assertSame(0, self::badgeCount($this->screenContent($view, $event)['content']));
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function nonPatientEvents(): iterable
    {
        yield 'integer zero pid' => [['pid' => 0]];
        yield 'null pid' => [['pid' => null]];
        yield 'missing pid' => [['missing' => true]];
        yield 'group id' => [['gid' => 8, 'group_name' => 'Therapy Group', 'groupstat' => '?']];
        yield 'string zero group id follows source group branch' => [['gid' => '0', 'group_name' => 'Therapy Group', 'groupstat' => '?']];
    }

    /** @param array<string, mixed> $change */
    #[DataProvider('nonPatientEvents')]
    public function testQuestionMarkDoesNotMarkEventsOutsidePatientBranch(array $change): void
    {
        foreach ([ViewType::Day, ViewType::Week, ViewType::Month] as $view) {
            $event = [...$this->patientEvent(), ...$change];
            if (isset($change['missing'])) {
                unset($event['pid'], $event['missing']);
            }
            self::assertSame(0, self::badgeCount($this->screenContent($view, $event)['content']));
        }
    }

    #[DataProvider('screenViews')]
    public function testStringZeroPidFollowsExistingPatientLinkBranch(ViewType $view): void
    {
        $event = [...$this->patientEvent(), 'pid' => '0'];
        $actual = $this->screenContent($view, $event);
        self::assertSame(0, self::badgeCount($actual['content']));
        self::assertStringContainsString("data-pid='0'", $actual['content']);
    }

    /** @return iterable<string, array{mixed}> */
    public static function invalidBadgePatientIds(): iterable
    {
        yield 'negative integer' => [-42];
        yield 'negative string' => ['-42'];
        yield 'nonnumeric string' => ['not-a-pid'];
        yield 'leading zero string' => ['042'];
        yield 'signed positive string' => ['+42'];
        yield 'decimal string' => ['42.0'];
        yield 'spaced string' => [' 42'];
        yield 'trailing newline string' => ["42\n"];
        yield 'boolean false' => [false];
        yield 'boolean true' => [true];
        yield 'array' => [[42]];
        yield 'null' => [null];
    }

    #[DataProvider('invalidBadgePatientIds')]
    public function testInvalidPatientIdDoesNotGetStatusBadge(mixed $patientId): void
    {
        foreach ([ViewType::Day, ViewType::Week, ViewType::Month] as $view) {
            $event = [...$this->patientEvent(), 'pid' => $patientId];
            self::assertSame(0, self::badgeCount($this->screenContent($view, $event)['content']));
        }
    }

    #[DataProvider('screenViews')]
    public function testPositiveCanonicalStringPatientIdGetsStatusBadge(ViewType $view): void
    {
        $event = [...$this->patientEvent(), 'pid' => '42'];
        $actual = $this->screenContent($view, $event);
        self::assertSame(1, self::badgeCount($actual['content']));
        self::assertStringContainsString("data-pid='42'", $actual['content']);
    }

    /** @return iterable<string, array{int|string}> */
    public static function excludedCategories(): iterable
    {
        foreach ([2, '2', 3, '3', 4, '4', 6, '6', 7, '7', 8, '8', 11, '11', 99, '99'] as $catid) {
            yield (is_string($catid) ? 'string category ' : 'category ') . $catid => [$catid];
        }
    }

    #[DataProvider('excludedCategories')]
    public function testOperationalAndHolidayCategoriesNeverGetPatientBadge(int|string $catid): void
    {
        foreach ([ViewType::Day, ViewType::Week, ViewType::Month] as $view) {
            self::assertSame(0, self::badgeCount($this->screenContent($view, $this->patientEvent($catid))['content']));
        }
    }

    #[DataProvider('screenViews')]
    public function testLegacyNoShowCategoryAloneDoesNotGetStatusBadge(ViewType $view): void
    {
        $event = [...$this->patientEvent(1), 'apptstatus' => '-'];
        $actual = $this->screenContent($view, $event);
        self::assertSame(0, self::badgeCount($actual['content']));
        self::assertStringContainsString('<s>Doe', $actual['content']);
    }

    #[DataProvider('screenViews')]
    public function testLegacyNoShowCategoryKeepsStrikethroughWithQuestionMarkBadge(ViewType $view): void
    {
        $event = $this->patientEvent(1);
        $actual = $this->screenContent($view, $event);
        self::assertSame(1, self::badgeCount($actual['content']));
        self::assertStringContainsString('<s>Doe', $actual['content']);
        self::assertStringContainsString('</s></a> <span class="badge badge-danger oe-calendar-no-show"', $actual['content']);
    }

    /**
     * @param array<string, mixed> $event
     * @return array<string, mixed>
     */
    private function renderData(ViewType $view, array $event, int $facilityFilter): array
    {
        // dateformat() reads the active language session when the real builder
        // decorates a nonempty event. A memory session keeps this isolated.
        $session = new Session(new MockArraySessionStorage());
        $session->set('language_choice', 1);
        SessionWrapperFactory::getInstance()->setActiveSession($session);

        $builder = new CalendarRenderDataBuilder(new CalendarViewModel(viewType: $view, firstDayOfWeek: 0));
        $events = ['2026-03-15' => [$event]];
        $providers = [['id' => 1, 'fname' => 'Alice', 'lname' => 'Smith', 'username' => 'asmith']];
        $facilities = [['id' => 1, 'name' => 'Main Clinic'], ['id' => 2, 'name' => 'Other Clinic']];
        $shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        $times = [
            ['hour' => 8, 'minute' => 0, 'mer' => 'am'],
            ['hour' => 9, 'minute' => 0, 'mer' => 'am'],
            ['hour' => 9, 'minute' => 30, 'mer' => 'am'],
            ['hour' => 10, 'minute' => 0, 'mer' => 'am'],
            ['hour' => 17, 'minute' => 0, 'mer' => 'pm'],
        ];

        return match ($view) {
            ViewType::Day => $builder->buildDayScreenRenderData(
                $events, $providers, $providers, $facilities, $times, 30, '20260315', $shortDays,
                $facilityFilter, 5, '/tpl/img', '/openemr', '?prev', '?next', 'left', 'right', '', true,
                'Sunday, March 15, 2026', true
            ),
            ViewType::Week => $builder->buildWeekScreenRenderData(
                $events, $providers, $providers, $facilities, $times, 30, '20260315', $shortDays,
                $facilityFilter, 5, '/tpl/img', '/openemr', '?prev', '?next', 'left', 'right', '', true,
                'Mar 15 - Mar 21 2026', true, '-toggled'
            ),
            ViewType::Month => $builder->buildMonthScreenRenderData(
                $events, $providers, $providers, $facilities, '20260315', $shortDays, $facilityFilter,
                5, '/tpl/img', '/openemr', '?prev', '?next', 'left', 'right', '', true, 'March 2026'
            ),
            default => self::fail('A screen view is required'),
        };
    }

    /**
     * @param array<string, mixed> $data
     * @return array{eid: mixed, eventDate: string, evtClass: string, displayBgColor: string, displayContentHtml: string, tooltip: string}
     */
    private static function firstRenderedEvent(ViewType $view, array $data): array
    {
        $providersKey = $view === ViewType::Month ? 'providersGrid' : 'providers';
        self::assertArrayHasKey($providersKey, $data);
        $providers = $data[$providersKey];
        self::assertIsArray($providers);
        self::assertCount(1, $providers);
        self::assertArrayHasKey(0, $providers);
        $provider = $providers[0];
        self::assertIsArray($provider);
        $events = match ($view) {
            ViewType::Day => self::eventsInContainer($provider),
            ViewType::Week => self::eventsInFirstContainer($provider, 'dayColumns'),
            ViewType::Month => self::eventsInFirstContainer($provider, 'days'),
            default => self::fail('A screen view is required'),
        };
        self::assertCount(1, $events);
        self::assertArrayHasKey(0, $events);
        $rendered = $events[0];
        self::assertIsArray($rendered);
        self::assertArrayHasKey('eid', $rendered);

        return [
            'eid' => $rendered['eid'],
            'eventDate' => self::stringField($rendered, 'eventDate'),
            'evtClass' => self::stringField($rendered, 'evtClass'),
            'displayBgColor' => self::stringField($rendered, 'displayBgColor'),
            'displayContentHtml' => self::stringField($rendered, 'displayContentHtml'),
            'tooltip' => self::stringField($rendered, 'tooltip'),
        ];
    }

    /** @param array<array-key, mixed> $container
     *  @return array<array-key, mixed>
     */
    private static function eventsInContainer(array $container): array
    {
        self::assertArrayHasKey('events', $container);
        $events = $container['events'];
        self::assertIsArray($events);
        return $events;
    }

    /** @param array<array-key, mixed> $provider
     *  @return array<array-key, mixed>
     */
    private static function eventsInFirstContainer(array $provider, string $key): array
    {
        self::assertArrayHasKey($key, $provider);
        $containers = $provider[$key];
        self::assertIsArray($containers);
        self::assertArrayHasKey(0, $containers);
        $container = $containers[0];
        self::assertIsArray($container);
        return self::eventsInContainer($container);
    }

    /** @param array<array-key, mixed> $event */
    private static function stringField(array $event, string $key): string
    {
        self::assertArrayHasKey($key, $event);
        $value = $event[$key];
        self::assertIsString($value);
        return $value;
    }

    #[DataProvider('screenViews')]
    public function testPublicScreenRenderDataDispatchKeepsFacilityPrivacyAndRouting(ViewType $view): void
    {
        $event = $this->patientEvent();
        $before = $event;
        foreach ([0, 1] as $filter) {
            $rendered = self::firstRenderedEvent($view, $this->renderData($view, $event, $filter));
            self::assertSame(73, $rendered['eid']);
            self::assertSame('20260315', $rendered['eventDate']);
            self::assertSame('custom-visit', $rendered['evtClass']);
            self::assertSame('#aabbcc', $rendered['displayBgColor']);
            self::assertSame(1, self::badgeCount($rendered['displayContentHtml']));
            self::assertStringContainsString("data-pid='42'", $rendered['displayContentHtml']);
        }

        $mismatched = self::firstRenderedEvent($view, $this->renderData($view, $event, 2));
        self::assertSame(73, $mismatched['eid']);
        self::assertSame('20260315', $mismatched['eventDate']);
        self::assertSame('custom-visit', $mismatched['evtClass']);
        self::assertSame('var(--gray300)', $mismatched['displayBgColor']);
        self::assertSame("<span class='text-center text-danger'>Main Clinic</span>", $mismatched['displayContentHtml']);
        self::assertSame(0, self::badgeCount($mismatched['displayContentHtml']));
        self::assertStringNotContainsString('Doe', $mismatched['displayContentHtml']);
        self::assertStringNotContainsString('42', $mismatched['displayContentHtml']);
        $ordinaryMismatched = self::firstRenderedEvent(
            $view,
            $this->renderData($view, [...$event, 'apptstatus' => '-'], 2)
        );
        // Inherited privacy limit: facility filtering masks visible content only;
        // the prebuilt tooltip still includes patient identity for both statuses.
        self::assertSame($ordinaryMismatched['tooltip'], $mismatched['tooltip']);
        self::assertSame($before, $event);
    }

    #[DataProvider('screenViews')]
    public function testCategoryClassRemainsWhenThereIsNoViewClassOverride(ViewType $view): void
    {
        $event = $this->patientEvent();
        unset($event['eventViewClass']);
        $rendered = self::firstRenderedEvent($view, $this->renderData($view, $event, 1));
        self::assertSame('event_appointment', $rendered['evtClass']);
        self::assertSame('#aabbcc', $rendered['displayBgColor']);
        self::assertSame(1, self::badgeCount($rendered['displayContentHtml']));
    }

    public function testPrintEventContentRemainsFrozenForQuestionMarkStatus(): void
    {
        $event = $this->patientEvent();
        self::assertSame(
            "<span class='appointment'>9:30?Doe,Jane</span>",
            (new CalendarViewModel(ViewType::DayPrint, 0))->buildDayPrintEventContent($event, 2, true, '/tpl/img')
        );
        self::assertSame(
            "<span class='appointment'>09:30 Doe,Jane</span>",
            (new CalendarViewModel(ViewType::WeekPrint, 0))->buildWeekPrintEventContent($event, '2026-03-15', 2, '/tpl/img')
        );
        self::assertSame(
            '9:30am Doe',
            (new CalendarViewModel(ViewType::MonthPrint, 0))->buildMonthPrintEventContent($event, '2026-03-15', 2)
        );
    }
}
