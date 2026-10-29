<?php

/**
 * phq-9 form using forms api     new.php    create a new form
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Ruth Moulton <moulton ruth@muswell.me.uk>
 * @copyright Copyright (c) 2021 ruth moulton <ruth@muswell.me.uk>
 *
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once(__DIR__ . "/../../globals.php");

// Hoist legacy `globals.php` locals so PHPStan can see them (#11792 Phase 5).
$srcdir = \OpenEMR\Core\OEGlobalsBag::getInstance()->getSrcDir();

require_once("phq9.inc.php"); //common strings

/**
 * @var string $srcdir
 * @var string $rootdir
 * @var string $viewmode
 * @var string $str_default
 * @var string $str_not
 * @var string $str_several
 * @var string $str_more
 * @var string $str_nearly
 * @var string $str_somewhat
 * @var string $str_very
 * @var string $str_extremely
 * @var string $str_nosave_confirm
 * @var string $str_form_name
 * @var string $str_form_title
 * @var string $str_q10
 * @var string $str_q10_2
 */

use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Common\Forms\FormActionBarSettings;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Header;

$obj = $viewmode == 'update' ? formFetch("form_phq9", $_GET["id"]) : null;
$session = SessionWrapperFactory::getInstance()->getActiveSession();
?>
<html>
<head>
    <title><?php echo text($str_form_title); ?> </title>
    <?php Header::setupHeader(); ?>
    <style>
    @media screen {
      html.oe-workbench-context body.phq9-document-editor {
        box-sizing: border-box;
        margin: 0;
        padding: clamp(0.5rem, 2vw, 1.5rem);
        background-color: #e8eff0 !important;
        color: #182c36 !important;
      }

      html.oe-workbench-context body.phq9-document-editor > .col-12 {
        box-sizing: border-box;
        max-width: 860px;
        margin-inline: auto;
        padding: 0;
      }

      html.oe-workbench-context body.phq9-document-editor h3 {
        margin-block: 0 0.75rem;
        color: #183b49;
        font-size: clamp(1.25rem, 3vw, 1.75rem);
        line-height: 1.3;
      }

      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] {
        box-sizing: border-box;
        width: 100%;
        max-width: 860px;
        min-width: 0;
        margin-inline: auto;
        padding: clamp(0.75rem, 2.5vw, 1.75rem);
        border: 1px solid #c7d5d9;
        background-color: #fff;
        color: #182c36;
        font-size: 1rem;
        line-height: 1.7;
        overflow-wrap: anywhere;
      }

      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] > .title {
        color: #183b49;
        font-size: 1rem;
        font-weight: 600;
        line-height: 1.5;
      }

      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] table {
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        border-collapse: collapse;
      }

      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] td {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        padding-block: 0.5rem;
        vertical-align: top;
        overflow-wrap: anywhere;
      }

      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] td > .label,
      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] td > i {
        display: block;
        color: #182c36;
        font-size: 1rem;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }

      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] td > select {
        box-sizing: border-box;
        display: block;
        width: 100%;
        max-width: 100%;
        min-height: 2.75rem;
        margin-block: 0.5rem 0;
        padding: 0.5rem 0.75rem;
        border: 1px solid #91a8b1;
        border-radius: 4px;
        background-color: #fff !important;
        color: #182c36 !important;
        font: inherit;
        transition-duration: 0s;
      }

      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] #q10_place,
      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] #show_phq9_score {
        display: block;
        color: #183b49;
        font-weight: 600;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }

      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] #q10_place {
        margin-block: 0.25rem;
      }

      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] button[type='submit'],
      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] button[type='button'] {
        box-sizing: border-box;
        display: block;
        width: min(100%, 20rem);
        max-width: 100%;
        min-height: 2.75rem;
        margin-block: 0.5rem;
        padding: 0.55rem 0.85rem;
        border: 1px solid #145968;
        border-radius: 4px;
        font: inherit;
        white-space: normal;
        overflow-wrap: anywhere;
        transition-duration: 0s;
      }

      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] button[type='submit'] {
        background-color: #145968 !important;
        color: #fff !important;
      }

      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] button[type='button'] {
        border-color: #91a8b1;
        background-color: #fff !important;
        color: #182c36 !important;
      }

      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] button[type='submit']:hover,
      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] button[type='submit']:focus,
      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] button[type='submit']:active {
        border-color: #104e5b;
        background-color: #104e5b !important;
        color: #fff !important;
      }

      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] button[type='button']:hover,
      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] button[type='button']:focus,
      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] button[type='button']:active {
        border-color: #145968;
        background-color: #e4f0f1 !important;
        color: #182c36 !important;
      }

      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] button[type='submit']:focus-visible,
      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] button[type='button']:focus-visible,
      html.oe-workbench-context body.phq9-document-editor form[name='my_form'] select:focus-visible {
        outline: 3px solid #a84c22;
        outline-offset: 2px;
      }
    }
    </style>
</head>
<body class="body_top phq9-document-editor">
    <script>
        //var no_qs = 10; // number of questions in the form
        var phq9_score = 0; // total score

    </script>
    <?php $qno = 0; ?>

    <script src="<?php echo $rootdir; ?>/forms/phq9/phq9_javasrc.js?v=<?php echo attr_url(\OpenEMR\Core\OEGlobalsBag::getInstance()->getString('v_js_includes')); ?>"></script>

    <script>
        // stuff that uses embedded php must go here, not in the include javascript file -
        // it must be executed on server side before page is sent to client. included
        // javascript is only executed on the client
        function create_q10(question, menu ) {
            // create the 10th question - the second part is italicised. Only displayed if score > 0
            var text = document.createTextNode(jsAttr("10" + ". "+<?php echo js_escape($str_q10); ?>));
            question.appendChild(text);
            var new_line = document.createElement("br");
            var ital = document.createElement("i"); // second part is in italics
            var question_2 = document.createTextNode(jsAttr(<?php echo   js_escape($str_q10_2); ?>));
            ital.appendChild(question_2);
            question.name = "tenth";
            question.appendChild(new_line);
            question.appendChild(ital);
            // populate the menu
            menu.options[0] = new Option( <?php echo js_escape($str_not); ?>, "0");
            menu.options[1] = new Option( <?php echo js_escape($str_somewhat); ?>, "1");
            menu.options[2] = new Option( <?php echo js_escape($str_very); ?>, "2");
            menu.options[3] = new Option( <?php echo js_escape($str_extremely);?>, "3");
            menu.options[4] = new Option( <?php echo js_escape($str_default);  ?>, "undef");
        }
    </script>
    <div class="col-12">
        <h3><?php echo text($str_form_name); ?></h3>
        <form method=post action="<?php echo $rootdir; ?>/forms/phq9/save.php?mode=<?php echo attr_url($viewmode); ?>&id=<?php echo attr_url($_GET['id'] ?? 0); ?>" name="my_form"<?php if (!$obj) {
            ?> onSubmit="return(check_all());"<?php }?>>
            <input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />
            <div class="title"><?php echo xlt('How often have you been bothered by the following over the past 2 weeks?'); ?></div>
            <hr />
            <table>
                <tr>
                    <td>
                        <span class="label"><?php echo ++$qno . ". " . xlt('Little interest or pleasure in doing things'); ?></span>
                        <select class="form-input" name="interest_score" onchange="update_score(0, my_form.interest_score.value);">
                            <?php if (!$obj) { ?>
                                <option value="undef"><?php echo text($str_default); ?></option> <?php } ?>
                            <option value="0"><?php echo text($str_not); ?></option>
                            <option value="1"><?php echo text($str_several); ?></option>
                            <option value="2"><?php echo text($str_more); ?></option>
                            <option value="3"><?php echo text($str_nearly); ?></option>
                        </select>
                        <?php if ($obj) { ?>
                        <script>
                            // set the default to the previous value - so it is displayed in the menu box
                            document.my_form.interest_score.options[<?php echo attr($obj['interest_score']); ?>].defaultSelected=true;
                            var i = <?php echo js_escape($obj['interest_score']); ?>; //the value from last time
                            phq9_score += parseInt (i);
                            all_scores[0] = i;
                        </script><?php } ?>
                    </td>
                </tr>
            </table>
            <table>
                <tr>
                    <td>
                        <span class="label"><?php echo ++$qno . ". " . xlt('Feeling down, depressed, or hopeless'); ?></span>
                        <select class="input-sm my-1" name="hopeless_score" onchange="update_score(1, my_form.hopeless_score.value);">
                            <?php if (!$obj) {
                                ?><option value="undef"><?php echo text($str_default); ?></option><?php } ?>
                            <option value="0"><?php echo text($str_not); ?></option>
                            <option value="1"><?php echo text($str_several); ?></option>
                            <option value="2"><?php echo text($str_more); ?></option>
                            <option value="3"><?php echo text($str_nearly); ?></option>
                        </select>
                        <?php if ($obj) { ?>
                        <script>
                            // set the default to the previous value - so it is displayed in the menu box
                            var i = <?php echo js_escape($obj['hopeless_score']); ?>; //the value from last time
                            document.my_form.hopeless_score.options[i].defaultSelected=true;
                            phq9_score += parseInt (i);
                            all_scores[1] = i;
                        </script><?php } ?>
                    </td>
                </tr>
            </table>
            <table>
                <tr>
                    <td>
                        <span class="label"><?php echo ++$qno . ". " . xlt('Trouble falling or staying asleep, or sleeping too much'); ?></span>
                        <select class="input-sm my-1" name="sleep_score" onchange="update_score(2, my_form.sleep_score.value);">
                            <?php if (!$obj) {
                                ?><option value="undef"><?php echo text($str_default); ?></option><?php } ?>
                            <option value="0"><?php echo text($str_not); ?></option>
                            <option value="1"><?php echo text($str_several); ?></option>
                            <option value="2"><?php echo text($str_more); ?></option>
                            <option value="3"><?php echo text($str_nearly); ?></option>
                        </select>
                        <?php if ($obj) { ?>
                        <script>
                            // set the previous value to the default - so it is displayed in the menu box
                            var i = <?php echo js_escape($obj['sleep_score']); ?> ; //the value from last time
                            document.my_form.sleep_score.options[i].defaultSelected=true;
                            phq9_score += parseInt (i);
                            all_scores[2] = i;
                        </script><?php } ?>
                    </td>
                </tr>
            </table>
            <table>
                <tr>
                    <td>
                        <span class="label"><?php echo ++$qno . ". " . xlt('Feeling tired or having little energy'); ?></span>
                        <select class="input-sm my-1" name="fatigue_score" onchange="update_score(3, my_form.fatigue_score.value);">
                            <?php if (!$obj) {
                                ?><option value="undef"><?php echo text($str_default); ?></option><?php } ?>
                            <option value="0"><?php echo text($str_not); ?></option>
                            <option value="1"><?php echo text($str_several); ?></option>
                            <option value="2"><?php echo text($str_more); ?></option>
                            <option value="3"><?php echo text($str_nearly); ?></option>
                        </select>
                        <?php if ($obj) { ?>
                        <script>
                            // set the previous value to the default - so it is displayed in the menu box
                            var i = <?php echo js_escape($obj['fatigue_score']); ?> ; //the value from last time
                            document.my_form.fatigue_score.options[i].defaultSelected=true;
                            phq9_score += parseInt (i);
                            all_scores[3] = i;
                        </script><?php } ?>
                    </td>
                </tr>
            </table>
            <table>
                <tr>
                    <td>
                        <span class="label"><?php echo ++$qno . ". " . xlt('Poor appetite or overeating'); ?></span>
                        <select class="input-sm my-1" name="appetite_score" onchange="update_score(4, my_form.appetite_score.value);">
                            <?php if (!$obj) {
                                ?><option value="undef"><?php echo text($str_default); ?></option><?php } ?>
                            <option value="0"><?php echo text($str_not); ?></option>
                            <option value="1"><?php echo text($str_several); ?></option>
                            <option value="2"><?php echo text($str_more); ?></option>
                            <option value="3"><?php echo text($str_nearly); ?></option>
                        </select>
                        <?php if ($obj) { ?>
                        <script>
                            // set the previous value to the default - so it is displayed in the menu box
                            var i = <?php echo js_escape($obj['appetite_score']); ?> ; //the value from last time
                            document.my_form.appetite_score.options[i].defaultSelected=true;
                            phq9_score += parseInt (i);
                            all_scores[4] = i;
                        </script><?php } ?>
                    </td>
                </tr>
            </table>
            <table>
                <tr>
                    <td>
                        <span class="label"><?php echo ++$qno . ". " . xlt('Feeling bad about yourself - or that you are a failure or have let yourself or your family down'); ?></span>
                        <select class="input-sm my-1" name="failure_score" onchange="update_score(5, my_form.failure_score.value);">
                            <?php if (!$obj) {
                                ?><option value="undef"><?php echo text($str_default); ?></option><?php } ?>
                            <option value="0"><?php echo text($str_not); ?></option>
                            <option value="1"><?php echo text($str_several); ?></option>
                            <option value="2"><?php echo text($str_more); ?></option>
                            <option value="3"><?php echo text($str_nearly); ?></option>
                        </select>
                        <?php if ($obj) { ?>
                        <script>
                            // set the previous value to the default - so it is displayed in the menu box
                            var i = <?php echo js_escape($obj['failure_score']); ?> ; //the value from last time
                            document.my_form.failure_score.options[i].defaultSelected=true;
                            phq9_score += parseInt (i);
                            all_scores[5] = i;
                        </script><?php } ?>
                    </td>
            </table>
            </tr>
            <table>
                <tr>
                    <td>
                        <span class="label"><?php echo ++$qno . ". " . xlt('Trouble concentrating on things, such as reading an article or watching videos'); ?></span>
                        <select class="input-sm my-1" name="focus_score" onchange="update_score(6, my_form.focus_score.value);">
                            <?php if (!$obj) {
                                ?><option value="undef"><?php echo text($str_default); ?></option><?php } ?>
                            <option value="0"><?php echo text($str_not); ?></option>
                            <option value="1"><?php echo text($str_several); ?></option>
                            <option value="2"><?php echo text($str_more); ?></option>
                            <option value="3"><?php echo text($str_nearly); ?></option>
                        </select>
                        <?php if ($obj) { ?>
                        <script>
                            // set the previous value to the default - so it is displayed in the menu box
                            var i = <?php echo js_escape($obj['focus_score']);?> ; //the value from last time
                            document.my_form.focus_score.options[i].defaultSelected=true;
                            phq9_score += parseInt (i);
                            all_scores[6] = i;
                        </script><?php } ?>
                    </td>
                </tr>
            </table>
            <table>
                <tr>
                    <td>
                        <span class="label"><?php echo ++$qno . ". " . xlt('Moving or speaking slowly noted by others or fidgety or restless more than usual'); ?></span>
                        <select class="input-sm my-1" name="psychomotor_score" onchange="update_score(7, my_form.psychomotor_score.value);">
                            <?php if (!$obj) {
                                ?><option value="undef"><?php echo text($str_default); ?></option><?php } ?>
                            <option value="0"><?php echo text($str_not); ?></option>
                            <option value="1"><?php echo text($str_several); ?></option>
                            <option value="2"><?php echo text($str_more); ?></option>
                            <option value="3"><?php echo text($str_nearly); ?></option>
                        </select>
                        <?php if ($obj) { ?>
                        <script>
                            // set the previous value to the default - so it is displayed in the menu box
                            var i = <?php echo js_escape($obj['psychomotor_score']);?> ; //the value from last time
                            document.my_form.psychomotor_score.options[i].defaultSelected=true;
                            phq9_score += parseInt (i);
                            all_scores[7] = i;
                        </script><?php } ?>
                    </td>
                </tr>
            </table>
            <table>
                <tr>
                    <td>
                        <span class="label"><?php echo ++$qno . ". " . xlt('Thoughts that you would be better off dead, or of hurting yourself'); ?></span>
                        <select class="input-sm my-1" name="suicide_score" onchange="update_score(8, my_form.suicide_score.value);">
                            <?php if (!$obj) {
                                ?><option value="undef"><?php echo text($str_default); ?></option><?php } ?>
                            <option value="0"><?php echo text($str_not); ?></option>
                            <option value="1"><?php echo text($str_several); ?></option>
                            <option value="2"><?php echo text($str_more); ?></option>
                            <option value="3"><?php echo text($str_nearly); ?></option>
                        </select>
                        <?php if ($obj) { ?>
                        <script>
                            // set the previous value to the default - so it is displayed in the menu box
                            var i = <?php echo js_escape($obj['suicide_score']);?> ; //the value from last time
                            document.my_form.suicide_score.options[i].defaultSelected=true;
                            phq9_score += parseInt (i);
                            all_scores[8] = i;
                        </script><?php } ?>
                    </td>
                </tr>
            </table>
            <table>
                <tr>
                    <td>
                    <br>
                        <span id="q10_place" class="label"></span>
                    </td>
                </tr>
            </table>

            <script>
                function check_all() {
                    // has each question been answered and save scores
                    var flag = false;
                    var list = '';
                    for (i = 0; i < (no_qs - 1); i++) { // last questionis optional
                        if (!all_answered[i]) {
                            list = list + Number(i + 1) + ',';
                            flag = true;
                        }
                    }
                    if (flag) {
                        list[list.length - 1] = ' '; /* get rid of trailing comma */
                        alert(xl("Please answer all of the questions") + ": " + list + " " + xl("are unanswered"));
                        return false;
                    }
                    return true;
                }

                // warn if about to exit without saving answers - check that's what the user really wants
                function nosave_exit() {
                    var conf = confirm(<?php echo js_escape($str_nosave_confirm); ?>);

                    if (conf) {
                        window.location.href = "<?php echo FormActionBarSettings::EXIT_URL; ?>";
                    }
                    return (conf);
                }
            </script>
            <table>
                <tr>
                    <td>
                        <hr />
                        <span id="show_phq9_score"><b><?php echo xlt("Total PHQ-9 score"); ?>:</b>
                    </td>
                </tr>
            </table>
            <script>
                manage_question_10 (<?php echo js_escape($obj["difficulty"]); ?>);
                update_score("undef", phq9_score);
            </script>
            <table>
                <tr>
                    <td>
                        <button class="btn btn-primary btn-save my-2" type="submit" value="<?php echo xla('Save Form'); ?>"><?php echo xlt('Save Form'); ?></button>
                        <button class="btn btn-secondary btn-cancel" type="button" value="<?php echo xla('Cancel'); ?>" onclick="top.restoreSession();return( nosave_exit());"><?php echo xlt('Cancel'); ?></button>
                    </td>
                </tr>
            </table>
        </form>
    </div>
    <?php
    formFooter();
    ?>
