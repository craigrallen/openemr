'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const route = 'Documentation/help_files/report_dashboard_help.php';
const fixture = 'tests/js/fixtures/report-dashboard-help-popup-original.php.txt';
const base = '18647270e0c799189d2dc10f801e8de2bff1a360';
const protectedHashes = {
    'interface/patient_file/report/patient_report.php': '179cbad28b84252aa1b9bb2a573cb7823d6f3cb119c59c3c658480e749681772',
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
const bodyClass = 'oe-report-dashboard-help-popup';
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
    assert.equal(count(source, '<style>'), 2);
    assert.equal(count(source, '</style>'), 2);
    assert.equal(count(source, style), 1, 'one exact screen palette block immediately before head close');
    assert.equal(count(source, '!important'), 2, 'only heading background and redirect color');
    assert.equal(count(source, bodyClass), 6, 'five selectors and one body marker');
    assert.equal(count(source, headEnd), 1);
    assert.equal(count(source, newBody), 1);
    assert.equal(source, candidate, 'only the two exact presentation additions are allowed');
    assert.deepEqual(Buffer.from(source.replace(style, '').replace(newBody, oldBody)), original,
        'inverse must restore every original route byte');
}

test('complete nonexecuting fixture pins every original Patient Reports help byte', () => {
    assert.ok(fixture.endsWith('.php.txt'));
    assert.equal(original.length, 26951);
    assert.equal(sha(original), '9e185cef7f9d81efc3efd32e525231503a0cb2a1bfd7a8c07e4ac9dea50dfcff');
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '<style>'), 1);
    assert.equal(count(plain, '.oe-help-add-info{\n            padding:15px;\n            border:6px solid;\n            font-style: italic;\n        }'), 1);
});

test('four sections, nested hidden panels, controls, links, translations and guidance survive', () => {
    for (const section of [1, 2, 3, 4]) {
        assert.equal(count(plain, `id="section${section}"`), 1);
        assert.equal(count(plain, `href="#section${section}"`), section === 4 ? 3 : 1);
    }
    for (const id of ['ccr_details', 'ccr_sections', 'ccr_core', 'ccd_details', 'c-cda_sections']) {
        assert.equal(count(plain, `id="${id}"`) + count(plain, `id='${id}'`), 1, id);
    }
    assert.equal(count(plain, "style='display: none;'"), 5);
    assert.equal(count(plain, '<button type="button"'), 14);
    assert.equal(count(plain, 'rel="noopener" target="_blank"'), 3);
    assert.equal(count(plain, 'class="fa fa-arrow-circle-up oe-pull-away oe-help-redirect"'), 4);
    assert.equal(count(plain, 'oe-text-orange'), 2);
    assert.equal(count(plain, 'oe-text-red'), 1);
    for (const phrase of ['Patient Reports Help', 'All sections are not required', 'Meaningful Use Stage 1',
        'Protected Health Information (PHI)', 'You will need Administrator privileges',
        'Do not enter the server URL into your browser address bar']) {
        assert.ok(plain.includes(phrase), phrase);
    }
    assert.equal(count(plain, 'require_once("../../interface/globals.php");'), 1);
    assert.equal(count(plain, '<?php Header::setupHeader();?>'), 1);
    assert.equal(count(plain, "$('.show_hide').click(function() {"), 1);
    assert.deepEqual(Buffer.from(candidate.replace(style, '').replace(newBody, oldBody)), original);
});

test('synthetic future candidate passes before the live RED assertion', () => checkCandidate(candidate));

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
        petrolPair: s => replaceAnchor(s, 'color: var(--oe-wb-petrol, #086878);', 'color: #086878;', 1),
        headingImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-paper, #fff) !important;', 'background-color: var(--oe-wb-paper, #fff);'),
        redirectImportant: s => replaceAnchor(s, 'color: var(--oe-wb-petrol, #086878) !important;', 'color: var(--oe-wb-petrol, #086878);'),
        extraImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'),
        semanticWarning: s => replaceAnchor(s, 'a:not(.btn)', 'a:not(.btn), .oe-text-red'),
        controlOverride: s => replaceAnchor(s, 'a:not(.btn)', 'a:not(.btn), button'),
        fontChange: s => replaceAnchor(s, '    background-color: var(--oe-wb-canvas, #f3f7f5);', '    font-family: Arial;\n    background-color: var(--oe-wb-canvas, #f3f7f5);'),
        geometryChange: s => replaceAnchor(s, '    background-color: var(--oe-wb-canvas, #f3f7f5);', '    padding: 1rem;\n    background-color: var(--oe-wb-canvas, #f3f7f5);'),
        hiddenPanel: s => replaceAnchor(s, "id=\"ccr_details\" class='hideaway oe-help-heading oe-help-add-info' style='display: none;'", "id=\"ccr_details\" class='hideaway oe-help-heading oe-help-add-info' style='display: block;'"),
        toggleJs: s => replaceAnchor(s, ".children('.hideaway').toggle('1000');", ".children('.hideaway').show('1000');"),
        phpGlobals: s => replaceAnchor(s, 'require_once("../../interface/globals.php");', 'require_once("../interface/globals.php");'),
        phpSession: s => replaceAnchor(s, '<?php Header::setupHeader();?>', '<?php session_start(); Header::setupHeader();?>'),
        translation: s => replaceAnchor(s, 'xlt("Patient Reports Help")', 'xl("Patient Reports Help")', 2),
        clinicalGuidance: s => replaceAnchor(s, 'Protected Health Information (PHI)', 'Patient Health Information (PHI)'),
        sectionAnchor: s => replaceAnchor(s, 'id="section1"', 'id="other_section"'),
        externalLink: s => replaceAnchor(s, 'https://www.emrdirect.com/subscribe', 'https://example.test/subscribe'),
        linkMetadata: s => replaceAnchor(s, 'rel="noopener" target="_blank"', 'target="_blank"', 3),
        helpBorder: s => replaceAnchor(s, 'border:6px solid;', 'border:1px solid;')
    };
    for (const [name, mutate] of Object.entries(mutations)) {
        await t.test(name, () => {
            const changed = mutate(candidate);
            assert.notEqual(changed, candidate, 'mutation must change a unique anchor');
            assert.throws(() => checkCandidate(changed), assert.AssertionError);
        });
    }
});

test('actual report caller, heading path, theme cascade and shared assets are pinned', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/patient_file/report/patient_report.php').toString();
    const included = read('interface/patient_file/summary/dashboard_header.php').toString();
    const twig = read('templates/patient/dashboard_header.html.twig').toString();
    const ui = read('src/OeUI/OemrUI.php').toString();
    const header = read('src/Core/Header.php').toString();
    const assets = read('config/config.yaml').toString();
    const css = read('interface/clinical-workspace/popup.css').toString();
    const common = read('interface/themes/oe-common/help-files-common.scss').toString();
    const colors = read('interface/themes/colors/utilities/help-files.scss').toString();
    assert.match(caller, /AclMain::aclCheckCore\('patients', 'pat_rep'\)/);
    assert.match(caller, /\$session = SessionWrapperFactory::getInstance\(\)->getActiveSession\(\);[\s\S]*?\$pid = \$session->get\('pid', 0\)/);
    assert.match(caller, /'show_help_icon' => true,\s*'help_file_name' => "report_dashboard_help\.php"/);
    assert.match(caller, /\$oemr_ui = new OemrUI\(\$arrOeUiSettings\)/);
    assert.match(caller, /summary\/dashboard_header\.php/);
    assert.match(caller, /\$oemr_ui->oeBelowContainerDiv\(\)/);
    assert.match(caller, /PatientReportEvent::ACTIONS_RENDER_POST/);
    assert.match(caller, /PatientReportEvent::JAVASCRIPT_READY_POST/);
    assert.match(caller, /AclMain::aclCheckAcoSpec/);
    for (const permission of ["'encounters', 'notes_a'", "'encounters', 'notes'", "'encounters', 'coding_a'",
        "'encounters', 'coding'", "'encounters', 'relaxed'", "'patients', 'med'", "'patients', 'demo'"]) {
        assert.ok(caller.includes(permission), permission);
    }
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
        ['interface/patient_file/report/patient_report.php', caller, "AclMain::aclCheckCore('patients', 'pat_rep')", "AclMain::aclCheckCore('patients', 'demo')"],
        ['interface/patient_file/report/patient_report.php', caller, 'PatientReportEvent::ACTIONS_RENDER_POST', 'PatientReportEvent::OTHER_EVENT'],
        ['src/OeUI/OemrUI.php', ui, '<div class="modal fade" id="myModal"', '<div class="dialogModal modal fade" id="myModal"']
    ]) {
        const changed = replaceAnchor(source, anchor, replacement);
        assert.notEqual(changed, source);
        assert.throws(() => assert.equal(sha(Buffer.from(changed)), protectedHashes[file]), assert.AssertionError);
    }
});

test('source-derived OemrUI first click loads the report help iframe once', () => {
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
        data(name) { assert.equal(name, 'src'); return '/Documentation/help_files/report_dashboard_help.php'; }
    };
    const $ = target => target === document ? { on(event, selector, callback) {
        assert.equal(event, 'click'); assert.equal(selector, '#help-href'); listener = callback;
    } } : (assert.equal(target, '#targetiframe'), iframe);
    vm.runInNewContext(ui.slice(begin, finish + end.length), { document, $ }, { filename: 'OemrUI-help-click.js' });
    listener(); listener();
    assert.equal(src, '/Documentation/help_files/report_dashboard_help.php');
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

test('unchanged popup.js follows ordinary modal iframe through content frame to shell', () => {
    const shell = popupWindow({ active: true, shell: true });
    const content = popupWindow({ parent: shell.win, frame: true });
    const help = popupWindow({ parent: content.win, frame: true });
    vm.runInNewContext(read('interface/clinical-workspace/popup.js').toString(), { window: help.win, Set }, { filename: 'popup.js' });
    assert.equal(help.win.OpenEMRWorkbenchPopup.CONTEXT_CLASS, 'oe-workbench-context');
    assert.equal(help.win.OpenEMRWorkbenchPopup.POPUP_CLASS, 'oe-workbench-popup');
    assert.deepEqual(help.html.classList.values(), ['oe-workbench-context']);
    shell.body.classList.remove('workbench-active'); shell.doc.observerCallback();
    assert.deepEqual(help.html.classList.values(), []);
    shell.body.classList.add('workbench-active'); shell.doc.observerCallback();
    assert.deepEqual(help.html.classList.values(), ['oe-workbench-context']);
    help.listeners.pagehide();
    assert.deepEqual(help.html.classList.values(), []);
    assert.equal(shell.doc.disconnected, true);
});

test('live route has the exact Patient Reports presentation seam', () => {
    const live = read(route).toString('utf8');
    assert.notEqual(live, plain, 'missing presentation: route still equals original fixture');
    checkCandidate(live);
});

if (process.argv.includes('--history')) {
    test('authentic Git base and exact authorized five-path scope', () => {
        assert.deepEqual(original, execFileSync('git', ['show', `${base}:${route}`], { cwd: root }));
        const changed = execFileSync('git', ['diff', '--name-only', '-z', base], { cwd: root }).toString().split('\0').filter(Boolean);
        const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
        const allowed = new Set([route, fixture, 'tests/js/contracts/report-dashboard-help-popup.cjs',
            'tests/js/report-dashboard-help-popup.test.js', 'docs/clinical-ui/REPORT-DASHBOARD-HELP-POPUP.md']);
        for (const file of [...changed, ...untracked]) assert.ok(allowed.has(file), `out-of-scope changed file: ${file}`);
    });
}
