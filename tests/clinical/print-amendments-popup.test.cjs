'use strict';

/*
 * OPEMR-54 contract for interface/patient_file/summary/print_amendments.php opened as a
 * workbench popup from list_amendments.php (plain window.open(url), no features).
 *
 * Dependency-free (node:test, assert, fs, path, crypto). Portable run, no git:
 *   node --test tests/clinical/print-amendments-popup.test.cjs
 * Mandatory Git-base authentication of the frozen fixture (controller/CI with history):
 *   REQUIRE_GIT_BASELINE=1 node --test tests/clinical/print-amendments-popup.test.cjs
 * Another checkout can be targeted with PRINT_AMENDMENTS_TARGET_ROOT=<repo root>; the
 * frozen fixture always comes from this test tree.
 *
 * The only accepted production delta is:
 *   1. one <style media="screen"> directly after Header::setupHeader(), closing the <head>;
 *   2. one extra class, oe-print-amendments-document, on the existing body_top <body>.
 * Removing exactly that delta must give back the frozen original byte for byte, so every
 * query, escape, translation, date format, raw table attribute and the printLogPrint
 * opener call stays untouched.
 *
 * Embedding format: <style> tags at 4 spaces (the Header line's indent), selectors at 6,
 * declarations at 8. Removing the common 6-space prefix leaves 2-space declarations.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = process.env.PRINT_AMENDMENTS_TARGET_ROOT
    ? path.resolve(process.env.PRINT_AMENDMENTS_TARGET_ROOT)
    : path.resolve(__dirname, '..', '..');
const ROUTE = 'interface/patient_file/summary/print_amendments.php';
const CALLER = 'interface/patient_file/summary/list_amendments.php';
// Non-executable extension: PHP scanners and the web server must never run the frozen copy.
const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'print-amendments-original.php.txt');
const BASE_COMMIT = '18647270e0c799189d2dc10f801e8de2bff1a360';
// SHA-256 of the fixture bytes, pinned by the controller after a byte-for-byte check against
// BASE_COMMIT:ROUTE. Any byte change to the fixture must fail this pin.
const FIXTURE_SHA256 = '18755cabbc1a2cbd63194638c529f899361aafd0361aef6f8d32e68f305e3bc5';

const MARKER = 'oe-print-amendments-document';
const HEADER_LINE = '    <?php Header::setupHeader(); ?>\n';
const HEAD_CLOSE = '</head>\n';
const STYLE_OPEN = '    <style media="screen">\n';
const STYLE_CLOSE = '    </style>\n';
const BODY_ORIGINAL = '<body class="body_top">';
const BODY_MARKED = `<body class="body_top ${MARKER}">`;
const SCOPE = `html.oe-workbench-context body.${MARKER}`;

// Exact allowlist, in order: ink on canvas for the sheet, ink on paper with a quiet inset
// edge for the body's direct-child raw tables. Colour only; no geometry, fonts or print.
const EXPECTED_RULES = [
    [SCOPE, [
        ['color', 'var(--oe-wb-ink, #17343b)'],
        ['background-color', 'var(--oe-wb-canvas, #f3f7f5)'],
    ]],
    [`${SCOPE} > table`, [
        ['color', 'var(--oe-wb-ink, #17343b)'],
        ['background-color', 'var(--oe-wb-paper, #fff)'],
        ['box-shadow', 'inset 0 0 0 1px var(--oe-wb-line, #d9e4e2)'],
    ]],
];
const ALLOWED_PROPS = new Set(['color', 'background-color', 'box-shadow']);

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const count = (haystack, needle) => haystack.split(needle).length - 1;

function renderStyle(rules) {
    const body = rules
        .map(([selector, decls]) => `      ${selector} {\n`
            + decls.map(([prop, value]) => `        ${prop}: ${value};\n`).join('')
            + '      }\n')
        .join('\n');
    return STYLE_OPEN + body + STYLE_CLOSE;
}

const STYLE_BLOCK = renderStyle(EXPECTED_RULES);
const SEAM = HEADER_LINE + STYLE_BLOCK;

// Inside <style>: blank, 6-space selector, 8-space declaration or 6-space closing brace.
const CANONICAL_CSS_LINE = /^(?:| {6}[^\s{}][^{}]*\{| {8}[a-z-]+: [^;]+;| {6}\})$/;
const FORMAT_PROBLEM = 'style block must use 6-space selectors and 8-space declarations';

// The one synthetic candidate, built from exactly one verified anchor of each kind.
function buildCandidate(original) {
    assert.equal(count(original, HEADER_LINE + HEAD_CLOSE), 1, 'exactly one Header/</head> anchor in the original');
    assert.equal(count(original, BODY_ORIGINAL), 1, 'exactly one body_top anchor in the original');
    return original
        .replace(HEADER_LINE + HEAD_CLOSE, () => SEAM + HEAD_CLOSE)
        .replace(BODY_ORIGINAL, () => BODY_MARKED);
}

// Exact inverse: strips only the approved seam; anything else survives and breaks equality.
function invert(source) {
    let out = source;
    if (count(out, SEAM) === 1) out = out.replace(SEAM, () => HEADER_LINE);
    if (count(out, BODY_MARKED) === 1) out = out.replace(BODY_MARKED, () => BODY_ORIGINAL);
    return out;
}

function extractStyle(source) {
    const start = source.indexOf(HEADER_LINE + STYLE_OPEN);
    if (start === -1) return null;
    const from = start + HEADER_LINE.length + STYLE_OPEN.length;
    const end = source.indexOf(STYLE_CLOSE, from);
    return end === -1 ? null : source.slice(from, end);
}

function parseCss(css) {
    const problems = [];
    if (/\/\*|@|!important|\\/i.test(css)) problems.push('style may not contain comments, at-rules (print/media), !important or escapes');
    const rules = [];
    const rest = css.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, rawSelector, body) => {
        const selector = rawSelector.trim().replace(/\s+/g, ' ');
        if (rules.some(([s]) => s === selector)) problems.push(`duplicate selector ${selector}`);
        const decls = [];
        for (const raw of body.split(';')) {
            const decl = raw.trim();
            if (!decl) continue;
            const colon = decl.indexOf(':');
            if (colon < 1) {
                problems.push(`malformed declaration "${decl}"`);
                continue;
            }
            const prop = decl.slice(0, colon).trim().toLowerCase();
            if (!ALLOWED_PROPS.has(prop)) problems.push(`non-allowlisted property ${prop} in ${selector}`);
            if (decls.some(([p]) => p === prop)) problems.push(`duplicate ${prop} in ${selector}`);
            decls.push([prop, decl.slice(colon + 1).trim().replace(/\s+/g, ' ')]);
        }
        rules.push([selector, decls]);
        return '';
    });
    if (rest.trim() !== '') problems.push('CSS text outside rules');
    return { rules, problems };
}

function validate(source, original) {
    const problems = [];
    if (count(source, HEADER_LINE) !== 1) problems.push('Header::setupHeader() must appear exactly once');
    if (count(source, '<style') !== 1 || count(source, '</style>') !== 1) problems.push('exactly one <style> element is allowed');
    if (count(source, HEADER_LINE + STYLE_OPEN) !== 1) problems.push('<style media="screen"> must directly follow Header::setupHeader()');
    if (count(source, STYLE_CLOSE + HEAD_CLOSE) !== 1) problems.push('the style block must close the <head>');
    if (count(source, BODY_MARKED) !== 1) problems.push(`the existing body_top <body> must carry ${MARKER} exactly once`);
    if (count(source, MARKER) !== 3) problems.push(`${MARKER} must appear 3 times (2 selectors, 1 class); found ${count(source, MARKER)}`);
    const css = extractStyle(source);
    if (css === null) {
        problems.push('missing screen presentation: no style block after the Header anchor');
    } else {
        const bad = css.split('\n').filter((line) => !CANONICAL_CSS_LINE.test(line));
        if (bad.length) problems.push(`${FORMAT_PROBLEM}; non-canonical lines: ${JSON.stringify(bad)}`);
        const parsed = parseCss(css);
        problems.push(...parsed.problems);
        if (JSON.stringify(parsed.rules) !== JSON.stringify(EXPECTED_RULES)) {
            problems.push(`rules or order differ from the allowlist: ${JSON.stringify(parsed.rules)}`);
        }
    }
    if (invert(source) !== original) problems.push('inverse of the presentation delta differs from the frozen original');
    return problems;
}

// The caller's launch must stay a bare window.open(url): opener kept, no fixed size.
const CALLER_LAUNCH = '        var url = "print_amendments.php?ids=" + encodeURIComponent(amendments);\n        window.open(url);\n';

function validateCaller(source) {
    const problems = [];
    if (count(source, CALLER_LAUNCH) !== 1) problems.push('caller must launch with exactly one bare window.open(url)');
    if (count(source, 'window.open(') !== 1) problems.push('caller must contain exactly one window.open');
    if (/noopener|noreferrer|width=|height=/.test(source)) problems.push('caller must not sever the opener or fix a popup size');
    return problems;
}

function luminance(hex) {
    const v = hex.slice(1);
    const full = v.length === 3 ? [...v].map((c) => c + c).join('') : v;
    const [r, g, b] = [0, 2, 4]
        .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

const swap = (from, to) => (c) => {
    assert.equal(count(c, from), 1, `mutation anchor must be unique: ${JSON.stringify(from)}`);
    return c.replace(from, () => to);
};

const original = fs.readFileSync(FIXTURE, 'utf8');

test('frozen fixture digest is pinned', () => {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(FIXTURE)).digest('hex');
    assert.ok(FIXTURE_SHA256, `FIXTURE_SHA256 is not pinned; fixture sha256 is ${actual}`);
    assert.equal(actual, FIXTURE_SHA256);
});

test(`fixture equals ${BASE_COMMIT}:${ROUTE} (REQUIRE_GIT_BASELINE=1)`, {
    skip: process.env.REQUIRE_GIT_BASELINE === '1' ? false : 'portable mode: set REQUIRE_GIT_BASELINE=1 where Git history exists',
}, () => {
    // Only reached on request; any git failure throws and fails the test.
    const { execFileSync } = require('node:child_process');
    const base = execFileSync('git', ['show', `${BASE_COMMIT}:${ROUTE}`], { cwd: ROOT });
    assert.ok(base.equals(fs.readFileSync(FIXTURE)), `fixture differs byte-wise from ${BASE_COMMIT}:${ROUTE}`);
});

test('frozen original has the anchors and legacy behaviour the seam must preserve', () => {
    for (const needle of [
        "border='1' cellspacing=0 cellpadding=3 style='width:75%;margin-top:10px;margin-bottom:20px;",
        '"page-break-after:always"',
        'text(oeFormatShortDate($created_date))',
        'WHERE a.amendment_id = ?";',
        '<script>\n    opener.top.printLogPrint(window);\n</script>\n',
    ]) {
        assert.equal(count(original, needle), 1, needle);
    }
    // Raw legacy tables: no Bootstrap .table class for popup.css to recolour.
    assert.equal(count(original, 'echo "<table>";'), 1);
    assert.equal(count(original, 'class=\'table'), 0);
    assert.equal(count(original, 'class="table'), 0);
});

test('activation context the seam relies on is present', () => {
    assert.match(read('config/config.yaml'), / {2}workbench-popup:\n {4}basePath: '%webroot%\/interface\/clinical-workspace\/'\n {4}script: popup\.js\n {4}link: popup\.css\n {4}autoload: true\n/);
    assert.ok(read('interface/clinical-workspace/popup.js').includes("const CONTEXT_CLASS = 'oe-workbench-context';"));
    const popupCss = read('interface/clinical-workspace/popup.css');
    for (const [, token, fallback] of Array.from(JSON.stringify(EXPECTED_RULES).matchAll(/var\((--oe-wb-[a-z-]+), (#[0-9a-f]+)\)/g))) {
        assert.ok(popupCss.includes(`    ${token}: ${fallback};\n`), `${token} default is ${fallback} in popup.css`);
    }
});

test('opener activation: window.open(url) keeps the context, closed or severed openers stay inert', () => {
    const { findWorkbenchHost } = require(path.join(ROOT, 'interface/clinical-workspace/popup.js'));
    const origin = 'https://emr.test';
    const shell = (closed = false) => {
        const win = {
            closed,
            location: { origin },
            document: { body: { classList: { contains: (c) => c === 'workbench-active' } } },
            opener: null,
        };
        win.parent = win;
        return win;
    };
    const self = {};
    const opened = findWorkbenchHost({ self, parentWindow: self, openerWindow: shell(), origin });
    assert.ok(opened && opened.popup === true, 'an opener on the active shell yields popup context');
    assert.equal(findWorkbenchHost({ self, parentWindow: self, openerWindow: shell(true), origin }), null, 'closed opener');
    assert.equal(findWorkbenchHost({ self, parentWindow: self, openerWindow: null, origin }), null, 'noopener / no opener');
});

test('caller launch is the live bare window.open(url) and alterations are rejected', () => {
    const caller = read(CALLER);
    assert.deepEqual(validateCaller(caller), []);
    const mutants = {
        'noopener': swap('window.open(url);', "window.open(url, '_blank', 'noopener');"),
        'fixed size': swap('window.open(url);', "window.open(url, '', 'width=800,height=600');"),
        'route changed': swap('"print_amendments.php?ids="', '"print_amendments.php?pid=" + pid + "&ids="'),
        'second launch': swap('window.open(url);\n', 'window.open(url);\n        window.open(url);\n'),
    };
    for (const [name, mutate] of Object.entries(mutants)) {
        assert.notDeepEqual(validateCaller(mutate(caller)), [], `caller mutant accepted: ${name}`);
    }
});

test('palette pairs meet AAA contrast', () => {
    assert.ok(contrast('#17343b', '#f3f7f5') >= 7, 'ink on canvas');
    assert.ok(contrast('#17343b', '#ffffff') >= 7, 'ink on paper');
});

test('synthetic candidate passes and inverts to the frozen original', () => {
    const candidate = buildCandidate(original);
    assert.deepEqual(validate(candidate, original), []);
    assert.equal(invert(candidate), original);
    assert.ok(candidate.includes(`${HEADER_LINE}${STYLE_BLOCK}${HEAD_CLOSE}\n${BODY_MARKED}\n`));
    assert.notDeepEqual(validate(original, original), [], 'the original alone is not a candidate');
});

test('mutations of the candidate are rejected', () => {
    const candidate = buildCandidate(original);
    const tableRule = `${SCOPE} > table {`;
    // Same rules and values, declarations nested 4 (not 2) under their selector.
    const deeperIndent = STYLE_BLOCK.replace(/^ {8}(?=[a-z])/gm, ' '.repeat(10));
    const mutants = {
        'translation helper': swap('xlt("Amendments for")', 'xl("Amendments for")'),
        'name escaping': swap('text($patientName)', '$patientName'),
        'history date format': swap('text(oeFormatShortDate($created_date))', 'text($created_date)'),
        'history border': swap("border='1'", "border='0'"),
        'history width': swap('width:75%', 'width:100%'),
        'page break': swap('"page-break-after:always"', '""'),
        'table class added': swap('echo "<table>";', 'echo "<table class=\'table\'>";'),
        'query rebound to session pid': swap('WHERE a.amendment_id = ?";', 'WHERE a.amendment_id = ? AND a.pid = ?";'),
        'opener guarded': swap('    opener.top.printLogPrint(window);\n', '    if (opener) opener.top.printLogPrint(window);\n'),
        'extra script': swap('</body>\n', '<script src="x.js"></script>\n</body>\n'),
        'unrelated php': swap(' * Print Amendments\n', ' * Print the Amendments\n'),
        'duplicated style': swap(HEAD_CLOSE, `${STYLE_BLOCK}${HEAD_CLOSE}`),
        'moved style': (c) => swap('</body>\n', `${STYLE_BLOCK}</body>\n`)(swap(SEAM, HEADER_LINE)(c)),
        'style before Header': (c) => swap(HEADER_LINE + STYLE_BLOCK, STYLE_BLOCK + HEADER_LINE)(c),
        'media all': swap(STYLE_OPEN, '    <style media="all">\n'),
        'media print': swap(STYLE_OPEN, '    <style media="print">\n'),
        'media missing': swap(STYLE_OPEN, '    <style>\n'),
        'context scope dropped': swap(`      ${SCOPE} {`, `      body.${MARKER} {`),
        'descendant tables': swap(tableRule, `${SCOPE} table {`),
        'selector order': (c) => {
            const [first, second] = STYLE_BLOCK.slice(STYLE_OPEN.length, -STYLE_CLOSE.length).split('\n\n');
            return swap(STYLE_BLOCK, `${STYLE_OPEN}${second.replace(/\n$/, '')}\n\n${first}\n${STYLE_CLOSE}`)(c);
        },
        'declaration order': swap('        color: var(--oe-wb-ink, #17343b);\n        background-color: var(--oe-wb-canvas, #f3f7f5);\n', '        background-color: var(--oe-wb-canvas, #f3f7f5);\n        color: var(--oe-wb-ink, #17343b);\n'),
        'canvas swapped for paper': swap('var(--oe-wb-canvas, #f3f7f5)', 'var(--oe-wb-paper, #fff)'),
        'unpaired table ink': swap('        color: var(--oe-wb-ink, #17343b);\n        background-color: var(--oe-wb-paper, #fff);\n', '        background-color: var(--oe-wb-paper, #fff);\n'),
        'edge dropped': swap('        box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);\n', ''),
        'geometry declaration': swap('        box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);\n', '        box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);\n        padding: 0;\n'),
        'font declaration': swap('        background-color: var(--oe-wb-canvas, #f3f7f5);\n', '        background-color: var(--oe-wb-canvas, #f3f7f5);\n        font-family: Arial, sans-serif;\n'),
        'print rule': swap(STYLE_CLOSE, `\n      @media print {\n        body { color: #000; }\n      }\n${STYLE_CLOSE}`),
        'important': swap('var(--oe-wb-paper, #fff);', 'var(--oe-wb-paper, #fff) !important;'),
        'extra unscoped selector': swap(STYLE_CLOSE, `\n      table {\n        color: #17343b;\n      }\n${STYLE_CLOSE}`),
        'marker missing': swap(BODY_MARKED, BODY_ORIGINAL),
        'marker on html': (c) => swap('<html>\n', `<html class="${MARKER}">\n`)(swap(BODY_MARKED, BODY_ORIGINAL)(c)),
        'marker duplicated': swap("<span class='title'>", `<span class='title ${MARKER}'>`),
        'body wrapper': swap(`${BODY_MARKED}\n`, `${BODY_MARKED}\n<div class="${MARKER}-wrap">\n`),
        'shared asset link': swap(HEADER_LINE + STYLE_OPEN, `${HEADER_LINE}    <link rel="stylesheet" href="../../clinical-workspace/popup.css">\n${STYLE_OPEN}`),
        'declaration indentation': swap(STYLE_BLOCK, deeperIndent),
    };
    for (const [name, mutate] of Object.entries(mutants)) {
        const mutant = mutate(candidate);
        assert.notEqual(mutant, candidate, name);
        assert.notDeepEqual(validate(mutant, original), [], `mutant accepted: ${name}`);
    }
    const formatOnly = validate(mutants['declaration indentation'](candidate), original);
    assert.ok(formatOnly.some((p) => p.startsWith(FORMAT_PROBLEM)), JSON.stringify(formatOnly));
});

test('production route preserves the frozen original under the inverse', () => {
    assert.equal(invert(read(ROUTE)), original);
});

test('production route carries the screen-only presentation seam', () => {
    assert.deepEqual(validate(read(ROUTE), original), []);
});
