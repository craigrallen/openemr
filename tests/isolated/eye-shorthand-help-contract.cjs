'use strict';
/* OPEMR-74 portable source contract. The controller owns the genuine RED run.
 * Run: node --test tests/isolated/eye-shorthand-help-contract.cjs
 * Opt-in mandatory provenance: append --history (requires local Git history).
 * This does not execute PHP, render a browser, or measure effective contrast. */

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test } = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const ROUTE = 'interface/forms/eye_mag/help.php';
const FIXTURE = 'tests/fixtures/eye-shorthand-help-original.php.txt';
const CALLER = 'interface/forms/eye_mag/view.php';
const HEADER = 'src/Core/Header.php';
const CONFIG = 'config/config.yaml';
const POPUP_JS = 'interface/clinical-workspace/popup.js';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const BASE = '18647270e0c799189d2dc10f801e8de2bff1a360';
const SHA256 = '183a0fd5ff395b46dd66fea169a3cf51e34c2f3e61ff2e7765f9530f67d3b8c4';
const HISTORY = process.argv.includes('--history');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const count = (source, part) => source.split(part).length - 1;
const original = read(FIXTURE);

const GATE = 'html.oe-workbench-context body.oe-eye-shorthand-help';
const BODY_OLD = '<body>';
const BODY_NEW = '<body class="oe-eye-shorthand-help">';
const CSS = [
    '@media screen {',
    `  ${GATE} {`,
    '    color: var(--oe-wb-ink, #17343b);',
    '    background-color: var(--oe-wb-canvas, #f3f7f5) !important;',
    '  }',
    '',
    `  ${GATE} .card,`,
    `  ${GATE} .table {`,
    '    color: var(--oe-wb-ink, #17343b);',
    '    background-color: var(--oe-wb-paper, #fff);',
    '  }',
    '}',
].join('\n');
const STYLE = `    <style>\n${CSS.split('\n').map((line) => line ? `    ${line}` : '').join('\n')}\n    </style>\n`;
const HEAD_OLD = '    <?php Header::setupHeader(); ?>\n    </head>';
const HEAD_NEW = `    <?php Header::setupHeader(); ?>\n${STYLE}    </head>`;
const BODY_ANCHOR = '    </head>\n    <body>';

function insert(source) {
    assert.equal(count(source, HEAD_OLD), 1, 'unique Header/head anchor');
    assert.equal(count(source, BODY_ANCHOR), 1, 'unique body anchor');
    return source.replace(HEAD_OLD, HEAD_NEW).replace(BODY_OLD, BODY_NEW);
}

function restore(source) {
    if (count(source, STYLE) !== 1 || count(source, BODY_NEW) !== 1) return null;
    return source.replace(STYLE, '').replace(BODY_NEW, BODY_OLD);
}

function verify(source) {
    const errors = [];
    if (count(source, STYLE) !== 1) errors.push('one exact style block required');
    if (count(source, BODY_NEW) !== 1) errors.push('one exact body marker required');
    if (count(source, '<style>') !== 1 || count(source, '</style>') !== 1) errors.push('one style pair required');
    if (count(source, 'oe-eye-shorthand-help') !== 4) errors.push('only three selectors and the body may carry the marker');
    if (!source.includes(HEAD_NEW) || !source.includes('    </head>\n    ' + BODY_NEW)) errors.push('style and marker positions differ');
    if (restore(source) !== original) errors.push('whole original source inverse differs');
    return errors;
}

const synthetic = insert(original);

describe('whole-source presentation contract (portable)', () => {
    test('fixture is the pinned exact original PHP bytes', () => {
        assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, FIXTURE))).digest('hex'), SHA256);
        assert.equal(original.split('\n').length - 1, 1636);
        assert.ok(original.startsWith('<?php\n'));
        assert.ok(original.endsWith('</html>\n<?php exit; ?>\n'));
        assert.equal(count(original, BODY_OLD), 1);
        assert.equal(count(original, '<style>'), 0);
    });

    test('synthetic expected candidate passes exact inverse before production', () => {
        assert.deepEqual(verify(synthetic), []);
        assert.equal(restore(synthetic), original);
    });

    test('screen block has only the exact scoped palette declarations', () => {
        assert.equal(count(CSS, GATE), 3);
        assert.equal(count(CSS, '@media screen'), 1);
        assert.equal(count(CSS, '!important'), 1);
        assert.deepEqual(CSS.split('\n').filter((line) => /^    [\w-]+:/.test(line)), [
            '    color: var(--oe-wb-ink, #17343b);',
            '    background-color: var(--oe-wb-canvas, #f3f7f5) !important;',
            '    color: var(--oe-wb-ink, #17343b);',
            '    background-color: var(--oe-wb-paper, #fff);',
        ]);
        assert.ok(CSS.includes(`  ${GATE} .card,\n  ${GATE} .table {`));
    });
});

describe('anchored negative mutations (portable)', () => {
    function replace(from, to) {
        assert.equal(count(synthetic, from), 1, `unique mutation anchor: ${from}`);
        return synthetic.replace(from, to);
    }
    const mutations = [
        ['body marker removed', replace(BODY_NEW, BODY_OLD)],
        ['body marker renamed', replace(BODY_NEW, '<body class="oe-eye-help">')],
        ['body marker duplicated', replace(BODY_NEW, `${BODY_NEW}\n<!-- oe-eye-shorthand-help -->`)],
        ['style duplicated', replace(STYLE, STYLE + STYLE)],
        ['style moved after head', replace(STYLE + '    </head>', '    </head>\n' + STYLE)],
        ['style missing close', replace('    </style>\n', '')],
        ['print included', replace('@media screen {', '@media screen, print {')],
        ['media widened', replace('@media screen {', '@media all {')],
        ['context gate removed', replace(`  ${GATE} .table {`, '  body.oe-eye-shorthand-help .table {')],
        ['generic popup selector', replace(`  ${GATE} .card,`, '  html.oe-workbench-popup .card,')],
        ['card target changed', replace(`  ${GATE} .card,`, `  ${GATE} .card-body,`)],
        ['table target changed', replace(`  ${GATE} .table {`, `  ${GATE} .table-responsive {`)],
        ['canvas drift', replace('#f3f7f5', '#edf1f4')],
        ['ink drift', replace('color: var(--oe-wb-ink, #17343b);\n        background-color: var(--oe-wb-canvas', 'color: var(--oe-wb-ink, #172b3a);\n        background-color: var(--oe-wb-canvas')],
        ['paper drift', replace('#fff);', '#fffefa);')],
        ['body important removed', replace('background-color: var(--oe-wb-canvas, #f3f7f5) !important;', 'background-color: var(--oe-wb-canvas, #f3f7f5);')],
        ['card important added', replace('background-color: var(--oe-wb-paper, #fff);', 'background-color: var(--oe-wb-paper, #fff) !important;')],
        ['font changed', replace(`      ${GATE} {\n        color:`, `      ${GATE} {\n        font-size: 14px;\n        color:`)],
        ['navbar painted', replace(`      ${GATE} .card,`, `      ${GATE} .navbar { color: red; }\n      ${GATE} .card,`)],
        ['button painted', replace(`      ${GATE} .card,`, `      ${GATE} .btn-link { color: red; }\n      ${GATE} .card,`)],
        ['control painted', replace(`      ${GATE} .card,`, `      ${GATE} textarea { color: red; }\n      ${GATE} .card,`)],
        ['semantic color painted', replace(`      ${GATE} .card,`, `      ${GATE} .text-danger { color: red; }\n      ${GATE} .card,`)],
        ['nav link changed', replace('<a class="navbar-brand" href="#">', '<a class="navbar-brand" href="/other">')],
        ['help copy changed', replace('Introduction: Paper vs. EHR', 'Introduction: Shorthand')],
        ['example changed', replace('D;bll:+2 meibomitis;rll:frank ect, 7x6mm lid margin bcc lat.a;bul:2mm ptosis;rul.+3 dermato.a\n                        </textarea>', 'D;bll:+3 meibomitis;rll:frank ect, 7x6mm lid margin bcc lat.a;bul:2mm ptosis;rul.+3 dermato.a\n                        </textarea>')],
        ['textarea geometry changed', replace('style="height: 13.8rem;"', 'style="height: 14rem;"')],
        ['accordion action changed', replace("$('#hpiAccordion').removeClass('d-none');", "$('#pmhAccordion').removeClass('d-none');")],
        ['Header asset changed', replace('Header::setupHeader();', "Header::setupHeader(['new-asset']);")],
        ['image path changed', replace('/interface/forms/eye_mag/images/sh_hpi.png', '/interface/forms/eye_mag/images/other.png')],
    ];
    for (const [label, source] of mutations) {
        test(`rejects ${label}`, () => {
            assert.notEqual(source, synthetic, label);
            assert.ok(verify(source).length > 0, `${label} escaped contract`);
        });
    }
});

describe('actual caller, Header, palette and cascade source (portable)', () => {
    test('view links this route in a reusable named window', () => {
        assert.match(read(CALLER), /<a\s+target="_shorthand" href="<\?php echo OEGlobalsBag::getInstance\(\)->getWebRoot\(\); \?>\/interface\/forms\/eye_mag\/help\.php">/);
        assert.ok(original.includes('Header::setupHeader();'));
    });
    test('ordinary Header autoloads unchanged popup assets', () => {
        assert.ok(read(HEADER).includes('self::setupAssets(is_array($assets) ? $assets : [$assets], true)'));
        assert.match(read(CONFIG), /\n  workbench-popup:\n    basePath: '%webroot%\/interface\/clinical-workspace\/'\n    script: popup\.js\n    link: popup\.css\n    autoload: true\n/);
        assert.equal(count(synthetic, 'workbench-popup'), 0);
    });
    test('fallbacks match repository popup tokens and keep semantics/controls intact', () => {
        const shared = read(POPUP_CSS);
        for (const token of ['--oe-wb-ink: #17343b;', '--oe-wb-paper: #fff;', '--oe-wb-canvas: #f3f7f5;']) assert.ok(shared.includes(token));
        for (const className of ['card', 'card-header', 'table table-bordered', 'thead-dark', 'text-danger', 'text-success', 'text-muted', 'btn-link', 'form-control']) assert.ok(original.includes(className));
        assert.ok(original.includes('style="color:navy"'));
        assert.ok(shared.includes('html.oe-workbench-popup .table:not('));
        assert.ok(shared.includes('html.oe-workbench-popup .card:not('));
        assert.ok(shared.includes('html.oe-workbench-popup .form-control'));
        assert.equal(count(CSS, 'navbar'), 0);
        assert.equal(count(CSS, '.btn'), 0);
        assert.equal(count(CSS, '.form-control'), 0);
    });
});

// Only real, unchanged popup.js runs. These stand-ins establish source-path class
// behavior, not native target=_shorthand reuse, COOP behavior, CSS paint or contrast.
describe('real popup.js opener traversal and cleanup (synthetic VM)', () => {
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
    function windowFor({ opener = null, parent = null, shellRoot = false, active = false, marker = false, origin = ORIGIN } = {}) {
        const win = { closed: false, location: { origin }, opener, frameElement: null, listeners: [], observations: [] };
        const doc = {
            defaultView: win, readyState: 'complete', listeners: {},
            querySelector: (selector) => selector === '#mainBox [data-workbench-mode]' && shellRoot ? {} : null,
            addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
            removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((value) => value !== fn); },
        };
        doc.documentElement = element(doc);
        doc.body = element(doc, active ? ['workbench-active'] : marker ? ['oe-eye-shorthand-help'] : []);
        win.document = doc;
        win.parent = parent || win;
        win.addEventListener = (type, fn) => { win.listeners.push([type, fn]); };
        win.dispatch = (type, event = {}) => win.listeners.filter(([name]) => name === type).forEach(([, fn]) => fn(event));
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
    const boot = (win) => { win.window = win; vm.runInContext(popupSource, vm.createContext(win), { filename: POPUP_JS }); return win; };
    const classes = (win) => win.document.documentElement.classList.values().sort();
    const gate = (win) => win.document.documentElement.classList.contains('oe-workbench-context') && win.document.body.classList.contains('oe-eye-shorthand-help');
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    test('named-window opener to active shell activates route gate', () => {
        const shell = windowFor({ shellRoot: true, active: true });
        const help = boot(windowFor({ opener: shell, marker: true }));
        assert.deepEqual(classes(help), ['oe-workbench-context', 'oe-workbench-popup']);
        assert.equal(gate(help), true);
        assert.deepEqual(shell.observations, [{ attributes: true, filter: ['class'] }]);
    });
    test('opener through a legacy intermediate reaches active shell', () => {
        const shell = windowFor({ shellRoot: true, active: true });
        const intermediate = windowFor({ opener: shell });
        const help = boot(windowFor({ opener: intermediate, marker: true }));
        assert.equal(gate(help), true);
    });
    test('nested parent then opener reaches active shell', () => {
        const shell = windowFor({ shellRoot: true, active: true });
        const parent = windowFor({ opener: shell });
        const help = boot(windowFor({ parent, marker: true }));
        assert.equal(gate(help), true);
    });
    test('legacy transition activates, deactivates, and preserves body marker', async () => {
        const shell = windowFor({ shellRoot: true });
        const help = boot(windowFor({ opener: shell, marker: true }));
        assert.deepEqual(classes(help), []);
        shell.document.body.classList.add('workbench-active');
        await flush();
        assert.equal(gate(help), true);
        shell.document.body.classList.remove('workbench-active');
        await flush();
        assert.deepEqual(classes(help), []);
        assert.deepEqual(help.document.body.classList.values(), ['oe-eye-shorthand-help']);
    });
    test('pagehide releases observer and owned classes', async () => {
        const shell = windowFor({ shellRoot: true, active: true });
        const help = boot(windowFor({ opener: shell, marker: true }));
        help.dispatch('pagehide');
        assert.deepEqual(classes(help), []);
        shell.document.body.classList.remove('workbench-active');
        shell.document.body.classList.add('workbench-active');
        await flush();
        assert.deepEqual(classes(help), []);
        assert.deepEqual(help.document.body.classList.values(), ['oe-eye-shorthand-help']);
    });
    test('standalone, cross-origin, closed opener and absent marker cannot activate gate', () => {
        assert.equal(gate(boot(windowFor({ marker: true }))), false);
        const foreign = windowFor({ shellRoot: true, active: true, origin: 'https://other.test' });
        assert.equal(gate(boot(windowFor({ opener: foreign, marker: true }))), false);
        const closed = windowFor({ shellRoot: true, active: true });
        closed.closed = true;
        assert.equal(gate(boot(windowFor({ opener: closed, marker: true }))), false);
        const shell = windowFor({ shellRoot: true, active: true });
        assert.equal(gate(boot(windowFor({ opener: shell }))), false);
    });
});

describe('production route (portable)', () => {
    test('current route must equal exact synthetic presentation', () => {
        assert.deepEqual(verify(synthetic), []);
        assert.deepEqual(verify(read(ROUTE)), []);
    });
});

if (HISTORY) {
    describe('mandatory pinned-base Git provenance (--history)', () => {
        const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
        test('exact base exists and is an ancestor of HEAD', () => {
            const rev = git(['rev-parse', '--verify', `${BASE}^{commit}`]);
            assert.equal(rev.error, undefined, 'Git unavailable');
            assert.equal(rev.status, 0, String(rev.stderr));
            assert.equal(String(rev.stdout).trim(), BASE);
            assert.equal(git(['merge-base', '--is-ancestor', BASE, 'HEAD']).status, 0, 'HEAD differs from pinned history');
        });
        test('fixture and inverse equal Git base bytes', () => {
            const shown = git(['show', `${BASE}:${ROUTE}`]);
            assert.equal(shown.error, undefined, 'Git unavailable');
            assert.equal(shown.status, 0, String(shown.stderr));
            assert.deepEqual(fs.readFileSync(path.join(ROOT, FIXTURE)), shown.stdout);
            const restored = restore(read(ROUTE));
            assert.notEqual(restored, null, 'production presentation absent or malformed');
            assert.deepEqual(Buffer.from(restored), shown.stdout);
        });
    });
}
