<?php

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\E2e;

use DOMDocument;
use DOMElement;
use DOMXPath;
use InvalidArgumentException;
use OpenEMR\Tests\E2e\Base\MainMenuSelectors;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../E2e/Base/MainMenuSelectors.php';

final class MainMenuSelectorsTest extends TestCase
{
    #[Test]
    public function workbenchSelectorsFollowTheRequestedBranchAndAction(): void
    {
        $document = new DOMDocument();
        $document->loadHTML('<div data-workbench-tree>'
            . '<section><details class="workbench-branch"><summary>Admin</summary><div class="workbench-children">'
            . '<details class="workbench-branch"><summary>Clinic</summary><div class="workbench-children">'
            . '<button data-workbench-action>Calendar</button></div></details>'
            . '<details class="workbench-branch"><summary>System</summary><div class="workbench-children">'
            . '<button data-workbench-action>Calendar</button></div></details>'
            . '</div></details></section>'
            . '<section><button data-workbench-action>Calendar</button></section>'
            . '</div>', LIBXML_NOERROR);
        $xpath = new DOMXPath($document);

        $branch = $xpath->query(MainMenuSelectors::workbenchBranch(['Admin', 'Clinic']));
        $action = $xpath->query(MainMenuSelectors::workbenchAction(['Admin', 'Clinic', 'Calendar']));
        $topLevel = $xpath->query(MainMenuSelectors::workbenchAction(['Calendar']));

        self::assertNotFalse($branch);
        self::assertNotFalse($action);
        self::assertNotFalse($topLevel);
        self::assertCount(1, $branch);
        self::assertCount(1, $action);
        self::assertInstanceOf(DOMElement::class, $action->item(0));
        self::assertSame('Calendar', $action->item(0)->textContent);
        self::assertCount(1, $topLevel);
        self::assertNotSame($action->item(0), $topLevel->item(0));
    }

    #[Test]
    public function workbenchSelectorsHandleBothKindsOfQuotesInLabels(): void
    {
        $document = new DOMDocument();
        $document->loadHTML('<div data-workbench-tree><section>'
            . '<details class="workbench-branch"><summary>Clinic &quot;A&quot; and O\'Brien</summary>'
            . '<div class="workbench-children"><button data-workbench-action>Dr. &quot;Q&quot; O\'Neil</button>'
            . '</div></details></section></div>', LIBXML_NOERROR);
        $xpath = new DOMXPath($document);

        $branch = $xpath->query(MainMenuSelectors::workbenchBranch(['Clinic "A" and O\'Brien']));
        $action = $xpath->query(MainMenuSelectors::workbenchAction(['Clinic "A" and O\'Brien', 'Dr. "Q" O\'Neil']));

        self::assertNotFalse($branch);
        self::assertNotFalse($action);
        self::assertCount(1, $branch);
        self::assertCount(1, $action);
    }

    #[Test]
    public function areaButtonFollowsTheTargetActionsSectionForEveryArea(): void
    {
        // Translated button labels deliberately differ from the group keys.
        $xpath = self::areaFixture('<div data-workbench-areas>'
            . '<button data-workbench-area="Work" aria-pressed="true">Arbeit</button>'
            . '<button data-workbench-area="Patient" aria-pressed="false">Fall</button>'
            . '<button data-workbench-area="Practice" aria-pressed="false">Praxis</button></div>'
            . '<div data-workbench-tree>'
            . '<section data-workbench-group="Work"><button data-workbench-action>Calendar</button></section>'
            . '<section data-workbench-group="Patient" hidden><details class="workbench-branch"><summary>Visits</summary>'
            . '<div class="workbench-children"><button data-workbench-action>Create Visit</button></div></details></section>'
            . '<section data-workbench-group="Practice" hidden><details class="workbench-branch"><summary>Admin</summary>'
            . '<div class="workbench-children"><button data-workbench-action>Users</button></div></details></section>'
            . '</div>');

        self::assertSame(['Work'], self::areasFor($xpath, ['Calendar']));
        self::assertSame(['Patient'], self::areasFor($xpath, ['Visits', 'Create Visit']));
        self::assertSame(['Practice'], self::areasFor($xpath, ['Admin', 'Users']));
    }

    #[Test]
    public function areaButtonHandlesNestedDuplicateLabelsQuotesAndHiddenSections(): void
    {
        $xpath = self::areaFixture('<div data-workbench-areas>'
            . '<button data-workbench-area="Work">Work</button>'
            . '<button data-workbench-area="Patient">Patient</button>'
            . '<button data-workbench-area="Practice">Practice</button></div>'
            . '<div data-workbench-tree>'
            . '<section data-workbench-group="Work"><button data-workbench-action>Calendar</button></section>'
            . '<section data-workbench-group="Patient" hidden>'
            . '<details class="workbench-branch"><summary>Clinic &quot;A&quot; and O\'Brien</summary>'
            . '<div class="workbench-children"><button data-workbench-action>Dr. &quot;Q&quot; O\'Neil</button>'
            . '</div></details></section>'
            . '<section data-workbench-group="Practice" hidden>'
            . '<details class="workbench-branch"><summary>Admin</summary><div class="workbench-children">'
            . '<details class="workbench-branch"><summary>Clinic</summary><div class="workbench-children">'
            . '<button data-workbench-action>Calendar</button></div></details>'
            . '<details class="workbench-branch"><summary>System</summary><div class="workbench-children">'
            . '<button data-workbench-action>Calendar</button></div></details>'
            . '</div></details>'
            . '<button data-workbench-action>Calendar</button></section>'
            . '</div>');

        self::assertSame(['Practice'], self::areasFor($xpath, ['Admin', 'Clinic', 'Calendar']));
        self::assertSame(['Practice'], self::areasFor($xpath, ['Admin', 'System', 'Calendar']));
        self::assertSame(['Patient'], self::areasFor($xpath, ['Clinic "A" and O\'Brien', 'Dr. "Q" O\'Neil']));
        // A duplicated top-level label resolves to the first match, the one the
        // action wait itself would find.
        self::assertSame(['Work'], self::areasFor($xpath, ['Calendar']));
        self::assertSame([], self::areasFor($xpath, ['Admin', 'Missing', 'Calendar']));
    }

    #[Test]
    public function areaButtonIsAbsentForMarkupWithoutAreaControls(): void
    {
        $withoutButtons = self::areaFixture('<div data-workbench-tree>'
            . '<section data-workbench-group="Practice"><button data-workbench-action>Users</button></section></div>');
        $withoutGroups = self::areaFixture('<button data-workbench-area="Work">Work</button>'
            . '<div data-workbench-tree><section><button data-workbench-action>Users</button></section></div>');
        $nonButton = self::areaFixture('<div data-workbench-area="Practice">Practice</div>'
            . '<div data-workbench-tree>'
            . '<section data-workbench-group="Practice"><button data-workbench-action>Users</button></section></div>');

        self::assertSame([], self::areasFor($withoutButtons, ['Users']));
        self::assertSame([], self::areasFor($withoutGroups, ['Users']));
        self::assertSame([], self::areasFor($nonButton, ['Users']));
    }

    #[Test]
    public function workbenchNavigationSelectsTheAreaBeforeWaitingOnBranches(): void
    {
        $source = file_get_contents(__DIR__ . '/../../E2e/Base/BaseTrait.php');
        self::assertIsString($source);
        $start = strpos($source, 'private function goToWorkbenchMenuLink(');
        self::assertIsInt($start);
        $end = strpos($source, 'private function ', $start + 1);
        self::assertIsInt($end);
        $body = substr($source, $start, $end - $start);

        $area = strpos($body, 'MainMenuSelectors::workbenchAreaButton(');
        $click = strpos($body, '->click()');
        $branch = strpos($body, 'MainMenuSelectors::workbenchBranch(');
        self::assertIsInt($area);
        self::assertIsInt($click);
        self::assertIsInt($branch);
        self::assertLessThan($click, $area);
        self::assertLessThan($branch, $click);
    }

    #[Test]
    public function emptyWorkbenchAreaPathIsRejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        MainMenuSelectors::workbenchAreaButton([]);
    }

    #[Test]
    public function emptyWorkbenchBranchPathIsRejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        MainMenuSelectors::workbenchBranch([]);
    }

    #[Test]
    public function emptyWorkbenchActionPathIsRejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        MainMenuSelectors::workbenchAction([]);
    }

    private static function areaFixture(string $html): DOMXPath
    {
        $document = new DOMDocument();
        $document->loadHTML('<body>' . $html . '</body>', LIBXML_NOERROR);
        return new DOMXPath($document);
    }

    /**
     * @param non-empty-list<string> $labels
     * @return list<string>
     */
    private static function areasFor(DOMXPath $xpath, array $labels): array
    {
        $buttons = $xpath->query(MainMenuSelectors::workbenchAreaButton($labels));
        self::assertNotFalse($buttons);
        $areas = [];
        foreach ($buttons as $button) {
            self::assertInstanceOf(DOMElement::class, $button);
            self::assertSame('button', $button->tagName);
            $areas[] = $button->getAttribute('data-workbench-area');
        }
        return $areas;
    }
}
