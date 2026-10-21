'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const route = 'Documentation/help_files/procedure_provider_help.php';
const fixture = 'tests/js/fixtures/procedure-provider-help-popup-original.php.txt';
const originalHash = 'f3cd65723f9957a1988c193a17b14968ecbb6a0daf4ab596c35130626acb50ef';
const protectedHashes = {
    'interface/orders/procedure_provider_list.php': 'e37e9bbde3314dd64d44375741c5068e981ea408672e1251b2d0de797ef67af5',
    'interface/help_modal.php': '2c0e4134fc53a671a1a15a4c6579e33253550f1e7678a01422f823f31ae8b083',
    'src/Core/Header.php': 'dee3fd5f35bfd900ed119ae45981142ed737dac48059e54cacb4af843d6d264d',
    'config/config.yaml': '5f99c981f570a2f94917d68a4abcedf086eb75a102364bf71f1cb44ccfe461b7',
    'interface/clinical-workspace/popup.js': 'af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f',
    'interface/themes/oe-common/help-files-common.scss': '351591fcc07fec98bae35aadc32ab4dafa13b8d54cbb36babcbf07ef3b2abe8a',
    'interface/themes/colors/utilities/help-files.scss': '7e56fa424f7fbc0971d1d9c3dbc6b6f00ce15e2a0d0b4e89aaab71befc927e19'
};
const read = file => readFileSync(path.join(root, file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = read(fixture);
const plain = original.toString('utf8');
const bodyClass = 'procedure-provider-help-workbench-route';
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
const originalHeadEnd = '    </head>';
const originalBody = '    <body>';
const candidate = plain.replace(originalHeadEnd, style + originalHeadEnd)
    .replace(originalBody, `    <body class="${bodyClass}">`);

function count(source, needle) {
    return source.split(needle).length - 1;
}

function checkCandidate(source) {
    assert.equal(count(source, '<style>'), 1, 'one local style block');
    assert.equal(count(source, '</style>'), 1, 'one closed local style block');
    assert.equal(count(source, style), 1, 'exact screen-only, scoped, paired paint seam');
    assert.equal(count(source, '!important'), 2, 'only heading background and redirect color override theme paint');
    assert.equal(count(source, bodyClass), 6, 'scope repeated only in the five rules and body class');
    assert.equal(count(source, `<body class="${bodyClass}">`), 1, 'one exact route body class');
    assert.equal(count(source, originalHeadEnd), 1, 'one head close');
    assert.equal(count(source, originalBody), 0, 'original body tag replaced');
    assert.equal(source, candidate, 'exact inverse preserves every original byte outside the two insertions');
    const recovered = source.replace(style, '').replace(`    <body class="${bodyClass}">`, originalBody);
    assert.equal(sha(Buffer.from(recovered)), originalHash, 'inverse returns pinned original bytes');
}

function rejectsChange(transform) {
    const changed = transform(candidate);
    assert.notEqual(changed, candidate, 'mutation must change its input');
    assert.throws(() => checkCandidate(changed), assert.AssertionError);
}

test('fixture pins every original byte and remains nonexecuting', () => {
    assert.equal(sha(original), originalHash);
    assert.ok(fixture.endsWith('.php.txt'));
    assert.equal(count(plain, '<?php'), count(plain, '?>'));
});

test('synthetic future seam has an exact inverse at the unique head and body locations', () => {
    assert.equal(count(plain, originalHeadEnd), 1);
    assert.equal(count(plain, originalBody), 1);
    assert.equal(count(plain, '<style>'), 0);
    checkCandidate(candidate);
});

test('independent seam mutations fail closed', async t => {
    const changes = {
        media: s => s.replace('@media screen', '@media print'),
        scope: s => s.replace('html.oe-workbench-context', 'html'),
        extraImportant: s => s.replace('color: var(--oe-wb-ink, #17343b);', 'color: var(--oe-wb-ink, #17343b) !important;'),
        missingCanvasInk: s => s.replace('        background-color: var(--oe-wb-canvas, #f3f7f5);\n        color: var(--oe-wb-ink, #17343b);', '        background-color: var(--oe-wb-canvas, #f3f7f5);'),
        missingPaperInk: s => s.replace('        background-color: var(--oe-wb-paper, #fff);\n        color: var(--oe-wb-ink, #17343b);', '        background-color: var(--oe-wb-paper, #fff);'),
        missingHeadingPaint: s => s.replace('        background-color: var(--oe-wb-paper, #fff) !important;\n', ''),
        missingRedirectPaint: s => s.replace('        background-color: transparent;\n        color: var(--oe-wb-ink, #17343b) !important;', '        color: var(--oe-wb-ink, #17343b) !important;'),
        misplacedSeam: s => s.replace(style + originalHeadEnd, originalHeadEnd).replace('    <body class=', style + '    <body class='),
        duplicateSeam: s => s.replace(style, style + style),
        missingBody: s => s.replace(`<body class="${bodyClass}">`, '<body>'),
        duplicateBody: s => s.replace(`<body class="${bodyClass}">`, `<body class="${bodyClass} ${bodyClass}">`),
        changedPhp: s => s.replace('require_once("../../interface/globals.php");', 'require_once("../interface/globals.php");'),
        changedText: s => s.replace('Procedure Provider Help', 'Procedure Providers Help'),
        changedAnchor: s => s.replace('href="#section1"', 'href="#section2"'),
        changedToggle: s => s.replace("$('.hideaway').toggle('1000');", "$('.hideaway').hide();"),
        changedControl: s => s.replace('btn-save btn-sm', 'btn-delete btn-sm'),
        changedWarning: s => s.replace('fa-exclamation-triangle  oe-text-red', 'fa-exclamation-triangle  oe-text-green'),
        changedSemanticIcon: s => s.replace('fa-lightbulb-o fa-lg  oe-text-green', 'fa-lightbulb-o fa-lg  oe-text-red'),
        unrelatedEdit: s => s.replace('Message Center Help.', 'Procedure Help.')
    };
    for (const [name, mutate] of Object.entries(changes)) {
        await t.test(name, () => rejectsChange(mutate));
    }
});

test('protected caller, modal, Header, discovery and theme sources retain their pinned bytes', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/orders/procedure_provider_list.php').toString();
    const modal = read('interface/help_modal.php').toString();
    const header = read('src/Core/Header.php').toString();
    const assets = read('config/config.yaml').toString();
    assert.match(caller, /get\('enable_help'\) == 1[\s\S]*?id="help-href/);
    assert.match(caller, /get\('enable_help'\) == 1\) \{\s*echo "<script>var helpFile = 'procedure_provider_help\.php'<\/script>";[\s\S]*?require "\.\.\/help_modal\.php";/);
    assert.match(modal, /<div class="modal fade" id="myModal"[^>]*>[\s\S]*?<iframe[^>]*id="targetiframe"/);
    assert.doesNotMatch(modal, /class="[^"]*\bdialogModal\b/);
    assert.match(modal, /id="targetiframe"/);
    assert.match(modal, /getElementById\('targetiframe'\)\.src = helpFilePath \+ helpFile/);
    assert.match(header, /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(assets, /workbench-popup:[\s\S]*?script: popup\.js[\s\S]*?autoload: true/);
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
    const source = read('interface/clinical-workspace/popup.js').toString();
    vm.runInNewContext(source, { window: win, Set }, { filename: 'popup.js' });
    return win.OpenEMRWorkbenchPopup;
}

test('actual popup.js scopes help iframe through content frame and shell, including legacy transitions', () => {
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

test('actual popup.js remains inert for standalone, legacy and cross-origin iframe routes', () => {
    const standalone = popupWindow();
    activate(standalone.win);
    assert.deepEqual(standalone.html.classList.values(), []);
    const legacy = popupWindow({ shell: true });
    const legacyChild = popupWindow({ parent: legacy.win, frame: true });
    activate(legacyChild.win);
    assert.deepEqual(legacyChild.html.classList.values(), []);
    const foreign = popupWindow({ active: true, origin: 'https://other.test' });
    const foreignChild = popupWindow({ parent: foreign.win, frame: true });
    activate(foreignChild.win);
    assert.deepEqual(foreignChild.html.classList.values(), []);
});

test('live route implements the exact workbench presentation seam', () => {
    checkCandidate(read(route).toString('utf8'));
});

if (process.argv.includes('--require-history')) {
    test('optional historical pin equals 18647270 route', () => {
        const historical = execFileSync('git', ['show', `18647270:${route}`], { cwd: root });
        assert.deepEqual(original, historical);
    });
}
