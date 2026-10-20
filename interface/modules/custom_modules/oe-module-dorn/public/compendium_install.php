<?php

/**
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 *
 * @author    Brad Sharp <brad.sharp@claimrev.com>
 * @author    Jerry Padgett <sjpadgett@gmail.com>
 * @copyright Copyright (c) 2022-2025 Brad Sharp <brad.sharp@claimrev.com>
 * @copyright Copyright (c) 2024-2025 Jerry Padgett <sjpadgett@gmail.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . "/../../../../globals.php";

use OpenEMR\Common\Acl\AccessDeniedHelper;
use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Modules\Dorn\LabCompendiumInstall;

if (!AclMain::aclCheckCore('admin', 'users')) {
    AccessDeniedHelper::denyWithTemplate("ACL check failed for admin/users: DORN Compendium Install", xl("DORN Compendium Install"));
}

if (!empty($_GET)) {
    $session = SessionWrapperFactory::getInstance()->getActiveSession();
    CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);
    $labGuid = $_REQUEST['labGuid'];
    echo '<html class="oe-dorn-compendium"><head><script src="' .
        attr(\OpenEMR\Core\OEGlobalsBag::getInstance()->getWebRoot() . '/interface/clinical-workspace/popup.js') .
        '?v=' .
        attr_url(\OpenEMR\Core\OEGlobalsBag::getInstance()->getString('v_js_includes')) .
        '"></script><style>
@media screen {
  html.oe-dorn-compendium.oe-workbench-context body {
    color: var(--oe-wb-ink, #17343b);
    background-color: var(--oe-wb-canvas, #f3f7f5);
  }

  html.oe-dorn-compendium.oe-workbench-context body > .oe-dorn-compendium-result {
    color: var(--oe-wb-ink, #17343b) !important;
    background-color: var(--oe-wb-paper, #fff) !important;
  }
}
</style></head>';
    echo "<div class='oe-dorn-compendium-result' style='background-color: white; color: black; padding: 5px;'>" .
        "<div>" . xlt('Compendium Install') . "</div><ul>";
    ob_flush();
    flush();
    echo "<li>" . xlt('Starting uninstall.') . "</li>";
    ob_flush();
    flush();
    LabCompendiumInstall::uninstall($labGuid);
    echo "<li>" . xlt('Uninstall complete.') . "</li><li>" . xlt('Starting Install.') . "</li>";
    echo "<li>" . xlt('Be Patient. Dialog will close when finished loading.') . "</li>";
    ob_flush();
    flush();
    LabCompendiumInstall::install($labGuid);
    echo "<li>" . xlt('Install complete.') . "</li>";
    echo "</ul><div>" . xlt('Compendium Install Complete') . "</div></div>";
    ob_flush();
    flush();
    echo "<script>
setTimeout(function() {
    parent.dlgclose();
}, 5000);
</script>";
}
