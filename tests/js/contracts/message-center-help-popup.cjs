'use strict';

// Portable source contracts: this file reads PHP but never evaluates or requests it.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const base = '18647270e0c799189d2dc10f801e8de2bff1a360';
const route = 'Documentation/help_files/message_center_help.php';
const fixture = 'tests/js/fixtures/message-center-help-popup-original.php.txt';
const read = file => readFileSync(path.join(root, file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = read(fixture);
const plain = original.toString('utf8');
const protectedHashes = {
    'interface/main/messages/messages.php': '64c7e5fe0fcfdbf169fc88b261ce10c20c0bae5ad928320c23396eb8efd8f84e',
    'interface/help_modal.php': '2c0e4134fc53a671a1a15a4c6579e33253550f1e7678a01422f823f31ae8b083',
    'library/MedEx/API.php': '4692a66ef546b22b312672e8a87efe596022b4e5368fa09e7ce932ffb01c011b',
    'src/Services/Globals/UserSettingsService.php': '187bfdd5228ec6ec7cc862bfdf709261262f6f62c2e660db0e83268fe9ec86ac',
    'library/user.inc.php': 'f26edda7d1388aad64e9d1924fa679a21358c0ca46df899063a8f3c4f4037443',
    'src/OeUI/OemrUI.php': '478dd52733a2a50078d0610fc0e8e74bf8ad2c6c68d44abc612c8097eb99dc44',
    'src/Core/Header.php': 'dee3fd5f35bfd900ed119ae45981142ed737dac48059e54cacb4af843d6d264d',
    'config/config.yaml': '5f99c981f570a2f94917d68a4abcedf086eb75a102364bf71f1cb44ccfe461b7',
    'interface/clinical-workspace/popup.js': 'af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f',
    'interface/clinical-workspace/popup.css': 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9',
    'interface/themes/colors/utilities/help-files.scss': '7e56fa424f7fbc0971d1d9c3dbc6b6f00ce15e2a0d0b4e89aaab71befc927e19',
    'interface/themes/oe-common/help-files-common.scss': '351591fcc07fec98bae35aadc32ab4dafa13b8d54cbb36babcbf07ef3b2abe8a'
};
const bodyClass = 'oe-message-center-help-popup';
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
const count = (source, needle) => source.split(needle).length - 1;

function replaceAnchor(source, anchor, replacement, occurrences = 1) {
    assert.equal(count(source, anchor), occurrences, `mutation anchor count: ${anchor}`);
    assert.notEqual(anchor, replacement);
    const changed = source.split(anchor).join(replacement);
    assert.notEqual(changed, source, 'mutation must change bytes');
    return changed;
}

const candidate = replaceAnchor(replaceAnchor(plain, headEnd, style + headEnd), oldBody, newBody);

function checkCandidate(source) {
    assert.equal(count(source, style), 1, 'one exact screen palette block before </head>');
    assert.equal(count(source, '<style>'), 2, 'original responsive block plus one addition');
    assert.equal(count(source, '</style>'), 2);
    assert.equal(count(source, '@media screen {'), 1);
    assert.equal(count(source, scope), 5);
    assert.equal(count(source, newBody), 1);
    assert.equal(count(source, '!important'), count(plain, '!important') + 2,
        'new important declarations are heading background and redirect foreground only');
    assert.equal(source, candidate, 'full source must equal the two-addition synthetic candidate');
    assert.deepEqual(Buffer.from(source.replace(style, '').replace(newBody, oldBody)), original,
        'removing both presentation additions restores all 25,042 original bytes');
}

test('complete nonexecuting fixture freezes the actual Message Center help file', () => {
    assert.ok(fixture.endsWith('.php.txt'));
    assert.equal(original.length, 25042);
    assert.equal(sha(original), 'a82ee97560b1dc79a497c98ffd713018717f53d63fafbbd5f7df5ec78a123ba6');
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '<style>'), 1);
    assert.equal(count(plain, '@media only screen and (max-width: 768px)'), 1);
});

test('four sections, 21 illustrations, translation and historical markup stay frozen', () => {
    for (const id of ['messages', 'reminders', 'recalls', 'medex_communication_service']) {
        assert.equal(count(plain, `id="${id}"`), 1, id);
        assert.equal(count(plain, `href="#${id}"`), 1, id);
    }
    assert.equal(count(plain, 'class="oe-help-heading"'), 4);
    assert.equal(count(plain, '<button'), 21);
    assert.equal(count(plain, 'oe-help-redirect"'), 4);
    assert.equal(count(plain, 'rel="noopener" target="_blank"'), 2);
    assert.equal(count(plain, 'data-original-title="" title=""'), 2);
    assert.equal(count(plain, 'require_once("../../interface/globals.php");'), 1);
    assert.equal(count(plain, '<?php Header::setupHeader();?>'), 1);
    for (const phrase of ['The default installation will not make the phone call automatically',
        'SMS zone - This section lets use send and receive SMS texts',
        'It is a commercial messaging module available to openEMR practices utilizing version 5.0.1 and higher',
        '<p><i class="fa fa-exclamation-circle oe-text-orange" aria-hidden="true"></i> <strong></p>',
        'fa fa-external-link-alt text-primary', 'fa fa-video-camera text-primary',
        'fa fa-exclamation-triangle oe-text-red', 'btn btn-secondary']) assert.ok(plain.includes(phrase), phrase);
    checkCandidate(candidate);
});

test('synthetic future Message Center candidate satisfies all five paired screen rules', () => {
    checkCandidate(candidate);
});

test('anchored seam, declaration, print, content and behavior mutations fail closed', () => {
    const mutations = {
        missingStyle: s => replaceAnchor(s, style, ''),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        relocatedStyle: s => replaceAnchor(replaceAnchor(s, style + headEnd, headEnd), newBody, style + newBody),
        missingBodyClass: s => replaceAnchor(s, newBody, oldBody),
        duplicateBodyClass: s => replaceAnchor(s, newBody, newBody + newBody),
        broadBodyClass: s => replaceAnchor(s, newBody, `    <body class="${bodyClass} other">`),
        printMedia: s => replaceAnchor(s, '@media screen {', '@media print {'),
        allMedia: s => replaceAnchor(s, '@media screen {', '@media all {'),
        popupContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html.oe-workbench-popup', 5),
        broadContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html', 5),
        descendantPaper: s => replaceAnchor(s, '> .oe-help-container', '.oe-help-container'),
        buttonLinks: s => replaceAnchor(s, 'a:not(.btn)', 'a'),
        semanticIcon: s => replaceAnchor(s, '.oe-help-redirect {', '.oe-help-redirect, .oe-text-red {'),
        externalIcon: s => replaceAnchor(s, '.oe-help-redirect {', '.oe-help-redirect, .text-primary {'),
        canvasToken: s => replaceAnchor(s, 'var(--oe-wb-canvas, #f3f7f5)', '#f3f7f5'),
        paperToken: s => replaceAnchor(s, 'var(--oe-wb-paper, #fff)', '#fff', 2),
        inkToken: s => replaceAnchor(s, 'var(--oe-wb-ink, #17343b)', 'inherit', 5),
        missingHeadingImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-paper, #fff) !important;', 'background-color: var(--oe-wb-paper, #fff);'),
        missingRedirectImportant: s => replaceAnchor(s, 'color: var(--oe-wb-ink, #17343b) !important;', 'color: var(--oe-wb-ink, #17343b);'),
        extraImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'),
        geometry: s => replaceAnchor(s, `  ${scope} {`, `  ${scope} {\n    padding: 1rem;`),
        font: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'font-family: Arial;\n    background-color: var(--oe-wb-canvas, #f3f7f5);'),
        legacyResponsive: s => replaceAnchor(s, 'max-width: 768px', 'max-width: 769px'),
        changedPhp: s => replaceAnchor(s, 'require_once("../../interface/globals.php");', 'require_once("../interface/globals.php");'),
        changedTranslation: s => replaceAnchor(s, 'Messages, Reminders, Recalls', 'Messages and Recalls'),
        changedAnchor: s => replaceAnchor(s, 'id="reminders"', 'id="reminder"'),
        changedButton: s => replaceAnchor(s, '<button type="button"', '<button type="submit"', 20),
        changedWarning: s => replaceAnchor(s, 'oe-text-orange', 'oe-text-green', count(s, 'oe-text-orange')),
        changedExternalMetadata: s => replaceAnchor(s, 'rel="noopener" target="_blank"', 'target="_blank"', 2),
        changedHistoricalAdvice: s => replaceAnchor(s, 'The default installation will not make the phone call automatically', 'The installation makes phone calls automatically'),
        repairedMalformedMarkup: s => replaceAnchor(s, '<strong></p>', '<strong>'),
        scriptInjection: s => replaceAnchor(s, headEnd, '<script>alert(1)</script>\n' + headEnd)
    };
    for (const [name, mutate] of Object.entries(mutations)) {
        const mutant = mutate(candidate);
        assert.notDeepEqual(Buffer.from(mutant), Buffer.from(candidate), `${name} must change candidate bytes`);
        assert.throws(() => checkCandidate(mutant), assert.AssertionError, name);
    }
});

test('caller, both help paths, MedEx/settings boundaries and shared sources remain pinned', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/main/messages/messages.php').toString();
    const legacy = read('interface/help_modal.php').toString();
    const ui = read('src/OeUI/OemrUI.php').toString();
    const header = read('src/Core/Header.php').toString();
    const config = read('config/config.yaml').toString();
    const medex = read('library/MedEx/API.php').toString();
    const settings = read('src/Services/Globals/UserSettingsService.php').toString();
    const css = read('interface/clinical-workspace/popup.css').toString();
    const common = read('interface/themes/oe-common/help-files-common.scss').toString();
    const colors = read('interface/themes/colors/utilities/help-files.scss').toString();
    assert.match(caller, /new MedExApi\\MedEx\('MedExBank\.com'\)/);
    assert.match(caller, /getBoolean\('medex_enable'\)[\s\S]*?\$MedEx->login\(''\)[\s\S]*?\$MedEx->login\(\)/);
    assert.match(caller, /prevSetting\('', 'setting_bootstrap_submenu'/);
    assert.match(caller, /UserSettingsService::prevSetting\(/);
    assert.match(settings, /self::setUserSetting\(\$setting_key, \$initval\)/);
    assert.match(medex, /curl_exec\(\$this->handle\)/);
    assert.match(caller, /'show_help_icon' => true,\s*'help_file_name' => "message_center_help\.php"/);
    assert.match(caller, /\$oemr_ui = new OemrUI\(\$arrOeUiSettings\)/);
    assert.match(caller, /\$oemr_ui->oeBelowContainerDiv\(\)/);
    assert.match(caller, /get\('enable_help'\) == 1\) \{\s*echo "<script>var helpFile = 'message_center_help\.php'<\/script>";[\s\S]*?require "\.\.\/\.\.\/help_modal\.php"/);
    assert.match(caller, /get\('enable_help'\) == 2[\s\S]*?get\('enable_help'\) == 0/);
    assert.match(ui, /get\('enable_help'\) !== 0 && \$this->display_help_icon/);
    assert.match(ui, /get\('enable_help'\) == "1"[\s\S]*?get\('enable_help'\) == "2"/);
    assert.match(ui, /<iframe src='' data-src='\$help_file' id='targetiframe'/);
    assert.match(legacy, /<iframe src="" id="targetiframe"/);
    assert.match(legacy, /helpFilePath \+ helpFile/);
    for (const modal of [ui, legacy]) {
        assert.match(modal, /<div class="modal fade" id="myModal"/);
        assert.doesNotMatch(modal, /class="[^"]*\bdialogModal\b/);
    }
    assert.match(header, /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(config, /workbench-popup:[\s\S]*?script: popup\.js[\s\S]*?link: popup\.css[\s\S]*?autoload: true/);
    for (const [token, value] of [['ink', '#17343b'], ['paper', '#fff'], ['canvas', '#f3f7f5']]) {
        assert.ok(css.includes(`--oe-wb-${token}: ${value};`), token);
    }
    assert.match(colors, /\.oe-help-redirect[\s\S]*?color: \$darker !important;[\s\S]*?\.oe-help-heading[\s\S]*?background-color: \$palepale !important;/);
    assert.match(common, /\.oe-help-container a[\s\S]*?\.oe-help-heading[\s\S]*?\.oe-text-orange/);
});

test('source-derived OemrUI first click loads the help iframe once', () => {
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
        data(name) { assert.equal(name, 'src'); return '/Documentation/help_files/message_center_help.php'; }
    };
    const $ = target => target === document ? { on(event, selector, callback) {
        assert.equal(event, 'click'); assert.equal(selector, '#help-href'); listener = callback;
    } } : (assert.equal(target, '#targetiframe'), iframe);
    vm.runInNewContext(ui.slice(begin, finish + end.length), { document, $ }, { filename: 'OemrUI-help-click.js' });
    assert.equal(src, '');
    listener(); listener();
    assert.equal(src, '/Documentation/help_files/message_center_help.php');
    assert.equal(writes, 1);
});

test('source-derived alternate help_modal click keeps its existing assignment', () => {
    const legacy = read('interface/help_modal.php').toString();
    const start = "$('#help-href').click (function(){";
    const end = '        })';
    assert.equal(count(legacy, start), 1);
    const begin = legacy.indexOf(start);
    const finish = legacy.indexOf(end, begin);
    assert.ok(finish > begin);
    let listener;
    const iframe = { src: '' };
    const document = { getElementById(id) { assert.equal(id, 'targetiframe'); return iframe; } };
    const $ = selector => (assert.equal(selector, '#help-href'), { click(callback) { listener = callback; } });
    vm.runInNewContext(legacy.slice(begin, finish + end.length),
        { $, document, helpFilePath: '/Documentation/help_files/', helpFile: 'message_center_help.php' },
        { filename: 'help_modal-click.js' });
    listener();
    assert.equal(iframe.src, '/Documentation/help_files/message_center_help.php');
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

test('actual controller marks ordinary help iframe context only and cleans up', () => {
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
        'let current = parentWindow && parentWindow !== self ? parentWindow : null;', 'let current = null;');
    const otherShell = popupWindow({ active: true, shell: true });
    const otherContent = popupWindow({ parent: otherShell.win, frameId: 'contentframe' });
    const otherHelp = popupWindow({ parent: otherContent.win, frameId: 'targetiframe' });
    vm.runInNewContext(broken, { window: otherHelp.win, Set }, { filename: 'popup-broken.js' });
    assert.deepEqual(otherHelp.html.classList.values(), [], 'parent traversal mutation loses context');
});

test('controller leaves standalone, legacy and foreign-origin help without context', () => {
    const standalone = popupWindow(); activate(standalone.win);
    assert.deepEqual(standalone.html.classList.values(), []);
    const legacyShell = popupWindow({ shell: true });
    const legacyHelp = popupWindow({ parent: legacyShell.win, frameId: 'targetiframe' }); activate(legacyHelp.win);
    assert.deepEqual(legacyHelp.html.classList.values(), []);
    const foreign = popupWindow({ active: true, origin: 'https://other.test' });
    const foreignHelp = popupWindow({ parent: foreign.win, frameId: 'targetiframe' }); activate(foreignHelp.win);
    assert.deepEqual(foreignHelp.html.classList.values(), []);
});

test('live Message Center help route has the exact two-addition presentation seam', () => {
    const live = read(route).toString('utf8');
    assert.notEqual(live, plain, 'missing production presentation: route still equals original fixture');
    checkCandidate(live);
});

if (process.argv.includes('--history')) {
    test('mandatory local history authenticates base and the exact five-path write scope', () => {
        const git = args => execFileSync('git', args, { cwd: root });
        assert.equal(git(['branch', '--show-current']).toString().trim(), 'OPEMR-96-message-center-help');
        assert.deepEqual(original, git(['show', `${base}:${route}`]));
        for (const file of Object.keys(protectedHashes)) {
            assert.deepEqual(read(file), git(['show', `${base}:${file}`]), `base-protected source: ${file}`);
        }
        const names = args => git(args).toString().split('\0').filter(Boolean);
        const committed = names(['diff', '--no-renames', '--name-only', '-z', base, 'HEAD']);
        const dirty = names(['diff', '--no-renames', '--name-only', '-z', 'HEAD']);
        const staged = names(['diff', '--no-renames', '--cached', '--name-only', '-z']);
        const untracked = names(['ls-files', '--others', '--exclude-standard', '-z']);
        const allowed = new Set([route, fixture, 'tests/js/contracts/message-center-help-popup.cjs',
            'tests/js/message-center-help-popup.test.js', 'docs/clinical-ui/MESSAGE-CENTER-HELP-POPUP.md']);
        for (const file of new Set([...committed, ...dirty, ...staged, ...untracked])) {
            assert.ok(allowed.has(file), `out-of-scope changed file: ${file}`);
        }
    });
}
