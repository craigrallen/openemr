'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const route = 'Documentation/help_files/fee_sheet_help.php';
const fixture = 'tests/js/fixtures/fee-sheet-help-popup-original.php.txt';
const originalHash = '645bcb0922a1f9d389099e6bd17c1440cae4250e82c999a986ab4a1bd8b23910';
const protectedHashes = {
    'interface/forms/fee_sheet/new.php': 'f419fe70b745742a863f64627c433fd1dbead7e912c34162dc9be042a7183260',
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
const bodyClass = 'fee-sheet-help-workbench-route';
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
    return source.replace(anchor, replacement);
}

const candidate = replaceAnchor(
    replaceAnchor(plain, headEnd, style + headEnd), oldBody, newBody
);

function checkCandidate(source) {
    assert.equal(count(source, '<style>'), 2, 'original responsive style plus one new style');
    assert.equal(count(source, '</style>'), 2, 'both style blocks close');
    assert.equal(count(source, style), 1, 'exact five screen-only scoped paint rules');
    assert.equal(count(source, '!important'), 2, 'only heading background and redirect ink are important');
    assert.equal(count(source, bodyClass), 6, 'five selectors and the body marker');
    assert.equal(count(source, newBody), 1, 'one exact route body marker');
    assert.equal(count(source, headEnd), 1, 'one existing head close');
    assert.equal(source, candidate, 'only the exact presentation additions may differ');
    const recovered = source.replace(style, '').replace(newBody, oldBody);
    assert.deepEqual(Buffer.from(recovered), original, 'inverse restores every original route byte');
}

test('complete nonexecuting fixture pins all original Fee Sheet help bytes', () => {
    assert.ok(fixture.endsWith('.php.txt'));
    assert.equal(original.length, 21763);
    assert.equal(plain.split('\n').length - 1, 255);
    assert.equal(sha(original), originalHash);
    assert.equal(count(plain, '<style>'), 1);
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, `        @media only screen and (max-width: 768px) {
           [class*="col-"] {
           width: 100%;
           text-align:left!Important;
            }
        }`), 1, 'legacy responsive CSS remains byte exact');
    for (const id of ['price_level', 'select_code', 'search_additional', 'selected_codes', 'select_providers', 'setup', 'customize']) {
        assert.equal(count(plain, `id="${id}"`), 1, id);
    }
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
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        misplacedStyle: s => replaceAnchor(replaceAnchor(s, style + headEnd, headEnd), newBody, style + newBody),
        changedPhp: s => replaceAnchor(s, 'require_once("../../interface/globals.php");', 'require_once("../interface/globals.php");'),
        changedTitle: s => replaceAnchor(s, 'xlt("Using the Feesheet")', 'xlt("Fee Sheet Help")', 2),
        changedSection: s => replaceAnchor(s, 'id="selected_codes"', 'id="selected_code"'),
        changedWarning: s => replaceAnchor(s, 'fa fa-exclamation-triangle oe-text-red', 'fa fa-exclamation-triangle oe-text-green', count(plain, 'fa fa-exclamation-triangle oe-text-red')),
        changedControl: s => replaceAnchor(s, 'btn-refresh oe-no-float', 'btn-delete oe-no-float'),
        changedDownloadHref: s => replaceAnchor(s, 'href="../../interface/forms/fee_sheet/fee_sheet_customization.ods"', 'href="../../interface/forms/fee_sheet/other.ods"'),
        changedDownloadName: s => replaceAnchor(s, 'download="Fee Sheet Customization"', 'download=""'),
        changedExternalMetadata: s => replaceAnchor(s, 'href="https://www.open-emr.org/wiki/index.php/Code_Types" rel="noopener" target="_blank"', 'href="https://www.open-emr.org/wiki/index.php/Code_Types" target="_blank"'),
        changedResponsiveStyle: s => replaceAnchor(s, 'text-align:left!Important;', 'text-align:left!important;'),
        changedText: s => replaceAnchor(s, 'Use the fee sheet to charge for services or products. ', 'Use the fee sheet to charge for services. ')
    };
    assert.ok(count(plain, 'fa fa-exclamation-triangle oe-text-red') > 1);
    for (const [name, mutate] of Object.entries(mutations)) {
        await t.test(name, () => {
            const changed = mutate(candidate);
            assert.notEqual(changed, candidate, 'mutation must change the candidate');
            assert.throws(() => checkCandidate(changed), assert.AssertionError);
        });
    }
});

test('actual caller, OemrUI modal, assets, popup controller and theme sources are pinned', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/forms/fee_sheet/new.php').toString();
    const ui = read('src/OeUI/OemrUI.php').toString();
    const header = read('src/Core/Header.php').toString();
    const assets = read('config/config.yaml').toString();
    const popupCss = read('interface/clinical-workspace/popup.css').toString();
    const theme = read('interface/themes/colors/utilities/help-files.scss').toString();
    assert.match(caller, /'show_help_icon' => true,\s*'help_file_name' => "fee_sheet_help\.php"/);
    assert.match(caller, /\$oemr_ui = new OemrUI\(\$arrOeUiSettings\)/);
    assert.match(caller, /\$oemr_ui->pageHeading\(\)/);
    assert.match(caller, /\$oemr_ui->oeBelowContainerDiv\(\)/);
    assert.match(ui, /get\('enable_help'\) !== 0 && \$this->display_help_icon/);
    assert.match(ui, /get\('enable_help'\) == "1"[\s\S]*?get\('enable_help'\) == "2"/);
    assert.match(ui, /\$this->display_help_icon \? \$this->helpFileModal\(\) : ''/);
    assert.match(ui, /<iframe src='' data-src='\$help_file' id='targetiframe'/);
    assert.match(ui, /<div class="modal fade" id="myModal"/);
    assert.doesNotMatch(ui, /class="[^"]*\bdialogModal\b/);
    assert.match(ui, /\$\(document\)\.on\('click', '#help-href', function \(\) \{[\s\S]*?if \(!iframe\.attr\('src'\) && iframe\.data\('src'\)\) \{[\s\S]*?iframe\.attr\('src', iframe\.data\('src'\)\)/);
    assert.match(header, /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(assets, /workbench-popup:[\s\S]*?script: popup\.js[\s\S]*?link: popup\.css[\s\S]*?autoload: true/);
    for (const [token, value] of [['ink', '#17343b'], ['paper', '#fff'], ['canvas', '#f3f7f5']]) {
        assert.ok(popupCss.includes(`--oe-wb-${token}: ${value};`));
    }
    assert.match(theme, /\.oe-help-redirect[\s\S]*?color: \$darker !important;[\s\S]*?\.oe-help-heading[\s\S]*?background-color: \$palepale !important;/);
});

test('source-derived OemrUI delegated click loads the help iframe only once', () => {
    const ui = read('src/OeUI/OemrUI.php').toString();
    const start = "$(document).on('click', '#help-href', function () {";
    const end = "            });";
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
            return '/Documentation/help_files/fee_sheet_help.php';
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
    assert.equal(src, '/Documentation/help_files/fee_sheet_help.php');
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

test('actual popup.js follows ordinary help frame through content frame to shell', () => {
    const shell = popupWindow({ active: true, shell: true });
    const content = popupWindow({ parent: shell.win, frame: true });
    const help = popupWindow({ parent: content.win, frame: true });
    assert.equal(content.win.frameElement.closest('.dialogModal'), null);
    assert.equal(help.win.frameElement.closest('.dialogModal'), null);
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

test('actual popup.js leaves standalone, legacy and cross-origin help inert', () => {
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

test('live route has the exact Fee Sheet presentation seam', () => {
    const live = read(route).toString('utf8');
    assert.notEqual(live, plain, 'missing presentation: route still equals original fixture');
    checkCandidate(live);
});

if (process.argv.includes('--require-history')) {
    test('optional authentic baseline and exact changed-file scope', () => {
        const base = '18647270e0c799189d2dc10f801e8de2bff1a360';
        assert.deepEqual(original, execFileSync('git', ['show', `${base}:${route}`], { cwd: root }));
        const changed = execFileSync('git', ['diff', '--name-only', '-z', base], { cwd: root }).toString().split('\0').filter(Boolean);
        const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
        const allowed = new Set([
            route, fixture,
            'tests/js/contracts/fee-sheet-help-popup.cjs',
            'tests/js/fee-sheet-help-popup.test.js',
            'docs/clinical-ui/FEE-SHEET-HELP-POPUP.md'
        ]);
        for (const file of [...changed, ...untracked]) assert.ok(allowed.has(file), `out-of-scope changed file: ${file}`);
    });
}
