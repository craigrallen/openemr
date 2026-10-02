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
}
