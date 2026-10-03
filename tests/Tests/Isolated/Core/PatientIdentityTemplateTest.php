<?php

/**
 * Renders the real patient_data_template.php against the real OEGlobalsBag
 * and Kernel (no database, no session) and checks the identity banner markup
 * for every patient_name_display variant. Also covers the standalone Jest
 * harness stubs without triggering its CLI-only alias/render path.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\Isolated\Core;

use OpenEMR\Core\Kernel;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Tests\Js\Fixtures\PatientDataTemplateGlobalsStub;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use PHPUnit\Framework\TestCase;

#[Group('isolated')]
#[Group('core')]
#[RunTestsInSeparateProcesses]
#[PreserveGlobalState(false)]
final class PatientIdentityTemplateTest extends TestCase
{
    // OEGlobalsBag writes both its singleton and $GLOBALS. Process isolation
    // prevents template settings from leaking into any subsequent test.

    public function testRealTemplateRendersIdentityBannerForEveryNameDisplayVariant(): void
    {
        $root = dirname(__DIR__, 4);
        require_once $root . '/library/htmlspecialchars.inc.php';
        require_once $root . '/library/translation.inc.php';

        $bag = OEGlobalsBag::getInstance();
        $bag->set('kernel', new Kernel($root, '/openemr'));
        $bag->set('disable_translation', true);

        $variants = [
            'btn' => [
                '<div class="btn-group btn-group-sm mb-2">',
                'class="ptName btn btn-sm btn-secondary "',
                '<span class="text-muted workbench-identity-id">',
                'class="pt-1 btn btn-sm btn-secondary "',
                'class="fa fa-times text-muted"',
            ],
            'text-large' => [
                '<h3 class="d-inline">',
                'class="ptName  "',
                '<small class="text-muted workbench-identity-id">',
                '<small class="">',
                'class="pt-1  text-muted"',
                'class="fa fa-times text-muted fa-xs"',
            ],
            'default' => [
                '<div class="d-inline">',
                'class="ptName  "',
                '<span class="text-muted workbench-identity-id">',
                '<span class="">',
                'class="pt-1  text-muted"',
                'class="fa fa-times text-muted"',
            ],
        ];

        $bindings = [
            'click:refreshPatient,with: patient', 'text: pname()', 'text: pubpid', 'click:clearPatient',
            'text:patient().str_dob()', 'click: clickEncounterList', 'text:encounterArray().length',
            'click:chooseEncounterEvent', 'click:reviewEncounterEvent', 'click: clickNewEncounter',
            'click: refreshEncounter', 'text:selectedEncounter().date()', 'text:selectedEncounter().id()',
            'click: viewMessages', 'click: viewPortalMail', 'click: viewPortalAudits',
            'click: viewPortalPayments', 'click: viewFaxCount', 'click: viewSmsCount',
        ];

        foreach ($variants as $variant => $variantMarkup) {
            $bag->set('patient_name_display', $variant);
            $html = $this->render($root . '/interface/main/tabs/templates/patient_data_template.php');

            $this->assertStringContainsString('<script type="text/html" id="patient-data-template">', $html, $variant);
            $this->assertStringContainsString('class="workbench-identity-patient" role="group" aria-label="Patient"', $html, $variant);
            $this->assertStringContainsString('class="workbench-identity-encounter" role="group" aria-label="Encounter"', $html, $variant);
            $this->assertStringContainsString('<span class="sr-only workbench-identity-label">External ID</span>', $html, $variant);
            foreach (['Close Patient Chart', 'Visit History', 'New Encounter'] as $label) {
                $this->assertStringContainsString('aria-label="' . $label . '"', $html, $variant . ': ' . $label);
            }
            $this->assertStringContainsString('<span class="sr-only">View Messages</span>', $html, $variant);
            $this->assertStringNotContainsString('{{Encounter}}', $html, $variant . ': translation context marker leaked');
            $this->assertStringContainsString("onError=\"this.src = '/openemr/public/images/patient-picture-default.png'\"", $html, $variant);
            $this->assertStringContainsString('"\/openemr\/public\/images\/patient-picture-default.png"', $html, $variant);

            foreach ($bindings as $binding) {
                $this->assertStringContainsString('data-bind="' . $binding . '"', $html, $variant . ': ' . $binding);
            }
            foreach ($variantMarkup as $markup) {
                $this->assertStringContainsString($markup, $html, $variant . ': ' . $markup);
            }
            foreach (['div', 'a', 'span', 'small', 'h3', 'nav', 'button', 'ul', 'li'] as $tag) {
                $this->assertSame(
                    preg_match_all('/<' . $tag . '\b/', $html),
                    preg_match_all('#</' . $tag . '>#', $html),
                    $variant . ': unbalanced <' . $tag . '>'
                );
            }
        }
    }

    public function testHarnessStubsAreDefinedWithoutAliasingTheRealBag(): void
    {
        require_once dirname(__DIR__, 4) . '/tests/js/fixtures/patient-data-template-harness.php';

        $this->assertSame(OEGlobalsBag::class, (new \ReflectionClass(OEGlobalsBag::class))->getName());

        PatientDataTemplateGlobalsStub::configure('text-large');
        $stub = PatientDataTemplateGlobalsStub::getInstance();
        $this->assertSame('text-large', $stub->get('patient_name_display'));
        $this->assertNull($stub->get('search_any_patient'));
        $this->assertTrue($stub->getBoolean('disable_translation'));
        $this->assertFalse($stub->getBoolean('temp_skip_translations'));
        $this->assertSame('/images', $stub->getKernel()->getImagesRelative());
    }

    private function render(string $template): string
    {
        ob_start();
        try {
            require $template;
        } finally {
            $html = ob_get_clean();
        }
        $this->assertIsString($html);
        return $html;
    }
}
