'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const route = 'Documentation/help_files/transactions_dashboard_help.php';
const fixture = 'tests/js/fixtures/transactions-dashboard-help-popup-original.php.txt';
const base = '18647270e0c799189d2dc10f801e8de2bff1a360';
const protectedHashes = {
    'interface/patient_file/transaction/transactions.php': 'fdf2c6696a6e7fb2c1d8b75e788fddbc7930cf7807067c6dfe21d360b02747c4',
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
const read = file => readFileSync(path.join(root, file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = read(fixture);
const plain = original.toString('utf8');
const bodyClass = 'oe-transactions-dashboard-help-popup';
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

  ${scope} .oe-help-heading {
    background-color: var(--oe-wb-paper, #fff) !important;
    color: var(--oe-wb-ink, #17343b);
  }

  ${scope} .oe-help-container a:not(.btn) {
    background-color: transparent;
    color: var(--oe-wb-petrol, #086878);
  }

  ${scope} .oe-help-redirect {
    background-color: transparent;
    color: var(--oe-wb-petrol, #086878) !important;
  }
}
    </style>
`;
const headEnd = '    </head>';
const oldBody = '    <body>';
const newBody = `    <body class="${bodyClass}">`;
const count = (source, needle) => source.split(needle).length - 1;

function replaceAnchor(source, anchor, replacement, occurrences = 1) {
    assert.equal(count(source, anchor), occurrences, `mutation anchor count: ${anchor}`);
    assert.notEqual(anchor, replacement);
    return source.split(anchor).join(replacement);
}

const candidate = replaceAnchor(replaceAnchor(plain, headEnd, style + headEnd), oldBody, newBody);

function checkCandidate(source) {
    assert.equal(count(source, '<style>'), 1);
    assert.equal(count(source, '</style>'), 1);
    assert.equal(count(source, style), 1, 'one exact screen palette block immediately before head close');
    assert.equal(count(source, '@media screen {'), 1);
    assert.equal(count(source, '!important'), 2, 'only heading background and redirect color');
    assert.equal(count(source, bodyClass), 6, 'five selectors and one body marker');
    assert.equal(count(source, headEnd), 1);
    assert.equal(count(source, newBody), 1);
    assert.equal(source, candidate, 'only the two exact presentation additions are allowed');
    assert.deepEqual(Buffer.from(source.replace(style, '').replace(newBody, oldBody)), original,
        'inverse must restore every original route byte');
}

test('full synthetic future Transactions candidate passes before the live RED assertion', () => {
    checkCandidate(candidate);
});

test('complete nonexecuting fixture pins every original Transactions help byte', () => {
    assert.ok(fixture.endsWith('.php.txt'));
    assert.equal(original.length, 6815);
    assert.equal(sha(original), '187c75a605af7687a2c096ec8de0b31c0b1775c4556e67efab5a0f50e73fb338');
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '<style>'), 0);
    assert.deepEqual(Buffer.from(candidate.replace(style, '').replace(newBody, oldBody)), original);
});

test('four sections, sample controls, warnings, translations and referral guidance survive', () => {
    for (const section of [1, 2, 3, 4]) {
        assert.equal(count(plain, `id="section${section}"`), 1);
        assert.equal(count(plain, `href="#section${section}"`), 1);
    }
    assert.equal(count(plain, '<button type="button"'), 2);
    assert.equal(count(plain, 'class="fa fa-arrow-circle-up oe-pull-away oe-help-redirect"'), 4);
    assert.equal(count(plain, 'fa-exclamation-circle oe-text-orange'), 1);
    assert.equal(count(plain, 'fa-exclamation-triangle oe-text-red'), 1);
    assert.equal(count(plain, 'rel="noopener" target="_blank"'), 2);
    assert.equal(count(plain, 'fa-external-link-alt text-primary'), 2);
    assert.equal(count(plain, 'https://www.open-emr.org/wiki/index.php/LBV_Forms'), 1);
    assert.equal(count(plain, 'https://www.open-emr.org/wiki/index.php/Sample_Layout_Based_Visit_Form'), 1);
    for (const phrase of ['Transactions are for events or information not necessarily tied to one specific visit or encounter',
        'Depending on the level of access you can View/Edit the Transaction',
        'Those with adequate privilege would be able to able to Delete the transaction',
        'A Referral has an additional action - to print the referral or save it as a pdf file',
        'This method will however result in the data becoming non-structured',
        'You will need Administrator privileges to edit this form',
        'There are 3 forms in the Core category']) {
        assert.ok(plain.includes(`xlt("${phrase}`), phrase);
    }
    assert.equal(count(plain, 'require_once("../../interface/globals.php");'), 1);
    assert.equal(count(plain, '<?php Header::setupHeader();?>'), 1);
    assert.equal(count(plain, '<?php echo xlt('), 35);
});

test('anchored presentation and protected-source mutations fail closed', async t => {
    const mutations = {
        missingStyle: s => replaceAnchor(s, style, ''),
        relocatedStyle: s => replaceAnchor(replaceAnchor(s, style + headEnd, headEnd), newBody, style + newBody),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        missingBodyMarker: s => replaceAnchor(s, newBody, oldBody),
        duplicateBodyMarker: s => replaceAnchor(s, newBody, newBody + newBody),
        printMedia: s => replaceAnchor(s, '@media screen {', '@media print {'),
        lostContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html', 5),
        popupClassInstead: s => replaceAnchor(s, 'html.oe-workbench-context', 'html.oe-workbench-popup', 5),
        broadBody: s => replaceAnchor(s, `body.${bodyClass}`, 'body', 5),
        broadContainer: s => replaceAnchor(s, '> .oe-help-container', '.oe-help-container'),
        paintsButtons: s => replaceAnchor(s, 'a:not(.btn)', 'a'),
        canvasPair: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: transparent;'),
        paperPair: s => replaceAnchor(s, 'background-color: var(--oe-wb-paper, #fff);', 'background-color: transparent;'),
        inkPair: s => replaceAnchor(s, 'color: var(--oe-wb-ink, #17343b);', 'color: inherit;', 3),
        petrolPair: s => replaceAnchor(s, 'color: var(--oe-wb-petrol, #086878);', 'color: #086878;'),
        headingImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-paper, #fff) !important;', 'background-color: var(--oe-wb-paper, #fff);'),
        redirectImportant: s => replaceAnchor(s, 'color: var(--oe-wb-petrol, #086878) !important;', 'color: var(--oe-wb-petrol, #086878);'),
        extraImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'),
        semanticWarning: s => replaceAnchor(s, 'a:not(.btn)', 'a:not(.btn), .oe-text-red'),
        controlOverride: s => replaceAnchor(s, 'a:not(.btn)', 'a:not(.btn), button'),
        fontChange: s => replaceAnchor(s, '    background-color: var(--oe-wb-canvas, #f3f7f5);', '    font-family: Arial;\n    background-color: var(--oe-wb-canvas, #f3f7f5);'),
        geometryChange: s => replaceAnchor(s, '    background-color: var(--oe-wb-canvas, #f3f7f5);', '    padding: 1rem;\n    background-color: var(--oe-wb-canvas, #f3f7f5);'),
        borderChange: s => replaceAnchor(s, '    color: var(--oe-wb-ink, #17343b);', '    border: 0;\n    color: var(--oe-wb-ink, #17343b);', 3),
        buttonType: s => replaceAnchor(s, '<button type="button"', '<button type="submit"', 2),
        sectionAnchor: s => replaceAnchor(s, 'id="section1"', 'id="other_section"'),
        sectionGuidance: s => replaceAnchor(s, 'Depending on the level of access you can View/Edit the Transaction', 'Anyone can View/Edit the Transaction'),
        referralGuidance: s => replaceAnchor(s, 'data becoming non-structured', 'data becoming structured'),
        warningIcon: s => replaceAnchor(s, 'fa-exclamation-triangle oe-text-red', 'fa-info-circle oe-text-red'),
        translation: s => replaceAnchor(s, 'xlt("Patient Transactions Help")', 'xl("Patient Transactions Help")', 2),
        phpGlobals: s => replaceAnchor(s, 'require_once("../../interface/globals.php");', 'require_once("../interface/globals.php");'),
        phpSession: s => replaceAnchor(s, '<?php Header::setupHeader();?>', '<?php session_start(); Header::setupHeader();?>'),
        externalLink: s => replaceAnchor(s, 'https://www.open-emr.org/wiki/index.php/LBV_Forms', 'https://example.test/LBV_Forms'),
        linkMetadata: s => replaceAnchor(s, 'rel="noopener" target="_blank"', 'target="_blank"', 2)
    };
    for (const [name, mutate] of Object.entries(mutations)) {
        await t.test(name, () => {
            const changed = mutate(candidate);
            assert.notEqual(changed, candidate, 'mutation must change an anchored source');
            assert.throws(() => checkCandidate(changed), assert.AssertionError);
        });
    }
});

test('actual Transactions caller, heading path, theme cascade and shared assets are pinned', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/patient_file/transaction/transactions.php').toString();
    const included = read('interface/patient_file/summary/dashboard_header.php').toString();
    const twig = read('templates/patient/dashboard_header.html.twig').toString();
    const ui = read('src/OeUI/OemrUI.php').toString();
    const header = read('src/Core/Header.php').toString();
    const assets = read('config/config.yaml').toString();
    const css = read('interface/clinical-workspace/popup.css').toString();
    const common = read('interface/themes/oe-common/help-files-common.scss').toString();
    const colors = read('interface/themes/colors/utilities/help-files.scss').toString();
    assert.match(caller, /\$session = \\OpenEMR\\Common\\Session\\SessionWrapperFactory::getInstance\(\)->getActiveSession\(\);[\s\S]*?\$pid = \$session->get\('pid', 0\)/);
    assert.match(caller, /'show_help_icon' => true,\s*'help_file_name' => "transactions_dashboard_help\.php"/);
    assert.match(caller, /\$oemr_ui = new OemrUI\(\$arrOeUiSettings\)/);
    assert.match(caller, /summary\/dashboard_header\.php/);
    assert.match(caller, /\$oemr_ui->oeBelowContainerDiv\(\)/);
    assert.match(caller, /AclMain::aclCheckCore\('admin', 'super'\)/);
    assert.doesNotMatch(caller.slice(0, caller.indexOf('<body>')), /AclMain::aclCheckCore\(/);
    assert.match(included, /'pageHeading' => isset\(\$oemr_ui\) \? \$oemr_ui->pageHeading\(\) : ''/);
    assert.equal(twig, '{{ pageHeading }}\n');
    assert.match(ui, /get\('enable_help'\) !== 0 && \$this->display_help_icon/);
    assert.match(ui, /get\('enable_help'\) == "1"[\s\S]*?get\('enable_help'\) == "2"/);
    assert.match(ui, /data-target' => "#myModal",\s*'data-toggle' => 'modal'/);
    assert.match(ui, /<iframe src='' data-src='\$help_file' id='targetiframe'/);
    assert.match(ui, /<div class="modal fade" id="myModal"/);
    assert.doesNotMatch(ui, /class="[^"]*\bdialogModal\b/);
    assert.match(header, /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(assets, /workbench-popup:[\s\S]*?script: popup\.js[\s\S]*?link: popup\.css[\s\S]*?autoload: true/);
    for (const [token, value] of [['ink', '#17343b'], ['paper', '#fff'], ['canvas', '#f3f7f5'], ['petrol', '#086878']]) {
        assert.ok(css.includes(`--oe-wb-${token}: ${value};`));
    }
    assert.match(common, /\.oe-help-container a:not\(\.btn\)[\s\S]*?color: \$gray/);
    assert.match(common, /\.oe-help-heading[\s\S]*?background-color: \$gray-200/);
    assert.match(colors, /\.oe-help-redirect[\s\S]*?color: \$darker !important;[\s\S]*?\.oe-help-heading[\s\S]*?background-color: \$palepale !important;/);
    for (const [file, source, anchor, replacement] of [
        ['interface/patient_file/transaction/transactions.php', caller, "'help_file_name' => \"transactions_dashboard_help.php\"", "'help_file_name' => \"other_help.php\""],
        ['interface/patient_file/transaction/transactions.php', caller, "AclMain::aclCheckCore('admin', 'super')", "AclMain::aclCheckCore('patients', 'demo')"],
        ['src/OeUI/OemrUI.php', ui, '<div class="modal fade" id="myModal"', '<div class="dialogModal modal fade" id="myModal"']
    ]) {
        const changed = replaceAnchor(source, anchor, replacement);
        assert.notEqual(changed, source);
        assert.throws(() => assert.equal(sha(Buffer.from(changed)), protectedHashes[file]), assert.AssertionError);
    }
});

test('source-derived OemrUI first click loads the Transactions help iframe once', () => {
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
        data(name) { assert.equal(name, 'src'); return '/Documentation/help_files/transactions_dashboard_help.php'; }
    };
    const $ = target => target === document ? { on(event, selector, callback) {
        assert.equal(event, 'click'); assert.equal(selector, '#help-href'); listener = callback;
    } } : (assert.equal(target, '#targetiframe'), iframe);
    vm.runInNewContext(ui.slice(begin, finish + end.length), { document, $ }, { filename: 'OemrUI-help-click.js' });
    listener(); listener();
    assert.equal(src, '/Documentation/help_files/transactions_dashboard_help.php');
    assert.equal(writes, 1);
});

function classList(initial = []) {
    const classes = new Set(initial);
    return { contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value), values: () => [...classes] };
}

function popupWindow({ active = false, shell = false, parent = null, origin = 'https://openemr.test', frameId = null } = {}) {
    const html = { classList: classList() };
    const body = { classList: classList(active ? ['workbench-active'] : []), ownerDocument: null };
    const listeners = {};
    const doc = { documentElement: html, body, readyState: 'complete',
        querySelector: selector => shell && selector === '#mainBox [data-workbench-mode]' ? {} : null,
        defaultView: { MutationObserver: class { constructor(callback) { doc.observerCallback = callback; } observe() {} disconnect() { doc.disconnected = true; } } } };
    body.ownerDocument = doc;
    const win = { document: doc, location: { origin }, frameElement: frameId ? {
        id: frameId,
        closest: selector => { assert.equal(selector, '.dialogModal'); return null; }
    } : null,
        opener: null, addEventListener: (name, callback) => { listeners[name] = callback; } };
    win.parent = parent || win;
    return { win, doc, html, body, listeners };
}

test('unchanged popup.js follows ordinary modal targetiframe through content frame to shell', () => {
    const shell = popupWindow({ active: true, shell: true });
    const content = popupWindow({ parent: shell.win, frameId: 'contentframe' });
    const help = popupWindow({ parent: content.win, frameId: 'targetiframe' });
    assert.equal(content.win.frameElement.id, 'contentframe');
    assert.equal(help.win.frameElement.id, 'targetiframe');
    vm.runInNewContext(read('interface/clinical-workspace/popup.js').toString(), { window: help.win, Set }, { filename: 'popup.js' });
    assert.equal(help.win.OpenEMRWorkbenchPopup.CONTEXT_CLASS, 'oe-workbench-context');
    assert.deepEqual(help.html.classList.values(), ['oe-workbench-context']);
    shell.body.classList.remove('workbench-active'); shell.doc.observerCallback();
    assert.deepEqual(help.html.classList.values(), []);
    shell.body.classList.add('workbench-active'); shell.doc.observerCallback();
    assert.deepEqual(help.html.classList.values(), ['oe-workbench-context']);
    help.listeners.pagehide();
    assert.deepEqual(help.html.classList.values(), []);
    assert.equal(shell.doc.disconnected, true);

    const popupSource = read('interface/clinical-workspace/popup.js').toString();
    const broken = replaceAnchor(popupSource,
        'let current = parentWindow && parentWindow !== self ? parentWindow : null;', 'let current = null;');
    assert.notEqual(broken, popupSource);
    const brokenShell = popupWindow({ active: true, shell: true });
    const brokenContent = popupWindow({ parent: brokenShell.win, frameId: 'contentframe' });
    const brokenHelp = popupWindow({ parent: brokenContent.win, frameId: 'targetiframe' });
    vm.runInNewContext(broken, { window: brokenHelp.win, Set }, { filename: 'popup-no-parent-ancestry.js' });
    assert.throws(() => assert.deepEqual(brokenHelp.html.classList.values(), ['oe-workbench-context']),
        assert.AssertionError, 'lost parent ancestry must fail the context contract');
});

test('live route has the exact Transactions presentation seam', () => {
    const live = read(route).toString('utf8');
    assert.notEqual(live, plain, 'missing presentation: route still equals original fixture');
    checkCandidate(live);
});

if (process.argv.includes('--history')) {
    test('authentic Git base and exact authorized five-path scope', () => {
        assert.deepEqual(original, execFileSync('git', ['show', `${base}:${route}`], { cwd: root }));
        const changed = execFileSync('git', ['diff', '--name-only', '-z', base], { cwd: root }).toString().split('\0').filter(Boolean);
        const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
        const allowed = new Set([route, fixture, 'tests/js/contracts/transactions-dashboard-help-popup.cjs',
            'tests/js/transactions-dashboard-help-popup.test.js', 'docs/clinical-ui/TRANSACTIONS-DASHBOARD-HELP-POPUP.md']);
        for (const file of [...new Set([...changed, ...untracked])]) assert.ok(allowed.has(file), `out-of-scope changed file: ${file}`);
    });
}
