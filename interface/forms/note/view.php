<?php

/*
 * Work/School Note Form view.php
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Nikolai Vitsyn
 * @author    Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2004-2005 Nikolai Vitsyn
 * @copyright Copyright (c) 2019 Brady Miller <brady.g.miller@gmail.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */



require_once(__DIR__ . "/../../globals.php");

use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Common\Forms\EncounterFormAccess;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Header;
use OpenEMR\Core\OEGlobalsBag;

// Hoist legacy `globals.php` locals so PHPStan can see them (#11792 Phase 5).
$srcdir = OEGlobalsBag::getInstance()->getSrcDir();
$rootdir = OEGlobalsBag::getInstance()->getString('rootdir');

$session = SessionWrapperFactory::getInstance()->getActiveSession();

formHeader("Form: note");
$returnurl = 'encounter_top.php';
$provider_results = sqlQuery("select fname, lname from users where username=?", [$session->get('authUser')]);

/* name of this form */
$form_name = "note";

$formIdInput = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
$formId = is_int($formIdInput) && $formIdInput >= 0 ? $formIdInput : 0;
EncounterFormAccess::assertFormBelongsToSessionPatient($formId, $form_name);

// get the record from the database
$obj = [];
if ($formId > 0) {
    $obj = formFetch("form_" . $form_name, $formId);
}

?>
<html><head>

<?php Header::setupHeader('datetime-picker'); ?>
<style>
@media screen {
  html.oe-workbench-context body.oe-work-school-note-editor {
    margin: 0;
    background-color: #edf2f3 !important;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .container,
  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form {
    box-sizing: border-box;
    width: 100%;
    max-width: 860px;
    margin-inline: auto;
    background-color: #fff;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .container {
    margin-block: 1.5rem;
    padding-block: 1.5rem;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-radius: 7px;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .container .row {
    box-sizing: border-box;
    width: 100%;
    margin-inline: 0;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .container .col-sm-12 {
    min-width: 0;
    padding-inline: 0;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .container .mt-5 {
    margin-block-start: 0 !important;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form {
    margin-block: 1.5rem;
    padding-block: 1.5rem;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-radius: 7px;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .container .oe-work-school-note-form {
    margin-block: 1rem 0;
    padding: 0;
    border: 0;
  }

  html.oe-workbench-context body.oe-work-school-note-editor h1,
  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > .title {
    display: block;
    margin-block: 0 0.75rem;
    color: #182c36;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > div[style] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    padding-block: 0.75rem;
    border-block-start: 1px solid #cbd6da;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > select,
  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > textarea {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding-block: 0.65rem;
    padding-inline: 0.75rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff;
    color: #182c36;
    font: inherit;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > textarea {
    min-height: 12rem;
    line-height: 1.7;
    overflow-wrap: break-word;
    resize: vertical;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > b {
    color: #182c36;
    line-height: 1.5;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > table {
    display: block;
    box-sizing: border-box;
    width: 100%;
    border-collapse: separate;
    background-color: #fff;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > table > tbody {
    display: block;
    width: 100%;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > table > tbody > tr {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    width: 100%;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > table > tbody > tr > td {
    display: block;
    box-sizing: border-box;
    flex: 1 1 16rem;
    min-width: 0;
    padding: 0;
    border: 0;
    background-color: #fff;
    color: #182c36;
    white-space: normal;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form > table input {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 2.5rem;
    padding-inline: 0.65rem;
    border: 1px solid #a9bbc3;
    border-radius: 4px;
    background-color: #fff;
    color: #182c36;
    font: inherit;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form select:focus,
  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form textarea:focus,
  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form input[type='text']:focus {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }

  html.oe-workbench-context body.oe-work-school-note-editor .oe-work-school-note-form input[type='button'] {
    min-height: 2.5rem;
    padding-block: 0.5rem;
    padding-inline: 1rem;
  }
}
</style>

<script>
// required for textbox date verification
var mypcc = <?php echo OEGlobalsBag::getInstance()->getInt('phone_country_code'); ?>;

$(function () {
            $('.datepicker').datetimepicker({
                <?php $datetimepicker_timepicker = false; ?>
                <?php $datetimepicker_showseconds = false; ?>
                <?php $datetimepicker_formatInput = true; ?>
                <?php require(OEGlobalsBag::getInstance()->getSrcDir() . '/js/xl/jquery-datetimepicker-2-5-4.js.php'); ?>
                <?php // can add any additional javascript settings to datetimepicker here; need to prepend first setting with a comma ?>
            });
        });

function PrintForm() {
    newwin = window.open(<?php echo js_escape($rootdir . "/forms/" . $form_name . "/print.php?id=" . urlencode((string) $formId)); ?>,"mywin");
}

</script>

</head>
<body class="body_top oe-work-school-note-editor">

<form class="oe-work-school-note-form" method=post action="<?php echo $rootdir . "/forms/" . $form_name . "/save.php?mode=update&id=" . attr_url((string) $formId);?>" name="my_form" id="my_form">
<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />

<span class="title"><?php echo xlt('Work/School Note'); ?></span><br /><br />

<div style="margin: 10px;">
<input type="button" class="save" value="    <?php echo xla('Save'); ?>    "> &nbsp;
<input type="button" class="dontsave" value="<?php echo xla('Don\'t Save'); ?>"> &nbsp;
<input type="button" class="printform" value="<?php echo xla('View Printable Version'); ?>"> &nbsp;
</div>

<select name="note_type">
<option value="WORK NOTE" <?php if ($obj['note_type'] == "WORK NOTE") {
    echo " SELECTED";
                          } ?>><?php echo xlt('WORK NOTE'); ?></option>
<option value="SCHOOL NOTE" <?php if ($obj['note_type'] == "SCHOOL NOTE") {
    echo " SELECTED";
                            } ?>><?php echo xlt('SCHOOL NOTE'); ?></option>
</select>
<br />
<b><?php echo xlt('MESSAGE:'); ?></b>
<br />
<textarea name="message" id="message" cols ="67" rows="4"><?php echo text($obj["message"]);?></textarea>
<br /> <br />

<table>
<tr><td>
<span class=text><?php echo xlt('Doctor:'); ?> </span><input type="text" name="doctor" value="<?php echo attr($obj["doctor"]);?>">
</td><td>
<span class="text"><?php echo xlt('Date'); ?></span>
   <input type='text' size='10' class='datepicker' name='date_of_signature' id='date_of_signature'
    value='<?php echo attr(oeFormatShortDate($obj['date_of_signature'])); ?>'
    title='<?php echo xla('Date of Signature'); ?>' />
</td></tr>
</table>

<div style="margin: 10px;">
<input type="button" class="save" value="    <?php echo xla('Save'); ?>    "> &nbsp;
<input type="button" class="dontsave" value="<?php echo xla('Don\'t Save'); ?>"> &nbsp;
<input type="button" class="printform" value="<?php echo xla('View Printable Version'); ?>"> &nbsp;
</div>

</form>

</body>

<script>

// jQuery stuff to make the page a little easier to use

$(function () {
    $(".save").click(function() { top.restoreSession(); $("#my_form").submit(); });
    $(".dontsave").click(function() { parent.closeTab(window.name, false); });
    $(".printform").click(function() { PrintForm(); });

    // disable the Print ability if the form has changed
    // this forces the user to save their changes prior to printing
    $("#img_date_of_signature").click(function() { $(".printform").attr("disabled","disabled"); });
    $("input").keydown(function() { $(".printform").attr("disabled","disabled"); });
    $("select").change(function() { $(".printform").attr("disabled","disabled"); });
    $("textarea").keydown(function() { $(".printform").attr("disabled","disabled"); });
});

</script>

</html>
