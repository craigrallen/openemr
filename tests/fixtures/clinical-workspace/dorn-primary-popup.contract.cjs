'use strict';

/**
 * OPEMR-50 source contract for the DORN primary config edit popup
 * (interface/modules/custom_modules/oe-module-dorn/public/primary_config_edit.php).
 *
 * The route is dangerous to execute: a GET with ?npi= calls the DORN vendor
 * connector (ConnectorApi::getPrimaryInfoByNpi) and a Save POST calls
 * ConnectorApi::savePrimaryInfo. Nothing here executes, requests or bootstraps
 * it; every check is a byte-level source comparison.
 *
 * The only approved change is a paper/form-sheet presentation:
 *   - <body> becomes <body class="oe-dorn-primary-popup">;
 *   - a SECOND screen-only <style> block is added directly after the original
 *     required-field <style> block, gated on html.oe-workbench-context.
 * Everything else must stay byte-identical to the frozen original captured at
 * master 18647270.
 *
 * Usage (dependency-free, Node only):
 *   node --test tests/fixtures/clinical-workspace/dorn-primary-popup.contract.cjs
 *   node tests/fixtures/clinical-workspace/dorn-primary-popup.contract.cjs
 *   node tests/fixtures/clinical-workspace/dorn-primary-popup.contract.cjs --history
 *   OPEMR50_DORN_HISTORY=1 node --test tests/fixtures/clinical-workspace/dorn-primary-popup.contract.cjs
 *
 * Portable mode (the default) needs no Git history, so it runs in shallow CI
 * checkouts. History mode is opt-in and fails, never skips, when Git or the
 * exact base commit is unavailable.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const BASE_SHA = '18647270e0c799189d2dc10f801e8de2bff1a360';
const HISTORY_ENV = 'OPEMR50_DORN_HISTORY';

const MODULE = 'interface/modules/custom_modules/oe-module-dorn';
const ROUTE = MODULE + '/public/primary_config_edit.php';
const CALLER = MODULE + '/public/primary_config.php';
const FIXTURE = 'tests/fixtures/clinical-workspace/dorn-primary.original.php.fixture';
const CONTRACT = 'tests/fixtures/clinical-workspace/dorn-primary-popup.contract.cjs';
const JEST_TEST = 'tests/js/clinical-dorn-primary-popup.test.js';
const DOC = 'docs/clinical-ui/DORN-PRIMARY-POPUP.md';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const ASSET_CONFIG = 'config/config.yaml';

// Files the slice relies on but must not touch. Compared to the base blob in
// history mode only; the portable mode cannot require Git history.
const UNCHANGED_FILES = [
    CALLER,
    MODULE + '/src/ConnectorApi.php',
    MODULE + '/src/models/CustomerPrimaryInfoView.php',
    'src/Core/Header.php',
    ASSET_CONFIG,
    POPUP_CSS,
    'interface/clinical-workspace/popup.js',
    'library/dialog.js',
    'interface/main/tabs/js/include_opener.js',
];
const UNCHANGED_TREES = ['interface/themes', 'public/themes', 'interface/clinical-workspace'];
const CHANGE_SCOPE = [ROUTE, FIXTURE, CONTRACT, JEST_TEST, DOC];

const MARKER = 'oe-dorn-primary-popup';
const REQUIRED_STYLE = [
    '    <style>',
    '      .required-field {',
    '        color: red;',
    '      }',
    '    </style>',
    '',
].join('\n');
const STYLE_CLOSE = '    </style>\n';
const HEAD_CLOSE = '</head>\n';
const BODY_ORIGINAL = '<body>\n';
const BODY_APPROVED = '<body class="' + MARKER + '">\n';
// Matches the original block's idiom: tag at 4 spaces, selector at 6,
// declarations at 8.
const STYLE_BLOCK = [
    '    <style media="screen">',
    '      html.oe-workbench-context body.oe-dorn-primary-popup {',
    '        background-color: var(--oe-wb-canvas);',
    '      }',
    '',
    '      html.oe-workbench-context body.oe-dorn-primary-popup > .container-fluid > form.form {',
    '        background-color: var(--oe-wb-paper);',
    '        color: var(--oe-wb-ink);',
    '        box-shadow: inset 0 0 0 1px var(--oe-wb-line);',
    '      }',
    '    </style>',
    '',
].join('\n');
const ORIGINAL_SEAM = STYLE_CLOSE + HEAD_CLOSE + BODY_ORIGINAL;
const APPROVED_SEAM = STYLE_CLOSE + STYLE_BLOCK + HEAD_CLOSE + BODY_APPROVED;

const APPROVED_RULES = [
    {
        selector: 'html.oe-workbench-context body.oe-dorn-primary-popup',
        declarations: ['background-color: var(--oe-wb-canvas);'],
    },
    {
        selector: 'html.oe-workbench-context body.oe-dorn-primary-popup > .container-fluid > form.form',
        declarations: [
            'background-color: var(--oe-wb-paper);',
            'color: var(--oe-wb-ink);',
            'box-shadow: inset 0 0 0 1px var(--oe-wb-line);',
        ],
    },
];
const TOKENS = ['--oe-wb-canvas', '--oe-wb-paper', '--oe-wb-ink', '--oe-wb-line'];

// Lines of the original that carry bootstrap, CSRF, ACL, connector, escaping,
// header, form-control and validation behaviour. Each must appear exactly once
// in the frozen original, in this order.
const PRESERVED_LINES = [
    'require_once __DIR__ . "/../../../../globals.php";',
    'use OpenEMR\\Common\\Acl\\AccessDeniedHelper;',
    'use OpenEMR\\Common\\Acl\\AclMain;',
    'use OpenEMR\\Common\\Csrf\\CsrfUtils;',
    'use OpenEMR\\Common\\Session\\SessionWrapperFactory;',
    'use OpenEMR\\Core\\Header;',
    'use OpenEMR\\Modules\\Dorn\\ConnectorApi;',
    'use OpenEMR\\Modules\\Dorn\\models\\CustomerPrimaryInfoView;',
    '$session = SessionWrapperFactory::getInstance()->getActiveSession();',
    'if (!empty($_REQUEST)) {',
    '    if (!CsrfUtils::verifyCsrfToken($_REQUEST["csrf_token_form"], session: $session)) {',
    '        CsrfUtils::csrfNotVerified();',
    "if (!AclMain::aclCheckCore('admin', 'users')) {",
    '    AccessDeniedHelper::denyWithTemplate("ACL check failed for admin/users: Edit/Add Procedure Provider", xl("Edit/Add Procedure Provider"));',
    '$npi = "";',
    '$data = null;',
    'if (!empty($_POST)) {',
    "    if (isset($_POST['SubmitButton'])) { //check if form was submitted",
    '        $saveData = CustomerPrimaryInfoView::loadByPost($_POST);',
    '        $response = ConnectorApi::savePrimaryInfo($saveData);',
    '        $npi = $_POST["form_npi"];',
    '        if ($response !== true) {',
    '            echo "<span class=\'alert alert-danger mx-3\'>" . xlt("Error saving primary information: ") . text($response->message) . "</span>";',
    '            echo "<span class=\'alert alert-success mx-3\'>" . xlt("Primary information saved successfully") . "</span>";',
    "    $npi = $_REQUEST['npi'] ?? \"\";",
    'if ($npi) {',
    '    $data = ConnectorApi::getPrimaryInfoByNpi($npi);',
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    "    <?php Header::setupHeader(['opener']); ?>",
    '    <title><?php echo xlt("Primary Config Edit"); ?></title>',
    '    <style>',
    '      .required-field {',
    '        color: red;',
    '</head>',
    '<body>',
    '    <div class="container-fluid">',
    '        <form class="form" method=\'post\' name=\'theform\' action="primary_config_edit.php?npi=<?php echo attr_url($data->npi); ?>&csrf_token_form=<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>">',
    '            <input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />',
    "                        <input type='text' readonly name='form_primaryId' id='form_primaryId' value='<?php echo attr($data->primaryId ?? ''); ?>' class='form-control' />",
    "                        <input type='text' required name='form_npi' id='form_npi' maxlength='10' value='<?php echo attr($data->npi ?? ''); ?>' class='form-control' />",
    "                        <input type='text' name='form_address2' id='form_address2' value='<?php echo attr($data->primaryAddress2 ?? ''); ?>' class='form-control' />",
    '                    <button type="submit" name="SubmitButton" class="btn btn-primary my-2"><?php echo xlt("Save") ?></button>',
    '        </form>',
    '    <script>',
    '        // Form validation',
    "        document.querySelector('form').addEventListener('submit', function(e) {",
    "            const requiredFields = document.querySelectorAll('input[required], select[required]');",
    '                if (!field.value.trim()) {',
    "                    field.classList.add('is-invalid');",
    "                    field.classList.remove('is-invalid');",
    '                e.preventDefault();',
    "                alert('<?php echo xlt(\"Please fill in all required fields\") ?>');",
    '    </script>',
    '</body>',
    '</html>',
];

// Absolute pins on the frozen original's form controls.
const FIXTURE_PINS = [
    ["type='text' required name=", 8],
    ["type='text' name=", 1],
    ["type='text' readonly name='form_primaryId'", 1],
    ["maxlength='10'", 1],
    ["class='form-control'", 10],
    ['class="required-field"', 8],
    ['<input type="hidden" name="csrf_token_form"', 1],
    ['<button type="submit" name="SubmitButton"', 1],
    ['<div class="row">', 11],
    ['<div class="col-sm-6">', 11],
    ['<div class="clearfix">', 10],
    ['<div class="label-div">', 10],
    ['<label class="col-form-label"', 10],
    ['<form ', 1],
    ['<script>', 1],
    ['<style', 1],
    ['</style>', 1],
    ['<body', 1],
    ['<link', 0],
    ['oe-workbench', 0],
    [MARKER, 0],
    ['media=', 0],
];

// Tokens whose counts must be identical in the original and the candidate:
// the presentation adds no control, wrapper, escaping, request or asset.
const INVENTORY = [
    '<input', 'required', 'readonly', 'maxlength', 'form-control', 'class="row"', 'col-sm-6',
    'clearfix', 'label-div', 'col-form-label', 'required-field', '<button', '<div', '</div>',
    '<form', '</form>', '<label', '<span', '<script', '</script>', '<link', 'name=', 'id=',
    'value=', 'action=', 'method=', 'CsrfUtils::', 'ConnectorApi::', 'AclMain::', 'Header::',
    '$_POST', '$_REQUEST', '$_GET', 'sqlQuery', 'sqlStatement', 'QueryUtils', 'xlt(', 'xl(',
    'xla(', 'xlj(', 'attr(', 'attr_url(', 'attr_js(', 'text(', 'js_url(', 'is-invalid',
    'alert', 'preventDefault', 'querySelector', 'addEventListener', '<?php', '?>',
];

// The real caller: both doedclick_* open the route in a 600x750 dlgopen with an
// external secondary Close button.
const CALLER_EDIT = [
    '    function doedclick_edit(npi) {',
    '        top.restoreSession();',
    '        var addTitle = \'<i class="fa fa-plus" style="width:20px;" aria-hidden="true"></i> \' + <?php echo xlj("Edit Mode"); ?>;',
    "        let scriptTitle = 'primary_config_edit.php?npi=' + encodeURIComponent(npi) + '&csrf_token_form=' + <?php echo js_url(CsrfUtils::collectCsrfToken(session: $session)); ?>;",
    "        dlgopen(scriptTitle, '_blank', 600, 750, false, addTitle, {",
    '            buttons: [',
    "                {text: '<?php echo xla('Close'); ?>', close: true, style: 'secondary btn-sm'}",
    '            ]',
    '        });',
    '    }',
    '',
].join('\n');
const CALLER_ADD = [
    '    function doedclick_add() {',
    '        top.restoreSession();',
    '        var addTitle = \'<i class="fa fa-plus" style="width:20px;" aria-hidden="true"></i> \' + <?php echo xlj("Edit Mode"); ?>;',
    "        let scriptTitle = 'primary_config_edit.php?csrf_token_form=' + <?php echo js_url(CsrfUtils::collectCsrfToken(session: $session)); ?>;",
    "        dlgopen(scriptTitle, '_blank', 600, 750, false, addTitle, {",
    '            buttons: [',
    "                {text: '<?php echo xla('Close'); ?>', close: true, style: 'secondary btn-sm'}",
    '            ]',
    '        });',
    '    }',
    '',
].join('\n');

const SHEET_ANCHOR = '        box-shadow: inset 0 0 0 1px var(--oe-wb-line);\n      }\n';

/**
 * Unapproved edits applied to the synthetic approved candidate. Each search
 * string must occur exactly once in the candidate. Replacements are short;
 * no mutant duplicates the fixture.
 */
const MUTANTS = [
    // Presentation block placement and shape.
    ['style block missing', STYLE_BLOCK, ''],
    ['body marker missing', BODY_APPROVED, BODY_ORIGINAL],
    ['block relocated after </head>', STYLE_BLOCK + HEAD_CLOSE, HEAD_CLOSE + STYLE_BLOCK],
    ['block relocated before required-field style', REQUIRED_STYLE + STYLE_BLOCK, STYLE_BLOCK + REQUIRED_STYLE],
    ['block copied into body',BODY_APPROVED + '    <div class="container-fluid">\n', BODY_APPROVED + STYLE_BLOCK + '    <div class="container-fluid">\n'],
    ['block duplicated', STYLE_BLOCK, STYLE_BLOCK + STYLE_BLOCK],
    ['rules merged into required-field style', '      }\n    </style>\n    <style media="screen">\n', '      }\n\n'],
    ['blank line between rules removed', '      }\n\n      html', '      }\n      html'],
    ['declaration indentation changed', '        background-color: var(--oe-wb-canvas);\n', '      background-color: var(--oe-wb-canvas);\n'],
    ['closing brace dropped', SHEET_ANCHOR, '        box-shadow: inset 0 0 0 1px var(--oe-wb-line);\n'],
    ['css comment added', '    <style media="screen">\n', '    <style media="screen">\n      /* sheet */\n'],
    ['media widened to all', '<style media="screen">', '<style media="all">'],
    ['media removed', '<style media="screen">', '<style>'],
    ['media switched to print', '<style media="screen">', '<style media="print">'],
    ['media query narrowed', '<style media="screen">', '<style media="screen and (min-width: 600px)">'],
    ['print media rule added', SHEET_ANCHOR, SHEET_ANCHOR + '      @media print { body.oe-dorn-primary-popup { background: none; } }\n'],
    // Declarations and tokens.
    ['canvas token swapped for paper', 'background-color: var(--oe-wb-canvas);', 'background-color: var(--oe-wb-paper);'],
    ['paper token swapped for canvas', 'background-color: var(--oe-wb-paper);', 'background-color: var(--oe-wb-canvas);'],
    ['ink token swapped for muted', 'color: var(--oe-wb-ink);', 'color: var(--oe-wb-muted);'],
    ['line token swapped for petrol', 'var(--oe-wb-line)', 'var(--oe-wb-petrol)'],
    ['fallback added to token', 'var(--oe-wb-canvas)', 'var(--oe-wb-canvas, #f3f7f5)'],
    ['literal colour replaces token', 'var(--oe-wb-paper)', '#fff'],
    ['box shadow removed', '        box-shadow: inset 0 0 0 1px var(--oe-wb-line);\n', ''],
    ['box shadow replaced by border', '        box-shadow: inset 0 0 0 1px var(--oe-wb-line);\n', '        border: 1px solid var(--oe-wb-line);\n'],
    ['box shadow geometry changed', 'inset 0 0 0 1px', 'inset 0 0 0 2px'],
    ['declaration order swapped', '        background-color: var(--oe-wb-paper);\n        color: var(--oe-wb-ink);\n', '        color: var(--oe-wb-ink);\n        background-color: var(--oe-wb-paper);\n'],
    ['important added', 'var(--oe-wb-line);', 'var(--oe-wb-line) !important;'],
    ['padding added to sheet', '        color: var(--oe-wb-ink);\n', '        color: var(--oe-wb-ink);\n        padding: 1rem;\n'],
    ['margin added to body', '        background-color: var(--oe-wb-canvas);\n', '        background-color: var(--oe-wb-canvas);\n        margin: 0;\n'],
    ['font added to sheet', '        color: var(--oe-wb-ink);\n', '        color: var(--oe-wb-ink);\n        font-family: Arial, sans-serif;\n'],
    ['radius added to sheet', '        color: var(--oe-wb-ink);\n', '        color: var(--oe-wb-ink);\n        border-radius: 6px;\n'],
    ['width added to sheet', '        color: var(--oe-wb-ink);\n', '        color: var(--oe-wb-ink);\n        max-width: 40rem;\n'],
    ['display added to sheet', '        color: var(--oe-wb-ink);\n', '        color: var(--oe-wb-ink);\n        display: grid;\n'],
    ['focus rule added', SHEET_ANCHOR, SHEET_ANCHOR + '      html.oe-workbench-context body.oe-dorn-primary-popup .form-control:focus {\n        outline: 2px solid var(--oe-wb-petrol);\n      }\n'],
    ['control rule added', SHEET_ANCHOR, SHEET_ANCHOR + '      html.oe-workbench-context body.oe-dorn-primary-popup .form-control {\n        color: var(--oe-wb-ink);\n      }\n'],
    ['required rule added', SHEET_ANCHOR, SHEET_ANCHOR + '      html.oe-workbench-context body.oe-dorn-primary-popup .required-field {\n        color: var(--oe-wb-ink);\n      }\n'],
    ['validation rule added', SHEET_ANCHOR, SHEET_ANCHOR + '      html.oe-workbench-context body.oe-dorn-primary-popup .is-invalid {\n        border-color: var(--oe-wb-line);\n      }\n'],
    // Selectors.
    ['workbench gate dropped', 'html.oe-workbench-context body.oe-dorn-primary-popup {', 'body.oe-dorn-primary-popup {'],
    ['gate switched to popup class', 'html.oe-workbench-context body.oe-dorn-primary-popup > ', 'html.oe-workbench-popup body.oe-dorn-primary-popup > '],
    ['sheet widened to any form', 'body.oe-dorn-primary-popup > .container-fluid > form.form {', 'body.oe-dorn-primary-popup form {'],
    ['sheet moved to container', '> .container-fluid > form.form {', '> .container-fluid {'],
    ['sheet moved to rows', '> .container-fluid > form.form {', '> .container-fluid > form.form > .row {'],
    ['form type qualifier dropped', 'form.form {', '.form {'],
    ['descendant combinator replaces child', '> .container-fluid > form.form {', '.container-fluid form.form {'],
    ['selector list widened', 'body.oe-dorn-primary-popup {', 'body.oe-dorn-primary-popup, html.oe-workbench-context .modal {'],
    // Body marker variants.
    ['body class extended', '<body class="oe-dorn-primary-popup">', '<body class="oe-dorn-primary-popup container">'],
    ['body attribute added', '<body class="oe-dorn-primary-popup">', '<body class="oe-dorn-primary-popup" dir="rtl">'],
    ['body class single-quoted', '<body class="oe-dorn-primary-popup">', "<body class='oe-dorn-primary-popup'>"],
    ['marker copied onto html', '<html>', '<html class="oe-dorn-primary-popup">'],
    ['marker copied onto container', '<div class="container-fluid">', '<div class="container-fluid oe-dorn-primary-popup">'],
    // Wrappers, layout, rows and columns.
    ['wrapper added around container', '    <div class="container-fluid">\n', '    <div class="oe-sheet">\n    <div class="container-fluid">\n'],
    ['container class changed', '<div class="container-fluid">', '<div class="container">'],
    ['form class extended', '<form class="form" ', '<form class="form oe-sheet" '],
    ['row gutter class added', '" />\n            <div class="row">', '" />\n            <div class="row no-gutters">'],
    ['save column widened', '<div class="col-sm-6">\n                    <button', '<div class="col-12">\n                    <button'],
    // Assets and scripts.
    ['stylesheet link added', STYLE_BLOCK, STYLE_BLOCK + '    <link rel="stylesheet" href="sheet.css">\n'],
    ['head script added', STYLE_BLOCK, STYLE_BLOCK + '    <script src="sheet.js"></script>\n'],
    ['body script added', BODY_APPROVED, BODY_APPROVED + '    <script>document.body.focus();</script>\n'],
    ['header asset added', "Header::setupHeader(['opener'])", "Header::setupHeader(['opener', 'workbench-reminder-popup'])"],
    ['header popup asset excluded', "Header::setupHeader(['opener'])", "Header::setupHeader(['opener', 'no_workbench-popup'])"],
    ['header opener dropped', "Header::setupHeader(['opener'])", 'Header::setupHeader()'],
    ['title changed', 'xlt("Primary Config Edit")', 'xlt("DORN Primary")'],
    // Required-field rule.
    ['required red changed', 'color: red;', 'color: var(--oe-wb-ink);'],
    ['required rule removed', '      .required-field {\n        color: red;\n      }\n', ''],
    // Bootstrap, CSRF and ACL.
    ['bootstrap depth changed', '"/../../../../globals.php"', '"/../../../globals.php"'],
    ['csrf gate narrowed to post', 'if (!empty($_REQUEST)) {', 'if (!empty($_POST)) {'],
    ['csrf source changed', '$_REQUEST["csrf_token_form"]', '$_GET["csrf_token_form"]'],
    ['csrf failure no longer stops', '        CsrfUtils::csrfNotVerified();\n', ''],
    ['csrf check removed', '    if (!CsrfUtils::verifyCsrfToken($_REQUEST["csrf_token_form"], session: $session)) {\n        CsrfUtils::csrfNotVerified();\n    }\n', ''],
    ['acl permission changed', "aclCheckCore('admin', 'users')", "aclCheckCore('admin', 'practice')"],
    ['acl check inverted', 'if (!AclMain::', 'if (AclMain::'],
    ['acl deny replaced', 'AccessDeniedHelper::denyWithTemplate("ACL check failed for admin/users: Edit/Add Procedure Provider", xl("Edit/Add Procedure Provider"));', 'die(xlt("Denied"));'],
    ['session line removed', '$session = SessionWrapperFactory::getInstance()->getActiveSession();\n', ''],
    // Connector and SQL.
    ['connector save payload changed', 'ConnectorApi::savePrimaryInfo($saveData)', 'ConnectorApi::savePrimaryInfo(CustomerPrimaryInfoView::loadByPost($_REQUEST))'],
    ['connector lookup changed', 'ConnectorApi::getPrimaryInfoByNpi($npi)', 'ConnectorApi::getPrimaryInfos($npi)'],
    ['connector lookup guarded away', 'if ($npi) {', 'if (false && $npi) {'],
    ['sql added', '$data = null;\n', '$data = null;\nsqlQuery("SELECT 1");\n'],
    ['npi source changed', "$_REQUEST['npi'] ?? \"\"", "$_GET['npi'] ?? \"\""],
    ['post model source changed', 'loadByPost($_POST)', 'loadByPost($_REQUEST)'],
    ['saved npi field changed', '$npi = $_POST["form_npi"];', '$npi = $_POST["npi"];'],
    ['submit detection changed', "isset($_POST['SubmitButton'])", "isset($_REQUEST['SubmitButton'])"],
    // Escaping and messages.
    ['error message unescaped', 'text($response->message)', '$response->message'],
    ['action npi escaping changed', 'attr_url($data->npi)', 'attr($data->npi)'],
    ['inherited null npi silently fixed', 'attr_url($data->npi)', "attr_url($data->npi ?? '')"],
    ['value escaping changed', "attr($data->primaryName ?? '')", "text($data->primaryName ?? '')"],
    ['save label escaping changed', 'xlt("Save")', 'xla("Save")'],
    ['success message changed', 'Primary information saved successfully', 'Saved'],
    ['error alert spacing changed', 'alert alert-danger mx-3', 'alert alert-danger'],
    // Form action and hidden token.
    ['action target changed', 'action="primary_config_edit.php?npi=', 'action="primary_config.php?npi='],
    ['action csrf removed', '&csrf_token_form=<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>">', '">'],
    ['hidden token removed', '            <input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />\n', ''],
    ['hidden token renamed', 'name="csrf_token_form"', 'name="csrf_token"'],
    ['form method changed', "method='post'", "method='get'"],
    ['form name changed', "name='theform'", "name='primary'"],
    ['novalidate added', '<form class="form" method=', '<form class="form" novalidate method='],
    // Controls.
    ['npi required removed', "type='text' required name='form_npi'", "type='text' name='form_npi'"],
    ['primary id readonly removed', "type='text' readonly name='form_primaryId'", "type='text' name='form_primaryId'"],
    ['primary id readonly became disabled', "readonly name='form_primaryId'", "disabled name='form_primaryId'"],
    ['npi maxlength removed', "maxlength='10' ", ''],
    ['npi maxlength changed', "maxlength='10'", "maxlength='12'"],
    ['address2 made required', "type='text' name='form_address2'", "type='text' required name='form_address2'"],
    ['email input type changed', "type='text' required name='form_email'", "type='email' required name='form_email'"],
    ['zip id changed', "id='form_zip'", "id='form_zip_code'"],
    ['zip label target changed', 'for="form_zip"', 'for="zip"'],
    ['npi required marker removed', '<?php echo xlt(\'NPI\'); ?><span class="required-field"> *</span>:', "<?php echo xlt('NPI'); ?>:"],
    ['save became plain button', 'type="submit" name="SubmitButton"', 'type="button" name="SubmitButton"'],
    ['save size changed', 'btn btn-primary my-2', 'btn btn-primary btn-sm my-2'],
    // Validation script.
    ['validation select scope dropped', 'input[required], select[required]', 'input[required]'],
    ['invalid class no longer added', "                    field.classList.add('is-invalid');\n", ''],
    ['submit no longer prevented', '                e.preventDefault();\n', ''],
    ['trim removed', '!field.value.trim()', '!field.value'],
    ['form selector changed', "document.querySelector('form')", "document.querySelector('form.form')"],
    ['validation event changed', "addEventListener('submit'", "addEventListener('click'"],
    ['validation alert escaping changed', 'alert(\'<?php echo xlt("Please fill in all required fields") ?>\');', 'alert(<?php echo xlj("Please fill in all required fields") ?>);'],
    // Arbitrary bytes.
    ['trailing newline added', '</html>\n', '</html>\n\n'],
    ['byte order mark added', '<?php\n\n/**', '﻿<?php\n\n/**'],
    ['crlf line ending introduced', '<!DOCTYPE html>\n', '<!DOCTYPE html>\r\n'],
    ['tab indentation introduced', '    <div class="container-fluid">\n', '\t<div class="container-fluid">\n'],
    ['trailing space after head', HEAD_CLOSE, '</head> \n'],
    ['zero-width character in marker', 'oe-dorn-primary-popup">', 'oe-dorn-primary-popup​">'],
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
        ['frozen original keeps every security, connector, control and validation line in order', () => {
            const lines = fixture().split('\n');
            let cursor = -1;
            for (const expected of PRESERVED_LINES) {
                assert(lines.filter((line) => line === expected).length === 1, 'original line not unique: ' + JSON.stringify(expected));
                const at = lines.indexOf(expected);
                assert(at > cursor, 'original line out of order: ' + JSON.stringify(expected));
                cursor = at;
            }
            const html = fixture().indexOf('<!DOCTYPE html>');
            for (const backend of ['CsrfUtils::verifyCsrfToken(', "AclMain::aclCheckCore('admin', 'users')", 'ConnectorApi::savePrimaryInfo(', 'ConnectorApi::getPrimaryInfoByNpi(']) {
                const at = fixture().indexOf(backend);
                assert(at >= 0 && at < html, 'backend step must run before the document: ' + backend);
            }
            assert(fixture().endsWith('</body>\n</html>\n'), 'original must end with </body></html> and one newline');
            assert(!fixture().includes('\r') && !fixture().includes('\t') && !fixture().startsWith('﻿'), 'original must be LF, space-indented and BOM-free');
        }],
        ['frozen original pins its form controls, layout and single required-field style', () => {
            for (const [token, expected] of FIXTURE_PINS) {
                assert(count(fixture(), token) === expected, 'original count of ' + JSON.stringify(token) + ' is ' + count(fixture(), token) + ', expected ' + expected);
            }
            assert(count(fixture(), REQUIRED_STYLE) === 1, 'required-field style block changed');
            assert(count(fixture(), ORIGINAL_SEAM) === 1, 'original </style></head><body> seam missing');
        }],
        ['approved block has exactly two screen-only workbench-gated rules', () => {
            assert(count(STYLE_BLOCK, '<style media="screen">') === 1, 'block must open with one screen-only style tag');
            assert(count(STYLE_BLOCK, '      }\n\n      html') === 1, 'rules must be separated by one blank line');
            const { rules, leftover } = parseRules(STYLE_BLOCK);
            assert(leftover === '\n', 'unexpected text between rules: ' + JSON.stringify(leftover));
            assert(JSON.stringify(rules) === JSON.stringify(APPROVED_RULES), 'rules differ from the approved selectors/declarations');
            for (const forbidden of ['padding', 'margin', 'font', 'width', 'height', 'border', 'radius', 'outline', 'display', 'position', 'flex', 'grid', 'focus', 'required', 'invalid', 'print', '@media', '!important', 'url(', '@import', '/*', '.row', '.col', '.form-control', 'label', 'input', 'button', '#']) {
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
            assert(candidate().indexOf(REQUIRED_STYLE + STYLE_BLOCK) >= 0, 'second block must follow the required-field block directly');
            assert(count(candidate(), "    <?php Header::setupHeader(['opener']); ?>\n") === 1, 'Header opener changed');
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
        ['caller keeps both 600x750 dlgopen opens with the external Close button', () => {
            const caller = read(CALLER);
            assert(count(caller, CALLER_EDIT) === 1, 'doedclick_edit block changed');
            assert(count(caller, CALLER_ADD) === 1, 'doedclick_add block changed');
            assert(count(caller, 'primary_config_edit.php') === 2, 'caller must reach primary_config_edit.php exactly twice');
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
        ['history: caller, connector, model, Header, assets, popup CSS/JS and helpers unchanged from base', () => {
            for (const file of UNCHANGED_FILES) {
                assertSameSource(read(file), baseBlob(file), file);
            }
        }],
        ['history: themes and shared workbench sources unchanged from base', () => {
            const changed = git(['diff', '--name-only', BASE_SHA, '--', ...UNCHANGED_TREES]).split('\n').filter(Boolean);
            const untracked = git(['ls-files', '--others', '--exclude-standard', '--', ...UNCHANGED_TREES]).split('\n').filter(Boolean);
            const touched = [...new Set(changed.concat(untracked))];
            assert(touched.length === 0, 'shared sources changed: ' + touched.join(', '));
        }],
        ['history: change scope stays inside the OPEMR-50 allowlist', () => {
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
