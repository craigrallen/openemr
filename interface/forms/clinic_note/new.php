<?php

/**
 * clinic_note new.php
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Rod Roark <rod@sunsetsystems.com>
 * @author    Brady Miller <brady.g.miller@gmail.com>
 * @author    Daniel Ehrlich <daniel.ehrlich1@gmail.com>
 * @copyright Copyright (c) 2005 Rod Roark <rod@sunsetsystems.com>
 * @copyright Copyright (c) 2018-2021 Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2018 Daniel Ehrlich <daniel.ehrlich1@gmail.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once("../../globals.php");

use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Common\Session\EncounterSessionUtil;
use OpenEMR\Common\Session\PatientSessionUtil;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Header;
use OpenEMR\Core\OEGlobalsBag;

// Hoist legacy `globals.php` locals so PHPStan can see them (#11792 Phase 5).
$srcdir = OEGlobalsBag::getInstance()->getSrcDir();
$rootdir = OEGlobalsBag::getInstance()->getString('rootdir');
$pid = PatientSessionUtil::getPid();
$encounter = EncounterSessionUtil::getEncounter();
$userauthorized = PatientSessionUtil::getUserAuthorized();

$row = [];

if (! $encounter) { // comes from globals.php
    die("Internal error: we do not seem to be in an encounter!");
}

$formid = $_GET['id'] ?? null;

$session = SessionWrapperFactory::getInstance()->getActiveSession();
// If Save was clicked, save the info.
//
if (!empty($_POST['bn_save'])) {
    $fu_timing = $_POST['fu_timing'];
    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);

 // If updating an existing form...
 //
    if ($formid) {
        $query = "UPDATE form_clinic_note SET
         history = ?,
         examination = ?,
         plan = ?,
         followup_required = ?,
         followup_timing = ?
         WHERE id = ?";

        sqlStatement($query, [$_POST['form_history'], $_POST['form_examination'], $_POST['form_plan'], rbvalue('fu_required'), $fu_timing, $formid]);
    } else { // If adding a new form...
        $query = "INSERT INTO form_clinic_note ( " .
         "history, examination, plan, followup_required, followup_timing
         ) VALUES ( ?, ?, ?, ?, ? )";

        $newid = sqlInsert($query, [$_POST['form_history'], $_POST['form_examination'], $_POST['form_plan'], rbvalue('fu_required'), $fu_timing]);
        addForm($encounter, "Clinic Note", $newid, "clinic_note", $pid, $userauthorized);
    }

    formHeader("Redirecting....");
    formJump();
    formFooter();
    exit;
}

if ($formid) {
    $row = sqlQuery("SELECT * FROM form_clinic_note WHERE " .
    "id = ? AND activity = '1'", [$formid]);
}
?>
<html>
<head>
    <?php Header::setupHeader(); ?>
    <style>
@media screen {
  html.oe-workbench-context body.oe-clinic-note-editor {
    margin: 0;
    background-color: #edf2f3;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-form {
    box-sizing: border-box;
    width: min(100%, 860px);
    min-width: 0;
    margin-block: 1.5rem;
    margin-inline: auto;
    padding-block: 1.75rem;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-radius: 7px;
    background-color: #fff;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-form > center {
    display: block;
    text-align: start;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet {
    display: block;
    box-sizing: border-box;
    width: 100%;
    border: 0;
    border-collapse: separate;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody,
  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr,
  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr > td {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    border: 0;
    white-space: normal;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr {
    margin-block-end: 1.5rem;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:first-child > td {
    padding-block: 0 0.75rem;
    border-block-end: 1px solid #cbd6da;
    background-color: transparent;
    color: #182c36;
    font-size: 1.5rem;
    line-height: 1.3;
    text-align: start;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:first-child {
    background-color: transparent;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr > td:last-child {
    padding: 0;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:last-child table td {
    box-sizing: border-box;
    min-width: 0;
    padding-block: 0.35rem;
    border: 0;
    white-space: normal;
    vertical-align: middle;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:not(:first-child) > td:first-child {
    padding-block: 0 0.45rem;
    color: #182c36;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.4;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet textarea {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 7rem;
    padding-block: 0.65rem;
    padding-inline: 0.75rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff;
    color: #182c36;
    font: inherit;
    line-height: 1.7;
    overflow-wrap: break-word;
    resize: vertical;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:last-child table,
  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:last-child tbody,
  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:last-child tr {
    display: block;
    width: 100%;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:last-child table tr:first-child {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet > tbody > tr:last-child table tr:first-child td {
    width: auto;
    max-width: 100%;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-sheet input[name='fu_timing'] {
    box-sizing: border-box;
    width: min(100%, 12rem) !important;
    min-height: 2.5rem;
    padding-inline: 0.65rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    font: inherit;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-form > center > p:last-of-type {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-block: 1.5rem 0;
    padding-block-start: 1rem;
    border-block-start: 1px solid #cbd6da;
  }

  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-form input[name='bn_save'],
  html.oe-workbench-context body.oe-clinic-note-editor .oe-clinic-note-form input[type='button'] {
    min-height: 2.5rem;
    padding-block: 0.5rem;
    padding-inline: 1rem;
    font: inherit;
  }
}
</style>

</head>

<body class="oe-clinic-note-editor" bgcolor="#dddddd" topmargin="0" rightmargin="0" leftmargin="2"
 bottommargin="0" marginwidth="2" marginheight="0">
<form class="oe-clinic-note-form" method="post" action="<?php echo $rootdir ?>/forms/clinic_note/new.php?id=<?php echo attr_url($formid) ?>"
 onsubmit="return top.restoreSession()">
<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />

<center>

<p>
<table class='oe-clinic-note-sheet' border='1' width='95%'>

 <tr bgcolor='#dddddd'>
  <td colspan='2' align='center'><b><?php echo xlt("This Encounter"); ?></b></td>
 </tr>

 <tr>
  <td width='5%'  nowrap> <?php echo xlt("History"); ?> </td>
  <td width='95%' nowrap>
   <textarea name='form_history' rows='7' style='width:100%'><?php echo text($row['history'] ?? '') ?></textarea>
  </td>
 </tr>

 <tr>
  <td nowrap> <?php echo xlt("Examination"); ?> </td>
  <td nowrap>
   <textarea name='form_examination' rows='7' style='width:100%'><?php echo text($row['examination'] ?? '') ?></textarea>
  </td>
 </tr>

 <tr>
  <td nowrap> <?php echo xlt("Plan"); ?> </td>
  <td nowrap>
   <textarea name='form_plan' rows='7' style='width:100%'><?php echo text($row['plan'] ?? '') ?></textarea>
  </td>
 </tr>

 <tr>
  <td nowrap><?php echo xlt("Follow Up"); ?></td>
  <td nowrap>
   <table width='100%'>
    <tr>
     <td width='5%' nowrap>
        <?php echo rbinput('fu_required', '1', xl('Required in') . ':', 'followup_required') ?>
     </td>
     <td nowrap>
      <input type='text' name='fu_timing' size='10' style='width:100%'
       title='<?php echo xla("When to follow up"); ?>'
       value='<?php echo attr($row['followup_timing'] ?? '') ?>' />
     </td>
    </tr>
    <tr>
     <td colspan='2' nowrap>
        <?php echo rbinput('fu_required', '2', xl('Pending investigation'), 'followup_required') ?>
     </td>
    </tr>
    <tr>
     <td colspan='2' nowrap>
        <?php echo rbinput('fu_required', '0', xl('None required'), 'followup_required') ?>
     </td>
    </tr>
   </table>
  </td>
 </tr>

</table>

<p>
<input type='submit' name='bn_save' value='<?php echo xla("Save"); ?>' />
&nbsp;
<input type='button' value='<?php echo xla("Cancel"); ?>' onclick="parent.closeTab(window.name, false)" />
</p>

</center>

</form>
</body>
</html>
