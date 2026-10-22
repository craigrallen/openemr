<?php

/**
 * interface/billing/customize_log.php - starting point for customization of billing log
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Stephen Waite <stephen.waite@cmsvt.com>
 * @author    Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2014 Stephen Waite <stephen.waite@cmsvt.com>
 * @copyright Copyright (c) 2019 Brady Miller <brady.g.miller@gmail.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once("../globals.php");

use OpenEMR\BC\ServiceContainer;
use OpenEMR\Common\Acl\AccessDeniedHelper;
use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;
use OpenEMR\Core\OEGlobalsBag;

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
    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/billing-log-popup.css?v=<?php echo attr_url($clinicalAssets->version('billing-log-popup.css')); ?>">
    <script src="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/popup.js?v=<?php echo attr_url($clinicalAssets->version('popup.js')); ?>"></script>
</head>
<body class="oe-billing-log">
<main class="oe-billing-log-sheet">
<div class="oe-billing-log-content">
<?php
$filename = OEGlobalsBag::getInstance()->get('OE_SITE_DIR') . '/documents/edi/process_bills.log';

if (!file_exists($filename)) {
    echo xlt("Billing log is empty");
    ?>
</div>
</main>
</body>
</html>
    <?php
    exit;
}

$fh = file_get_contents($filename);

$cryptoGen = ServiceContainer::getCrypto();
$fh = $cryptoGen->decryptFromFilesystem($fh);

if (!empty($fh)) {
    echo nl2br(text($fh));
} else {
    echo xlt("Billing log is empty");
}
?>
</div>
</main>
</body>
</html>
