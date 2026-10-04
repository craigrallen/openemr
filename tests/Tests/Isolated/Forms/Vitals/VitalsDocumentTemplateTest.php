<?php

/**
 * Render the real vitals form template and check the workbench document hooks.
 *
 * The workbench presentation of the vitals form is markup-only: a route body class, the
 * shared mode.js switch, explicit asset version tokens and named, keyboard-focusable scroll
 * regions around the measurement and history tables. This renders vitals.html.twig through
 * the same template directory the controller uses and checks those hooks alongside the
 * unchanged form, CSRF, save/cancel, growth chart and history contracts. The rendered page is
 * also recorded as a fixture that tests/js/clinical-vitals-document.test.js loads.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Forms\Vitals;

use OpenEMR\BC\ServiceContainer;
use OpenEMR\Core\Kernel;
use OpenEMR\Core\OEGlobalsBag;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Twig\Loader\FilesystemLoader;
use Twig\TwigFunction;

#[Group('isolated')]
#[Group('twig')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
class VitalsDocumentTemplateTest extends TestCase
{
    // OEGlobalsBag writes both its singleton and $GLOBALS, and ServiceContainer caches the
    // Twig environment. Process isolation keeps both from leaking into any other test.

    private const ASSET_VERSION = 82;

    private const FIXTURE = __DIR__ . '/fixtures/vitals-form-document.html';

    protected function setUp(): void
    {
        $globals = OEGlobalsBag::getInstance();
        $globals->set('kernel', new Kernel(dirname(__DIR__, 5), '/openemr'));
        $globals->set('date_display_format', 0);
        $globals->set('disable_translation', true);
        $globals->set('v_js_includes', self::ASSET_VERSION);
    }

    #[Test]
    public function renderedFormMatchesFixture(): void
    {
        $rendered = self::render();

        // @codeCoverageIgnoreStart
        if (getenv('UPDATE_FIXTURES') === '1') {
            file_put_contents(self::FIXTURE, $rendered);
            self::markTestSkipped('Fixture updated: ' . self::FIXTURE);
        }
        // @codeCoverageIgnoreEnd

        $expected = file_get_contents(self::FIXTURE);
        self::assertIsString($expected, 'Missing fixture; regenerate with UPDATE_FIXTURES=1');
        self::assertSame($expected, $rendered);
    }

    #[Test]
    public function bodyOptsIntoWorkbenchPresentationWithVersionedAssets(): void
    {
        $html = self::render();
        $version = self::ASSET_VERSION . '-vitals-document-2';

        self::assertStringContainsString('<body class="oe-clinical-vitals">', $html);
        self::assertStringContainsString(
            '<link rel="stylesheet" href="/openemr/interface/forms/vitals/vitals.css?v=' . $version . '" />',
            $html
        );
        self::assertStringContainsString(
            '<script src="/openemr/interface/clinical-workspace/mode.js?v=' . $version . '" defer></script>',
            $html
        );
        self::assertStringContainsString('/interface/forms/vitals/vitals.js?v=' . self::ASSET_VERSION . '"', $html);
        self::assertStringNotContainsString('workspace.css', $html);
    }

    #[Test]
    public function tablesSitInNamedKeyboardScrollRegions(): void
    {
        $xpath = self::xpath(self::render());
        foreach (['vitals-measurements' => 'Vitals', 'vitals-history-measurements' => 'Vitals History'] as $id => $name) {
            $region = self::single($xpath, "//div[@id='{$id}']");
            self::assertSame('table-responsive', $region->getAttribute('class'));
            self::assertSame('region', $region->getAttribute('role'));
            self::assertSame($name, $region->getAttribute('aria-label'));
            self::assertSame('0', $region->getAttribute('tabindex'));
            self::single($xpath, "//div[@id='{$id}']/table");
        }
        self::single($xpath, "//form[@id='vitalsForm']//div[@id='vitals-measurements']");
    }

    #[Test]
    public function formSaveCancelAndCsrfContractsAreUnchanged(): void
    {
        $xpath = self::xpath(self::render());
        $form = self::single($xpath, "//form[@id='vitalsForm']");
        self::assertSame('post', $form->getAttribute('method'));
        self::assertSame('vitals', $form->getAttribute('name'));
        self::assertSame('/openemr/interface/forms/vitals/save.php', $form->getAttribute('action'));
        self::assertSame('test-csrf-token', self::single($xpath, "//input[@name='csrf_token_form']")->getAttribute('value'));
        self::single($xpath, "//button[@type='submit' and @name='Submit' and contains(@class, 'btn-save')]");
        self::single($xpath, "//button[@id='cancel' and @type='button' and contains(@class, 'btn-cancel')]");
        self::single($xpath, "//input[@id='pdfchart']");
        self::single($xpath, "//input[@id='htmlchart']");
        self::single($xpath, "//a[@href='#patient-vitals-history']");
        self::assertSame('128', self::single($xpath, "//input[@name='bps']")->getAttribute('value'));
        self::assertSame('176.4', self::single($xpath, "//input[@type='hidden' and @name='weight']")->getAttribute('value'));
        self::assertSame('24.61', self::single($xpath, "//input[@name='BMI']")->getAttribute('value'));
        $reason = self::single($xpath, "//tr[@id='bps_reason_code']");
        self::assertStringNotContainsString('d-none', $reason->getAttribute('class'));
        self::single($xpath, "//tr[@id='bps_reason_code']//div[contains(concat(' ', @class, ' '), ' card ')]");
        self::single($xpath, "//select[@name='interpretation[bps]']/option[@value='H' and @selected]");
        foreach (['id' => '7', 'pid' => '3', 'activity' => '1', 'process' => 'true'] as $name => $value) {
            self::assertSame($value, self::single($xpath, "//input[@type='hidden' and @name='{$name}']")->getAttribute('value'));
        }
    }

    private static function render(): string
    {
        $twig = ServiceContainer::getTwig();
        // C_FormVitals renders with its own template directory on the search path.
        $loader = $twig->getLoader();
        self::assertInstanceOf(FilesystemLoader::class, $loader);
        $loader->addPath(dirname(__DIR__, 5) . '/interface/forms/vitals/templates/vitals');
        $twig->addFunction(new TwigFunction('setupHeader', fn(): string => '<!-- setupHeader stub -->', ['is_safe' => ['html']]));
        // The real helper requires the datetimepicker locale script from the source tree.
        $twig->addFunction(new TwigFunction('jqueryDateTimePicker', fn(): string => '/* jqueryDateTimePicker stub */', ['is_safe' => ['html']]));

        $rendered = $twig->render('vitals.html.twig', [
            'vitals' => self::vitals('2026-10-01 09:30:00', 128, true),
            'validationErrors' => [],
            'vitalFields' => self::fields(),
            'FORM_ACTION' => '/openemr',
            'DONT_SAVE_LINK' => '/openemr/interface/patient_file/encounter/encounter_top.php',
            'units_of_measurement' => 3,
            'MEASUREMENT_METRIC_ONLY' => 4,
            'MEASUREMENT_USA_ONLY' => 3,
            'MEASUREMENT_PERSIST_IN_METRIC' => 2,
            'MEASUREMENT_PERSIST_IN_USA' => 1,
            'hide_circumferences' => false,
            'CSRF_TOKEN_FORM' => 'test-csrf-token',
            'results' => self::history(),
            'vitalsHistoryLookback' => self::history(),
            'hasMoreVitals' => true,
            'results_count' => 3,
            'reasonCodeStatii' => [
                ['code' => '', 'description' => 'Select a status code'],
                ['code' => 'completed', 'description' => 'Completed'],
            ],
            'interpretation_options' => [
                ['id' => 'N', 'title' => 'Normal', 'is_default' => false],
                ['id' => 'H', 'title' => 'High', 'is_default' => false],
            ],
            'VIEW' => true,
            'patient_age' => 45,
            'patient_dob' => '1981-02-03',
            'show_pediatric_fields' => false,
            'has_id' => 7,
        ]);

        return implode("\n", array_map(rtrim(...), explode("\n", $rendered)));
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function fields(): array
    {
        $range = ['min' => 0, 'max' => 400, 'warningMin' => 60, 'warningMax' => 250];
        return [
            [
                'type' => 'textbox_conversion', 'title' => 'Weight', 'input' => 'weight',
                'vitalsValue' => 'get_weight', 'vitalsValueMetric' => 'get_weight_metric',
                'unit' => 'lbs', 'unitMetric' => 'kg', 'unitLabel' => 'lbs', 'unitMetricLabel' => 'kg',
                'precision' => 2, 'vitalsValueUSAHelpTitle' => 'Decimal pounds or pounds and ounces separated by #(e.g. 5#4)',
                'codes' => 'LOINC:29463-7', 'validation' => ['min' => 0, 'max' => 1500, 'warningMin' => 2, 'warningMax' => 700],
            ],
            [
                'type' => 'textbox', 'title' => 'BP Systolic', 'vitalsValue' => 'get_bps', 'input' => 'bps',
                'unit' => 'mmHg', 'unitLabel' => 'mmHg', 'codes' => 'LOINC:8480-6', 'validation' => $range,
            ],
            ['type' => 'template', 'templateName' => 'vitals_bmi.html.twig'],
            ['type' => 'template', 'templateName' => 'vitals_bmi_status.html.twig'],
            ['type' => 'template', 'templateName' => 'vitals_temp_method.html.twig', 'input' => 'temp_method', 'title' => 'Temp Location'],
            ['type' => 'template', 'templateName' => 'vitals_notes.html.twig', 'title' => 'Other Notes', 'input' => 'note', 'vitalsValue' => 'get_note'],
            ['type' => 'template', 'templateName' => 'vitals_growthchart_actions.html.twig', 'hide' => true, 'renderInHistory' => false],
        ];
    }

    /**
     * @return list<object>
     */
    private static function history(): array
    {
        return [
            self::vitals('2026-09-01 10:00:00', 141, false),
            self::vitals('2026-06-12 14:15:00', 135, false),
            self::vitals('2026-01-20 08:45:00', 122, false),
        ];
    }

    /**
     * Stand-in for FormVitals (which loads from the database): only the getters the templates call.
     * With $reason, systolic BP carries an interpretation and reason so its reason card renders open.
     */
    private static function vitals(string $date, int $bps, bool $reason): object
    {
        return new class ($date, $bps, $reason) {
            public function __construct(private readonly string $date, private readonly int $bps, private readonly bool $reason)
            {
            }

            public function get_date(): string
            {
                return $this->date;
            }

            public function get_bps(): int
            {
                return $this->bps;
            }

            public function get_weight(): float
            {
                return 176.4;
            }

            public function get_weight_metric(): float
            {
                return 80.01;
            }

            public function get_BMI(): string
            {
                return '24.61';
            }

            public function get_BMI_status(bool $translate = false): string
            {
                return 'Normal BW';
            }

            public function get_temp_method(): string
            {
                return 'Oral';
            }

            public function get_note(): string
            {
                return 'Seated, left arm, after five minutes rest; repeat reading taken because the first cuff size was too small for the patient';
            }

            public function get_details_for_column(?string $column): ?object
            {
                if (!$this->reason || $column !== 'bps') {
                    return null;
                }
                return new class {
                    public function get_interpretation_option_id(): string
                    {
                        return 'H';
                    }

                    public function get_reason_code(): string
                    {
                        return 'SNOMED-CT:271649006';
                    }

                    public function get_reason_description(): string
                    {
                        return 'Systolic blood pressure above reference range';
                    }

                    public function get_reason_status(): string
                    {
                        return 'completed';
                    }
                };
            }

            public function has_reason_for_column(?string $column): bool
            {
                return $this->reason && $column === 'bps';
            }

            public function get_id(): int
            {
                return 7;
            }

            public function get_uuid_string(): string
            {
                return '9a1f0000-0000-4000-8000-000000000007';
            }

            public function get_activity(): int
            {
                return 1;
            }

            public function get_pid(): int
            {
                return 3;
            }

            public function get_height(): string
            {
                return '';
            }

            public function get_head_circ(): string
            {
                return '';
            }
        };
    }

    private static function xpath(string $html): \DOMXPath
    {
        $dom = new \DOMDocument();
        self::assertTrue($dom->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NOERROR | LIBXML_NONET));
        return new \DOMXPath($dom);
    }

    private static function single(\DOMXPath $xpath, string $query): \DOMElement
    {
        $nodes = $xpath->query($query);
        self::assertNotFalse($nodes);
        self::assertSame(1, $nodes->length, $query);
        $node = $nodes->item(0);
        self::assertInstanceOf(\DOMElement::class, $node);
        return $node;
    }
}
