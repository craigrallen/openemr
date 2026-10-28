<?php

/**
 * transfer summary form.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Naina Mohamed <naina@capminds.com>
 * @author    Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2012-2013 Naina Mohamed <naina@capminds.com> CapMinds Technologies
 * @copyright Copyright (c) 2017-2019 Brady Miller <brady.g.miller@gmail.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once(__DIR__ . "/../../globals.php");

use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Common\Session\PatientSessionUtil;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Header;
use OpenEMR\Core\OEGlobalsBag;

// Hoist legacy `globals.php` locals so PHPStan can see them (#11792 Phase 5).
$srcdir = OEGlobalsBag::getInstance()->getSrcDir();
$rootdir = OEGlobalsBag::getInstance()->getString('rootdir');
$pid = PatientSessionUtil::getPid();

require_once("$srcdir/options.inc.php");

formHeader("Form:Transfer Summary");
$returnurl = 'encounter_top.php';
$formid = (int) ($_GET['id'] ?? 0);
$obj = $formid ? formFetch("form_transfer_summary", $formid) : [];
$session = SessionWrapperFactory::getInstance()->getActiveSession();
?>
<html>
<head>

<?php Header::setupHeader('datetime-picker'); ?>

<script>
 $(function () {
  var win = top.printLogSetup ? top : opener.top;
  win.printLogSetup(document.getElementById('printbutton'));

  $('.datepicker').datetimepicker({
    <?php $datetimepicker_timepicker = false; ?>
    <?php $datetimepicker_showseconds = false; ?>
    <?php $datetimepicker_formatInput = false; ?>
    <?php require(OEGlobalsBag::getInstance()->getSrcDir() . '/js/xl/jquery-datetimepicker-2-5-4.js.php'); ?>
    <?php // can add any additional javascript settings to datetimepicker here; need to prepend first setting with a comma ?>
  });
 });
</script>

<style>
@media screen {
  html.oe-workbench-context body.body_top.oe-transfer-summary-editor {
    margin: 0;
    background-color: #edf2f3 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor > p,
  html.oe-workbench-context body.oe-transfer-summary-editor > br,
  html.oe-workbench-context body.oe-transfer-summary-editor > form {
    box-sizing: border-box;
    width: calc(100% - 2rem);
    max-width: 860px;
    margin-inline: auto;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor > p {
    margin-block: 1.5rem 0;
    padding-block: 1.5rem 0;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-bottom: 0;
    border-radius: 7px 7px 0 0;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor .forms-title {
    color: #182c36 !important;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor > br {
    display: none;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor > form {
    margin-block: 0 1.5rem;
    padding-block: 0 2rem;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-top: 0;
    border-radius: 0 0 7px 7px;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form > table {
    display: block;
    box-sizing: border-box;
    width: 100%;
    border-collapse: collapse;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form > table > tbody,
  html.oe-workbench-context body.oe-transfer-summary-editor form > table tr {
    display: block;
    box-sizing: border-box;
    width: 100%;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form td {
    padding-block: 0.4rem;
    padding-inline: 0.3rem;
    vertical-align: top;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form .forms-data {
    background-color: #fff !important;
    color: #182c36 !important;
    line-height: 1.5;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_to,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_date {
    box-sizing: border-box;
    max-width: 100%;
    min-height: 2.5rem;
    padding-block: 0.45rem;
    padding-inline: 0.65rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_to {
    width: min(100%, 20rem);
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_date {
    width: min(100%, 11rem);
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(> td > textarea) {
    display: block;
    width: 100%;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(> td > textarea) > td {
    display: block;
    box-sizing: border-box;
    width: 100%;
    padding-inline: 0;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(.forms-data) {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 0.5rem;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(.forms-data) > td {
    display: block;
    box-sizing: border-box;
    flex: 0 1 auto;
    min-width: 0;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(> td > textarea) > td:first-child {
    padding-block: 1rem 0.4rem;
    text-align: left;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.5;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(> td > textarea) > td:last-child {
    padding-block: 0 1rem;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(#transfer_to) {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 0.5rem;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(#transfer_to) > td {
    display: block;
    box-sizing: border-box;
    flex: 0 1 auto;
    min-width: 0;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form textarea {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 12rem;
    padding-block: 0.65rem;
    padding-inline: 0.75rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff !important;
    color: #182c36 !important;
    font: inherit;
    line-height: 1.7;
    overflow-wrap: break-word;
    resize: vertical;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(#printbutton) {
    display: block;
    width: 100%;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(#printbutton) > td:first-child {
    display: none;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(#printbutton) > td:last-child {
    display: flex;
    box-sizing: border-box;
    width: 100%;
    padding-inline: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input[type='submit'],
  html.oe-workbench-context body.oe-transfer-summary-editor form input#printbutton,
  html.oe-workbench-context body.oe-transfer-summary-editor form input.button-css[type='button'] {
    display: inline-block;
    box-sizing: border-box;
    width: auto;
    max-width: 100%;
    min-height: 2.5rem;
    margin-block: 0.3rem;
    margin-inline: 0.2rem;
    padding-block: 0.55rem;
    padding-inline: 0.85rem;
    border: 1px solid #536773 !important;
    border-radius: 4px;
    background-color: #fff !important;
    color: #182c36 !important;
    cursor: pointer;
    font: inherit;
    font-weight: 600;
    white-space: normal;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input[type='submit'] {
    border-color: #145968 !important;
    background-color: #145968 !important;
    color: #fff !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input[type='submit']:hover,
  html.oe-workbench-context body.oe-transfer-summary-editor form input[type='submit']:focus,
  html.oe-workbench-context body.oe-transfer-summary-editor form input[type='submit']:active {
    border-color: #0d414d !important;
    background-color: #0d414d !important;
    color: #fff !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input#printbutton:hover,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#printbutton:focus,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#printbutton:active,
  html.oe-workbench-context body.oe-transfer-summary-editor form input.button-css[type='button']:hover,
  html.oe-workbench-context body.oe-transfer-summary-editor form input.button-css[type='button']:focus,
  html.oe-workbench-context body.oe-transfer-summary-editor form input.button-css[type='button']:active {
    border-color: #182c36 !important;
    background-color: #e4f0f1 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input[type='submit']:disabled,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#printbutton:disabled,
  html.oe-workbench-context body.oe-transfer-summary-editor form input.button-css[type='button']:disabled {
    border-color: #a9bbc3 !important;
    background-color: #e8edef !important;
    color: #536773 !important;
    cursor: not-allowed;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form textarea:focus-visible,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_to:focus-visible,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_date:focus-visible,
  html.oe-workbench-context body.oe-transfer-summary-editor form input[type='submit']:focus-visible,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#printbutton:focus-visible,
  html.oe-workbench-context body.oe-transfer-summary-editor form input.button-css[type='button']:focus-visible {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }
}

@media screen and (width <= 600px) {
  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(.forms-data) > td,
  html.oe-workbench-context body.oe-transfer-summary-editor form tr:has(#transfer_to) > td {
    flex-basis: 100%;
  }

  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_to,
  html.oe-workbench-context body.oe-transfer-summary-editor form input#transfer_date {
    width: 100%;
  }
}
</style>
</head>

<body class="body_top oe-transfer-summary-editor">
<p><span class="forms-title"><?php echo xlt('Transfer Summary'); ?></span></p>
<br />
<?php
echo "<form method='post' name='my_form' " .
  "action='$rootdir/forms/transfer_summary/save.php?id=" . attr_url($formid) . "'>\n";
?>
<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />
<table  border="0">
<tr>
<td align="left" class="forms" class="forms"><?php echo xlt('Client Name'); ?>:</td>
        <td class="forms">
            <label class="forms-data"> <?php
            $patient_name = '';
            if ($pid > 0) {
                $result = getPatientData($pid, "fname,lname,squad");
                echo text($result['fname']) . " " . text($result['lname']);
                $patient_name = $result['fname'] . " " . $result['lname'];
            }
            ?>
   </label>
   <input type="hidden" name="client_name" value="<?php echo attr($patient_name);?>">
        </td>
        <td align="left"  class="forms"><?php echo xlt('DOB'); ?>:</td>
        <td class="forms">
        <label class="forms-data"> <?php
        $dob = '';
        if ($pid > 0) {
            $result = getPatientData($pid, "*");
            echo text($result['DOB']);
            $dob = $result['DOB'];
        }
        ?>
   </label>
     <input type="hidden" name="DOB" value="<?php echo attr($dob);?>">
        </td>
        </tr>
    <tr>

    <td align="left" class="forms"><?php echo xlt('Transfer to'); ?>:</td>

     <td class="forms">
         <input type="text" name="transfer_to" id="transfer_to"
        value="<?php echo attr($obj["transfer_to"] ?? '');?>"></td>

        <td align="left" class="forms"><?php echo xlt('Transfer date'); ?>:</td>
        <td class="forms">
               <input type='text' size='10' class='datepicker' name='transfer_date' id='transfer_date'
       value='<?php echo attr($obj["transfer_date"] ?? ''); ?>'
       title='<?php echo xla('yyyy-mm-dd Date of service'); ?>' />
        </td>

    </tr>

    <tr>
        <td align="left colspan="3" style="padding-bottom:7px;"></td>
    </tr>

    <tr>
        <td align="left" class="forms"><b><?php echo xlt('Status Of Admission'); ?>:</b></td>
        <td colspan="3"><textarea name="status_of_admission" rows="3" cols="60" wrap="virtual name"><?php echo text($obj["status_of_admission"] ?? '');?></textarea></td>
        </tr>
        <tr>
        <td align="left colspan="3" style="padding-bottom:7px;"></td>
    </tr>
    <tr>
        <td align="left" class="forms"><b><?php echo xlt('Diagnosis'); ?>:</b></td>
        <td colspan="3"><textarea name="diagnosis" rows="3" cols="60" wrap="virtual name"><?php echo text($obj["diagnosis"] ?? '');?></textarea></td>
            </tr>
            <tr>
        <td align="left colspan="3" style="padding-bottom:7px;"></td>
    </tr>
    <tr>
        <td align="left" class="forms"><b><?php echo xlt('Intervention Provided'); ?>:</b></td>
        <td colspan="3"><textarea name="intervention_provided" rows="3" cols="60" wrap="virtual name"><?php echo text($obj["intervention_provided"] ?? '');?></textarea></td>
    </tr>
    <tr>
        <td align="left colspan="3" style="padding-bottom:7px;"></td>
    </tr>
    <tr>
        <td align="left" class="forms"><b><?php echo xlt('Overall Status Of Discharge'); ?>:</b></td>
        <td colspan="3"><textarea name="overall_status_of_discharge" rows="3" cols="60" wrap="virtual name"><?php echo text($obj["overall_status_of_discharge"] ?? '');?></textarea></td>
    </tr>

<tr>
        <td align="left colspan="3" style="padding-bottom:7px;"></td>
    </tr>

    <tr>
        <td align="left colspan="3" style="padding-bottom:7px;"></td>
    </tr>
    <tr>
        <td></td>
    <td><input type='submit'  value='<?php echo xlt('Save');?>' class="button-css">&nbsp;
    <input type='button' value='<?php echo xla('Print'); ?>' id='printbutton' />&nbsp;
    <input type='button' class="button-css" value='<?php echo xla('Cancel'); ?>'
 onclick="parent.closeTab(window.name, false)" />

 </td>
    </tr>
</table>
</form>

<?php
formFooter();
?>
