<?php

/**
 * Renders the REAL interface/patient_file/problem_encounter.php and checks its presentation hooks.
 *
 * The route file is included as-is (never copied or eval'd) from a temporary working directory
 * whose ../globals.php and $srcdir/restoreSession.php includes are TEST DOUBLES; see
 * ProblemEncounterRouteHarness for exactly what is real and what is doubled. Patient, ACL, issue,
 * encounter and link data are SYNTHETIC. Only the GET page view and the ACL denial are covered:
 * the Save POST branch reads CSRF input through filter_input(), which cannot be fed in a CLI
 * process. This is not database, ACL, runtime or clinical acceptance.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\PatientFile\ProblemEncounter;

use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;
use OpenEMR\Tests\Isolated\PatientFile\ProblemEncounter\Doubles\AccessDeniedHelperDouble;
use OpenEMR\Tests\Isolated\PatientFile\ProblemEncounter\Doubles\HeaderDouble;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class ProblemEncounterRouteRenderTest extends TestCase
{
    // Class aliases, the kernel, the session and cwd are process-wide; each test gets its own process.

    private const LINK_PREFIX = '<link rel="stylesheet" media="screen" href="/openemr/interface/clinical-workspace/issues-encounters-document.css?v=';

    private string $root = '';

    private string $cwd = '';

    protected function setUp(): void
    {
        $cwd = getcwd();
        self::assertIsString($cwd);
        $this->cwd = $cwd;
        $this->root = ProblemEncounterRouteHarness::createTree();
        ProblemEncounterScenario::grantAll();
        ProblemEncounterRouteHarness::boot($this->root);
    }

    protected function tearDown(): void
    {
        chdir($this->cwd);
        ProblemEncounterRouteHarness::removeTree($this->root);
        unset($_REQUEST['issue']);
    }

    #[Test]
    public function realTargetSourcesAreTheOnesUnderTest(): void
    {
        $root = realpath(ProblemEncounterRouteHarness::repositoryRoot());
        self::assertIsString($root);
        self::assertSame($root . '/interface/patient_file/problem_encounter.php', realpath(ProblemEncounterRouteHarness::routePhp()));
        self::assertSame(
            $root . '/src/Common/Assets/ClinicalWorkspaceAssets.php',
            (new \ReflectionClass(ClinicalWorkspaceAssets::class))->getFileName()
        );
        $escaping = (new \ReflectionFunction('attr_js'))->getFileName();
        self::assertSame($root . '/library/htmlspecialchars.inc.php', $escaping);
    }

    #[Test]
    public function permittedViewerSeesScreenOnlySheetRouteClassesAndOriginalControls(): void
    {
        $_REQUEST['issue'] = '41';
        [$html, $stopped] = ProblemEncounterRouteHarness::render();
        self::assertNull($stopped);

        $assets = new ClinicalWorkspaceAssets();
        $path = ProblemEncounterRouteHarness::repositoryRoot() . '/interface/clinical-workspace/issues-encounters-document.css';
        clearstatcache(true, $path);
        self::assertSame((string) filemtime($path), $assets->version('issues-encounters-document.css'));
        $link = self::LINK_PREFIX . $assets->version('issues-encounters-document.css') . '">';
        self::assertSame(1, substr_count($html, $link . "\n"));
        self::assertSame(1, substr_count($html, '/interface/clinical-workspace/'));
        self::assertSame(1, substr_count($html, 'media="screen"'));
        self::assertStringNotContainsString('workspace.css', str_replace('issues-encounters-document.css', '', $html));

        // Order: header, route sheet, original inline style, </head>.
        $order = [strpos($html, HeaderDouble::MARKER), strpos($html, $link), strpos($html, 'tr.head   { font-size:10pt;'), strpos($html, '</head>')];
        self::assertSame($order, array_values(array_filter($order, is_int(...))));
        $sorted = $order;
        sort($sorted);
        self::assertSame($sorted, $order);
        self::assertSame(['["opener","topdialog","dialog"]'], ProblemEncounterScenario::$headers);

        self::assertSame(1, substr_count($html, "<body class=\"oe-issues-encounters\">\n    <div class=\"container oe-ie-document\">\n"));
        self::assertSame(1, substr_count($html, '<table class="table oe-ie-layout">'));
        self::assertSame(1, substr_count($html, "<td colspan='2' class=\"text-center font-weight-bold oe-ie-identity\">"));
        self::assertSame(1, substr_count($html, 'Issues and Encounters for SYNTHETIC Patient (' . ProblemEncounterScenario::PID . ')</b>'));
        self::assertMatchesRegularExpression('~<tr class="oe-ie-sections">\s*<td class="text-center align-top p-0 pl-3 oe-ie-section oe-ie-issues">\s*<div class="table-responsive">~', $html);
        self::assertSame(1, substr_count($html, '<td class="text-center align-top p-0 pr-3 oe-ie-section oe-ie-encounters">'));
        self::assertSame(1, substr_count($html, '<div class="btn-group oe-ie-actions">'));
        self::assertSame(1, substr_count($html, "<p class=\"oe-ie-instructions\">\n"));

        // Original form, hidden state, radios, rows, actions and the issue preselection.
        self::assertSame(1, substr_count($html, "<form method='post' action='problem_encounter.php' onsubmit='return top.restoreSession()'>"));
        self::assertSame(1, substr_count($html, '<input type="hidden" name="csrf_token_form" value="' . substr(hash_hmac('sha256', 'default', 'SYNTHETIC-test-key'), 0, 40) . '" />'));
        self::assertSame(1, substr_count($html, "<input type='hidden' name='form_pid' value='" . ProblemEncounterScenario::PID . "' />"));
        self::assertSame(1, substr_count($html, "<input type='hidden' name='form_pelist' value='/41,77/' />"));
        self::assertSame(1, substr_count($html, "<input type='radio' name='form_key' value='p' onclick='clearall()' checked />"));
        self::assertSame(1, substr_count($html, "<input type='radio' name='form_key' value='e' onclick='clearall()' />"));
        self::assertLessThan(strpos($html, "value='e'"), strpos($html, "value='p'"));
        self::assertSame(1, substr_count($html, "<tr class='detail' id='p_41' onclick='doclick(\"p\", &quot;41&quot;)'>"));
        self::assertSame(1, substr_count($html, "<td class='align-top'>SYNTHETIC issue &lt;b&gt;</td>"));
        self::assertSame(1, substr_count($html, "<tr class='detail' id='e_77' onclick='doclick(\"e\", &quot;77&quot;)'>"));
        self::assertSame(1, substr_count($html, "<td class='align-top'>2000-01-02</td>"));
        self::assertMatchesRegularExpression("~<button type=\"submit\" class=\"btn btn-primary btn-sm btn-save\" name='form_save' value='Save' disabled>\s*Save\s*</button>~", $html);
        self::assertSame(1, substr_count($html, "onclick='newIssue()'"));
        self::assertSame(1, substr_count($html, "<button type=\"button\" class='btn btn-secondary btn-sm btn-cancel' onclick='dlgclose()'>Cancel</button>"));
        self::assertStringContainsString("pselected[\"41\"] = '';\neselected[\"77\"] = '';\ndoclick('p', \"41\");\n", $html);
        self::assertStringContainsString("trcolors['K'] = new Array('var(--black)', 'var(--yellow)');", $html);
        self::assertStringContainsString("trcolors['V'] = new Array('var(--black)', 'var(--indigo)');", $html);
        self::assertStringContainsString('/* TEST DOUBLE library/restoreSession.php */', $html);

        // Exactly the three original reads, all scoped to the patient; no mutation.
        $statements = array_map(static fn (array $q): string => $q[0], ProblemEncounterScenario::$queries);
        self::assertSame([
            'select fname,lname,squad from patient_data where pid=? order by date DESC limit 0,1',
            'SELECT * FROM lists WHERE pid = ? ORDER BY type, date',
            'SELECT * FROM form_encounter WHERE pid = ? ORDER BY date DESC',
            'SELECT * FROM issue_encounter WHERE pid = ?',
        ], $statements);
        foreach (ProblemEncounterScenario::$queries as [, $binds]) {
            self::assertSame([ProblemEncounterScenario::PID], $binds);
        }
        self::assertSame(0, ProblemEncounterScenario::$serviceCreated);
        self::assertSame([], ProblemEncounterScenario::$denied);
    }

    #[Test]
    public function deniedViewerStopsBeforeAnyIssueEncounterReadOrSheet(): void
    {
        ProblemEncounterScenario::$aclAnswers['["patients","med","","write"]'] = false;
        [$html, $stopped] = ProblemEncounterRouteHarness::render();

        self::assertInstanceOf(\DomainException::class, $stopped);
        self::assertSame(AccessDeniedHelperDouble::SIGNAL, $stopped->getMessage());
        self::assertTrue(ProblemEncounterScenario::$globalsLoaded);
        self::assertSame([['ACL check failed for encounters/notes or patients/med: Issues and Encounters', 'Issues and Encounters']], ProblemEncounterScenario::$denied);
        self::assertSame('', $html);
        self::assertCount(1, ProblemEncounterScenario::$queries);
        self::assertSame([], ProblemEncounterScenario::$headers);
        self::assertSame(0, ProblemEncounterScenario::$serviceCreated);
    }

    #[Test]
    public function squadRestrictionStillDeniesAnOtherwisePermittedViewer(): void
    {
        ProblemEncounterScenario::$patient['squad'] = 'SYNTHETIC-squad';
        ProblemEncounterScenario::$aclAnswers['["squads","SYNTHETIC-squad","",""]'] = false;
        [$html, $stopped] = ProblemEncounterRouteHarness::render();

        self::assertInstanceOf(\DomainException::class, $stopped);
        self::assertSame('', $html);
        self::assertContains('["squads","SYNTHETIC-squad","",""]', ProblemEncounterScenario::$acl);
        self::assertCount(1, ProblemEncounterScenario::$queries);
    }
}
