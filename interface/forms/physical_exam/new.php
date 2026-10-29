<?php

/**
 * physical_exam new.php
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Rod Roark <rod@sunsetsystems.com>
 * @author    Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2006-2010 Rod Roark <rod@sunsetsystems.com>
 * @copyright Copyright (c) 2019 Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2026 OpenCoreEMR Inc <https://opencoreemr.com/>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once(__DIR__ . "/../../globals.php");

use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Forms\EncounterFormAccess;
use OpenEMR\Common\Http\CurrentRequest;
use OpenEMR\Common\Session\EncounterSessionUtil;
use OpenEMR\Common\Session\PatientSessionUtil;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Header;
use OpenEMR\Core\OEGlobalsBag;
use OpenEMR\Services\FormService;
use function OpenEMR\Forms\PhysicalExam\physical_exam_lines;
use function OpenEMR\Forms\PhysicalExam\scalar_string;

// Hoist legacy `globals.php` locals so PHPStan can see them (#11792 Phase 5).
$srcdir = OEGlobalsBag::getInstance()->getSrcDir();
$rootdir = OEGlobalsBag::getInstance()->getString('rootdir');
$pid = PatientSessionUtil::getPid();
$encounter = EncounterSessionUtil::getEncounter();
$userauthorized = PatientSessionUtil::getUserAuthorized();

require_once(__DIR__ . "/lines.php");

if (!$encounter) {
    die("Internal error: we do not seem to be in an encounter!");
}

$returnurl = 'encounter_top.php';
$session = SessionWrapperFactory::getInstance()->getActiveSession();
$request = CurrentRequest::get();

// A stored checkbox value is "on" when it is non-empty and not '0'.
$isChecked = static fn (string $value): bool => $value !== '' && $value !== '0';

$showExamLine = function (string $line_id, string $description, array $linedbrow, string $sysnamedisp) use ($isChecked): string {
    $id = attr($line_id);
    $idJs = attr_js($line_id);
    $wnlChecked = $isChecked(scalar_string($linedbrow['wnl'] ?? null)) ? ' checked' : '';
    $abnChecked = $isChecked(scalar_string($linedbrow['abn'] ?? null)) ? ' checked' : '';
    $systemCell = text($sysnamedisp);
    $descriptionCell = text($description);
    $commentsValue = attr(scalar_string($linedbrow['comments'] ?? null));

    // Build the diagnosis <option> list, marking the persisted value selected.
    $persisted = scalar_string($linedbrow['diagnosis'] ?? null);
    $matched = false;
    $options = "<option value=''></option>";
    foreach (QueryUtils::fetchRecords('SELECT * FROM form_physical_exam_diagnoses WHERE line_id = ? ORDER BY ordering, diagnosis', [$line_id]) as $drow) {
        $diagnosis = scalar_string($drow['diagnosis'] ?? null);
        $selected = '';
        if (!$matched && $persisted !== '' && $diagnosis === $persisted) {
            $selected = ' selected';
            $matched = true;
        }
        $value = attr($diagnosis);
        $label = text($diagnosis);
        $options .= "<option value='{$value}'{$selected}>{$label}</option>";
    }

    // A persisted diagnosis no longer in the standard list is shown in parentheses.
    if (!$matched && $persisted !== '') {
        $value = attr($persisted);
        $label = text($persisted);
        $options .= "<option value='{$value}' selected>({$label})</option>";
    }
    $options .= "<option value='*'>-- Edit --</option>";

    return <<<HTML
        <tr>
            <td align='center'><input type='checkbox' name='form_obs[{$id}][wnl]' value='1'{$wnlChecked} /></td>
            <td align='center'><input type='checkbox' name='form_obs[{$id}][abn]' value='1'{$abnChecked} /></td>
            <td nowrap>{$systemCell}</td>
            <td nowrap>{$descriptionCell}</td>
            <td><select name='form_obs[{$id}][diagnosis]' onchange='seldiag(this, {$idJs})' style='width:100%'>{$options}</select></td>
            <td><input type='text' name='form_obs[{$id}][comments]' size='20' maxlength='250' style='width:100%' value='{$commentsValue}' /></td>
        </tr>
        HTML;
};

$showTreatmentLine = function (string $line_id, string $description, array $linedbrow) use ($isChecked): string {
    $id = attr($line_id);
    $wnlChecked = $isChecked(scalar_string($linedbrow['wnl'] ?? null)) ? ' checked' : '';
    $descriptionCell = text($description);
    $commentsValue = attr(scalar_string($linedbrow['comments'] ?? null));

    return <<<HTML
        <tr>
            <td align='center'><input type='checkbox' name='form_obs[{$id}][wnl]' value='1'{$wnlChecked} /></td>
            <td></td>
            <td colspan='2' nowrap>{$descriptionCell}</td>
            <td colspan='2'><input type='text' name='form_obs[{$id}][comments]' size='20' maxlength='250' style='width:100%' value='{$commentsValue}' /></td>
        </tr>
        HTML;
};

$formid = $request->query->getString('id');
EncounterFormAccess::assertFormBelongsToSessionPatient((int) $formid, 'physical_exam');

// If Save was clicked, save the info.
//
if ($request->request->getString('bn_save') !== '') {
 // We are to update/insert multiple table rows for the form.
 // Each has 2 checkboxes, a dropdown and a text input field.
 // Skip rows that have no entries.
 // There are also 3 special rows with just one checkbox and a text
 // input field.  Maybe also a diagnosis line, not clear.
    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);

    // Delete-and-reinsert must be atomic so a mid-loop failure can't leave the
    // form's rows partially updated.
    QueryUtils::inTransaction(function () use (&$formid, $request, $encounter, $pid, $userauthorized, $isChecked): void {
        if ($formid !== '') {
            QueryUtils::sqlStatementThrowException('DELETE FROM form_physical_exam WHERE forms_id = ?', [$formid]);
        } else {
            $formid = scalar_string((new FormService())->addForm($encounter, "Physical Exam", 0, "physical_exam", $pid, $userauthorized));
            QueryUtils::sqlStatementThrowException('UPDATE forms SET form_id = id WHERE id = ? AND form_id = 0', [$formid]);
        }

        $insert = <<<'SQL'
        INSERT INTO form_physical_exam (forms_id, line_id, wnl, abn, diagnosis, comments)
        VALUES (?, ?, ?, ?, ?, ?)
        SQL;

        foreach ($request->request->all('form_obs') as $line_id => $line_array) {
            if (!is_array($line_array)) {
                continue;
            }

            $wnl = $isChecked(scalar_string($line_array['wnl'] ?? null)) ? '1' : '0';
            $abn = $isChecked(scalar_string($line_array['abn'] ?? null)) ? '1' : '0';
            $diagnosis = scalar_string($line_array['diagnosis'] ?? null);
            $comments = scalar_string($line_array['comments'] ?? null);
            if ($wnl === '1' || $abn === '1' || $diagnosis !== '' || $comments !== '') {
                QueryUtils::sqlStatementThrowException($insert, [$formid, $line_id, $wnl, $abn, $diagnosis, $comments]);
            }
        }
    });

    if ($request->request->getString('form_refresh') === '') {
        formHeader("Redirecting....");
        formJump();
        formFooter();
        exit;
    }
}

// Load all existing rows for this form as a hash keyed on line_id.
//
$rows = [];
if ($formid !== '') {
    foreach (QueryUtils::fetchRecords('SELECT * FROM form_physical_exam WHERE forms_id = ?', [$formid]) as $row) {
        $rows[scalar_string($row['line_id'] ?? null)] = $row;
    }
}
?>
<html>
<head>
<?php Header::setupHeader(); ?>
<script>

 function seldiag(selobj, line_id) {
  var i = selobj.selectedIndex;
  var opt = selobj.options[i];
  if (opt.value == '*') {
   selobj.selectedIndex = 0;
   dlgopen('../../forms/physical_exam/edit_diagnoses.php?lineid=' + encodeURIComponent(line_id), '_blank', 500, 400);
  }
 }

 function refreshme() {
  top.restoreSession();
  var f = document.forms[0];
  f.form_refresh.value = '1';
  f.submit();
 }

</script>
    <style>
    @media screen {
      html.oe-workbench-context body.physical-exam-document-editor {
        box-sizing: border-box;
        margin: 0;
        padding: clamp(0.5rem, 2vw, 1.5rem);
        background-color: #e8eff0 !important;
        color: #182c36 !important;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form {
        box-sizing: border-box;
        width: 100%;
        max-width: 1100px;
        margin-inline: auto;
        padding: clamp(0.75rem, 2.5vw, 2rem);
        border: 1px solid #c7d5d9;
        background-color: #fff;
        color: #182c36;
        line-height: 1.5;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center {
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        overflow-x: auto;
        padding: 0 0.25rem 0.5rem;
        text-align: left;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > p:first-of-type {
        margin: 0;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > table {
        width: 100%;
        min-width: 1020px;
        border-collapse: collapse;
        color: #182c36;
        background-color: #fff;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > table td {
        padding: 0.55rem 0.6rem;
        border-bottom: 1px solid #d9e4e2;
        vertical-align: middle;
        line-height: 1.45;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > table td:nth-child(1),
      html.oe-workbench-context body.physical-exam-document-editor > form > center > table td:nth-child(2) {
        min-width: 4rem;
        text-align: center;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > table td:nth-child(3) {
        min-width: 5rem;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > table td:nth-child(4) {
        min-width: 19rem;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > table td:nth-child(5) {
        min-width: 13rem;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > table td:nth-child(6) {
        min-width: 16rem;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > table td[colspan='6'] {
        padding-block: 1.1rem 0.6rem;
        color: #183b49;
        background-color: #f3f7f5;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > table td[colspan='2'] {
        padding-block: 0.7rem;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > table tr:first-child td {
        padding-block: 0.75rem;
        background-color: #e8eff0;
        color: #183b49;
        font-weight: 600;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > table select[name^='form_obs['][name$='[diagnosis]'],
      html.oe-workbench-context body.physical-exam-document-editor > form > center > table input[type='text'][name^='form_obs['][name$='[comments]'] {
        box-sizing: border-box;
        min-width: 12rem;
        min-height: 2.65rem;
        padding: 0.45rem 0.6rem;
        border: 1px solid #91a8b1;
        border-radius: 3px;
        background-color: #fff;
        color: #182c36;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > table td[colspan='2'] input[type='text'][name^='form_obs['][name$='[comments]'] {
        min-width: 16rem;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > p:last-of-type {
        position: sticky;
        left: 0;
        width: max-content;
        max-width: 100%;
        margin-block: 1.25rem 0;
        padding-block: 0.75rem 0;
        background-color: #fff;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > p > input[type='submit'][name='bn_save'],
      html.oe-workbench-context body.physical-exam-document-editor > form > center > p > input[type='button'][onclick='parent.closeTab(window.name, false)'] {
        box-sizing: border-box;
        min-width: 7rem;
        min-height: 2.75rem;
        padding: 0.55rem 0.85rem;
        border-radius: 3px;
        font-weight: 600;
        cursor: pointer;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > p > input[type='submit'][name='bn_save'] {
        border: 1px solid #145968;
        background-color: #145968 !important;
        color: #fff !important;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > p > input[type='submit'][name='bn_save']:hover,
      html.oe-workbench-context body.physical-exam-document-editor > form > center > p > input[type='submit'][name='bn_save']:focus {
        border-color: #104e5b;
        background-color: #104e5b !important;
        color: #fff !important;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > p > input[type='button'][onclick='parent.closeTab(window.name, false)'] {
        border: 1px solid #91a8b1;
        background-color: #fff !important;
        color: #182c36 !important;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > p > input[type='button'][onclick='parent.closeTab(window.name, false)']:hover,
      html.oe-workbench-context body.physical-exam-document-editor > form > center > p > input[type='button'][onclick='parent.closeTab(window.name, false)']:focus {
        border-color: #145968;
        background-color: #e4f0f1 !important;
        color: #182c36 !important;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > table select[name^='form_obs['][name$='[diagnosis]']:focus,
      html.oe-workbench-context body.physical-exam-document-editor > form > center > table input[type='text'][name^='form_obs['][name$='[comments]']:focus,
      html.oe-workbench-context body.physical-exam-document-editor > form > center > table input[type='checkbox']:focus,
      html.oe-workbench-context body.physical-exam-document-editor > form > center > p > input[type='submit'][name='bn_save']:focus,
      html.oe-workbench-context body.physical-exam-document-editor > form > center > p > input[type='button'][onclick='parent.closeTab(window.name, false)']:focus {
        outline: 2px solid #a84c22;
        outline-offset: 2px;
      }

      html.oe-workbench-context body.physical-exam-document-editor > form > center > table select[name^='form_obs['][name$='[diagnosis]']:focus-visible,
      html.oe-workbench-context body.physical-exam-document-editor > form > center > table input[type='text'][name^='form_obs['][name$='[comments]']:focus-visible,
      html.oe-workbench-context body.physical-exam-document-editor > form > center > table input[type='checkbox']:focus-visible,
      html.oe-workbench-context body.physical-exam-document-editor > form > center > p > input[type='submit'][name='bn_save']:focus-visible,
      html.oe-workbench-context body.physical-exam-document-editor > form > center > p > input[type='button'][onclick='parent.closeTab(window.name, false)']:focus-visible {
        outline: 3px solid #a84c22;
        outline-offset: 2px;
      }
    }
    </style>
</head>

<body class="body_top physical-exam-document-editor">
<form method="post" action="<?php echo $rootdir ?>/forms/physical_exam/new.php?id=<?php echo attr_url($formid); ?>"
 onsubmit="return top.restoreSession()">
<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />

<center>

<p>
<table border='0' width='98%'>

 <tr>
  <td align='center' width='1%' nowrap><b><?php echo xlt('WNL'); ?></b></td>
  <td align='center' width='1%' nowrap><b><?php echo xlt('ABNL'); ?></b></td>
  <td align='left'   width='1%' nowrap><b><?php echo xlt('System'); ?></b></td>
  <td align='left'   width='1%' nowrap><b><?php echo xlt('Specific'); ?></b></td>
  <td align='left'   width='1%' nowrap><b><?php echo xlt('Diagnosis'); ?></b></td>
  <td align='left'  width='95%' nowrap><b><?php echo xlt('Comments'); ?></b></td>
 </tr>

<?php
foreach (physical_exam_lines() as $system) {
    $sysnamedisp = $system['label'];
    if ($system['code'] === '*') {
        $treatmentHeading = xlt('Treatment:');
        echo <<<HTML
            <tr><td colspan='6'>&nbsp;<br /><b>{$treatmentHeading}</b></td></tr>
            HTML;
        $sysnamedisp = '';
    }

    foreach ($system['lines'] as $line_id => $description) {
        if ($system['code'] !== '*') {
            echo $showExamLine($line_id, $description, $rows[$line_id] ?? [], $sysnamedisp);
        } else {
            echo $showTreatmentLine($line_id, $description, $rows[$line_id] ?? []);
        }

        $sysnamedisp = '';
    }
}
?>

</table>

<p>
<input type='hidden' name='form_refresh' value='' />
<input type='submit' name='bn_save' value='<?php echo xla('Save'); ?>' />
&nbsp;
<input type='button' value='<?php echo xla('Cancel'); ?>'
 onclick="parent.closeTab(window.name, false)" />
</p>

</center>

</form>
</body>
</html>
