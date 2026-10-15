<?php

/**
 * active reminder popup gui
 *
 * @package OpenEMR
 * @link    https://www.open-emr.org
 * @author  Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2011-2018 Brady Miller <brady.g.miller@gmail.com>
 * @license https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once("../../globals.php");
$session = \OpenEMR\Common\Session\SessionWrapperFactory::getInstance()->getActiveSession();
$pid = $session->get('pid', 0);
require_once(\OpenEMR\Core\OEGlobalsBag::getInstance()->getSrcDir() . "/clinical_rules.php");

use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;
use OpenEMR\Core\Header;
use OpenEMR\Core\OEGlobalsBag;


?>
<html>
<head>
<?php Header::setupHeader('opener'); ?>
<?php $clinicalAssets = new ClinicalWorkspaceAssets(); ?>
<link rel="stylesheet" media="screen" href="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot()); ?>/interface/clinical-workspace/active-reminders-popup.css?v=<?php echo attr_url($clinicalAssets->version('active-reminders-popup.css')); ?>">
</head>

<body class="body_top oe-active-reminders">
<div class="oe-reminders-sheet">

<table class="table border-0 oe-reminders-heading">
<tr>

<?php
$all_allergy_alerts = [];
if (OEGlobalsBag::getInstance()->getBoolean('enable_allergy_check')) {
  // Will show allergy and medication/prescription conflicts here
    $all_allergy_alerts = allergy_conflict($pid, 'all', $session->get('authUser'));
}

$active_alerts = active_alert_summary($pid, "reminders-due", '', 'default', $session->get('authUser'));
?>

<td><span class="title">
<?php
if (!empty($active_alerts) && empty($all_allergy_alerts)) {
    echo xlt("Alerts/Reminders");
} elseif (!empty($active_alerts) && !empty($all_allergy_alerts)) {
    echo xlt("WARNINGS and Alerts/Reminders");
} else { // empty($active_alerts) && !empty($all_allergy_alerts)
    echo xlt("WARNINGS");
}

?>
</span>&nbsp;&nbsp;&nbsp;</td>
<td>
    <a href="#" id="close" class="btn btn-secondary btn-lg" onclick="dlgclose(); return false;"><?php echo xlt('Close');?></a>
</td>
</tr>
</table>
<br />
<?php
if (!empty($all_allergy_alerts)) {
    foreach ($all_allergy_alerts as $allergy) {
        echo xlt("ALLERGY WARNING") . ":" . text($allergy) . "<br />";
    }
    echo "<br />";
}

echo $active_alerts;
?>
</div>
</body>
</html>
