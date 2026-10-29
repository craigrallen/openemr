<?php

/**
 * ankleinjury view.php
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Nikolai Vitsyn
 * @author    cfapress <cfapress>
 * @author    Robert Down <robertdown@live.com>
 * @author    Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2004 Nikolai Vitsyn
 * @copyright Copyright (c) 2008 cfapress <cfapress>
 * @copyright Copyright (c) 2017-2023 Robert Down <robertdown@live.com>
 * @copyright Copyright (c) 2019 Brady Miller <brady.g.miller@gmail.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once(__DIR__ . "/../../globals.php");

use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Common\Forms\FormActionBarSettings;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Header;
use OpenEMR\Core\OEGlobalsBag;

// Hoist legacy `globals.php` locals so PHPStan can see them (#11792 Phase 5).
$srcdir = OEGlobalsBag::getInstance()->getSrcDir();
$rootdir = OEGlobalsBag::getInstance()->getString('rootdir');

$session = SessionWrapperFactory::getInstance()->getActiveSession();
?>
<html><head>
    <?php Header::setupHeader(); ?>
<style>
@media screen {
  html.oe-workbench-context body.oe-ankle-injury-editor {
    box-sizing: border-box;
    margin: 0;
    padding: clamp(0.75rem, 3vw, 1.5rem);
    background-color: #e8eff0 !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] {
    box-sizing: border-box;
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 2rem);
    border: 1px solid #c7d5d9;
    background-color: #fff;
    color: #182c36;
    font-size: 1rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] .title {
    display: block;
    margin: 0 0 1rem;
    color: #183b49;
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.25;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] .text,
  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] th {
    color: #183b49;
    font-weight: 600;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] table {
    display: block;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    margin: 0.75rem 0;
    overflow-x: auto;
    border-collapse: collapse;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] th,
  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] td {
    padding: 0.35rem 0.5rem;
    white-space: nowrap;
    overflow-wrap: normal;
    word-break: normal;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] table.oe-ankle-plan {
    width: 100%;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] table.oe-ankle-plan td {
    width: 100%;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] input[type='text'],
  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] select,
  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] textarea {
    box-sizing: border-box;
    max-width: 100%;
    border: 1px solid #91a8b1;
    border-radius: 3px;
    background-color: #fff;
    color: #182c36;
    font: inherit;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] input[type='text'],
  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] select {
    min-height: 2.4rem;
    padding: 0.35rem 0.5rem;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] input[type='radio'],
  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] input[type='checkbox'] {
    width: 1.1rem;
    height: 1.1rem;
    margin: 0 0.35rem;
    accent-color: #145968;
    vertical-align: middle;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] textarea[name='ankle_how_did_injury_occur'],
  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] textarea[name='ankle_plan'] {
    display: block;
    width: 100%;
    min-height: 12rem;
    padding: 0.75rem;
    line-height: 1.7;
    resize: vertical;
    white-space: pre-wrap;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] textarea[name='ankle_additional_x_ray_notes'],
  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] textarea[name='ankle_additional_diagnisis'] {
    display: block;
    width: 15rem;
    min-height: 4.5rem;
    padding: 0.5rem;
    line-height: 1.45;
    resize: vertical;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] a.link_submit,
  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] a.link {
    display: inline-block;
    box-sizing: border-box;
    max-width: 100%;
    min-height: 2.4rem;
    margin: 0.35rem 0;
    padding: 0.5rem 0.85rem;
    border-radius: 3px;
    font-weight: 600;
    text-decoration: none;
    vertical-align: middle;
    white-space: normal;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] a.link_submit {
    border: 1px solid #145968;
    background-color: #145968;
    color: #fff;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] a.link {
    border: 1px solid #91a8b1;
    background-color: #eef3f4 !important;
    color: #183b49 !important;
  }

  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] a:focus,
  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] input:focus,
  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] select:focus,
  html.oe-workbench-context body.oe-ankle-injury-editor form[name='my_form'] textarea:focus {
    outline: 3px solid #a84c22;
    outline-offset: 2px;
  }
}
</style>
</head>
<body class="body_top oe-ankle-injury-editor">
<?php
$obj = formFetch("form_ankleinjury", $_GET["id"]);
?>
<form method=post action="<?php echo $rootdir?>/forms/ankleinjury/save.php?mode=update&id=<?php echo attr_url($_GET["id"]); ?>" name="my_form">
<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />

<span class="title"><?php echo xlt('Ankle Evaluation Form'); ?></span><br /><br />

<a href="javascript:top.restoreSession();document.my_form.submit();" class="link_submit">[<?php echo xlt('Save'); ?>]</a>
<br />
<a href="<?php echo FormActionBarSettings::EXIT_URL; ?>" class="link"
 onclick="top.restoreSession()">[<?php echo xlt('Don\'t Save Changes'); ?>]</a>
<br /><br />

<span class=text>Date of Injury: </span><input type="text" name="ankle_date_of_injuary" value="<?php echo attr($obj["ankle_date_of_injuary"]); ?>" >
<td align="right"><?php echo xlt('Work related?'); ?>:</td>
<td><input type=checkbox name="ankle_work_related" <?php if ($obj["ankle_work_related"] == "on") {
    echo "checked";
                                                   }

                                                   ;?>><span class=text></span><br /></td>

<table >
<tr>
<td align="right"><?php echo xlt('Foot:'); ?></td>
<td><input type=radio name="ankle_foot" value="Left" <?php if ($obj["ankle_foot"] == "Left") {
    echo "checked";
                                                     };?>><span class=text></span><br /></td>
<td align="right"><?php echo xlt('Left:'); ?></td>
<td><input type=radio name="ankle_foot" value="Right" <?php if ($obj["ankle_foot"] == "Right") {
    echo "checked";
                                                      };?>><span class=text></span><br /></td>
<td align="right"><?php echo xlt('Right:'); ?></td>
</tr>
</table>

<table >
<tr>
<td align="right"><?php echo xlt('Severity of Pain:'); ?></td>
<td align="right">1:</td>
<td><input type=radio name="ankle_severity_of_pain" value="1" <?php if ($obj["ankle_severity_of_pain"] == "1") {
    echo "checked";
                                                              };?>><span class=text></span><br /></td>

<td align="right">2:</td>
<td><input type=radio name="ankle_severity_of_pain" value="2" <?php if ($obj["ankle_severity_of_pain"] == "2") {
    echo "checked";
                                                              };?>><span class=text></span><br /></td>

<td align="right">3:</td>
<td><input type=radio name="ankle_severity_of_pain" value="3" <?php if ($obj["ankle_severity_of_pain"] == "3") {
    echo "checked";
                                                              };?>><span class=text></span><br /></td>
</tr>
</table>

<table><tr>
<td align="right"><?php echo xlt('Significant Swelling:'); ?></td>
<td><input type=checkbox name="ankle_significant_swelling" <?php if ($obj["ankle_significant_swelling"] == "on") {
    echo "checked";
                                                           };?>><span class=text></span><br />
</tr>
</table>


<table >
<tr>
<td align="right"><?php echo xlt('Onset of Swelling:'); ?></td>
<td><input type=radio name="ankle_onset_of_swelling" value="within minutes" <?php if ($obj["ankle_onset_of_swelling"] == "within minutes") {
    echo "checked";
                                                                            };?>><span class=text></span><br /></td>
<td align="right"><?php echo xlt('within minutes:'); ?></td>
<td><input type=radio name="ankle_onset_of_swelling" value="within hours" <?php if ($obj["ankle_onset_of_swelling"] == "within hours") {
    echo "checked";
                                                                          };?>><span class=text></span><br /></td>
<td align="right"><?php echo xlt('within hours:');?></td>
</tr>
</table>

<span class="text"><?php echo xlt('How did Injury Occur?:'); ?></span><br />
<textarea name="ankle_how_did_injury_occur" cols ="67" rows="4"  wrap="virtual name">
<?php echo text($obj["ankle_how_did_injury_occur"]); ?></textarea>
<br />

<table><th colspan="5"><?php echo xlt('Ottawa Ankle Rules'); ?></th>
<tr>
<td align="right"><?php echo xlt('Bone Tenderness:'); ?></td>
<td align="right"><?php echo xlt('Medial malleolus:'); ?></td>
<td><input type=radio name="ankle_ottawa_bone_tenderness" value="Medial malleolus" <?php if ($obj["ankle_ottawa_bone_tenderness"] == "Medial malleolus") {
    echo "checked";
                                                                                   };?>><span class=text></span><br /></td>
<td align="right"><?php echo xlt('Lateral malleolus:'); ?></td>
<td><input type=radio name="ankle_ottawa_bone_tenderness"  value="Lateral malleolus" <?php if ($obj["ankle_ottawa_bone_tenderness"] == "Lateral malleolus") {
    echo "checked";
                                                                                     };?>><span class=text></span><br /></td>
<td align="right"><?php echo xlt('Base of fifth (5th) Metarsal:'); ?></td>
<td><input type=radio name="ankle_ottawa_bone_tenderness" value="Base of fifth (5th) Metarsal" <?php if ($obj["ankle_ottawa_bone_tenderness"] == "Base of fifth (5th) Metarsal") {
    echo "checked";
                                                                                               };?>><span class=text></span><br /></td>
<td align="right"><?php echo xlt('At the Navicular:'); ?></td>
<td><input type=radio name="ankle_ottawa_bone_tenderness" value="At the Navicular" <?php if ($obj["ankle_ottawa_bone_tenderness"] == "At the Navicular") {
    echo "checked";
                                                                                   };?>><span class=text></span><br /></td>
</tr>
</table>

<table >
<tr>
<td align="right"><?php echo xlt('Able to Bear Weight four (4) steps:'); ?></td>
<td align="right"><?php echo xlt('Yes:'); ?></td>
<td><input type=radio name="ankle_able_to_bear_weight_steps" value="Yes" <?php if ($obj["ankle_able_to_bear_weight_steps"] == "Yes") {
    echo "checked";
                                                                         };?>><span class=text></span><br /></td>
<td align="right"><?php echo xlt('No:'); ?></td>
<td><input type=radio name="ankle_able_to_bear_weight_steps" value="No" <?php if ($obj["ankle_able_to_bear_weight_steps"] == "No") {
    echo "checked";
                                                                        };?>><span class=text></span><br /></td>
</tr>
</table>

<table>
<tr><th><?php echo xlt('X-Ray Interpretation:'); ?></th> <th><?php echo xlt('Additional X-RAY Notes:'); ?></th></tr>
<tr>
<td>
<input type="text" name="ankle_x_ray_interpretation" value="<?php echo
attr($obj["ankle_x_ray_interpretation"]); ?>" size="50">
</td>
<td rowspan=2>
<textarea name="ankle_additional_x_ray_notes" cols ="30" rows="1" wrap="virtual name">
<?php echo attr($obj["ankle_additional_x_ray_notes"]); ?></textarea>
<td>
</tr>
</table>

<table>
<tr><th><?php echo xlt('Diagnosis:'); ?></th><th><?php echo xlt('Additional Diagnosis:'); ?></th></tr>
<tr>
<td><input type="text" name="ankle_diagnosis1" value="<?php echo
attr($obj["ankle_diagnosis1"]); ?>" size="50">
</td>
<td rowspan=2>
<textarea name="ankle_additional_diagnisis" rows="2" cols="30" wrap="virtual name">
<?php echo attr($obj["ankle_additional_diagnisis"]); ?></textarea>
</td>

<tr>
<td><input type="text" name="ankle_diagnosis2" value="<?php echo
attr($obj["ankle_diagnosis2"]); ?>" size="50"></td>
</tr>
<td><input type="text" name="ankle_diagnosis3" value="<?php echo
attr($obj["ankle_diagnosis3"]); ?>" size="50"></td>
</tr>
<td><input type="text" name="ankle_diagnosis4" value="<?php echo
attr($obj["ankle_diagnosis4"]); ?>" size="50"></td>
</tr>
</table>

<table class="oe-ankle-plan"><tr><th><?php echo xlt('Plan:'); ?></th><tr>
<tr><td>
<textarea name="ankle_plan" rows="4" cols="67" wrap="virtual name">
<?php echo text($obj["ankle_plan"]); ?></textarea>
</td></tr></table>

<a href="javascript:top.restoreSession();document.my_form.submit();" class="link_submit">[<?php echo xlt('Save'); ?>]</a>
<br />
<a href="<?php echo FormActionBarSettings::EXIT_URL; ?>" class="link"
 onclick="top.restoreSession()">[<?php echo xlt('Don\'t Save Changes'); ?>]</a>
</form>
<?php
formFooter();
?>
