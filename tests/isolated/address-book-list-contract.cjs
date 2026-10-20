'use strict';
/*
 * OPEMR-73 address book list, dependency-free node:test contract.
 * Portable: node --test tests/isolated/address-book-list-contract.cjs
 * History:  node tests/isolated/address-book-list-contract.cjs --history
 *
 * The fixture is the entire original PHP route. Only one exact screen style block
 * and one body class may be added. These are source checks, not browser paint,
 * descendant/control effective contrast, geometry or native acceptance.
 * The controller runs the genuine RED.
 */

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test } = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const ROUTE = 'interface/usergroup/addrbook_list.php';
const FIXTURE = 'tests/fixtures/address-book-list-original.php.txt';
const POPUP_JS = 'interface/clinical-workspace/popup.js';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const WIDGET = 'interface/super/edit_globals.js';
const FAX = 'interface/modules/custom_modules/oe-module-faxsms/contact.php';
const HEADER = 'src/Core/Header.php';
const CONFIG = 'config/config.yaml';
const BASE = '18647270e0c799189d2dc10f801e8de2bff1a360';
const FIXTURE_SHA256 = 'b52b51e95aee3c1fd76ccca75a98c7c7245a6272da517afcd6f52c8cfb4680fa';
const HISTORY = process.argv.includes('--history');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const count = (source, part) => source.split(part).length - 1;
const original = read(FIXTURE);

const GATE = 'html.oe-workbench-context body.oe-address-book-list';
const BODY_OLD = '<body class="body_top">';
const BODY_NEW = '<body class="body_top oe-address-book-list">';
const CSS = [
    '@media screen {',
    `  ${GATE} {`,
    '    color: #26383d;',
    '    background-color: #f5f2ed !important;',
    '  }',
    '',
    `  ${GATE} .body_title {`,
    '    color: #26383d;',
    '    background-color: #fffefa;',
    '  }',
    '',
    `  ${GATE} .table {`,
    '    color: #26383d;',
    '    background-color: #fffefa;',
    '  }',
    '}',
].join('\n');
const STYLE = `    <style>\n${CSS}\n    </style>\n`;
const HEAD_OLD = '</head>\n\n<body class="body_top">';
const HEAD_NEW = `${STYLE}</head>\n\n<body class="body_top">`;

function insert(source) {
    assert.equal(count(source, HEAD_OLD), 1, 'head anchor');
    assert.equal(count(source, BODY_OLD), 1, 'body anchor');
    return source.replace(HEAD_OLD, HEAD_NEW).replace(BODY_OLD, BODY_NEW);
}

function restore(source) {
    if (count(source, STYLE) !== 1 || count(source, BODY_NEW) !== 1) return null;
    const withoutStyle = source.replace(STYLE, '');
    return withoutStyle.replace(BODY_NEW, BODY_OLD);
}

function verify(source, fixture = original) {
    const errors = [];
    if (count(source, STYLE) !== 1) errors.push('one exact style block required');
    if (count(source, BODY_NEW) !== 1) errors.push('one exact body marker required');
    if (count(source, '<style>') !== 1 || count(source, '</style>') !== 1) errors.push('one style pair required');
    if (count(source, 'oe-address-book-list') !== 4) errors.push('marker must occur in three selectors and body only');
    const head = source.indexOf(STYLE);
    if (head < 0 || source.slice(head + STYLE.length, head + STYLE.length + 7) !== '</head>') {
        errors.push('style must immediately precede the closing head');
    }
    if (count(CSS, '!important') !== 1 || count(source.slice(Math.max(head, 0), head + STYLE.length), '!important') !== 1) {
        errors.push('body background is the sole important declaration');
    }
    if (count(CSS, GATE) !== 3 || count(CSS, '@media screen') !== 1) errors.push('screen-only scoped rules required');
    const restored = restore(source);
    if (restored === null || restored !== fixture) errors.push('entire source inverse differs from original fixture');
    return errors;
}

const synthetic = insert(original);

describe('fixture and exact presentation contract (portable)', () => {
    test('nonexecuting fixture is the pinned complete original route', () => {
        assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, FIXTURE))).digest('hex'), FIXTURE_SHA256);
        assert.ok(original.startsWith('<?php\n'));
        assert.ok(original.endsWith('</html>\n'));
        assert.equal(count(original, BODY_OLD), 1);
        assert.equal(count(original, '<style>'), 0);
    });

    test('positive synthetic candidate accepts only the specified additions', () => {
        assert.deepEqual(verify(synthetic), []);
        assert.equal(restore(synthetic), original);
        assert.equal(count(synthetic, '@media screen'), 1);
        assert.equal(count(synthetic, '!important'), 1);
        assert.ok(synthetic.includes('<div style="margin-top: 110px;" class="table-responsive">'));
    });

    test('the three CSS selectors and six colour declarations are the whole block', () => {
        assert.deepEqual(CSS.match(/(?<=  )html\.oe-workbench-context body\.oe-address-book-list(?: \.body_title| \.table)?(?= \{)/g), [
            GATE, `${GATE} .body_title`, `${GATE} .table`,
        ]);
        const declarationLines = CSS.split('\n').filter((line) => /^    [\w-]+:/.test(line));
        assert.deepEqual(declarationLines, [
            '    color: #26383d;',
            '    background-color: #f5f2ed !important;',
            '    color: #26383d;',
            '    background-color: #fffefa;',
            '    color: #26383d;',
            '    background-color: #fffefa;',
        ]);
        assert.equal((CSS.match(/!important/g) || []).length, 1);
    });
});

describe('negative mutations (portable)', () => {
    const replace = (from, to) => {
        assert.equal(count(synthetic, from), 1, `unique mutation anchor: ${from}`);
        return synthetic.replace(from, to);
    };
    const mutations = [
        ['body marker removed', replace(BODY_NEW, BODY_OLD)],
        ['body marker renamed', replace(BODY_NEW, '<body class="body_top oe-address-list">')],
        ['body marker duplicated', replace(BODY_NEW, `${BODY_NEW}\n<!-- oe-address-book-list -->`)],
        ['style block duplicated', replace(STYLE, STYLE + STYLE)],
        ['style block moved after head', replace(STYLE + '</head>', '</head>\n' + STYLE)],
        ['style block missing closing tag', replace('    </style>\n', '')],
        ['style block uses print too', replace('@media screen {', '@media screen, print {')],
        ['style block loses media wrapper', replace('@media screen {', '@media all {')],
        ['selector loses context class', replace(`  ${GATE} .table {`, '  body.oe-address-book-list .table {')],
        ['selector widens to generic popup', replace(`  ${GATE} .body_title {`, '  html.oe-workbench-popup .body_title {')],
        ['header selector misses real class', replace(`  ${GATE} .body_title {`, `  ${GATE} .title {`)],
        ['table selector misses table', replace(`  ${GATE} .table {`, `  ${GATE} .table-responsive {`)],
        ['canvas colour drift', replace('background-color: #f5f2ed !important;', 'background-color: #f3f7f5 !important;')],
        ['ink colour drift', replace('    color: #26383d;\n    background-color: #f5f2ed', '    color: #26383c;\n    background-color: #f5f2ed')],
        ['paper colour drift', replace('background-color: #fffefa;\n  }\n\n  ' + GATE + ' .table', 'background-color: #ffffff;\n  }\n\n  ' + GATE + ' .table')],
        ['body important removed', replace('background-color: #f5f2ed !important;', 'background-color: #f5f2ed;')],
        ['header important added', replace(`${GATE} .body_title {\n    color: #26383d;`, `${GATE} .body_title {\n    color: #26383d !important;`)],
        ['geometry changed', replace('margin-top: 110px;', 'margin-top: 120px;')],
        ['font changed', replace(`${GATE} {\n    color: #26383d;`, `${GATE} {\n    font-size: 14px;\n    color: #26383d;`)],
        ['input painted', replace(`${GATE} .table {`, `${GATE} input { color: #26383d; }\n  ${GATE} .table {`)],
        ['button painted', replace(`${GATE} .table {`, `${GATE} .btn-primary { background: #fffefa; }\n  ${GATE} .table {`)],
        ['semantic row painted', replace(`${GATE} .table {`, `${GATE} .table .text-danger { color: #26383d; }\n  ${GATE} .table {`)],
        ['hover painted', replace(`${GATE} .table {`, `${GATE} .table-hover tr:hover { background: #fffefa; }\n  ${GATE} .table {`)],
        ['wrapper inserted', replace('<div class="container-fluid">', '<div class="new-wrapper"><div class="container-fluid">')],
        ['asset added', replace("Header::setupHeader(['common']);", "Header::setupHeader(['common', 'workbench-popup']);")],
        ['ACL changed', replace("if (!AclMain::aclCheckCore('admin', 'practice')) {", "if (!AclMain::aclCheckCore('admin', 'users')) {")],
        ['CSRF removed', replace('    CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);\n', '')],
        ['SQL filter changed', replace('AND u.organization LIKE ? ', 'AND u.organization = ? ')],
        ['SQL limit changed', replace(' LIMIT 500', ' LIMIT 100')],
        ['escaping changed', replace("text($row['email'])", "$row['email']")],
        ['add callback changed', replace('doedclick_add(document.forms[0].form_abook_type.value)', 'doedclick_add(0)')],
        ['selection callback changed', replace("dlgclose('contactCallBack', userid);", 'dlgclose();')],
        ['popup sizing changed', replace("dlgopen(url, '_blank', 650, (screen.availHeight * 75/100));", "dlgopen(url, '_blank', 700, 500);")],
        ['form action changed', replace("action='addrbook_list.php'", "action='other.php'")],
        ['table class changed', replace('class="table table-sm table-bordered table-striped table-hover"', 'class="table table-sm table-bordered"')],
    ];
    for (const [label, source] of mutations) {
        test(`rejects ${label}`, () => {
            assert.notEqual(source, synthetic);
            assert.ok(verify(source).length > 0, `${label} escaped the contract`);
        });
    }
});

describe('real caller and shared asset source chain (portable)', () => {
    test('AddressBookWidget opens the popup=2 selection dialog at modal-lg by 500', () => {
        const widget = read(WIDGET);
        const start = widget.indexOf('class AddressBookWidget');
        const end = widget.indexOf('oeUI.addressBookWidget =', start);
        assert.ok(start > 0 && end > start);
        const segment = widget.slice(start, end);
        assert.ok(segment.includes("'/interface/usergroup/addrbook_list.php?popup=2'"));
        assert.ok(segment.includes("dlgopen('', '', 'modal-lg', 500, '', '', {"));
        assert.ok(segment.includes("dialogId: 'globals-edit'"));
        assert.ok(segment.includes("window['contactCallBack'] = (userid) =>"));
        assert.ok(segment.includes('input.value = userid;'));
    });

    test('fax contact caller uses the same selection route and callback', () => {
        const fax = read(FAX);
        assert.ok(fax.includes('function contactCallBack(contact) {'));
        assert.ok(fax.includes("'/interface/usergroup/addrbook_list.php?popup=2&type=' + encodeURIComponent(serviceType)"));
        assert.ok(fax.includes("dialogId: 'fax'"));
        assert.ok(fax.includes("sizeHeight: 'full'"));
        assert.ok(original.includes("dlgclose('contactCallBack', userid);"));
    });

    test('Header common setup autoloads the unchanged shared popup assets', () => {
        assert.ok(original.includes("<?php Header::setupHeader(['common']); ?>"));
        const header = read(HEADER);
        assert.ok(header.includes('$output .= self::setupAssets(is_array($assets) ? $assets : [$assets], true);'));
        assert.ok(header.includes('$map = self::readConfigFile($projectDir . "/config/config.yaml");'));
        assert.match(read(CONFIG), /\n {2}workbench-popup:\n {4}basePath: '%webroot%\/interface\/clinical-workspace\/'\n {4}script: popup\.js\n {4}link: popup\.css\n {4}autoload: true\n/);
        assert.ok(read(POPUP_CSS).includes('html.oe-workbench-context'));
        assert.equal(count(synthetic, 'workbench-popup'), 0);
    });

    test('original list keeps the fixed header, table offset, filters and add/edit dimensions', () => {
        for (const snippet of [
            'class="nav navbar-fixed-top body_title"',
            'style="margin-top: 110px;" class="table-responsive"',
            'class="table table-sm table-bordered table-striped table-hover"',
            "name='form_organization'", "name='form_fname'", "name='form_lname'",
            "name='form_specialty'", "name='form_npi'", 'form_abook_type',
            "name='form_external'", 'CsrfUtils::checkCsrfInput(INPUT_POST, dieOnFail: true);',
            "dlgopen(url, '_blank', 650, (screen.availHeight * 75/100));",
            "dlgopen('addrbook_edit.php?userid=' + encodeURIComponent(userid), '_blank', 650, (screen.availHeight * 75/100));",
        ]) assert.ok(original.includes(snippet), snippet);
    });
});

// The unmodified production popup.js runs in a VM with minimal same-origin window
// stand-ins. This checks class activation and cleanup only, never CSS layout or paint.
describe('real popup.js workbench context (portable VM)', () => {
    const ORIGIN = 'https://emr.test';
    const popupSource = read(POPUP_JS);
    function element(doc, classes = []) {
        const values = new Set(classes);
        const el = { ownerDocument: doc, observers: [] };
        const changed = () => el.observers.slice().forEach((observer) => observer.schedule());
        el.classList = {
            contains: (name) => values.has(name),
            add: (...names) => { names.forEach((name) => values.add(name)); changed(); },
            remove: (...names) => { names.forEach((name) => values.delete(name)); changed(); },
            values: () => [...values],
        };
        return el;
    }
    function windowFor({ parent, opener = null, frameElement = null, shellRoot = false, active = false, marker = false, origin = ORIGIN } = {}) {
        const win = { closed: false, location: { origin }, opener, frameElement, listeners: {}, observations: [] };
        const doc = {
            defaultView: win, readyState: 'complete', listeners: {},
            querySelector: (selector) => selector === '#mainBox [data-workbench-mode]' && shellRoot ? {} : null,
            addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
            removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((value) => value !== fn); },
        };
        doc.documentElement = element(doc);
        doc.body = element(doc, active ? ['workbench-active'] : marker ? ['body_top', 'oe-address-book-list'] : ['body_top']);
        win.document = doc;
        win.parent = parent || win;
        win.addEventListener = (type, fn) => { (win.listeners[type] ||= []).push(fn); };
        win.dispatch = (type, event = {}) => (win.listeners[type] || []).slice().forEach((fn) => fn(event));
        win.MutationObserver = class {
            constructor(callback) { this.callback = callback; this.targets = []; this.pending = false; }
            observe(target, options) {
                win.observations.push({ attributes: options.attributes, filter: Array.from(options.attributeFilter) });
                target.observers.push(this);
                this.targets.push(target);
            }
            disconnect() {
                for (const target of this.targets) target.observers = target.observers.filter((observer) => observer !== this);
                this.targets = [];
            }
            schedule() {
                if (this.pending) return;
                this.pending = true;
                queueMicrotask(() => { this.pending = false; if (this.targets.length) this.callback([], this); });
            }
        };
        return win;
    }
    const frame = { closest: (selector) => selector === '.dialogModal' ? {} : null };
    const boot = (win) => { win.window = win; vm.runInContext(popupSource, vm.createContext(win), { filename: POPUP_JS }); return win; };
    const classes = (win) => win.document.documentElement.classList.values().sort();
    const gate = (win) => win.document.documentElement.classList.contains('oe-workbench-context') && win.document.body.classList.contains('oe-address-book-list');
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    test('dialog frame finds the active parent shell and activates the list gate', () => {
        const shell = windowFor({ shellRoot: true, active: true });
        const child = boot(windowFor({ parent: shell, frameElement: frame, marker: true }));
        assert.deepEqual(classes(child), ['oe-workbench-context', 'oe-workbench-popup']);
        assert.equal(gate(child), true);
        assert.deepEqual(shell.observations, [{ attributes: true, filter: ['class'] }]);
    });

    test('legacy shell transition activates then removes only owned classes', async () => {
        const shell = windowFor({ shellRoot: true });
        const child = boot(windowFor({ parent: shell, frameElement: frame, marker: true }));
        assert.deepEqual(classes(child), []);
        shell.document.body.classList.add('workbench-active');
        await flush();
        assert.equal(gate(child), true);
        shell.document.body.classList.remove('workbench-active');
        await flush();
        assert.deepEqual(classes(child), []);
        assert.deepEqual(child.document.body.classList.values(), ['body_top', 'oe-address-book-list']);
    });

    test('pagehide disconnects and leaves body and callbacks untouched', async () => {
        const shell = windowFor({ shellRoot: true, active: true });
        const child = windowFor({ parent: shell, frameElement: frame, marker: true });
        let calls = 0;
        child.dlgclose = () => { calls++; };
        child.refreshme = () => { calls++; };
        boot(child);
        child.dispatch('pagehide');
        assert.deepEqual(classes(child), []);
        shell.document.body.classList.remove('workbench-active');
        shell.document.body.classList.add('workbench-active');
        await flush();
        assert.deepEqual(classes(child), []);
        assert.equal(calls, 0);
        assert.deepEqual(child.document.body.classList.values(), ['body_top', 'oe-address-book-list']);
    });

    test('cross-origin parent and missing body marker cannot activate the gate', () => {
        const foreign = windowFor({ shellRoot: true, active: true, origin: 'https://other.test' });
        assert.equal(gate(boot(windowFor({ parent: foreign, frameElement: frame, marker: true }))), false);
        const shell = windowFor({ shellRoot: true, active: true });
        assert.equal(gate(boot(windowFor({ parent: shell, frameElement: frame }))), false);
    });
});

describe('production route (portable)', () => {
    test('the synthetic candidate passes; live route carries exactly that presentation', () => {
        assert.deepEqual(verify(synthetic), []);
        assert.deepEqual(verify(read(ROUTE)), []);
    });
});

if (HISTORY) {
    describe('mandatory pinned-base history (--history)', () => {
        const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
        test('the exact base commit exists and is an ancestor of HEAD', () => {
            const rev = git(['rev-parse', '--verify', `${BASE}^{commit}`]);
            assert.equal(rev.error, undefined, 'git unavailable');
            assert.equal(rev.status, 0, String(rev.stderr));
            assert.equal(String(rev.stdout).trim(), BASE);
            const ancestor = git(['merge-base', '--is-ancestor', BASE, 'HEAD']);
            assert.equal(ancestor.status, 0, 'HEAD does not descend from pinned base');
        });
        test('fixture equals exact Git base bytes and whole-source inverse', () => {
            const shown = git(['show', `${BASE}:${ROUTE}`]);
            assert.equal(shown.error, undefined, 'git unavailable');
            assert.equal(shown.status, 0, String(shown.stderr));
            assert.deepEqual(fs.readFileSync(path.join(ROOT, FIXTURE)), shown.stdout);
            const restored = restore(read(ROUTE));
            assert.notEqual(restored, null, 'production presentation absent or malformed');
            assert.deepEqual(Buffer.from(restored), shown.stdout);
        });
    });
}
