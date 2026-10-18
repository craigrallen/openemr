<?php

/**
 * interface/billing/clear_log.php - backup, then clear billing log
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Brady Miller <brady.g.miller@gmail.com>
 * @author    Sherwin Gaddis <sherwingaddis@gmail.com>
 * @copyright Copyright (c) 2019 Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2019 Sherwin Gaddis <sherwingaddis@gmail.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
*/

require_once("../globals.php");

use OpenEMR\Common\Acl\AccessDeniedHelper;
use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;
use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\OEGlobalsBag;

$session = SessionWrapperFactory::getInstance()->getActiveSession();
CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);

//ensure user has proper access
if (!AclMain::aclCheckCore('acct', 'eob', '', 'write') && !AclMain::aclCheckCore('acct', 'bill', '', 'write')) {
    AccessDeniedHelper::denyWithTemplate("ACL check failed for acct/eob or acct/bill: Billing Log", xl("Billing Log"));
}

$clinicalAssets = new ClinicalWorkspaceAssets();
?>
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo xlt('Billing Log'); ?></title>
    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/billing-clear-popup.css?v=<?php echo attr_url($clinicalAssets->version('billing-clear-popup.css')); ?>">
    <script src="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/popup.js?v=<?php echo attr_url($clinicalAssets->version('popup.js')); ?>"></script>
</head>
<body class="oe-billing-clear">
<main class="oe-billing-clear-sheet">
<div class="oe-billing-clear-content">
<?php

$filename = OEGlobalsBag::getInstance()->get('OE_SITE_DIR') . '/documents/edi/process_bills.log';
if (file_exists($filename)) {
    $newlog = OEGlobalsBag::getInstance()->get('OE_SITE_DIR') . '/documents/edi/' . date("Y-m-d-His") . '_process_bills.log';
    rename($filename, $newlog);
    echo xlt("Log is cleared. Please close window.");
} else {
    echo xlt("Log was already empty. Please close window.");
}
?>
</div>
</main>
</body>
</html>
