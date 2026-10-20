'use strict';

/**
 * OPEMR-62 source contract. Portable: node --test tests/patient-linked-notes.contract.test.cjs
 * Mandatory local provenance: node tests/patient-linked-notes.contract.test.cjs --history
 * No PHP rendering, browser, contrast, or clinical acceptance is asserted here.
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
const ROUTE = 'interface/patient_file/summary/pnotes.php';
const FIXTURE = 'tests/fixtures/patient-linked-notes-original.php.txt';
const HASH = '7a6f0a526b65d1a67891a3fbdc068d1a168f0a9f3b137ba100ce1ab7671bcdd9';
const HISTORY = process.argv.includes('--history');
const HEADER = '<?php Header::setupHeader(); ?>\n';
const BODY = '<body class="body_bottom">';
const MARKED_BODY = '<body class="body_bottom oe-patient-linked-notes">';
const PREFIX = 'html.oe-workbench-context body.oe-patient-linked-notes';
const RULES = [
    [PREFIX, [['color', 'var(--oe-wb-ink)'], ['background-color', 'var(--oe-wb-canvas)']]],
    [`${PREFIX} #pnotes`, [['color', 'var(--oe-wb-ink)'], ['background-color', 'var(--oe-wb-paper)'], ['box-shadow', 'inset 0 0 0 1px var(--oe-wb-line)']]],
    [`${PREFIX} #pnotes > table`, [['color', 'var(--oe-wb-ink)'], ['background-color', 'var(--oe-wb-paper)']]],
    [`${PREFIX} #pnotes > a`, [['color', 'var(--oe-wb-petrol)']]]
];
const CSS = [
    '@media screen {',
    ...RULES.flatMap(([selector, declarations], i) => [
        ...(i ? [''] : []),
        `  ${selector} {`,
        ...declarations.map(([property, value]) => `    ${property}: ${value};`),
        '  }'
    ]),
    '}'
].join('\n');
const SEAM = `<style>\n${CSS}\n</style>\n`;
const UNCHANGED = [
    'config/config.yaml',
    'src/Core/Header.php',
    'interface/clinical-workspace/popup.js',
    'interface/clinical-workspace/popup.css',
    'library/dialog.js',
    'interface/forms/eye_mag/js/eye_base.php',
    'interface/themes/core/patient/notes.scss',
    'interface/themes/color_base.scss',
    'interface/themes/oe-styles/style_dark.scss',
    'interface/themes/oe-styles/style_solar.scss'
];
const ALLOWED = new Set([ROUTE, FIXTURE, 'tests/patient-linked-notes.contract.test.cjs', 'tests/js/patient-linked-notes.test.js', 'docs/clinical-ui/PATIENT-LINKED-NOTES-POPUP.md']);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel));
const text = (rel) => read(rel).toString('utf8');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const count = (source, needle) => source.split(needle).length - 1;
const originalBytes = read(FIXTURE);
const ORIGINAL = originalBytes.toString('utf8');

function replaceOnce(source, from, to) {
    assert.equal(count(source, from), 1, `anchor must be unique: ${from}`);
    const changed = source.replace(from, () => to);
    assert.notEqual(changed, source);
    return changed;
}

function buildCandidate(original) {
    return replaceOnce(replaceOnce(original, HEADER, HEADER + SEAM), BODY, MARKED_BODY);
}

function inspectCss(css) {
    assert.ok(!css.includes('!important'), 'no important overrides');
    assert.equal(count(css, '@media'), 1, 'one screen media wrapper');
    assert.ok(css.startsWith('@media screen {\n') && css.endsWith('\n}'), 'screen-only CSS');
    const blocks = css.slice('@media screen {\n'.length, -2).split('\n\n');
    assert.equal(blocks.length, RULES.length, 'exact rule allowlist');
    blocks.forEach((block, index) => {
        const match = /^ {2}([^\n{}]+) \{\n((?: {4}[^\n]+\n)+) {2}\}$/.exec(block);
        assert.ok(match, 'two-space standalone CSS format');
        assert.equal(match[1], RULES[index][0], 'exact scoped selector');
        const lines = match[2].trimEnd().split('\n');
        assert.equal(lines.length, RULES[index][1].length, 'exact declaration allowlist');
        lines.forEach((line, at) => {
            const declaration = /^ {4}([a-z-]+): ([^;]+);$/.exec(line);
            assert.ok(declaration, 'declaration format');
            assert.deepEqual(declaration.slice(1), RULES[index][1][at], 'approved property and token');
        });
    });
    assert.equal(css, CSS, 'no additional CSS, geometry, fonts, controls, or wrapper styling');
}

function verifyCandidate(source, original) {
    assert.equal(count(source, '<body'), 1, 'one body marker');
    assert.equal(count(source, MARKED_BODY), 1, 'route-specific body class');
    assert.equal(count(source, HEADER), 1, 'original Header call');
    assert.equal(count(source, '<style>'), 1, 'one inline style');
    assert.equal(count(source, '</style>'), 1, 'balanced inline style');
    const start = source.indexOf(HEADER) + HEADER.length;
    const end = source.indexOf('</head>', start);
    assert.ok(end > start, 'head closing marker');
    const region = source.slice(start, end);
    assert.ok(region.startsWith('<style>\n') && region.endsWith('</style>\n'), 'style directly after Header, before head closes');
    inspectCss(region.slice('<style>\n'.length, -'\n</style>\n'.length));
    assert.equal(region, SEAM, 'exact style seam');
    const restored = replaceOnce(replaceOnce(source, SEAM, ''), MARKED_BODY, BODY);
    assert.equal(restored, original, 'full inverse must reproduce every original PHP, JS, SQL, ACL, escaping, and markup byte');
}

describe('frozen original and presentation seam', () => {
    test('fixture has the base byte count and digest', () => {
        assert.equal(originalBytes.length, 5464);
        assert.equal(sha(originalBytes), HASH);
    });

    test('route anchors and semantic content are present once in the original', () => {
        for (const anchor of [HEADER, BODY, '<div id=\'pnotes\'>', 'getPnotesByDate(', 'generate_display_field(', 'AclMain::aclCheckCore(\'patients\', \'notes\')', 'sqlQuery("SELECT foreign_id FROM documents WHERE id = ?"', 'sqlQuery("SELECT patient_id FROM procedure_order WHERE procedure_order_id = ?"', '"<span style=\'color:red\'>"']) {
            assert.equal(count(ORIGINAL, anchor), 1, anchor);
        }
        assert.equal(count(ORIGINAL, 'toggleClass("highlight")'), 2);
        assert.equal(count(ORIGINAL, '<style>'), 0);
        assert.ok(ORIGINAL.includes('text($billing_note)') && ORIGINAL.includes('nl2br(text($body))'));
        assert.ok(ORIGINAL.includes("class='alert' onclick='top.restoreSession()'"));
    });

    const candidate = buildCandidate(ORIGINAL);
    test('synthetic candidate passes, untouched original is RED', () => {
        assert.doesNotThrow(() => verifyCandidate(candidate, ORIGINAL));
        assert.throws(() => verifyCandidate(ORIGINAL, ORIGINAL), /route-specific body class/);
    });

    const mutations = [
        ['missing seam', (s) => replaceOnce(s, SEAM, '')],
        ['duplicate seam', (s) => replaceOnce(s, SEAM, SEAM + SEAM)],
        ['relocated seam', (s) => replaceOnce(replaceOnce(s, SEAM, ''), '</head>', '</head>\n' + SEAM)],
        ['missing body class', (s) => replaceOnce(s, MARKED_BODY, BODY)],
        ['extra body class', (s) => replaceOnce(s, MARKED_BODY, '<body class="body_bottom oe-patient-linked-notes extra">')],
        ['duplicated body', (s) => replaceOnce(s, MARKED_BODY, MARKED_BODY + MARKED_BODY)],
        ['print media', (s) => replaceOnce(s, '@media screen {', '@media screen, print {')],
        ['unscoped selector', (s) => replaceOnce(s, `  ${PREFIX} {`, '  body.oe-patient-linked-notes {')],
        ['broad descendant repaint', (s) => replaceOnce(s, `${PREFIX} #pnotes > table`, `${PREFIX} #pnotes table *`)],
        ['billing repaint', (s) => replaceOnce(s, `${PREFIX} #pnotes > table`, `${PREFIX} #pnotes .billing`)],
        ['highlight repaint', (s) => replaceOnce(s, `${PREFIX} #pnotes > table`, `${PREFIX} #pnotes .highlight`)],
        ['alert link repaint', (s) => replaceOnce(s, `${PREFIX} #pnotes > a`, `${PREFIX} #pnotes a`)],
        ['wrong token', (s) => replaceOnce(s, 'var(--oe-wb-canvas)', 'var(--oe-wb-paper)')],
        ['geometry', (s) => replaceOnce(s, 'box-shadow: inset 0 0 0 1px var(--oe-wb-line);', 'padding: 1rem;')],
        ['font', (s) => replaceOnce(s, 'color: var(--oe-wb-petrol);', 'font-size: 1rem;')],
        ['control', (s) => replaceOnce(s, `${PREFIX} #pnotes > a`, `${PREFIX} button`)],
        ['important', (s) => replaceOnce(s, 'color: var(--oe-wb-ink);\n    background-color: var(--oe-wb-canvas);', 'color: var(--oe-wb-ink) !important;\n    background-color: var(--oe-wb-canvas);')],
        ['SQL', (s) => replaceOnce(s, 'WHERE id = ?', 'WHERE id = $docid')],
        ['ACL', (s) => replaceOnce(s, "AclMain::aclCheckCore('patients', 'notes')", 'true')],
        ['escaping', (s) => replaceOnce(s, 'text($billing_note)', '$billing_note')],
        ['note order', (s) => replaceOnce(s, '$N = 15;', '$N = 20;')],
        ['helper', (s) => replaceOnce(s, "generate_display_field(['data_type' => '1','list_id' => 'note_type'], $iter['title'])", "text($iter['title'])")],
        ['mouseover', (s) => replaceOnce(s, '$(this).toggleClass("highlight"); });\n    $(".noterow").on("mouseout"', '$(this).addClass("highlight"); });\n    $(".noterow").on("mouseout"')],
        ['title markup', (s) => replaceOnce(s, '<span class="title">', '<h2 class="title">')]
    ];
    for (const [name, mutate] of mutations) {
        test(`rejects ${name}`, () => {
            const changed = mutate(candidate);
            assert.notEqual(changed, candidate);
            assert.throws(() => verifyCandidate(changed, ORIGINAL));
        });
    }
});

describe('unchanged launch and popup context chain', () => {
    test('Header autoload and palette tokens are available before the proposed seam', () => {
        const header = text('src/Core/Header.php');
        const config = text('config/config.yaml');
        const popupCss = text('interface/clinical-workspace/popup.css');
        assert.ok(ORIGINAL.includes(HEADER) && !ORIGINAL.includes('no_workbench-popup'));
        assert.ok(header.includes('self::setupAssets(is_array($assets) ? $assets : [$assets], true)'));
        assert.ok(header.includes("$autoload = $opts['autoload'] ?? false"));
        assert.ok(config.includes("  workbench-popup:\n    basePath: '%webroot%/interface/clinical-workspace/'\n    script: popup.js\n    link: popup.css\n    autoload: true\n"));
        for (const token of ['--oe-wb-ink: #17343b;', '--oe-wb-paper: #fff;', '--oe-wb-canvas: #f3f7f5;', '--oe-wb-line: #d9e4e2;', '--oe-wb-petrol: #086878;']) assert.ok(popupCss.includes(token), token);
        assert.ok(popupCss.includes('@media screen {\n  html.oe-workbench-context,'));
    });

    test('real caller uses the existing resizable iframe dialog', () => {
        const eye = text('interface/forms/eye_mag/js/eye_base.php');
        const functionSource = eye.slice(eye.indexOf('function showpnotes(docid) {'), eye.indexOf('function getTimeStamp()'));
        assert.ok(functionSource.startsWith('function showpnotes(docid) {'));
        const calls = [];
        const context = vm.createContext({ base: '/emr', encodeURIComponent, dlgopen: (...args) => calls.push(args) });
        vm.runInContext(functionSource, context);
        assert.equal(context.showpnotes('a & b'), false);
        assert.deepEqual(JSON.parse(JSON.stringify(calls)), [[
            '/emr/interface/patient_file/summary/pnotes.php?docid=a%20%26%20b', 'pno1', 'modal-xl', 500, '', '',
            { buttons: [{ text: 'Done', close: true, style: 'default btn-sm' }], sizeHeight: 'auto', allowResize: true, allowDrag: true, dialogId: '', type: 'iframe' }
        ]]);
        const dialog = text('library/dialog.js');
        assert.ok(dialog.includes('function dlgopen(url, winname, width, height, forceNewWindow, title, opts)'));
        assert.ok(dialog.includes('class="modal fade dialogModal"'));
        assert.ok(dialog.includes('class="modalIframe w-100 h-100 border-0"'));
    });

    test('real popup.js activates through a modal iframe parent and disposes on legacy mode', () => {
        const listeners = new Map();
        const classes = (...initial) => {
            const values = new Set(initial);
            return { contains: (name) => values.has(name), add: (name) => values.add(name), remove: (name) => values.delete(name) };
        };
        const shell = { location: { origin: 'https://emr.test' }, closed: false, document: { body: { classList: classes('workbench-active') } } };
        shell.parent = shell;
        shell.document.body.ownerDocument = { querySelector: () => ({}) };
        const html = { classList: classes() };
        const frame = {
            parent: shell, opener: null, frameElement: { closest: (selector) => selector === '.dialogModal' ? {} : null },
            location: { origin: 'https://emr.test' },
            document: { documentElement: html, readyState: 'complete' },
            addEventListener: (name, callback) => listeners.set(name, callback)
        };
        let sync;
        let disconnected = false;
        const moduleContext = vm.createContext({ module: { exports: {} } });
        vm.runInContext(text('interface/clinical-workspace/popup.js'), moduleContext);
        const popup = moduleContext.module.exports;
        const controller = popup.createPopupController({ win: frame, observe: (_body, callback) => { sync = callback; return { disconnect: () => { disconnected = true; } }; } });
        assert.equal(controller.active, true);
        assert.ok(html.classList.contains('oe-workbench-context') && html.classList.contains('oe-workbench-popup'));
        shell.document.body.classList.remove('workbench-active');
        sync();
        assert.equal(controller.active, false);
        assert.ok(!html.classList.contains('oe-workbench-context') && !html.classList.contains('oe-workbench-popup'));
        shell.document.body.classList.add('workbench-active');
        sync();
        assert.ok(html.classList.contains('oe-workbench-context'));
        listeners.get('pagehide')();
        assert.ok(disconnected && !html.classList.contains('oe-workbench-context') && !html.classList.contains('oe-workbench-popup'));
    });

    test('legacy and print have no matching palette selectors', () => {
        inspectCss(CSS);
        assert.ok(RULES.every(([selector]) => selector.startsWith('html.oe-workbench-context body.oe-patient-linked-notes')));
        assert.ok(!CSS.includes('oe-workbench-popup') && !CSS.includes('@media print'));
        assert.equal(buildCandidate(ORIGINAL).replace(SEAM, '').replace(MARKED_BODY, BODY), ORIGINAL);
    });
});

test('live route contains exactly the approved presentation delta', () => {
    verifyCandidate(text(ROUTE), ORIGINAL);
});

if (HISTORY) {
    const git = (args) => execFileSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 });
    const lines = (bytes) => bytes.toString('utf8').split('\n').filter(Boolean);
    describe('mandatory local Git provenance', () => {
        test('base commit is HEAD ancestor', () => {
            git(['cat-file', '-e', `${BASE}^{commit}`]);
            git(['merge-base', '--is-ancestor', BASE, 'HEAD']);
        });
        test('fixture equals the exact base route blob', () => {
            const blob = git(['show', `${BASE}:${ROUTE}`]);
            assert.equal(sha(blob), HASH);
            assert.ok(blob.equals(originalBytes));
        });
        test('launch, assets, popup, and relevant theme sources equal base', () => {
            for (const rel of UNCHANGED) assert.ok(read(rel).equals(git(['show', `${BASE}:${rel}`])), rel);
        });
        test('changed paths stay within the route and four requested files', () => {
            const changed = new Set([...lines(git(['diff', '--name-only', '--no-renames', BASE])), ...lines(git(['ls-files', '--others', '--exclude-standard']))]);
            assert.deepEqual([...changed].filter((rel) => !ALLOWED.has(rel)), []);
            for (const rel of [...ALLOWED].filter((rel) => rel !== ROUTE)) assert.ok(changed.has(rel), rel);
        });
    });
}

module.exports = { buildCandidate, verifyCandidate, SEAM, MARKED_BODY };
