'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../../..');
const route = 'Documentation/help_files/history_dashboard_help.php';
const fixture = 'tests/js/fixtures/history-dashboard-help-popup-original.php.txt';
const base = '18647270e0c799189d2dc10f801e8de2bff1a360';
const protectedHashes = {
    'interface/patient_file/history/history.php': '4f16b5b5ee113a7e89fb424fdb489e0f5c21f975175df50ce3cad329ef1b958c',
    'interface/patient_file/summary/dashboard_header.php': '24500933229d8915cf9ddf81825c3c00db25a694bdc1f5541678aef335c98a23',
    'templates/patient/dashboard_header.html.twig': '5530b1603a785af75b38a27b1544f2c9e0d90e21da9a90c8cc77ab343cc73e9a',
    'src/OeUI/OemrUI.php': '478dd52733a2a50078d0610fc0e8e74bf8ad2c6c68d44abc612c8097eb99dc44',
    'src/Core/Header.php': 'dee3fd5f35bfd900ed119ae45981142ed737dac48059e54cacb4af843d6d264d',
    'config/config.yaml': '5f99c981f570a2f94917d68a4abcedf086eb75a102364bf71f1cb44ccfe461b7',
    'interface/clinical-workspace/popup.js': 'af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f',
    'interface/clinical-workspace/popup.css': 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9'
};
const read = file => readFileSync(path.join(root, file));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = read(fixture);
const plain = original.toString('utf8');
const bodyClass = 'oe-history-dashboard-help-popup';
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
    assert.equal(count(source, style), 1, 'one exact screen palette block before head close');
    assert.equal(count(source, '<style>'), 1);
    assert.equal(count(source, '</style>'), 1);
    assert.equal(count(source, '@media screen {'), 1);
    assert.equal(count(source, '!important'), 0);
    assert.equal(count(source, scope), 2);
    assert.equal(count(source, bodyClass), 3);
    assert.equal(count(source, newBody), 1);
    assert.equal(source, candidate, 'only the two exact presentation additions are allowed');
    assert.deepEqual(Buffer.from(source.replace(style, '').replace(newBody, oldBody)), original,
        'full inverse must restore every original route byte');
}

test('synthetic History dashboard presentation candidate satisfies the complete seam', () => {
    checkCandidate(candidate);
});

test('nonexecuting fixture pins the complete original route', () => {
    assert.ok(fixture.endsWith('.php.txt'));
    assert.equal(original.length, 4463);
    assert.equal(sha(original), '29a6d603f40fb3ac09949d70e9609cfefeeb246ba4358cdaf39208cb50c9c154');
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '<style>'), 0);
    assert.deepEqual(Buffer.from(candidate.replace(style, '').replace(newBody, oldBody)), original);
});

test('historical instructions, translations, links and inactive behavior stay byte identical', () => {
    assert.equal(count(plain, 'xlt("It has four tabs")'), 1);
    for (const tab of ['General', 'Family History', 'Relatives', 'Lifestyle', 'Other']) {
        assert.equal(count(plain, `<li><?php echo xlt("${tab}"); ?></li>`), 1);
    }
    assert.equal(count(plain, '<button type="button" class="btn btn-secondary btn-edit btn-sm oe-no-float">'), 1);
    assert.equal(count(plain, 'fa fa-exclamation-triangle oe-text-red'), 1);
    for (const url of ['LBV_Forms', 'Sample_Layout_Based_Visit_Form']) {
        assert.equal(count(plain, `href="https://www.open-emr.org/wiki/index.php/${url}" rel="noopener" target="_blank"`), 1);
    }
    assert.equal(count(plain, 'data-original-title="" title=""'), 2);
    assert.equal(count(plain, '</div><!--end of container div-->'), 1);
    assert.equal(count(plain, "$('#show_hide').click(function() {"), 1);
    assert.equal(count(plain, "$('.hideaway').toggle('1000');"), 1);
    assert.equal(count(plain, 'require_once("../../interface/globals.php");'), 1);
    assert.equal(count(plain, '<?php Header::setupHeader();?>'), 1);
    assert.equal(count(plain, 'oe-help-heading'), 0);
    assert.equal(count(plain, 'oe-help-redirect'), 0);
});

test('anchored changes to scope, style, behavior or original bytes are rejected', async t => {
    const mutations = {
        missingStyle: s => replaceAnchor(s, style, ''),
        relocatedStyle: s => replaceAnchor(replaceAnchor(s, style + headEnd, headEnd), newBody, style + newBody),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        missingBodyClass: s => replaceAnchor(s, newBody, oldBody),
        duplicateBodyClass: s => replaceAnchor(s, newBody, newBody + newBody),
        printMedia: s => replaceAnchor(s, '@media screen {', '@media print {'),
        lostContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html', 2),
        popupClass: s => replaceAnchor(s, 'html.oe-workbench-context', 'html.oe-workbench-popup', 2),
        broadBody: s => replaceAnchor(s, `body.${bodyClass}`, 'body', 2),
        broadContainer: s => replaceAnchor(s, '> .oe-help-container', '.oe-help-container'),
        canvasToken: s => replaceAnchor(s, 'var(--oe-wb-canvas, #f3f7f5)', '#f3f7f5'),
        paperToken: s => replaceAnchor(s, 'var(--oe-wb-paper, #fff)', '#fff'),
        inkPair: s => replaceAnchor(s, 'var(--oe-wb-ink, #17343b)', 'inherit', 2),
        important: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);',
            'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'),
        layout: s => replaceAnchor(s, '    color: var(--oe-wb-ink, #17343b);',
            '    padding: 1rem;\n    color: var(--oe-wb-ink, #17343b);', 2),
        typography: s => replaceAnchor(s, '    color: var(--oe-wb-ink, #17343b);',
            '    font-family: Arial;\n    color: var(--oe-wb-ink, #17343b);', 2),
        heading: s => replaceAnchor(s, '  }\n}\n    </style>',
            `  }\n  ${scope} h3 { color: red; }\n}\n    </style>`),
        link: s => replaceAnchor(s, '  }\n}\n    </style>',
            `  }\n  ${scope} a { color: red; }\n}\n    </style>`),
        alert: s => replaceAnchor(s, '  }\n}\n    </style>',
            `  }\n  ${scope} .alert-info { color: red; }\n}\n    </style>`),
        control: s => replaceAnchor(s, '  }\n}\n    </style>',
            `  }\n  ${scope} button { color: red; }\n}\n    </style>`),
        tabsText: s => replaceAnchor(s, 'xlt("It has four tabs")', 'xlt("It has five tabs")'),
        translation: s => replaceAnchor(s, 'xlt("General")', 'xl("General")'),
        button: s => replaceAnchor(s, '<button type="button"', '<button type="submit"'),
        icon: s => replaceAnchor(s, 'fa fa-exclamation-triangle oe-text-red', 'fa fa-info-circle'),
        linkMetadata: s => replaceAnchor(s, 'rel="noopener" target="_blank"', 'target="_blank"', 2),
        extraDiv: s => replaceAnchor(s, '</div><!--end of container div-->', ''),
        script: s => replaceAnchor(s, "$('.hideaway').toggle('1000');", "$('.hideaway').hide();"),
        bootstrap: s => replaceAnchor(s, 'require_once("../../interface/globals.php");', 'session_start();'),
        bodyBehavior: s => replaceAnchor(s, newBody, '    <body onload="save()" class="' + bodyClass + '">')
    };
    for (const [name, mutate] of Object.entries(mutations)) {
        await t.test(name, () => {
            const changed = mutate(candidate);
            assert.notEqual(changed, candidate);
            assert.throws(() => checkCandidate(changed), assert.AssertionError);
        });
    }
});

test('unmodified caller, modal, theme assets and eligibility are pinned', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/patient_file/history/history.php').toString();
    const included = read('interface/patient_file/summary/dashboard_header.php').toString();
    const twig = read('templates/patient/dashboard_header.html.twig').toString();
    const ui = read('src/OeUI/OemrUI.php').toString();
    const header = read('src/Core/Header.php').toString();
    const assets = read('config/config.yaml').toString();
    const css = read('interface/clinical-workspace/popup.css').toString();
    assert.match(caller, /\$pid = \$session->get\('pid', 0\)/);
    assert.match(caller, /'show_help_icon' => true,\s*'help_file_name' => "history_dashboard_help\.php"/);
    assert.match(caller, /\$oemr_ui = new OemrUI\(\$arrOeUiSettings\)/);
    assert.match(caller, /AclMain::aclCheckCore\('patients', 'med'\)[\s\S]*?getPatientData\(\$pid, "squad"\)[\s\S]*?AclMain::aclCheckCore\('squads', \$tmp\['squad'\]\)/);
    assert.match(caller, /\$result = getHistoryData\(\$pid\);\s*if \(!is_array\(\$result\)\) \{\s*newHistoryData\(\$pid\)/);
    assert.match(caller, /AclMain::aclCheckCore\('patients', 'med', '', \['write','addonly'\]\)[\s\S]*?summary\/dashboard_header\.php/);
    assert.match(included, /'pageHeading' => isset\(\$oemr_ui\) \? \$oemr_ui->pageHeading\(\) : ''/);
    assert.equal(twig, '{{ pageHeading }}\n');
    assert.match(ui, /get\('enable_help'\) !== 0 && \$this->display_help_icon/);
    assert.match(ui, /get\('enable_help'\) == "1"[\s\S]*?get\('enable_help'\) == "2"/);
    assert.match(ui, /'data-target' => "#myModal",\s*'data-toggle' => 'modal'/);
    assert.match(ui, /<iframe src='' data-src='\$help_file' id='targetiframe'/);
    assert.match(ui, /<div class="modal fade" id="myModal"/);
    assert.doesNotMatch(ui, /class="[^"]*\bdialogModal\b/);
    assert.match(header, /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(assets, /workbench-popup:[\s\S]*?script: popup\.js[\s\S]*?link: popup\.css[\s\S]*?autoload: true/);
    for (const [token, value] of [['ink', '#17343b'], ['paper', '#fff'], ['canvas', '#f3f7f5']]) {
        assert.ok(css.includes(`--oe-wb-${token}: ${value};`));
    }
});

test('OemrUI delegated first click assigns the help source once', () => {
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
        data(name) { assert.equal(name, 'src'); return '/Documentation/help_files/history_dashboard_help.php'; }
    };
    const $ = target => target === document ? { on(event, selector, callback) {
        assert.equal(event, 'click'); assert.equal(selector, '#help-href'); listener = callback;
    } } : (assert.equal(target, '#targetiframe'), iframe);
    vm.runInNewContext(ui.slice(begin, finish + end.length), { document, $ });
    listener(); listener();
    assert.equal(src, '/Documentation/help_files/history_dashboard_help.php');
    assert.equal(writes, 1);
});

function classList(initial = []) {
    const classes = new Set(initial);
    return { contains: value => classes.has(value), add: value => classes.add(value),
        remove: value => classes.delete(value), values: () => [...classes] };
}

function popupWindow({ active = false, shell = false, parent = null, frameId = null } = {}) {
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
    const win = { document: doc, location: { origin: 'https://openemr.test' },
        frameElement: frameId ? { id: frameId,
            closest: selector => { assert.equal(selector, '.dialogModal'); return null; } } : null,
        opener: null, addEventListener: (name, callback) => { listeners[name] = callback; } };
    win.parent = parent || win;
    return { win, doc, html, body, listeners };
}

test('real popup.js gives ordinary help iframe context only and follows legacy transitions', () => {
    const shell = popupWindow({ active: true, shell: true });
    const content = popupWindow({ parent: shell.win, frameId: 'contentframe' });
    const help = popupWindow({ parent: content.win, frameId: 'targetiframe' });
    assert.equal(content.win.frameElement.id, 'contentframe');
    assert.equal(help.win.frameElement.id, 'targetiframe');
    const source = read('interface/clinical-workspace/popup.js').toString();
    vm.runInNewContext(source, { window: help.win, Set }, { filename: 'popup.js' });
    assert.equal(help.win.OpenEMRWorkbenchPopup.CONTEXT_CLASS, 'oe-workbench-context');
    assert.deepEqual(help.html.classList.values(), ['oe-workbench-context']);
    shell.body.classList.remove('workbench-active'); shell.doc.observerCallback();
    assert.deepEqual(help.html.classList.values(), []);
    shell.body.classList.add('workbench-active'); shell.doc.observerCallback();
    assert.deepEqual(help.html.classList.values(), ['oe-workbench-context']);
    help.listeners.pagehide();
    assert.deepEqual(help.html.classList.values(), []);
    assert.equal(shell.doc.disconnected, true);

    const broken = replaceAnchor(source, 'let current = parentWindow && parentWindow !== self ? parentWindow : null;', 'let current = null;');
    const otherShell = popupWindow({ active: true, shell: true });
    const otherContent = popupWindow({ parent: otherShell.win, frameId: 'contentframe' });
    const otherHelp = popupWindow({ parent: otherContent.win, frameId: 'targetiframe' });
    vm.runInNewContext(broken, { window: otherHelp.win, Set });
    assert.deepEqual(otherHelp.html.classList.values(), []);
});

test('live route has the exact History dashboard presentation seam', () => {
    const live = read(route).toString('utf8');
    assert.ok(live !== plain, 'missing presentation: route still equals original fixture');
    checkCandidate(live);
});

if (process.argv.includes('--history')) {
    test('authentic Git base and exact authorized five-path scope', () => {
        assert.deepEqual(original, execFileSync('git', ['show', `${base}:${route}`], { cwd: root }));
        const changed = execFileSync('git', ['diff', '--name-only', '-z', base], { cwd: root }).toString().split('\0').filter(Boolean);
        const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
        const allowed = new Set([route, fixture, 'tests/js/contracts/history-dashboard-help-popup.cjs',
            'tests/js/history-dashboard-help-popup.test.js', 'docs/clinical-ui/HISTORY-DASHBOARD-HELP-POPUP.md']);
        for (const file of [...new Set([...changed, ...untracked])]) assert.ok(allowed.has(file), `out-of-scope changed file: ${file}`);
    });
}
