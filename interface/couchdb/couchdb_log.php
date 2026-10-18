<?php

/**
 * will display the couchdb log
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2019 Brady Miller <brady.g.miller@gmail.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once("../globals.php");

use OpenEMR\BC\ServiceContainer;
use OpenEMR\Common\Acl\AccessDeniedHelper;
use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;
use OpenEMR\Core\OEGlobalsBag;

if (!AclMain::aclCheckCore('admin', 'users')) {
    AccessDeniedHelper::denyWithTemplate('ACL check failed for admin/users: CouchDB log', xl('Logs Viewer'));
}

$clinicalAssets = new ClinicalWorkspaceAssets();
?>
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo xlt('Logs Viewer'); ?></title>
    <link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/couchdb-log-popup.css?v=<?php echo attr_url($clinicalAssets->version('couchdb-log-popup.css')); ?>">
    <script src="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/popup.js?v=<?php echo attr_url($clinicalAssets->version('popup.js')); ?>"></script>
</head>
<body class="oe-couchdb-log">
<main class="oe-couchdb-log-sheet">
<div class="oe-couchdb-log-content">
<?php
$filename = OEGlobalsBag::getInstance()->get('OE_SITE_DIR') . '/documents/couchdb/log.txt';

if (!file_exists($filename)) {
    echo xlt("CouchDB error log is empty");
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
    echo xlt("CouchDB error log is empty");
}
?>
</div>
</main>
</body>
</html>
