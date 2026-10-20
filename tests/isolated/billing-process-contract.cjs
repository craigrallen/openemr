'use strict';
/* OPEMR-76 source contract. The controller owns the first genuine RED run.
 * Portable: node --test tests/isolated/billing-process-contract.cjs
 * Pinned Git provenance: append --history. Never include or execute the PHP route. */

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test } = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '18647270e0c799189d2dc10f801e8de2bff1a360';
const ROUTE = 'interface/billing/billing_process.php';
const FIXTURE = 'tests/fixtures/billing-process-original.php.txt';
const CALLER = 'interface/billing/billing_report.php';
const HEADER = 'src/Core/Header.php';
const CONFIG = 'config/config.yaml';
const POPUP_JS = 'interface/clinical-workspace/popup.js';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const HISTORY = process.argv.includes('--history');
const FROZEN = {
    [CALLER]: '638c728deeccbdbd22ca624aa396cf71cc0141d5ad621ca6b91e2f7d306bcbfe',
    [HEADER]: 'dee3fd5f35bfd900ed119ae45981142ed737dac48059e54cacb4af843d6d264d',
    [CONFIG]: '5f99c981f570a2f94917d68a4abcedf086eb75a102364bf71f1cb44ccfe461b7',
    [POPUP_JS]: 'af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f',
    [POPUP_CSS]: 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9',
};
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const bytes = (file) => fs.readFileSync(path.join(ROOT, file));
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
const count = (source, part) => source.split(part).length - 1;
const original = read(FIXTURE);
const BODY_OLD = '<body>';
const BODY_NEW = '<body class="oe-billing-process">';
const GATE = 'html.oe-workbench-context body.oe-billing-process';
const STYLE = [
    '<style>',
    '@media screen {',
    `  ${GATE} {`,
    '    color: var(--oe-wb-ink, #17343b);',
    '    background-color: var(--oe-wb-canvas, #f3f7f5) !important;',
    '  }',
    '',
    `  ${GATE} > .container {`,
    '    color: var(--oe-wb-ink, #17343b);',
    '    background-color: var(--oe-wb-paper, #fff);',
    '  }',
    '}',
    '</style>',
].map((line) => line ? `    ${line}` : '').join('\n') + '\n';
const HEAD_OLD = '    <?php Header::setupHeader(); ?>\n';
const HEAD_NEW = HEAD_OLD + STYLE;

function insert(source) {
    assert.equal(count(source, HEAD_OLD), 1, 'unique Header anchor');
    assert.equal(count(source, BODY_OLD), 1, 'unique body anchor');
    return source.replace(HEAD_OLD, HEAD_NEW).replace(BODY_OLD, BODY_NEW);
}
function restore(source) {
    if (count(source, STYLE) !== 1 || count(source, BODY_NEW) !== 1) return null;
    return source.replace(STYLE, '').replace(BODY_NEW, BODY_OLD);
}
function verify(source) {
    const errors = [];
    if (count(source, STYLE) !== 1) errors.push('exact style required once');
    if (count(source, BODY_NEW) !== 1) errors.push('exact body marker required once');
    if (count(source, '<style>') !== 1 || count(source, '</style>') !== 1) errors.push('one style pair required');
    if (count(source, 'oe-billing-process') !== 3) errors.push('marker must occur only in body and two selectors');
    if (!source.includes(HEAD_NEW) || !source.includes('</head>\n' + BODY_NEW)) errors.push('exact placement required');
    if (restore(source) !== original) errors.push('full inverse differs from original');
    return errors;
}
const synthetic = insert(original);

describe('portable whole-source presentation contract', () => {
    test('fixture is byte-exact baseline', () => {
        assert.equal(bytes(FIXTURE).length, 2357);
        assert.equal(sha(bytes(FIXTURE)), '289a1ac77c094e74f8379c0530a2e69a07311a0fd57c2533585ded35003fc673');
        assert.equal(count(original, HEAD_OLD), 1);
        assert.equal(count(original, BODY_OLD), 1);
        assert.equal(count(original, '<style>'), 0);
    });
    test('synthetic candidate passes and inverts to every original byte', () => {
        assert.deepEqual(verify(synthetic), []);
        assert.deepEqual(Buffer.from(restore(synthetic)), bytes(FIXTURE));
    });
    test('original has exactly the intended missing presentation', () => {
        assert.deepEqual(verify(original), [
            'exact style required once', 'exact body marker required once',
            'one style pair required', 'marker must occur only in body and two selectors',
            'exact placement required', 'full inverse differs from original',
        ]);
    });
    test('screen palette is limited to the body and direct container', () => {
        assert.equal(count(STYLE, '@media screen {'), 1);
        assert.equal(count(STYLE, GATE), 2);
        assert.equal(count(STYLE, '!important'), 1);
        assert.deepEqual(STYLE.split('\n').filter((line) => /^        [\w-]+:/.test(line)), [
            '        color: var(--oe-wb-ink, #17343b);',
            '        background-color: var(--oe-wb-canvas, #f3f7f5) !important;',
            '        color: var(--oe-wb-ink, #17343b);',
            '        background-color: var(--oe-wb-paper, #fff);',
        ]);
        assert.ok(STYLE.includes(`${GATE} > .container {`));
        // The shared popup.css paper body rule is unimportant; the sole important
        // canvas declaration ensures this narrower page wins across theme order.
        assert.match(read(POPUP_CSS), /html\.oe-workbench-popup body \{\s*color: var\(--oe-wb-ink\);\s*background-color: var\(--oe-wb-paper\);/);
    });
});

describe('uniquely anchored negative mutations', () => {
    function changed(from, to) {
        assert.equal(count(synthetic, from), 1, `unique anchor: ${from}`);
        const candidate = synthetic.replace(from, to);
        assert.notEqual(candidate, synthetic);
        return candidate;
    }
    const mutations = [
        ['marker absent', changed(BODY_NEW, BODY_OLD)],
        ['marker moved', changed(BODY_NEW, '<body class="other oe-billing-process">')],
        ['marker duplicated', changed(BODY_NEW, BODY_NEW + '<!-- oe-billing-process -->')],
        ['marker unscoped', changed(`  ${GATE} > .container {`, '  body.oe-billing-process > .container {')],
        ['style duplicated', changed(STYLE, STYLE + STYLE)],
        ['style moved', changed(STYLE + '    <script>', '    <script>\n' + STYLE)],
        ['style malformed', changed('    </style>\n', '')],
        ['style unscoped', changed(`  ${GATE} {`, '  body.oe-billing-process {')],
        ['print scope', changed('@media screen {', '@media screen, print {')],
        ['all media', changed('@media screen {', '@media all {')],
        ['print override', changed('    </style>\n', '    @media print { body { color: red; } }\n    </style>\n')],
        ['descendant container', changed(`${GATE} > .container {`, `${GATE} .container {`)],
        ['canvas token', changed('#f3f7f5) !important', '#f1f7f5) !important')],
        ['paper token', changed('#fff);', '#fafafa);')],
        ['ink token', changed('color: var(--oe-wb-ink, #17343b);\n        background-color: var(--oe-wb-canvas', 'color: var(--oe-wb-ink, #17343a);\n        background-color: var(--oe-wb-canvas')],
        ['body important removed', changed('#f3f7f5) !important;', '#f3f7f5);')],
        ['container important leaked', changed('background-color: var(--oe-wb-paper, #fff);', 'background-color: var(--oe-wb-paper, #fff) !important;')],
        ['font', changed(`${GATE} > .container {`, `${GATE} > .container {\n        font-size: 14px;`)],
        ['geometry', changed(`${GATE} > .container {`, `${GATE} > .container {\n        padding: 2rem;`)],
        ['extra asset', changed('Header::setupHeader();', "Header::setupHeader('billing-theme');")],
        ['ACL eob', changed("'acct', 'eob', '', 'write'", "'acct', 'eob', '', 'read'")],
        ['ACL bill', changed("'acct', 'bill', '', 'write'", "'acct', 'bill', '', 'read'")],
        ['ACL operator', changed("    && !AclMain::aclCheckCore", "    || !AclMain::aclCheckCore")],
        ['CSRF method', changed('checkCsrfInput(INPUT_POST, dieOnFail: true)', 'checkCsrfInput(INPUT_GET, dieOnFail: true)')],
        ['CSRF fail mode', changed('checkCsrfInput(INPUT_POST, dieOnFail: true)', 'checkCsrfInput(INPUT_POST, dieOnFail: false)')],
        ['POST data', changed('new BillingProcessor($_POST)', 'new BillingProcessor($_GET)')],
        ['execute', changed('$billingProcessor->execute()', '$billingProcessor->preview()')],
        ['execute order', changed('$logger = $billingProcessor->execute();\n?>', '?>\n<?php $logger = $billingProcessor->execute(); ?>')],
        ['logger source', changed('$logger->bill_info()', '$logger->error_info()')],
        ['escaping', changed('nl2br(text($infoline))', 'nl2br($infoline)')],
        ['completion', changed('$logger->onLogComplete();', '$logger->onLogStart();')],
        ['completion order', changed('</html>\n<?php\n$logger->onLogComplete();', '<?php\n$logger->onLogComplete();\n?>\n</html>\n<?php')],
        ['close control', changed('window.close();', 'window.print();')],
        ['result heading', changed("xlt('Billing queue results')", "xlt('Billing process')")],
    ];
    for (const [label, source] of mutations) {
        test(`rejects ${label}`, () => assert.ok(verify(source).length > 0, label));
    }
});

describe('frozen caller and autoload path', () => {
    test('full caller, Header, config, and popup assets retain pinned bytes', () => {
        for (const [file, digest] of Object.entries(FROZEN)) assert.equal(sha(bytes(file)), digest, file);
        const caller = read(CALLER);
        assert.match(caller, /<form class="form-inline" name='update_form' method='post' action='billing_process\.php'>/);
        assert.match(caller, /name="bn_external"/);
        assert.match(caller, /name="bn_mark"/);
        assert.match(caller, /name="bn_reopen"/);
        assert.match(caller, /var clickedButton = \$\("button\[type=submit\]\[data-clicked='true'"\)\[0\];/);
        assert.match(caller, /window\.open\('about:blank', 'Popup_Window',/);
        assert.match(caller, /this\.target = 'Popup_Window';/);
        assert.match(caller, /\$\(this\)\.removeAttr\("target"\);/);
        assert.match(read(HEADER), /self::setupAssets\(is_array\(\$assets\) \? \$assets : \[\$assets\], true\)/);
        assert.match(read(CONFIG), /workbench-popup:\n    basePath: '%webroot%\/interface\/clinical-workspace\/'\n    script: popup\.js\n    link: popup\.css\n    autoload: true/);
        for (const token of ['--oe-wb-ink: #17343b;', '--oe-wb-paper: #fff;', '--oe-wb-canvas: #f3f7f5;']) assert.ok(read(POPUP_CSS).includes(token));
        assert.equal(count(synthetic, 'popup.js'), 0);
    });
    test('caller drift is detectable without running the form', () => {
        const caller = read(CALLER);
        const anchor = "this.target = 'Popup_Window';";
        assert.equal(count(caller, anchor), 1);
        const changedCaller = caller.replace(anchor, "this.target = '_blank';");
        assert.notEqual(changedCaller, caller);
        assert.notEqual(sha(changedCaller), FROZEN[CALLER]);
    });
});

// Actual unchanged popup.js in synthetic windows. This tests the feasible
// same-origin ancestry path, not native popup reuse or COOP behavior.
describe('real popup.js and workbench ancestry', () => {
    const ORIGIN = 'https://emr.test';
    function element(doc, classes = []) {
        const values = new Set(classes);
        const el = { ownerDocument: doc, observers: [] };
        const notify = () => el.observers.slice().forEach((observer) => observer.schedule());
        el.classList = {
            contains: (name) => values.has(name),
            add: (...names) => { names.forEach((name) => values.add(name)); notify(); },
            remove: (...names) => { names.forEach((name) => values.delete(name)); notify(); },
            values: () => [...values],
        };
        return el;
    }
    function windowFor({ parent = null, opener = null, shell = false, active = false, marker = false, origin = ORIGIN } = {}) {
        const win = { closed: false, location: { origin }, opener, frameElement: null, listeners: [], observations: [] };
        const doc = {
            defaultView: win, readyState: 'complete',
            querySelector: (selector) => selector === '#mainBox [data-workbench-mode]' && shell ? {} : null,
            addEventListener() {}, removeEventListener() {},
        };
        doc.documentElement = element(doc);
        doc.body = element(doc, [...(active ? ['workbench-active'] : []), ...(marker ? ['oe-billing-process'] : [])]);
        win.document = doc;
        win.parent = parent || win;
        win.addEventListener = (type, fn) => win.listeners.push([type, fn]);
        win.dispatch = (type) => win.listeners.filter(([name]) => name === type).forEach(([, fn]) => fn({}));
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
    const boot = (win) => { win.window = win; vm.runInContext(read(POPUP_JS), vm.createContext(win), { filename: POPUP_JS }); return win; };
    const classes = (win) => win.document.documentElement.classList.values().sort();
    const gate = (win) => win.document.documentElement.classList.contains('oe-workbench-context') && win.document.body.classList.contains('oe-billing-process');
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    test('billing frame opener reaches active shell', () => {
        const shell = windowFor({ shell: true, active: true });
        const billingFrame = windowFor({ parent: shell });
        const result = boot(windowFor({ opener: billingFrame, marker: true }));
        assert.deepEqual(classes(result), ['oe-workbench-context', 'oe-workbench-popup']);
        assert.equal(gate(result), true);
        assert.deepEqual(shell.observations, [{ attributes: true, filter: ['class'] }]);
    });
    test('legacy transition activates and cleans classes', async () => {
        const shell = windowFor({ shell: true });
        const billingFrame = windowFor({ parent: shell });
        const result = boot(windowFor({ opener: billingFrame, marker: true }));
        assert.deepEqual(classes(result), []);
        shell.document.body.classList.add('workbench-active');
        await flush();
        assert.equal(gate(result), true);
        shell.document.body.classList.remove('workbench-active');
        await flush();
        assert.deepEqual(classes(result), []);
        assert.deepEqual(result.document.body.classList.values(), ['oe-billing-process']);
    });
    test('pagehide releases owned classes and observer', async () => {
        const shell = windowFor({ shell: true, active: true });
        const result = boot(windowFor({ opener: windowFor({ parent: shell }), marker: true }));
        result.dispatch('pagehide');
        assert.deepEqual(classes(result), []);
        shell.document.body.classList.remove('workbench-active');
        shell.document.body.classList.add('workbench-active');
        await flush();
        assert.deepEqual(classes(result), []);
    });
    test('standalone, foreign, closed, and absent-marker pages remain outside the gate', () => {
        assert.equal(gate(boot(windowFor({ marker: true }))), false);
        const foreign = windowFor({ shell: true, active: true, origin: 'https://other.test' });
        assert.equal(gate(boot(windowFor({ opener: foreign, marker: true }))), false);
        const closed = windowFor({ shell: true, active: true });
        closed.closed = true;
        assert.equal(gate(boot(windowFor({ opener: closed, marker: true }))), false);
        assert.equal(gate(boot(windowFor({ opener: windowFor({ shell: true, active: true }) }))), false);
    });
});

describe('production route, expected RED until controller permits implementation', () => {
    test('actual route is precisely the permitted presentation transform', () => {
        assert.deepEqual(verify(read(ROUTE)), []);
    });
});

if (HISTORY) {
    describe('pinned-base provenance (--history only)', () => {
        const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
        function checked(args) {
            const result = git(args);
            assert.equal(result.error, undefined, 'Git unavailable');
            assert.equal(result.status, 0, `${args.join(' ')}: ${String(result.stderr)}`);
            return result.stdout;
        }
        test('exact actual master base exists and is a HEAD ancestor', () => {
            assert.equal(String(checked(['rev-parse', '--verify', `${BASE}^{commit}`])).trim(), BASE);
            checked(['merge-base', '--is-ancestor', BASE, 'HEAD']);
        });
        test('fixture and route inverse authenticate to Git base bytes', () => {
            const baseline = checked(['show', `${BASE}:${ROUTE}`]);
            assert.deepEqual(bytes(FIXTURE), baseline);
            const source = read(ROUTE);
            const restored = source === original ? source : restore(source);
            assert.notEqual(restored, null);
            assert.deepEqual(Buffer.from(restored), baseline);
        });
        test('caller, Header, config, and popup assets match Git base bytes', () => {
            for (const [file, digest] of Object.entries(FROZEN)) {
                assert.equal(sha(bytes(file)), digest, file);
                assert.deepEqual(bytes(file), checked(['show', `${BASE}:${file}`]), file);
            }
        });
        test('committed and working changes remain in five-file allowlist', () => {
            const allowed = new Set([ROUTE, FIXTURE, 'tests/isolated/billing-process-contract.cjs', 'tests/js/billing-process.test.js', 'docs/clinical-ui/BILLING-PROCESS-SCREEN.md']);
            const committed = String(checked(['diff', '--name-only', `${BASE}...HEAD`])).trim().split('\n').filter(Boolean);
            const working = String(checked(['status', '--porcelain', '--untracked-files=all'])).split('\n').filter(Boolean).map((line) => line.slice(3));
            for (const file of [...committed, ...working]) assert.ok(allowed.has(file), `unexpected changed file: ${file}`);
        });
    });
}
