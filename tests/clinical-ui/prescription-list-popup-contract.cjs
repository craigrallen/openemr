// Portable, static contract. The production Twig and PHP are never executed here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const SOURCE = 'templates/prescription/general_list.html.twig';
const FIXTURE = 'tests/clinical-ui/fixtures/prescription-list-original.html.twig.txt';
const HISTORY_REF = '09b29da7771aea334ed5745e058751157af980d7';
const SUPPORT = [
    'interface/forms/eye_mag/js/eye_base.php',
    'interface/patient_file/summary/demographics.php',
    'controllers/C_Prescription.class.php',
    'src/Core/Header.php',
    'interface/clinical-workspace/popup.js',
    'interface/clinical-workspace/popup.css',
];
const SCOPE = 'html.oe-workbench-context body.oe-prescription-list-document';
const BODY_BEFORE = '<body id="prescription_list">';
const BODY_AFTER = '<body id="prescription_list" class="oe-prescription-list-document">';
const HEAD_END = '\n</head>';
const TABLE = `${SCOPE} .prescription_list .table-responsive > table.table.table-hover`;
const ADDED_STYLE = `
<style>
@media screen {
  ${SCOPE} > .container-fluid {
    max-width: 1100px;
    width: calc(100% - 24px);
    margin: 12px auto;
    padding: clamp(12px, 2vw, 24px);
    box-sizing: border-box;
    border: 1px solid #d6e1e4;
    border-radius: 8px;
    background-color: #fff;
    color: #243c43;
  }

  ${SCOPE} > .container-fluid > .row {
    min-width: 0;
  }

  ${SCOPE} #prescription-btn-navbar {
    align-items: center;
    padding-block: 8px;
    flex-wrap: wrap;
    gap: 8px;
  }

  ${SCOPE} #prescription-btn-navbar > .btn-group {
    max-width: 100%;
    flex-wrap: wrap;
    gap: 8px;
  }

  ${SCOPE} #prescription-btn-navbar .btn-group > .btn {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  ${SCOPE} .prescription_list {
    min-width: 0;
    max-width: 100%;
  }

  ${SCOPE} .prescription_list .table-responsive {
    overflow-x: auto;
    max-width: 100%;
  }

  ${TABLE} {
    min-width: 64rem;
    color: #243c43;
    background-color: #fff;
  }

  ${TABLE} > tbody > tr:hover > td {
    color: #243c43;
    background-color: #eaf2f2;
  }

  ${SCOPE} #prescription-btn-navbar .small {
    color: #086878;
  }

  ${SCOPE} > .container-fluid > .row:last-child > .col-12.d-flex.justify-content-end {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>`;

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const count = (text, needle) => text.split(needle).length - 1;

function requireOnce(text, needle, label) {
    assert.equal(count(text, needle), 1, `${label} must occur exactly once`);
}

function insertPresentation(original) {
    requireOnce(original, BODY_BEFORE, 'original body seam');
    requireOnce(original, HEAD_END, 'original first head seam');
    assert.equal(count(original, BODY_AFTER), 0, 'fixture must lack document class');
    assert.equal(count(original, ADDED_STYLE), 0, 'fixture must lack added style');
    return original.replace(BODY_BEFORE, BODY_AFTER)
        .replace(HEAD_END, `${ADDED_STYLE}${HEAD_END}`);
}

function verifyStyle(style) {
    assert.match(style, /^\n<style>\n@media screen \{\n/);
    assert.match(style, /\n\}\n<\/style>$/);
    assert.equal(style, ADDED_STYLE, 'only the frozen screen rules are permitted');
    assert.doesNotMatch(style, /!important|@media\s+print|\b(?:display|visibility|order|font(?:-[\w-]+)?)\s*:/i);
    assert.doesNotMatch(style, /\b(?:button|card|input|badge|alert|warning)\b\s*\{/i);
    const selectors = [...style.matchAll(/^  ([^{}\n]+) \{\n/gm)].map((match) => match[1]);
    assert.deepEqual(selectors, [
        `${SCOPE} > .container-fluid`,
        `${SCOPE} > .container-fluid > .row`,
        `${SCOPE} #prescription-btn-navbar`,
        `${SCOPE} #prescription-btn-navbar > .btn-group`,
        `${SCOPE} #prescription-btn-navbar .btn-group > .btn`,
        `${SCOPE} .prescription_list`,
        `${SCOPE} .prescription_list .table-responsive`,
        TABLE,
        `${TABLE} > tbody > tr:hover > td`,
        `${SCOPE} #prescription-btn-navbar .small`,
        `${SCOPE} > .container-fluid > .row:last-child > .col-12.d-flex.justify-content-end`,
    ]);
    assert.ok(selectors.every((selector) => selector.startsWith(SCOPE)), 'every rule is scoped');
    assert.match(style, /\.table-responsive \{\n    overflow-x: auto;\n    max-width: 100%;\n/);
    assert.match(style, /table\.table\.table-hover \{\n    min-width: 64rem;\n    color: #243c43;\n    background-color: #fff;\n/);
    assert.match(style, /tbody > tr:hover > td \{\n    color: #243c43;\n    background-color: #eaf2f2;\n/);
}

function verifyPresentation(source, original) {
    requireOnce(source, BODY_AFTER, 'document body class');
    requireOnce(source, ADDED_STYLE, 'inline screen style');
    assert.equal(count(source, BODY_BEFORE), 0, 'old body seam must be replaced');
    assert.equal(count(source, '<style>'), count(original, '<style>') + 1);
    assert.equal(count(source, '<script'), count(original, '<script'), 'no script may be added');
    assert.equal(count(source, '<link'), count(original, '<link'), 'no asset may be added');
    const restored = source.replace(BODY_AFTER, BODY_BEFORE).replace(ADDED_STYLE, '');
    assert.equal(restored, original, 'every original Twig, JavaScript, and HTML byte must survive');
    assert.equal(source, insertPresentation(original), 'only the two declared seams may change');
    assert.ok(source.indexOf(ADDED_STYLE) < source.indexOf(HEAD_END), 'style precedes first head end');
    assert.ok(source.indexOf(HEAD_END) < source.indexOf(BODY_AFTER), 'body follows head');
    verifyStyle(ADDED_STYLE);
}

function rejectMutation(valid, original, label, before, after) {
    requireOnce(valid, before, `${label} mutation anchor`);
    const mutant = valid.replace(before, after);
    assert.notEqual(mutant, valid, `${label} must change source`);
    assert.throws(() => verifyPresentation(mutant, original), undefined, `${label} must fail`);
}

function git(args) {
    const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.ifError(run.error);
    assert.equal(run.status, 0, `git ${args[0]} failed: ${run.stderr}`);
    return run.stdout;
}

function verifyHistory(original) {
    assert.equal(git(['show', `${HISTORY_REF}:${SOURCE}`]), original,
        'whole fixture must equal the pinned original template');
    for (const file of SUPPORT) {
        assert.equal(read(file), git(['show', `${HISTORY_REF}:${file}`]),
            `support source changed from pinned base: ${file}`);
    }
    const allowed = [
        SOURCE,
        FIXTURE,
        'tests/clinical-ui/prescription-list-popup-contract.cjs',
        'tests/js/prescription-list-popup.test.js',
        'docs/clinical-ui/PRESCRIPTION-LIST-POPUP.md',
    ].sort();
    const changed = new Set([
        git(['diff', '--name-only', HISTORY_REF, 'HEAD']),
        git(['diff', '--name-only', 'HEAD']),
        git(['ls-files', '--others', '--exclude-standard']),
    ].flatMap((list) => list.split('\n').filter(Boolean)));
    assert.deepEqual([...changed].sort(), allowed, 'final delta must have exactly five declared paths');
}

const original = read(FIXTURE);
const source = read(SOURCE);

test('native prescription list has exactly the screen presentation', () => {
    verifyPresentation(source, original);
});

test('untouched source is RED and synthetic two-seam insertion is valid', () => {
    assert.throws(() => verifyPresentation(original, original), /document body class/);
    verifyPresentation(insertPresentation(original), original);
});

test('style is screen-only, scoped, scrollable, and uses paired table colors', () => {
    verifyStyle(ADDED_STYLE);
});

test('caller dialogs, controller template choice, and Header popup context stay native', () => {
    const eye = read(SUPPORT[0]);
    assert.match(eye, /function editScripts\(url\) \{[\s\S]*?dlgopen\(url, 'editScripts', w, 400,[\s\S]*?type: 'iframe'/);
    assert.ok(eye.includes('iam.location.href = base + "/controller.php?prescription&list&" + params;'));
    const demographics = read(SUPPORT[1]);
    assert.match(demographics, /function editScripts\(url\) \{[\s\S]*?dlgopen\(url, 'editScripts', 'modal-xl', 400,[\s\S]*?type: 'iframe'/);
    assert.ok(demographics.includes("if (OEGlobalsBag::getInstance()->getBoolean('erx_enable'))"));
    assert.ok(demographics.includes('/controller.php?prescription&list&id='));
    const controller = read(SUPPORT[2]);
    assert.match(controller, /public function list_action\(\$id, \$sort = "", \$printPrescriptionId = null\)/);
    assert.match(controller, /\$vars\['rx_zend_pdf_template'\][\s\S]*?\$vars\['rx_zend_html_template'\][\s\S]*?\$vars\['rx_use_fax_template'\]/);
    assert.match(controller, /render\("prescription\/" \. \$this->template_mod \. "_list\.html\.twig", \$vars\)/);
    assert.match(read(SUPPORT[3]), /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(read(SUPPORT[4]), /CONTEXT_CLASS = 'oe-workbench-context'[\s\S]*?set\(CONTEXT_CLASS, active\)/);
    assert.match(read(SUPPORT[5]), /@media screen \{[\s\S]*?html\.oe-workbench-context/);
});

test('native selection and clinical action anchors remain in the fixture', () => {
    for (const fragment of [
        "prescriptionButtons = ['multiprint', 'multiprintcss', 'multiprintToFax']",
        "{% if rx_send_email %}",
        'toggleEmailPrescriptionSection(evt)',
        'toggleClass("d-none")',
        'attr("disabled", "disabled")',
        'function Check(chk)',
        'function Uncheck(chk)',
        'function updateCheckAllState()',
        'id="check_all"',
        'csrf_token_form: {{CSRF_TOKEN_FORM|js_escape}}',
        'top.restoreSession();',
        'function deleteDrug(d)',
        '{% if rx_zend_pdf_template %}',
        '{% if rx_zend_html_template %}',
        '{%if rx_use_fax_template%}',
        '{% if faxSignatureMissing %}data-signature-missing="true"{% endif %}',
        'getDefaultMailClientText&ids=',
        '{% if printPrescriptionId %}',
        'window.open(printUrl, \'_blank\')',
        'prescription.get_dosage_display()|text',
        'prescription.provider.get_name_display()|text',
        'prescription.erx_source is empty or prescription.erx_source==0',
        'prescription.active <= 0 %} inactive',
        'prescription.drug|text',
        'prescription.id|attr_url',
        'session.pid|js_url',
        'class="btn-secondary btn-sm quitButton"',
    ]) assert.ok(original.includes(fragment), `missing native fragment: ${fragment}`);
});

test('selection, disabled state, CSRF, delete, fax, email, print, escaping, session, dosage, eRx, inactive, provider, and conditional Twig mutations fail', () => {
    const valid = insertPresentation(original);
    const mutations = [
        ['selection', 'function Check(chk) {', 'function CheckNothing(chk) {'],
        ['check all', 'id="check_all"', 'id="check_none"'],
        ['disabled email selection', '$(".prescription_list input:checked").attr("disabled", "disabled")', '$(".prescription_list input:checked").attr("enabled", "enabled")'],
        ['CSRF', 'csrf_token_form: {{CSRF_TOKEN_FORM|js_escape}}', 'csrf_token_form: null'],
        ['delete route', 'url: "./library/deletedrug.php"', 'url: "./library/noop.php"'],
        ['fax constraint', '[CheckForChecksConstraint, checkFaxSignatureConfiguredConstraint]', '[CheckForChecksConstraint]'],
        ['email visibility', 'section.toggleClass("d-none")', 'section.show()'],
        ['email form', 'action="{{TOP_ACTION}}send"', 'action="#"'],
        ['print opening', "window.open(printUrl, '_blank');", 'void printUrl;'],
        ['RxNorm escaping', 'prescription.rxnorm_drugcode|text', 'prescription.rxnorm_drugcode|raw'],
        ['session restore', 'return top.restoreSession();', 'return true;'],
        ['dosage display', 'prescription.get_dosage_display()|text', 'prescription.dosage|text'],
        ['eRx edit condition', '{% if prescription.erx_source is empty or prescription.erx_source==0 %}\n                                            <td class="editscript"', '{% if prescription.erx_source is not empty %}\n                                            <td class="editscript"'],
        ['inactive class', 'prescription.active <= 0 %} inactive', 'prescription.active <= 0 %} active'],
        ['provider link', 'prescription.provider.get_name_display()|text', 'prescription.provider.id|text'],
        ['PDF template condition', '{% if rx_zend_pdf_template %}', '{% if false %}'],
        ['HTML template condition', '{% if rx_zend_html_template %}', '{% if false %}'],
        ['fax template condition', '{%if rx_use_fax_template%}', '{%if false %}'],
        ['email template condition', '{% if rx_send_email %}\n                        <a id="multiprintSendEmail"', '{% if false %}\n                        <a id="multiprintSendEmail"'],
    ];
    for (const [label, before, after] of mutations) rejectMutation(valid, original, label, before, after);
});

test('media, scope, overflow, colors, and forbidden presentation mutations fail', () => {
    const valid = insertPresentation(original);
    const mutations = [
        ['screen media', '@media screen {', '@media print {'],
        ['workbench scope', `${SCOPE} > .container-fluid {`, 'body > .container-fluid {'],
        ['container width', 'width: calc(100% - 24px);', 'width: 100%;'],
        ['table overflow', 'overflow-x: auto;', 'overflow-x: hidden;'],
        ['table ink', 'min-width: 64rem;\n    color: #243c43;', 'min-width: 64rem;\n    color: #fff;'],
        ['table paper', `  ${TABLE} {\n    min-width: 64rem;\n    color: #243c43;\n    background-color: #fff;`, `  ${TABLE} {\n    min-width: 64rem;\n    color: #243c43;\n    background-color: #243c43;`],
        ['hover ink', `  ${TABLE} > tbody > tr:hover > td {\n    color: #243c43;`, `  ${TABLE} > tbody > tr:hover > td {\n    color: #fff;`],
        ['hover paper', 'background-color: #eaf2f2;', 'background-color: #243c43;'],
        ['email link ink', 'color: #086878;', 'color: #fff;'],
        ['hidden state', '    overflow-wrap: anywhere;', '    overflow-wrap: anywhere;\n    display: none;'],
        ['important', '    border-radius: 8px;', '    border-radius: 8px !important;'],
        ['added script', ADDED_STYLE, `${ADDED_STYLE}\n<script src="extra.js"></script>`],
        ['added stylesheet', ADDED_STYLE, `${ADDED_STYLE}\n<link rel="stylesheet" href="extra.css">`],
    ];
    for (const [label, before, after] of mutations) rejectMutation(valid, original, label, before, after);
});

test('duplicate and relocated seams fail', () => {
    const valid = insertPresentation(original);
    const mutations = [
        ['duplicate body', BODY_AFTER, BODY_AFTER + BODY_AFTER],
        ['duplicate style', ADDED_STYLE, ADDED_STYLE + ADDED_STYLE],
        ['style after head', `${ADDED_STYLE}${HEAD_END}`, `${HEAD_END}${ADDED_STYLE}`],
        ['old and new body', BODY_AFTER, BODY_BEFORE + BODY_AFTER],
    ];
    for (const [label, before, after] of mutations) rejectMutation(valid, original, label, before, after);
});

if (process.argv.includes('--history')) {
    test('pinned whole fixture, support sources, and exact final five-path delta', () => {
        verifyHistory(original);
    });
}

module.exports = { ADDED_STYLE, BODY_AFTER, BODY_BEFORE, SCOPE, insertPresentation, verifyPresentation, verifyStyle };
