<?php

/**
 * aftercare_plan new.php
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

formHeader("Form:AfterCare Planning");
$returnurl = 'encounter_top.php';
$formid = (int) ($_GET['id'] ?? 0);
$obj = $formid ? formFetch("form_aftercare_plan", $formid) : [];

$session = SessionWrapperFactory::getInstance()->getActiveSession();
$disabled = '';
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
  html.oe-workbench-context body.body_top.oe-aftercare-plan-editor {
    margin: 0;
    background-color: #edf2f3 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor > p,
  html.oe-workbench-context body.oe-aftercare-plan-editor > br,
  html.oe-workbench-context body.oe-aftercare-plan-editor > form {
    box-sizing: border-box;
    width: calc(100% - 2rem);
    max-width: 860px;
    margin-inline: auto;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor > p {
    margin-block: 1.5rem 0;
    padding-block: 1.5rem 0;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-bottom: 0;
    border-radius: 7px 7px 0 0;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor .forms-title {
    color: #182c36 !important;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor > br {
    display: none;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor > form {
    margin-block: 0 1.5rem;
    padding-block: 0 2rem;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-top: 0;
    border-radius: 0 0 7px 7px;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form > table {
    display: block;
    box-sizing: border-box;
    width: 100%;
    border-collapse: collapse;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form > table > tbody,
  html.oe-workbench-context body.oe-aftercare-plan-editor form > table tr {
    display: block;
    box-sizing: border-box;
    width: 100%;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(textarea) {
    display: block;
    width: 100%;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form td {
    padding-block: 0.4rem;
    padding-inline: 0.3rem;
    vertical-align: top;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form td:has(> textarea) {
    display: block;
    box-sizing: border-box;
    width: 100%;
    padding-inline: 0;
    padding-bottom: 1.25rem;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(textarea) > td {
    display: block;
    box-sizing: border-box;
    width: 100%;
    padding-inline: 0;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(.forms-data),
  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(input.datepicker) {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form td.forms-subtitle {
    display: block;
    box-sizing: border-box;
    width: 100%;
    padding-block: 1.2rem 0.6rem;
    border-bottom: 1px solid #cbd6da;
    background-color: #fff !important;
    color: #182c36 !important;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.5;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(.forms-data) > td,
  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(input.datepicker) > td {
    display: block;
    box-sizing: border-box;
    flex: 0 1 auto;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(textarea) > td:first-child {
    text-align: left;
    white-space: nowrap;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form .forms-data {
    background-color: #fff !important;
    color: #182c36 !important;
    line-height: 1.5;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form input.datepicker {
    box-sizing: border-box;
    width: min(100%, 11rem);
    min-height: 2.5rem;
    padding-block: 0.45rem;
    padding-inline: 0.65rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(input.button-css) {
    display: block;
    width: 100%;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(input.button-css) > td:first-child {
    display: none;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form tr:has(input.button-css) > td:last-child {
    display: flex;
    box-sizing: border-box;
    width: 100%;
    padding-inline: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form textarea {
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

  html.oe-workbench-context body.oe-aftercare-plan-editor form input.button-css {
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

  html.oe-workbench-context body.oe-aftercare-plan-editor form textarea:focus,
  html.oe-workbench-context body.oe-aftercare-plan-editor form textarea:focus-visible,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input.datepicker:focus,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input.datepicker:focus-visible,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input.button-css:focus,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input.button-css:focus-visible {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form input.button-css:hover,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input.button-css:focus,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input.button-css:active {
    border-color: #182c36 !important;
    background-color: #e4f0f1 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form input.button-css:disabled {
    border-color: #a9bbc3 !important;
    background-color: #e8edef !important;
    color: #536773 !important;
    cursor: not-allowed;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form input[type='submit'].button-css {
    border-color: #145968 !important;
    background-color: #145968 !important;
    color: #fff !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form input[type='submit'].button-css:hover,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input[type='submit'].button-css:focus,
  html.oe-workbench-context body.oe-aftercare-plan-editor form input[type='submit'].button-css:active {
    border-color: #0d414d !important;
    background-color: #0d414d !important;
    color: #fff !important;
  }

  html.oe-workbench-context body.oe-aftercare-plan-editor form input[type='submit'].button-css:disabled {
    border-color: #a9bbc3 !important;
    background-color: #e8edef !important;
    color: #536773 !important;
  }

}

@media screen and (width <= 600px) {
  html.oe-workbench-context body.oe-aftercare-plan-editor form > table,
  html.oe-workbench-context body.oe-aftercare-plan-editor form > table > tbody,
  html.oe-workbench-context body.oe-aftercare-plan-editor form > table tr,
  html.oe-workbench-context body.oe-aftercare-plan-editor form > table td {
    display: block;
    box-sizing: border-box;
    width: 100%;
  }

}
</style>
</head>
<body class="body_top oe-aftercare-plan-editor">
<p><span class="forms-title"><?php echo xlt('AfterCare Planning'); ?></span></p>
<br />
<?php
echo "<form method='post' name='my_form' " .
  "action='$rootdir/forms/aftercare_plan/save.php?id=" . attr_url($formid) . "'>\n";
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


  <td align="left" class="forms"><?php echo xlt('Admit Date'); ?>:</td>
        <td class="forms">
               <input type='text' size='10' class='datepicker' name='admit_date' id='admission_date' <?php echo attr($disabled); ?>;
               value='<?php echo attr($obj["admit_date"]); ?>'
               title='<?php echo xla('yyyy-mm-dd Date of service'); ?>' />
        </td>
        <td align="left" class="forms"><?php echo xlt('Discharged'); ?>:</td>
        <td class="forms">
               <input type='text' size='10' class='datepicker' name='discharged' id='discharge_date' <?php echo attr($disabled); ?>;
      value='<?php echo attr($obj["discharged"]); ?>'
       title='<?php echo xla('yyyy-mm-dd Date of service'); ?>' />
        </td>
    </tr>
    <tr>
        <td align="left colspan="3" style="padding-bottom:7px;"></td>
    </tr>
        <tr>

        <td class="forms-subtitle" colspan="4"><B><?php echo xlt('Goal and Methods');?></B></td>

    </tr>
    <tr>
        <td align="left colspan="3" style="padding-bottom:7px;"></td>
    </tr>
    <tr>

        <td class="forms-subtitle" colspan="4"><B><?php echo xlt('Goal A');?>:</B>&nbsp;<?php echo xlt('Acute Intoxication/Withdrawal'); ?></td>

    </tr>
    <tr>
        <td align="right" class="forms">1.</td>
        <td colspan="3"><textarea name="goal_a_acute_intoxication" rows="2" cols="80" wrap="virtual name"><?php echo text($obj["goal_a_acute_intoxication"]);?></textarea></td>

    </tr>
    <tr>
        <td align="right" class="forms">2.</td>
        <td colspan="3"><textarea name="goal_a_acute_intoxication_I" rows="2" cols="80" wrap="virtual name"><?php echo text($obj["goal_a_acute_intoxication_I"]);?></textarea></td>

    </tr>
    <tr>
        <td align="right" class="forms">3.</td>
        <td colspan="3"><textarea name="goal_a_acute_intoxication_II" rows="2" cols="80" wrap="virtual name"><?php echo text($obj["goal_a_acute_intoxication_II"]);?></textarea></td>


    <tr>

        <td class="forms-subtitle" colspan="4"><B><?php echo xlt('Goal B');?>:</B>&nbsp;<?php  echo xlt('Emotional / Behavioral Conditions & Complications'); ?></td>

    </tr>
    <tr>
        <td align="right" class="forms">1.</td>
        <td colspan="3"><textarea name="goal_b_emotional_behavioral_conditions" rows="2" cols="80" wrap="virtual name"><?php echo text($obj["goal_b_emotional_behavioral_conditions"]);?></textarea></td>

    </tr>
    <tr>
        <td align="right" class="forms">2.</td>
        <td colspan="3"><textarea name="goal_b_emotional_behavioral_conditions_I" rows="2" cols="80" wrap="virtual name"><?php echo text($obj["goal_b_emotional_behavioral_conditions_I"]);?></textarea></td>

    </tr>


        <td class="forms-subtitle" colspan="4"><B><?php echo xlt('Goal C');?>:</B>&nbsp;<?php  echo xlt('Relapse Potential'); ?></td>

    </tr>
    <tr>
        <td align="right" class="forms">1.</td>
        <td colspan="3"><textarea name="goal_c_relapse_potential" rows="2" cols="80" wrap="virtual name"><?php echo text($obj["goal_c_relapse_potential"]);?></textarea></td>

    </tr>
    <tr>
        <td align="right" class="forms">2.</td>
        <td colspan="3"><textarea name="goal_c_relapse_potential_I" rows="2" cols="80" wrap="virtual name"><?php echo text($obj["goal_c_relapse_potential_I"]);?></textarea></td>

    </tr>

    <tr>
        <td align="left colspan="3" style="padding-bottom:7px;"></td>
    </tr>
    <tr>
        <td></td>
    <td><input type='submit' value='<?php echo xla('Save'); ?>' class='button-css' />&nbsp;
    <input type='button' value='<?php echo xla('Print'); ?>' id='printbutton' class='button-css' />&nbsp;
    <input type='button' class='button-css' value='<?php echo xla('Cancel'); ?>'
 onclick="parent.closeTab(window.name, false)" /></td>
    </tr>
</table>
</form>
<?php
formFooter();
?>
