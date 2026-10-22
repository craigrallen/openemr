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
const route = 'Documentation/help_files/issues_dashboard_help.php';
const fixture = 'tests/js/fixtures/issues-dashboard-help-popup-original.php.txt';
const contract = 'tests/js/contracts/issues-dashboard-help-popup.cjs';
const adapter = 'tests/js/issues-dashboard-help-popup.test.js';
const doc = 'docs/clinical-ui/ISSUES-DASHBOARD-HELP-POPUP.md';
const protectedHashes = {
    'interface/patient_file/summary/stats_full.php': '06be3854bda78f35827ea8e41ab9c35f26ed01147afd83dc2fcb2a1bcdf5e526',
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
const bodyClass = 'oe-issues-dashboard-help-popup';
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
    assert.equal(count(source, anchor), occurrences, `exact original anchor count: ${anchor}`);
    assert.notEqual(anchor, replacement, 'mutation must replace the anchor');
    const changed = source.split(anchor).join(replacement);
    assert.notDeepEqual(Buffer.from(changed), Buffer.from(source), 'mutation must change bytes');
    return changed;
}

const candidate = replaceAnchor(replaceAnchor(plain, headEnd, style + headEnd), oldBody, newBody);

function checkCandidate(source) {
    assert.equal(count(source, style), 1, 'one exact screen-only five-rule block before head close');
    assert.equal(count(source, '<style>'), 1);
    assert.equal(count(source, '</style>'), 1);
    assert.equal(count(source, '@media screen {'), 1);
    assert.equal(count(source, '!important'), 2, 'only heading paper and redirect ink override theme');
    assert.equal(count(source, scope), 5);
    assert.equal(count(source, bodyClass), 6);
    assert.equal(count(source, newBody), 1);
    assert.equal(count(source, headEnd), 1);
    assert.equal(source, candidate, 'only the exact two route additions are allowed');
    const recovered = source.replace(style, '').replace(newBody, oldBody);
    assert.deepEqual(Buffer.from(recovered), original, 'complete inverse restores every original byte');
}

test('complete nonexecuting Issues fixture pins every original source byte', () => {
    assert.ok(fixture.endsWith('.php.txt'));
    assert.equal(original.length, 16957);
    assert.equal(sha(original), 'a5dc0fde0cdfce137fd6821ae973e450fb240bb6c1780dcbf0479b2d97fb3eac');
    assert.equal(count(plain, headEnd), 1);
    assert.equal(count(plain, oldBody), 1);
    assert.equal(count(plain, '<style>'), 0);
    assert.deepEqual(Buffer.from(candidate.replace(style, '').replace(newBody, oldBody)), original);
});

test('all original sections, guidance, sample controls, links and icons survive', () => {
    for (const [id, label] of ['Medical Problems', 'Allergies', 'Medications', 'Surgeries', 'Dental Issues'].entries()) {
        assert.equal(count(plain, `id="section${id + 1}"`), 1);
        assert.equal(count(plain, `<h4 class="oe-help-heading"><?php echo xlt("${label}"); ?>`), 1);
        assert.equal(count(plain, `href="#section${id + 1}"`), 1);
    }
    assert.equal(count(plain, '<button type="button" class="btn btn-secondary'), 10);
    assert.equal(count(plain, '<?php echo xlt("Add"); ?></button>'), 5);
    assert.equal(count(plain, '<?php echo xlt("Save"); ?></button>'), 5);
    assert.equal(count(plain, 'fa fa-arrow-circle-up oe-pull-away oe-help-redirect'), 5);
    for (const phrase of [
        'ICD10 code set is not installed',
        'Administrator Privileges to install the ICD10 code set',
        'Continuity of Care Report (CCR) and Continuity of Care Document (CCD)',
        'Depending on whether or not Ensora eRx module is enabled',
        'Ensora MedEntry page',
        'link the newly added issue to encounters',
        'If it it still active i.e. End Date is not entered',
        'resize the help pop-up by clicking and dragging'
    ]) assert.ok(plain.includes(phrase), phrase);
    assert.equal(count(plain, 'href="https://www.open-emr.org/wiki/index.php/Issues_&_Immunizations" rel="noopener" target="_blank"'), 1);
    assert.equal(count(plain, 'fa fa-exclamation-triangle  oe-text-red'), 1);
    assert.equal(count(plain, 'fa fa-lightbulb-o fa-lg  oe-text-green'), 1);
    assert.equal(count(plain, 'require_once("../../interface/globals.php");'), 1);
    assert.equal(count(plain, '<?php Header::setupHeader();?>'), 1);
    assert.equal(count(plain, '</div><!--end of container div-->'), 1);
    checkCandidate(candidate);
});

test('synthetic Issues dashboard presentation candidate satisfies the complete seam', () => {
    checkCandidate(candidate);
});

test('anchored presentation, behavior and original-byte mutations are rejected', () => {
    const mutations = {
        missingStyle: s => replaceAnchor(s, style, ''),
        relocatedStyle: s => replaceAnchor(replaceAnchor(s, style + headEnd, headEnd), newBody, style + newBody),
        duplicateStyle: s => replaceAnchor(s, style, style + style),
        missingBodyClass: s => replaceAnchor(s, newBody, oldBody),
        extraBodyClass: s => replaceAnchor(s, newBody, `    <body class="${bodyClass} extra">`),
        bodyBehavior: s => replaceAnchor(s, newBody, `    <body class="${bodyClass}" onload="save()">`),
        printMedia: s => replaceAnchor(s, '@media screen {', '@media print {'),
        lostContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html', 5),
        popupContext: s => replaceAnchor(s, 'html.oe-workbench-context', 'html.oe-workbench-popup', 5),
        broadBody: s => replaceAnchor(s, `body.${bodyClass}`, 'body', 5),
        broadContainer: s => replaceAnchor(s, '> .oe-help-container', '.oe-help-container'),
        broadLink: s => replaceAnchor(s, 'a:not(.btn)', 'a'),
        semanticButton: s => replaceAnchor(s, 'a:not(.btn)', 'a:not(.btn), button'),
        canvasToken: s => replaceAnchor(s, 'var(--oe-wb-canvas, #f3f7f5)', '#f3f7f5'),
        paperToken: s => replaceAnchor(s, 'var(--oe-wb-paper, #fff)', '#fff', 2),
        inkToken: s => replaceAnchor(s, 'var(--oe-wb-ink, #17343b)', 'inherit', 5),
        missingHeadingOverride: s => replaceAnchor(s, 'background-color: var(--oe-wb-paper, #fff) !important;', 'background-color: var(--oe-wb-paper, #fff);'),
        missingRedirectOverride: s => replaceAnchor(s, 'color: var(--oe-wb-ink, #17343b) !important;', 'color: var(--oe-wb-ink, #17343b);'),
        extraImportant: s => replaceAnchor(s, 'background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'),
        layout: s => replaceAnchor(s, '    background-color: var(--oe-wb-canvas, #f3f7f5);', '    padding: 1rem;\n    background-color: var(--oe-wb-canvas, #f3f7f5);'),
        typography: s => replaceAnchor(s, '    background-color: var(--oe-wb-canvas, #f3f7f5);', '    font-family: Arial;\n    background-color: var(--oe-wb-canvas, #f3f7f5);'),
        extraIconRule: s => replaceAnchor(s, '  }\n}\n    </style>', `  }\n  ${scope} .fa { color: red; }\n}\n    </style>`),
        changedBootstrap: s => replaceAnchor(s, 'require_once("../../interface/globals.php");', 'require_once("../interface/globals.php");'),
        changedHeader: s => replaceAnchor(s, '<?php Header::setupHeader();?>', '<?php Header::setupHeader(["other"]);?>'),
        changedSection: s => replaceAnchor(s, 'id="section2"', 'id="section4"'),
        changedCodeAdvice: s => replaceAnchor(s, 'ICD10 code set is not installed', 'ICD10 code set is installed'),
        changedCcrAdvice: s => replaceAnchor(s, 'Continuity of Care Report (CCR)', 'Continuity of Care Report'),
        changedErxAdvice: s => replaceAnchor(s, 'Ensora MedEntry page', 'Issue page', 2),
        changedHistoryAdvice: s => replaceAnchor(s, 'link the newly added issue to encounters', 'delete the newly added issue'),
        changedWarningIcon: s => replaceAnchor(s, 'fa fa-exclamation-triangle  oe-text-red', 'fa fa-exclamation-triangle  oe-text-green'),
        changedSampleButton: s => replaceAnchor(s, 'btn-save btn-sm oe-no-float', 'btn-primary btn-sm oe-no-float', 5),
        changedLinkMetadata: s => replaceAnchor(s, 'rel="noopener" target="_blank"', 'target="_blank"'),
        changedRedirect: s => replaceAnchor(s, 'href="#"><i class="fa fa-arrow-circle-up', 'href="#section1"><i class="fa fa-arrow-circle-up', 5),
        changedContainer: s => replaceAnchor(s, '</div><!--end of container div-->', '</div>')
    };
    for (const [name, mutate] of Object.entries(mutations)) {
        const changed = mutate(candidate);
        assert.notDeepEqual(Buffer.from(changed), Buffer.from(candidate), name);
        assert.throws(() => checkCandidate(changed), assert.AssertionError, name);
    }
});

test('actual Issues caller, modal, header, shared controller and themes are pinned', () => {
    for (const [file, hash] of Object.entries(protectedHashes)) assert.equal(sha(read(file)), hash, file);
    const caller = read('interface/patient_file/summary/stats_full.php').toString();
    const included = read('interface/patient_file/summary/dashboard_header.php').toString();
    const twig = read('templates/patient/dashboard_header.html.twig').toString();
    const ui = read('src/OeUI/OemrUI.php').toString();
    const header = read('src/Core/Header.php').toString();
    const assets = read('config/config.yaml').toString();
    const popupCss = read('interface/clinical-workspace/popup.css').toString();
    const commonTheme = read('interface/themes/oe-common/help-files-common.scss').toString();
    const utilityTheme = read('interface/themes/colors/utilities/help-files.scss').toString();
    assert.match(caller, /\$pid = SessionWrapperFactory::getInstance\(\)->getActiveSession\(\)->get\('pid', 0\)/);
    assert.match(caller, /foreach \(\$ISSUE_TYPES as \$type => \$dummy\)[\s\S]*?AclMain::aclCheckIssue\(\$type\)[\s\S]*?if \(\$auth\) \{[\s\S]*?getPatientData\(\$pid, "squad"\)[\s\S]*?AclMain::aclCheckCore\('squads', \$tmp\['squad'\]\)[\s\S]*?AccessDeniedHelper::deny/);
    assert.match(caller, /AccessDeniedHelper::denyWithTemplate\("ACL check failed for issue types: Patient Issues"/);
    assert.match(caller, /'show_help_icon' => true,\s*'help_file_name' => "issues_dashboard_help\.php"/);
    assert.match(caller, /\$oemr_ui = new OemrUI\(\$arrOeUiSettings\)/);
    assert.match(caller, /summary\/dashboard_header\.php/);
    assert.match(caller, /\$oemr_ui->oeBelowContainerDiv\(\)/);
    assert.match(caller, /AclMain::aclCheckIssue\(\$t, '', \['write', 'addonly'\]\)/);
    assert.match(caller, /erx_enable[\s\S]*?newcrop_user_role[\s\S]*?eRx\.php\?page=medentry/);
    assert.match(caller, /erx_patient_portal_js\.php/);
    assert.match(caller, /lists_touch\.php[\s\S]*?csrf_token_form/);
    assert.match(caller, /'expandable' => true,\s*'expandable_files' => \["stats_full_patient_xpd", "external_data_patient_xpd", "patient_ledger_patient_xpd"\]/);
    assert.match(included, /'pageHeading' => isset\(\$oemr_ui\) \? \$oemr_ui->pageHeading\(\) : ''/);
    assert.equal(twig, '{{ pageHeading }}\n');
    assert.match(ui, /get\('enable_help'\) !== 0 && \$this->display_help_icon/);
    assert.match(ui, /get\('enable_help'\) == "1"[\s\S]*?get\('enable_help'\) == "2"/);
    assert.match(ui, /'data-target' => "#myModal",\s*'data-toggle' => 'modal'/);
    assert.match(ui, /\$this->display_help_icon \? \$this->helpFileModal\(\) : ''/);
    assert.match(ui, /\$this->expandable \? \$this->headerExpandJs\(\) : ''/);
    assert.match(ui, /headerExpandJs\([\s\S]*?user_settings\.php[\s\S]*?csrf_token_form/);
    assert.match(ui, /<iframe src='' data-src='\$help_file' id='targetiframe'/);
    assert.match(ui, /<div class="modal fade" id="myModal"/);
    assert.doesNotMatch(ui, /class="[^"]*\bdialogModal\b/);
    assert.match(header, /setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
    assert.match(assets, /workbench-popup:[\s\S]*?script: popup\.js[\s\S]*?link: popup\.css[\s\S]*?autoload: true/);
    for (const [token, value] of [['ink', '#17343b'], ['paper', '#fff'], ['canvas', '#f3f7f5']]) {
        assert.ok(popupCss.includes(`--oe-wb-${token}: ${value};`));
    }
    assert.match(commonTheme, /\.oe-help-container a:not\(\.btn\)/);
    assert.match(utilityTheme, /\.oe-help-redirect[\s\S]*?color: \$darker !important;[\s\S]*?\.oe-help-heading[\s\S]*?background-color: \$palepale !important;/);
});

test('source-derived OemrUI first click assigns the Issues help iframe only once', () => {
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
        data(name) { assert.equal(name, 'src'); return '/Documentation/help_files/issues_dashboard_help.php'; }
    };
    const $ = target => target === document ? { on(event, selector, callback) {
        assert.equal(event, 'click'); assert.equal(selector, '#help-href'); listener = callback;
    } } : (assert.equal(target, '#targetiframe'), iframe);
    vm.runInNewContext(ui.slice(begin, finish + end.length), { document, $ }, { filename: 'OemrUI-help-click.js' });
    assert.equal(typeof listener, 'function');
    assert.equal(src, '');
    listener(); listener();
    assert.equal(src, '/Documentation/help_files/issues_dashboard_help.php');
    assert.equal(writes, 1);
});

function classList(initial = []) {
    const classes = new Set(initial);
    return { contains: value => classes.has(value), add: value => classes.add(value),
        remove: value => classes.delete(value), values: () => [...classes] };
}

function popupWindow({ active = false, shell = false, parent = null, origin = 'https://openemr.test', frame = false } = {}) {
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

test('shared controller gives ordinary nested Issues iframe context only and cleans up', () => {
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
    shell.body.classList.remove('workbench-active'); shell.doc.observerCallback();
    assert.deepEqual(help.html.classList.values(), []);
    shell.body.classList.add('workbench-active'); shell.doc.observerCallback();
    assert.deepEqual(help.html.classList.values(), ['oe-workbench-context']);
    help.listeners.pagehide();
    assert.deepEqual(help.html.classList.values(), []);
    assert.equal(shell.doc.disconnected, true);

    const shared = read('interface/clinical-workspace/popup.js').toString();
    const broken = replaceAnchor(shared,
        'let current = parentWindow && parentWindow !== self ? parentWindow : null;',
        'let current = null;');
    const otherShell = popupWindow({ active: true, shell: true });
    const otherContent = popupWindow({ parent: otherShell.win, frame: true });
    const otherHelp = popupWindow({ parent: otherContent.win, frame: true });
    vm.runInNewContext(broken, { window: otherHelp.win, Set }, { filename: 'broken-popup.js' });
    assert.deepEqual(otherHelp.html.classList.values(), [], 'broken parent traversal loses context');
});

test('shared controller leaves standalone, legacy and cross-origin help inert', () => {
    const standalone = popupWindow(); activate(standalone.win);
    assert.deepEqual(standalone.html.classList.values(), []);
    const legacy = popupWindow({ shell: true });
    const legacyHelp = popupWindow({ parent: legacy.win, frame: true }); activate(legacyHelp.win);
    assert.deepEqual(legacyHelp.html.classList.values(), []);
    const foreign = popupWindow({ active: true, origin: 'https://other.test' });
    const foreignHelp = popupWindow({ parent: foreign.win, frame: true }); activate(foreignHelp.win);
    assert.deepEqual(foreignHelp.html.classList.values(), []);
});

if (process.argv.includes('--history')) {
    test('mandatory authentic Git base and exact authorized five-file scope', () => {
        assert.deepEqual(original, execFileSync('git', ['show', `${base}:${route}`], { cwd: root }));
        const paths = args => execFileSync('git', args, { cwd: root }).toString().split('\0').filter(Boolean);
        const committed = paths(['diff', '--name-only', '-z', base, 'HEAD']);
        const dirty = paths(['diff', '--name-only', '-z', 'HEAD']);
        const untracked = paths(['ls-files', '--others', '--exclude-standard', '-z']);
        const allowed = new Set([route, fixture, contract, adapter, doc]);
        for (const file of [...new Set([...committed, ...dirty, ...untracked])]) {
            assert.ok(allowed.has(file), `out-of-scope changed file: ${file}`);
        }
    });
}

test('live Issues route has the exact approved presentation seam', () => {
    const live = read(route).toString('utf8');
    assert.notEqual(live, plain, 'missing presentation: route still equals original fixture');
    checkCandidate(live);
});
