'use strict';

/**
 * OPEMR-52 source contract for the EOB Posting patient billing-note popup
 * (interface/billing/sl_eob_patient_note.php), opened by npopup() in
 * interface/billing/sl_eob_search.php.
 *
 * The route has an acct/eob write gate, reads patient_data, and on POST checks
 * CSRF and updates patient_data.billing_note. Nothing here executes, requests
 * or bootstraps it; every check is a byte-level source comparison.
 *
 * The only approved change is a partial canvas/sheet presentation:
 *   - <body> becomes <body class="oe-eob-patient-note-popup">;
 *   - one screen-only <style> block is inserted directly after the <title>
 *     line and directly before </head>, gated on html.oe-workbench-context.
 * Everything else must stay byte-identical to the frozen original captured at
 * master 18647270e0c799189d2dc10f801e8de2bff1a360.
 *
 * Usage (dependency-free, Node only):
 *   node --test tests/fixtures/clinical-workspace/eob-patient-note-popup.contract.cjs
 *   node tests/fixtures/clinical-workspace/eob-patient-note-popup.contract.cjs
 *   node tests/fixtures/clinical-workspace/eob-patient-note-popup.contract.cjs --history
 *   OPEMR52_EOB_NOTE_HISTORY=1 node --test tests/fixtures/clinical-workspace/eob-patient-note-popup.contract.cjs
 *
 * Portable mode (the default) reads only working-tree files: no Git history,
 * no process. History mode is opt-in and fails, never skips, when Git or the
 * exact base commit is unavailable.
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
const HISTORY_ENV = 'OPEMR52_EOB_NOTE_HISTORY';

const ROUTE = 'interface/billing/sl_eob_patient_note.php';
const CALLER = 'interface/billing/sl_eob_search.php';
const FIXTURE = 'tests/fixtures/clinical-workspace/eob-patient-note.original.php.fixture';
const CONTRACT = 'tests/fixtures/clinical-workspace/eob-patient-note-popup.contract.cjs';
const JEST_TEST = 'tests/js/clinical-eob-patient-note-popup.test.js';
const DOC = 'docs/clinical-ui/EOB-PATIENT-NOTE-POPUP.md';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const ASSET_CONFIG = 'config/config.yaml';

// Files the slice relies on but must not touch; compared to base in history mode.
const UNCHANGED_FILES = [
    CALLER,
    'src/Core/Header.php',
    ASSET_CONFIG,
    POPUP_CSS,
    'interface/clinical-workspace/popup.js',
    'library/dialog.js',
    'interface/main/tabs/js/include_opener.js',
];
const UNCHANGED_TREES = ['interface/themes', 'public/themes', 'interface/clinical-workspace'];
const CHANGE_SCOPE = [ROUTE, FIXTURE, CONTRACT, JEST_TEST, DOC];

const MARKER = 'oe-eob-patient-note-popup';
const TITLE_LINE = "    <title><?php echo xlt('EOB Posting - Patient Note'); ?></title>\n";
const HEAD_CLOSE = '</head>\n';
const BODY_ORIGINAL = '<body>\n';
const BODY_APPROVED = '<body class="' + MARKER + '">\n';
const STYLE_BLOCK = [
    '    <style media="screen">',
    '      html.oe-workbench-context body.oe-eob-patient-note-popup {',
    '        color: var(--oe-wb-ink);',
    '        background-color: var(--oe-wb-canvas);',
    '      }',
    '',
    '      html.oe-workbench-context body.oe-eob-patient-note-popup > .container {',
    '        color: var(--oe-wb-ink);',
    '        background-color: var(--oe-wb-paper);',
    '        box-shadow: inset 0 0 0 1px var(--oe-wb-line);',
    '      }',
    '    </style>',
    '',
].join('\n');
const ORIGINAL_SEAM = TITLE_LINE + HEAD_CLOSE + BODY_ORIGINAL;
const APPROVED_SEAM = TITLE_LINE + STYLE_BLOCK + HEAD_CLOSE + BODY_APPROVED;

const APPROVED_RULES = [
    {
        selector: 'html.oe-workbench-context body.oe-eob-patient-note-popup',
        declarations: ['color: var(--oe-wb-ink);', 'background-color: var(--oe-wb-canvas);'],
    },
    {
        selector: 'html.oe-workbench-context body.oe-eob-patient-note-popup > .container',
        declarations: [
            'color: var(--oe-wb-ink);',
            'background-color: var(--oe-wb-paper);',
            'box-shadow: inset 0 0 0 1px var(--oe-wb-line);',
        ],
    },
];
const TOKENS = ['--oe-wb-ink', '--oe-wb-canvas', '--oe-wb-paper', '--oe-wb-line'];

// Original lines carrying bootstrap, ACL, session, patient id, SQL, CSRF,
// save/close, escaping, form, textarea, buttons and document structure. Each
// must be unique in the frozen original and appear in this order.
const PRESERVED_LINES = [
    'require_once("../globals.php");',
    'use OpenEMR\\Common\\Acl\\AccessDeniedHelper;',
    'use OpenEMR\\Common\\Acl\\AclMain;',
    'use OpenEMR\\Common\\Csrf\\CsrfUtils;',
    'use OpenEMR\\Common\\Session\\SessionWrapperFactory;',
    'use OpenEMR\\Core\\Header;',
    "if (!AclMain::aclCheckCore('acct', 'eob', '', 'write')) {",
    '    AccessDeniedHelper::denyWithTemplate("ACL check failed for acct/eob: EOB Posting - Patient Note", xl("EOB Posting - Patient Note"));',
    '$info_msg = "";',
    '$session = SessionWrapperFactory::getInstance()->getActiveSession();',
    '<html>',
    '<head>',
    "    <?php Header::setupHeader(['opener']); ?>",
    "    <title><?php echo xlt('EOB Posting - Patient Note'); ?></title>",
    '</head>',
    '<body>',
    "    $patient_id = $_GET['patient_id'];",
    '    if (!$patient_id) {',
    '        die(xlt("You cannot access this page directly."));',
    '    $row = sqlQuery("Select billing_note From patient_data Where pid=?", [$patient_id]);',
    "    if (isset($_POST['form_save'])) {",
    '        CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);',
    "        $thevalue = trim((string) $_POST['form_note']);",
    '        sqlStatement("UPDATE patient_data SET " .',
    '            "billing_note = ? " .',
    '            "WHERE pid = ? ", [$thevalue, $patient_id]);',
    '        echo "<script>\\n";',
    '        if ($info_msg) {',
    '            echo " alert(" . js_escape($info_msg) . ");\\n";',
    '        echo " dlgclose();\\n";',
    '        echo "</script></body></html>\\n";',
    '        exit();',
    '    $row = sqlQuery("select fname, lname, billing_note " .',
    '        "from patient_data where pid = ? limit 1", [$patient_id]);',
    '    <div class="container">',
    "            <h2><?php echo xlt('Billing Note for ') . text($row['fname']) . \" \" . text($row['lname']); ?></h2>",
    '        <div class="row mx-auto">',
    "            <form method='post' action='sl_eob_patient_note.php?patient_id=<?php echo attr_url($patient_id); ?>'>",
    '                <input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />',
    "                            <textarea type='text' name='form_note' class='textarea form-control' rows=\"3\" maxlength=\"255\" placeholder='<?php echo xla('Max 255 characters') ?>'><?php echo attr($row['billing_note']) ?></textarea>",
    "                            <label><?php echo xlt('Max 255 characters') ?></label>",
    '                        <div class="col-sm-12 text-left position-override" id="search-btn">',
    '                            <div class="btn-group" role="group">',
    "                                <button type='submit' class=\"btn btn-primary btn-save\" name='form_save' id=\"btn-save\"><?php echo xlt(\"Save\"); ?></button>",
    "                                <button type='submit' class=\"btn btn-secondary btn-cancel\" name='form_cancel' id=\"btn-cancel\" onclick='dlgclose();'><?php echo xlt(\"Cancel\"); ?></button>",
    '            </form>',
    '    </div><!--end of container div-->',
    '</body>',
    '</html>',
];

// Absolute pins on the frozen original (counts verified by reading the route).
const FIXTURE_PINS = [
    ['<style', 0],
    ['</style>', 0],
    ['<link', 0],
    ['media=', 0],
    ['oe-workbench', 0],
    [MARKER, 0],
    ['<body', 1],
    ['<form', 1],
    ['</form>', 1],
    ['<input', 1],
    ['<textarea', 1],
    ['rows="3"', 1],
    ['maxlength="255"', 1],
    ['Max 255 characters', 2],
    ['<label', 1],
    ['<button', 2],
    ["type='submit'", 2],
    ['dlgclose();', 2],
    ['class="container"', 1],
    ['sqlQuery(', 2],
    ['sqlStatement(', 1],
    ['CsrfUtils::', 2],
    ['$_POST', 2],
    ['$_GET', 1],
    ['$_REQUEST', 0],
    ['xlt(', 6],
    ['xla(', 1],
    ['xl(', 1],
    ['attr(', 1],
    ['attr_url(', 1],
    ['text(', 2],
    ['js_escape(', 1],
];

// Token counts that must be identical in the original and the candidate.
const INVENTORY = [
    '<textarea', '</textarea>', 'rows=', 'maxlength=', 'placeholder=', '<button', '</button>', 'type=',
    'onclick=', 'dlgclose', '<input', '<form', '</form>', 'action=', 'method=', 'name=', 'id=', '<div',
    '</div>', '<label', '<h2', 'class="row', 'form-group', 'btn', 'CsrfUtils::', 'AclMain::',
    'AccessDeniedHelper::', 'SessionWrapperFactory::', 'Header::', 'sqlQuery(', 'sqlStatement(', '$_POST',
    '$_GET', '$_REQUEST', 'xlt(', 'xl(', 'xla(', 'attr(', 'attr_url(', 'text(', 'js_escape(', 'die(',
    'exit(', '<script', '<link', '<?php', '?>', 'patient_id', 'billing_note', '<body', '</body>', '<head',
    '</head>', '<html', '<title',
];

// The real caller: sl_eob_search.php npopup() opens the route in a modal-sm
// dlgopen of height 275, from the Billing Note column of the result rows.
const CALLER_OPEN = [
    '        function npopup(e, pid) {',
    '            e.preventDefault();',
    "            let url = 'sl_eob_patient_note.php?patient_id=' + encodeURIComponent(pid);",
    "            dlgopen(url, 'billnote', 'modal-sm', 275, '');",
    '        }',
    '',
].join('\n');
const CALLER_CLICK = 'onclick="npopup(event, <?php echo attr_js($row[\'pid\']); ?>)"';

const BODY_INK = '        color: var(--oe-wb-ink);\n        background-color: var(--oe-wb-canvas);\n';
const SHEET_INK = '        color: var(--oe-wb-ink);\n        background-color: var(--oe-wb-paper);\n';
const SHEET_EDGE = '        box-shadow: inset 0 0 0 1px var(--oe-wb-line);\n      }\n';
const BODY_SELECTOR = 'html.oe-workbench-context body.oe-eob-patient-note-popup {';
const SHEET_SELECTOR = 'html.oe-workbench-context body.oe-eob-patient-note-popup > .container {';
const addRule = (rule) => [SHEET_EDGE, SHEET_EDGE + rule];
const rule = (selector, declaration) => '      html.oe-workbench-context body.oe-eob-patient-note-popup ' + selector + ' {\n        ' + declaration + '\n      }\n';

/**
 * Unapproved edits, grouped. Each entry is [label, search, replacement, scope]:
 * scope 'original' anchors must also be unique in the frozen original.
 */
const MUTANT_GROUPS = [
    ['presentation shape: missing, displaced, duplicated or extra additions', [
        ['style block missing', STYLE_BLOCK, '', 'presentation'],
        ['body class missing', BODY_APPROVED, BODY_ORIGINAL, 'presentation'],
        ['body gains another class', 'class="' + MARKER + '"', 'class="' + MARKER + ' container"', 'presentation'],
        ['body class single-quoted', 'class="' + MARKER + '"', "class='" + MARKER + "'", 'presentation'],
        ['marker copied onto the container', '    <div class="container">\n', '    <div class="container ' + MARKER + '">\n', 'original'],
        ['block displaced after </head>', STYLE_BLOCK + HEAD_CLOSE, HEAD_CLOSE + STYLE_BLOCK, 'presentation'],
        ['block displaced before <title>', TITLE_LINE + STYLE_BLOCK, STYLE_BLOCK + TITLE_LINE, 'presentation'],
        ['block displaced into <body>', STYLE_BLOCK + HEAD_CLOSE + BODY_APPROVED, HEAD_CLOSE + BODY_APPROVED + STYLE_BLOCK, 'presentation'],
        ['block duplicated', STYLE_BLOCK, STYLE_BLOCK + STYLE_BLOCK, 'presentation'],
        ['second style block added', STYLE_BLOCK, STYLE_BLOCK + '    <style media="screen">\n    </style>\n', 'presentation'],
        ['stylesheet link added', STYLE_BLOCK, STYLE_BLOCK + '    <link rel="stylesheet" href="sheet.css">\n', 'presentation'],
        ['script added', STYLE_BLOCK, STYLE_BLOCK + '    <script src="sheet.js"></script>\n', 'presentation'],
        ['blank line between rules removed', '      }\n\n      html', '      }\n      html', 'presentation'],
        ['css comment added', '    <style media="screen">\n', '    <style media="screen">\n      /* sheet */\n', 'presentation'],
    ]],
    ['media, print and !important', [
        ['media widened to all', '<style media="screen">', '<style media="all">', 'presentation'],
        ['media removed', '<style media="screen">', '<style>', 'presentation'],
        ['media switched to print', '<style media="screen">', '<style media="print">', 'presentation'],
        ['media query narrowed', '<style media="screen">', '<style media="screen and (min-width: 600px)">', 'presentation'],
        ['type attribute added', '<style media="screen">', '<style media="screen" type="text/css">', 'presentation'],
        ['print rule added', ...addRule('      @media print { body.' + MARKER + ' { background: none; } }\n'), 'presentation'],
        ['important added to edge', 'var(--oe-wb-line);', 'var(--oe-wb-line) !important;', 'presentation'],
        ['important added to canvas', 'var(--oe-wb-canvas);', 'var(--oe-wb-canvas) !important;', 'presentation'],
    ]],
    ['geometry: box model, gutters, font and edge', [
        ['padding added to sheet', SHEET_INK, SHEET_INK + '        padding: 1rem;\n', 'presentation'],
        ['margin added to sheet', SHEET_INK, SHEET_INK + '        margin: 0 auto;\n', 'presentation'],
        ['radius added to sheet', SHEET_INK, SHEET_INK + '        border-radius: 8px;\n', 'presentation'],
        ['display added to sheet', SHEET_INK, SHEET_INK + '        display: grid;\n', 'presentation'],
        ['font added to body', BODY_INK, BODY_INK + '        font-family: Arial, sans-serif;\n', 'presentation'],
        ['margin added to body', BODY_INK, BODY_INK + '        margin: 0;\n', 'presentation'],
        ['width added to body', BODY_INK, BODY_INK + '        max-width: 48rem;\n', 'presentation'],
        ['inset edge became a border', 'box-shadow: inset 0 0 0 1px var(--oe-wb-line);', 'border: 1px solid var(--oe-wb-line);', 'presentation'],
        ['inset edge thickened', 'inset 0 0 0 1px', 'inset 0 0 0 2px', 'presentation'],
        ['inset edge became an outer shadow', 'box-shadow: inset 0 0 0 1px', 'box-shadow: 0 0 0 1px', 'presentation'],
    ]],
    ['tokens and declarations', [
        ['canvas swapped for paper', 'var(--oe-wb-canvas)', 'var(--oe-wb-paper)', 'presentation'],
        ['paper swapped for canvas', 'var(--oe-wb-paper)', 'var(--oe-wb-canvas)', 'presentation'],
        ['line swapped for petrol', 'var(--oe-wb-line)', 'var(--oe-wb-petrol)', 'presentation'],
        ['fallback added to token', 'var(--oe-wb-canvas)', 'var(--oe-wb-canvas, #f3f7f5)', 'presentation'],
        ['literal colour replaces token', 'var(--oe-wb-paper)', '#fff', 'presentation'],
        ['body ink removed', BODY_INK, '        background-color: var(--oe-wb-canvas);\n', 'presentation'],
        ['sheet ink removed', SHEET_INK, '        background-color: var(--oe-wb-paper);\n', 'presentation'],
        ['body ink swapped for muted', BODY_INK, '        color: var(--oe-wb-muted);\n        background-color: var(--oe-wb-canvas);\n', 'presentation'],
        ['body declarations reordered', BODY_INK, '        background-color: var(--oe-wb-canvas);\n        color: var(--oe-wb-ink);\n', 'presentation'],
        ['sheet edge removed', '        box-shadow: inset 0 0 0 1px var(--oe-wb-line);\n', '', 'presentation'],
    ]],
    ['selectors: gate, widening and extra control rules', [
        ['body gate dropped', BODY_SELECTOR, 'body.' + MARKER + ' {', 'presentation'],
        ['sheet gate dropped', SHEET_SELECTOR, 'body.' + MARKER + ' > .container {', 'presentation'],
        ['sheet gate switched to popup class', SHEET_SELECTOR, 'html.oe-workbench-popup body.' + MARKER + ' > .container {', 'presentation'],
        ['sheet widened to any descendant', '> .container {', '.container {', 'presentation'],
        ['sheet moved to rows', '> .container {', '> .container > .row {', 'presentation'],
        ['selector list widened', 'body.' + MARKER + ' {', 'body.' + MARKER + ', html.oe-workbench-context .modal-content {', 'presentation'],
        ['textarea palette rule added', ...addRule(rule('textarea', 'background-color: var(--oe-wb-paper);')), 'presentation'],
        ['textarea focus rule added', ...addRule(rule('textarea:focus', 'outline: 2px solid var(--oe-wb-petrol);')), 'presentation'],
        ['placeholder rule added', ...addRule(rule('textarea::placeholder', 'color: var(--oe-wb-muted);')), 'presentation'],
        ['validation rule added', ...addRule(rule('.is-invalid', 'border-color: var(--oe-wb-line);')), 'presentation'],
        ['button rule added', ...addRule(rule('.btn-cancel', 'color: var(--oe-wb-ink);')), 'presentation'],
        ['heading rule added', ...addRule(rule('h2', 'color: var(--oe-wb-ink);')), 'presentation'],
        ['wrapper rule added', ...addRule(rule('.row', 'padding: 0;')), 'presentation'],
    ]],
    ['ACL, session and CSRF', [
        ['bootstrap path changed', 'require_once("../globals.php");', 'require_once("../../globals.php");', 'original'],
        ['acl permission changed', "aclCheckCore('acct', 'eob', '', 'write')", "aclCheckCore('acct', 'eob', '', 'read')", 'original'],
        ['acl check inverted', 'if (!AclMain::', 'if (AclMain::', 'original'],
        ['acl deny replaced', 'AccessDeniedHelper::denyWithTemplate(', 'error_log(', 'original'],
        ['session line removed', '$session = SessionWrapperFactory::getInstance()->getActiveSession();\n', '', 'original'],
        ['csrf check removed', '        CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n', '', 'original'],
        ['csrf failure no longer dies', 'dieOnFail: true', 'dieOnFail: false', 'original'],
        ['csrf source changed', 'checkCsrfInput(INPUT_POST', 'checkCsrfInput(INPUT_GET', 'original'],
    ]],
    ['patient id and SQL', [
        ['patient id source changed', "$_GET['patient_id']", "$_REQUEST['patient_id']", 'original'],
        ['direct-access guard removed', '    if (!$patient_id) {', '    if (false) {', 'original'],
        ['preload query changed', 'Select billing_note From patient_data Where pid=?', 'Select * From patient_data Where pid=?', 'original'],
        ['save trigger changed', "isset($_POST['form_save'])", "!empty($_POST)", 'original'],
        ['note trim removed', 'trim((string) $_POST', '((string) $_POST', 'original'],
        ['note source changed', "$_POST['form_note']", "$_REQUEST['form_note']", 'original'],
        ['update table changed', 'UPDATE patient_data SET', 'UPDATE patient_data_audit SET', 'original'],
        ['update column widened', '"billing_note = ? "', '"billing_note = ?, genericname1 = ? "', 'original'],
        ['update bindings swapped', '[$thevalue, $patient_id]', '[$patient_id, $thevalue]', 'original'],
        ['display query columns changed', '"select fname, lname, billing_note "', '"select fname, mname, lname, billing_note "', 'original'],
        ['display query limit changed', 'limit 1', 'limit 2', 'original'],
    ]],
    ['escaping, action and hidden token', [
        ['heading name unescaped', "text($row['fname'])", "$row['fname']", 'original'],
        ['textarea value escaping changed', "attr($row['billing_note'])", "text($row['billing_note'])", 'original'],
        ['alert escaping removed', 'js_escape($info_msg)', '$info_msg', 'original'],
        ['placeholder escaping changed', "xla('Max 255 characters')", "xlt('Max 255 characters')", 'original'],
        ['action target changed', "action='sl_eob_patient_note.php?", "action='sl_eob_search.php?", 'original'],
        ['action escaping changed', 'attr_url($patient_id)', 'attr($patient_id)', 'original'],
        ['form method changed', "method='post'", "method='get'", 'original'],
        ['hidden token renamed', 'name="csrf_token_form"', 'name="csrf_token"', 'original'],
        ['hidden token exposed', '<input type="hidden" name="csrf_token_form"', '<input type="text" name="csrf_token_form"', 'original'],
        ['hidden token removed', '                <input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />\n', '', 'original'],
    ]],
    ['textarea, buttons, close, error and title', [
        ['textarea rows changed', 'rows="3"', 'rows="6"', 'original'],
        ['textarea maxlength changed', 'maxlength="255"', 'maxlength="1000"', 'original'],
        ['textarea placeholder removed', " placeholder='<?php echo xla('Max 255 characters') ?>'", '', 'original'],
        ['textarea name changed', "name='form_note'", "name='note'", 'original'],
        ['textarea class changed', "class='textarea form-control'", "class='form-control'", 'original'],
        ['label text changed', "<label><?php echo xlt('Max 255 characters') ?></label>", "<label><?php echo xlt('Note') ?></label>", 'original'],
        ['save became plain button', "<button type='submit' class=\"btn btn-primary btn-save\"", "<button type='button' class=\"btn btn-primary btn-save\"", 'original'],
        ['save name changed', "name='form_save'", "name='save'", 'original'],
        ['cancel no longer submits', "<button type='submit' class=\"btn btn-secondary btn-cancel\"", "<button type='button' class=\"btn btn-secondary btn-cancel\"", 'original'],
        ['cancel close removed', " onclick='dlgclose();'", '', 'original'],
        ['cancel close changed', "onclick='dlgclose();'", "onclick='window.close();'", 'original'],
        ['close after save removed', '        echo " dlgclose();\\n";\n', '', 'original'],
        ['info alert removed', '            echo " alert(" . js_escape($info_msg) . ");\\n";\n', '', 'original'],
        ['exit after save removed', '        exit();\n', '', 'original'],
        ['direct-access error text changed', 'You cannot access this page directly.', 'Access denied.', 'original'],
        ['direct-access error no longer stops', '        die(xlt(', '        echo(xlt(', 'original'],
        ['title changed', "xlt('EOB Posting - Patient Note'); ?></title>", "xlt('Billing Note'); ?></title>", 'original'],
        ['heading changed', "xlt('Billing Note for ')", "xlt('Billing Note: ')", 'original'],
        ['header asset added', "Header::setupHeader(['opener'])", "Header::setupHeader(['opener', 'datetime-picker'])", 'original'],
        ['header opener dropped', "Header::setupHeader(['opener'])", 'Header::setupHeader()', 'original'],
        ['container comment removed', '</div><!--end of container div-->', '</div>', 'original'],
    ]],
    ['arbitrary bytes', [
        ['trailing newline added', '</body>\n</html>\n', '</body>\n</html>\n\n', 'original'],
        ['byte order mark added', '<?php\n\n/**', '﻿<?php\n\n/**', 'original'],
        ['crlf line ending introduced', '<html>\n<head>\n', '<html>\r\n<head>\n', 'original'],
        ['tab indentation introduced', '    <div class="container">', '\t<div class="container">', 'original'],
        ['trailing space after </head>', HEAD_CLOSE, '</head> \n', 'original'],
        ['zero-width character in marker', MARKER + '">', MARKER + '​">', 'presentation'],
        ['author header removed', ' * @author    Roberto Vasquez <robertogagliotta@gmail.com>\n', '', 'original'],
    ]],
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
 * Returns null for a missing, displaced, duplicated or malformed addition, or
 * any residue of the presentation left behind.
 */
function restorePresentation(candidate) {
    if (typeof candidate !== 'string' || count(candidate, APPROVED_SEAM) !== 1 || count(candidate, STYLE_BLOCK) !== 1) {
        return null;
    }
    const restored = candidate.split(APPROVED_SEAM).join(ORIGINAL_SEAM);
    for (const residue of [MARKER, 'media=', 'oe-workbench', '<style', '</style>']) {
        if (restored.includes(residue)) {
            return null;
        }
    }
    return count(restored, BODY_ORIGINAL) === 1 ? restored : null;
}

/** Shared normalizer: identity without any presentation trace, else the strict inverse. */
function normalizeShared(source) {
    const traced = [MARKER, 'media=', 'oe-workbench', '<style', '</style>'].some((token) => source.includes(token));
    return traced ? restorePresentation(source) : source;
}

/**
 * Every reason a candidate is not the approved route. It restores the complete
 * candidate and compares it byte for byte with the frozen original, so any
 * change to any original byte, and any addition other than the approved one,
 * is a violation. Empty means accepted.
 */
function violations(candidate, fixture) {
    if (typeof candidate !== 'string' || typeof fixture !== 'string') {
        return ['candidate and frozen original must be source strings'];
    }
    const found = [];
    const restored = restorePresentation(candidate);
    if (restored === null) {
        found.push('no single approved presentation seam (or presentation residue remains)');
    } else if (restored !== fixture) {
        found.push('restored source differs from the frozen original (' + firstDifference(restored, fixture) + ')');
    }
    const normalized = normalizeShared(candidate);
    if (normalized !== fixture) {
        found.push('shared normalization does not yield the frozen original');
    }
    if (count(fixture, ORIGINAL_SEAM) !== 1 || candidate !== applyPresentation(fixture)) {
        found.push('candidate is not exactly the approved presentation of the frozen original');
    }
    return found;
}

function accepts(candidate, fixture) {
    return violations(candidate, fixture).length === 0;
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

/** Throws with the reason when a mutant is mishandled; preconditions run outside the rejection assertion. */
function checkMutant(candidate, fixture, [label, search, replacement, scope]) {
    assert(accepts(candidate, fixture), label + ': baseline candidate must be accepted before mutation');
    assert(scope === 'original' || scope === 'presentation', label + ': unknown scope ' + scope);
    if (scope === 'original') {
        assert(count(fixture, search) === 1, label + ': anchor must be unique in the frozen original: ' + JSON.stringify(search));
    } else {
        assert(count(fixture, search) === 0, label + ': presentation anchor must not exist in the frozen original');
    }
    assert(count(candidate, search) === 1, label + ': anchor must be unique in the candidate: ' + JSON.stringify(search));
    const edited = replaceOnce(candidate, search, replacement);
    assert(edited !== candidate, label + ': mutant must change the candidate');
    // Expected rejection.
    assert(violations(edited, fixture).length > 0, label + ': mutant was accepted');
    const normalized = normalizeShared(edited);
    assert(normalized === null || normalized !== fixture, label + ': mutant normalizes to the frozen original');
}

function portableChecks() {
    const fixture = () => read(FIXTURE);
    const live = () => read(ROUTE);
    const candidate = () => applyPresentation(fixture());

    const checks = [
        ['frozen original keeps every ACL, session, patient id, SQL, CSRF, save/close, escaping and control line in order', () => {
            const source = fixture();
            const lines = source.split('\n');
            let cursor = -1;
            for (const expected of PRESERVED_LINES) {
                assert(lines.filter((line) => line === expected).length === 1, 'original line not unique: ' + JSON.stringify(expected));
                const at = lines.indexOf(expected);
                assert(at > cursor, 'original line out of order: ' + JSON.stringify(expected));
                cursor = at;
            }
            assert(source.startsWith('<?php\n\n/**\n'), 'original must start with <?php and the docblock');
            assert(source.endsWith('</body>\n</html>\n'), 'original must end with </body></html> and one newline');
            assert(!source.includes('\r') && !source.includes('\t') && !source.includes('﻿'), 'original must be LF, space-indented and BOM-free');
            assert(lines.length === 94, 'original must have 93 lines plus the final newline, got ' + (lines.length - 1));
        }],
        ['frozen original pins its controls, queries, escaping and absent presentation', () => {
            for (const [token, expected] of FIXTURE_PINS) {
                assert(count(fixture(), token) === expected, 'original count of ' + JSON.stringify(token) + ' is ' + count(fixture(), token) + ', expected ' + expected);
            }
            assert(count(fixture(), ORIGINAL_SEAM) === 1, 'original <title></head><body> seam missing');
        }],
        ['approved block has exactly two screen-only workbench-gated rules and nothing else', () => {
            assert(STYLE_BLOCK.startsWith('    <style media="screen">\n') && STYLE_BLOCK.endsWith('    </style>\n'), 'block must be one screen-only style element');
            assert(count(STYLE_BLOCK, '<style') === 1 && count(STYLE_BLOCK, '      }\n\n      html') === 1, 'one style tag, rules separated by one blank line');
            const { rules, leftover } = parseRules(STYLE_BLOCK);
            assert(leftover === '\n', 'unexpected text between rules: ' + JSON.stringify(leftover));
            assert(JSON.stringify(rules) === JSON.stringify(APPROVED_RULES), 'rules differ from the approved selectors/declarations');
            assert(count(STYLE_BLOCK, 'oe-workbench-context') === 2 && count(STYLE_BLOCK, MARKER) === 2, 'both selectors must be gated and scoped to the marker');
            assert(count(STYLE_BLOCK, 'box-shadow: inset 0 0 0 1px var(--oe-wb-line);') === 1, 'the only edge is the inset 1px line');
            for (const forbidden of ['padding', 'margin', 'font', 'width', 'height', 'radius', 'border', 'outline', 'display', 'position', 'flex', 'grid', 'focus', 'placeholder', 'textarea', 'valid', 'print', '@media', '!important', 'url(', '@import', '/*', '.row', '.col', '.form', '.btn', 'h2', 'label', 'button', '#', 'muted', 'petrol', 'opacity', 'transition', 'min-', 'max-']) {
                assert(!STYLE_BLOCK.includes(forbidden), 'approved block must not contain ' + forbidden);
            }
        }],
        ['every approved token is defined in the workbench scope of popup.css, which autoloads', () => {
            const css = read(POPUP_CSS);
            const scope = css.indexOf('html.oe-workbench-context,\n  body.workbench-active > .dialogModal {');
            assert(css.indexOf('@media screen {') >= 0 && scope > css.indexOf('@media screen {'), 'workbench token scope missing from screen media in popup.css');
            const tokens = css.slice(scope, css.indexOf('}', scope));
            for (const token of TOKENS) {
                assert(count(tokens, '    ' + token + ': ') === 1, 'popup.css does not define ' + token + ' in the workbench scope');
                assert(STYLE_BLOCK.includes('var(' + token + ')'), 'approved block does not use ' + token);
            }
            const asset = "  workbench-popup:\n    basePath: '%webroot%/interface/clinical-workspace/'\n    script: popup.js\n    link: popup.css\n    autoload: true\n";
            assert(count(read(ASSET_CONFIG), asset) === 1, 'workbench-popup must stay an autoloaded asset so setupHeader([\'opener\']) loads the tokens');
        }],
        ['untouched original is identity in the shared normalizer and is not accepted', () => {
            assertSameSource(normalizeShared(fixture()), fixture(), 'shared normalization of the untouched original');
            assert(restorePresentation(fixture()) === null, 'strict inverse must reject a route without the presentation');
            assert(!accepts(fixture(), fixture()), 'untouched original must not satisfy production acceptance');
        }],
        ['synthetic fully adapted candidate passes production acceptance', () => {
            assert(candidate() !== fixture(), 'candidate must differ from the original');
            const found = violations(candidate(), fixture());
            assert(found.length === 0, 'candidate violations: ' + found.join('; '));
        }],
        ['synthetic candidate restores byte-for-byte to the frozen original', () => {
            assertSameSource(restorePresentation(candidate()), fixture(), 'strict inverse of the candidate');
            assertSameSource(normalizeShared(candidate()), fixture(), 'shared normalization of the candidate');
        }],
        ['synthetic candidate adds exactly the declared block and body class at the declared positions', () => {
            const original = fixture();
            const at = original.indexOf(ORIGINAL_SEAM);
            const expected = original.slice(0, at) + TITLE_LINE + STYLE_BLOCK + HEAD_CLOSE + BODY_APPROVED + original.slice(at + ORIGINAL_SEAM.length);
            assertSameSource(candidate(), expected, 'candidate');
            assert(candidate().length - original.length === STYLE_BLOCK.length + BODY_APPROVED.length - BODY_ORIGINAL.length, 'candidate added unexpected bytes');
            assert(count(candidate(), TITLE_LINE + STYLE_BLOCK + HEAD_CLOSE + BODY_APPROVED) === 1, 'block must follow <title> and end directly before </head><body>');
            assert(count(candidate(), BODY_APPROVED) === 1 && count(candidate(), MARKER) === 3, 'marker must be on <body> once and in the two selectors only');
            assert(count(candidate(), '<style') === 1 && count(candidate(), 'media="screen"') === 1, 'exactly one added style element');
            for (const token of INVENTORY) {
                assert(count(candidate(), token) === count(original, token), 'candidate changed the count of ' + JSON.stringify(token));
            }
        }],
        ['every single-line edit, deletion or duplication anywhere in the candidate is rejected', () => {
            const base = candidate();
            const lines = base.split('\n');
            const failures = [];
            for (let i = 0; i < lines.length; i++) {
                const variants = [
                    lines.slice(0, i).concat([lines[i] + 'x'], lines.slice(i + 1)),
                    lines.slice(0, i).concat(lines.slice(i + 1)),
                    lines.slice(0, i + 1).concat([lines[i]], lines.slice(i + 1)),
                ];
                for (const variant of variants) {
                    const edited = variant.join('\n');
                    assert(edited !== base, 'line ' + (i + 1) + ': edit did not change the candidate');
                    if (accepts(edited, fixture())) {
                        failures.push('line ' + (i + 1) + ' ' + JSON.stringify(lines[i]));
                    }
                }
            }
            assert(failures.length === 0, 'accepted arbitrary edits: ' + failures.join(', '));
        }],
    ];

    for (const [group, mutants] of MUTANT_GROUPS) {
        checks.push(['mutants rejected: ' + group, () => {
            const errors = [];
            for (const mutant of mutants) {
                try {
                    checkMutant(candidate(), fixture(), mutant);
                } catch (error) {
                    errors.push(error.message);
                }
            }
            assert(errors.length === 0, errors.join('\n'));
        }]);
    }

    checks.push(
        ['caller keeps the modal-sm 275 npopup open from the billing-note column', () => {
            const caller = read(CALLER);
            assert(count(caller, CALLER_OPEN) === 1, 'npopup block changed');
            assert(count(caller, 'sl_eob_patient_note.php') === 1, 'caller must reach the route exactly once');
            assert(count(caller, CALLER_CLICK) === 1, 'npopup row click changed');
            assert(count(caller, "Header::setupHeader(['datetime-picker']);") === 1, 'caller Header changed');
        }],
        // Live production checks run last: the synthetic candidate above must already pass.
        ['live route normalizes to the frozen original in the shared normalizer', () => {
            assertSameSource(normalizeShared(live()), fixture(), 'shared normalization of ' + ROUTE);
        }],
        ['live route has no violations (restores byte-for-byte to the frozen original)', () => {
            assert(accepts(candidate(), fixture()), 'synthetic candidate must be accepted before checking the live route');
            const found = violations(live(), fixture());
            assert(found.length === 0, ROUTE + ' violations: ' + found.join('; '));
        }],
        ['live route equals the approved presentation candidate', () => {
            assert(accepts(candidate(), fixture()), 'synthetic candidate must be accepted before checking the live route');
            assertSameSource(live(), candidate(), ROUTE);
        }],
    );

    return checks;
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
        ['history: caller, Header, asset config, popup CSS/JS, dialog and opener helpers unchanged from base', () => {
            for (const file of UNCHANGED_FILES) {
                assertSameSource(read(file), baseBlob(file), file);
            }
        }],
        ['history: themes and shared workbench sources unchanged from base', () => {
            const touched = changedSinceBase(UNCHANGED_TREES);
            assert(touched.length === 0, 'shared sources changed: ' + touched.join(', '));
        }],
        ['history: only the route changed inside interface/billing', () => {
            const touched = changedSinceBase(['interface/billing']).filter((file) => file !== ROUTE);
            assert(touched.length === 0, 'other billing files changed: ' + touched.join(', '));
        }],
        ['history: changed and untracked files stay inside the five-file OPEMR-52 scope', () => {
            const changed = git(['diff', '--name-only', BASE_SHA, '--'])
                .concat(git(['ls-files', '--others', '--exclude-standard']))
                .split('\n')
                .filter(Boolean);
            const outside = [...new Set(changed)].filter((file) => !CHANGE_SCOPE.includes(file));
            assert(outside.length === 0, 'changes outside scope: ' + outside.join(', '));
            for (const file of [FIXTURE, CONTRACT, JEST_TEST, DOC]) {
                assert(fs.existsSync(path.join(ROOT, file)), 'scope file missing: ' + file);
            }
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
    MUTANT_GROUPS,
    ORIGINAL_SEAM,
    STYLE_BLOCK,
    accepts,
    applyPresentation,
    historyChecks,
    historyRequested,
    normalizeShared,
    portableChecks,
    restorePresentation,
    violations,
};

if (require.main === module) {
    // node:test is built in; works with `node --test <file>` and plain `node <file>`.
    const { test } = require('node:test');
    const checks = portableChecks().concat(historyRequested(process.argv.slice(2), process.env) ? historyChecks() : []);
    for (const [label, check] of checks) {
        test(label, check);
    }
}
