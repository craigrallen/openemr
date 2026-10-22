'use strict';

/*
 * OPEMR-53 contract for interface/code_systems/icd9_howto.php inside the workbench popup.
 *
 * Dependency-free (node:test, assert, fs, path, crypto, child_process). Run directly:
 *   node --test tests/fixtures/clinical-workspace/icd9-howto-popup.contract.cjs
 * Optional Git-base authentication of the frozen fixture:
 *   CHECK_ICD9_HISTORY=1 node --test tests/fixtures/clinical-workspace/icd9-howto-popup.contract.cjs
 *
 * The only accepted production delta is an inline <style media="screen"> directly after
 * Header::setupHeader() and an extra class on the existing .container. Removing exactly
 * that delta must give back the frozen original byte for byte, so every PHP call,
 * string, link attribute, list and the browser-repaired p/ol nesting stays untouched.
 *
 * The style block uses a canonical layout: selectors indented 2 spaces, declarations 4.
 * Stylelint dedents extracted inline CSS by its common indentation, so this leaves
 * 2-space declarations, which the repository's stylelint configuration requires.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const ROUTE = 'interface/code_systems/icd9_howto.php';
const FIXTURE = path.join(__dirname, 'icd9-howto.original.php.fixture');
const BASE_COMMIT = '18647270e0c799189d2dc10f801e8de2bff1a360';
// Pin independently calculated from the authenticated Git base.
const FIXTURE_SHA256 = '1f2f7f5e58f13c645e039dcce04c11806d17ad71882493990d2a1588ea0c5e25';

const MARKER = 'oe-icd9-howto-document';
const HEADER_LINE = '<?php Header::setupHeader(); ?>\n';
const ORIGINAL_ANCHOR = `${HEADER_LINE}\n<div class="container">\n`;
const STYLE_OPEN = '<style media="screen">\n';
const STYLE_CLOSE = '</style>\n';
const CONTAINER = `<div class="container ${MARKER}">`;
const SCOPE = `html.oe-workbench-context .container.${MARKER}`;

// Exact allowlist: paper + ink + inset neutral edge on the container, paired link colours.
const EXPECTED_RULES = {
    [SCOPE]: {
        color: 'var(--oe-wb-ink, #17343b)',
        'background-color': 'var(--oe-wb-paper, #fff)',
        'box-shadow': 'inset 0 0 0 1px var(--oe-wb-line, #d9e4e2)',
    },
    [`${SCOPE} a`]: {
        color: 'var(--oe-wb-petrol, #086878)',
        'background-color': 'transparent',
    },
};

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const count = (haystack, needle) => haystack.split(needle).length - 1;

function renderStyle(rules) {
    const body = Object.entries(rules)
        .map(([selector, decls]) => `  ${selector} {\n`
            + Object.entries(decls).map(([prop, value]) => `    ${prop}: ${value};\n`).join('')
            + '  }\n')
        .join('\n');
    return STYLE_OPEN + body + STYLE_CLOSE;
}

const STYLE_BLOCK = renderStyle(EXPECTED_RULES);

// Every line inside <style> is blank, a 2-space selector line, a 4-space declaration or a
// 2-space closing brace; no other indentation and no trailing whitespace.
const CANONICAL_CSS_LINE = /^(?:| {2}[^\s{}][^{}]*\{| {4}[a-z-]+: [^;]+;| {2}\})$/;
const FORMAT_PROBLEM = 'style block must use 2-space selectors and 4-space declarations';

function formatProblems(css) {
    const bad = css.split('\n').filter((line) => !CANONICAL_CSS_LINE.test(line));
    return bad.length === 0 ? [] : [`${FORMAT_PROBLEM}; non-canonical lines: ${JSON.stringify(bad)}`];
}

// The one synthetic candidate: generated from exactly one verified original anchor.
function buildCandidate(original) {
    assert.equal(count(original, ORIGINAL_ANCHOR), 1, 'exactly one Header/container anchor in the original');
    return original.replace(ORIGINAL_ANCHOR, () => `${HEADER_LINE}${STYLE_BLOCK}\n${CONTAINER}\n`);
}

function extractStyle(source) {
    const start = source.indexOf(HEADER_LINE + STYLE_OPEN);
    if (start === -1) return null;
    const from = start + HEADER_LINE.length + STYLE_OPEN.length;
    const end = source.indexOf(STYLE_CLOSE, from);
    return end === -1 ? null : source.slice(from, end);
}

// Exact inverse of the accepted delta; anything else survives and breaks equality.
function invert(source) {
    let out = source;
    const start = out.indexOf(HEADER_LINE + STYLE_OPEN);
    if (start !== -1) {
        const from = start + HEADER_LINE.length;
        const end = out.indexOf(STYLE_CLOSE, from);
        if (end !== -1) out = out.slice(0, from) + out.slice(end + STYLE_CLOSE.length);
    }
    return out.replace(CONTAINER, '<div class="container">');
}

function parseCss(css) {
    const problems = [];
    if (/\/\*|@|!important|\\/i.test(css)) problems.push('style may not contain comments, at-rules, !important or escapes');
    const rules = {};
    const rest = css.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, rawSelector, body) => {
        const selector = rawSelector.trim().replace(/\s+/g, ' ');
        if (Object.hasOwn(rules, selector)) problems.push(`duplicate selector ${selector}`);
        const decls = {};
        for (const raw of body.split(';')) {
            const decl = raw.trim();
            if (!decl) continue;
            const colon = decl.indexOf(':');
            if (colon < 1) {
                problems.push(`malformed declaration "${decl}"`);
                continue;
            }
            const prop = decl.slice(0, colon).trim().toLowerCase();
            if (Object.hasOwn(decls, prop)) problems.push(`duplicate ${prop} in ${selector}`);
            decls[prop] = decl.slice(colon + 1).trim().replace(/\s+/g, ' ');
        }
        rules[selector] = decls;
        return '';
    });
    if (rest.trim() !== '') problems.push('CSS text outside rules');
    return { rules, problems };
}

function validate(source, original) {
    const problems = [];
    if (count(source, HEADER_LINE) !== 1) problems.push('Header::setupHeader() must appear exactly once');
    if (count(source, '<style') !== 1) problems.push('exactly one <style> element is allowed');
    if (count(source, HEADER_LINE + STYLE_OPEN) !== 1) problems.push('<style media="screen"> must directly follow Header::setupHeader()');
    if (count(source, CONTAINER) !== 1) problems.push(`the existing .container must carry ${MARKER} exactly once`);
    if (count(source, MARKER) !== 3) problems.push(`${MARKER} must appear 3 times (2 selectors, 1 class); found ${count(source, MARKER)}`);
    const css = extractStyle(source);
    if (css === null) {
        problems.push('missing screen presentation: no style block after the Header anchor');
    } else {
        if (count(source, `${STYLE_CLOSE}\n${CONTAINER}\n`) !== 1) problems.push('style block must sit directly before the existing container');
        problems.push(...formatProblems(css));
        const parsed = parseCss(css);
        problems.push(...parsed.problems);
        try {
            assert.deepStrictEqual(parsed.rules, EXPECTED_RULES);
        } catch {
            problems.push(`rules differ from the allowlist: ${JSON.stringify(parsed.rules)}`);
        }
    }
    if (invert(source) !== original) problems.push('inverse of the presentation delta differs from the frozen original');
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

const original = fs.readFileSync(FIXTURE, 'utf8');

test('frozen fixture digest is pinned', () => {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(FIXTURE)).digest('hex');
    assert.ok(FIXTURE_SHA256, `FIXTURE_SHA256 is not pinned; fixture sha256 is ${actual}`);
    assert.equal(actual, FIXTURE_SHA256);
});

test('fixture equals the Git base route (CHECK_ICD9_HISTORY=1)', {
    skip: process.env.CHECK_ICD9_HISTORY === '1' ? false : 'set CHECK_ICD9_HISTORY=1 to authenticate against Git',
}, () => {
    // Required to succeed when requested: a git failure throws and fails the test.
    const base = execFileSync('git', ['show', `${BASE_COMMIT}:${ROUTE}`], { cwd: ROOT });
    assert.ok(base.equals(fs.readFileSync(FIXTURE)), `fixture differs from ${BASE_COMMIT}:${ROUTE}`);
});

test('activation context the seam relies on is present and unchanged in meaning', () => {
    assert.match(read('config/config.yaml'), /  workbench-popup:\n {4}basePath: '%webroot%\/interface\/clinical-workspace\/'\n {4}script: popup\.js\n {4}link: popup\.css\n {4}autoload: true\n/);
    const popupJs = read('interface/clinical-workspace/popup.js');
    assert.ok(popupJs.includes("const CONTEXT_CLASS = 'oe-workbench-context';"));
    assert.ok(popupJs.includes("frame.closest('.dialogModal')"));
    const caller = read('interface/code_systems/dataloads_ajax.php');
    assert.ok(caller.includes("const dbList = ['ICD9', "));
    assert.ok(caller.includes("dlgopen(`${dbName.toLowerCase()}_howto.php`, '', 800, 250, false, "));
    const dialog = read('library/dialog.js');
    assert.ok(dialog.includes("if (height <= 300 && opts.type === 'iframe') {\n        height = 300;"));
    assert.ok(dialog.includes('class="modal fade dialogModal"'));
    // Fallback literals must be the researched shared token defaults.
    const popupCss = read('interface/clinical-workspace/popup.css');
    const used = JSON.stringify(EXPECTED_RULES).matchAll(/var\((--oe-wb-[a-z-]+), (#[0-9a-f]+)\)/g);
    for (const [, token, fallback] of used) {
        assert.ok(popupCss.includes(`    ${token}: ${fallback};\n`), `${token} default is ${fallback} in popup.css`);
    }
});

test('palette pairs meet contrast and the dark-theme link would not', () => {
    assert.ok(contrast('#17343b', '#ffffff') >= 7, 'ink on paper');
    assert.ok(contrast('#086878', '#ffffff') >= 4.5, 'petrol link on paper');
    assert.ok(read('interface/themes/oe-styles/style_dark.scss').includes('$link-color: #f0f0f0;'));
    assert.ok(contrast('#f0f0f0', '#ffffff') < 1.5, 'unpaired dark-theme link on paper is unreadable');
});

test('synthetic candidate passes and inverts to the frozen original', () => {
    const candidate = buildCandidate(original);
    assert.deepEqual(validate(candidate, original), []);
    assert.equal(invert(candidate), original);
    assert.notDeepEqual(validate(original, original), [], 'the original alone is not a candidate');
});

test('mutations of the candidate are rejected', () => {
    const candidate = buildCandidate(original);
    const swap = (from, to) => (c) => {
        assert.equal(count(c, from), 1, `mutation anchor must be unique: ${JSON.stringify(from)}`);
        return c.replace(from, () => to);
    };
    const linkRule = `\n  ${SCOPE} a {\n    color: var(--oe-wb-petrol, #086878);\n    background-color: transparent;\n  }\n`;
    // Same rules and values in the old 4-space selector / 8-space declaration layout.
    const doubledIndent = STYLE_BLOCK.replace(/^ +/gm, (spaces) => spaces + spaces);
    const mutants = {
        'translated text': swap('xlt("this location")', 'xlt("that location")'),
        'php escaping': swap('<?php echo xlt("Steps to install the ICD 9 database"); ?>', '<?php echo text("Steps to install the ICD 9 database"); ?>'),
        'link url': swap('href="https://www.cms.gov/', 'href="http://www.cms.gov/'),
        'link rel': swap(' rel="noopener"', ''),
        'link target': swap('target="_blank"', 'target="_self"'),
        'list type': swap('<ol>', '<ul>'),
        'list item removed': swap('            </li>\n        </ol>', '        </ol>'),
        'repaired p/ol nesting': swap(':\n        <ol>', ':\n    </p>\n        <ol>'),
        'unrelated edit': swap(' * Instructions for loading ICD9 Database', ' * Instructions for loading the ICD9 Database'),
        'geometry declaration': swap('    box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);\n', '    box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);\n    padding: 0;\n'),
        'extra unscoped selector': swap(STYLE_CLOSE, `  a {\n    color: #086878;\n  }\n${STYLE_CLOSE}`),
        'context scope dropped': swap(`  ${SCOPE} a {`, `  .container.${MARKER} a {`),
        'important': swap('background-color: transparent;', 'background-color: transparent !important;'),
        'wrong media': swap(STYLE_OPEN, '<style media="all">\n'),
        'media missing': swap(STYLE_OPEN, '<style>\n'),
        'duplicated style': swap(`\n\n${CONTAINER}`, `\n${STYLE_BLOCK}\n${CONTAINER}`),
        'moved style': (c) => swap('</div>\n', `${STYLE_BLOCK}</div>\n`)(swap(STYLE_BLOCK, '')(c)),
        'marker missing': swap(CONTAINER, '<div class="container">'),
        'marker on wrapper': swap(`${CONTAINER}\n`, `<div class="${MARKER}">\n<div class="container">\n`),
        'body wrapper': swap(`\n${CONTAINER}`, `\n<body>\n${CONTAINER}`),
        'shared asset link': swap(HEADER_LINE + STYLE_OPEN, `${HEADER_LINE}<link rel="stylesheet" href="../clinical-workspace/popup.css">\n${STYLE_OPEN}`),
        'link colours missing': swap(linkRule, ''),
        'link colours unpaired': swap('    background-color: transparent;\n', ''),
        'four-space selector / eight-space declaration indentation': swap(STYLE_BLOCK, doubledIndent),
    };
    for (const [name, mutate] of Object.entries(mutants)) {
        const mutant = mutate(candidate);
        assert.notEqual(mutant, candidate, name);
        assert.notDeepEqual(validate(mutant, original), [], `mutant accepted: ${name}`);
    }
    // Same rules, values, placement and inverse: only the canonical-format guard may reject it.
    const doubledProblems = validate(mutants['four-space selector / eight-space declaration indentation'](candidate), original);
    assert.equal(doubledProblems.length, 1, JSON.stringify(doubledProblems));
    assert.ok(doubledProblems[0].startsWith(FORMAT_PROBLEM), doubledProblems[0]);
});

test('production route preserves the frozen original under the inverse', () => {
    assert.equal(invert(read(ROUTE)), original);
});

test('production route carries the screen-only presentation seam', () => {
    assert.deepEqual(validate(read(ROUTE), original), []);
});
