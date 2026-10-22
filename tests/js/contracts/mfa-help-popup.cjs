'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const route = 'Documentation/help_files/mfa_help.php';
const fixture = 'tests/js/fixtures/mfa-help-popup-original.php.txt';
const originalHash = 'd729faa7cf70ba425c895059b28c11476c9d5df801fc1417bf30a133bfda0975';
const protectedHashes = {
    'interface/usergroup/mfa_registrations.php': '33c7d88ff16d83044df76888ea5280546912ed2b2ea965169017009e3ec6e56d',
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
const bodyClass = 'mfa-help-workbench-route';
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

function count(source, needle) {
    return source.split(needle).length - 1;
}

function replaceAnchor(source, anchor, replacement, occurrences = 1) {
    assert.equal(count(source, anchor), occurrences, `mutation anchor count: ${anchor}`);
    assert.notEqual(anchor, replacement);
    return source.split(anchor).join(replacement);
}

const candidate = replaceAnchor(replaceAnchor(plain, headEnd, style + headEnd), oldBody, newBody);

function checkCandidate(source) {
    assert.equal(count(source, '<style>'), 2, 'original info style plus one new style');
    assert.equal(count(source, '</style>'), 2, 'both styles close');
    assert.equal(count(source, style), 1, 'exact screen-only five-rule wrapper');
    assert.equal(count(source, '!important'), 2, 'only heading paper and redirect ink override theme');
    assert.equal(count(source, bodyClass), 6, 'five selectors and one body marker');
    assert.equal(count(source, newBody), 1);
    assert.equal(count(source, headEnd), 1);
    assert.equal(source, candidate, 'only the two exact presentation additions are allowed');
    const recovered = source.replace(style, '').replace(newBody, oldBody);
    assert.deepEqual(Buffer.from(recovered), original, 'exact inverse restores every original byte');
}

test('complete nonexecuting fixture pins every original MFA help byte', () => {
    assert.ok(fixture.endsWith('.php.txt'));
    assert.equal(original.length, 23182);
    assert.equal(plain.split('\n').length - 1, 324);
    assert.equal(sha(original), originalHash);
    assert.equal(count(plain, '<style>'), 1);
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, `        .oe-help-add-info{
            padding:15px;
            border:6px solid;
            font-style: italic;
        }`), 1, 'original info panel padding, border and italic style');
});

test('original MFA guidance, sections and controls are preserved by the exact inverse', () => {
    for (const id of ['section1', 'section2', 'section3', 'otp_details', 'totp_details', 'u2f_details']) {
        assert.equal(count(plain, `id="${id}"`), 1, id);
        assert.equal(count(candidate, `id="${id}"`), 1, id);
    }
    for (const id of ['otp_details', 'totp_details', 'u2f_details']) {
        const hidden = `id="${id}" class='hideaway oe-help-heading oe-help-add-info' style='display: none;'`;
        assert.equal(count(plain, hidden), 1, id);
        assert.equal(count(candidate, hidden), 1, id);
    }
    for (const phrase of [
        'However SMS text messages can be intercepted',
        'malware can steal these keys and thus compromise authentication',
        'If only capture the QR code but do not register the TOTP key',
        'if you click register but do not capture the QR code',
        'If phone is lost will not be able to login',
        'those with administrator privileges can delete the keys'
    ]) {
        assert.ok(plain.includes(phrase), phrase);
        assert.ok(candidate.includes(phrase), phrase);
    }
    for (const control of ['btn-search', 'btn-delete', 'btn-save']) {
        assert.ok(plain.includes(control));
        assert.ok(candidate.includes(control));
    }
    assert.equal(count(plain, `href="#top_section"`), 3);
    assert.equal(count(candidate, `href="#top_section"`), 3);
    assert.equal(count(plain, `$('.show_hide').click(function() {`), 1);
    assert.equal(count(plain, `$(this).parent().parent().closest('div').children('.hideaway').toggle('1000');`), 1);
    assert.ok(plain.includes(`xla('Click to Hide')`));
    assert.ok(plain.includes(`xla('Click to Show')`));
    checkCandidate(candidate);
});

test('synthetic future candidate passes before the live RED assertion', () => {
    checkCandidate(candidate);
});

test('presentation and original-source mutations fail closed', async t => {
    const mutations = {
        printMedia: s => replaceAnchor(s, '@media screen {', '@media print {'),
        lostContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html', 5),
        popupOnlyContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html.oe-workbench-popup', 5),
        missingBodyMarker: s => replaceAnchor(s, newBody, oldBody),
        extraBodyClass: s => replaceAnchor(s, newBody, `    <body class="${bodyClass} extra">`),
        missingCanvas: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: transparent;'),
        missingInk: s => replaceAnchor(s, 'color: var(--oe-wb-ink, #17343b);', 'color: inherit;', 4),
        missingPaper: s => replaceAnchor(s, 'background-color: var(--oe-wb-paper, #fff);', 'background-color: transparent;'),
        headingImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-paper, #fff) !important;', 'background-color: var(--oe-wb-paper, #fff);'),
        redirectImportant: s => replaceAnchor(s, 'color: var(--oe-wb-ink, #17343b) !important;', 'color: var(--oe-wb-ink, #17343b);'),
        extraImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'),
        buttonPaint: s => replaceAnchor(s, 'a:not(.btn)', 'a'),
        broadContainer: s => replaceAnchor(s, '> .oe-help-container', '.oe-help-container'),
        extraLayout: s => replaceAnchor(s, '    background-color: var(--oe-wb-canvas, #f3f7f5);', '    padding: 1rem;\n    background-color: var(--oe-wb-canvas, #f3f7f5);'),
        semanticControl: s => replaceAnchor(s, 'a:not(.btn)', 'a:not(.btn), button'),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        misplacedStyle: s => replaceAnchor(replaceAnchor(s, style + headEnd, headEnd), newBody, style + newBody),
        changedPhp: s => replaceAnchor(s, 'require_once("../../interface/globals.php");', 'require_once("../interface/globals.php");'),
        changedSection: s => replaceAnchor(s, 'id="section2"', 'id="section4"'),
        shownOtp: s => replaceAnchor(s, `id="otp_details" class='hideaway oe-help-heading oe-help-add-info' style='display: none;'`, `id="otp_details" class='hideaway oe-help-heading oe-help-add-info' style='display: block;'`),
        changedWarning: s => replaceAnchor(s, 'fa fa-exclamation-triangle  oe-text-red', 'fa fa-exclamation-triangle  oe-text-green'),
        changedControl: s => replaceAnchor(s, 'btn-delete btn-sm oe-no-float', 'btn-save btn-sm oe-no-float'),
        changedToggle: s => replaceAnchor(s, `.children('.hideaway').toggle('1000')`, `.children('.hideaway').hide()`),
        changedStyle: s => replaceAnchor(s, 'padding:15px;', 'padding:16px;'),
        changedSecurityText: s => replaceAnchor(s, 'However SMS text messages can be intercepted', 'SMS text messages are secure')
    };
    assert.ok(count(plain, 'fa fa-exclamation-triangle  oe-text-red') > 0);
    assert.equal(count(plain, `id="otp_details" class='hideaway oe-help-heading oe-help-add-info' style='display: none;'`), 1);
    for (const [name, mutate] of Object.entries(mutations)) {
        await t.test(name, () => {
            const changed = mutate(candidate);
            assert.notEqual(changed, candidate, 'mutation must change the candidate');
            assert.throws(() => checkCandidate(changed), assert.AssertionError);
        });
    }
});

test('actual MFA caller, OemrUI modal, shared assets and theme sources are pinned', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/usergroup/mfa_registrations.php').toString();
    const ui = read('src/OeUI/OemrUI.php').toString();
    const header = read('src/Core/Header.php').toString();
    const assets = read('config/config.yaml').toString();
    const popupCss = read('interface/clinical-workspace/popup.css').toString();
    const theme = read('interface/themes/colors/utilities/help-files.scss').toString();
    assert.match(caller, /'show_help_icon' => true,\s*'help_file_name' => "mfa_help\.php"/);
    assert.match(caller, /\$oemr_ui = new OemrUI\(\$arrOeUiSettings\)/);
    assert.match(caller, /\$oemr_ui->pageHeading\(\)/);
    assert.match(caller, /\$oemr_ui->oeBelowContainerDiv\(\)/);
    assert.match(ui, /\$this->display_help_icon = \$arrOeUiSettings\['show_help_icon'\] \?\? null/);
    assert.match(ui, /\$this->help_file = \$arrOeUiSettings\['help_file_name'\] \?\? null/);
    assert.match(ui, /get\('enable_help'\) !== 0 && \$this->display_help_icon/);
    assert.match(ui, /get\('enable_help'\) == "1"[\s\S]*?get\('enable_help'\) == "2"/);
    assert.match(ui, /\$this->display_help_icon \? \$this->helpFileModal\(\) : ''/);
    assert.match(ui, /<iframe src='' data-src='\$help_file' id='targetiframe'/);
    assert.match(ui, /<div class="modal fade" id="myModal"/);
    assert.doesNotMatch(ui, /class="[^"]*\bdialogModal\b/);
    assert.match(header, /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(assets, /workbench-popup:[\s\S]*?script: popup\.js[\s\S]*?link: popup\.css[\s\S]*?autoload: true/);
    for (const [token, value] of [['ink', '#17343b'], ['paper', '#fff'], ['canvas', '#f3f7f5']]) {
        assert.ok(popupCss.includes(`--oe-wb-${token}: ${value};`));
    }
    assert.match(theme, /\.oe-help-redirect[\s\S]*?color: \$darker !important;[\s\S]*?\.oe-help-heading[\s\S]*?background-color: \$palepale !important;/);
});

test('source-derived OemrUI click loads the MFA help iframe once', () => {
    const ui = read('src/OeUI/OemrUI.php').toString();
    const start = "$(document).on('click', '#help-href', function () {";
    const end = '            });';
    assert.equal(count(ui, start), 1);
    const begin = ui.indexOf(start);
    const finish = ui.indexOf(end, begin);
    assert.ok(finish > begin);
    const script = ui.slice(begin, finish + end.length);
    let listener;
    let src = '';
    let writes = 0;
    const document = {};
    const iframe = {
        attr(name, value) {
            assert.equal(name, 'src');
            if (value === undefined) return src;
            src = value;
            writes++;
        },
        data(name) {
            assert.equal(name, 'src');
            return '/Documentation/help_files/mfa_help.php';
        }
    };
    const $ = target => {
        if (target === document) return { on(event, selector, callback) {
            assert.equal(event, 'click');
            assert.equal(selector, '#help-href');
            listener = callback;
        } };
        assert.equal(target, '#targetiframe');
        return iframe;
    };
    vm.runInNewContext(script, { document, $ }, { filename: 'OemrUI-help-click.js' });
    assert.equal(typeof listener, 'function');
    assert.equal(src, '');
    listener();
    listener();
    assert.equal(src, '/Documentation/help_files/mfa_help.php');
    assert.equal(writes, 1);
});

function classList(initial = []) {
    const classes = new Set(initial);
    return { contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value), values: () => [...classes] };
}

function popupWindow({ active = false, shell = false, parent = null, origin = 'https://openemr.test', frame = false } = {}) {
    const html = { classList: classList() };
    const body = { classList: classList(active ? ['workbench-active'] : []), ownerDocument: null };
    const listeners = {};
    const doc = { documentElement: html, body, readyState: 'complete',
        querySelector: selector => shell && selector === '#mainBox [data-workbench-mode]' ? {} : null,
        defaultView: { MutationObserver: class { constructor(callback) { doc.observerCallback = callback; } observe() {} disconnect() { doc.disconnected = true; } } } };
    body.ownerDocument = doc;
    const win = { document: doc, location: { origin }, frameElement: frame ? { closest: selector => { assert.equal(selector, '.dialogModal'); return null; } } : null,
        opener: null, addEventListener: (name, callback) => { listeners[name] = callback; } };
    win.parent = parent || win;
    return { win, doc, html, body, listeners };
}

function activate(win) {
    vm.runInNewContext(read('interface/clinical-workspace/popup.js').toString(), { window: win, Set }, { filename: 'popup.js' });
    return win.OpenEMRWorkbenchPopup;
}

test('unchanged popup.js follows ordinary targetiframe through content frame to shell', () => {
    const shell = popupWindow({ active: true, shell: true });
    const content = popupWindow({ parent: shell.win, frame: true });
    const help = popupWindow({ parent: content.win, frame: true });
    assert.equal(content.win.frameElement.closest('.dialogModal'), null);
    assert.equal(help.win.frameElement.closest('.dialogModal'), null);
    const api = activate(help.win);
    assert.equal(api.CONTEXT_CLASS, 'oe-workbench-context');
    assert.equal(api.POPUP_CLASS, 'oe-workbench-popup');
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

test('unchanged popup.js leaves standalone, legacy and cross-origin help inert', () => {
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

test('live route has the exact MFA presentation seam', () => {
    const live = read(route).toString('utf8');
    assert.notEqual(live, plain, 'missing presentation: route still equals original fixture');
    checkCandidate(live);
});

if (process.argv.includes('--require-history')) {
    test('optional authentic Git baseline and exact five-file changed scope', () => {
        const base = '18647270e0c799189d2dc10f801e8de2bff1a360';
        assert.deepEqual(original, execFileSync('git', ['show', `${base}:${route}`], { cwd: root }));
        const changed = execFileSync('git', ['diff', '--name-only', '-z', base], { cwd: root }).toString().split('\0').filter(Boolean);
        const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
        const allowed = new Set([
            route,
            fixture,
            'tests/js/contracts/mfa-help-popup.cjs',
            'tests/js/mfa-help-popup.test.js',
            'docs/clinical-ui/MFA-HELP-POPUP.md'
        ]);
        for (const file of [...changed, ...untracked]) assert.ok(allowed.has(file), `out-of-scope changed file: ${file}`);
    });
}
