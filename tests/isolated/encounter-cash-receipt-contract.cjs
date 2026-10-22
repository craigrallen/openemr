'use strict';
/* OPEMR-75 source contract. Controller owns RED, execution, and review.
 * Portable: node --test tests/isolated/encounter-cash-receipt-contract.cjs
 * Pinned Git provenance: append --history. Never executes the PHP route. */

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test } = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '18647270e0c799189d2dc10f801e8de2bff1a360';
const ROUTE = 'interface/patient_file/encounter/cash_receipt.php';
const FIXTURE = 'tests/fixtures/encounter-cash-receipt-original.php.txt';
const CALLER = 'interface/patient_file/encounter/diagnosis.php';
const FRAMESET = 'interface/patient_file/encounter/encounter_bottom.php';
const MENU = 'interface/main/tabs/menu/menus/standard.json';
const HEADER = 'src/Core/Header.php';
const CONFIG = 'config/config.yaml';
const POPUP_JS = 'interface/clinical-workspace/popup.js';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const SHA256 = '07a08cdb3dba9a82dec668b3c563e44344216ef1f1f9b13a53ceae43140ab80f';
const ORIGINAL_SIZE = 6657;
const HISTORY = process.argv.includes('--history');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const bytes = (file) => fs.readFileSync(path.join(ROOT, file));
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
const count = (source, part) => source.split(part).length - 1;
const original = read(FIXTURE);

const GATE = 'html.oe-workbench-context body.oe-encounter-cash-receipt';
const BODY_OLD = '<body class="bg-white ml-1">';
const BODY_NEW = '<body class="bg-white ml-1 oe-encounter-cash-receipt">';
const STYLE = [
    '<style>',
    '@media screen {',
    `  ${GATE} {`,
    '    color: var(--oe-wb-ink, #17343b);',
    '    background-color: var(--oe-wb-canvas, #f3f7f5) !important;',
    '  }',
    '',
    `  ${GATE} > table {`,
    '    color: var(--oe-wb-ink, #17343b);',
    '    background-color: var(--oe-wb-paper, #fff);',
    '  }',
    '}',
    '</style>',
    '',
].join('\n');
const HEAD_OLD = '<?php Header::setupHeader(); ?>\n</head>';
const HEAD_NEW = `<?php Header::setupHeader(); ?>\n${STYLE}</head>`;

function insert(source) {
    assert.equal(count(source, HEAD_OLD), 1, 'unique Header/head anchor');
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
    if (count(source, BODY_NEW) !== 1) errors.push('exact marker required once');
    if (count(source, '<style>') !== 1 || count(source, '</style>') !== 1) errors.push('one style pair required');
    if (count(source, 'oe-encounter-cash-receipt') !== 3) errors.push('marker only on body and two selectors');
    if (!source.includes(HEAD_NEW) || !source.includes(`</head>\n\n${BODY_NEW}`)) errors.push('placement differs');
    if (restore(source) !== original) errors.push('restored full original differs');
    return errors;
}

const synthetic = insert(original);

describe('portable whole-source presentation contract', () => {
    test('fixture is the byte-exact original', () => {
        assert.equal(bytes(FIXTURE).length, ORIGINAL_SIZE);
        assert.equal(sha(bytes(FIXTURE)), SHA256);
        assert.equal(count(original, HEAD_OLD), 1);
        assert.equal(count(original, BODY_OLD), 1);
        assert.equal(count(original, '<style>'), 0);
    });
    test('synthetic candidate passes before production', () => {
        assert.deepEqual(verify(synthetic), []);
        assert.equal(restore(synthetic), original);
    });
    test('untouched original fails only the required presentation contract', () => {
        assert.deepEqual(verify(original), [
            'exact style required once',
            'exact marker required once',
            'one style pair required',
            'marker only on body and two selectors',
            'placement differs',
            'restored full original differs',
        ]);
    });
    test('screen selectors have only paired canvas and paper palettes', () => {
        assert.equal(count(STYLE, '@media screen {'), 1);
        assert.equal(count(STYLE, GATE), 2);
        assert.equal(count(STYLE, '!important'), 1);
        assert.deepEqual(STYLE.split('\n').filter((line) => /^    [\w-]+:/.test(line)), [
            '    color: var(--oe-wb-ink, #17343b);',
            '    background-color: var(--oe-wb-canvas, #f3f7f5) !important;',
            '    color: var(--oe-wb-ink, #17343b);',
            '    background-color: var(--oe-wb-paper, #fff);',
        ]);
        assert.ok(STYLE.includes(`${GATE} > table {`));
        const matches = (media, context, marker, target) => media === 'screen' && context && marker && (target === 'body' || target === 'direct-table');
        assert.equal(matches('screen', true, true, 'body'), true);
        for (const condition of [
            ['print', true, true, 'body'], ['screen', false, true, 'body'],
            ['screen', true, false, 'body'], ['screen', true, true, 'nested-table'],
        ]) assert.equal(matches(...condition), false);
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
        ['marker renamed', changed(BODY_NEW, '<body class="bg-white ml-1 oe-receipt">')],
        ['marker duplicated', changed(BODY_NEW, `${BODY_NEW}\n<!-- oe-encounter-cash-receipt -->`)],
        ['marker moved', changed(BODY_NEW, '<body class="oe-encounter-cash-receipt bg-white ml-1">')],
        ['style duplicated', changed(STYLE, STYLE + STYLE)],
        ['style moved', changed(STYLE + '</head>', '</head>\n' + STYLE)],
        ['style unclosed', changed('</style>\n', '')],
        ['print scope', changed('@media screen {', '@media screen, print {')],
        ['all media', changed('@media screen {', '@media all {')],
        ['context removed', changed(`  ${GATE} > table {`, '  body.oe-encounter-cash-receipt > table {')],
        ['popup generic selector', changed(`  ${GATE} > table {`, '  html.oe-workbench-popup body > table {')],
        ['descendant table', changed(`${GATE} > table {`, `${GATE} table {`)],
        ['canvas palette', changed('#f3f7f5', '#edf1f4')],
        ['paper palette', changed('#fff);', '#fefefe);')],
        ['body ink palette', changed('    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-canvas', '    color: var(--oe-wb-ink, #172b3a);\n    background-color: var(--oe-wb-canvas')],
        ['body important removed', changed('background-color: var(--oe-wb-canvas, #f3f7f5) !important;', 'background-color: var(--oe-wb-canvas, #f3f7f5);')],
        ['table important leaked', changed('background-color: var(--oe-wb-paper, #fff);', 'background-color: var(--oe-wb-paper, #fff) !important;')],
        ['geometry', changed(`${GATE} > table {`, `${GATE} > table {\n    padding: 2rem;`)],
        ['font', changed(`${GATE} > table {`, `${GATE} > table {\n    font-size: 14px;`)],
        ['print override', changed('</style>\n', '@media print { body { color: red; } }\n</style>\n')],
        ['patient title', changed("<span class='title'>", "<span class='title' style='color:red'>")],
        ['close callback', changed('javascript:window.close();', 'javascript:window.print();')],
        ['Header assets', changed('Header::setupHeader();', "Header::setupHeader('new-asset');")],
        ['CSRF check', changed('CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);', 'CsrfUtils::checkCsrfInput(INPUT_GET);')],
        ['session pid', changed("$pid = $session->get('pid', 0);", "$pid = 1;")],
        ['session encounter', changed("$encounter = $session->get('encounter', 0);", "$encounter = 1;")],
        ['SQL binding', changed('$db->Execute($sql, [$encounter]);', '$db->Execute($sql, [$pid]);')],
        ['SQL text', changed('where fe.encounter = ?', 'where fe.encounter = 1')],
        ['include guard', changed('SafeIncludeResolver::isSafePathComponent($formDir)', 'is_dir($formDir)')],
        ['include target', changed('include_once($reportPath);', 'include($reportPath);')],
        ['billing lookup', changed('BillingUtilities::getBillingByEncounter($pid, $encounter, "*")', 'BillingUtilities::getBillingByEncounter($pid, 0, "*")')],
        ['balance arithmetic', changed('$balance = $total - $copay;', '$balance = $total + $copay;')],
        ['escaping', changed("text($facility['name'])", "$facility['name']")],
        ['source comment', changed('//borrowed from diagnosis.php', '// changed')],
    ];
    for (const [label, source] of mutations) {
        test(`rejects ${label}`, () => assert.ok(verify(source).length > 0, label));
    }
});

describe('portable source path and boundaries', () => {
    test('Charges reaches diagnosis and its CSRF receipt link', () => {
        const menu = JSON.parse(read(MENU));
        const charges = read(MENU).match(/"label": "Charges"[\s\S]*?"global_req": "use_charges_panel"/);
        assert.ok(menu && charges);
        assert.match(charges[0], /"requirement": 2/);
        assert.match(charges[0], /"acct",\s*"bill",\s*"write"/);
        assert.match(charges[0], /"url": "\/interface\/patient_file\/encounter\/encounter_bottom.php"/);
        assert.match(read(FRAMESET), /<frame src="diagnosis\.php" name="Diagnosis"/);
        assert.match(read(CALLER), /<a href="cash_receipt\.php\?csrf_token_form=<\?php echo CsrfUtils::collectCsrfToken\(session: \$session\); \?>" class='link_submit' target='new' onclick='top\.restoreSession\(\)'>/);
        assert.match(read(CALLER), /AclMain::aclCheckCore\('encounters', 'coding_a'\)/);
        assert.match(read(CALLER), /AclMain::aclCheckCore\('encounters', 'coding'\)/);
    });
    test('ordinary Header autoloads the unchanged popup context assets', () => {
        assert.ok(read(HEADER).includes('self::setupAssets(is_array($assets) ? $assets : [$assets], true)'));
        assert.match(read(CONFIG), /workbench-popup:\n    basePath: '%webroot%\/interface\/clinical-workspace\/'\n    script: popup\.js\n    link: popup\.css\n    autoload: true/);
        assert.equal(count(synthetic, 'popup.js'), 0);
    });
    test('fallbacks match this checkout and patient title remains outside direct table rule', () => {
        const shared = read(POPUP_CSS);
        for (const token of ['--oe-wb-ink: #17343b;', '--oe-wb-paper: #fff;', '--oe-wb-canvas: #f3f7f5;']) assert.ok(shared.includes(token));
        assert.ok(shared.includes('html.oe-workbench-popup .title:not('));
        assert.ok(original.includes('<a href="javascript:window.close();"><span class=\'title\'>'));
        assert.equal(count(STYLE, '.title'), 0);
        assert.equal(count(STYLE, 'input'), 0);
        assert.equal(count(STYLE, 'button'), 0);
    });
});

// Actual unchanged popup.js runs in synthetic windows. This establishes a viable
// same-origin opener path; it cannot establish native target=new reuse or COOP.
describe('real popup.js through Charges frameset and opener ancestry', () => {
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
        doc.body = element(doc, [...(active ? ['workbench-active'] : []), ...(marker ? ['oe-encounter-cash-receipt'] : [])]);
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
    const gate = (win) => win.document.documentElement.classList.contains('oe-workbench-context') && win.document.body.classList.contains('oe-encounter-cash-receipt');
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    test('diagnosis frame opens receipt and reaches active shell', () => {
        const shell = windowFor({ shell: true, active: true });
        const encounter = windowFor({ parent: shell });
        const diagnosis = windowFor({ parent: encounter });
        const receipt = boot(windowFor({ opener: diagnosis, marker: true }));
        assert.deepEqual(classes(receipt), ['oe-workbench-context', 'oe-workbench-popup']);
        assert.equal(gate(receipt), true);
        assert.deepEqual(shell.observations, [{ attributes: true, filter: ['class'] }]);
    });
    test('legacy shell transition activates and cleans context', async () => {
        const shell = windowFor({ shell: true });
        const diagnosis = windowFor({ parent: shell });
        const receipt = boot(windowFor({ opener: diagnosis, marker: true }));
        assert.deepEqual(classes(receipt), []);
        shell.document.body.classList.add('workbench-active');
        await flush();
        assert.equal(gate(receipt), true);
        shell.document.body.classList.remove('workbench-active');
        await flush();
        assert.deepEqual(classes(receipt), []);
        assert.deepEqual(receipt.document.body.classList.values(), ['oe-encounter-cash-receipt']);
    });
    test('pagehide releases owned classes and observer', async () => {
        const shell = windowFor({ shell: true, active: true });
        const diagnosis = windowFor({ parent: shell });
        const receipt = boot(windowFor({ opener: diagnosis, marker: true }));
        receipt.dispatch('pagehide');
        assert.deepEqual(classes(receipt), []);
        shell.document.body.classList.remove('workbench-active');
        shell.document.body.classList.add('workbench-active');
        await flush();
        assert.deepEqual(classes(receipt), []);
    });
    test('standalone, cross-origin, closed opener, and absent marker cannot match', () => {
        assert.equal(gate(boot(windowFor({ marker: true }))), false);
        const foreign = windowFor({ shell: true, active: true, origin: 'https://foreign.test' });
        assert.equal(gate(boot(windowFor({ opener: foreign, marker: true }))), false);
        const closed = windowFor({ shell: true, active: true });
        closed.closed = true;
        assert.equal(gate(boot(windowFor({ opener: closed, marker: true }))), false);
        const shell = windowFor({ shell: true, active: true });
        assert.equal(gate(boot(windowFor({ opener: shell }))), false);
    });
});

describe('production route, expected RED until controller permits implementation', () => {
    test('current route is precisely the permitted presentation transform', () => {
        assert.deepEqual(verify(read(ROUTE)), []);
    });
});

if (HISTORY) {
    describe('pinned-base provenance (--history only)', () => {
        const FROZEN = {
            [CALLER]: '23bda167a30db10958563f0d3fb0dc0dc18200736d5c81ff17da277100e7111e',
            [FRAMESET]: '00cad46117922ef7449dc69eaa2548d6081d55e37988aaeeb332839d55db401b',
            [MENU]: '2fd22e2bab57c29527342e921eac777ee0421d67b7a34f5fe15849509a838ff6',
            [HEADER]: 'dee3fd5f35bfd900ed119ae45981142ed737dac48059e54cacb4af843d6d264d',
            [CONFIG]: '5f99c981f570a2f94917d68a4abcedf086eb75a102364bf71f1cb44ccfe461b7',
            [POPUP_JS]: 'af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f',
            [POPUP_CSS]: 'ea56e9f26990e843219a68f315c188f7e2b0581c20321bac4517dc4ba34e79a9',
        };
        const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
        function checked(args) {
            const result = git(args);
            assert.equal(result.error, undefined, 'Git unavailable');
            assert.equal(result.status, 0, `${args.join(' ')}: ${String(result.stderr)}`);
            return result.stdout;
        }
        test('exact actual default master base exists and is HEAD ancestor', () => {
            assert.equal(String(checked(['rev-parse', '--verify', `${BASE}^{commit}`])).trim(), BASE);
            checked(['merge-base', '--is-ancestor', BASE, 'HEAD']);
        });
        test('fixture and full production inverse equal baseline bytes', () => {
            assert.deepEqual(checked(['show', `${BASE}:${ROUTE}`]), bytes(FIXTURE));
            const restored = restore(read(ROUTE));
            assert.notEqual(restored, null);
            assert.deepEqual(Buffer.from(restored), checked(['show', `${BASE}:${ROUTE}`]));
        });
        test('caller, frameset, menu, Header, config, and popup assets remain frozen', () => {
            for (const [file, digest] of Object.entries(FROZEN)) {
                assert.equal(sha(bytes(file)), digest, file);
                assert.deepEqual(bytes(file), checked(['show', `${BASE}:${file}`]), file);
            }
        });
        test('committed and working changes stay inside the five-file allowlist', () => {
            const allowed = new Set([ROUTE, FIXTURE, 'tests/isolated/encounter-cash-receipt-contract.cjs', 'tests/js/encounter-cash-receipt.test.js', 'docs/clinical-ui/ENCOUNTER-CASH-RECEIPT.md']);
            const committed = String(checked(['diff', '--name-only', `${BASE}...HEAD`])).trim().split('\n').filter(Boolean);
            const working = String(checked(['status', '--porcelain', '--untracked-files=all'])).split('\n').filter(Boolean).map((line) => line.slice(3));
            for (const file of [...committed, ...working]) assert.ok(allowed.has(file), `unexpected changed file: ${file}`);
        });
    });
}
