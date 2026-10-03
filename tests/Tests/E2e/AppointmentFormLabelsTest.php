<?php

/**
 * E2e test for the add/edit appointment form label associations.
 *
 * Loads add_edit_event.php as the logged-in admin and verifies that the
 * duration, repeat-until, status and exclusive-category labels are bound
 * to their controls, and that the read-only picker key binding leaves the
 * typeable patient field with its native key handling.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

namespace OpenEMR\Tests\E2e;

use OpenEMR\Tests\E2e\Base\BaseTrait;
use OpenEMR\Tests\E2e\Login\LoginTestData;
use OpenEMR\Tests\E2e\Login\LoginTrait;
use PHPUnit\Framework\Attributes\Depends;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Component\Panther\PantherTestCase;

class AppointmentFormLabelsTest extends PantherTestCase
{
    use BaseTrait;
    use LoginTrait;

    #[Test]
    #[Depends('testLoginAuthorized')]
    public function testAppointmentFormLabelsAreBoundToControls(): void
    {
        $this->base();
        try {
            $this->login(LoginTestData::username, LoginTestData::password);

            $this->client->request('GET', '/interface/main/calendar/add_edit_event.php?startampm=1&starttimeh=9&starttimem=0&date=20260105');
            $this->client->waitFor('#form_save');

            // bindPickerKeys(document) runs in the page's jQuery ready handler. A ready handler
            // registered now runs after it, so the key assertions below see the bound state.
            $this->assertTrue(
                $this->client->executeAsyncScript(<<<'JS_WRAP'
                    var done = arguments[arguments.length - 1];
                    jQuery(function () { done(true); });
                JS_WRAP),
                'Appointment form ready handlers must have run'
            );

            // label.control is the browser's own resolution of the for= association.
            $result = $this->client->executeScript(<<<'JS_WRAP'
                var ids = ['tdallday4', 'tdrepeat2', 'title_apptstatus', 'title_prefcat'];
                var controls = {};
                ids.forEach(function (id) {
                    var label = document.getElementById(id);
                    controls[id] = label && label.control ? label.control.id : null;
                });
                return JSON.stringify(controls);
            JS_WRAP);

            $this->assertIsString($result);
            $this->assertSame(
                [
                    'tdallday4' => 'tdallday5',
                    'tdrepeat2' => 'form_enddate',
                    'title_apptstatus' => 'form_apptstatus',
                    'title_prefcat' => 'form_prefcat',
                ],
                json_decode($result, true),
                'Appointment form labels must resolve to their controls'
            );

            // The patient field is typeable, so the picker key binding must not open the finder on Enter.
            $patientResult = $this->client->executeScript(<<<'JS_WRAP'
                var calls = 0;
                window.sel_patient = function () { calls++; };
                var field = document.getElementById('form_patient');
                var event = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true});
                field.dispatchEvent(event);
                return JSON.stringify({readOnly: field.readOnly, calls: calls, prevented: event.defaultPrevented});
            JS_WRAP);

            $this->assertIsString($patientResult);
            $this->assertSame(
                ['readOnly' => false, 'calls' => 0, 'prevented' => false],
                json_decode($patientResult, true),
                'Typeable patient field must keep native key handling'
            );
        } catch (\Throwable $e) {
            $this->client->quit();
            throw $e;
        }
        $this->client->quit();
    }
}
