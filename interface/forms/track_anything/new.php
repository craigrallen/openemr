<?php

/**
 * Encounter form to track any clinical parameter.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Joe Slam <trackanything@produnis.de>
 * @author    Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2014 Joe Slam <trackanything@produnis.de>
 * @copyright Copyright (c) 2017 Brady Miller <brady.g.miller@gmail.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once(__DIR__ . "/../../globals.php");

use OpenEMR\Common\Forms\EncounterFormAccess;
use OpenEMR\Common\Forms\FormActionBarSettings;
use OpenEMR\Common\Session\EncounterSessionUtil;
use OpenEMR\Common\Session\PatientSessionUtil;
use OpenEMR\Core\Header;
use OpenEMR\Core\OEGlobalsBag;

// Hoist legacy `globals.php` locals so PHPStan can see them (#11792 Phase 5).
$srcdir = OEGlobalsBag::getInstance()->getSrcDir();
$rootdir = OEGlobalsBag::getInstance()->getString('rootdir');
$web_root = OEGlobalsBag::getInstance()->getWebRoot();
$pid = PatientSessionUtil::getPid();
$encounter = EncounterSessionUtil::getEncounter();
$userauthorized = PatientSessionUtil::getUserAuthorized();

formHeader("Form: Track anything");

// check if we are inside an encounter
if (! $encounter) { // comes from globals.php
    die("Internal error: we do not seem to be in an encounter!");
}

// get vars posted by FORMs
if (empty($formid)) {
    $formid = $_GET['id'] ?? null;
    if (!$formid) {
        $formid = $_POST['formid'] ?? null;
    }
}

EncounterFormAccess::assertFormBelongsToSessionPatient(is_numeric($formid) ? (int) $formid : 0, 'track_anything');

$myprocedureid =  $_POST['procedure2track'] ?? null;

echo "<html><head>";
?>
<?php Header::setupHeader(['datetime-picker', 'track-anything']); ?>

    <style>
    @media screen {
      html.oe-workbench-context body.track-anything-document-editor {
        box-sizing: border-box;
        margin: 0;
        padding: clamp(0.75rem, 2vw, 1.5rem);
        background-color: #e8eff0 !important;
        color: #182c36 !important;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything {
        box-sizing: border-box;
        width: 100%;
        max-width: 1000px;
        margin-inline: auto;
        padding: clamp(1rem, 2.5vw, 2rem);
        overflow-x: auto;
        border: 1px solid #c7d5d9;
        background-color: #fff;
        color: #182c36;
        line-height: 1.5;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything table {
        width: 100%;
        min-width: 36rem;
        border-collapse: collapse;
        background-color: #fff;
        color: #182c36;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything table[border='1'] {
        min-width: 48rem;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything > table {
        min-width: 0;
        table-layout: fixed;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything > table th,
      html.oe-workbench-context body.track-anything-document-editor #track_anything > table td {
        min-width: 0;
        white-space: normal;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything > form {
        width: max-content;
        min-width: 100%;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything table th,
      html.oe-workbench-context body.track-anything-document-editor #track_anything table td {
        padding: 0.65rem 0.8rem;
        border-bottom: 1px solid #d9e4e2;
        vertical-align: middle;
        text-align: left;
        white-space: nowrap;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything table th {
        background-color: #f3f7f5;
        color: #183b49;
        font-weight: 600;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything table th.time,
      html.oe-workbench-context body.track-anything-document-editor #track_anything table td:first-child {
        min-width: 12rem;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything table th.value,
      html.oe-workbench-context body.track-anything-document-editor #track_anything table td:not(:first-child) {
        min-width: 12rem;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything input[type='text'],
      html.oe-workbench-context body.track-anything-document-editor #track_anything select[name='procedure2track'] {
        box-sizing: border-box;
        min-width: 11rem;
        min-height: 2.65rem;
        padding: 0.45rem 0.6rem;
        border: 1px solid #91a8b1;
        border-radius: 3px;
        background-color: #fff !important;
        color: #182c36 !important;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything input.datetimepicker {
        min-width: 13rem;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything select[name='procedure2track'] {
        width: min(100%, 20rem) !important;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything > table select {
        min-width: 0;
        max-width: 100%;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything input[type='text']::placeholder {
        color: #526a70;
        opacity: 1;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything input[type='submit'],
      html.oe-workbench-context body.track-anything-document-editor #track_anything input[type='button'] {
        box-sizing: border-box;
        min-width: 7rem;
        min-height: 2.75rem;
        margin: 0.35rem 0.4rem 0.35rem 0;
        padding: 0.55rem 0.85rem;
        border: 1px solid #91a8b1;
        border-radius: 3px;
        background-color: #fff !important;
        color: #182c36 !important;
        font-weight: 600;
        cursor: pointer;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything input[type='submit']:hover,
      html.oe-workbench-context body.track-anything-document-editor #track_anything input[type='button']:hover {
        border-color: #145968;
        background-color: #e4f0f1 !important;
        color: #182c36 !important;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything input[type='submit']:focus,
      html.oe-workbench-context body.track-anything-document-editor #track_anything input[type='button']:focus {
        border-color: #145968;
        background-color: #e4f0f1 !important;
        color: #182c36 !important;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything input[type='text']:focus,
      html.oe-workbench-context body.track-anything-document-editor #track_anything select[name='procedure2track']:focus,
      html.oe-workbench-context body.track-anything-document-editor #track_anything input[type='submit']:focus,
      html.oe-workbench-context body.track-anything-document-editor #track_anything input[type='button']:focus {
        outline: 2px solid #a84c22;
        outline-offset: 2px;
      }

      html.oe-workbench-context body.track-anything-document-editor #track_anything input[type='text']:focus-visible,
      html.oe-workbench-context body.track-anything-document-editor #track_anything select[name='procedure2track']:focus-visible,
      html.oe-workbench-context body.track-anything-document-editor #track_anything input[type='submit']:focus-visible,
      html.oe-workbench-context body.track-anything-document-editor #track_anything input[type='button']:focus-visible {
        outline: 3px solid #a84c22;
        outline-offset: 2px;
      }
    }
    </style>
<script>
$(function () {
    $('.datetimepicker').datetimepicker({
        <?php $datetimepicker_timepicker = true; ?>
        <?php $datetimepicker_showseconds = true; ?>
        <?php $datetimepicker_formatInput = false; ?>
        <?php require(OEGlobalsBag::getInstance()->getSrcDir() . '/js/xl/jquery-datetimepicker-2-5-4.js.php'); ?>
        <?php // can add any additional javascript settings to datetimepicker here; need to prepend first setting with a comma ?>
    });
});
</script>

<?php
echo "</head><body class='body_top track-anything-document-editor'>";
echo "<div id='track_anything'>";

// check if this Track is new
if (!$formid) {
    // this is a new Track

    // check if procedure is selected
    if ($_POST['bn_select'] ?? null) {
        // "save"-Button was clicked, saving Form into db

        // save inbto db
        if ($myprocedureid) {
            $query = "INSERT INTO form_track_anything (procedure_type_id) VALUES (?)";
            $formid = sqlInsert($query, $myprocedureid);
            $spell = "SELECT name FROM form_track_anything_type WHERE track_anything_type_id = ?";
            $myrow = sqlQuery($spell, [$myprocedureid]);
            $myprocedurename = $myrow["name"];
            $register_as = "Track: " . $myprocedurename;
            // adding Form
            addForm($encounter, $register_as, $formid, "track_anything", $pid, $userauthorized);
        } else {
                echo xlt('No track selected') . ".<br />";
            ?><input type='button' value='<?php echo xla('Back'); ?>' onclick="top.restoreSession();location='<?php echo FormActionBarSettings::EXIT_URL; ?>'" /><?php
        }
    } else {
    // procedure is not yet selected
        echo "<table>";
        echo "<tr>";
        echo "<th>" . xlt('Select Track') . ":</th>";
        echo "</tr><tr>";
        echo "<td>";
        echo "<form method='post' action='" . $rootdir . "/forms/track_anything/new.php' onsubmit='return top.restoreSession()'>";

        echo "<select name='procedure2track' size='10' style='width: 300px'>";
        $spell  = "SELECT * FROM form_track_anything_type ";
        $spell .= "WHERE parent = 0 AND active = 1 ";
        $spell .= "ORDER BY position ASC, name ASC ";
        $testi = sqlStatement($spell);
        while ($myrow = sqlFetchArray($testi)) {
            $myprocedureid = $myrow["track_anything_type_id"];
            $myprocedurename = $myrow["name"];
            echo "<option value='" . attr($myprocedureid) . "'>" . text($myprocedurename) . "</option>";
        }

        echo "</select>";
        echo "</td></tr><tr><td align='center'>";
        echo "<input type='submit' name='bn_select' value='" . xla('Select') . "' />";
        ?><input type='button' value='<?php echo  xla('Back'); ?>' onclick="top.restoreSession();location='<?php echo FormActionBarSettings::EXIT_URL; ?>'" /><?php
        echo "</form>";
        echo "<br />&nbsp;</td></tr>";

        echo "<tr><td align='center'>";
        echo "<input type='submit' name='create_track' value='" . xla('Configure tracks') . "' ";
?> onclick="top.restoreSession();location='<?php echo $web_root ?>/interface/forms/track_anything/create.php'"<?php
        echo " />";
        echo "</td></tr>";
        echo "</table>";
    }
}


// instead of "else", we check again for "formid"
if ($formid) {
    // this is an existing Track
    //----------------------------------------------------
    // get submitted item-Ids
    $mylist = $_POST['liste'] ?? null;
    #echo $mylist;
    $length = count($mylist ?? []);
    $thedate = $_POST['datetime'] ?? null;
    #echo $thedate;
    //check if whole input is NULL
    $all_are_null = 0;
    for ($i = 0; $i < $length; $i++) {
        #echo "beep";
        $thisid = $mylist[$i];
        $thisvalue = $_POST[$thisid];
        if ($thisvalue != null && $thisvalue != '') {
            $all_are_null++;
        }
    }

    // if all of the input is NULL, we do nothing
    // if at least one entry is NOT NULL, we save all into db
    if ($all_are_null > 0) {
        for ($i = 0; $i < $length; $i++) {
            $thisid = $mylist[$i];
            $thisvalue = $_POST[$thisid];

            // store data to track_anything_db
            $query = "INSERT INTO form_track_anything_results (track_anything_id, track_timestamp, itemid, result) VALUES (?, ?, ?, ?)";
            sqlStatement($query, [$formid,$thedate,$thisid,$thisvalue]);
        }
    }

    //----------------------------------------------------



    // update corrected old items
    // ---------------------------

    // getting old entries from <form>
    $old_id     = $_POST['old_id'] ?? null;
    $old_time   = $_POST['old_time'] ?? null;
    $old_value  = $_POST['old_value'] ?? null;

    $how_many = count($old_time ?? []);
    // do this for each data row
    for ($x = 0; $x <= $how_many; $x++) {
        // how many columns do we have
        $how_many_cols = count($old_value[$x] ?? []);
        for ($y = 0; $y < $how_many_cols; $y++) {
                // here goes the UPDATE sql-spruch
                $insertspell  = "UPDATE form_track_anything_results ";
                $insertspell .= "SET track_timestamp = ? , result = ? ";
                $insertspell .= "WHERE id = ? ";
                sqlStatement($insertspell, [$old_time[$x], $old_value[$x][$y], $old_id[$x][$y]]);
        }
    }

//--------------------------------------------------


    //get procedure ID
    if (!$myprocedureid) {
        $spell = "SELECT procedure_type_id FROM form_track_anything WHERE id = ?";
        $myrow = sqlQuery($spell, [$formid]);
        $myprocedureid = $myrow["procedure_type_id"];
    }

    echo "<br /><b>" . xlt('Enter new data') . "</b>:<br />";
    echo "<form method='post' action='" . $rootdir . "/forms/track_anything/new.php' onsubmit='return top.restoreSession()'>";
    echo "<table>";
    echo "<tr><th class='item'>" . xlt('Item') . "</th>";
    echo "<th class='value'>" . xlt('Value') . "</th></tr>";


    echo "<tr><td>" . xlt('Date Time') . "</td>";
    echo "<td><input type='text' size='16' name='datetime' id='datetime'" .
             "value='" . attr(date('Y-m-d H:i:s', time())) . "'" .
             "class='datetimepicker' /></td></tr>";
    ?>

    <?php
    // get items to track
    $liste = [];
    $spell = "SELECT * FROM form_track_anything_type WHERE parent = ? AND active = 1 ORDER BY position ASC, name ASC ";
    $query = sqlStatement($spell, [$myprocedureid]);
    while ($myrow = sqlFetchArray($query)) {
        echo "<input type='hidden' name='liste[]' value='" . attr($myrow['track_anything_type_id']) . "'>";
        echo "<tr><td> " . text($myrow['name']) . "</td>";
        echo "<td><input size='12' type='text' name='" . attr($myrow['track_anything_type_id'])  . "'></td></tr>";
    }

    echo "</table>";
    echo "<input type='hidden' name='formid' value='" . attr($formid) . "'>";
    echo "<input type='submit' name='bn_save' value='" . xla('Save') . "' />";
    ?><input type='button' value='<?php echo  xla('Stop'); ?>' onclick="top.restoreSession();location='<?php echo FormActionBarSettings::EXIT_URL; ?>'" /><?php


    // show old entries of track
    //-----------------------------------
    // get unique timestamps of track
    echo "<br /><br /><hr><br />";
    echo "<b>" . xlt('Edit your entered data') . ":</b><br />";
    $shownameflag = 0;  // flag if this is <table>-headline
    echo "<table border='1'>";

    $spell0 = "SELECT DISTINCT track_timestamp FROM form_track_anything_results WHERE track_anything_id = ? ORDER BY track_timestamp DESC";
    $query = sqlStatement($spell0, [$formid]);
    $main_counter = 0; // this counts 'number of rows'  of old entries
while ($myrow = sqlFetchArray($query)) {
    $thistime = $myrow['track_timestamp'];
    $shownameflag++;

    $spell  = "SELECT form_track_anything_results.id AS result_id, form_track_anything_results.itemid, form_track_anything_results.result, form_track_anything_type.name AS the_name ";
    $spell .= "FROM form_track_anything_results ";
    $spell .= "INNER JOIN form_track_anything_type ON form_track_anything_results.itemid = form_track_anything_type.track_anything_type_id ";
    $spell .= "WHERE track_anything_id = ? AND track_timestamp = ? AND form_track_anything_type.active = 1 ";
    $spell .= "ORDER BY form_track_anything_type.position ASC, the_name ASC ";
    $query2  = sqlStatement($spell, [$formid ,$thistime]);

    // <table> heading line
    if ($shownameflag == 1) {
        echo "<tr><th class='time'>" . xlt('Time') . "</th>";
        while ($myrow2 = sqlFetchArray($query2)) {
            echo "<th class='item'>" . text($myrow2['the_name']) . "</th>";
        }

        echo "</tr>";
    }

    echo "<tr><td bgcolor=#eeeeec>";
    $main_counter++; // next row
    echo "<input type='text' class='datetimepicker' size='16' name='old_time[" . attr($main_counter) . "]' value='" . attr($thistime) . "'></td>";
    $query2  = sqlStatement($spell, [$formid ,$thistime]);

    $counter = 0; // this counts columns
    while ($myrow2 = sqlFetchArray($query2)) {
        echo "<td>";
        echo "<input type='hidden' name='old_id[" . attr($main_counter) . "][" . attr($counter) . "]' value='" . attr($myrow2['result_id']) . "'>";
        echo "<input type='text' size='12' name='old_value[" . attr($main_counter) . "][" . attr($counter) . "]' value='" . attr($myrow2['result']) . "'></td>";
        $counter++; // next column
    }

    echo "</tr>";
}

    echo "</tr></table>";
    echo "<input type='hidden' name='formid' value='" . attr($formid) . "'>";
    echo "<input type='submit' name='bn_save' value='" . xla('Save') . "' />";
?><input type='button' value='<?php echo xla('Stop'); ?>' onclick="top.restoreSession();location='<?php echo FormActionBarSettings::EXIT_URL; ?>'" /><?php

    echo "</form>";
}//end if($formid)
echo "</div>";
formFooter();
?>
