'use strict';

/**
 * OPEMR-69 ERA posting result (sl_eob_process.php) presentation contract.
 * Portable: node --test tests/eob-process.contract.test.cjs
 * Local provenance: node tests/eob-process.contract.test.cjs --history
 * (run directly; `node --test ... --history` does not forward the flag)
 *
 * Text only. The route mutates ledgers even on GET/debug paths and archives its
 * output, so nothing here executes, bootstraps or requests PHP. The route is opened
 * with window.open(..., '_blank') and no feature string (implicit noopener), so the
 * inline bootstrap is only exercised in vm window doubles. They model same-origin
 * opener/parent discovery, storage reads, storage/pageshow/pagehide events and class
 * toggling; not native COOP/opener retention, BFCache, rendering, contrast (the
 * explicit .errdetail/.newdetail/.infdetail/.table-light/inline status colors stay a
 * native gate, NOT cleared), print/archive, or financial correctness.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = '18647270e0c799189d2dc10f801e8de2bff1a360';
const ROUTE = 'interface/billing/sl_eob_process.php';
const CALLERS = ['interface/billing/sl_eob_search.php', 'interface/billing/era_payments.php'];
const POPUP_JS = 'interface/clinical-workspace/popup.js';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const FIXTURE = 'tests/fixtures/eob-process-original.php.txt';
const HASH = 'b6159de4125adb76f3493b83027ef084e7358d37788af4a0b47041b64f90c5af';
const BYTES = 36223;
const HISTORY = process.argv.includes('--history');
const UNCHANGED = [...CALLERS, POPUP_JS, POPUP_CSS];
const ALLOWED = [ROUTE, FIXTURE, 'tests/eob-process.contract.test.cjs', 'tests/js/eob-process.test.js', 'docs/clinical-ui/EOB-PROCESS-SCREEN.md'];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel));
const text = (rel) => read(rel).toString('utf8');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const count = (source, needle) => source.split(needle).length - 1;
const originalBytes = read(FIXTURE);
const ORIGINAL = originalBytes.toString('utf8');

// ---- Designed production block (second phase inserts exactly this) ----
const HEADER = '<?php Header::setupHeader(); ?>\n';
const BODY = "<body class='m-0'>\n";
const MARKED_BODY = "<body class='m-0 oe-eob-process'>\n";
const BEGIN = '<!-- OPEMR-69 EOB process presentation: begin -->\n';
const END = '<!-- OPEMR-69 EOB process presentation: end -->\n';
const CONTEXT = 'oe-workbench-context';
const OWN = 'oe-eob-process-standalone';
const KEY = 'openemr.navigation.mode';
const SCOPES = [`html.${CONTEXT} body.oe-eob-process`, `html.${OWN} body.oe-eob-process`];
const PAPER = ['background-color', 'var(--oe-wb-paper, #fff)'];
const INK = ['color', 'var(--oe-wb-ink, #17343b)'];
const RULES = [
    ['', [['background-color', 'var(--oe-wb-canvas, #f3f7f5)'], INK]],
    [' form', [PAPER, INK, ['box-shadow', 'inset 0 0 0 1px var(--oe-wb-line, #d9e4e2)']]],
    [' form > table.table', [PAPER, INK]]
];
const ruleText = ([suffix, declarations]) => [
    SCOPES.map((scope) => `  ${scope}${suffix}`).join(',\n') + ' {',
    ...declarations.map(([property, value]) => `    ${property}: ${value};`),
    '  }'
].join('\n');
const CSS = ['@media screen {', RULES.map(ruleText).join('\n\n'), '}'].join('\n');
const STYLE = `<style>\n${CSS}\n</style>\n`;
const SCRIPT_SOURCE = [
    '(function () {',
    `    var KEY = '${KEY}';`,
    `    var OWN = '${OWN}';`,
    '    var html = document.documentElement;',
    '    var owned = false;',
    '    var listening = false;',
    '',
    '    function wanted() {',
    '        try {',
    '            if (window.opener || window.parent !== window) return false;',
    "            return window.localStorage.getItem(KEY) !== 'legacy';",
    '        } catch (e) {',
    '            return false;',
    '        }',
    '    }',
    '',
    '    function drop() {',
    '        if (!owned) return;',
    '        html.classList.remove(OWN);',
    '        owned = false;',
    '    }',
    '',
    '    function sync() {',
    '        if (!wanted()) {',
    '            drop();',
    '        } else if (!html.classList.contains(OWN)) {',
    '            html.classList.add(OWN);',
    '            owned = true;',
    '        }',
    '    }',
    '',
    '    function onStorage(event) {',
    '        try {',
    '            if (event.storageArea !== window.localStorage) return;',
    '        } catch (e) {',
    '            drop();',
    '            return;',
    '        }',
    '        if (event.key === null || event.key === KEY) sync();',
    '    }',
    '',
    '    function listen(on) {',
    '        if (on === listening) return;',
    '        listening = on;',
    "        window[on ? 'addEventListener' : 'removeEventListener']('storage', onStorage);",
    '    }',
    '',
    "    window.addEventListener('pageshow', function () {",
    '        listen(true);',
    '        sync();',
    '    });',
    "    window.addEventListener('pagehide', function () {",
    '        listen(false);',
    '        drop();',
    '    });',
    '    listen(true);',
    '    sync();',
    '}());'
].join('\n');
const BLOCK = `${BEGIN}<script>\n${SCRIPT_SOURCE}\n</script>\n${STYLE}${END}`;

const buildCandidate = (original) => {
    assert.equal(count(original, HEADER), 1, 'original header anchor');
    assert.equal(count(original, BODY), 1, 'original body anchor');
    return original.split(HEADER).join(HEADER + BLOCK).split(BODY).join(MARKED_BODY);
};
const inverse = (source) => source.split(BLOCK).join('').split(MARKED_BODY).join(BODY);

const FORBIDDEN_SCRIPT = [
    'setItem', 'removeItem', '.clear(', 'sessionStorage', 'fetch', 'XMLHttpRequest', 'sendBeacon', 'postMessage',
    'setTimeout', 'setInterval', 'requestAnimationFrame', 'MutationObserver', 'document.body', 'window.name',
    'opener =', 'opener=', CONTEXT, 'oe-workbench-popup', 'eval(', 'Function(', 'location', 'document.write'
];

function guardCss(css) {
    assert.ok(css.startsWith('@media screen {\n') && css.endsWith('\n}'), 'screen scope: rules must sit inside @media screen');
    const rules = css.slice('@media screen {\n'.length, -'\n}'.length).split('\n\n');
    assert.equal(rules.length, RULES.length, 'screen scope: rule count');
    rules.forEach((rule, index) => {
        const lines = rule.split('\n');
        const selectors = lines.filter((line) => /^ {2}[^\s}]/.test(line)).map((line) => line.replace(/[,{]$/, '').trim());
        assert.deepEqual(selectors.map((s) => s.split(' ')[0] + ' ' + s.split(' ')[1]), SCOPES, `screen scope: rule ${index} needs both route scopes, one per line`);
        const declarations = lines.filter((line) => line.startsWith('    ')).map((line) => /^ {4}([a-z-]+): (.+);$/.exec(line));
        assert.ok(declarations.every(Boolean), `rule ${index} declaration indentation`);
        const props = declarations.map((match) => match[1]);
        assert.ok(props.includes('background-color') && props.includes('color'), `palette pair: rule ${index} needs paper/canvas AND ink`);
        const allowed = index === 1 ? ['background-color', 'color', 'box-shadow'] : ['background-color', 'color'];
        assert.deepEqual(props.filter((p) => !allowed.includes(p)), [], `geometry/semantic property outside palette in rule ${index}`);
        for (const [, , value] of declarations) {
            for (const token of value.match(/var\([^)]*\)/g) ?? []) assert.match(token, /^var\(--oe-wb-(canvas|ink|paper|line), #(f3f7f5|17343b|fff|d9e4e2)\)$/, 'palette tokens');
        }
    });
    assert.equal(css, CSS, 'css differs from approved palette');
}

function guardBlock(block) {
    assert.ok(block.startsWith(BEGIN) && block.endsWith(END), 'presentation block delimiters');
    assert.ok(!block.includes('<?'), 'presentation block must not add PHP');
    assert.equal(count(block, '<script>'), 1, 'presentation script: exactly one');
    assert.equal(count(block, '<style>'), 1, 'presentation style: exactly one');
    const script = block.slice(block.indexOf('<script>\n') + 9, block.indexOf('\n</script>'));
    const css = block.slice(block.indexOf('<style>\n') + 8, block.indexOf('\n</style>'));
    assert.ok(block.indexOf('<script>') < block.indexOf('<style>'), 'presentation script precedes style');
    for (const token of FORBIDDEN_SCRIPT) assert.ok(!script.includes(token), `presentation script forbids ${token}`);
    for (const required of ['window.opener', 'window.parent !== window', "getItem(KEY) !== 'legacy'", "'storage'", "'pageshow'", "'pagehide'", `'${OWN}'`]) {
        assert.ok(script.includes(required), `presentation script requires ${required}`);
    }
    assert.equal(script, SCRIPT_SOURCE, 'presentation script differs from approved source');
    guardCss(css);
}

function verifyCandidate(source, original) {
    const begins = count(source, BEGIN);
    assert.ok(begins > 0, 'missing presentation: block');
    assert.equal(begins, 1, 'duplicate presentation: block');
    assert.equal(count(source, END), 1, 'duplicate presentation: block end');
    const start = source.indexOf(BEGIN);
    const stop = source.indexOf(END) + END.length;
    assert.ok(stop > start, 'presentation block order');
    assert.equal(start, source.indexOf(HEADER) + HEADER.length, 'presentation block relocated: must follow Header::setupHeader');
    guardBlock(source.slice(start, stop));
    assert.ok(count(source, MARKED_BODY) > 0, 'missing presentation marker');
    assert.equal(count(source, MARKED_BODY), 1, 'presentation marker: exactly one marked body');
    assert.equal(count(source, '<body'), 1, 'presentation marker: exactly one body');
    assert.equal(count(source, 'oe-eob-process'), count(BLOCK, 'oe-eob-process') + 1, 'presentation marker: stray route marker');
    assert.equal(inverse(source), original, 'route delta: edits outside the presentation block');
    assert.equal(source, buildCandidate(original), 'route differs from synthetic candidate');
}

describe('original route archive and anchors', () => {
    test('fixture is the exact base route', () => {
        assert.equal(originalBytes.length, BYTES);
        assert.equal(sha(originalBytes), HASH);
        assert.ok(!ORIGINAL.includes('\r'));
    });
    test('insertion anchors are unique and the existing style follows the header', () => {
        assert.equal(count(ORIGINAL, HEADER + '<style>\n    body {\n'), 1);
        assert.equal(count(ORIGINAL, BODY + '<form action="sl_eob_process.php" method="get">\n'), 1);
        assert.equal(count(ORIGINAL, 'oe-eob-process'), 0);
        assert.equal(count(ORIGINAL, 'opener'), 0);
    });
    test('mutating, archiving and status anchors that must stay untouched exist', () => {
        for (const anchor of ['ob_start();', 'SLEOB::arPostSession(', 'SLEOB::arPostPayment(', 'SLEOB::arPostAdjustment(', 'SLEOB::arPostCharge(',
            "UPDATE form_encounter", "fwrite($fhreport, ob_get_contents());", '.errdetail {', '.newdetail {', '.infdetail {', "class='table-light'", "bgcolor='$bgcolorAttr'"]) {
            assert.ok(count(ORIGINAL, anchor) >= 1, anchor);
        }
    });
    test('callers still open the route and shared assets expose the class this route relies on', () => {
        for (const caller of CALLERS) assert.ok(text(caller).includes('sl_eob_process.php'), caller);
        const js = text(POPUP_JS);
        assert.ok(js.includes(`'${CONTEXT}'`) && js.includes('findWorkbenchHost') && js.includes('SHELL_ROOT'));
        assert.ok(!/eob|standalone/.test(js), 'shared popup.js stays route-agnostic');
        const css = text(POPUP_CSS);
        for (const [name, value] of [['canvas', 'f3f7f5'], ['ink', '17343b'], ['paper', 'fff'], ['line', 'd9e4e2']]) {
            assert.match(css, new RegExp(`--oe-wb-${name}:\\s*#${value}`, 'i'), name);
        }
    });
});

describe('synthetic candidate', () => {
    const candidate = buildCandidate(ORIGINAL);
    test('verifies, inverts byte-exactly and has the expected shape', () => {
        verifyCandidate(candidate, ORIGINAL);
        assert.ok(Buffer.from(inverse(candidate), 'utf8').equals(originalBytes));
        assert.equal(candidate.length, ORIGINAL.length + BLOCK.length + MARKED_BODY.length - BODY.length);
        assert.equal(count(candidate, '<?php'), count(ORIGINAL, '<?php'));
    });
    test('CSS embeds as 2-space selectors, 4-space properties, grouped one per line, blank line between rules', () => {
        assert.equal(CSS.split('\n\n').length, 3);
        assert.ok(CSS.includes(`  html.${CONTEXT} body.oe-eob-process,\n  html.${OWN} body.oe-eob-process {\n    background-color`));
        assert.ok(!CSS.includes('\t'));
    });

    const inBlock = (fn) => candidate.replace(BLOCK, () => fn(BLOCK));
    const inScript = (extra) => inBlock((b) => b.replace('    listen(true);\n    sync();\n', () => `    ${extra}\n    listen(true);\n    sync();\n`));
    const mutations = [
        ['marker removed', candidate.replace(MARKED_BODY, () => BODY), /presentation marker/],
        ['marker duplicated', candidate.replace(MARKED_BODY, () => "<body class='m-0 oe-eob-process oe-eob-process'>\n"), /presentation marker/],
        ['stray second marker', candidate.replace('<title>', () => "<title class='oe-eob-process'>"), /stray route marker/],
        ['block removed', candidate.replace(BLOCK, () => ''), /missing presentation: block/],
        ['block duplicated', candidate.replace(BLOCK, () => BLOCK + BLOCK), /duplicate presentation: block/],
        ['block relocated into head end', candidate.replace(BLOCK, () => '').replace('</head>', () => BLOCK + '</head>'), /relocated/],
        ['extra PHP edit', candidate.replace('ob_start();', () => 'ob_start(); // x'), /route delta/],
        ['financial edit', candidate.replace("$invoice_total -= $svc['paid'];", () => "$invoice_total += $svc['paid'];"), /route delta/],
        ['markup/action change', candidate.replace('method="get"', () => 'method="post"'), /route delta/],
        ['scope lost (workbench)', inBlock((b) => b.split(`html.${CONTEXT} `).join('')), /screen scope/],
        ['scope lost (standalone)', inBlock((b) => b.split(`html.${OWN} `).join('')), /screen scope/],
        ['screen media lost', inBlock((b) => b.replace('@media screen {', '@media all {')), /screen scope/],
        ['unpaired ink', inBlock((b) => b.replace('    color: var(--oe-wb-ink, #17343b);\n', '')), /palette pair/],
        ['unpaired paper on table', inBlock((b) => b.replace('  html.oe-eob-process-standalone body.oe-eob-process form > table.table {\n    background-color: var(--oe-wb-paper, #fff);\n', () => '  html.oe-eob-process-standalone body.oe-eob-process form > table.table {\n')), /palette pair/],
        ['palette token changed', inBlock((b) => b.replace('#d9e4e2', '#d9e4e3')), /palette tokens/],
        ['geometry added', inBlock((b) => b.replace('    background-color: var(--oe-wb-canvas, #f3f7f5);\n', (m) => `${m}    margin: 0;\n`)), /geometry/],
        ['font added', inBlock((b) => b.replace('    box-shadow:', () => '    font-size: 1rem;\n    box-shadow:')), /geometry/],
        ['script writes storage', inScript("window.localStorage.setItem('x', '1');"), /forbids setItem/],
        ['script assigns opener', inScript('window.opener = null;'), /forbids opener =/],
        ['script polls', inScript('setInterval(sync, 1000);'), /forbids setInterval/],
        ['script fetches', inScript("fetch('/x');"), /forbids fetch/],
        ['script owns shared class', inScript(`html.classList.add('${CONTEXT}');`), new RegExp(`forbids ${CONTEXT}`)],
        ['script reads session storage', inScript("window.sessionStorage.getItem('x');"), /forbids sessionStorage/],
        ['opener guard dropped', inBlock((b) => b.replace('window.opener || ', '')), /requires window\.opener/],
        ['legacy test inverted', inBlock((b) => b.replace("!== 'legacy'", "=== 'workbench'")), /requires getItem/]
    ];
    for (const [name, mutated, expected] of mutations) {
        test(`rejects mutation: ${name}`, () => {
            assert.notEqual(mutated, candidate);
            assert.throws(() => verifyCandidate(mutated, ORIGINAL), expected);
        });
    }
});

// ---- Executable VM tests of the exact block script ----
const ORIGIN = 'https://emr.test';
const classes = (initial = []) => {
    const set = new Set(initial);
    return { add: (n) => set.add(n), remove: (n) => set.delete(n), contains: (n) => set.has(n), list: () => [...set].sort() };
};
const extractScript = (source) => {
    const start = source.indexOf(BEGIN);
    const block = source.slice(start, source.indexOf(END) + END.length);
    const open = block.indexOf('<script>\n') + 9;
    return block.slice(open, block.indexOf('\n</script>'));
};
const SCRIPT = extractScript(buildCandidate(ORIGINAL));

function makeWindow(options = {}) {
    const state = { mode: null, throwGetter: false, throwItem: false, opener: null, openerThrows: false, parentOther: null, parentThrows: false, parsed: false, html: [], ...options };
    const log = { gets: 0, reads: [], writes: [], bodyReads: 0 };
    const listeners = new Map();
    const area = (name) => ({
        name,
        getItem(key) { log.reads.push([name, key]); if (state.throwItem) throw new Error('item'); return state.mode; },
        setItem() { log.writes.push('set'); },
        removeItem() { log.writes.push('remove'); },
        clear() { log.writes.push('clear'); }
    });
    const local = area('local');
    const session = area('session');
    const root = { classList: classes(state.html) };
    const doc = {
        documentElement: root,
        get readyState() { return state.parsed ? 'complete' : 'loading'; },
        get body() { log.bodyReads++; return state.parsed ? { classList: classes() } : null; },
        querySelector: () => null,
        addEventListener() {},
        removeEventListener() {}
    };
    const win = {
        document: doc,
        location: { origin: ORIGIN },
        addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
        removeEventListener(name, fn) { listeners.get(name)?.delete(fn); }
    };
    win.window = win;
    Object.defineProperty(win, 'localStorage', { get() { log.gets++; if (state.throwGetter) throw new Error('getter'); return local; } });
    Object.defineProperty(win, 'opener', { get() { if (state.openerThrows) throw new Error('opener'); return state.opener; } });
    Object.defineProperty(win, 'parent', { get() { if (state.parentThrows) throw new Error('parent'); return state.parentOther || win; } });
    // `win` stays an ordinary object (so its accessors run as written) and is exposed to the
    // script as `window` on a separate VM globals object; contextifying `win` itself changes
    // how throwing getters behave. This is a synthetic model, not real opener discovery.
    // Leaked globals would land on `globals`, so key stability is tracked there as well.
    const globals = { window: win, document: doc };
    const keysBefore = Object.keys(win).concat(Object.keys(globals)).sort();
    vm.runInNewContext(SCRIPT, globals);
    const dispatch = (name, event = {}) => [...(listeners.get(name) ?? [])].forEach((fn) => fn(event));
    const total = () => Object.fromEntries([...listeners].map(([name, set]) => [name, set.size]));
    return { win, state, log, root, dispatch, total, local, session, keysBefore, keysAfter: Object.keys(win).concat(Object.keys(globals)).sort(), classList: () => root.classList.list() };
}

for (const parsed of [false, true]) {
    describe(`inline bootstrap ${parsed ? 'after' : 'before'} body parsing`, () => {
        const world = (options) => makeWindow({ parsed, ...options });

        test('standalone top-level window gets only its own class unless mode is legacy', () => {
            for (const mode of [null, 'workbench', 'anything']) {
                const w = world({ mode });
                assert.deepEqual(w.classList(), [OWN], String(mode));
                assert.deepEqual(w.log.reads, [['local', KEY]]);
            }
            assert.deepEqual(world({ mode: 'legacy' }).classList(), []);
        });
        test('never touches body, writes, globals or timers and registers one listener per event', () => {
            const w = world({ mode: 'workbench' });
            assert.equal(w.log.bodyReads, 0);
            assert.deepEqual(w.log.writes, []);
            assert.deepEqual(w.keysAfter, w.keysBefore);
            assert.deepEqual(w.total(), { storage: 1, pageshow: 1, pagehide: 1 });
        });
        test('storage getter or getItem failures fail closed without throwing', () => {
            assert.deepEqual(world({ throwGetter: true }).classList(), []);
            assert.deepEqual(world({ throwItem: true }).classList(), []);
        });
        test('real opener, framed parent or throwing accessors never read storage', () => {
            for (const options of [{ opener: {} }, { opener: { closed: true } }, { openerThrows: true }, { parentOther: {} }, { parentThrows: true }]) {
                const w = world({ mode: 'workbench', ...options });
                assert.deepEqual(w.classList(), [], JSON.stringify(Object.keys(options)));
                assert.equal(w.log.gets, 0);
                assert.deepEqual(w.log.reads, []);
                w.dispatch('storage', { key: KEY, storageArea: w.local });
                w.dispatch('pageshow', { persisted: true });
                assert.deepEqual(w.classList(), []);
                assert.deepEqual(w.log.reads, []);
            }
        });
        test('storage events re-evaluate only for the key, clear(), and the local area', () => {
            const w = world({ mode: 'workbench' });
            const reads = () => w.log.reads.length;
            w.state.mode = 'legacy';
            w.dispatch('storage', { key: 'other', storageArea: w.local });
            w.dispatch('storage', { key: KEY, storageArea: w.session });
            assert.equal(reads(), 1, 'unrelated key and other area ignored');
            assert.deepEqual(w.classList(), [OWN]);
            w.dispatch('storage', { key: KEY, storageArea: w.local });
            assert.deepEqual(w.classList(), []);
            w.state.mode = 'workbench';
            w.dispatch('storage', { key: null, storageArea: w.local });
            assert.deepEqual(w.classList(), [OWN], 'clear() re-evaluates');
            w.state.throwItem = true;
            w.dispatch('storage', { key: KEY, storageArea: w.local });
            assert.deepEqual(w.classList(), [], 'read failure fails closed');
            w.state.throwItem = false;
            w.state.throwGetter = true;
            w.dispatch('storage', { key: KEY, storageArea: w.local });
            assert.deepEqual(w.classList(), []);
            assert.deepEqual(w.log.writes, []);
        });
        test('pagehide cleans up and pageshow (incl. BFCache) restores without accumulating listeners', () => {
            const w = world({ mode: 'workbench' });
            for (let cycle = 0; cycle < 4; cycle++) {
                w.dispatch('pagehide', { persisted: true });
                assert.deepEqual(w.classList(), []);
                assert.deepEqual(w.total(), { storage: 0, pageshow: 1, pagehide: 1 });
                w.state.mode = cycle % 2 ? 'workbench' : 'legacy';
                w.dispatch('storage', { key: KEY, storageArea: w.local });
                assert.deepEqual(w.classList(), [], 'detached while hidden');
                w.dispatch('pageshow', { persisted: true });
                assert.deepEqual(w.classList(), cycle % 2 ? [OWN] : []);
                assert.deepEqual(w.total(), { storage: 1, pageshow: 1, pagehide: 1 });
            }
            w.dispatch('pageshow', { persisted: false });
            assert.deepEqual(w.total(), { storage: 1, pageshow: 1, pagehide: 1 });
        });
        test('a preexisting class is never owned or removed', () => {
            const w = world({ mode: 'legacy', html: [OWN] });
            assert.deepEqual(w.classList(), [OWN]);
            w.dispatch('storage', { key: KEY, storageArea: w.local });
            w.dispatch('pagehide', {});
            assert.deepEqual(w.classList(), [OWN]);
        });
        test('only the route-owned class changes and the shared classes are untouched', () => {
            const w = world({ mode: 'workbench', html: [CONTEXT, 'oe-workbench-popup'] });
            w.dispatch('pagehide', {});
            assert.deepEqual(w.classList(), [CONTEXT, 'oe-workbench-popup']);
        });
    });
}

describe('shared popup.js delegation (actual unchanged asset)', () => {
    const module_ = { exports: {} };
    vm.runInNewContext(text(POPUP_JS), { module: module_ });
    const api = module_.exports;
    const shell = (active) => ({
        classList: classes(active ? ['workbench-active'] : []),
        ownerDocument: { querySelector: () => (active ? {} : null) }
    });
    // The bootstrap runs inside makeWindow, so the opener must exist up front.
    const withOpener = (active) => {
        const w = makeWindow({ mode: 'workbench', parsed: true, opener: { closed: false, location: { origin: ORIGIN }, document: { body: shell(active) } } });
        w.state.opener.parent = w.state.opener;
        w.state.opener.opener = null;
        return w;
    };

    test('exports the classes the route relies on', () => {
        assert.equal(api.CONTEXT_CLASS, CONTEXT);
        assert.equal(api.POPUP_CLASS, 'oe-workbench-popup');
    });
    test('active opener: popup.js alone owns the shared classes; bootstrap stays out and reads no storage', () => {
        const w = withOpener(true);
        assert.deepEqual(w.classList(), []);
        assert.deepEqual(w.log.reads, []);
        const controller = api.createPopupController({ win: w.win, observe: () => ({ disconnect() {} }) });
        assert.equal(controller.active, true);
        assert.deepEqual(w.classList(), [CONTEXT, 'oe-workbench-popup'].sort());
        w.dispatch('pagehide', {});
        assert.deepEqual(w.classList(), []);
        assert.deepEqual(w.log.reads, []);
    });
    test('inactive opener: neither popup.js nor the bootstrap marks the page', () => {
        const w = withOpener(false);
        const controller = api.createPopupController({ win: w.win, observe: () => ({ disconnect() {} }) });
        assert.equal(controller.active, false);
        assert.deepEqual(w.classList(), []);
        assert.deepEqual(w.log.reads, []);
    });
    test('standalone: popup.js stays inert and disposing it never removes the route class', () => {
        const w = makeWindow({ mode: 'workbench', parsed: true });
        const controller = api.createPopupController({ win: w.win, observe: () => ({ disconnect() {} }) });
        assert.equal(controller.active, false);
        controller.dispose();
        assert.deepEqual(w.classList(), [OWN]);
    });
});

describe('live route candidate acceptance', () => {
    test('live sl_eob_process.php contains exactly the approved presentation delta', () => {
        verifyCandidate(text(ROUTE), ORIGINAL);
    });
});

if (HISTORY) {
    const git = (args) => execFileSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    const lines = (bytes) => bytes.toString('utf8').split('\n').filter(Boolean);
    describe('local Git provenance (--history)', () => {
        test('base commit exists and is a HEAD ancestor', () => {
            assert.doesNotThrow(() => git(['cat-file', '-e', `${BASE}^{commit}`]));
            assert.doesNotThrow(() => git(['merge-base', '--is-ancestor', BASE, 'HEAD']));
        });
        test('fixture and restored live route equal the base blob', () => {
            const blob = git(['show', `${BASE}:${ROUTE}`]);
            assert.equal(blob.length, BYTES);
            assert.equal(sha(blob), HASH);
            assert.ok(blob.equals(originalBytes), 'fixture');
            assert.ok(Buffer.from(inverse(text(ROUTE)), 'utf8').equals(blob), 'restored route');
        });
        test('callers and shared popup assets equal base', () => {
            for (const rel of UNCHANGED) assert.ok(read(rel).equals(git(['show', `${BASE}:${rel}`])), rel);
        });
        test('exactly the intended files changed, including untracked files', () => {
            const changed = new Set([
                ...lines(git(['diff', '--name-only', '--no-renames', BASE])),
                ...lines(git(['ls-files', '--others', '--exclude-standard']))
            ]);
            assert.deepEqual([...changed].sort(), [...ALLOWED].sort());
        });
    });
}

module.exports = { buildCandidate, verifyCandidate, inverse, BLOCK, SCRIPT_SOURCE, STYLE, CSS };
