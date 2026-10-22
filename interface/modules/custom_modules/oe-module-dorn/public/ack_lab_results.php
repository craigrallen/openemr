<?php

/**
 *
 * @package OpenEMR
 * @link    https://www.open-emr.org
 *
 * @author    Brad Sharp <brad.sharp@claimrev.com>
 * @copyright Copyright (c) 2022-2025 Brad Sharp <brad.sharp@claimrev.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

    require_once __DIR__ . "/../../../../globals.php";

    use OpenEMR\Common\Acl\AccessDeniedHelper;
    use OpenEMR\Common\Acl\AclMain;
    use OpenEMR\Common\Csrf\CsrfUtils;
    use OpenEMR\Common\Session\SessionWrapperFactory;
    use OpenEMR\Core\Header;
    use OpenEMR\Modules\Dorn\ConnectorApi;

$session = SessionWrapperFactory::getInstance()->getActiveSession();
if (!empty($_GET)) {
    CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);
}

if (!empty($_POST)) {
    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);
}

if (!AclMain::aclCheckCore('admin', 'users')) {
    AccessDeniedHelper::denyWithTemplate("ACL check failed for admin/users: Acknowledge Lab Results", xl("Acknowledge Lab Results"));
}

$resultsGuid = $_REQUEST['resultGuid'];
$rejectResults = $_REQUEST['rejectResults'];
if (empty($rejectResults)) {
    $rejectResults = false;
}

$rejectResults = $rejectResults == "true";
if ($resultsGuid) {
    ConnectorApi::sendAck($resultsGuid, $rejectResults, null);
}

?>
<!DOCTYPE html>
<html>
    <head>
        <?php Header::setupHeader(['opener']);?>
        <title><?php echo xlt("Alert"); ?></title>
        <style>
            @media screen {
              html.oe-workbench-context body.oe-dorn-ack-result {
                background-color: var(--oe-wb-canvas);
                color: var(--oe-wb-ink);
              }

              html.oe-workbench-context body.oe-dorn-ack-result > h3 {
                background-color: var(--oe-wb-paper);
                color: var(--oe-wb-ink);
                box-shadow: inset 0 0 0 1px var(--oe-wb-line);
              }
            }
        </style>
    </head>
    <body class="oe-dorn-ack-result">
    <?php
    if ($rejectResults == true) {
        ?>
    <h3><?php echo xlt("Results Rejected"); ?></h3>
        <?php
    } else {
        ?>
        <h3><?php echo xlt("Results Accepted"); ?></h3>
        <?php
    }
    ?>
    </body>
</html>
