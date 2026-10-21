'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const route = 'Documentation/help_files/cms_1500_help.php';
const fixture = 'tests/js/fixtures/cms-1500-help-popup-original.php.txt';
const originalHash = '178d64a0195e4224e85337082966e2afb9d2a34ed638fef1db648dd027789e91';
const protectedHashes = {
    'interface/forms/misc_billing_options/new.php': 'a5855f5d78028500f5bb6d456ae1a7023b6cfc169ff4da01c04bdb872d99c1d9',
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
const bodyClass = 'cms-1500-help-workbench-route';
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
    return source.split(anchor).join(replacement);
}

const candidate = replaceAnchor(replaceAnchor(plain, headEnd, style + headEnd), oldBody, newBody);

function checkCandidate(source) {
    assert.equal(count(source, '<style>'), 2, 'original responsive style plus one new style');
    assert.equal(count(source, '</style>'), 2, 'both style blocks close');
    assert.equal(count(source, style), 1, 'exact screen-only palette rules and formatting');
    assert.equal(count(source, '!important'), 2, 'only heading background and redirect ink overrides');
    assert.equal(count(source, '!Important'), 1, 'original responsive spelling is preserved');
    assert.equal(count(source, bodyClass), 6, 'five selectors and one body marker');
    assert.equal(count(source, headEnd), 1);
    assert.equal(count(source, newBody), 1);
    assert.equal(source, candidate, 'only the two exact presentation additions are allowed');
    assert.deepEqual(Buffer.from(source.replace(style, '').replace(newBody, oldBody)), original,
        'inverse restores every original byte');
}

test('complete nonexecuting fixture pins every original CMS-1500 help byte', () => {
    assert.ok(fixture.endsWith('.php.txt'));
    assert.equal(original.length, 8803);
    assert.equal(plain.split('\n').length - 1, 120);
    assert.equal(sha(original), originalHash);
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '<style>'), 1);
    assert.equal(count(plain, `        @media only screen and (max-width: 768px) {
           [class*="col-"] {
           width: 100%;
           text-align:left!Important;
            }
        }`), 1);
});

test('CMS-1500 sections, guidance, warning semantics and link metadata survive the exact inverse', () => {
    for (const id of ['select_option', 'add_notes']) {
        assert.equal(count(plain, `id="${id}"`), 1, id);
        assert.equal(count(candidate, `id="${id}"`), 1, id);
        assert.equal(count(plain, `href="#${id}"`), 1, id);
    }
    assert.equal(count(plain, 'class="oe-help-heading"'), 2);
    assert.equal(count(plain, 'id="show_hide"'), 2, 'duplicate inherited IDs are external-link icons');
    assert.equal(count(plain, 'class="fa fa-exclamation-triangle oe-text-red" aria-hidden="true"'), 1);
    assert.equal(count(plain, 'class="fa fa-exclamation-circle oe-text-orange" aria-hidden="true"'), 1);
    assert.equal(count(plain, 'class="fa fa-arrow-circle-up oe-pull-away oe-help-redirect"'), 2);
    assert.equal(count(plain, 'href="http://www.nucc.org" rel="noopener" target="_blank"'), 1);
    assert.equal(count(plain, 'href="https://www.cms.gov/Medicare/CMS-Forms/CMS-Forms/Downloads/CMS1500.pdf" rel="noopener" target="_blank"'), 1);
    for (const phrase of [
        'CMS 1500 was revised on 2012-02-01',
        'is set to expire on 2020-03-31',
        'As of April 1, 2014 only the revised, 02-12 version is accepted.',
        'You need administrator privileges to perform the setup',
        'It is not submitted with the claim',
        'The information provided in the New Encounter Form and Fee Sheet'
    ]) {
        assert.ok(plain.includes(phrase), phrase);
        assert.ok(candidate.includes(phrase), phrase);
    }
    assert.equal(count(plain, 'require_once("../../interface/globals.php");'), 1);
    assert.equal(count(plain, '<?php Header::setupHeader();?>'), 1);
    assert.doesNotMatch(plain, /SessionUtil::|setpid\(|setencounter\(|formFetch\(/);
    checkCandidate(candidate);
});

test('synthetic future candidate passes before the live RED assertion', () => {
    checkCandidate(candidate);
});

test('presentation and original-source mutations fail closed', async t => {
    const mutations = {
        missingStyle: s => replaceAnchor(s, style, ''),
        relocatedStyle: s => replaceAnchor(replaceAnchor(s, style + headEnd, headEnd), newBody, style + newBody),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        missingBodyMarker: s => replaceAnchor(s, newBody, oldBody),
        duplicateBodyMarker: s => replaceAnchor(s, newBody, newBody + newBody),
        relocatedBodyMarker: s => replaceAnchor(replaceAnchor(s, newBody, oldBody), '<html>', `<html class="${bodyClass}">`),
        extraBodyClass: s => replaceAnchor(s, newBody, `    <body class="${bodyClass} extra">`),
        printMedia: s => replaceAnchor(s, '@media screen {', '@media print {'),
        lostContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html', 5),
        popupOnlyContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html.oe-workbench-popup', 5),
        broadContainer: s => replaceAnchor(s, '> .oe-help-container', '.oe-help-container'),
        buttonPaint: s => replaceAnchor(s, 'a:not(.btn)', 'a'),
        broadBody: s => replaceAnchor(s, `body.${bodyClass}`, 'body', 5),
        missingCanvas: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: transparent;'),
        missingInk: s => replaceAnchor(s, 'color: var(--oe-wb-ink, #17343b);', 'color: inherit;', 4),
        missingPaper: s => replaceAnchor(s, 'background-color: var(--oe-wb-paper, #fff);', 'background-color: transparent;'),
        headingImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-paper, #fff) !important;', 'background-color: var(--oe-wb-paper, #fff);'),
        redirectImportant: s => replaceAnchor(s, 'color: var(--oe-wb-ink, #17343b) !important;', 'color: var(--oe-wb-ink, #17343b);'),
        extraImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'),
        extraFont: s => replaceAnchor(s, '    background-color: var(--oe-wb-canvas, #f3f7f5);', '    font-family: Arial;\n    background-color: var(--oe-wb-canvas, #f3f7f5);'),
        extraGeometry: s => replaceAnchor(s, '    background-color: var(--oe-wb-canvas, #f3f7f5);', '    padding: 1rem;\n    background-color: var(--oe-wb-canvas, #f3f7f5);'),
        extraControl: s => replaceAnchor(s, 'a:not(.btn)', 'a:not(.btn), button'),
        changedResponsive: s => replaceAnchor(s, 'text-align:left!Important;', 'text-align:left;'),
        changedSection: s => replaceAnchor(s, 'id="select_option"', 'id="other_option"'),
        changedNotes: s => replaceAnchor(s, 'id="add_notes"', 'id="other_notes"'),
        changedWarning: s => replaceAnchor(s, 'oe-text-red', 'oe-text-green'),
        changedNoteWarning: s => replaceAnchor(s, 'oe-text-orange', 'oe-text-green'),
        changedExpiry: s => replaceAnchor(s, '2020-03-31', '2030-03-31'),
        changedNucc: s => replaceAnchor(s, 'http://www.nucc.org', 'https://www.nucc.org'),
        changedPdf: s => replaceAnchor(s, 'CMS1500.pdf', 'CMS1500-new.pdf'),
        changedLinkMetadata: s => replaceAnchor(s, 'rel="noopener" target="_blank"', 'target="_blank"', 2),
        changedPhp: s => replaceAnchor(s, 'require_once("../../interface/globals.php");', 'require_once("../interface/globals.php");'),
        changedTranslation: s => replaceAnchor(s, 'xlt("Additional Notes")', 'xl("Additional Notes")', 2)
    };
    for (const [name, mutate] of Object.entries(mutations)) {
        await t.test(name, () => {
            const changed = mutate(candidate);
            assert.notEqual(changed, candidate, 'mutation must change the candidate');
            assert.throws(() => checkCandidate(changed), assert.AssertionError);
        });
    }
});

test('actual caller, OemrUI, shared assets and help-theme cascade are pinned', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/forms/misc_billing_options/new.php').toString();
    const ui = read('src/OeUI/OemrUI.php').toString();
    const header = read('src/Core/Header.php').toString();
    const assets = read('config/config.yaml').toString();
    const popupCss = read('interface/clinical-workspace/popup.css').toString();
    const commonTheme = read('interface/themes/oe-common/help-files-common.scss').toString();
    const colorTheme = read('interface/themes/colors/utilities/help-files.scss').toString();
    assert.match(caller, /isset\(\$_REQUEST\['isBilling'\]\)[\s\S]*?SessionUtil::setSession\('billpid'[\s\S]*?setpid\(\$pid\)[\s\S]*?SessionUtil::setSession\('billencounter'[\s\S]*?setencounter\(\$encounter\)/);
    assert.match(caller, /\$fetched = \$formid \? formFetch\("form_misc_billing_options", \$formid\) : \[\]/);
    assert.match(caller, /'show_help_icon' => true,\s*'help_file_name' => "cms_1500_help\.php"/);
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
    assert.match(commonTheme, /\.oe-help-container a:not\(\.btn\)[\s\S]*?color: \$gray/);
    assert.match(commonTheme, /\.oe-help-heading[\s\S]*?background-color: \$gray-200/);
    assert.match(colorTheme, /\.oe-help-redirect[\s\S]*?color: \$darker !important;[\s\S]*?\.oe-help-heading[\s\S]*?background-color: \$palepale !important;/);
});

test('caller session behavior is a pinned source boundary', () => {
    const file = 'interface/forms/misc_billing_options/new.php';
    const caller = read(file).toString();
    assert.equal(sha(Buffer.from(caller)), protectedHashes[file]);
    const changed = replaceAnchor(caller, "SessionUtil::setSession('billpid', $pid);", "SessionUtil::setSession('otherpid', $pid);");
    assert.notEqual(sha(Buffer.from(changed)), protectedHashes[file]);
});

test('source-derived OemrUI click loads the CMS-1500 help iframe once', () => {
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
            return '/Documentation/help_files/cms_1500_help.php';
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
    assert.equal(src, '/Documentation/help_files/cms_1500_help.php');
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

test('unchanged popup.js follows the ordinary modal iframe through content to shell', () => {
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

test('live route has the exact CMS-1500 presentation seam', () => {
    const live = read(route).toString('utf8');
    assert.notEqual(live, plain, 'missing presentation: route still equals original fixture');
    checkCandidate(live);
});

if (process.argv.includes('--require-history')) {
    test('optional authentic Git baseline and exact five-path changed scope', () => {
        const base = '18647270e0c799189d2dc10f801e8de2bff1a360';
        assert.deepEqual(original, execFileSync('git', ['show', `${base}:${route}`], { cwd: root }));
        const changed = execFileSync('git', ['diff', '--name-only', '-z', base], { cwd: root }).toString().split('\0').filter(Boolean);
        const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
        const allowed = new Set([
            route,
            fixture,
            'tests/js/contracts/cms-1500-help-popup.cjs',
            'tests/js/cms-1500-help-popup.test.js',
            'docs/clinical-ui/CMS-1500-HELP-POPUP.md'
        ]);
        for (const file of [...changed, ...untracked]) assert.ok(allowed.has(file), `out-of-scope changed file: ${file}`);
    });
}
