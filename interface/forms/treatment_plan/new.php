<?php

/**
 * treatment plan form.
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
require_once("$srcdir/options.inc.php");

use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Header;
use OpenEMR\Core\OEGlobalsBag;

formHeader("Form:Treatment Planning");
$returnurl = 'encounter_top.php';
$formid = (int) ($_GET['id'] ?? 0);
$obj = $formid ? formFetch("form_treatment_plan", $formid) : [];

$session = SessionWrapperFactory::getInstance()->getActiveSession();

// Get the providers list.
 $ures = sqlStatement("SELECT id, username, fname, lname FROM users WHERE " .
  "authorized != 0 AND active = 1 ORDER BY lname, fname");
    ?>
<html><head>

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
  html.oe-workbench-context body.oe-treatment-plan-editor {
    box-sizing: border-box;
    width: min(100% - 2rem, 860px);
    min-height: 100vh;
    margin-block: 1.5rem;
    margin-inline: auto;
    padding-block: 2rem;
    padding-inline: 36px;
    border: 1px solid #cbd6da;
    border-radius: 7px;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context {
    background-color: #edf2f3;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor > p {
    margin-block: 0 1.5rem;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor .forms-title {
    color: #182c36 !important;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form,
  html.oe-workbench-context body.oe-treatment-plan-editor form > table {
    width: 100%;
    max-width: none;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table {
    border-collapse: collapse;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(-n + 3) {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr) 120px minmax(0, 1fr);
    gap: 0.5rem 0.75rem;
    align-items: center;
    margin-block: 0 0.75rem;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(-n + 3) > td {
    box-sizing: border-box;
    min-width: 0;
    width: auto;
    padding: 0;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(4),
  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(12),
  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(13) {
    display: none;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:last-child {
    display: block;
    margin-block: 0.5rem 0;
    padding-block: 1rem 0;
    border-top: 1px solid #cbd6da;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:last-child > td:last-child {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(n + 5):nth-child(-n + 11) {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
    margin-block: 0 1.5rem;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(n + 5):nth-child(-n + 11) > td {
    display: block;
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
    padding: 0;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(n + 5):nth-child(-n + 11) > td:first-child {
    color: #182c36 !important;
    font-weight: 600;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form textarea {
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

  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='text'],
  html.oe-workbench-context body.oe-treatment-plan-editor form select {
    box-sizing: border-box;
    max-width: 100%;
    min-height: 2.5rem;
    padding-block: 0.35rem;
    padding-inline: 0.5rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form select[name='provider'] {
    width: 100% !important;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='submit'],
  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='button'] {
    min-height: 2.5rem;
    padding-block: 0.5rem;
    padding-inline: 1rem;
    border: 1px solid #536773 !important;
    border-radius: 4px;
    background-color: #fff !important;
    color: #182c36 !important;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='submit'] {
    border-color: #145968 !important;
    background-color: #145968 !important;
    color: #fff !important;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='submit']:hover,
  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='submit']:focus,
  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='submit']:active {
    border-color: #0d414d !important;
    background-color: #0d414d !important;
    color: #fff !important;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='button']:hover,
  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='button']:focus,
  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='button']:active {
    border-color: #182c36 !important;
    background-color: #e4f0f1 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='submit']:disabled {
    border-color: #536773 !important;
    background-color: #536773 !important;
    color: #fff !important;
    opacity: 1;
    cursor: default;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form input[type='button']:disabled {
    border-color: #536773 !important;
    background-color: #fff !important;
    color: #536773 !important;
    opacity: 1;
    cursor: default;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form textarea:focus-visible,
  html.oe-workbench-context body.oe-treatment-plan-editor form input:focus-visible,
  html.oe-workbench-context body.oe-treatment-plan-editor form select:focus-visible {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }
}

@media screen and (width <= 600px) {
  html.oe-workbench-context body.oe-treatment-plan-editor {
    width: calc(100% - 1rem);
    margin-block: 0.5rem;
    padding-inline: 1rem;
  }

  html.oe-workbench-context body.oe-treatment-plan-editor form > table > tbody > tr:nth-child(-n + 3) {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
</head>
<body class="body_top oe-treatment-plan-editor">
<p><span class="forms-title"><?php echo xlt('Treatment Planning'); ?></span></p>
<br />
<?php
echo "<form method='post' name='my_form' " .
  "action='$rootdir/forms/treatment_plan/save.php?id=" . attr_url($formid) . "'>\n";
?>
<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />
<table  border="0">

<tr>
<td align="left" class="forms" class="forms"><?php echo xlt('Client Name'); ?>:</td>
        <td class="forms">
            <label class="forms-data"> <?php if (is_numeric($pid)) {
                $result = getPatientData($pid, "fname,lname,squad");
                echo text($result['fname']) . " " . text($result['lname']);
                                       }

                                       $patient_name = ($result['fname']) . " " . ($result['lname']);
                                        ?>
   </label>
   <input type="hidden" name="client_name" value="<?php echo attr($patient_name);?>">
        </td>
        <td align="left"  class="forms"><?php echo xlt('DOB'); ?>:</td>
        <td class="forms">
        <label class="forms-data"> <?php if (is_numeric($pid)) {
            $result = getPatientData($pid, "*");
            echo text($result['DOB']);
                                   }

                                   $dob = ($result['DOB']);
                                    ?>
   </label>
     <input type="hidden" name="DOB" value="<?php echo attr($dob);?>">
        </td>
        </tr>
    <tr>
      <td align="left"  class="forms"><?php echo xlt('Client Number'); ?>:</td>
        <td class="forms">
            <label class="forms-data" > <?php if (is_numeric($pid)) {
                $result = getPatientData($pid, "*");
                echo text($result['pid']);
                                        }

                                        $patient_id = $result['pid'];
                                        ?>
   </label>
    <input type="hidden" name="client_number" value="<?php echo attr($patient_id);?>">
        </td>


        <td align="left" class="forms"><?php echo xlt('Admit Date'); ?>:</td>
        <td class="forms">
               <input type='text' size='10' class='datepicker' name='admit_date' id='admission_date' <?php echo attr($disabled) ?>;
               value='<?php echo attr($obj["admit_date"]); ?>'
               title='<?php echo xla('yyyy-mm-dd Date of service'); ?>' />
        </td>

        </tr>
        <tr>
        <td align="left" class="forms"><?php echo xlt('Provider'); ?>:</td>
         <td class="forms" width="280px">
    <?php

    echo "<select name='provider' style='width:60%' />";
    while ($urow = sqlFetchArray($ures)) {
        echo "    <option value='" . attr($urow['lname']) . "'";
        if ($urow['lname'] == attr($obj["provider"])) {
            echo " selected";
        }

        echo ">" . text($urow['lname']);
        if ($urow['fname']) {
            echo ", " . text($urow['fname']);
        }

        echo "</option>\n";
    }

    echo "</select>";
    ?>
        </td>

        </tr>

    <tr>

  <td colspan='3' nowrap style='font-size:8pt'>
   &nbsp;
    </td>
    </tr>

    <tr>
        <td align="left" class="forms"><?php echo xlt('Presenting Issue(s)'); ?>:</td>
        <td colspan="3"><textarea name="presenting_issues" rows="2" cols="60" wrap="virtual name"><?php echo text($obj["presenting_issues"]);?></textarea></td>

    </tr>
    <tr>
        <td align="left" class="forms"><?php echo xlt('Patient History'); ?>:</td>
        <td colspan="3"><textarea name="patient_history" rows="2" cols="60" wrap="virtual name"><?php echo text($obj["patient_history"]);?></textarea></td>

    </tr>
    <tr>

        <td align="left" class="forms"><?php echo xlt('Medications'); ?>:</td>
        <td colspan="3"><textarea name="medications" rows="2" cols="60" wrap="virtual name"><?php echo text($obj["medications"]);?></textarea></td>


    </tr>
    <tr>
        <td align="left" class="forms"><?php echo xlt('Anyother Relevant Information'); ?>:</td>
        <td colspan="3"><textarea name="anyother_relevant_information" rows="2" cols="60" wrap="virtual name"><?php echo text($obj["anyother_relevant_information"]);?></textarea></td>

    </tr>
    <tr>
        <td align="left" class="forms"><?php echo xlt('Diagnosis'); ?>:</td>
        <td colspan="3"><textarea name="diagnosis" rows="2" cols="60" wrap="virtual name"><?php echo text($obj["diagnosis"]);?></textarea></td>

    </tr>
    <tr>
        <td align="left" class="forms"><?php echo xlt('Treatment Received'); ?>:</td>
        <td colspan="3"><textarea name="treatment_received" rows="2" cols="60" wrap="virtual name"><?php echo text($obj["treatment_received"]);?></textarea></td>

    </tr>
    <tr>
        <td align="left" class="forms"><?php echo xlt('Recommendation For Follow Up'); ?>:</td>
        <td colspan="3"><textarea name="recommendation_for_follow_up" rows="2" cols="60" wrap="virtual name"><?php echo text($obj["recommendation_for_follow_up"]);?></textarea></td>

    </tr>
    <tr>
        <td align="left colspan="3" style="padding-bottom:7px;"></td>
    </tr>
    <tr>
        <td align="left colspan="3" style="padding-bottom:7px;"></td>
    </tr>
    <tr>
        <td></td>
    <td><input type='submit'  value='<?php echo xla('Save');?>' class="button-css">&nbsp;
  <input type='button' value='<?php echo xla('Print'); ?>' id='printbutton' />&nbsp;

    <input type='button' class="button-css" value='<?php echo xla('Cancel');?>'
 onclick="parent.closeTab(window.name, false)" /></td>
    </tr>
</table>
</form>
<?php
formFooter();
?>
