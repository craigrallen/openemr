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
const route = 'Documentation/help_files/medical_dashboard_help.php';
const fixture = 'tests/js/fixtures/medical-dashboard-help-popup-original.php.txt';
const read = file => readFileSync(path.join(root, file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = read(fixture);
const plain = original.toString('utf8');
const protectedHashes = {
    'interface/patient_file/summary/demographics.php': '00554d54565a92ee3b71a79053ac4f3daf55def3501d3dce6cf284d4615cbd3a',
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
const bodyClass = 'oe-medical-dashboard-help-popup';
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
    assert.equal(count(source, anchor), occurrences, `exact mutation anchor count: ${anchor}`);
    assert.notEqual(anchor, replacement);
    const changed = source.split(anchor).join(replacement);
    assert.notEqual(Buffer.compare(Buffer.from(changed), Buffer.from(source)), 0, 'mutation must change bytes');
    return changed;
}

const candidate = replaceAnchor(replaceAnchor(plain, headEnd, style + headEnd), oldBody, newBody);

function checkCandidate(source) {
    assert.equal(count(source, style), 1, 'one exact screen-only context style beside Header');
    assert.equal(count(source, '<style>'), 1);
    assert.equal(count(source, '</style>'), 1);
    assert.equal(count(source, '!important'), 2, 'only heading background and redirect foreground');
    assert.equal(count(source, scope), 5);
    assert.equal(count(source, bodyClass), 6);
    assert.equal(count(source, newBody), 1);
    assert.equal(source, candidate, 'only the two exact additions are allowed');
    assert.deepEqual(Buffer.from(source.replace(style, '').replace(newBody, oldBody)), original,
        'complete inverse restores every original source byte');
}

test('complete nonexecuting fixture pins every original Medical Dashboard help byte', () => {
    assert.ok(fixture.endsWith('.php.txt'));
    assert.equal(original.length, 19205);
    assert.equal(sha(original), '3ba556b532ed228eb0c6f355a0487de692c0cb1bfb385e4e74a556fe6c9772ff');
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '<style>'), 0);
});

test('all sections, controls, links and historical instructions remain byte preserved', () => {
    for (const id of ['section1', 'section2', 'section3']) assert.equal(count(plain, `id="${id}"`), 1, id);
    for (const heading of ['Header', 'Nav Bar', 'Data Section']) assert.equal(count(plain, `<h4 class="oe-help-heading"><?php echo xlt("${heading}"); ?>`), 1, heading);
    assert.equal(count(plain, '<button type="button"'), 8);
    assert.equal(count(plain, 'rel="noopener" target="_blank"'), 8);
    assert.equal(count(plain, 'data-original-title="" title=""'), 8);
    for (const phrase of ['Create Online Portal Credentials', 'Reset Offsite Portal Credentials', 'date of death',
        'Continuity of Care Record (CCR)', 'Continuity of Care Document (CCD)', 'Clinical Decision Rule',
        'If eRx is enabled the allergy list', 'If eRx is enabled the medication list',
        'past medical history, family history, personal history']) assert.ok(plain.includes(phrase), phrase);
    assert.equal(count(plain, "$('#show_hide').click(function() {"), 1);
    assert.equal(count(plain, "$('.hideaway').toggle('1000');"), 1);
    assert.equal(count(plain, 'require_once("../../interface/globals.php");'), 1);
    assert.equal(count(plain, '<?php Header::setupHeader();?>'), 1);
    checkCandidate(candidate);
});

test('synthetic future Medical Dashboard candidate satisfies the entire seam', () => {
    checkCandidate(candidate);
});

test('anchored presentation, content, print and behavior mutations all fail closed', () => {
    const mutations = {
        missingStyle: s => replaceAnchor(s, style, ''),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        relocatedStyle: s => replaceAnchor(replaceAnchor(s, style + headEnd, headEnd), newBody, style + newBody),
        missingBody: s => replaceAnchor(s, newBody, oldBody),
        extraBodyClass: s => replaceAnchor(s, newBody, `    <body class="${bodyClass} extra">`),
        printMedia: s => replaceAnchor(s, '@media screen {', '@media print {'),
        popupContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html.oe-workbench-popup', 5),
        broadContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html', 5),
        broadContainer: s => replaceAnchor(s, '> .oe-help-container', '.oe-help-container'),
        canvas: s => replaceAnchor(s, 'var(--oe-wb-canvas, #f3f7f5)', '#f3f7f5'),
        paper: s => replaceAnchor(s, 'var(--oe-wb-paper, #fff)', '#fff', 2),
        ink: s => replaceAnchor(s, 'var(--oe-wb-ink, #17343b)', 'inherit', 5),
        headingImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-paper, #fff) !important;', 'background-color: var(--oe-wb-paper, #fff);'),
        redirectImportant: s => replaceAnchor(s, 'color: var(--oe-wb-ink, #17343b) !important;', 'color: var(--oe-wb-ink, #17343b);'),
        extraImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'),
        buttonPaint: s => replaceAnchor(s, 'a:not(.btn)', 'a'),
        semanticIcon: s => replaceAnchor(s, '.oe-help-redirect {', '.oe-help-redirect, .oe-text-red {'),
        geometry: s => replaceAnchor(s, '  ' + scope + ' {', '  ' + scope + ' {\n    padding: 1rem;'),
        typography: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'font-family: Arial;\n    background-color: var(--oe-wb-canvas, #f3f7f5);'),
        changedPhp: s => replaceAnchor(s, 'require_once("../../interface/globals.php");', 'require_once("../interface/globals.php");'),
        changedSection: s => replaceAnchor(s, 'id="section2"', 'id="section4"'),
        changedButton: s => replaceAnchor(s, 'Ensora MedEntry', 'Ensora Login', 2),
        changedIcon: s => replaceAnchor(s, 'fa fa-exclamation-triangle oe-text-red', 'fa fa-info-circle', 3),
        changedLinkMetadata: s => replaceAnchor(s, 'rel="noopener" target="_blank"', 'target="_blank"', 8),
        changedAdvice: s => replaceAnchor(s, 'Create Online Portal Credentials', 'Create Portal Credentials', 2),
        changedToggle: s => replaceAnchor(s, "$('.hideaway').toggle('1000');", "$('.hideaway').hide();")
    };
    for (const [name, mutate] of Object.entries(mutations)) {
        const changed = mutate(candidate);
        assert.throws(() => checkCandidate(changed), assert.AssertionError, name);
    }
});

test('actual caller, include, OemrUI, theme and shared asset topology remain pinned', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/patient_file/summary/demographics.php').toString();
    const included = read('interface/patient_file/summary/dashboard_header.php').toString();
    const twig = read('templates/patient/dashboard_header.html.twig').toString();
    const ui = read('src/OeUI/OemrUI.php').toString();
    const header = read('src/Core/Header.php').toString();
    const config = read('config/config.yaml').toString();
    const theme = read('interface/themes/colors/utilities/help-files.scss').toString();
    const css = read('interface/clinical-workspace/popup.css').toString();
    assert.match(caller, /'show_help_icon' => true,\s*'help_file_name' => "medical_dashboard_help\.php"/);
    assert.match(caller, /\$oemr_ui = new OemrUI\(\$arrOeUiSettings\)/);
    assert.match(caller, /\$thisauth = AclMain::aclCheckCore\('patients', 'demo'\);\s*if \(!\$thisauth \|\| !\$viewEvent->authorized\(\)\)/);
    assert.match(caller, /if \(\$thisauth\) \{\s*if \(\$result\['squad'\] && !AclMain::aclCheckCore\('squads', \$result\['squad'\]\)\)/);
    assert.match(caller, /if \(\$thisauth\) :[\s\S]*?summary\/dashboard_header\.php/);
    assert.match(caller, /\$oemr_ui->oeBelowContainerDiv\(\)/);
    assert.match(caller, /new ViewEvent\(\$pid\)[\s\S]*?ViewEvent::EVENT_HANDLE/);
    for (const anchor of ['clinical_rules.php', 'clinical_reminders_fragment.php', 'patient_reminders_fragment.php',
        'soap_patientfullmedication.php', 'soap_allergy.php', 'medex_recalls', 'eRx.php?page=compose',
        'user_settings.php', 'updateUserVisibilitySetting', 'CardRenderEvent', 'SectionEvent', 'EVENT_RENDER_POST_PAGELOAD']) {
        assert.ok(caller.includes(anchor), anchor);
    }
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
    for (const [token, value] of [['ink', '#17343b'], ['paper', '#fff'], ['canvas', '#f3f7f5']]) assert.ok(css.includes(`--oe-wb-${token}: ${value};`));
    assert.match(theme, /\.oe-help-redirect[\s\S]*?color: \$darker !important;[\s\S]*?\.oe-help-heading[\s\S]*?background-color: \$palepale !important;/);
});

test('source-derived OemrUI click assigns Medical Dashboard help iframe source once', () => {
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
        data(name) { assert.equal(name, 'src'); return '/Documentation/help_files/medical_dashboard_help.php'; }
    };
    const $ = target => target === document ? { on(event, selector, callback) {
        assert.equal(event, 'click'); assert.equal(selector, '#help-href'); listener = callback;
    } } : (assert.equal(target, '#targetiframe'), iframe);
    vm.runInNewContext(ui.slice(begin, finish + end.length), { document, $ }, { filename: 'OemrUI-help-click.js' });
    assert.equal(src, '');
    listener(); listener();
    assert.equal(src, '/Documentation/help_files/medical_dashboard_help.php');
    assert.equal(writes, 1);
});

function classList(initial = []) {
    const classes = new Set(initial);
    return { contains: value => classes.has(value), add: value => classes.add(value),
        remove: value => classes.delete(value), values: () => [...classes] };
}

function popupWindow({ active = false, shell = false, parent = null, frame = false, origin = 'https://openemr.test' } = {}) {
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
        frameElement: frame ? { closest: selector => { assert.equal(selector, '.dialogModal'); return null; } } : null,
        opener: null, addEventListener: (name, callback) => { listeners[name] = callback; } };
    win.parent = parent || win;
    return { win, doc, html, body, listeners };
}

function activate(win) {
    vm.runInNewContext(read('interface/clinical-workspace/popup.js').toString(), { window: win, Set }, { filename: 'popup.js' });
    return win.OpenEMRWorkbenchPopup;
}

test('unchanged controller follows ordinary modal iframe through content frame as context only', () => {
    const shell = popupWindow({ active: true, shell: true });
    const content = popupWindow({ parent: shell.win, frame: true });
    const help = popupWindow({ parent: content.win, frame: true });
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

test('unchanged controller leaves standalone, legacy and cross-origin help inert', () => {
    const standalone = popupWindow(); activate(standalone.win);
    assert.deepEqual(standalone.html.classList.values(), []);
    const legacy = popupWindow({ shell: true });
    const legacyHelp = popupWindow({ parent: legacy.win, frame: true }); activate(legacyHelp.win);
    assert.deepEqual(legacyHelp.html.classList.values(), []);
    const foreign = popupWindow({ active: true, origin: 'https://other.test' });
    const foreignHelp = popupWindow({ parent: foreign.win, frame: true }); activate(foreignHelp.win);
    assert.deepEqual(foreignHelp.html.classList.values(), []);
});

test('live route has the exact Medical Dashboard presentation seam', () => {
    const live = read(route).toString('utf8');
    assert.notEqual(live, plain, 'missing presentation: route still equals original fixture');
    checkCandidate(live);
});

if (process.argv.includes('--history')) {
    test('mandatory Git base authentication and committed plus dirty five-file scope', () => {
        assert.equal(execFileSync('git', ['branch', '--show-current'], { cwd: root }).toString().trim(),
            'OPEMR-94-medical-dashboard-help');
        assert.deepEqual(original, execFileSync('git', ['show', `${base}:${route}`], { cwd: root }));
        const committed = execFileSync('git', ['diff', '--name-only', '-z', base, 'HEAD'], { cwd: root }).toString().split('\0').filter(Boolean);
        const dirty = execFileSync('git', ['diff', '--name-only', '-z', 'HEAD'], { cwd: root }).toString().split('\0').filter(Boolean);
        const staged = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
        const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
        const allowed = new Set([route, fixture, 'tests/js/contracts/medical-dashboard-help-popup.cjs',
            'tests/js/medical-dashboard-help-popup.test.js', 'docs/clinical-ui/MEDICAL-DASHBOARD-HELP-POPUP.md']);
        for (const file of new Set([...committed, ...dirty, ...staged, ...untracked])) assert.ok(allowed.has(file), `out-of-scope changed file: ${file}`);
    });
}
