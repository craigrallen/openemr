'use strict';

/**
 * OPEMR-51 source contract for the DORN create-route popup
 * (interface/modules/custom_modules/oe-module-dorn/public/route_edit.php).
 *
 * The route is dangerous to execute: every render calls the DORN vendor
 * connector (ConnectorApi::getPrimaryInfos), and a POST calls
 * ConnectorApi::createRoute, ConnectorApi::getLab and writes the address book,
 * procedure provider and DORN route rows. Nothing here executes, requests or
 * bootstraps it; every check is a byte-level source comparison.
 *
 * The only approved change is a document-shaped section-sheet presentation:
 *   - <body class="container-fluid"> gains only the oe-dorn-route-popup class;
 *   - a SECOND screen-only <style> block is inserted just before </head>,
 *     directly after the untouched original <style> block, gated on
 *     html.oe-workbench-context.
 * Everything else must stay byte-identical to the frozen original captured at
 * master 18647270.
 *
 * Usage (dependency-free, Node only):
 *   node --test tests/fixtures/clinical-workspace/dorn-route-popup.contract.cjs
 *   node tests/fixtures/clinical-workspace/dorn-route-popup.contract.cjs
 *   node tests/fixtures/clinical-workspace/dorn-route-popup.contract.cjs --history
 *   OPEMR51_DORN_HISTORY=1 node --test tests/fixtures/clinical-workspace/dorn-route-popup.contract.cjs
 *
 * Portable mode (the default) needs no Git history and spawns no process, so
 * it runs in shallow CI checkouts. History mode is opt-in and fails, never
 * skips, when Git or the exact base commit is unavailable.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const BASE_SHA = '18647270e0c799189d2dc10f801e8de2bff1a360';
const HISTORY_ENV = 'OPEMR51_DORN_HISTORY';

const MODULE = 'interface/modules/custom_modules/oe-module-dorn';
const ROUTE = MODULE + '/public/route_edit.php';
const CALLER = MODULE + '/public/lab_setup.php';
const FIXTURE = 'tests/fixtures/clinical-workspace/dorn-route.original.php.fixture';
const CONTRACT = 'tests/fixtures/clinical-workspace/dorn-route-popup.contract.cjs';
const JEST_TEST = 'tests/js/clinical-dorn-route-popup.test.js';
const DOC = 'docs/clinical-ui/DORN-ROUTE-POPUP.md';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const ASSET_CONFIG = 'config/config.yaml';

// Files the slice relies on but must not touch. Compared to the base blob in
// history mode only; the portable mode cannot require Git history.
const UNCHANGED_FILES = [
    CALLER,
    MODULE + '/src/ConnectorApi.php',
    MODULE + '/src/LabRouteSetup.php',
    MODULE + '/src/AddressBookAddEdit.php',
    MODULE + '/src/DisplayHelper.php',
    MODULE + '/src/models/CreateRouteFromPrimaryViewModel.php',
    'src/Core/Header.php',
    ASSET_CONFIG,
    POPUP_CSS,
    'interface/clinical-workspace/popup.js',
    'library/dialog.js',
    'interface/main/tabs/js/include_opener.js',
];
const UNCHANGED_TREES = ['interface/themes', 'public/themes', 'interface/clinical-workspace'];
const CHANGE_SCOPE = [ROUTE, FIXTURE, CONTRACT, JEST_TEST, DOC];

const MARKER = 'oe-dorn-route-popup';
// The untouched original <style> block: required red, section edge/geometry
// and the (unused) h5 heading rule.
const ORIGINAL_STYLE = [
    '    <style>',
    '      .required-field {',
    '        color: red;',
    '      }',
    '      .form-section {',
    '        border: 1px solid #ddd;',
    '        padding: 15px;',
    '        margin-bottom: 20px;',
    '        border-radius: 5px;',
    '      }',
    '      .form-section h5 {',
    '        margin-top: 0;',
    '        color: #333;',
    '        border-bottom: 1px solid #eee;',
    '        padding-bottom: 10px;',
    '      }',
    '    </style>',
    '',
].join('\n');
const STYLE_CLOSE = '    </style>\n';
const HEAD_CLOSE = '</head>\n';
const BODY_ORIGINAL = '<body class="container-fluid">\n';
const BODY_APPROVED = '<body class="container-fluid ' + MARKER + '">\n';
// Matches the original block's idiom: tag at 4 spaces, selector at 6,
// declarations at 8.
const STYLE_BLOCK = [
    '    <style media="screen">',
    '      html.oe-workbench-context body.oe-dorn-route-popup {',
    '        color: var(--oe-wb-ink);',
    '        background-color: var(--oe-wb-canvas);',
    '      }',
    '',
    '      html.oe-workbench-context body.oe-dorn-route-popup > form > .form-section {',
    '        color: var(--oe-wb-ink);',
    '        background-color: var(--oe-wb-paper);',
    '        border-color: var(--oe-wb-line);',
    '      }',
    '    </style>',
    '',
].join('\n');
const ORIGINAL_SEAM = STYLE_CLOSE + HEAD_CLOSE + BODY_ORIGINAL;
const APPROVED_SEAM = STYLE_CLOSE + STYLE_BLOCK + HEAD_CLOSE + BODY_APPROVED;

const APPROVED_RULES = [
    {
        selector: 'html.oe-workbench-context body.oe-dorn-route-popup',
        declarations: ['color: var(--oe-wb-ink);', 'background-color: var(--oe-wb-canvas);'],
    },
    {
        selector: 'html.oe-workbench-context body.oe-dorn-route-popup > form > .form-section',
        declarations: [
            'color: var(--oe-wb-ink);',
            'background-color: var(--oe-wb-paper);',
            'border-color: var(--oe-wb-line);',
        ],
    },
];
const TOKENS = ['--oe-wb-canvas', '--oe-wb-paper', '--oe-wb-ink', '--oe-wb-line'];

// Lines of the original that carry bootstrap, ACL, CSRF, connector, record
// writes, escaping, header, field, EULA, Save/Cancel, message and validation
// behaviour. Each must appear exactly once in the frozen original, in order.
const PRESERVED_LINES = [
    'require_once __DIR__ . "/../../../../globals.php";',
    'use OpenEMR\\Common\\Acl\\AccessDeniedHelper;',
    'use OpenEMR\\Common\\Acl\\AclMain;',
    'use OpenEMR\\Common\\Csrf\\CsrfUtils;',
    'use OpenEMR\\Common\\Session\\SessionWrapperFactory;',
    'use OpenEMR\\Core\\Header;',
    'use OpenEMR\\Modules\\Dorn\\AddressBookAddEdit;',
    'use OpenEMR\\Modules\\Dorn\\ConnectorApi;',
    'use OpenEMR\\Modules\\Dorn\\DisplayHelper;',
    'use OpenEMR\\Modules\\Dorn\\LabRouteSetup;',
    'use OpenEMR\\Modules\\Dorn\\models\\CreateRouteFromPrimaryViewModel;',
    "if (!AclMain::aclCheckCore('admin', 'users')) {",
    '    AccessDeniedHelper::denyWithTemplate("ACL check failed for admin/users: Edit/Add Procedure Provider", xl("Edit/Add Procedure Provider"));',
    '$labGuid = "";',
    '$message = "";',
    '$session = SessionWrapperFactory::getInstance()->getActiveSession();',
    'if (!empty($_REQUEST)) {',
    '    if (!CsrfUtils::verifyCsrfToken($_REQUEST["csrf_token_form"], session: $session)) {',
    '        CsrfUtils::csrfNotVerified();',
    'if (!empty($_POST)) {',
    '    $routeData = CreateRouteFromPrimaryViewModel::loadByPost($_POST);',
    '    $apiResponse =  ConnectorApi::createRoute($routeData); //create the route on dorn, we have all we need to do so',
    '    if ($apiResponse->isSuccess) {',
    '        $ppid = 0;',
    '        $uid = 0;',
    '        $labData = ConnectorApi::getLab($routeData->labGuid);',
    '        $note = "labGuid:" . $labData->labGuid;',
    '        $setupRouteInfo = LabRouteSetup::getRouteSetup($apiResponse->labGuid, $apiResponse->routeGuid);',
    '        if ($setupRouteInfo != null) {',
    '        $uid = AddressBookAddEdit::createOrUpdateRecordInAddressBook($uid, $labData->name, $labData->address1, $labData->address2, $labData->city, $labData->state, $labData->zipCode, $labData->Website, $labData->phoneNumber, $labData->faxNumber, $note);',
    '        $ppid = LabRouteSetup::createUpdateProcedureProviders($ppid, $labData->name, $routeData->npi, $labData->labGuid, $uid, $routeData->labAccountNumber);',
    '        $isLabSetup = LabRouteSetup::createDornRoute($apiResponse->labName, $apiResponse->routeGuid, $apiResponse->labGuid, $ppid, $uid, $labData->textLineBreakCharacter, $routeData->labAccountNumber);',
    '        $message = $isLabSetup ? "Lab has been setup" : "Failure creating route!";',
    '        if ($apiResponse->responseMessage) {',
    '            $message = $apiResponse->responseMessage;',
    '            $message = "Error creating route, no information came back though";',
    '    if (!empty($_GET)) {',
    "        $labGuid = $_REQUEST['labGuid'];",
    "$isEula = ($_GET['isEula'] ?? false) == 'true';",
    "$primaryInfos = ConnectorApi::getPrimaryInfos('');",
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    "    <?php Header::setupHeader(['opener']);?>",
    '    <title><?php echo xlt("Edit or Add Procedure Provider") ?></title>',
    '    <style>',
    '        color: red;',
    '    </style>',
    '</head>',
    '<body class="container-fluid">',
    '    <form method=\'post\' name=\'theform\' action="route_edit.php?labGuid=<?php echo attr_url($labGuid); ?>&csrf_token_form=<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>">',
    '                <h2><?php echo xlt("DORN Lab Route Configuration") ?></h2>',
    '                <input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />',
    '                <input type="hidden" name="form_labGuid" value="<?php echo attr($labGuid); ?>" />',
    '                        <label for="form_customerAcctNumber"><?php echo xlt("Customer Account Number") ?> <span class="required-field">*</span>:</label>',
    '                        <input type="text" class="form-control" id="form_customerAccountNumber" name="form_customerAcctNumber"',
    '                        <input type="text" class="form-control" id="form_clientSiteId" name="form_clientSiteId"',
    '                        <select id="form_primaries" name="form_primaries" class="form-control" required>',
    '                            <option value=""><?php echo xlt("-- Select Provider --") ?></option>',
    "                                <option <?php echo DisplayHelper::SelectOption($_POST['form_primaries'] ?? '', $pInfo->npi ?? '') ?>  value='<?php echo attr($pInfo->npi) ?>' ><?php echo text($pInfo->primaryName); ?> (<?php echo text($pInfo->npi); ?>)</option>",
    '                        <input type="text" class="form-control" id="form_labAcctNumber" name="form_labAcctNumber"',
    '        <?php if ($isEula) { ?>',
    "                            value=\"<?php echo isset($_POST['form_eulaVersion']) ? attr($_POST['form_eulaVersion']) : '2024-08-28' ?>\"",
    '                        <input type="text" class="form-control" id="form_eulaAccepterFullName" name="form_eulaAccepterFullName"',
    "                            value=\"<?php echo isset($_POST['form_eulaAcceptanceDateTimeUtc']) ? attr($_POST['form_eulaAcceptanceDateTimeUtc']) : date('Y-m-d\\TH:i:s.v\\Z') ?>\"",
    '                            <input class="form-check-input" type="checkbox" checked id="form_eulaAcceptance" name="form_eulaAcceptance" required>',
    '                                <strong><?php echo xlt("I accept the End User License Agreement") ?> <span class="required-field">*</span></strong>',
    '        <?php }  ?>',
    '        <?php if (!empty($labGuid)) { ?>',
    '                            <input type="text" class="form-control" value="<?php echo attr($labGuid); ?>" readonly/>',
    '                <button type="submit" name="SubmitButton" class="btn btn-primary btn-save">',
    '                    <?php echo xlt("Create Lab Route") ?>',
    '                <button type="button" class="btn btn-secondary btn-cancel ml-2" onclick="window.close();">',
    '                    <?php echo xlt("Cancel") ?>',
    '                <?php if (!empty($message)) { ?>',
    '                    <div class="alert alert-info mt-3">',
    '                        <?php echo text($message); ?>',
    '        <script>',
    "            document.querySelector('form').addEventListener('submit', function(e) {",
    "                const requiredFields = document.querySelectorAll('input[required], select[required]');",
    '                    if (!field.value.trim()) {',
    "                        field.classList.add('is-invalid');",
    "                        field.classList.remove('is-invalid');",
    '                    e.preventDefault();',
    '                    alert(<?php echo xlj("Please fill in all required fields") ?>);',
    '        </script>',
    '</body>',
    '</html>',
];

// Absolute pins on the frozen original's form controls and layout.
const FIXTURE_PINS = [
    ['required/>', 6],
    [' required>', 2],
    ['class="required-field"', 8],
    ['class="form-section"', 4],
    ['.form-section', 2],
    ['class="form-control"', 8],
    ['class="form-group"', 9],
    ['class="col-md-6"', 8],
    ['class="row"', 7],
    ['<small class="form-text text-muted">', 9],
    ['<label', 9],
    ['<input', 10],
    ['<input type="hidden"', 2],
    ['type="checkbox"', 1],
    ['checked', 1],
    ['readonly', 1],
    ['<select', 1],
    ['<option', 2],
    ['<button', 2],
    ['<?php if (', 3],
    ['<form ', 1],
    ['</form>', 0],
    ['<script>', 1],
    ['<style', 1],
    ['</style>', 1],
    ['<body', 1],
    ['<link', 0],
    ['h5', 1],
    ['oe-workbench', 0],
    [MARKER, 0],
    ['media=', 0],
];

// Tokens whose counts must be identical in the original and the candidate:
// the presentation adds no control, wrapper, escaping, request or asset.
const INVENTORY = [
    '<input', 'required', 'readonly', 'checked', 'form-control', 'form-group', 'form-check',
    'class="row"', 'col-md-', 'col-sm-', 'required-field', 'container-fluid', '<button', '<div',
    '</div>', '<form', '<label', '<span', '<small', '<select', '<option', '<strong', '<h2',
    '<script', '</script>', '<link', 'name=', 'id=', 'value=', 'action=', 'method=', 'onclick=',
    'CsrfUtils::', 'ConnectorApi::', 'LabRouteSetup::', 'AddressBookAddEdit::', 'DisplayHelper::',
    'AclMain::', 'Header::', '$_POST', '$_REQUEST', '$_GET', 'sqlQuery', 'sqlStatement',
    'QueryUtils', 'xlt(', 'xl(', 'xla(', 'xlj(', 'attr(', 'attr_url(', 'attr_js(', 'text(',
    'js_url(', 'is-invalid', 'alert', 'preventDefault', 'querySelector', 'addEventListener',
    'window.close', '<?php', '?>',
];

// The real caller: lab_setup.php createRouteClickEdit opens the route in an
// 800x750 auto-height, resizable, non-draggable dlgopen, after the lab EULA
// notice only when the lab requires one.
const CALLER_OPEN = [
    '    function createRouteClickEdit(labGuid, labName = \'\', isEulaRequired = false) {',
    '        // dialog open calls restoreSession()',
    '        let addTitle = \'<i class="fa fa-plus" style="width:20px;" aria-hidden="true"></i> \' + <?php echo xlj("Create Route"); ?>;',
    "        let scriptTitle = 'route_edit.php?labGuid=' + encodeURIComponent(labGuid) + '&isEula=' + encodeURIComponent(isEulaRequired) + '&csrf_token_form=' + <?php echo js_url(CsrfUtils::collectCsrfToken(session: $session)); ?>;",
    '        // Call the doEULA function then continue with route dialog open if accepted.',
    '        if (isEulaRequired) {',
    '            doLabEULA(labName).then((result) => {',
    "                if (result === 'accepted') {",
    "                    dlgopen(scriptTitle, '_blank', 800, 750, false, addTitle, {",
    "                            sizeHeight: 'auto',",
    '                            allowResize: true,',
    '                            allowDrag: false,',
    '                    });',
    '                }',
    '            }).catch(error => {',
    '                console.log("Error in EULA dialog:", error);',
    '            });',
    '        } else {',
    "            dlgopen(scriptTitle, '_blank', 800, 750, false, addTitle, {",
    "                sizeHeight: 'auto',",
    '                allowResize: true,',
    '                allowDrag: false,',
    '            });',
    '        }',
    '    }',
    '',
].join('\n');

const SECTION_ANCHOR = '        border-color: var(--oe-wb-line);\n      }\n';
const BODY_INK = '        color: var(--oe-wb-ink);\n        background-color: var(--oe-wb-canvas);\n';
const SECTION_INK = '        color: var(--oe-wb-ink);\n        background-color: var(--oe-wb-paper);\n';
const SECTION_ADD = (rule) => [SECTION_ANCHOR, SECTION_ANCHOR + rule];

/**
 * Unapproved edits applied to the synthetic approved candidate. Each search
 * string must occur exactly once in the candidate. Replacements are short;
 * no mutant duplicates the fixture.
 */
const MUTANTS = [
    // Presentation block placement and shape.
    ['style block missing', STYLE_BLOCK, ''],
    ['body marker missing', BODY_APPROVED, BODY_ORIGINAL],
    ['body classes reordered', 'class="container-fluid oe-dorn-route-popup"', 'class="oe-dorn-route-popup container-fluid"'],
    ['body container-fluid class dropped', BODY_APPROVED, '<body class="oe-dorn-route-popup">\n'],
    ['body class doubled space', 'container-fluid oe-dorn-route-popup', 'container-fluid  oe-dorn-route-popup'],
    ['block relocated after </head>', STYLE_BLOCK + HEAD_CLOSE, HEAD_CLOSE + STYLE_BLOCK],
    ['block relocated before original style', ORIGINAL_STYLE + STYLE_BLOCK, STYLE_BLOCK + ORIGINAL_STYLE],
    ['block copied into body', BODY_APPROVED, BODY_APPROVED + STYLE_BLOCK],
    ['block duplicated', STYLE_BLOCK, STYLE_BLOCK + STYLE_BLOCK],
    ['rules merged into original style', '      }\n    </style>\n    <style media="screen">\n', '      }\n\n'],
    ['blank line between rules removed', '      }\n\n      html', '      }\n      html'],
    ['declaration indentation changed', '        background-color: var(--oe-wb-canvas);\n', '      background-color: var(--oe-wb-canvas);\n'],
    ['closing brace dropped', SECTION_ANCHOR, '        border-color: var(--oe-wb-line);\n'],
    ['css comment added', '    <style media="screen">\n', '    <style media="screen">\n      /* sheets */\n'],
    ['type attribute added', '<style media="screen">', '<style media="screen" type="text/css">'],
    ['media widened to all', '<style media="screen">', '<style media="all">'],
    ['media removed', '<style media="screen">', '<style>'],
    ['media switched to print', '<style media="screen">', '<style media="print">'],
    ['media query narrowed', '<style media="screen">', '<style media="screen and (min-width: 600px)">'],
    ['print media rule added', ...SECTION_ADD('      @media print { body.oe-dorn-route-popup { background: none; } }\n')],
    // Declarations and tokens.
    ['body ink removed', BODY_INK, '        background-color: var(--oe-wb-canvas);\n'],
    ['section ink removed', SECTION_INK, '        background-color: var(--oe-wb-paper);\n'],
    ['body ink swapped for muted', BODY_INK, '        color: var(--oe-wb-muted);\n        background-color: var(--oe-wb-canvas);\n'],
    ['body declaration order swapped', BODY_INK, '        background-color: var(--oe-wb-canvas);\n        color: var(--oe-wb-ink);\n'],
    ['section declaration order swapped', SECTION_INK, '        background-color: var(--oe-wb-paper);\n        color: var(--oe-wb-ink);\n'],
    ['canvas token swapped for paper', 'var(--oe-wb-canvas)', 'var(--oe-wb-paper)'],
    ['paper token swapped for canvas', 'var(--oe-wb-paper)', 'var(--oe-wb-canvas)'],
    ['line token swapped for petrol', 'var(--oe-wb-line)', 'var(--oe-wb-petrol)'],
    ['fallback added to token', 'var(--oe-wb-canvas)', 'var(--oe-wb-canvas, #f3f7f5)'],
    ['literal colour replaces token', 'var(--oe-wb-paper)', '#fff'],
    ['section edge colour removed', '        border-color: var(--oe-wb-line);\n', ''],
    ['edge colour widened to border shorthand', 'border-color: var(--oe-wb-line);', 'border: 1px solid var(--oe-wb-line);'],
    ['edge colour widened to all borders incl. width', 'border-color: var(--oe-wb-line);', 'border-color: var(--oe-wb-line);\n        border-width: 2px;'],
    ['edge style changed', 'border-color: var(--oe-wb-line);', 'border-color: var(--oe-wb-line);\n        border-style: dashed;'],
    ['important added', 'var(--oe-wb-line);', 'var(--oe-wb-line) !important;'],
    ['padding added to section', SECTION_INK, SECTION_INK + '        padding: 0;\n'],
    ['margin added to section', SECTION_INK, SECTION_INK + '        margin-bottom: 0;\n'],
    ['radius added to section', SECTION_INK, SECTION_INK + '        border-radius: 8px;\n'],
    ['shadow added to section', SECTION_INK, SECTION_INK + '        box-shadow: 0 1px 2px var(--oe-wb-line);\n'],
    ['font added to body', BODY_INK, BODY_INK + '        font-family: Arial, sans-serif;\n'],
    ['margin added to body', BODY_INK, BODY_INK + '        margin: 0;\n'],
    ['width added to body', BODY_INK, BODY_INK + '        max-width: 48rem;\n'],
    ['display added to section', SECTION_INK, SECTION_INK + '        display: grid;\n'],
    ['focus rule added', ...SECTION_ADD('      html.oe-workbench-context body.oe-dorn-route-popup .form-control:focus {\n        outline: 2px solid var(--oe-wb-petrol);\n      }\n')],
    ['control rule added', ...SECTION_ADD('      html.oe-workbench-context body.oe-dorn-route-popup .form-control {\n        border-color: var(--oe-wb-line);\n      }\n')],
    ['required rule added', ...SECTION_ADD('      html.oe-workbench-context body.oe-dorn-route-popup .required-field {\n        color: var(--oe-wb-ink);\n      }\n')],
    ['validation rule added', ...SECTION_ADD('      html.oe-workbench-context body.oe-dorn-route-popup .is-invalid {\n        border-color: var(--oe-wb-line);\n      }\n')],
    ['heading rule added', ...SECTION_ADD('      html.oe-workbench-context body.oe-dorn-route-popup h2 {\n        color: var(--oe-wb-ink);\n      }\n')],
    ['checkbox rule added', ...SECTION_ADD('      html.oe-workbench-context body.oe-dorn-route-popup .form-check-input {\n        accent-color: var(--oe-wb-petrol);\n      }\n')],
    ['alert rule added', ...SECTION_ADD('      html.oe-workbench-context body.oe-dorn-route-popup .alert-info {\n        color: var(--oe-wb-ink);\n      }\n')],
    ['button rule added', ...SECTION_ADD('      html.oe-workbench-context body.oe-dorn-route-popup .btn-cancel {\n        color: var(--oe-wb-ink);\n      }\n')],
    // Selectors.
    ['body gate dropped', 'html.oe-workbench-context body.oe-dorn-route-popup {', 'body.oe-dorn-route-popup {'],
    ['section gate dropped', 'html.oe-workbench-context body.oe-dorn-route-popup > form', 'body.oe-dorn-route-popup > form'],
    ['section gate switched to popup class', 'html.oe-workbench-context body.oe-dorn-route-popup > ', 'html.oe-workbench-popup body.oe-dorn-route-popup > '],
    ['section widened to any descendant', 'body.oe-dorn-route-popup > form > .form-section {', 'body.oe-dorn-route-popup .form-section {'],
    ['section moved to form', '> form > .form-section {', '> form {'],
    ['section narrowed by type', '> form > .form-section {', '> form > div.form-section {'],
    ['section extended to rows', '> form > .form-section {', '> form > .form-section .row {'],
    ['descendant combinator replaces child', 'body.oe-dorn-route-popup > form > .form-section', 'body.oe-dorn-route-popup form .form-section'],
    ['selector list widened', 'body.oe-dorn-route-popup {', 'body.oe-dorn-route-popup, html.oe-workbench-context .modal {'],
    ['body selector compounded with container', 'body.oe-dorn-route-popup {', 'body.oe-dorn-route-popup.container-fluid {'],
    // Body marker variants and wrappers.
    ['body attribute added', '<body class="container-fluid oe-dorn-route-popup">', '<body class="container-fluid oe-dorn-route-popup" dir="rtl">'],
    ['body class single-quoted', '<body class="container-fluid oe-dorn-route-popup">', "<body class='container-fluid oe-dorn-route-popup'>"],
    ['marker copied onto html', '<html>', '<html class="oe-dorn-route-popup">'],
    ['marker copied onto form', "    <form method='post'", "    <form class=\"oe-dorn-route-popup\" method='post'"],
    ['marker copied onto a section', '<!-- Customer Account Information Section -->\n        <div class="form-section">', '<!-- Customer Account Information Section -->\n        <div class="form-section oe-dorn-route-popup">'],
    ['section class extended', '<!-- Customer Account Information Section -->\n        <div class="form-section">', '<!-- Customer Account Information Section -->\n        <div class="form-section card">'],
    ['wrapper added around form', BODY_APPROVED, BODY_APPROVED + '    <div class="oe-sheet">\n'],
    ['lab guid column narrowed', '<div class="col-md-12">', '<div class="col-md-6">'],
    // Original style block: required red, section edge, geometry and heading.
    ['required red changed', 'color: red;', 'color: var(--oe-wb-ink);'],
    ['required rule removed', '      .required-field {\n        color: red;\n      }\n', ''],
    ['section edge replaced in original rule', 'border: 1px solid #ddd;', 'border: 1px solid var(--oe-wb-line);'],
    ['section edge width changed', 'border: 1px solid #ddd;', 'border: 2px solid #ddd;'],
    ['section edge style changed', 'border: 1px solid #ddd;', 'border: 1px dashed #ddd;'],
    ['section padding changed', '        padding: 15px;\n', '        padding: 1rem;\n'],
    ['section margin changed', 'margin-bottom: 20px;', 'margin-bottom: 24px;'],
    ['section radius changed', 'border-radius: 5px;', 'border-radius: 8px;'],
    ['heading colour changed', 'color: #333;', 'color: #17343b;'],
    ['heading rule border removed', '        border-bottom: 1px solid #eee;\n', ''],
    ['heading spacing changed', 'padding-bottom: 10px;', 'padding-bottom: 8px;'],
    ['heading top margin changed', 'margin-top: 0;', 'margin-top: 4px;'],
    // Assets and scripts.
    ['stylesheet link added', STYLE_BLOCK, STYLE_BLOCK + '    <link rel="stylesheet" href="sheet.css">\n'],
    ['head script added', STYLE_BLOCK, STYLE_BLOCK + '    <script src="sheet.js"></script>\n'],
    ['body script added', BODY_APPROVED, BODY_APPROVED + '    <script>document.body.focus();</script>\n'],
    ['header asset added', "Header::setupHeader(['opener'])", "Header::setupHeader(['opener', 'workbench-reminder-popup'])"],
    ['header popup asset excluded', "Header::setupHeader(['opener'])", "Header::setupHeader(['opener', 'no_workbench-popup'])"],
    ['header opener dropped', "Header::setupHeader(['opener'])", 'Header::setupHeader()'],
    ['title changed', 'xlt("Edit or Add Procedure Provider")', 'xlt("Create DORN Route")'],
    // Bootstrap, ACL and CSRF.
    ['bootstrap depth changed', '"/../../../../globals.php"', '"/../../../globals.php"'],
    ['acl permission changed', "aclCheckCore('admin', 'users')", "aclCheckCore('admin', 'practice')"],
    ['acl check inverted', 'if (!AclMain::', 'if (AclMain::'],
    ['acl deny replaced', 'AccessDeniedHelper::denyWithTemplate("ACL check failed for admin/users: Edit/Add Procedure Provider", xl("Edit/Add Procedure Provider"));', 'die(xlt("Denied"));'],
    ['session line removed', '$session = SessionWrapperFactory::getInstance()->getActiveSession();\n', ''],
    ['csrf gate narrowed to post', 'if (!empty($_REQUEST)) {', 'if (!empty($_POST)) {'],
    ['csrf source changed', '$_REQUEST["csrf_token_form"]', '$_GET["csrf_token_form"]'],
    ['csrf failure no longer stops', '        CsrfUtils::csrfNotVerified();\n', ''],
    ['csrf check removed', '    if (!CsrfUtils::verifyCsrfToken($_REQUEST["csrf_token_form"], session: $session)) {\n        CsrfUtils::csrfNotVerified();\n    }\n', ''],
    // Connector, record writes and request inputs.
    ['post branch disabled', 'if (!empty($_POST)) {', 'if (false) {'],
    ['create route payload changed', 'ConnectorApi::createRoute($routeData)', 'ConnectorApi::createRoute(CreateRouteFromPrimaryViewModel::loadByPost($_REQUEST))'],
    ['create route spacing normalized', '$apiResponse =  ConnectorApi::createRoute', '$apiResponse = ConnectorApi::createRoute'],
    ['post model source changed', 'loadByPost($_POST)', 'loadByPost($_REQUEST)'],
    ['success check inverted', 'if ($apiResponse->isSuccess) {', 'if (!$apiResponse->isSuccess) {'],
    ['lab lookup source changed', 'ConnectorApi::getLab($routeData->labGuid)', 'ConnectorApi::getLab($labGuid)'],
    ['provider id seed removed', '        $ppid = 0;\n', ''],
    ['route setup arguments swapped', 'getRouteSetup($apiResponse->labGuid, $apiResponse->routeGuid)', 'getRouteSetup($apiResponse->routeGuid, $apiResponse->labGuid)'],
    ['address book write removed', '        $uid = AddressBookAddEdit::createOrUpdateRecordInAddressBook(', '        $uid = 0 && AddressBookAddEdit::createOrUpdateRecordInAddressBook('],
    ['procedure provider guid source changed', '$routeData->npi, $labData->labGuid, $uid', '$routeData->npi, $routeData->labGuid, $uid'],
    ['dorn route line break changed', '$labData->textLineBreakCharacter', '"\\n"'],
    ['setup message changed', '"Lab has been setup"', '"Route created"'],
    ['vendor message no longer surfaced', '            $message = $apiResponse->responseMessage;\n', ''],
    ['fallback error changed', '"Error creating route, no information came back though"', '"Error creating route"'],
    ['sql added', '$message = "";\n', '$message = "";\nsqlQuery("SELECT 1");\n'],
    ['lab guid source changed', "$labGuid = $_REQUEST['labGuid'];", "$labGuid = $_GET['labGuid'] ?? '';"],
    ['eula flag source changed', "($_GET['isEula'] ?? false)", "($_REQUEST['isEula'] ?? false)"],
    ['eula flag comparison tightened', "== 'true';", "=== 'true';"],
    ['unconditional vendor lookup removed', "$primaryInfos = ConnectorApi::getPrimaryInfos('');", '$primaryInfos = [];'],
    ['unconditional vendor lookup argument changed', "getPrimaryInfos('')", 'getPrimaryInfos($labGuid)'],
    // Escaping and messages.
    ['message unescaped', 'text($message)', '$message'],
    ['action guid escaping changed', 'attr_url($labGuid)', 'attr($labGuid)'],
    ['hidden guid escaping changed', 'name="form_labGuid" value="<?php echo attr($labGuid); ?>"', 'name="form_labGuid" value="<?php echo text($labGuid); ?>"'],
    ['provider value escaping changed', "value='<?php echo attr($pInfo->npi) ?>'", "value='<?php echo text($pInfo->npi) ?>'"],
    ['provider label unescaped', 'text($pInfo->primaryName)', '$pInfo->primaryName'],
    ['posted value unescaped', "attr($_POST['form_clientSiteId'])", "$_POST['form_clientSiteId']"],
    ['provider selection helper bypassed', "DisplayHelper::SelectOption($_POST['form_primaries'] ?? '', $pInfo->npi ?? '')", "''"],
    ['heading translation changed', 'xlt("DORN Lab Route Configuration")', 'xl("DORN Lab Route Configuration")'],
    ['message alert class changed', 'alert alert-info mt-3', 'alert alert-success mt-3'],
    ['message condition changed', '<?php if (!empty($message)) { ?>', '<?php if ($message) { ?>'],
    // Form action and hidden tokens.
    ['action target changed', 'action="route_edit.php?labGuid=', 'action="lab_setup.php?labGuid='],
    ['action csrf removed', '&csrf_token_form=<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>">', '">'],
    ['hidden token removed', '                <input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />\n', ''],
    ['hidden token renamed', 'name="csrf_token_form"', 'name="csrf_token"'],
    ['hidden lab guid removed', '                <input type="hidden" name="form_labGuid" value="<?php echo attr($labGuid); ?>" />\n', ''],
    ['form method changed', "method='post'", "method='get'"],
    ['form name changed', "name='theform'", "name='route'"],
    ['novalidate added', "<form method='post'", "<form novalidate method='post'"],
    // Field attributes, options and defaults.
    ['customer input id mismatch silently fixed', 'id="form_customerAccountNumber"', 'id="form_customerAcctNumber"'],
    ['customer label target silently fixed', 'for="form_customerAcctNumber"', 'for="form_customerAccountNumber"'],
    ['customer required marker removed', 'Customer Account Number") ?> <span class="required-field">*</span>', 'Customer Account Number") ?>'],
    ['client site required removed', "attr($_POST['form_clientSiteId']) : '' ?>\"\n                            required/>", "attr($_POST['form_clientSiteId']) : '' ?>\"\n                            />"],
    ['provider select required removed', 'class="form-control" required>', 'class="form-control">'],
    ['provider placeholder value changed', '<option value=""><?php echo xlt("-- Select Provider --") ?></option>', '<option value="0"><?php echo xlt("-- Select Provider --") ?></option>'],
    ['lab account input type changed', 'type="text" class="form-control" id="form_labAcctNumber"', 'type="number" class="form-control" id="form_labAcctNumber"'],
    ['lab account help removed', '<small class="form-text text-muted"><?php echo xlt("Your account number with the laboratory") ?></small>', ''],
    ['eula section made unconditional', '<?php if ($isEula) { ?>', '<?php if (true) { ?>'],
    ['eula version default changed', "'2024-08-28'", "'2025-01-01'"],
    ['eula accepter field renamed', 'name="form_eulaAccepterFullName"', 'name="form_eulaAccepter"'],
    ['eula timestamp default changed', "date('Y-m-d\\TH:i:s.v\\Z')", "gmdate('Y-m-d\\TH:i:s.v\\Z')"],
    ['eula prechecked consent silently cleared', 'type="checkbox" checked id="form_eulaAcceptance"', 'type="checkbox" id="form_eulaAcceptance"'],
    ['eula checkbox required removed', 'name="form_eulaAcceptance" required>', 'name="form_eulaAcceptance">'],
    ['eula checkbox marker removed', 'End User License Agreement") ?> <span class="required-field">*</span>', 'End User License Agreement") ?>'],
    ['lab guid section condition changed', '<?php if (!empty($labGuid)) { ?>', '<?php if ($labGuid) { ?>'],
    ['lab guid readonly became disabled', 'value="<?php echo attr($labGuid); ?>" readonly/>', 'value="<?php echo attr($labGuid); ?>" disabled/>'],
    // Save and Cancel.
    ['save became plain button', 'type="submit" name="SubmitButton"', 'type="button" name="SubmitButton"'],
    ['save class changed', 'btn btn-primary btn-save', 'btn btn-primary'],
    ['save label changed', 'xlt("Create Lab Route")', 'xlt("Save")'],
    ['cancel action changed', 'onclick="window.close();"', 'onclick="dlgclose();"'],
    ['cancel became submit', 'type="button" class="btn btn-secondary btn-cancel ml-2"', 'type="submit" class="btn btn-secondary btn-cancel ml-2"'],
    ['cancel spacing changed', 'btn-cancel ml-2', 'btn-cancel'],
    // Validation script.
    ['validation select scope dropped', 'input[required], select[required]', 'input[required]'],
    ['invalid class no longer added', "                        field.classList.add('is-invalid');\n", ''],
    ['invalid class no longer cleared', "                        field.classList.remove('is-invalid');\n", ''],
    ['submit no longer prevented', '                    e.preventDefault();\n', ''],
    ['trim removed', '!field.value.trim()', '!field.value'],
    ['form selector changed', "document.querySelector('form')", "document.querySelector('form[name=theform]')"],
    ['validation event changed', "addEventListener('submit'", "addEventListener('click'"],
    ['validation alert escaping changed', 'xlj("Please fill in all required fields")', 'xlt("Please fill in all required fields")'],
    // Arbitrary bytes.
    ['trailing newline added', '</html>\n', '</html>\n\n'],
    ['byte order mark added', '<?php\n\n/**', '﻿<?php\n\n/**'],
    ['crlf line ending introduced', '<!DOCTYPE html>\n', '<!DOCTYPE html>\r\n'],
    ['tab indentation introduced', "    <form method='post'", "\t<form method='post'"],
    ['trailing space after head', HEAD_CLOSE, '</head> \n'],
    ['zero-width character in marker', 'oe-dorn-route-popup">', 'oe-dorn-route-popup​">'],
    ['eula close spacing normalized', '<?php }  ?>', '<?php } ?>'],
    ['author header removed', ' * @author    Jerry Padgett <sjpadgett@gmail.com>\n', ''],
];

function count(haystack, needle) {
    if (needle === '') {
        throw new Error('count() needs a non-empty needle');
    }
    return haystack.split(needle).length - 1;
}

function replaceOnce(haystack, search, replacement) {
    if (count(haystack, search) !== 1) {
        throw new Error('replaceOnce() anchor is not unique: ' + JSON.stringify(search));
    }
    return haystack.split(search).join(replacement);
}

function read(relative) {
    return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function firstDifference(actual, expected) {
    const a = actual.split('\n');
    const e = expected.split('\n');
    for (let i = 0; i < Math.max(a.length, e.length); i++) {
        if (a[i] !== e[i]) {
            return 'line ' + (i + 1) + ': expected ' + JSON.stringify(e[i]) + ', got ' + JSON.stringify(a[i]);
        }
    }
    return 'no line difference';
}

function assertSameSource(actual, expected, label) {
    assert(typeof actual === 'string', label + ' is not a source string');
    assert(actual === expected, label + ' differs (' + firstDifference(actual, expected) + ')');
}

/** Build the exact approved future route from the frozen original. */
function applyPresentation(original) {
    return replaceOnce(original, ORIGINAL_SEAM, APPROVED_SEAM);
}

/**
 * Strict inverse: remove exactly the declared additions once, as one seam.
 * Returns null for any missing, relocated, duplicated or malformed block, or
 * for any residue of the presentation left behind.
 */
function restorePresentation(candidate) {
    if (count(candidate, APPROVED_SEAM) !== 1 || count(candidate, STYLE_BLOCK) !== 1) {
        return null;
    }
    const restored = candidate.split(APPROVED_SEAM).join(ORIGINAL_SEAM);
    if (restored.includes(MARKER) || restored.includes('media=') || restored.includes('oe-workbench')) {
        return null;
    }
    if (count(restored, '<style') !== 1 || count(restored, '</style>') !== 1 || count(restored, BODY_ORIGINAL) !== 1) {
        return null;
    }
    return restored;
}

/**
 * Shared normalizer: identity when no trace of the presentation exists,
 * otherwise the strict inverse.
 */
function normalizeShared(source) {
    const traced = source.includes(MARKER)
        || source.includes('media=')
        || source.includes('oe-workbench')
        || count(source, '<style') !== 1
        || count(source, '</style>') !== 1;
    return traced ? restorePresentation(source) : source;
}

/**
 * Production acceptance. The full restored route must equal the frozen
 * original byte for byte, and the candidate must be exactly the approved
 * presentation of it.
 */
function accepts(candidate, fixture) {
    const restored = restorePresentation(candidate);
    return restored !== null
        && restored === fixture
        && normalizeShared(candidate) === fixture
        && candidate === applyPresentation(fixture);
}

function parseRules(block) {
    const body = block.replace(/^ {4}<style media="screen">\n/, '').replace(/ {4}<\/style>\n$/, '');
    const rules = [];
    const pattern = /^ {6}([^\n{}]+) \{\n((?: {8}[^\n]+\n)+) {6}\}\n/gm;
    let match;
    while ((match = pattern.exec(body)) !== null) {
        rules.push({
            selector: match[1],
            declarations: match[2].split('\n').filter(Boolean).map((line) => line.trim()),
        });
    }
    return { rules, leftover: body.replace(pattern, '') };
}

function portableChecks() {
    const fixture = () => read(FIXTURE);
    const live = () => read(ROUTE);
    const candidate = () => applyPresentation(fixture());

    const checks = [
        ['frozen original keeps every security, connector, write, field, EULA and validation line in order', () => {
            const lines = fixture().split('\n');
            let cursor = -1;
            for (const expected of PRESERVED_LINES) {
                assert(lines.filter((line) => line === expected).length === 1, 'original line not unique: ' + JSON.stringify(expected));
                const at = lines.indexOf(expected);
                assert(at > cursor, 'original line out of order: ' + JSON.stringify(expected));
                cursor = at;
            }
            const source = fixture();
            const html = source.indexOf('<!DOCTYPE html>');
            const backend = [
                "AclMain::aclCheckCore('admin', 'users')",
                'CsrfUtils::verifyCsrfToken(',
                'ConnectorApi::createRoute(',
                'ConnectorApi::getLab(',
                'AddressBookAddEdit::createOrUpdateRecordInAddressBook(',
                'LabRouteSetup::createUpdateProcedureProviders(',
                'LabRouteSetup::createDornRoute(',
                'ConnectorApi::getPrimaryInfos(',
            ];
            let previous = -1;
            for (const step of backend) {
                const at = source.indexOf(step);
                assert(count(source, step) === 1, 'backend step must appear once: ' + step);
                assert(at > previous && at < html, 'backend step out of order or after the document: ' + step);
                previous = at;
            }
            assert(source.endsWith('</body>\n</html>\n'), 'original must end with </body></html> and one newline');
            assert(!source.includes('\r') && !source.includes('\t') && !source.startsWith('﻿'), 'original must be LF, space-indented and BOM-free');
        }],
        ['frozen original pins its controls, layout and single original style block', () => {
            for (const [token, expected] of FIXTURE_PINS) {
                assert(count(fixture(), token) === expected, 'original count of ' + JSON.stringify(token) + ' is ' + count(fixture(), token) + ', expected ' + expected);
            }
            assert(count(fixture(), ORIGINAL_STYLE) === 1, 'original style block changed');
            assert(count(fixture(), ORIGINAL_STYLE + HEAD_CLOSE + BODY_ORIGINAL) === 1, 'original style must sit directly before </head><body class="container-fluid">');
            assert(count(fixture(), ORIGINAL_SEAM) === 1, 'original </style></head><body> seam missing');
        }],
        ['approved block has exactly two screen-only workbench-gated rules', () => {
            assert(count(STYLE_BLOCK, '<style media="screen">') === 1, 'block must open with one screen-only style tag');
            assert(count(STYLE_BLOCK, '      }\n\n      html') === 1, 'rules must be separated by one blank line');
            const { rules, leftover } = parseRules(STYLE_BLOCK);
            assert(leftover === '\n', 'unexpected text between rules: ' + JSON.stringify(leftover));
            assert(JSON.stringify(rules) === JSON.stringify(APPROVED_RULES), 'rules differ from the approved selectors/declarations');
            assert(count(STYLE_BLOCK, 'border') === 1 && count(STYLE_BLOCK, 'border-color: var(--oe-wb-line);') === 1, 'the only border declaration must be the neutral section edge colour');
            for (const forbidden of ['padding', 'margin', 'font', 'width', 'height', 'radius', 'style:', 'shadow', 'outline', 'display', 'position', 'flex', 'grid', 'focus', 'required', 'invalid', 'check', 'readonly', 'disabled', 'print', '@media', '!important', 'url(', '@import', '/*', '.row', '.col', '.form-control', '.form-group', '.alert', '.btn', 'h2', 'h5', 'label', 'input', 'select', 'button', '#', 'muted', 'petrol']) {
                assert(!STYLE_BLOCK.includes(forbidden), 'approved block must not contain ' + forbidden);
            }
        }],
        ['every approved token exists in workbench popup.css and popup.css autoloads', () => {
            const css = read(POPUP_CSS);
            const scope = css.indexOf('html.oe-workbench-context,\n  body.workbench-active > .dialogModal {');
            assert(css.indexOf('@media screen {') === css.indexOf('@media screen'), 'popup.css must keep its single screen media wrapper');
            assert(scope > css.indexOf('@media screen {'), 'workbench token scope missing from popup.css');
            const tokens = css.slice(scope, css.indexOf('}', scope));
            for (const token of TOKENS) {
                assert(count(tokens, '    ' + token + ': ') === 1, 'popup.css does not define ' + token + ' in the workbench scope');
                assert(STYLE_BLOCK.includes('var(' + token + ')'), 'approved block does not use ' + token);
            }
            const config = read(ASSET_CONFIG);
            const asset = "  workbench-popup:\n    basePath: '%webroot%/interface/clinical-workspace/'\n    script: popup.js\n    link: popup.css\n    autoload: true\n";
            assert(count(config, asset) === 1, 'workbench-popup must stay an autoloaded asset so setupHeader([\'opener\']) loads the tokens');
        }],
        ['untouched original normalizes to itself in the shared verifier', () => {
            assertSameSource(normalizeShared(fixture()), fixture(), 'shared normalization of the untouched original');
            assert(restorePresentation(fixture()) === null, 'strict inverse must reject a route without the presentation');
            assert(!accepts(fixture(), fixture()), 'untouched original must not satisfy production acceptance');
        }],
        ['synthetic fully adapted candidate passes production acceptance', () => {
            assert(candidate() !== fixture(), 'candidate must differ from the original');
            assert(accepts(candidate(), fixture()), 'candidate must satisfy production acceptance');
        }],
        ['synthetic candidate restores byte-for-byte to the frozen original', () => {
            assertSameSource(restorePresentation(candidate()), fixture(), 'strict inverse of the candidate');
            assertSameSource(normalizeShared(candidate()), fixture(), 'shared normalization of the candidate');
        }],
        ['synthetic candidate differs only by the declared block and body class', () => {
            const original = fixture();
            const at = original.indexOf(ORIGINAL_SEAM);
            const expected = original.slice(0, at) + STYLE_CLOSE + STYLE_BLOCK + HEAD_CLOSE + BODY_APPROVED + original.slice(at + ORIGINAL_SEAM.length);
            assertSameSource(candidate(), expected, 'candidate');
            assert(candidate().length - original.length === STYLE_BLOCK.length + BODY_APPROVED.length - BODY_ORIGINAL.length, 'candidate added unexpected bytes');
            assert(count(candidate(), ORIGINAL_STYLE + STYLE_BLOCK + HEAD_CLOSE) === 1, 'second block must follow the untouched original block and end directly before </head>');
            assert(count(candidate(), BODY_APPROVED) === 1 && count(candidate(), MARKER) === 3, 'marker must be on the body (once) and in the two selectors only');
            assert(count(candidate(), "    <?php Header::setupHeader(['opener']);?>\n") === 1, 'Header opener changed');
            for (const token of INVENTORY) {
                assert(count(candidate(), token) === count(original, token), 'candidate changed the count of ' + JSON.stringify(token));
            }
        }],
        ['live route normalizes to the frozen original in the shared verifier', () => {
            assertSameSource(normalizeShared(live()), fixture(), 'shared normalization of ' + ROUTE);
        }],
        ['live route equals the approved presentation candidate', () => {
            assert(accepts(candidate(), fixture()), 'synthetic candidate must be accepted before checking the live route');
            assertSameSource(live(), candidate(), ROUTE);
        }],
        ['live route passes production acceptance (restores byte-for-byte to the frozen original)', () => {
            const restored = restorePresentation(live());
            assert(restored !== null, 'live route does not carry exactly one approved presentation seam');
            assertSameSource(restored, fixture(), 'restored live route');
            assert(accepts(live(), fixture()), 'live route fails production acceptance');
        }],
        ['caller keeps the 800x750 auto-height resizable opens behind the conditional EULA', () => {
            const caller = read(CALLER);
            assert(count(caller, CALLER_OPEN) === 1, 'createRouteClickEdit block changed');
            assert(count(caller, 'route_edit.php') === 1, 'caller must reach route_edit.php exactly once');
            assert(count(caller, "dlgopen(scriptTitle, '_blank', 800, 750, false, addTitle, {") === 2, 'both route opens must stay 800x750');
            assert(count(caller, 'attr_js($data->isEulaRequired)') === 1, 'EULA flag must still come from the lab search result');
            assert(count(caller, "    <?php Header::setupHeader(); ?>\n") === 1, 'caller Header changed');
        }],
    ];

    for (const [label, search, replacement] of MUTANTS) {
        checks.push(['mutant rejected: ' + label, () => checkMutant(candidate(), fixture(), search, replacement)]);
    }

    return checks;
}

function checkMutant(candidate, fixture, search, replacement) {
    // Preconditions, outside the expected-failure assertion.
    assert(accepts(candidate, fixture), 'baseline candidate must be accepted before mutation');
    assert(count(candidate, search) === 1, 'mutant anchor must be unique: ' + JSON.stringify(search));
    const edited = replaceOnce(candidate, search, replacement);
    assert(edited !== candidate, 'mutant must actually change the candidate');
    // Expected failure.
    assert(!accepts(edited, fixture), 'mutant was accepted');
    const normalized = normalizeShared(edited);
    assert(normalized === null || normalized !== fixture, 'mutant restores to the frozen original in the shared verifier');
}

function git(args) {
    // Required lazily: portable checks never spawn a process.
    const childProcess = require('node:child_process');
    const result = childProcess.spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (result.error) {
        throw new Error('git ' + args.join(' ') + ' could not run: ' + result.error.message);
    }
    if (result.status !== 0) {
        throw new Error('git ' + args.join(' ') + ' failed: ' + result.stderr.trim());
    }
    return result.stdout;
}

function baseBlob(file) {
    return git(['show', BASE_SHA + ':' + file]);
}

function changedSinceBase(paths) {
    const changed = git(['diff', '--name-only', BASE_SHA, '--', ...paths]).split('\n').filter(Boolean);
    const untracked = git(['ls-files', '--others', '--exclude-standard', '--', ...paths]).split('\n').filter(Boolean);
    return [...new Set(changed.concat(untracked))];
}

function historyChecks() {
    return [
        ['history: base commit resolves to the exact verified SHA', () => {
            const resolved = git(['rev-parse', '--verify', BASE_SHA + '^{commit}']).trim();
            assert(resolved === BASE_SHA, 'base resolved to ' + resolved);
        }],
        ['history: frozen original equals the base route', () => {
            assertSameSource(read(FIXTURE), baseBlob(ROUTE), FIXTURE);
        }],
        ['history: complete restored live route equals the base route', () => {
            const restored = restorePresentation(read(ROUTE));
            assert(restored !== null, 'live route does not carry exactly one approved presentation seam');
            assertSameSource(restored, baseBlob(ROUTE), 'restored live route');
        }],
        ['history: caller, connector, writers, models, Header, assets, popup CSS/JS and helpers unchanged from base', () => {
            for (const file of UNCHANGED_FILES) {
                assertSameSource(read(file), baseBlob(file), file);
            }
        }],
        ['history: themes and shared workbench sources unchanged from base', () => {
            const touched = changedSinceBase(UNCHANGED_TREES);
            assert(touched.length === 0, 'shared sources changed: ' + touched.join(', '));
        }],
        ['history: only the route changed inside the DORN module', () => {
            const touched = changedSinceBase([MODULE]).filter((file) => file !== ROUTE);
            assert(touched.length === 0, 'other DORN module files changed: ' + touched.join(', '));
        }],
        ['history: change scope stays inside the OPEMR-51 allowlist', () => {
            const changed = git(['diff', '--name-only', BASE_SHA, '--'])
                .concat(git(['ls-files', '--others', '--exclude-standard']))
                .split('\n')
                .filter(Boolean);
            const outside = [...new Set(changed)].filter((file) => !CHANGE_SCOPE.includes(file));
            assert(outside.length === 0, 'changes outside scope: ' + outside.join(', '));
        }],
    ];
}

function historyRequested(argv, env) {
    return argv.includes('--history') || env[HISTORY_ENV] === '1';
}

module.exports = {
    APPROVED_SEAM,
    BASE_SHA,
    CHANGE_SCOPE,
    HISTORY_ENV,
    MUTANTS,
    ORIGINAL_SEAM,
    STYLE_BLOCK,
    accepts,
    applyPresentation,
    historyChecks,
    historyRequested,
    normalizeShared,
    portableChecks,
    restorePresentation,
};

if (require.main === module) {
    // node:test is built in; works with `node --test <file>` and plain `node <file>`.
    const { test } = require('node:test');
    const checks = portableChecks().concat(historyRequested(process.argv.slice(2), process.env) ? historyChecks() : []);
    for (const [label, check] of checks) {
        test(label, check);
    }
}
