<?php

/**
 * Clinical instructions form.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Jacob T Paul <jacob@zhservices.com>
 * @author    Brady Miller <brady.g.miller@gmail.com>
 * @copyright Copyright (c) 2015 Z&H Consultancy Services Private Limited <sam@zhservices.com>
 * @copyright Copyright (c) 2017-2019 Brady Miller <brady.g.miller@gmail.com>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once(__DIR__ . "/../../globals.php");

use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Common\Session\SessionWrapperFactory;
use OpenEMR\Core\Header;
use OpenEMR\Core\OEGlobalsBag;

// Hoist legacy `globals.php` locals so PHPStan can see them (#11792 Phase 5).
$srcdir = OEGlobalsBag::getInstance()->getSrcDir();
$rootdir = OEGlobalsBag::getInstance()->getString('rootdir');

require_once("$srcdir/options.inc.php");

$returnurl = 'encounter_top.php';
$formid = (int) ($_GET['id'] ?? 0);
$check_res = $formid ? formFetch("form_clinical_instructions", $formid) : [];

$session = SessionWrapperFactory::getInstance()->getActiveSession();
?>
<html>
    <head>
        <title><?php echo xlt("Clinical Instructions"); ?></title>

        <?php Header::setupHeader(); ?>
<style>
@media screen {
  html.oe-workbench-context body.oe-clinical-instructions-editor {
    margin: 0;
    background-color: #edf2f3 !important;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor > .container.mt-3 {
    box-sizing: border-box;
    width: calc(100% - 2rem);
    max-width: 860px;
    margin-block: 1.5rem;
    margin-inline: auto;
    padding-block: 1.5rem;
    padding-inline: clamp(1rem, 4vw, 2.25rem);
    border: 1px solid #cbd6da;
    border-radius: 7px;
    background-color: #fff;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor > .container.mt-3 > .row {
    box-sizing: border-box;
    width: 100%;
    margin-inline: 0;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor > .container.mt-3 > .row > .col-12 {
    min-width: 0;
    padding-inline: 0;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor h2 {
    margin-block: 0 1rem;
    color: #182c36;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.3;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor fieldset {
    min-width: 0;
    margin-block: 0 1rem;
    padding: 0;
    border: 0;
    background-color: #fff !important;
    color: #182c36 !important;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor legend {
    width: 100%;
    margin-block: 0 0.75rem;
    padding: 0;
    border: 0;
    color: #182c36;
    font-size: 1rem;
    font-weight: 600;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor fieldset > .container {
    box-sizing: border-box;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
    background-color: #fff;
    color: #182c36;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor fieldset .form-group {
    margin-block: 0;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor textarea#instruction {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 12rem;
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

  html.oe-workbench-context body.oe-clinical-instructions-editor .btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    max-width: 100%;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor .btn-group .btn {
    min-height: 2.5rem;
    white-space: normal;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor textarea#instruction:focus,
  html.oe-workbench-context body.oe-clinical-instructions-editor .btn-group .btn:focus {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }

  html.oe-workbench-context body.oe-clinical-instructions-editor textarea#instruction:focus-visible,
  html.oe-workbench-context body.oe-clinical-instructions-editor .btn-group .btn:focus-visible {
    outline: 2px solid #216a91;
    outline-offset: 2px;
  }
}
</style>
    </head>
    <body class="oe-clinical-instructions-editor">
        <div class="container mt-3">
            <div class="row">
                <div class="col-12">
                    <h2><?php echo xlt('Clinical Instructions'); ?></h2>
                    <form method="post" name="my_form" action="<?php echo $rootdir; ?>/forms/clinical_instructions/save.php?id=<?php echo attr_url($formid); ?>">
                        <input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />
                        <fieldset>
                            <legend><?php echo xlt('Instructions'); ?></legend>
                            <div class="container">
                                <div class="form-group">
                                    <textarea name="instruction" id="instruction" class="form-control" cols="80" rows="5" ><?php echo text($check_res['instruction'] ?? ''); ?></textarea>
                                </div>
                            </div>
                        </fieldset>
                        <div class="form-group">
                            <div class="btn-group" role="group">
                                <button type="submit" onclick='top.restoreSession()' class="btn btn-primary btn-save"><?php echo xlt('Save'); ?></button>
                                <button type="button" class="btn btn-secondary btn-cancel" onclick="top.restoreSession(); parent.closeTab(window.name, false);"><?php echo xlt('Cancel');?></button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </body>
</html>
