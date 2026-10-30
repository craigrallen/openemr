// Static, portable contract. Twig, PHP, and the prescription controller are never executed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const SOURCE = 'templates/prescription/general_edit.html.twig';
const FIXTURE = 'tests/clinical-ui/fixtures/prescription-editor-original.html.twig.txt';
const BASE = '09b29da7771aea334ed5745e058751157af980d7';
const SUPPORT = [
    'templates/prescription/_dispense_drug.html.twig',
    'templates/prescription/general_list.html.twig',
    'interface/forms/eye_mag/js/eye_base.php',
    'interface/patient_file/summary/demographics.php',
    'controllers/C_Prescription.class.php',
    'interface/clinical-workspace/popup.js',
    'interface/clinical-workspace/popup.css',
    'src/Core/Header.php',
];
const SCOPE = 'html.oe-workbench-context body.oe-prescription-editor-document';
const BODY_BEFORE = '<body id="prescription_edit">';
const BODY_AFTER = '<body id="prescription_edit" class="oe-prescription-editor-document">';
const HEAD_END = '\n</head>';
const ADDED_STYLE = `
<style>
@media screen {
  ${SCOPE} > .container-xl {
    width: calc(100% - 24px);
    max-width: 1000px;
    margin: 12px auto;
    padding: clamp(12px, 2vw, 24px);
    box-sizing: border-box;
    border: 1px solid #d6e1e4;
    border-radius: 8px;
    background-color: #fff;
    color: #243c43;
  }

  ${SCOPE} #prescribe {
    min-width: 0;
  }

  ${SCOPE} #prescribe::after {
    content: '';
    display: block;
    clear: both;
  }

  ${SCOPE} #prescribe .row {
    margin-left: 0;
    margin-right: 0;
    margin-inline: 0;
    min-width: 0;
  }

  ${SCOPE} #prescribe .form-group.row > .col {
    flex: 1 1 10rem;
    min-width: 0;
  }

  ${SCOPE} #prescribe .form-control {
    max-width: 100%;
    min-width: 0;
  }

  ${SCOPE} .prescription-controls {
    width: 100%;
    table-layout: fixed;
  }

  ${SCOPE} .prescription-controls tr > td:first-child {
    width: 3rem;
    vertical-align: top;
  }

  ${SCOPE} .prescription-controls tr > td:nth-child(2) {
    white-space: normal;
  }

  ${SCOPE} .prescription-controls .btn,
  ${SCOPE} #prescribe > .row > .col-12 > .btn {
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  ${SCOPE} #druglookup {
    color: #086878;
  }
}
</style>`;

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const count = (text, needle) => text.split(needle).length - 1;

function once(text, needle, label) {
    assert.equal(count(text, needle), 1, `${label} must occur exactly once`);
}

function insertPresentation(original) {
    once(original, HEAD_END, 'first head end');
    once(original, BODY_BEFORE, 'original body');
    assert.equal(count(original, BODY_AFTER), 0);
    assert.equal(count(original, ADDED_STYLE), 0);
    return original.replace(HEAD_END, `${ADDED_STYLE}${HEAD_END}`)
        .replace(BODY_BEFORE, BODY_AFTER);
}

function verifyStyle(style) {
    assert.equal(style, ADDED_STYLE, 'the exact frozen screen CSS is required');
    assert.match(style, /^\n<style>\n@media screen \{\n/);
    assert.match(style, /\n\}\n<\/style>$/);
    assert.doesNotMatch(style, /!important|@media\s+print|\b(?:visibility|order|font(?:-[\w-]+)?)\s*:/i);
    assert.doesNotMatch(style, /\bdisplay\s*:\s*(?:none|contents|flex|grid)/i);
    const selectors = [...style.matchAll(/^  ([^{}\n]+)(?: \{|,)$/gm)].map((match) => match[1]);
    assert.deepEqual(selectors, [
        `${SCOPE} > .container-xl`,
        `${SCOPE} #prescribe`,
        `${SCOPE} #prescribe::after`,
        `${SCOPE} #prescribe .row`,
        `${SCOPE} #prescribe .form-group.row > .col`,
        `${SCOPE} #prescribe .form-control`,
        `${SCOPE} .prescription-controls`,
        `${SCOPE} .prescription-controls tr > td:first-child`,
        `${SCOPE} .prescription-controls tr > td:nth-child(2)`,
        `${SCOPE} .prescription-controls .btn`,
        `${SCOPE} #prescribe > .row > .col-12 > .btn`,
        `${SCOPE} #druglookup`,
    ]);
    assert.ok(selectors.every((selector) => selector.startsWith(SCOPE)), 'every selector is contextual');
    assert.match(style, /background-color: #fff;\n    color: #243c43;/, 'paper and ink travel together');
    assert.match(style, /#druglookup \{\n    color: #086878;/, 'lookup link keeps explicit contrast');
    assert.match(style, /margin-left: 0;\n    margin-right: 0;\n    margin-inline: 0;/, 'physical fallback precedes logical margin');
}

function verifyPresentation(source, original) {
    once(source, BODY_AFTER, 'document body');
    once(source, ADDED_STYLE, 'inline screen style');
    assert.equal(count(source, BODY_BEFORE), 0);
    assert.equal(count(source, '<style>'), count(original, '<style>') + 1);
    assert.equal(count(source, '<script'), count(original, '<script'), 'no scripts added');
    assert.equal(count(source, '<link'), count(original, '<link'), 'no assets added');
    assert.equal(source.replace(BODY_AFTER, BODY_BEFORE).replace(ADDED_STYLE, ''), original,
        'all original Twig, controls, conditional branches, scripts, and bytes survive');
    assert.equal(source, insertPresentation(original), 'only the two declared seams may change');
    once(source, HEAD_END, 'head end');
    assert.ok(source.indexOf(ADDED_STYLE) < source.indexOf(HEAD_END));
    assert.ok(source.indexOf(HEAD_END) < source.indexOf(BODY_AFTER));
    verifyStyle(ADDED_STYLE);
}

function rejectMutation(valid, original, label, before, after) {
    once(valid, before, `${label} anchor`);
    const mutant = valid.replace(before, after);
    assert.notEqual(mutant, valid, `${label} must change the candidate`);
    assert.throws(() => verifyPresentation(mutant, original), undefined, `${label} must fail`);
}

function git(args) {
    const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.ifError(run.error);
    assert.equal(run.status, 0, `git ${args[0]} failed: ${run.stderr}`);
    return run.stdout;
}

function verifyHistory(original) {
    assert.equal(git(['show', `${BASE}:${SOURCE}`]), original, 'fixture must equal the pinned original');
    for (const file of SUPPORT) {
        assert.equal(read(file), git(['show', `${BASE}:${file}`]), `support source changed: ${file}`);
    }
    const allowed = [
        SOURCE,
        FIXTURE,
        'tests/clinical-ui/prescription-editor-popup-contract.cjs',
        'tests/js/prescription-editor-popup.test.js',
        'docs/clinical-ui/PRESCRIPTION-EDITOR-POPUP.md',
    ].sort();
    const changed = new Set([
        git(['diff', '--name-only', BASE, 'HEAD']),
        git(['diff', '--name-only', 'HEAD']),
        git(['ls-files', '--others', '--exclude-standard']),
    ].flatMap((list) => list.split('\n').filter(Boolean)));
    assert.deepEqual([...changed].sort(), allowed, 'final delta must contain exactly five paths');
}

const original = read(FIXTURE);
const source = read(SOURCE);

test('editor has exactly the contextual screen presentation', () => {
    verifyPresentation(source, original);
});

test('untouched source is RED and synthetic two-seam insertion is valid', () => {
    assert.throws(() => verifyPresentation(original, original), /document body/);
    verifyPresentation(insertPresentation(original), original);
});

test('frozen CSS supplies paper, ink, native wrapping, and no semantic restyling', () => {
    verifyStyle(ADDED_STYLE);
});

test('native controller, caller, and popup context paths remain available', () => {
    assert.match(read(SUPPORT[2]), /function editScripts\(url\) \{[\s\S]*?controller\.php\?prescription&edit&[\s\S]*?dlgopen\(url, 'editScripts', w, 400,[\s\S]*?type: 'iframe'/);
    assert.match(read(SUPPORT[3]), /function editScripts\(url\) \{[\s\S]*?dlgopen\(url, 'editScripts', 'modal-xl', 400,[\s\S]*?type: 'iframe'/);
    assert.match(read(SUPPORT[1]), /class='editscript btn btn-primary btn-sm btn-edit'[\s\S]*?prescription&edit&id=/);
    assert.match(read(SUPPORT[4]), /public function __construct\(\)[\s\S]*?public function default_action\(\): string[\s\S]*?prescription\/" \. \$this->template_mod \. "_edit\.html\.twig"[\s\S]*?public function edit_action\(/);
    assert.match(read(SUPPORT[5]), /CONTEXT_CLASS = 'oe-workbench-context'/);
    assert.match(read(SUPPORT[6]), /@media screen \{[\s\S]*?html\.oe-workbench-context/);
    assert.match(read(SUPPORT[7]), /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
});

test('original fixture includes clinical controls, conditionals, escaping, and callbacks', () => {
    for (const fragment of [
        'function my_process_lookup(drug, rxcode = \'\')',
        'function drugselected(sel)',
        'function quantityChanged()',
        'name="rxcui_select"',
        'id="druglookup"',
        'style="display: none"',
        "{% if enable_amc_prompting %}",
        "{% if dispenseEnabled %}",
        "{% if topActionBarDisplay %}",
        "{% if bottomActionBarDisplay %}",
        "{% if SIMPLIFIED_PRESCRIPTIONS %}",
        "{% if weno_rx_enable %}",
        'CSRF_TOKEN_FORM|js_escape',
        'prescription.drug|js_escape',
        'function submitfun()',
        'function submitAndPrint()',
        'function CheckRequired(objID)',
        'function OnCodeSelected(codetype, code, selector, codedesc)',
        'top.restoreSession();',
        'name="print_after_save"',
        'name="dispense_after_save"',
        'name="process"',
        'diagnosis[]',
    ]) assert.ok(original.includes(fragment), `missing native fragment: ${fragment}`);
    assert.match(read(SUPPORT[0]), /name="disp_quantity"[\s\S]*?name="disp_fee"[\s\S]*?dispense_encounter_id[\s\S]*?btn-presc-dispense/);
});

test('clinical and conditional source mutations fail whole-original preservation', () => {
    const valid = insertPresentation(original);
    const changes = [
        ['drug lookup', 'function my_process_lookup(drug, rxcode = \'\')', 'function no_lookup(drug, rxcode = \'\')'],
        ['quantity callback', 'function quantityChanged()', 'function quantityIgnored()'],
        ['dose validation', "CheckRequired('dosage')", "CheckRequired('unused')"],
        ['drug validation', "CheckRequired('drug')", "CheckRequired('unused')"],
        ['quantity validation', "CheckRequired('quantity')", "CheckRequired('unused')"],
        ['radio choice', 'name="rxcui_select" checked', 'name="rxcui_select" disabled'],
        ['dispense gate', '{% if dispenseEnabled %}\n            {% include', '{% if false %}\n            {% include'],
        ['AMC gate', '{% if enable_amc_prompting %}', '{% if false %}'],
        ['simplified gate', '{% if SIMPLIFIED_PRESCRIPTIONS %}', '{% if false %}'],
        ['Weno gate', '{% if weno_rx_enable %}', '{% if false %}'],
        ['top action gate', '{% if topActionBarDisplay %}\n                    <a id="save"', '{% if false %}\n                    <a id="save"'],
        ['bottom action gate', '{% if bottomActionBarDisplay %}', '{% if false %}'],
        ['CSRF', 'csrf_token_form: {{ CSRF_TOKEN_FORM|js_escape }},\n\n                  term: params.term', 'csrf_token_form: null,\n\n                  term: params.term'],
        ['drug escaping', 'new Option({{prescription.drug|js_escape}}, {{prescription.drug|js_escape}}, true, true)', 'new Option({{prescription.drug|raw}}, {{prescription.drug|raw}}, true, true)'],
        ['print flag', 'name="print_after_save"', 'name="no_print"'],
        ['dispense flag', 'name="dispense_after_save"', 'name="no_dispense"'],
        ['process hidden', 'name="process"', 'name="no_process"'],
        ['session', 'return top.restoreSession();', 'return true;'],
        ['coding callback', 'function OnCodeSelected(codetype, code, selector, codedesc)', 'function NoCodeSelected(codetype, code, selector, codedesc)'],
    ];
    for (const [label, before, after] of changes) rejectMutation(valid, original, label, before, after);
});

test('CSS, assets, and head/body seam mutants fail', () => {
    const valid = insertPresentation(original);
    const changes = [
        ['media', '@media screen {', '@media print {'],
        ['scope', `${SCOPE} > .container-xl {`, 'body > .container-xl {'],
        ['paper width', 'max-width: 1000px;', 'max-width: 600px;'],
        ['paper ink', 'color: #243c43;', 'color: #fff;'],
        ['lookup ink', 'color: #086878;', 'color: #fff;'],
        ['float clear', 'clear: both;', 'clear: none;'],
        ['row margin', 'margin-inline: 0;', 'margin-inline: auto;'],
        ['hidden state', '    overflow-wrap: anywhere;', '    overflow-wrap: anywhere;\n    display: none;'],
        ['font', '  '+SCOPE+' #prescribe .form-control {\n    max-width: 100%;', '  '+SCOPE+' #prescribe .form-control {\n    max-width: 100%;\n    font-size: 9px;'],
        ['important', '    border-radius: 8px;', '    border-radius: 8px !important;'],
        ['script asset', ADDED_STYLE, `${ADDED_STYLE}\n<script src="extra.js"></script>`],
        ['stylesheet asset', ADDED_STYLE, `${ADDED_STYLE}\n<link rel="stylesheet" href="extra.css">`],
        ['duplicate body', BODY_AFTER, BODY_AFTER + BODY_AFTER],
        ['duplicate style', ADDED_STYLE, ADDED_STYLE + ADDED_STYLE],
        ['relocated style', `${ADDED_STYLE}${HEAD_END}`, `${HEAD_END}${ADDED_STYLE}`],
        ['old body retained', BODY_AFTER, BODY_BEFORE + BODY_AFTER],
    ];
    for (const [label, before, after] of changes) rejectMutation(valid, original, label, before, after);
});

if (process.argv.includes('--history')) {
    test('pinned fixture, unchanged support, and final five-path allowlist', () => {
        verifyHistory(original);
    });
}

module.exports = { ADDED_STYLE, BODY_AFTER, BODY_BEFORE, SCOPE, insertPresentation, verifyPresentation, verifyStyle };
