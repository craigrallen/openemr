<?php

/**
 * Executes the real interface/main/finder/patient_select.php with guarded doubles.
 *
 * Covered: the CSRF-verified "ID" search through the real getPatientId() and
 * _set_patient_inc_count(), the results stylesheet link with an escaped web root and the real
 * file version, the unchanged form, hidden fields, toolbar, pagination, column header and
 * escaped result row, the route's handling of the one-row aggregate encounter results
 * (nonzero counts and dates for a seen patient; the NULL MAX() row of a never-seen patient,
 * which the original route cannot render with translation disabled, see below), the
 * no-result page, and the patients/demo ACL refusal. Every SQL statement is an exact
 * recorded double over a SYNTHETIC table filtered by the bound pubpid prefix; any other
 * statement or bind fails closed.
 *
 * Known pre-existing defect, identical on origin/master: for a patient without a billed
 * encounter the billed MAX() row is NULL, the route passes it to xl(), and with
 * disable_translation set xl() hands NULL to xlCleanup(string), a TypeError. The never-seen
 * test pins that failure point, so the zero-count and empty-date cells are not reachable here.
 * With translation enabled (the default) xl() runs preg_replace() on NULL instead, a PHP
 * deprecation; that path needs the translation cache and is not exercised.
 *
 * Not covered: the popup branch (layout_options filter and PatientSelectFilterEvent), the
 * cdr_report branch, the alternate results style, preselected patients, a failing CSRF token
 * (csrfNotVerified() sets a 403, echoes and logs the error, then exits) and the real deny path
 * (it audits the denial and exits; the double stops the route at the same point instead).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Main\Finder;

use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;
use OpenEMR\Tests\Isolated\Main\Finder\Doubles\AccessDeniedSentinel;
use OpenEMR\Tests\Isolated\Main\Finder\Doubles\FinderHeaderDouble;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class PatientSelectRouteTest extends TestCase
{
    private string $root = '';

    private string $cwd = '';

    protected function setUp(): void
    {
        $cwd = getcwd();
        self::assertIsString($cwd);
        $this->cwd = $cwd;
        $this->root = FinderRouteHarness::createTree();
        FinderRouteHarness::boot($this->root);
    }

    protected function tearDown(): void
    {
        chdir($this->cwd);
        FinderRouteHarness::removeTree($this->root);
    }

    #[Test]
    public function theHeadLinksTheResultsStylesheetWithAnEscapedWebRootAfterTheHeader(): void
    {
        $html = self::renderIdSearch();
        $assets = new ClinicalWorkspaceAssets();

        $headEnd = strpos($html, '</head>');
        self::assertIsInt($headEnd);
        $head = substr($html, 0, $headEnd);
        $version = $assets->version('patient-results-popup.css');
        self::assertNotSame('0', $version);
        $link = '<link rel="stylesheet" media="screen" href="' . FinderRouteHarness::ESCAPED_WEB_ROOT
            . '/interface/clinical-workspace/patient-results-popup.css?v=' . $version . '">';
        self::assertSame(1, substr_count($head, $link));
        self::assertStringNotContainsString(FinderRouteHarness::WEB_ROOT . '/interface', $html);
        self::assertSame(1, substr_count($head, FinderHeaderDouble::MARKER));
        self::assertLessThan(strpos($head, $link), strpos($head, FinderHeaderDouble::MARKER));
        self::assertLessThan(strpos($head, '<style>'), strpos($head, $link));
        self::assertSame(['opener'], FinderRouteScenario::$headers);
        self::assertSame(['["patients","demo","",""]'], FinderRouteScenario::$acl);
    }

    #[Test]
    public function theFormToolbarAndHeaderKeepTheirOriginalFieldsAndActions(): void
    {
        $html = self::renderIdSearch();
        $token = substr(hash_hmac('sha256', 'default', FinderRouteScenario::CSRF_KEY), 0, 40);

        foreach (
            [
                '<body class="body_top oe-patient-results">',
                "<form method='post' action='patient_select.php' name='theform' onsubmit='return top.restoreSession()'>",
                '<input type="hidden" name="csrf_token_form" value="' . $token . '" />',
                "<input type='hidden' name='fstart'  value='0' />",
                "<input type='hidden' name='search_service_code' value='' />",
                "<input type='hidden' name='patient' value='" . FinderRouteScenario::ESCAPED_SEARCH . "' />",
                "<input type='hidden' name='findBy'  value='ID' />",
                "<table class=\"w-100 border-0 oe-results-toolbar\" cellpadding='5' cellspacing='0'>",
                "<a href=\"./patient_select_help.php\" target=_new onclick='top.restoreSession()'>[Help]&nbsp;</a>",
                '<div class="oe-results-scroll" role="region" aria-label="Patient search results" tabindex="0">',
                '[90 Days From Last Encounter]',
                'document.location.href = "../../patient_file/summary/demographics.php?set_pid=" + parts[0];',
            ] as $fragment
        ) {
            self::assertSame(1, substr_count($html, $fragment), $fragment);
        }
        self::assertStringNotContainsString("name='popup'", $html);
        self::assertStringNotContainsString('dlgclose("srchDone"', $html);

        $xpath = self::parse($html);
        self::assertSame(11, self::nodeCount($xpath, "//div[contains(@class, 'oe-results-scroll')]/div[@id='searchResultsHeader']/table/tr/th"));
        self::assertSame(1, self::nodeCount($xpath, "//div[contains(@class, 'oe-results-scroll')]/div[@id='searchResults']/table"));
    }

    #[Test]
    public function onlyThePatientMatchingTheBoundPrefixRendersAsAnEscapedSelectableRow(): void
    {
        $html = self::renderIdSearch();
        $xpath = self::parse($html);

        self::assertSame(1, self::nodeCount($xpath, "//div[@id='searchResults']/table/tr[@class='oneresult']"));
        $row = "//div[@id='searchResults']/table/tr[@class='oneresult'][@id='" . FinderRouteScenario::PID . "']";
        self::assertSame(1, self::nodeCount($xpath, $row));
        self::assertSame(0, self::nodeCount($xpath, "//tr[@id='" . FinderRouteScenario::OTHER_PID . "']"));
        self::assertStringContainsString(
            "<td class='srName'>" . FinderRouteScenario::ESCAPED_NAME . "</td>",
            $html
        );
        self::assertStringNotContainsString(FinderRouteScenario::RAW_LNAME, $html);
        foreach (
            [
                "<td class='srGender'>SYNTHETIC sex Female</td>",
                "<td class='srPhone' title='No other phone numbers listed'>555-0100</td>",
                "<td class='srDOB'>1980-02-03</td>",
                "<td class='srID'>" . FinderRouteScenario::ESCAPED_PUBPID . "</td>",
                "<td class='srPID'>" . FinderRouteScenario::PID . "</td>",
            ] as $cell
        ) {
            self::assertSame(1, substr_count($html, $cell), $cell);
        }
        self::assertSame(['sex:Female'], FinderRouteScenario::$listTitles);
        self::assertSame(FinderRouteScenario::expectedQueries(1), FinderRouteScenario::$queries);
        self::assertStringContainsString('1 - 1 of 1', $html);
    }

    #[Test]
    public function aNeverSeenPatientsNullAggregateRowStopsTheRouteAtTheBilledVisitTranslation(): void
    {
        // MAX() over no encounters is one row of NULLs; COUNT() would be 0.
        FinderRouteScenario::$encounterAggregates = FinderRouteScenario::NEVER_SEEN;
        $route = realpath(FinderRouteHarness::patientSelectPhp());
        self::assertIsString($route);
        $source = file($route);
        self::assertIsArray($source);
        $translations = array_keys(array_filter(
            $source,
            static fn (string $line): bool => str_contains($line, "\$next_appt_date = xl(\$results['next_appt_day'])")
        ));
        self::assertCount(2, $translations);

        $this->expectException(\TypeError::class);
        $this->expectExceptionMessage('xlCleanup(): Argument #1 ($string) must be of type string, null given');

        try {
            self::renderIdSearch();
        } catch (\TypeError $error) {
            // Observe where the route stopped, then rethrow for the expectation above.
            $routeFrames = array_values(array_filter(
                $error->getTrace(),
                static fn (array $frame): bool => ($frame['file'] ?? '') === $route
            ));
            self::assertNotEmpty($routeFrames);
            // The billed-visit block (the first of the two identical lines) is where it stops.
            self::assertSame($translations[0] + 1, $routeFrames[0]['line'] ?? null);
            // The patient read, the count and only the billed aggregate ran.
            self::assertSame(array_slice(FinderRouteScenario::expectedQueries(1), 0, 3), FinderRouteScenario::$queries);
            throw $error;
        }
    }

    #[Test]
    public function aSeenPatientRendersTheUnbilledAggregatesOverTheBilledOnes(): void
    {
        FinderRouteScenario::$encounterAggregates = FinderRouteScenario::SEEN;
        $html = self::renderIdSearch();

        // The unbilled reads run last and win: 3 encounters (not the 2 billed dates), last seen
        // 7 days ago (not 37), next due 90 days after that visit.
        self::assertSame(1, substr_count($html, self::encounterCells('3', '7', '2026-10-01', 'Wednesday, 2026-12-30')));
        self::assertStringNotContainsString('2026-11-30', $html);
        self::assertSame(FinderRouteScenario::expectedQueries(1), FinderRouteScenario::$queries);
    }

    #[Test]
    public function aSearchWithNoMatchRendersTheEmptyResultsTable(): void
    {
        FinderRouteScenario::$patientRows = [FinderRouteScenario::otherPatient()];
        $html = self::renderIdSearch();
        $xpath = self::parse($html);

        self::assertSame(0, self::nodeCount($xpath, "//div[@id='searchResults']//tr"));
        self::assertSame(11, self::nodeCount($xpath, "//div[@id='searchResultsHeader']/table/tr/th"));
        self::assertSame(FinderRouteScenario::expectedQueries(0), FinderRouteScenario::$queries);
        self::assertSame([], FinderRouteScenario::$listTitles);
    }

    #[Test]
    public function withoutPatientDemographicsAccessTheRouteIsRefusedBeforeEmittingOrReading(): void
    {
        FinderRouteScenario::$aclDemo = false;

        try {
            FinderRouteHarness::render(FinderRouteHarness::patientSelectPhp());
            self::fail('The route rendered without patients/demo access');
        } catch (AccessDeniedSentinel) {
        }

        self::assertSame(['["patients","demo","",""]'], FinderRouteScenario::$acl);
        self::assertSame(
            [['ACL check failed for patients/demo: Patient Selector', 'Patient Selector']],
            FinderRouteScenario::$denials
        );
        // Captured by the double at the moment of refusal, before the harness discards buffers.
        self::assertSame([['level' => FinderRouteHarness::$routeBufferLevel, 'output' => '']], FinderRouteScenario::$outputAtDenial);
        self::assertSame([], FinderRouteScenario::$queries);
        self::assertSame([], FinderRouteScenario::$headers);
    }

    #[Test]
    public function anUnrecordedStatementFailsClosed(): void
    {
        $this->expectException(\LogicException::class);
        FinderRouteScenario::sqlStatement('SELECT * FROM users', []);
    }

    private static function renderIdSearch(): string
    {
        FinderRouteHarness::request([
            'csrf_token_form' => substr(hash_hmac('sha256', 'default', FinderRouteScenario::CSRF_KEY), 0, 40),
            'patient' => FinderRouteScenario::SEARCH,
            'findBy' => 'ID',
            'searchFields' => '',
        ]);
        return FinderRouteHarness::render(FinderRouteHarness::patientSelectPhp());
    }

    private static function encounterCells(string $count, string $days, string $last, string $next): string
    {
        return "<td class='srNumEnc'>" . $count . "</td>\n"
            . "<td class='srNumDay'>" . $days . "</td>\n"
            . "<td class='srDateLast'>" . $last . "</td>\n"
            . "<td class='srDateNext'>" . $next . "</td>\n";
    }

    private static function parse(string $html): \DOMXPath
    {
        $dom = new \DOMDocument();
        self::assertTrue(@$dom->loadHTML($html));
        return new \DOMXPath($dom);
    }

    private static function nodeCount(\DOMXPath $xpath, string $query): int
    {
        $nodes = $xpath->query($query);
        self::assertInstanceOf(\DOMNodeList::class, $nodes);
        return $nodes->length;
    }
}
