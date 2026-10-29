<?php

/**
 * interface/forms/group_attendance/new.php
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Shachar Zilbershlag <shaharzi@matrix.co.il>
 * @author    Amiel Elboim <amielel@matrix.co.il>
 * @author    Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2016 Shachar Zilbershlag <shaharzi@matrix.co.il>
 * @copyright Copyright (c) 2016 Amiel Elboim <amielel@matrix.co.il>
 * @copyright Copyright (c) 2019 Brady Miller <brady.g.miller@gmail.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once(__DIR__ . "/../../globals.php");
require_once("functions.php");
require_once(__DIR__ . "/../../../library/group.inc.php");

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Session\EncounterSessionUtil;
use OpenEMR\Common\Session\PatientSessionUtil;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Header;
use OpenEMR\Core\OEGlobalsBag;

// Hoist legacy `globals.php` locals so PHPStan can see them (#11792 Phase 5).
$rootdir = OEGlobalsBag::getInstance()->getString('rootdir');
$encounter = EncounterSessionUtil::getEncounter();
$therapy_group = (PatientSessionUtil::getPid() === 0)
    ? (SessionWrapperFactory::getInstance()->getActiveSession()->get('therapy_group') ?? 0)
    : 0;

//Check acl
$can_view = AclMain::aclCheckCore("groups", "gadd", false, 'view');
$can_edit = AclMain::aclCheckCore("groups", "gadd", false, 'write');

if (!$can_view && !$can_edit) {
    formJump();
}

$statuses_in_meeting = getGroupAttendanceStatuses();

$returnurl = 'encounter_top.php';

//If editing form, get participants from therapy_groups_participant_attendance table. Otherwise get from therapy_groups_participants table.
if (isset($_GET['id'])) {//clicked edit form
    $form_id = $_GET['id'];
} else {//In case didn't click 'edit' but an attendance form already exists (can't have 2 attendance forms for same encounter)
    $result = get_form_id_of_existing_attendance_form($encounter, $therapy_group);
    $form_id = $result['form_id'];
}


if ($form_id) {//If editing a form or the form already exists (inwhich case will automatically go into edit mode for existing form)
    $participants = getGroupAttendance($form_id);
} else {//new form
    $participants = getParticipants($therapy_group, true);
}

?>
<html>

<head>

    <?php Header::setupHeader(['datatables', 'datatables-dt', 'datatables-bs']); ?>

    <style>
    @media screen {
      html.oe-workbench-context body.group-attendance-document-editor {
        box-sizing: border-box;
        margin: 0;
        padding: clamp(0.5rem, 2vw, 1.5rem);
        background-color: #e8eff0 !important;
        color: #182c36 !important;
      }

      html.oe-workbench-context body.group-attendance-document-editor > .container-fluid {
        box-sizing: border-box;
        width: 100%;
        max-width: 1000px;
        margin-inline: auto;
        padding: 0;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form {
        box-sizing: border-box;
        min-width: 0;
        width: 100%;
        padding: clamp(0.75rem, 2.5vw, 2rem);
        border: 1px solid #c7d5d9;
        background-color: #fff !important;
        color: #182c36 !important;
        line-height: 1.5;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .button_wrap {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-block-end: 1.25rem;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .title {
        color: #183b49 !important;
        font-size: clamp(1.35rem, 3vw, 1.8rem);
        font-weight: 600;
        line-height: 1.3;
        overflow-wrap: anywhere;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form #add_participant_element {
        box-sizing: border-box;
        max-width: 100%;
        margin-block: 0 1.25rem;
        padding: clamp(0.75rem, 2vw, 1.25rem);
        border: 1px solid #c7d5d9;
        background-color: #f3f7f5 !important;
        color: #182c36 !important;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .patient_wrap,
      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .comment_wrap {
        box-sizing: border-box;
        min-width: 0;
        width: 100%;
        margin-block-end: 0.75rem;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .input_label {
        display: block;
        margin-block-end: 0.25rem;
        color: #182c36 !important;
        font-weight: 600;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .new_patient,
      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .new_comment {
        box-sizing: border-box;
        width: 100%;
        min-height: 2.75rem;
        color: #182c36 !important;
        background-color: #fff !important;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .btn-group {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        max-width: 100%;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form #group_attendance_form_table_wrapper {
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        overflow: auto visible;
        margin-block: 0 1.25rem;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form #group_attendance_form_table_wrapper .dataTables_length,
      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form #group_attendance_form_table_wrapper .dataTables_info,
      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form #group_attendance_form_table_wrapper .dataTables_paginate {
        max-width: 100%;
        float: none;
        margin-block: 0.5rem;
        white-space: normal;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form #group_attendance_form_table_wrapper .dataTables_paginate .paginate_button {
        display: inline-block;
        min-width: 2.5rem;
        min-height: 2.5rem;
        margin: 0.125rem;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form #group_attendance_form_table {
        width: 100% !important;
        min-width: 760px;
        border-collapse: collapse;
        color: #182c36 !important;
        background-color: #fff !important;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form #group_attendance_form_table th,
      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form #group_attendance_form_table td {
        box-sizing: border-box;
        padding: 0.6rem;
        color: #182c36 !important;
        background-color: #fff !important;
        vertical-align: middle;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form #group_attendance_form_table th {
        background-color: #e8eff0 !important;
        font-weight: 600;
        white-space: normal;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form #group_attendance_form_table .status_select {
        min-width: 11rem;
        min-height: 2.75rem;
        color: #182c36 !important;
        background-color: #fff !important;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form #group_attendance_form_table .comment {
        min-width: 12rem;
        min-height: 2.75rem;
        color: #182c36 !important;
        background-color: #fff !important;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .action_buttons {
        margin-block: 0.5rem 0;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .btn {
        box-sizing: border-box;
        min-width: 7rem;
        max-width: 100%;
        min-height: 2.75rem;
        padding: 0.55rem 0.85rem;
        white-space: normal;
        transition-duration: 0s;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .btn:focus-visible,
      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .form-control:focus-visible,
      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form #group_attendance_form_table_wrapper .paginate_button:focus-visible {
        outline: 3px solid #a84c22;
        outline-offset: 2px;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .btn-primary {
        border-color: #145968 !important;
        background-color: #145968 !important;
        color: #fff !important;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .btn-primary:hover,
      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .btn-primary:focus,
      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .btn-primary:active {
        border-color: #104e5b !important;
        background-color: #104e5b !important;
        color: #fff !important;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .btn-secondary {
        border-color: #91a8b1 !important;
        background-color: #fff !important;
        color: #182c36 !important;
      }

      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .btn-secondary:hover,
      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .btn-secondary:focus,
      html.oe-workbench-context body.group-attendance-document-editor #group_attendance_form .btn-secondary:active {
        border-color: #145968 !important;
        background-color: #e4f0f1 !important;
        color: #182c36 !important;
      }
    }
    </style>
</head>

<body class="body_top group-attendance-document-editor">
<div class="container-fluid">
<?php if ($form_id) { ?>
<form id="group_attendance_form" method='post' onclick="top.restoreSession();" action="<?php echo $rootdir;?>/forms/group_attendance/save.php?mode=update&id=<?php echo attr_url($form_id) ;?>" name="my_form">
<?php } else { ?>
<form id="group_attendance_form" method='post' onclick="top.restoreSession();" action="<?php echo $rootdir;?>/forms/group_attendance/save.php?mode=new" name="my_form">
<?php } ?>
    <div id="add_participant">
        <div class="button_wrap">
            <span class='title'><?php echo xlt('Group Attendance Form'); ?></span>
            <input class="btn btn-primary add_button" type="button" value="<?php echo xla('Add'); ?>" <?php if (!$can_edit) {
                ?> disabled <?php } ?> />
        </div>
        <div id="add_participant_element"  style="display: none;">
            <div class="patient_wrap">
                <span class="input_label"><?php echo xlt("Participant's name");?></span>
                <input name="new_id" class="new_patient_id" type="hidden" value="" />
                <input name="new_patient" class="form-control new_patient" type="text" value=""  readonly />
                <div class="error_wrap">
                    <span class="error"></span>
                </div>
            </div>
            <div class="comment_wrap">
                <span class="input_label"><?php echo xlt("Comment");?></span>
                <input name="new_comment" class="form-control new_comment" type="text" value="" />
            </div>
            <div class="btn-group">
                <input class="btn btn-primary add_patient_button" type="button" value="<?php echo xla('Add Patient'); ?>" />
                <input class="btn btn-secondary cancel_button" type="button" value="<?php echo xla('Cancel'); ?>" />
            </div>
        </div>
    </div>
    <table id="group_attendance_form_table">
        <thead>
        <tr class="text-center">
            <th><?php echo xlt("Participant's name"); ?></th>
            <th><?php echo xlt("Patient's number"); ?></th>
            <th><?php echo xlt('Status in the meeting'); ?></th>
            <th><?php echo xlt('Comment'); ?></th>
        </tr>
        </thead>
        <tbody>
        <?php foreach ($participants as $participant) {?>
            <tr>
                <td ><?php echo text($participant['fname'] . ", " . $participant['lname']); ?></td>
                <td ><?php echo text($participant['pid']); ?></td>
                <td >
                    <select class="form-control status_select" name="<?php echo "patientData[" . attr($participant['pid']) . "][status]" ;?>" <?php if (!$can_edit) {
                        ?> disabled <?php
                                                                     } ?> >
                        <?php foreach ($statuses_in_meeting as $status_in_meeting) {?>
                            <option value="<?php echo attr($status_in_meeting['option_id']); ?>" <?php if ($participant['meeting_patient_status'] == $status_in_meeting['option_id']) {
                                echo 'selected';
                                           }?> > <?php echo xlt($status_in_meeting['title']); ?></option>
                        <?php } ?>
                    </select>
                </td>
                <td >
                    <input class="form-control comment" type="text" name="<?php echo "patientData[" . attr($participant['pid']) . "][comment]";  ?>" value="<?php echo attr($participant['meeting_patient_comment']) ;?>" <?php if (!$can_edit) {
                        ?> disabled <?php } ?> ></input>
                </td>
            </tr>
        <?php } ?>
        </tbody>
    </table>
    <div class="btn-group action_buttons">
        <input name="submit" class="btn btn-primary" type="submit" value="<?php echo xla('Save'); ?>" <?php if (!$can_edit) {
            ?> disabled <?php
                                                                          } ?> >
        <input class="btn btn-secondary cancel" type="button" value="<?php echo xla('Cancel'); ?>" />
    </div>
</form>
<script>
    $(function () {

        /* Initialise Datatable */
        var table = $('#group_attendance_form_table').DataTable({
            initComplete: function () {
                $('#group_attendance_form_table_filter').hide(); //hide searchbar
            },
            <?php // Bring in the translations ?>
            <?php require(OEGlobalsBag::getInstance()->getSrcDir() . '/js/xl/datatables-net.js.php'); ?>
        });

        /* 'Add Participant' elements */
        $('.add_button').on('click', function () {
            $('#add_participant_element').show();
            $(this).hide();
        });

        $('.new_patient').on('click', function(){
            top.restoreSession();
            $('.new_patient').css("border-color", "var(--body-color)");
            $('.error_wrap .error').html("");
            var url = '<?php echo OEGlobalsBag::getInstance()->getWebRoot()?>/interface/main/calendar/find_patient_popup.php';
            dlgopen(url, '_blank', 500, 400);
        });

        $('.cancel_button').on('click', function () {
            $('#add_participant_element').hide();
            $('.add_button').show();

            $('.new_patient_id').val('');
            $('.new_patient').val('');
            $('.new_comment').val('');
        });

        $('.add_patient_button').on('click', function(e){
            var name = $('.new_patient').val();

            if(name == ""){
                //If no patient was chosen (validation)
                $('.new_patient').css("border-color", "var(--danger)");
                var err_msg = <?php echo xlj("Choose Patient"); ?>;
                $('.error_wrap .error').html(err_msg);
            }
            else{

                // Get new participant details
                var new_patient_id = $('.new_patient_id').val();
                var new_patient_name = $('.new_patient').val();
                var new_patient_comment = $('.new_comment').val();

                //Check if patient already exists in form
                var ids_array = [];
                $('#group_attendance_form_table tbody tr td:nth-child(2)').each(function(){
                    ids_array.push($(this).text());
                });
                var exists = $.inArray(new_patient_id, ids_array);
                if(exists >= 0){
                    $('.new_patient').css("border-color", "var(--danger)");
                    var err_msg = <?php echo xlj("Patient already in form"); ?>;
                    $('.error_wrap .error').html(err_msg);
                    return;
                }

                //Get statuses from list into json and create select element
                var statuses = <?php echo json_encode($statuses_in_meeting); ?>;
                var select_element = $("<select class=\"form-control status_select\" name=\"\" />");
                $.each(statuses, function(key, value) {
                    $("<option />", {value: value.option_id, text: value.title}).appendTo(select_element);
                });
                var attended_sign = '@';
                select_element.attr('name', 'patientData[' + new_patient_id + '][status]');
                select_element.find("option[value='" + attended_sign +"']").attr('selected', 'selected');

                //Create comment element
                var comment_element = $("<input class=\"form-control comment\" type=\"text\" name=\"\" value=\"\">");
                comment_element.attr('name', 'patientData[' + new_patient_id + '][comment]');
                comment_element.attr('value', new_patient_comment);

                //Convert html object into string for insertion into datatable
                var select_html_string =  select_element.prop('outerHTML');
                var comment_html_string = comment_element.prop('outerHTML');
                if(select_html_string == undefined){ //firefox support
                    select_html_string = new XMLSerializer().serializeToString(select_element[0]);
                    comment_html_string = new XMLSerializer().serializeToString(comment_element[0]);
                }

                //Insert new row into datatable
                $('#group_attendance_form_table').dataTable().fnAddData([
                    new_patient_name,
                    new_patient_id,
                    select_html_string,
                    comment_html_string
                ]);

                //Empty values from inputs
                $('.new_patient').val("");
                $('.new_comment').val("");

            }
        });


        /* Form elements */
        $('.cancel').on('click', function () {
            top.restoreSession();
            parent.closeTab(window.name, false);
        });



    });

    /* For patient popup search */
    function setpatient(pid, lname, fname, dob){
        $('.new_patient_id').val(pid);
        $('.new_patient').val(fname + " " + lname);
    }


</script>
</div>
<?php
formFooter();
?>
