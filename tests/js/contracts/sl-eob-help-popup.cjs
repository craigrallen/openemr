'use strict';

// Source contracts only: PHP and financial flows are never evaluated.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const base = '18647270e0c799189d2dc10f801e8de2bff1a360';
const route = 'Documentation/help_files/sl_eob_help.php';
const fixture = 'tests/js/fixtures/sl-eob-help-popup-original.php.txt';
const read = file => readFileSync(path.join(root, file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = read(fixture);
const plain = original.toString('utf8');
const protectedHashes = {
    'interface/billing/sl_eob_search.php': '3e520de0689f34bed847cb8015ea0b9ac7db4872c08ceab1ffd40b3638dbe273',
    'interface/help_modal.php': '2c0e4134fc53a671a1a15a4c6579e33253550f1e7678a01422f823f31ae8b083',
    'src/OeUI/OemrUI.php': '478dd52733a2a50078d0610fc0e8e74bf8ad2c6c68d44abc612c8097eb99dc44',
    'src/Core/Header.php': 'dee3fd5f35bfd900ed119ae45981142ed737dac48059e54cacb4af843d6d264d',
    'src/Services/Globals/UserSettingsService.php': '187bfdd5228ec6ec7cc862bfdf709261262f6f62c2e660db0e83268fe9ec86ac',
    'library/user.inc.php': 'f26edda7d1388aad64e9d1924fa679a21358c0ca46df899063a8f3c4f4037443',
    'config/config.yaml': '5f99c981f570a2f94917d68a4abcedf086eb75a102364bf71f1cb44ccfe461b7',
    'interface/clinical-workspace/popup.js': 'af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f',
    'interface/clinical-workspace/popup.css': 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9',
    'interface/themes/theme-defaults.scss': '0d01ace0600aada5fd2f82fc35bf76ef9083710f5cc5649e341a20cd97eaa773',
    'interface/themes/colors/utilities/help-files.scss': '7e56fa424f7fbc0971d1d9c3dbc6b6f00ce15e2a0d0b4e89aaab71befc927e19',
    'interface/themes/oe-common/help-files-common.scss': '351591fcc07fec98bae35aadc32ab4dafa13b8d54cbb36babcbf07ef3b2abe8a'
};
const bodyClass = 'oe-sl-eob-help-popup';
const scope = 'html.oe-workbench-context body.' + bodyClass;
const rules = [
    [scope, [['background-color', 'var(--oe-wb-canvas, #f3f7f5)'], ['color', 'var(--oe-wb-ink, #17343b)']]],
    [scope + ' > .oe-help-container', [['background-color', 'var(--oe-wb-paper, #fff)'], ['color', 'var(--oe-wb-ink, #17343b)']]],
    [scope + ' .oe-help-heading', [['background-color', 'var(--oe-wb-paper, #fff) !important'], ['color', 'var(--oe-wb-ink, #17343b)']]],
    [scope + ' .oe-help-container a:not(.btn)', [['background-color', 'transparent'], ['color', 'var(--oe-wb-ink, #17343b)']]],
    [scope + ' .oe-help-redirect', [['background-color', 'transparent'], ['color', 'var(--oe-wb-ink, #17343b) !important']]],
    [scope + ' .oe-help-container fieldset', [['background-color', 'var(--oe-wb-paper, #fff) !important'], ['color', 'var(--oe-wb-ink, #17343b) !important']]],
    [scope + ' .oe-help-container legend', [['background-color', 'var(--oe-wb-paper, #fff) !important'], ['color', 'var(--oe-wb-ink, #17343b) !important']]]
];
const style = '    <style>\n@media screen {\n' + rules.map(([selector, declarations]) =>
    '  ' + selector + ' {\n' + declarations.map(([property, value]) => '    ' + property + ': ' + value + ';').join('\n') + '\n  }'
).join('\n\n') + '\n}\n    </style>\n';
const headEnd = '    </head>';
const oldBody = '    <body>';
const newBody = '    <body class="' + bodyClass + '">';
const count = (source, needle) => source.split(needle).length - 1;
function replaceAnchor(source, anchor, replacement, occurrences = 1) {
    assert.equal(count(source, anchor), occurrences, 'unique mutation anchor: ' + anchor);
    assert.notEqual(anchor, replacement);
    const changed = source.split(anchor).join(replacement);
    assert.notEqual(changed, source);
    return changed;
}
const candidate = replaceAnchor(replaceAnchor(plain, headEnd, style + headEnd), oldBody, newBody);
function checkCandidate(source) {
    assert.equal(count(source, style), 1);
    assert.equal(count(source, '<style>'), 2);
    assert.equal(count(source, '</style>'), 2);
    assert.equal(count(source, '@media screen {'), 1);
    assert.equal(count(source, scope), rules.length);
    assert.equal(count(source, newBody), 1);
    assert.equal(count(source, '!important'), count(plain, '!important') + 6);
    assert.equal(source, candidate, 'entire source must be the exact two-addition candidate');
    assert.deepEqual(Buffer.from(source.replace(style, '').replace(newBody, oldBody)), original);
}

test('complete nonexecuting fixture freezes original SL EOB help', () => {
    assert.equal(original.length, 12515);
    assert.equal(sha(original), 'e9cfa71d44a6cc5bb1d6e1dc16cb45d35fd4986b5202efbfcc567db31c5b093e');
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '<style>'), 1);
    assert.equal(count(plain, '@media only screen and (max-width: 768px)'), 1);
});

test('historical financial instructions, illustrations and URL remain byte frozen', () => {
    for (const id of ['home-div', 'invoice-search-div', 'era-upload-div']) assert.equal(count(plain, 'id="' + id + '"'), 1);
    assert.equal(count(plain, 'class="oe-help-heading"'), 2);
    assert.equal(count(plain, 'onclick=""'), 6);
    assert.equal(count(plain, 'id="invoice_search_help"'), 3);
    assert.equal(count(plain, 'id="era_upload_help"'), 2);
    for (const color of ['blue', 'black', 'green', 'red']) assert.equal(count(plain, 'style="color:' + color + '"'), 1);
    for (const phrase of [
        'xlt("EOB Posting - Instructions")', 'xlt("EOB Data Entry")',
        "name = 'electonic_remits'", '$_SERVER[\'HTTP_HOST\']',
        '$session->get(\'site_id\')', '/documents/era/',
        'Process ERA File', 'After the information is correctly entered, click the Save button.',
        'require_once("../../interface/globals.php");', '<?php Header::setupHeader();?>'
    ]) assert.ok(plain.includes(phrase), phrase);
    checkCandidate(candidate);
});

test('synthetic future SL EOB candidate satisfies seven exact paired screen rules', () => {
    checkCandidate(candidate);
    assert.equal(rules.length, 7);
    assert.equal(rules.flatMap(([, declarations]) => declarations).filter(([, value]) => value.endsWith('!important')).length, 6);
});

test('anchored negative mutations reject every seam, selector, declaration and important exception', () => {
    const mutations = {
        missingStyle: s => replaceAnchor(s, style, ''),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        relocatedStyle: s => replaceAnchor(replaceAnchor(s, style + headEnd, headEnd), newBody, style + newBody),
        missingBody: s => replaceAnchor(s, newBody, oldBody),
        duplicateBody: s => replaceAnchor(s, newBody, newBody + newBody),
        broadBody: s => replaceAnchor(s, newBody, '    <body class="' + bodyClass + ' other">'),
        print: s => replaceAnchor(s, '@media screen {', '@media print {'),
        allMedia: s => replaceAnchor(s, '@media screen {', '@media all {'),
        popupClass: s => replaceAnchor(s, 'html.oe-workbench-context', 'html.oe-workbench-popup', rules.length),
        unscopedContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html', rules.length),
        unscopedRoute: s => replaceAnchor(s, 'body.' + bodyClass, 'body', rules.length),
        descendantPaper: s => replaceAnchor(s, '> .oe-help-container', '.oe-help-container'),
        buttonLinks: s => replaceAnchor(s, 'a:not(.btn)', 'a'),
        semanticStrong: s => replaceAnchor(s, '.oe-help-redirect {', '.oe-help-redirect, strong {'),
        geometry: s => replaceAnchor(s, '  ' + scope + ' {', '  ' + scope + ' {\n    padding: 1rem;'),
        typography: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'font-family: Arial;\n    background-color: var(--oe-wb-canvas, #f3f7f5);'),
        extraImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'),
        responsive: s => replaceAnchor(s, 'max-width: 768px', 'max-width: 769px'),
        translation: s => replaceAnchor(s, 'EOB Data Entry', 'EOB Entry'),
        radio: s => replaceAnchor(s, 'onclick=""', 'onclick="post()"', 6),
        semanticColor: s => replaceAnchor(s, 'style="color:red"', 'style="color:blue"'),
        duplicateIdRepair: s => replaceAnchor(s, 'id="invoice_search_help"', 'id="invoice_search_help_repaired"', 3),
        inheritedUrl: s => replaceAnchor(s, '$_SERVER[\'HTTP_HOST\']', 'htmlspecialchars($_SERVER[\'HTTP_HOST\'])'),
        addedScript: s => replaceAnchor(s, headEnd, '<script>alert(1)</script>\n' + headEnd)
    };
    for (let index = 0; index < rules.length; index++) {
        const [selector, declarations] = rules[index];
        mutations['selector' + index] = s => replaceAnchor(s, '  ' + selector + ' {', '  ' + selector + ' .changed {');
        for (let declaration = 0; declaration < declarations.length; declaration++) {
            const [property, value] = declarations[declaration];
            const fullRule = '  ' + selector + ' {\n' + declarations.map(([p, v]) => '    ' + p + ': ' + v + ';').join('\n') + '\n  }';
            mutations['declaration' + index + '_' + declaration] = s =>
                replaceAnchor(s, fullRule, fullRule.replace('    ' + property + ': ' + value + ';',
                    '    ' + property + ': changed;'));
            if (value.endsWith('!important')) {
                mutations['important' + index + '_' + declaration] = s =>
                    replaceAnchor(s, fullRule, fullRule.replace(value, value.replace(' !important', '')));
            }
        }
    }
    for (const [name, mutate] of Object.entries(mutations)) {
        const mutant = mutate(candidate);
        assert.notEqual(mutant, candidate, name);
        assert.throws(() => checkCandidate(mutant), assert.AssertionError, name);
    }
});

test('actual caller, eligibility, side effects and shared palette sources remain pinned', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/billing/sl_eob_search.php').toString();
    const ui = read('src/OeUI/OemrUI.php').toString();
    const settings = read('src/Services/Globals/UserSettingsService.php').toString();
    const header = read('src/Core/Header.php').toString();
    const config = read('config/config.yaml').toString();
    const css = read('interface/clinical-workspace/popup.css').toString();
    const theme = read('interface/themes/theme-defaults.scss').toString();
    const colors = read('interface/themes/colors/utilities/help-files.scss').toString();
    assert.match(caller, /aclCheckCore\('acct', 'eob', '', 'write'\)/);
    assert.match(caller, /prevSetting\('sl_eob_search\.', 'posting_adj_disable'/);
    assert.match(caller, /'expandable_files' => \['sl_eob_search_xpd'\]/);
    assert.match(caller, /'show_help_icon' => true,\s*'help_file_name' => "sl_eob_help\.php"/);
    assert.match(caller, /\$oemr_ui->oeBelowContainerDiv\(\)/);
    assert.match(caller, /CsrfUtils::verifyCsrfToken/);
    assert.match(caller, /ParseERA::parseERA/);
    assert.match(caller, /rename\(\$tmp_name, \$erafullname\)/);
    assert.match(caller, /notify_portal\(/);
    assert.match(settings, /self::setUserSetting\(\$setting_key, \$initval\)/);
    assert.match(settings, /self::setUserSetting\(\$filename, \$current_state\)/);
    assert.match(ui, /get\('enable_help'\) !== 0 && \$this->display_help_icon/);
    assert.match(ui, /get\('enable_help'\) == "1"[\s\S]*?get\('enable_help'\) == "2"/);
    assert.match(ui, /<iframe src='' data-src='\$help_file' id='targetiframe'/);
    assert.match(ui, /<div class="modal fade" id="myModal"/);
    assert.doesNotMatch(ui, /class="[^"]*\bdialogModal\b/);
    assert.match(header, /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(config, /workbench-popup:[\s\S]*?script: popup\.js[\s\S]*?link: popup\.css[\s\S]*?autoload: true/);
    for (const [token, value] of [['ink', '#17343b'], ['paper', '#fff'], ['canvas', '#f3f7f5']]) {
        assert.ok(css.includes('--oe-wb-' + token + ': ' + value + ';'), token);
    }
    assert.match(theme, /legend \{\s*background-color: \$gray-300 !important;\s*color: \$body-color !important;/);
    assert.match(theme, /fieldset \{\s*background-color: \$light !important;\s*color: \$body-color !important;/);
    assert.match(colors, /\.oe-help-redirect[\s\S]*?color: \$darker !important;[\s\S]*?\.oe-help-heading[\s\S]*?background-color: \$palepale !important;/);
});

test('source-derived OemrUI help click loads targetiframe once', () => {
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
        data(name) { assert.equal(name, 'src'); return '/Documentation/help_files/sl_eob_help.php'; }
    };
    const $ = target => target === document ? { on(event, selector, callback) {
        assert.equal(event, 'click'); assert.equal(selector, '#help-href'); listener = callback;
    } } : (assert.equal(target, '#targetiframe'), iframe);
    vm.runInNewContext(ui.slice(begin, finish + end.length), { document, $ }, { filename: 'OemrUI-help-click.js' });
    listener(); listener();
    assert.equal(src, '/Documentation/help_files/sl_eob_help.php');
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
function activate(win, source = read('interface/clinical-workspace/popup.js').toString()) {
    vm.runInNewContext(source, { window: win, Set }, { filename: 'popup.js' });
    return win.OpenEMRWorkbenchPopup;
}
test('real controller gives ordinary nested help context only, then cleans up', () => {
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
    const broken = replaceAnchor(read('interface/clinical-workspace/popup.js').toString(),
        'let current = parentWindow && parentWindow !== self ? parentWindow : null;', 'let current = null;');
    const otherShell = popupWindow({ active: true, shell: true });
    const otherContent = popupWindow({ parent: otherShell.win, frameId: 'contentframe' });
    const otherHelp = popupWindow({ parent: otherContent.win, frameId: 'targetiframe' });
    activate(otherHelp.win, broken);
    assert.deepEqual(otherHelp.html.classList.values(), []);
});
test('standalone, legacy and foreign origin help receive no context', () => {
    const standalone = popupWindow(); activate(standalone.win);
    assert.deepEqual(standalone.html.classList.values(), []);
    const legacy = popupWindow({ shell: true });
    const legacyHelp = popupWindow({ parent: legacy.win, frameId: 'targetiframe' }); activate(legacyHelp.win);
    assert.deepEqual(legacyHelp.html.classList.values(), []);
    const foreign = popupWindow({ active: true, origin: 'https://foreign.test' });
    const foreignHelp = popupWindow({ parent: foreign.win, frameId: 'targetiframe' }); activate(foreignHelp.win);
    assert.deepEqual(foreignHelp.html.classList.values(), []);
});
test('live SL EOB help has exact two-addition palette seam', () => {
    const live = read(route).toString('utf8');
    assert.notEqual(live, plain, 'RED: production still equals frozen original');
    checkCandidate(live);
});

if (process.argv.includes('--history')) {
    test('local history authenticates verified base and exact five-path change scope', () => {
        const git = args => execFileSync('git', args, { cwd: root });
        assert.equal(git(['branch', '--show-current']).toString().trim(), 'OPEMR-97-sl-eob-help');
        assert.equal(git(['rev-parse', base]).toString().trim(), base);
        assert.deepEqual(original, git(['show', base + ':' + route]));
        for (const file of Object.keys(protectedHashes)) assert.deepEqual(read(file), git(['show', base + ':' + file]), file);
        const names = args => git(args).toString().split('\0').filter(Boolean);
        const all = new Set([
            ...names(['diff', '--no-renames', '--name-only', '-z', base, 'HEAD']),
            ...names(['diff', '--no-renames', '--name-only', '-z', 'HEAD']),
            ...names(['diff', '--no-renames', '--cached', '--name-only', '-z']),
            ...names(['ls-files', '--others', '--exclude-standard', '-z'])
        ]);
        const allowed = new Set([route, fixture, 'tests/js/contracts/sl-eob-help-popup.cjs',
            'tests/js/sl-eob-help-popup.test.js', 'docs/clinical-ui/SL-EOB-HELP-POPUP.md']);
        for (const file of all) assert.ok(allowed.has(file), 'out-of-scope change: ' + file);
    });
}
