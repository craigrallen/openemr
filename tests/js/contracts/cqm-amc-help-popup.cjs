'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const route = 'Documentation/help_files/cqm_amc_help.php';
const fixture = 'tests/js/fixtures/cqm-amc-help-popup-original.php.txt';
const base = '18647270e0c799189d2dc10f801e8de2bff1a360';
const protectedHashes = {
    'interface/reports/cqm.php': 'e878c3fbd1601d50c25b8fe6250e90533cad88b19b5362c05069fc42ac2ebe09',
    'templates/reports/cqm/cqm.html.twig': '0ebab8b727ae6184b62fa1f405f913f7ead893baa702a8997bcc12596ae621c4',
    'src/Common/Twig/TwigExtension.php': '80ba5e20c9601a9a080961035c6c1f52e95f1e21e9d920cc7301a0279462ecfb',
    'library/display_help_icon_inc.php': '2f30a28640f32a97f74545bb7c86d141f64ebf93fc8007d423fc8abdf5c101a5',
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
const bodyClass = 'oe-cqm-amc-help-popup';
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
const headEnd = '</head>';
const oldBody = '<body>';
const newBody = `<body class="${bodyClass}">`;
const count = (source, needle) => source.split(needle).length - 1;

function replaceAnchor(source, anchor, replacement, occurrences = 1) {
    assert.equal(count(source, anchor), occurrences, `mutation anchor count: ${anchor}`);
    assert.notEqual(anchor, replacement);
    return source.split(anchor).join(replacement);
}

const candidate = replaceAnchor(replaceAnchor(plain, headEnd, style + headEnd), oldBody, newBody);

function checkCandidate(source) {
    assert.equal(count(source, style), 1, 'one exact inline screen block before </head>');
    assert.equal(count(source, newBody), 1, 'one marked body');
    assert.equal(count(source, bodyClass), 3, 'two scoped selectors and body marker');
    assert.equal(count(source, '<style>'), 1);
    assert.equal(count(source, '</style>'), 1);
    assert.equal(count(source, '!important'), 0);
    assert.equal(source, candidate, 'only the two exact presentation additions are allowed');
    assert.deepEqual(Buffer.from(source.replace(style, '').replace(newBody, oldBody)), original,
        'removing the two allowed additions restores every original route byte');
}

test('complete inert fixture pins the original AMC help route', () => {
    assert.ok(fixture.endsWith('.php.txt'));
    assert.equal(original.length, 6440);
    assert.equal(sha(original), '0c0f80f76b99f2f37a32e41c4bcc92482ea41b17865a3a13aa06b5d9c974521c');
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '<style>'), 0);
    assert.equal(count(plain, '<a name=\'entire_doc\'>'), 1);
    assert.equal(count(plain, 'class="alert alert-info"'), 2);
    assert.equal(count(plain, '<ol>'), 2);
    assert.equal(count(plain, '</ol>'), 2);
    assert.equal(count(plain, '<dt>'), 6);
    assert.equal(count(plain, '<dd>'), 6);
    assert.equal(count(plain, 'href='), 0);
    assert.equal(count(plain, 'oe-help-heading'), 0);
    assert.equal(count(plain, 'oe-help-redirect'), 0);
    assert.equal(count(plain, '<button'), 0);
    assert.equal(count(plain, 'require_once("../../interface/globals.php");'), 1);
    assert.equal(count(plain, 'Header::setupHeader();'), 1);
    for (const phrase of ['Automated Measures Calculation (AMC) Help', 'Running a report',
        'Eligible Individual Clinician (EC) calculation method', 'Eligible Group Clinician (EC) calculation method',
        'Report Results', 'Most recent RuleSet', 'MIPS Promoting Interopability',
        'NPI and TIN number setup', 'default Billing Facility', 'AMC Detailed Report']) {
        // The original casing and clinical wording are evidence, not a corrected medical claim.
        assert.ok(plain.toLowerCase().includes(phrase.toLowerCase()), phrase);
    }
    assert.deepEqual(Buffer.from(candidate.replace(style, '').replace(newBody, oldBody)), original);
});

test('synthetic full-original candidate passes before live RED', () => checkCandidate(candidate));

test('single anchored presentation and original-content mutations fail closed', async t => {
    const mutations = {
        missingStyle: s => replaceAnchor(s, style, ''),
        movedStyle: s => replaceAnchor(replaceAnchor(s, style + headEnd, headEnd), newBody, style + newBody),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        missingBodyClass: s => replaceAnchor(s, newBody, oldBody),
        duplicateBodyClass: s => replaceAnchor(s, newBody, `<body class="${bodyClass} ${bodyClass}">`),
        printMedia: s => replaceAnchor(s, '@media screen {', '@media print {'),
        popupInsteadOfContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html.oe-workbench-popup', 2),
        lostContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html', 2),
        broadBody: s => replaceAnchor(s, `body.${bodyClass}`, 'body', 2),
        descendantContainer: s => replaceAnchor(s, '> .oe-help-container', '.oe-help-container'),
        canvasToken: s => replaceAnchor(s, 'var(--oe-wb-canvas, #f3f7f5)', '#f3f7f5'),
        paperToken: s => replaceAnchor(s, 'var(--oe-wb-paper, #fff)', 'white'),
        inkToken: s => replaceAnchor(s, 'var(--oe-wb-ink, #17343b)', 'inherit', 2),
        wrongCanvasFallback: s => replaceAnchor(s, '#f3f7f5', '#ffffff'),
        wrongPaperFallback: s => replaceAnchor(s, 'var(--oe-wb-paper, #fff)', 'var(--oe-wb-paper, #eee)'),
        extraDeclaration: s => replaceAnchor(s, '    color: var(--oe-wb-ink, #17343b);', '    padding: 1rem;\n    color: var(--oe-wb-ink, #17343b);', 2),
        important: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'),
        font: s => replaceAnchor(s, '    background-color: var(--oe-wb-canvas, #f3f7f5);', '    font-family: Arial;\n    background-color: var(--oe-wb-canvas, #f3f7f5);'),
        geometry: s => replaceAnchor(s, '    background-color: var(--oe-wb-paper, #fff);', '    max-width: 900px;\n    background-color: var(--oe-wb-paper, #fff);'),
        semanticAlert: s => replaceAnchor(s, 'class="alert alert-info"', 'class="alert alert-warning"', 2),
        firstInstruction: s => replaceAnchor(s, 'Choose the promotion period for the calculation', 'Choose another period for the calculation', 2),
        groupInstruction: s => replaceAnchor(s, 'For the provider dropdown choose Group Calculation option', 'Choose any provider'),
        definition: s => replaceAnchor(s, 'The pass/total percentage that was calculated from dividing the numerator by the denominator', 'The numerator alone'),
        term: s => replaceAnchor(s, 'xlt("Denominator")', 'xlt("Other")'),
        heading: s => replaceAnchor(s, 'xlt("Report Results")', 'xlt("Other Results")'),
        anchor: s => replaceAnchor(s, "name='entire_doc'", "name='changed'"),
        phpGlobals: s => replaceAnchor(s, 'require_once("../../interface/globals.php");', 'require_once("../interface/globals.php");'),
        phpHeader: s => replaceAnchor(s, 'Header::setupHeader();', 'Header::setupHeader("no_main-theme");'),
        translation: s => replaceAnchor(s, 'xlt("Running a report")', 'xl("Running a report")')
    };
    for (const [name, mutate] of Object.entries(mutations)) {
        await t.test(name, () => {
            const changed = mutate(candidate);
            assert.notEqual(changed, candidate);
            assert.throws(() => checkCandidate(changed), assert.AssertionError);
        });
    }
});

test('AMC caller, two help-icon paths, ordinary modal, theme cascade and assets are pinned', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/reports/cqm.php').toString();
    const twig = read('templates/reports/cqm/cqm.html.twig').toString();
    const extension = read('src/Common/Twig/TwigExtension.php').toString();
    const icon = read('library/display_help_icon_inc.php').toString();
    const ui = read('src/OeUI/OemrUI.php').toString();
    const header = read('src/Core/Header.php').toString();
    const assets = read('config/config.yaml').toString();
    const css = read('interface/clinical-workspace/popup.css').toString();
    assert.match(caller, /\$show_help = false;[\s\S]*?elseif \(\$is_amc_report\) \{[\s\S]*?\$show_help = true;\s*\$help_file_name = "cqm_amc_help\.php";/);
    assert.match(caller, /'show_help' => \$show_help/);
    assert.match(caller, /'show_help_icon' => \$show_help,\s*'help_file_name' => \$help_file_name/);
    assert.match(twig, /\{% if show_help %\}\{\{ oemHelpIcon\(\) \}\}\{% endif %\}/);
    assert.match(twig, /\{\{ oemrUiBelowContainerDiv\(oemrUiSettings\) \}\}/);
    assert.match(extension, /'oemHelpIcon'[\s\S]*?require \$srcDir \. "\/display_help_icon_inc\.php"/);
    assert.match(extension, /'oemrUiBelowContainerDiv'[\s\S]*?\$oemrUi->oeBelowContainerDiv\(\)/);
    assert.match(icon, /get\('enable_help'\) == 1[\s\S]*?data-target="#myModal"/);
    assert.match(icon, /get\('enable_help'\) == 2[\s\S]*?get\('enable_help'\) == 0/);
    assert.match(ui, /get\('enable_help'\) !== 0 && \$this->display_help_icon/);
    assert.match(ui, /\$this->display_help_icon \? \$this->helpFileModal\(\)/);
    assert.match(ui, /<iframe src='' data-src='\$help_file' id='targetiframe'/);
    assert.match(ui, /<div class="modal fade" id="myModal"/);
    assert.doesNotMatch(ui, /class="[^"]*\bdialogModal\b/);
    assert.match(header, /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(assets, /workbench-popup:[\s\S]*?script: popup\.js[\s\S]*?link: popup\.css[\s\S]*?autoload: true/);
    for (const [token, value] of [['ink', '#17343b'], ['paper', '#fff'], ['canvas', '#f3f7f5']]) {
        assert.ok(css.includes(`--oe-wb-${token}: ${value};`));
    }
    assert.match(read('interface/themes/oe-common/help-files-common.scss').toString(), /\.oe-help-container a:not\(\.btn\)[\s\S]*?color: \$gray/);
    assert.match(read('interface/themes/colors/utilities/help-files.scss').toString(), /\.oe-help-redirect[\s\S]*?!important/);
});

test('source-derived OemrUI click loads AMC iframe once', () => {
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
        data(name) { assert.equal(name, 'src'); return '/Documentation/help_files/cqm_amc_help.php'; }
    };
    const $ = target => target === document ? { on(event, selector, callback) {
        assert.equal(event, 'click'); assert.equal(selector, '#help-href'); listener = callback;
    } } : (assert.equal(target, '#targetiframe'), iframe);
    vm.runInNewContext(ui.slice(begin, finish + end.length), { document, $ }, { filename: 'OemrUI-help-click.js' });
    listener(); listener();
    assert.equal(src, '/Documentation/help_files/cqm_amc_help.php');
    assert.equal(writes, 1);
});

function classList(initial = []) {
    const classes = new Set(initial);
    return { contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value), values: () => [...classes] };
}

function popupWindow({ active = false, shell = false, parent = null, frame = false } = {}) {
    const html = { classList: classList() };
    const body = { classList: classList(active ? ['workbench-active'] : []), ownerDocument: null };
    const listeners = {};
    const doc = { documentElement: html, body, readyState: 'complete',
        querySelector: selector => shell && selector === '#mainBox [data-workbench-mode]' ? {} : null,
        defaultView: { MutationObserver: class { constructor(callback) { doc.observerCallback = callback; } observe() {} disconnect() { doc.disconnected = true; } } } };
    body.ownerDocument = doc;
    const win = { document: doc, location: { origin: 'https://openemr.test' },
        frameElement: frame ? { closest: selector => { assert.equal(selector, '.dialogModal'); return null; } } : null,
        opener: null, addEventListener: (name, callback) => { listeners[name] = callback; } };
    win.parent = parent || win;
    return { win, doc, html, body, listeners };
}

test('actual popup.js follows ordinary modal iframe through content frame to shell as context only', () => {
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

test('live route has the exact AMC presentation seam', () => {
    const live = read(route).toString('utf8');
    assert.notEqual(live, plain, 'missing presentation: route still equals original fixture');
    checkCandidate(live);
});

if (process.argv.includes('--history')) {
    test('authentic Git base and exact authorized five-path scope', () => {
        assert.deepEqual(original, execFileSync('git', ['show', `${base}:${route}`], { cwd: root }));
        const paths = args => execFileSync('git', args, { cwd: root }).toString().split('\0').filter(Boolean);
        const changed = new Set([
            ...paths(['diff', '--name-only', '-z', base]),
            ...paths(['diff', '--name-only', '--cached', '-z', base]),
            ...paths(['diff', '--name-only', '-z']),
            ...paths(['ls-files', '--others', '--exclude-standard', '-z'])
        ]);
        const allowed = new Set([route, fixture, 'tests/js/contracts/cqm-amc-help-popup.cjs',
            'tests/js/cqm-amc-help-popup.test.js', 'docs/clinical-ui/CQM-AMC-HELP-POPUP.md']);
        for (const file of changed) assert.ok(allowed.has(file), `out-of-scope changed file: ${file}`);
        for (const file of [fixture, 'tests/js/contracts/cqm-amc-help-popup.cjs', 'tests/js/cqm-amc-help-popup.test.js']) {
            assert.ok(changed.has(file), `missing phase-one test path: ${file}`);
        }
    });
}
