'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const route = 'Documentation/help_files/configure_orders_help.php';
const fixture = 'tests/js/fixtures/configure-orders-help-popup-original.php.txt';
const originalHash = 'd698ac3b06df9fd8c2db37f93e5883061bc0c1a3b1fd886d94a87bd8e06bea00';
const protectedHashes = {
    'interface/orders/types.php': '202c4e2762658bbc2e7d497a420cab8d993727ca88e3f0e6d729b7628755f03c',
    'interface/help_modal.php': '2c0e4134fc53a671a1a15a4c6579e33253550f1e7678a01422f823f31ae8b083',
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
const bodyClass = 'configure-orders-help-workbench-route';
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
        color: var(--oe-wb-ink, #17343b);
      }

      ${scope} .oe-help-redirect {
        background-color: transparent;
        color: var(--oe-wb-ink, #17343b) !important;
      }
    }
    </style>
`;
const headEnd = '    </head>';
const oldBody = '    <body>';
const newBody = `    <body class="${bodyClass}">`;
const candidate = plain.replace(headEnd, style + headEnd).replace(oldBody, newBody);

function count(source, needle) {
    return source.split(needle).length - 1;
}

function replaceAnchor(source, anchor, replacement, occurrences = 1) {
    assert.equal(count(source, anchor), occurrences, `mutation anchor count: ${anchor}`);
    assert.notEqual(anchor, replacement);
    return source.replace(anchor, replacement);
}

function checkCandidate(source) {
    assert.equal(count(source, '<style>'), 1, 'one route-local style block');
    assert.equal(count(source, '</style>'), 1, 'one closed route-local style block');
    assert.equal(count(source, style), 1, 'exact five screen-only, scoped, paired paint rules');
    assert.equal(count(source, '!important'), 2, 'only heading background and redirect ink override important theme paint');
    assert.equal(count(source, bodyClass), 6, 'five selectors and one body class');
    assert.equal(count(source, newBody), 1, 'one exact route body class');
    assert.equal(count(source, headEnd), 1, 'one existing head close');
    assert.equal(source, candidate, 'exact inverse: only the planned presentation seam may differ from the original');
    const recovered = source.replace(style, '').replace(newBody, oldBody);
    assert.equal(sha(Buffer.from(recovered)), originalHash, 'inverse restores every original byte');
}

test('complete nonexecuting fixture pins the original Configure Orders route', () => {
    assert.ok(fixture.endsWith('.php.txt'));
    assert.equal(original.length, 53358);
    assert.equal(plain.split('\n').length - 1, 640);
    assert.equal(sha(original), originalHash);
    for (const section of [1, 2, 3, 4, 5]) assert.equal(count(plain, `id="section${section}"`), 1);
    assert.equal(count(plain, '<style>'), 0);
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
});

test('synthetic future candidate passes the exact inverse before the live route is checked', () => {
    checkCandidate(candidate);
});

test('independent presentation and preservation mutants fail closed', async t => {
    const mutations = {
        printMedia: s => replaceAnchor(s, '@media screen', '@media print'),
        lostContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html', 5),
        popupContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html.oe-workbench-popup', 5),
        missingBodyClass: s => replaceAnchor(s, newBody, oldBody),
        extraBodyClass: s => replaceAnchor(s, newBody, `    <body class="${bodyClass} extra">`),
        missingCanvas: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: transparent;'),
        missingInk: s => replaceAnchor(s, '        color: var(--oe-wb-ink, #17343b);', '        color: inherit;', 4),
        missingPaper: s => replaceAnchor(s, 'background-color: var(--oe-wb-paper, #fff);', 'background-color: transparent;', 1),
        missingHeadingOverride: s => replaceAnchor(s, 'background-color: var(--oe-wb-paper, #fff) !important;', 'background-color: var(--oe-wb-paper, #fff);'),
        missingRedirectOverride: s => replaceAnchor(s, 'color: var(--oe-wb-ink, #17343b) !important;', 'color: var(--oe-wb-ink, #17343b);'),
        extraImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'),
        buttonAnchorIncluded: s => replaceAnchor(s, 'a:not(.btn)', 'a'),
        broadContainer: s => replaceAnchor(s, '> .oe-help-container', '.oe-help-container'),
        changedIndent: s => replaceAnchor(s, '@media screen {\n      ', '@media screen {\n        '),
        extraLayout: s => replaceAnchor(s, '        background-color: var(--oe-wb-canvas, #f3f7f5);', '        padding: 1rem;\n        background-color: var(--oe-wb-canvas, #f3f7f5);'),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        movedStyle: s => replaceAnchor(s, style + headEnd, headEnd).replace(newBody, style + newBody),
        changedPhp: s => replaceAnchor(s, 'require_once("../../interface/globals.php");', 'require_once("../interface/globals.php");'),
        changedTitleMismatch: s => replaceAnchor(s, 'xlt("Message Center Help")', 'xlt("Configure Orders Help")'),
        changedSectionFive: s => replaceAnchor(s, 'id="section5"', 'id="section6"'),
        removedElectronicOrders: s => replaceAnchor(s, 'The system is designed to both place orders electronically and receive the results electronically', 'The system can place orders'),
        changedToggle: s => replaceAnchor(s, "$('.hideaway').toggle('1000');", "$('.hideaway').hide();"),
        changedControl: s => replaceAnchor(s, 'btn-refresh oe-no-float', 'btn-delete oe-no-float'),
        changedOrangeIcon: s => replaceAnchor(s, 'fa fa-exclamation-circle oe-text-orange"  aria-hidden="true"', 'fa fa-exclamation-circle oe-text-green"  aria-hidden="true"', count(plain, 'fa fa-exclamation-circle oe-text-orange"  aria-hidden="true"')),
        changedRedIcon: s => replaceAnchor(s, 'fa fa-exclamation-triangle oe-text-red"  aria-hidden="true"', 'fa fa-exclamation-triangle oe-text-green"  aria-hidden="true"', 2),
        changedWorksheetHref: s => replaceAnchor(s, 'href="../../interface/orders/configure_orders_worksheet.ods"', 'href="../../interface/orders/worksheet.ods"'),
        removedWorksheetDownload: s => replaceAnchor(s, 'download="Configure Orders Worksheet"', 'download=""'),
        changedExternalLink: s => replaceAnchor(s, 'href="https://loinc.org/" rel="noopener" target="_blank"', 'href="https://loinc.org/" target="_blank"'),
        unrelatedEdit: s => replaceAnchor(s, 'This page lets you configure the orders and results', 'This page explains orders')
    };
    assert.ok(count(plain, 'fa fa-exclamation-circle oe-text-orange"  aria-hidden="true"') > 1, 'orange icon has deliberately repeated anchor');
    for (const [name, mutate] of Object.entries(mutations)) {
        await t.test(name, () => {
            const changed = mutate(candidate);
            assert.notEqual(changed, candidate, 'mutation must change candidate');
            assert.throws(() => checkCandidate(changed), assert.AssertionError);
        });
    }
});

test('actual caller, modal, Header, popup controller, token sheet and help theme retain pinned bytes', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/orders/types.php').toString();
    const modal = read('interface/help_modal.php').toString();
    const header = read('src/Core/Header.php').toString();
    const assets = read('config/config.yaml').toString();
    const popupCss = read('interface/clinical-workspace/popup.css').toString();
    assert.match(caller, /get\('enable_help'\) == 1[\s\S]*?id="help-href/);
    assert.match(caller, /get\('enable_help'\) == 1\) \{\s*echo "<script>var helpFile = 'configure_orders_help\.php'<\/script>";[\s\S]*?require "\.\.\/help_modal\.php";/);
    assert.match(modal, /<div class="modal fade" id="myModal"[^>]*>[\s\S]*?<iframe[^>]*id="targetiframe"/);
    assert.doesNotMatch(modal, /class="[^"]*\bdialogModal\b/);
    assert.match(modal, /getElementById\('targetiframe'\)\.src = helpFilePath \+ helpFile/);
    assert.match(header, /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(assets, /workbench-popup:[\s\S]*?script: popup\.js[\s\S]*?link: popup\.css[\s\S]*?autoload: true/);
    for (const [token, value] of [['ink', '#17343b'], ['paper', '#fff'], ['canvas', '#f3f7f5']]) {
        assert.match(popupCss, new RegExp(`--oe-wb-${token}: ${value.replace('#', '\\#')};`));
    }
    assert.match(read('interface/themes/colors/utilities/help-files.scss').toString(), /\.oe-help-redirect[\s\S]*?color: \$darker !important;[\s\S]*?\.oe-help-heading[\s\S]*?background-color: \$palepale !important;/);
});

function classList(initial = []) {
    const classes = new Set(initial);
    return { contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value), values: () => [...classes] };
}

function popupWindow({ active = false, shell = false, parent = null, origin = 'https://openemr.test', frame = false } = {}) {
    const html = { classList: classList() };
    const body = { classList: classList(active ? ['workbench-active'] : []), ownerDocument: null };
    const listeners = {};
    const doc = { documentElement: html, body, readyState: 'complete', querySelector: selector => shell && selector === '#mainBox [data-workbench-mode]' ? {} : null,
        defaultView: { MutationObserver: class { constructor(callback) { doc.observerCallback = callback; } observe() {} disconnect() { doc.disconnected = true; } } } };
    body.ownerDocument = doc;
    const win = { document: doc, location: { origin }, frameElement: frame ? { closest: () => null } : null,
        opener: null, addEventListener: (name, callback) => { listeners[name] = callback; } };
    win.parent = parent || win;
    return { win, doc, html, body, listeners };
}

function activate(win) {
    vm.runInNewContext(read('interface/clinical-workspace/popup.js').toString(), { window: win, Set }, { filename: 'popup.js' });
    return win.OpenEMRWorkbenchPopup;
}

test('actual popup.js gives an ordinary help modal iframe context through content and shell', () => {
    const shell = popupWindow({ active: true, shell: true });
    const content = popupWindow({ parent: shell.win, frame: true });
    const help = popupWindow({ parent: content.win, frame: true });
    assert.equal(content.win.frameElement.closest('.dialogModal'), null);
    assert.equal(help.win.frameElement.closest('.dialogModal'), null);
    assert.equal(content.win.opener, null);
    assert.equal(help.win.opener, null);
    const api = activate(help.win);
    assert.equal(api.CONTEXT_CLASS, 'oe-workbench-context');
    assert.deepEqual(help.html.classList.values(), ['oe-workbench-context']);
    assert.deepEqual(help.body.classList.values(), []);
    shell.body.classList.remove('workbench-active');
    shell.doc.observerCallback();
    assert.deepEqual(help.html.classList.values(), []);
    shell.body.classList.add('workbench-active');
    shell.doc.observerCallback();
    assert.deepEqual(help.html.classList.values(), ['oe-workbench-context']);
    help.listeners.pagehide();
    assert.deepEqual(help.html.classList.values(), []);
    assert.equal(shell.doc.disconnected, true);
});

test('actual popup.js stays inert for standalone, legacy and cross-origin help frames', () => {
    const standalone = popupWindow();
    activate(standalone.win);
    assert.deepEqual(standalone.html.classList.values(), []);
    const legacy = popupWindow({ shell: true });
    const legacyHelp = popupWindow({ parent: legacy.win, frame: true });
    activate(legacyHelp.win);
    assert.deepEqual(legacyHelp.html.classList.values(), []);
    const foreign = popupWindow({ active: true, origin: 'https://other.test' });
    const foreignHelp = popupWindow({ parent: foreign.win, frame: true });
    activate(foreignHelp.win);
    assert.deepEqual(foreignHelp.html.classList.values(), []);
});

test('live route implements the exact Configure Orders workbench presentation seam', () => {
    assert.notEqual(read(route).toString('utf8'), plain, 'missing presentation seam: route still equals original fixture');
    checkCandidate(read(route).toString('utf8'));
});

if (process.argv.includes('--require-history')) {
    test('optional complete historical base and changed-file scope', () => {
        const base = '18647270e0c799189d2dc10f801e8de2bff1a360';
        assert.deepEqual(original, execFileSync('git', ['show', `${base}:${route}`], { cwd: root }));
        const changed = execFileSync('git', ['diff', '--name-only', '-z', base], { cwd: root }).toString().split('\0').filter(Boolean);
        const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
        const allowed = new Set([
            route,
            fixture,
            'tests/js/contracts/configure-orders-help-popup.cjs',
            'tests/js/configure-orders-help-popup.test.js',
            'docs/clinical-ui/CONFIGURE-ORDERS-HELP-POPUP.md'
        ]);
        for (const file of [...changed, ...untracked]) assert.ok(allowed.has(file), `out-of-scope changed file: ${file}`);
    });
}
