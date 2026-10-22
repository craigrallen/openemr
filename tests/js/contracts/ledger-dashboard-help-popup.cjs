'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const base = '18647270e0c799189d2dc10f801e8de2bff1a360';
const route = 'Documentation/help_files/ledger_dashboard_help.php';
const fixture = 'tests/js/fixtures/ledger-dashboard-help-popup-original.php.txt';
const read = file => readFileSync(path.join(root, file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = read(fixture);
const plain = original.toString('utf8');
const protectedHashes = {
    'interface/reports/pat_ledger.php': '461811d44cbf1acfad99f7f8d8613f316d3e9ac708e4392298ac14a7d5d2bd24',
    'interface/patient_file/summary/dashboard_header.php': '24500933229d8915cf9ddf81825c3c00db25a694bdc1f5541678aef335c98a23',
    'templates/patient/dashboard_header.html.twig': '5530b1603a785af75b38a27b1544f2c9e0d90e21da9a90c8cc77ab343cc73e9a',
    'src/OeUI/OemrUI.php': '478dd52733a2a50078d0610fc0e8e74bf8ad2c6c68d44abc612c8097eb99dc44',
    'src/Core/Header.php': 'dee3fd5f35bfd900ed119ae45981142ed737dac48059e54cacb4af843d6d264d',
    'config/config.yaml': '5f99c981f570a2f94917d68a4abcedf086eb75a102364bf71f1cb44ccfe461b7',
    'interface/clinical-workspace/popup.js': 'af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f',
    'interface/clinical-workspace/popup.css': 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9',
    'interface/themes/oe-common/help-files-common.scss': '351591fcc07fec98bae35aadc32ab4dafa13b8d54cbb36babcbf07ef3b2abe8a',
    'interface/themes/colors/utilities/help-files.scss': '7e56fa424f7fbc0971d1d9c3dbc6b6f00ce15e2a0d0b4e89aaab71befc927e19'
};
const bodyClass = 'oe-ledger-dashboard-help-popup';
const scope = `html.oe-workbench-context body.${bodyClass}`;
const style = `    <style>
@media screen {
  ${scope} {
    background-color: var(--oe-wb-canvas, #f3f7f5);
    color: var(--oe-wb-ink, #17343b);
  }

  ${scope} > .oe-help-container {
    background-color: var(--oe-wb-paper, #fff);
    color: var(--oe-wb-ink, #17343b);
  }
}
    </style>
`;
const headEnd = '    </head>';
const oldBody = '    <body>';
const newBody = `    <body class="${bodyClass}">`;
const count = (source, needle) => source.split(needle).length - 1;

function replaceAnchor(source, anchor, replacement, occurrences = 1) {
    assert.equal(count(source, anchor), occurrences, `unique expected mutation anchor: ${anchor}`);
    assert.notEqual(anchor, replacement);
    const changed = source.split(anchor).join(replacement);
    assert.notDeepEqual(Buffer.from(changed), Buffer.from(source), 'mutation must change bytes');
    return changed;
}

const candidate = replaceAnchor(replaceAnchor(plain, headEnd, style + headEnd), oldBody, newBody);

function checkCandidate(source) {
    assert.equal(count(source, style), 1, 'one exact screen palette before head close');
    assert.equal(count(source, '<style>'), 1);
    assert.equal(count(source, '</style>'), 1);
    assert.equal(count(source, '@media screen {'), 1);
    assert.equal(count(source, '!important'), 0);
    assert.equal(count(source, scope), 2);
    assert.equal(count(source, bodyClass), 3);
    assert.equal(count(source, newBody), 1);
    assert.equal(source, candidate, 'exactly two presentation additions');
    assert.deepEqual(Buffer.from(source.replace(style, '').replace(newBody, oldBody)), original,
        'full inverse restores every original ledger help byte');
}

test('complete nonexecuting fixture pins the original ledger help source', () => {
    assert.ok(fixture.endsWith('.php.txt'));
    assert.equal(original.length, 4100);
    assert.equal(sha(original), 'ea712d807796efca4bd7c54a150430944fdba4d97b98d2677229c1d69fb66acc');
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '<style>'), 0);
    assert.deepEqual(Buffer.from(candidate.replace(style, '').replace(newBody, oldBody)), original);
});

test('historical financial guidance, heading and inert Submit stay in the original', () => {
    assert.equal(count(plain, '<h2 class="text-center"><a name=\'entire_doc\'><?php echo xlt("Patient Ledger Help");?></a></h2>'), 1);
    assert.equal(count(plain, '<button type="button" class="btn btn-secondary btn-save btn-sm oe-no-float">'), 1);
    for (const phrase of ['all financial transactions between the patient and the practice',
        'Select a date range and click Submit', 'E/M and CPT codes', 'Billed Date/Payor',
        'Cash, Check, Electronic etc ', 'Grand Total of Charges, Payments, Adjustments and the Balance']) {
        assert.ok(plain.includes(phrase), phrase);
    }
    assert.equal(count(plain, '<p><?php echo xlt('), 24);
    assert.equal(count(plain, 'href='), 0);
    assert.equal(count(plain, 'oe-help-heading'), 0);
    assert.equal(count(plain, 'oe-help-redirect'), 0);
    assert.equal(count(plain, 'require_once("../../interface/globals.php");'), 1);
    assert.equal(count(plain, '<?php Header::setupHeader();?>'), 1);
    assert.equal(count(plain, '</div><!--end of container div-->'), 1);
});

test('synthetic future ledger dashboard candidate satisfies the complete seam', () => {
    checkCandidate(candidate);
});

test('anchored presentation, print, semantics and financial-text mutations fail closed', () => {
    const mutations = {
        missingStyle: s => replaceAnchor(s, style, ''),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        movedStyle: s => replaceAnchor(replaceAnchor(s, style + headEnd, headEnd), newBody, style + newBody),
        missingBodyClass: s => replaceAnchor(s, newBody, oldBody),
        extraBodyClass: s => replaceAnchor(s, newBody, `    <body class="${bodyClass} extra">`),
        printMedia: s => replaceAnchor(s, '@media screen {', '@media print {'),
        popupClass: s => replaceAnchor(s, 'html.oe-workbench-context', 'html.oe-workbench-popup', 2),
        broadContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html', 2),
        broadBody: s => replaceAnchor(s, `body.${bodyClass}`, 'body', 2),
        broadContainer: s => replaceAnchor(s, '> .oe-help-container', '.oe-help-container'),
        canvasFallback: s => replaceAnchor(s, 'var(--oe-wb-canvas, #f3f7f5)', '#f3f7f5'),
        paperFallback: s => replaceAnchor(s, 'var(--oe-wb-paper, #fff)', '#fff'),
        inkPair: s => replaceAnchor(s, 'var(--oe-wb-ink, #17343b)', 'inherit', 2),
        important: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);',
            'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'),
        geometry: s => replaceAnchor(s, '    color: var(--oe-wb-ink, #17343b);',
            '    padding: 1rem;\n    color: var(--oe-wb-ink, #17343b);', 2),
        typography: s => replaceAnchor(s, '    color: var(--oe-wb-ink, #17343b);',
            '    font-family: Arial;\n    color: var(--oe-wb-ink, #17343b);', 2),
        headingRule: s => replaceAnchor(s, '  }\n}\n    </style>',
            `  }\n  ${scope} h2 { color: red; }\n}\n    </style>`),
        buttonRule: s => replaceAnchor(s, '  }\n}\n    </style>',
            `  }\n  ${scope} button { color: red; }\n}\n    </style>`),
        changedBootstrap: s => replaceAnchor(s, 'require_once("../../interface/globals.php");', 'session_start();'),
        changedHeading: s => replaceAnchor(s, "name='entire_doc'", "name='changed'"),
        changedButton: s => replaceAnchor(s, '<button type="button"', '<button type="submit"'),
        changedGuidance: s => replaceAnchor(s, 'Select a date range and click Submit', 'Choose a date range and submit'),
        changedFinancialClaim: s => replaceAnchor(s, 'The Units will be 1 as each code is billed only once',
            'The Units can vary by code'),
        changedContainer: s => replaceAnchor(s, '</div><!--end of container div-->', '</div>')
    };
    for (const [name, mutate] of Object.entries(mutations)) {
        const changed = mutate(candidate);
        assert.throws(() => checkCandidate(changed), assert.AssertionError, name);
    }
});

test('caller security, branch eligibility, modal, theme and shared assets remain pinned', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/reports/pat_ledger.php').toString();
    const included = read('interface/patient_file/summary/dashboard_header.php').toString();
    const twig = read('templates/patient/dashboard_header.html.twig').toString();
    const ui = read('src/OeUI/OemrUI.php').toString();
    const header = read('src/Core/Header.php').toString();
    const config = read('config/config.yaml').toString();
    const css = read('interface/clinical-workspace/popup.css').toString();
    const theme = read('interface/themes/oe-common/help-files-common.scss').toString();
    assert.match(caller, /SessionWrapperFactory::getInstance\(\)->getActiveSession\(\)/);
    assert.match(caller, /if \(!empty\(\$_POST\)\) \{\s*CsrfUtils::checkCsrfInput\(INPUT_POST, dieOnFail: true\)/);
    assert.match(caller, /AclMain::aclCheckCore\('acct', 'rep'\)/);
    assert.match(caller, /\$type_form = \$_GET\['form'\]/);
    assert.match(caller, /if \(\$_REQUEST\['form_csvexport'\]\) \{\s*header\("Pragma: public"\)/);
    assert.match(caller, /if \(\$type_form == '0'\) \{[\s\S]*?'show_help_icon' => false,\s*'help_file_name' => ""[\s\S]*?\} else \{[\s\S]*?'show_help_icon' => true,\s*'help_file_name' => "ledger_dashboard_help\.php"/);
    assert.match(caller, /\$oemr_ui = new OemrUI\(\$arrOeUiSettings\)/);
    assert.match(caller, /if \(\$type_form != '0'\) \{\s*require_once\([\s\S]*?patient_file\/summary\/dashboard_header\.php/);
    assert.match(caller, /\$oemr_ui->oeBelowContainerDiv\(\)/);
    for (const anchor of ['erx_patient_portal_js.php', 'csrf_token_form', 'GetAllCredits(', 'GetAllUnapplied(',
        'PrintCreditDetail(', 'PrintEncFooter(', 'sqlStatement($query, $sqlBindArray)', "$_REQUEST['form_refresh']",
        "$_REQUEST['form_csvexport']", 'getEffectiveInsurances(']) assert.ok(caller.includes(anchor), anchor);
    assert.match(included, /'pageHeading' => isset\(\$oemr_ui\) \? \$oemr_ui->pageHeading\(\) : ''/);
    assert.equal(twig, '{{ pageHeading }}\n');
    assert.match(ui, /get\('enable_help'\) !== 0 && \$this->display_help_icon/);
    assert.match(ui, /get\('enable_help'\) == "1"[\s\S]*?get\('enable_help'\) == "2"/);
    assert.match(ui, /'data-target' => "#myModal",\s*'data-toggle' => 'modal'/);
    assert.match(ui, /<iframe src='' data-src='\$help_file' id='targetiframe'/);
    assert.match(ui, /<div class="modal fade" id="myModal"/);
    assert.doesNotMatch(ui, /class="[^"]*\bdialogModal\b/);
    assert.match(header, /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(config, /workbench-popup:[\s\S]*?script: popup\.js[\s\S]*?link: popup\.css[\s\S]*?autoload: true/);
    for (const [token, value] of [['ink', '#17343b'], ['paper', '#fff'], ['canvas', '#f3f7f5']]) {
        assert.ok(css.includes(`--oe-wb-${token}: ${value};`));
    }
    assert.match(theme, /\.oe-help-container a[\s\S]*?\.oe-help-container h2 > a/);
});

test('source-derived OemrUI first click assigns the ledger help iframe once', () => {
    const ui = read('src/OeUI/OemrUI.php').toString();
    const start = "$(document).on('click', '#help-href', function () {";
    const end = '            });';
    assert.equal(count(ui, start), 1);
    const begin = ui.indexOf(start);
    const finish = ui.indexOf(end, begin);
    assert.ok(finish > begin);
    let listener;
    let src = '';
    let writes = 0;
    const document = {};
    const iframe = {
        attr(name, value) { assert.equal(name, 'src'); if (value === undefined) return src; src = value; writes++; },
        data(name) { assert.equal(name, 'src'); return '/Documentation/help_files/ledger_dashboard_help.php'; }
    };
    const $ = target => target === document ? { on(event, selector, callback) {
        assert.equal(event, 'click'); assert.equal(selector, '#help-href'); listener = callback;
    } } : (assert.equal(target, '#targetiframe'), iframe);
    vm.runInNewContext(ui.slice(begin, finish + end.length), { document, $ }, { filename: 'OemrUI-help-click.js' });
    assert.equal(src, '');
    listener(); listener();
    assert.equal(src, '/Documentation/help_files/ledger_dashboard_help.php');
    assert.equal(writes, 1);
});

function classList(initial = []) {
    const classes = new Set(initial);
    return { contains: value => classes.has(value), add: value => classes.add(value),
        remove: value => classes.delete(value), values: () => [...classes] };
}

function popupWindow({ active = false, shell = false, parent = null, frameId = null, origin = 'https://openemr.test' } = {}) {
    const html = { classList: classList() };
    const body = { classList: classList(active ? ['workbench-active'] : []), ownerDocument: null };
    const listeners = {};
    const doc = { documentElement: html, body, readyState: 'complete',
        querySelector: selector => shell && selector === '#mainBox [data-workbench-mode]' ? {} : null,
        defaultView: { MutationObserver: class {
            constructor(callback) { doc.observerCallback = callback; }
            observe() {}
            disconnect() { doc.disconnected = true; }
        } } };
    body.ownerDocument = doc;
    const win = { document: doc, location: { origin },
        frameElement: frameId ? { id: frameId,
            closest: selector => { assert.equal(selector, '.dialogModal'); return null; } } : null,
        opener: null, addEventListener: (name, callback) => { listeners[name] = callback; } };
    win.parent = parent || win;
    return { win, doc, html, body, listeners };
}

function activate(win) {
    vm.runInNewContext(read('interface/clinical-workspace/popup.js').toString(), { window: win, Set }, { filename: 'popup.js' });
    return win.OpenEMRWorkbenchPopup;
}

test('real popup.js marks ordinary targetiframe as context only and cleans up', () => {
    const shell = popupWindow({ active: true, shell: true });
    const content = popupWindow({ parent: shell.win, frameId: 'contentframe' });
    const help = popupWindow({ parent: content.win, frameId: 'targetiframe' });
    const api = activate(help.win);
    assert.equal(api.CONTEXT_CLASS, 'oe-workbench-context');
    assert.equal(api.POPUP_CLASS, 'oe-workbench-popup');
    assert.deepEqual(help.html.classList.values(), ['oe-workbench-context']);
    shell.body.classList.remove('workbench-active'); shell.doc.observerCallback();
    assert.deepEqual(help.html.classList.values(), []);
    shell.body.classList.add('workbench-active'); shell.doc.observerCallback();
    assert.deepEqual(help.html.classList.values(), ['oe-workbench-context']);
    help.listeners.pagehide();
    assert.deepEqual(help.html.classList.values(), []);
    assert.equal(shell.doc.disconnected, true);

    const source = read('interface/clinical-workspace/popup.js').toString();
    const broken = replaceAnchor(source,
        'let current = parentWindow && parentWindow !== self ? parentWindow : null;',
        'let current = null;');
    const otherShell = popupWindow({ active: true, shell: true });
    const otherContent = popupWindow({ parent: otherShell.win, frameId: 'contentframe' });
    const otherHelp = popupWindow({ parent: otherContent.win, frameId: 'targetiframe' });
    vm.runInNewContext(broken, { window: otherHelp.win, Set }, { filename: 'popup-broken.js' });
    assert.deepEqual(otherHelp.html.classList.values(), [], 'parent traversal mutation loses context');
});

test('real popup.js leaves standalone, legacy and foreign-origin help without context', () => {
    const standalone = popupWindow(); activate(standalone.win);
    assert.deepEqual(standalone.html.classList.values(), []);
    const legacy = popupWindow({ shell: true });
    const legacyHelp = popupWindow({ parent: legacy.win, frameId: 'targetiframe' }); activate(legacyHelp.win);
    assert.deepEqual(legacyHelp.html.classList.values(), []);
    const foreign = popupWindow({ active: true, origin: 'https://other.test' });
    const foreignHelp = popupWindow({ parent: foreign.win, frameId: 'targetiframe' }); activate(foreignHelp.win);
    assert.deepEqual(foreignHelp.html.classList.values(), []);
});

test('live ledger help route has the exact two-addition presentation seam', () => {
    const live = read(route).toString('utf8');
    assert.notEqual(live, plain, 'missing presentation: route still equals the original fixture');
    checkCandidate(live);
});

if (process.argv.includes('--history')) {
    test('authentic Git base, unchanged protected sources and full five-path history scope', () => {
        const git = args => execFileSync('git', args, { cwd: root });
        assert.equal(git(['branch', '--show-current']).toString().trim(), 'OPEMR-95-ledger-dashboard-help');
        assert.deepEqual(original, git(['show', `${base}:${route}`]));
        for (const file of Object.keys(protectedHashes)) {
            assert.deepEqual(read(file), git(['show', `${base}:${file}`]), `base-protected source: ${file}`);
        }
        const names = args => git(args).toString().split('\0').filter(Boolean);
        const committed = names(['diff', '--no-renames', '--name-only', '-z', base, 'HEAD']);
        const dirty = names(['diff', '--no-renames', '--name-only', '-z', 'HEAD']);
        const staged = names(['diff', '--no-renames', '--cached', '--name-only', '-z']);
        const untracked = names(['ls-files', '--others', '--exclude-standard', '-z']);
        const allowed = new Set([route, fixture, 'tests/js/contracts/ledger-dashboard-help-popup.cjs',
            'tests/js/ledger-dashboard-help-popup.test.js', 'docs/clinical-ui/LEDGER-DASHBOARD-HELP-POPUP.md']);
        for (const file of new Set([...committed, ...dirty, ...staged, ...untracked])) {
            assert.ok(allowed.has(file), `out-of-scope changed file: ${file}`);
        }
    });
}
