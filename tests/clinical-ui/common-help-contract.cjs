'use strict';

// Source-only contract. The .txt fixture cannot prove rendered translations,
// computed CSS, ACL outcomes, or live modal behavior. Never execute PHP here.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const base = '09b29da7771aea334ed5745e058751157af980d7';
const route = 'Documentation/help_files/common_help.php';
const fixture = 'tests/clinical-ui/fixtures/common-help-original.txt';
const read = file => readFileSync(path.join(root, file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = read(fixture);
const plain = original.toString('utf8');
const protectedHashes = {
    'interface/forms/newpatient/C_EncounterVisitForm.class.php': 'eb822527457f32d08bfdad4a1ae6bd2aef4cfcf4a0cd10cbc806bb00e30e3572',
    'interface/forms/newpatient/common.php': '32a30c981331d99730d1504aeb2cab810146b82593214fc87f3f6e751bdf57a1',
    'interface/forms/newpatient/templates/newpatient/common.html.twig': '91cd214b78857b79bca526924d78d7b97a212d80358fb8999b62728810fd017d',
    'interface/forms/newpatient/templates/newpatient/partials/common/_head.html.twig': 'b7504d9a7c5e5447c3c313040bf6a00a034c00dbc4054b76cd6cdf10533f59ad',
    'interface/forms/newpatient/templates/newpatient/partials/common/_head-before.html.twig': '300e30ac8f112e4240c63074ab33fb7f18d23dccd5cf822f5a318d8e8d584265',
    'interface/forms/newpatient/templates/newpatient/partials/common/_head-after.html.twig': '300e30ac8f112e4240c63074ab33fb7f18d23dccd5cf822f5a318d8e8d584265',
    'interface/forms/newpatient/templates/newpatient/partials/common/_body-end.html.twig': '300e30ac8f112e4240c63074ab33fb7f18d23dccd5cf822f5a318d8e8d584265',
    'interface/forms/newpatient/templates/newpatient/partials/common/fields/_hidden-fields.html.twig': 'f79cf3ae102f003285380fbaa459c99d21d56dd8c1fe8a811bb946adfb312b79',
    'interface/forms/newpatient/templates/newpatient/partials/common/fields/_sensitivities.html.twig': '0fd0fdcc565cc6f7a94e9c81bc9069fccd06cef410594e71c1763d422c9c3611',
    'interface/help_modal.php': '2c0e4134fc53a671a1a15a4c6579e33253550f1e7678a01422f823f31ae8b083',
    'src/OeUI/OemrUI.php': '478dd52733a2a50078d0610fc0e8e74bf8ad2c6c68d44abc612c8097eb99dc44',
    'src/Services/Globals/UserSettingsService.php': '187bfdd5228ec6ec7cc862bfdf709261262f6f62c2e660db0e83268fe9ec86ac',
    'src/Core/Header.php': 'dee3fd5f35bfd900ed119ae45981142ed737dac48059e54cacb4af843d6d264d',
    'config/config.yaml': '5f99c981f570a2f94917d68a4abcedf086eb75a102364bf71f1cb44ccfe461b7',
    'interface/clinical-workspace/popup.js': 'af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f',
    'interface/clinical-workspace/popup.css': 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9',
    'interface/themes/theme-defaults.scss': '0d01ace0600aada5fd2f82fc35bf76ef9083710f5cc5649e341a20cd97eaa773',
    'interface/themes/colors/utilities/help-files.scss': '7e56fa424f7fbc0971d1d9c3dbc6b6f00ce15e2a0d0b4e89aaab71befc927e19',
    'interface/themes/oe-common/help-files-common.scss': '351591fcc07fec98bae35aadc32ab4dafa13b8d54cbb36babcbf07ef3b2abe8a'
};
const bodyClass = 'oe-common-help-popup';
const scope = 'html.oe-workbench-context body.' + bodyClass;
const rules = [
    [scope, [['background-color', 'var(--oe-wb-canvas, #f3f7f5)'], ['color', 'var(--oe-wb-ink, #17343b)']]],
    [scope + ' > .oe-help-container', [['background-color', 'var(--oe-wb-paper, #fff)'], ['color', 'var(--oe-wb-ink, #17343b)']]],
    [scope + ' .oe-help-heading', [['background-color', 'var(--oe-wb-paper, #fff) !important'], ['color', 'var(--oe-wb-ink, #17343b)']]],
    [scope + ' .oe-help-container a:not(.btn)', [['background-color', 'transparent'], ['color', 'var(--oe-wb-ink, #17343b)']]],
    [scope + ' .oe-help-redirect', [['background-color', 'transparent'], ['color', 'var(--oe-wb-ink, #17343b) !important']]]
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
    assert.equal(count(source, '!important'), count(plain, '!important') + 2);
    assert.equal(source, candidate, 'entire source must be the exact two-addition candidate');
    assert.deepEqual(Buffer.from(source.replace(style, '').replace(newBody, oldBody)), original);
}

test('complete nonexecuting fixture freezes verified common encounter help', () => {
    assert.equal(original.length, 6582);
    assert.equal(sha(original), 'eff8299e155242f64bcc6cd7a170a976b275dc6c6e707359224b8959a151a92a');
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '<style>'), 1);
    assert.equal(count(plain, '@media only screen and (max-width: 768px)'), 1);
});

test('clinical instructions, semantic controls and link metadata remain byte frozen', () => {
    for (const id of ['visit_details', 'visit_reason', 'link_issue']) assert.equal(count(plain, 'id="' + id + '"'), 1);
    assert.equal(count(plain, "name='entire_doc'"), 1);
    assert.equal(count(plain, 'class="oe-help-heading"'), 3);
    assert.equal(count(plain, 'fa-exclamation-triangle oe-text-red'), 2);
    for (const phrase of [
        'require_once("../../interface/globals.php");', '<?php Header::setupHeader();?>',
        'xlt("Sensitivity - lets you limit the information in this encounter to those with appropriate privileges")',
        'Physicians and Administrators groups by default', 'Groups and Access Controls in Administration > ACL',
        'class="btn btn-primary btn-sm oe-no-float oe-inline" style="color:white !Important"',
        'class="btn btn-secondary btn-sm btn-save oe-inline oe-no-float"',
        'href="https://www.open-emr.org/wiki/index.php/Issues_%26_Immunizations" rel="noopener" target="_blank" class="oe-help-redirect"'
    ]) assert.ok(plain.includes(phrase), phrase);
    checkCandidate(candidate);
});

test('synthetic candidate satisfies exactly five paired screen rules and two utility overrides', () => {
    checkCandidate(candidate);
    assert.equal(rules.length, 5);
    assert.equal(rules.flatMap(([, declarations]) => declarations).length, 10);
    assert.equal(rules.flatMap(([, declarations]) => declarations).filter(([, value]) => value.endsWith('!important')).length, 2);
});

test('anchored negative mutations reject seams, scope, palette, typography, geometry and clinical content', () => {
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
        noContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html', rules.length),
        noRoute: s => replaceAnchor(s, 'body.' + bodyClass, 'body', rules.length),
        descendantPaper: s => replaceAnchor(s, '> .oe-help-container', '.oe-help-container'),
        buttonLinks: s => replaceAnchor(s, 'a:not(.btn)', 'a'),
        semanticStrong: s => replaceAnchor(s, '.oe-help-redirect {', '.oe-help-redirect, strong {'),
        semanticIcon: s => replaceAnchor(s, '.oe-help-heading {', '.oe-help-heading, .fa {'),
        geometry: s => replaceAnchor(s, '  ' + scope + ' {', '  ' + scope + ' {\n    padding: 1rem;'),
        typography: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'font-family: Arial;\n    background-color: var(--oe-wb-canvas, #f3f7f5);'),
        extraImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'),
        responsive: s => replaceAnchor(s, 'max-width: 768px', 'max-width: 769px'),
        php: s => replaceAnchor(s, 'require_once("../../interface/globals.php");', 'require_once("../../interface/other.php");'),
        header: s => replaceAnchor(s, '<?php Header::setupHeader();?>', '<?php Header::setupHeader(["common"]);?>'),
        translation: s => replaceAnchor(s, 'Creating and Managing Encounters', 'Encounter Guide', 2),
        warning: s => replaceAnchor(s, 'fa-exclamation-triangle oe-text-red', 'fa-exclamation-triangle text-primary', 2),
        aclGuidance: s => replaceAnchor(s, 'Physicians and Administrators groups by default', 'all users by default'),
        addIssue: s => replaceAnchor(s, 'style="color:white !Important"', 'style="color:inherit"'),
        save: s => replaceAnchor(s, 'btn-save oe-inline', 'btn-save changed'),
        linkMetadata: s => replaceAnchor(s, 'rel="noopener" target="_blank"', 'rel="nofollow" target="_blank"'),
        addedScript: s => replaceAnchor(s, headEnd, '<script>alert(1)</script>\n' + headEnd)
    };
    for (let index = 0; index < rules.length; index++) {
        const [selector, declarations] = rules[index];
        const fullRule = '  ' + selector + ' {\n' + declarations.map(([p, v]) => '    ' + p + ': ' + v + ';').join('\n') + '\n  }';
        mutations['selector' + index] = s => replaceAnchor(s, fullRule, fullRule.replace(selector, selector + ' .changed'));
        for (let declaration = 0; declaration < declarations.length; declaration++) {
            const [property, value] = declarations[declaration];
            mutations['declaration' + index + '_' + declaration] = s => replaceAnchor(s, fullRule,
                fullRule.replace('    ' + property + ': ' + value + ';', '    ' + property + ': changed;'));
            if (value.endsWith('!important')) mutations['important' + index + '_' + declaration] = s =>
                replaceAnchor(s, fullRule, fullRule.replace(value, value.replace(' !important', '')));
        }
    }
    for (const [name, mutate] of Object.entries(mutations)) {
        const mutant = mutate(candidate); // Build outside assert.throws so missing anchors fail directly.
        assert.notEqual(mutant, candidate, name);
        assert.throws(() => checkCandidate(mutant), assert.AssertionError, name);
    }
});

test('actual encounter caller, Twig chain, modal, controller and palette sources stay pinned', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/forms/newpatient/C_EncounterVisitForm.class.php').toString();
    const entry = read('interface/forms/newpatient/common.php').toString();
    const twig = read('interface/forms/newpatient/templates/newpatient/common.html.twig').toString();
    const head = read('interface/forms/newpatient/templates/newpatient/partials/common/_head.html.twig').toString();
    const ui = read('src/OeUI/OemrUI.php').toString();
    const settings = read('src/Services/Globals/UserSettingsService.php').toString();
    const header = read('src/Core/Header.php').toString();
    const config = read('config/config.yaml').toString();
    const css = read('interface/clinical-workspace/popup.css').toString();
    const theme = read('interface/themes/theme-defaults.scss').toString();
    const colors = read('interface/themes/colors/utilities/help-files.scss').toString();
    assert.match(entry, /PatientSessionUtil::getPid\(\)/);
    assert.match(entry, /\$controller->render\(\$pid\)/);
    assert.match(caller, /'include_patient_name' => true,[\s\S]*?'show_help_icon' => true,\s*'help_file_name' => "common_help\.php"/);
    assert.match(caller, /CsrfUtils::collectCsrfToken\(session: \$session\)/);
    assert.match(caller, /AclMain::aclCheckCore\('sensitivities', \$sensitivity\)/);
    assert.match(caller, /AclMain::aclCheckCore\('patients', 'med', '', 'write'\)/);
    assert.match(caller, /AclMain::aclCheckIssue\(\$type, '', 'write'\)/);
    assert.match(caller, /sqlStatement\(/);
    assert.match(caller, /TemplatePageEvent::RENDER_EVENT/);
    assert.match(caller, /\$this->twig->render\(\$event->getTwigTemplate\(\), \$event->getTwigVariables\(\)\)/);
    assert.match(twig, /include "newpatient\/partials\/common\/_head\.html\.twig"/);
    assert.match(twig, /oemrUiPageHeading\(oemrUiSettings\)/);
    assert.match(twig, /oemrUiBelowContainerDiv\(oemrUiSettings\)/);
    assert.match(head, /setupHeader\(\[/);
    assert.match(ui, /<iframe src='' data-src='\$help_file' id='targetiframe'/);
    assert.match(ui, /<div class="modal fade" id="myModal"/);
    assert.doesNotMatch(ui, /class="[^"]*\bdialogModal\b/);
    assert.match(ui, /\$this->display_help_icon \? \$this->helpFileModal\(\)/);
    assert.match(settings, /self::setUserSetting\(\$setting_key, \$initval\)/);
    assert.match(header, /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(config, /workbench-popup:[\s\S]*?script: popup\.js[\s\S]*?link: popup\.css[\s\S]*?autoload: true/);
    for (const [token, value] of [['ink', '#17343b'], ['paper', '#fff'], ['canvas', '#f3f7f5']])
        assert.ok(css.includes('--oe-wb-' + token + ': ' + value + ';'), token);
    assert.match(theme, /legend \{\s*background-color: \$gray-300 !important;\s*color: \$body-color !important;/);
    assert.match(colors, /\.oe-help-redirect[\s\S]*?color: \$darker !important;[\s\S]*?\.oe-help-heading[\s\S]*?background-color: \$palepale !important;/);
});

test('source-derived OemrUI click lazily loads its ordinary modal iframe once', () => {
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
        data(name) { assert.equal(name, 'src'); return '/Documentation/help_files/common_help.php'; }
    };
    const $ = target => target === document ? { on(event, selector, callback) {
        assert.equal(event, 'click'); assert.equal(selector, '#help-href'); listener = callback;
    } } : (assert.equal(target, '#targetiframe'), iframe);
    vm.runInNewContext(ui.slice(begin, finish + end.length), { document, $ }, { filename: 'OemrUI-help-click.js' });
    listener(); listener();
    assert.equal(src, '/Documentation/help_files/common_help.php');
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
test('actual popup controller gives ordinary nested help context only and cleans up', () => {
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
});

test('standalone, legacy and foreign-origin help receive no workbench context', () => {
    const standalone = popupWindow(); activate(standalone.win);
    assert.deepEqual(standalone.html.classList.values(), []);
    const legacy = popupWindow({ shell: true });
    const legacyHelp = popupWindow({ parent: legacy.win, frameId: 'targetiframe' }); activate(legacyHelp.win);
    assert.deepEqual(legacyHelp.html.classList.values(), []);
    const foreign = popupWindow({ active: true, origin: 'https://foreign.test' });
    const foreignHelp = popupWindow({ parent: foreign.win, frameId: 'targetiframe' }); activate(foreignHelp.win);
    assert.deepEqual(foreignHelp.html.classList.values(), []);
});

test('live common encounter help has exact two-addition palette seam', () => {
    const live = read(route).toString('utf8');
    assert.notEqual(live, plain, 'expected RED until controller authorizes production phase');
    checkCandidate(live);
});

if (process.argv.includes('--history')) {
    test('local history authenticates base and exact five-path committed plus dirty scope', () => {
        const git = args => execFileSync('git', args, { cwd: root });
        assert.equal(git(['branch', '--show-current']).toString().trim(), 'OPEMR-104-common-help');
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
        const allowed = new Set([route, fixture, 'tests/clinical-ui/common-help-contract.cjs',
            'tests/js/common-help.test.js', 'docs/clinical-ui/COMMON-HELP-POPUP.md']);
        for (const file of all) assert.ok(allowed.has(file), 'out-of-scope change: ' + file);
    });
}
