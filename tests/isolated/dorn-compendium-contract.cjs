'use strict';
/* OPEMR-77 source-only contract. Never include or execute the PHP route. */

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test } = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '18647270e0c799189d2dc10f801e8de2bff1a360';
const ROUTE = 'interface/modules/custom_modules/oe-module-dorn/public/compendium_install.php';
const FIXTURE = 'tests/fixtures/dorn-compendium-original.php.txt';
const CALLER = 'interface/modules/custom_modules/oe-module-dorn/public/lab_setup.php';
const POPUP = 'interface/clinical-workspace/popup.js';
const ESCAPING = 'library/htmlspecialchars.inc.php';
const GLOBALS_BAG = 'src/Core/OEGlobalsBag.php';
const KERNEL = 'src/Core/Kernel.php';
const HISTORY = process.argv.includes('--history');
const HASHES = {
    [CALLER]: '94860b5d349dc3dea1b6b0a6d6c71ab9aee772320ee112a64939e2bc05b33ba6',
    [POPUP]: 'af967e78fef59e75d2a5a5c4e08916bbea90a7f108c67f3def027b3061dc330f',
    [ESCAPING]: '57f81e8e4501d2371f4be9586611b667be8bc669e6af0ad63b275b1469963d5b',
    [GLOBALS_BAG]: '7e129b946d6b8df8f608fec1c4d10d12025a6672c7fa0394cc06aaea006dbcdc',
    [KERNEL]: '0ecf0f3a7d6a810b0ef61021df28bd54776c3e5f3b2481e480d5bf6df44dc372',
};
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const bytes = (file) => fs.readFileSync(path.join(ROOT, file));
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const count = (source, token) => source.split(token).length - 1;
const original = read(FIXTURE);
const ANCHOR = "    $labGuid = $_REQUEST['labGuid'];\n";
const RESULT_OLD = "echo \"<div style='background-color: white; color: black; padding: 5px;'>\" .";
const RESULT_NEW = "echo \"<div class='oe-dorn-compendium-result' style='background-color: white; color: black; padding: 5px;'>\" .";
const PRELUDE = [
    "    echo '<html class=\"oe-dorn-compendium\"><head><script src=\"' .",
    "        attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot() . '/interface/clinical-workspace/popup.js') .",
    "        '?v=' .",
    "        attr_url(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getString('v_js_includes')) .",
    "        '\"></script><style>",
    '@media screen {',
    '  html.oe-dorn-compendium.oe-workbench-context body {',
    '    color: var(--oe-wb-ink, #17343b);',
    '    background-color: var(--oe-wb-canvas, #f3f7f5);',
    '  }',
    '',
    '  html.oe-dorn-compendium.oe-workbench-context body > .oe-dorn-compendium-result {',
    '    color: var(--oe-wb-ink, #17343b) !important;',
    '    background-color: var(--oe-wb-paper, #fff) !important;',
    '  }',
    '}',
    "</style></head>';",
].join('\n') + '\n';

function insert(source) {
    assert.equal(count(source, ANCHOR), 1);
    assert.equal(count(source, RESULT_OLD), 1);
    return source.replace(ANCHOR, ANCHOR + PRELUDE).replace(RESULT_OLD, RESULT_NEW);
}
function restore(source) {
    if (count(source, ANCHOR + PRELUDE) !== 1 || count(source, RESULT_NEW) !== 1) return null;
    return source.replace(ANCHOR + PRELUDE, ANCHOR).replace(RESULT_NEW, RESULT_OLD);
}
function verify(source) {
    const errors = [];
    if (count(source, ANCHOR + PRELUDE) !== 1) errors.push('exact prelude and placement required');
    if (count(source, RESULT_NEW) !== 1) errors.push('exact result marker required');
    if (restore(source) !== original) errors.push('full-source inverse differs from original');
    return errors;
}
const synthetic = insert(original);
function replaceOne(source, anchor, replacement) {
    assert.equal(count(source, anchor), 1, `mutation anchor must be unique: ${anchor}`);
    assert.notEqual(anchor, replacement, `mutation must change its anchor: ${anchor}`);
    const changed = source.replace(anchor, replacement);
    assert.notEqual(changed, source, `mutation must change source: ${anchor}`);
    return changed;
}
const mutate = (anchor, replacement) => replaceOne(synthetic, anchor, replacement);

describe('portable whole-source presentation contract', () => {
    test('fixture length, digest and source anchors are frozen', () => {
        assert.equal(bytes(FIXTURE).length, 1877);
        assert.equal(sha(bytes(FIXTURE)), 'b75f5281822936bed463113354f3e308fd9e78b7f5da3f65d528a9ea035a5f95');
        assert.equal(count(original, ANCHOR), 1);
        assert.equal(count(original, RESULT_OLD), 1);
        assert.equal(count(original, 'ob_flush();'), 4);
        assert.equal(count(original, '\n    flush();'), 4);
    });
    test('synthetic candidate passes and restores every original byte', () => {
        assert.deepEqual(verify(synthetic), []);
        assert.deepEqual(Buffer.from(restore(synthetic)), bytes(FIXTURE));
    });
    test('prelude follows ACL and CSRF in nonempty GET branch and precedes first fragment', () => {
        const ordered = [
            "if (!AclMain::aclCheckCore('admin', 'users'))",
            'if (!empty($_GET)) {',
            'CsrfUtils::checkCsrfInput(INPUT_GET, dieOnFail: true);',
            ANCHOR,
            PRELUDE,
            RESULT_NEW,
            '    ob_flush();',
        ];
        let offset = -1;
        for (const part of ordered) {
            const next = synthetic.indexOf(part, offset + 1);
            assert.ok(next > offset, `out of order: ${part}`);
            offset = next;
        }
        assert.equal(count(synthetic, PRELUDE), 1);
        assert.equal(count(synthetic, '<html class="oe-dorn-compendium"><head>'), 1);
        assert.equal(count(PRELUDE, '<body'), 0);
        assert.equal(count(PRELUDE, 'Header::setupHeader'), 0);
        assert.equal(count(PRELUDE, 'popup.css'), 0);
        assert.equal(count(PRELUDE, 'workspace.css'), 0);
        assert.ok(PRELUDE.includes("<script src=\"' .\n        attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot() . '/interface/clinical-workspace/popup.js') ."));
        assert.ok(PRELUDE.includes("'?v=' .\n        attr_url(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getString('v_js_includes')) ."));
        assert.ok(PRELUDE.includes("'\"></script><style>"));
    });
    test('screen-only selectors pair body canvas/ink and original inline result paper/ink', () => {
        assert.equal(count(PRELUDE, '@media screen {'), 1);
        assert.equal(count(PRELUDE, '!important'), 2);
        assert.match(PRELUDE, /--oe-wb-canvas, #f3f7f5\);\n  \}\n\n  html\.oe-dorn-compendium/);
        assert.deepEqual(PRELUDE.split('\n').filter((line) => line.includes('!important')), [
            '    color: var(--oe-wb-ink, #17343b) !important;',
            '    background-color: var(--oe-wb-paper, #fff) !important;',
        ]);
        assert.match(PRELUDE, /html\.oe-dorn-compendium\.oe-workbench-context body \{\n    color: var\(--oe-wb-ink, #17343b\);\n    background-color: var\(--oe-wb-canvas, #f3f7f5\);/);
        assert.match(PRELUDE, /html\.oe-dorn-compendium\.oe-workbench-context body > \.oe-dorn-compendium-result/);
        assert.match(RESULT_NEW, /style='background-color: white; color: black; padding: 5px;'/);
        assert.deepEqual([...PRELUDE.matchAll(/^    ([\w-]+):/gm)].map((match) => match[1]), ['color', 'background-color', 'color', 'background-color']);
    });
    test('missing production presentation is the sole intended RED', () => {
        assert.deepEqual(verify(original), [
            'exact prelude and placement required',
            'exact result marker required',
            'full-source inverse differs from original',
        ]);
    });
    for (const [label, change] of [
        ['ACL', () => mutate("'admin', 'users'", "'admin', 'patients'")],
        ['CSRF', () => mutate('INPUT_GET, dieOnFail: true', 'INPUT_GET, dieOnFail: false')],
        ['CSRF placement', () => mutate(ANCHOR + PRELUDE, PRELUDE + ANCHOR)],
        ['labGuid', () => mutate("$_REQUEST['labGuid']", "$_GET['labGuid']")],
        ['uninstall', () => mutate('LabCompendiumInstall::uninstall($labGuid)', 'LabCompendiumInstall::install($labGuid)')],
        ['install', () => mutate('LabCompendiumInstall::install($labGuid);', 'LabCompendiumInstall::uninstall($labGuid);')],
        ['stream order', () => mutate("xlt('Starting uninstall.')", "xlt('Uninstall complete.')")],
        ['flush', () => mutate('    echo "<li>" . xlt(\'Starting uninstall.\') . "</li>";\n    ob_flush();\n    flush();', '    echo "<li>" . xlt(\'Starting uninstall.\') . "</li>";\n    flush();\n    ob_flush();')],
        ['inline style', () => mutate('padding: 5px;', 'padding: 6px;')],
        ['timer', () => mutate('}, 5000);', '}, 1000);')],
        ['close', () => mutate('parent.dlgclose();', 'window.close();')],
        ['extra style', () => mutate('</style></head>', 'font-size: 12px;</style></head>')],
        ['url escaping', () => mutate('attr_url(\\OpenEMR', 'attr(\\OpenEMR')],
        ['screen becomes print', () => mutate('@media screen {', '@media print {')],
        ['context removal', () => mutate('html.oe-dorn-compendium.oe-workbench-context body {', 'html.oe-dorn-compendium body {')],
        ['result foreground loses important', () => mutate('color: var(--oe-wb-ink, #17343b) !important;', 'color: var(--oe-wb-ink, #17343b);')],
        ['result background loses important', () => mutate('background-color: var(--oe-wb-paper, #fff) !important;', 'background-color: var(--oe-wb-paper, #fff);')],
        ['body important escalation', () => mutate('background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;')],
        ['duplicate prelude', () => mutate(ANCHOR + PRELUDE, ANCHOR + PRELUDE + PRELUDE)],
        ['moved prelude', () => replaceOne(replaceOne(synthetic, ANCHOR + PRELUDE, ANCHOR), 'if (!empty($_GET)) {', PRELUDE + 'if (!empty($_GET)) {')],
        ['missing prelude marker', () => mutate('<html class="oe-dorn-compendium">', '<html>')],
        ['missing result marker', () => mutate(RESULT_NEW, RESULT_OLD)],
        ['malformed style', () => mutate('</style></head>', '</head>')],
        ['duplicate result marker', () => mutate(RESULT_NEW, RESULT_NEW + ' ' + RESULT_NEW)],
    ]) {
        test(`rejects ${label} mutation`, () => {
            const mutated = change();
            assert.notEqual(mutated, synthetic, label);
            assert.ok(verify(mutated).length > 0, label);
        });
    }
});

describe('unchanged caller and shared controller', () => {
    test('frozen bytes and actual 500 × 650 CSRF dlgopen caller', () => {
        for (const [file, digest] of Object.entries(HASHES)) assert.equal(sha(bytes(file)), digest, file);
        const caller = read(CALLER);
        assert.match(caller, /function installCompendiumClick\(labGuid\) \{[\s\S]*?scriptTitle = 'compendium_install\.php\?labGuid=' \+ encodeURIComponent\(labGuid\) \+ '&csrf_token_form=' \+ <\?php echo js_url\(CsrfUtils::collectCsrfToken\(session: \$session\)\); \?>;[\s\S]*?dlgopen\(scriptTitle, '_blank', 500, 650, false, addTitle\);/);
        assert.equal(count(caller, "dlgopen(scriptTitle, '_blank', 500, 650, false, addTitle);"), 1);
    });
    test('caller or controller drift is detectable', () => {
        for (const [file, digest] of Object.entries(HASHES)) {
            assert.notEqual(sha(read(file) + ' '), digest);
        }
    });
});

describe('frozen URL construction evidence', () => {
    test('escaping helpers and string getters retain their inspected definitions', () => {
        for (const file of [ESCAPING, GLOBALS_BAG, KERNEL]) assert.equal(sha(bytes(file)), HASHES[file], file);
        const escaping = read(ESCAPING);
        assert.match(escaping, /function attr_url\(\$text\): string\s*\{\s*return attr\(urlencode\(\$text \?\? ''\)\);\s*\}/);
        assert.match(escaping, /function attr\(\$text\): string\s*\{\s*return htmlspecialchars\(\$text \?\? '', ENT_QUOTES\);\s*\}/);
        const bag = read(GLOBALS_BAG);
        assert.match(bag, /public function getWebRoot\(\): string\s*\{\s*return \$this->hasKernel\(\)\s*\? \$this->getKernel\(\)->getWebRoot\(\)\s*: \$this->getString\('webroot'\);\s*\}/);
        assert.match(bag, /public function getString\(string \$key, string \$default = ''\): string/);
        assert.match(read(KERNEL), /public function getWebRoot\(\): string\s*\{\s*return \$this->requireWebRoot\(\);\s*\}/);
    });
    test('synthetic URL oracle escapes the constructed path and encodes only version data', () => {
        const attrOracle = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        const urlItemOracle = (value) => encodeURIComponent(value).replace(/%20/g, '+');
        const scriptUrl = (webroot, version) => attrOracle(webroot + '/interface/clinical-workspace/popup.js') + '?v=' + attrOracle(urlItemOracle(version));
        assert.equal(scriptUrl('/openemr', 'v 1&"'), '/openemr/interface/clinical-workspace/popup.js?v=v+1%26%22');
        assert.equal(scriptUrl('/open&"root', 'v 1&"'), '/open&amp;&quot;root/interface/clinical-workspace/popup.js?v=v+1%26%22');
        assert.equal(count(PRELUDE, "attr(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getWebRoot() . '/interface/clinical-workspace/popup.js')"), 1);
        assert.equal(count(PRELUDE, "attr_url(\\OpenEMR\\Core\\OEGlobalsBag::getInstance()->getString('v_js_includes'))"), 1);
    });
});

describe('actual popup.js in synthetic frames', () => {
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
    function windowFor({ parent = null, shell = false, active = false, marker = false, origin = ORIGIN, dialog = false } = {}) {
        const win = { closed: false, location: { origin }, opener: null, listeners: [], observations: [] };
        const doc = { defaultView: win, readyState: 'loading', body: null,
            querySelector: (selector) => selector === '#mainBox [data-workbench-mode]' && shell ? {} : null,
            addEventListener() {}, removeEventListener() {} };
        doc.documentElement = element(doc, marker ? ['oe-dorn-compendium'] : []);
        if (shell) doc.body = element(doc, active ? ['workbench-active'] : []);
        win.document = doc;
        win.parent = parent || win;
        win.frameElement = dialog ? { closest: (selector) => selector === '.dialogModal' ? {} : null } : null;
        win.addEventListener = (type, fn) => win.listeners.push([type, fn]);
        win.dispatch = (type) => win.listeners.filter(([name]) => name === type).forEach(([, fn]) => fn({}));
        win.MutationObserver = class {
            constructor(callback) { this.callback = callback; this.targets = []; this.pending = false; }
            observe(target, options) {
                win.observations.push({ attributes: options.attributes, filter: [...options.attributeFilter] });
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
                queueMicrotask(() => { this.pending = false; if (this.targets.length) this.callback(); });
            }
        };
        return win;
    }
    const boot = (win) => { win.window = win; vm.runInContext(read(POPUP), vm.createContext(win), { filename: POPUP }); return win; };
    const classes = (win) => win.document.documentElement.classList.values().sort();
    const gate = (win) => win.document.documentElement.classList.contains('oe-dorn-compendium') && win.document.documentElement.classList.contains('oe-workbench-context');
    const flush = () => new Promise((resolve) => setImmediate(resolve));
    test('same-origin dialog iframe reaches active parent while body is absent', () => {
        const shell = windowFor({ shell: true, active: true });
        const frame = boot(windowFor({ parent: shell, marker: true, dialog: true }));
        assert.equal(frame.document.body, null);
        assert.equal(gate(frame), true);
        assert.deepEqual(classes(frame), ['oe-dorn-compendium', 'oe-workbench-context', 'oe-workbench-popup']);
        assert.deepEqual(shell.observations, [{ attributes: true, filter: ['class'] }]);
    });
    test('legacy to active and back cleans only owned classes', async () => {
        const shell = windowFor({ shell: true });
        const frame = boot(windowFor({ parent: shell, marker: true, dialog: true }));
        assert.deepEqual(classes(frame), ['oe-dorn-compendium']);
        shell.document.body.classList.add('workbench-active');
        await flush();
        assert.equal(gate(frame), true);
        shell.document.body.classList.remove('workbench-active');
        await flush();
        assert.deepEqual(classes(frame), ['oe-dorn-compendium']);
    });
    test('standalone and cross-origin frames stay inert', () => {
        assert.deepEqual(classes(boot(windowFor({ marker: true }))), ['oe-dorn-compendium']);
        const foreign = windowFor({ shell: true, active: true, origin: 'https://elsewhere.test' });
        assert.deepEqual(classes(boot(windowFor({ parent: foreign, marker: true, dialog: true }))), ['oe-dorn-compendium']);
    });
    test('pagehide disposes observer without touching route close timer', async () => {
        const shell = windowFor({ shell: true, active: true });
        const frame = boot(windowFor({ parent: shell, marker: true, dialog: true }));
        frame.dispatch('pagehide');
        assert.deepEqual(classes(frame), ['oe-dorn-compendium']);
        shell.document.body.classList.remove('workbench-active');
        shell.document.body.classList.add('workbench-active');
        await flush();
        assert.deepEqual(classes(frame), ['oe-dorn-compendium']);
        assert.match(synthetic, /setTimeout\(function\(\) \{\n    parent\.dlgclose\(\);\n\}, 5000\);/);
    });
});

describe('production route, expected RED before implementation', () => {
    test('actual route is precisely the approved presentation transform', () => {
        assert.deepEqual(verify(read(ROUTE)), []);
    });
});

if (HISTORY) {
    describe('pinned Git provenance (--history only)', () => {
        function checked(args) {
            const result = spawnSync('git', args, { cwd: ROOT, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
            assert.equal(result.error, undefined, 'Git unavailable');
            assert.equal(result.status, 0, `${args.join(' ')}: ${String(result.stderr)}`);
            return result.stdout;
        }
        test('base is exact and is an ancestor of HEAD', () => {
            assert.equal(String(checked(['rev-parse', '--verify', `${BASE}^{commit}`])).trim(), BASE);
            checked(['merge-base', '--is-ancestor', BASE, 'HEAD']);
        });
        test('fixture and route inverse authenticate to actual base bytes', () => {
            const baseline = checked(['show', `${BASE}:${ROUTE}`]);
            assert.deepEqual(bytes(FIXTURE), baseline);
            const source = read(ROUTE);
            assert.deepEqual(Buffer.from(source === original ? source : restore(source) || ''), baseline);
        });
        test('caller and popup controller match base bytes', () => {
            for (const [file, digest] of Object.entries(HASHES)) {
                assert.equal(sha(bytes(file)), digest, file);
                assert.deepEqual(bytes(file), checked(['show', `${BASE}:${file}`]));
            }
        });
        test('working changes stay in final five-file scope', () => {
            const allowed = new Set([ROUTE, FIXTURE, 'tests/isolated/dorn-compendium-contract.cjs', 'tests/js/dorn-compendium.test.js', 'docs/clinical-ui/DORN-COMPENDIUM-SCREEN.md']);
            const committed = String(checked(['diff', '--name-only', `${BASE}...HEAD`])).trim().split('\n').filter(Boolean);
            const working = String(checked(['status', '--porcelain', '--untracked-files=all'])).split('\n').filter(Boolean).map((line) => line.slice(3));
            for (const file of [...committed, ...working]) assert.ok(allowed.has(file), `unexpected changed file: ${file}`);
        });
    });
}
