'use strict';

/*
 * OPEMR-56 contract for interface/billing/print_daysheet_report_num1.php, opened from
 * interface/billing/billing_report.php by SubmitTheEndDayPrint(): when use_custom_daysheet == 1,
 * the_form is POSTed to the named target 'new' (no window features), while the route reads its
 * criteria and mode from $_GET and only its two totals switches from POST via filter_input().
 *
 * Dependency-free (node:test, assert, fs, path, crypto). Portable run, no git at all:
 *   node --test tests/clinical/daysheet-num1-popup.test.cjs
 * Mandatory Git-base authentication of the frozen fixture, the inverse, and the unchanged caller
 * and shared sources (a checkout without BASE_COMMIT fails this mode instead of skipping it):
 *   REQUIRE_GIT_BASELINE=1 node --test tests/clinical/daysheet-num1-popup.test.cjs
 * Another checkout can be targeted with DAYSHEET_NUM1_TARGET_ROOT=<repo root>; the frozen
 * fixture always comes from this test tree.
 *
 * Nothing here executes the route, its bootstrap or its caller. Only source text is read.
 *
 * The only accepted production delta is:
 *   1. one <style media="screen"> directly after the existing Header::setupHeader() line,
 *      keeping the original blank line before </head>;
 *   2. one class attribute, oe-daysheet-num1-document, added to the existing bare <body>.
 * Removing exactly that delta must give back the frozen original byte for byte, so every ACL
 * check, GET/POST read, billing path, query, aggregation, formula, escape, translation, width,
 * class, date format, the close link and the malformed nested tables stay untouched.
 *
 * Embedding format: <style> tags at column 0 (the Header line's indent), selectors at 2,
 * declarations at 4, one blank line between rules. A grouped selector list puts each selector
 * on its own line at the same 2-space indent: every line but the last ends with a comma, the
 * last carries the opening brace.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = process.env.DAYSHEET_NUM1_TARGET_ROOT
    ? path.resolve(process.env.DAYSHEET_NUM1_TARGET_ROOT)
    : path.resolve(__dirname, '..', '..');
const ROUTE = 'interface/billing/print_daysheet_report_num1.php';
const CALLER = 'interface/billing/billing_report.php';
// Sources this slice must not touch; checked against BASE_COMMIT in baseline mode.
const SHARED = [
    'interface/clinical-workspace/popup.css',
    'interface/clinical-workspace/popup.js',
    'src/Common/Assets/ClinicalWorkspaceAssets.php',
    'interface/billing/print_daysheet_report_num2.php',
    'interface/billing/print_daysheet_report_num3.php',
];
// Non-executable extension: PHP scanners and the web server must never run the frozen copy.
const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'daysheet-num1-original.php.txt');
const BASE_COMMIT = '18647270e0c799189d2dc10f801e8de2bff1a360';
// SHA-256 of BASE_COMMIT:ROUTE (664 lines, terminal newline). Any byte change must fail.
const FIXTURE_SHA256 = 'c9b26b97a16f48751e51f562f7e7ed499604849eddd6d0a3616194fc29ec15bf';
const FIXTURE_LINES = 664;

const MARKER = 'oe-daysheet-num1-document';
const HEADER_LINE = '<?php Header::setupHeader(); ?>\n';
const HEAD_CLOSE = '</head>\n';
const STYLE_OPEN = '<style media="screen">\n';
const STYLE_CLOSE = '</style>\n';
// The original keeps one blank line between the Header line and </head>; it stays.
const HEAD_TAIL = `\n${HEAD_CLOSE}`;
const BODY_ORIGINAL = '<body>\n';
const BODY_MARKED = `<body class="${MARKER}">\n`;
const SCOPE = `html.oe-workbench-context body.${MARKER}`;

const INK = ['color', 'var(--oe-wb-ink, #17343b)'];
const CANVAS = ['background-color', 'var(--oe-wb-canvas, #f3f7f5)'];
const PAPER = ['background-color', 'var(--oe-wb-paper, #fff)'];
const EDGE = ['box-shadow', 'inset 0 0 0 1px var(--oe-wb-line, #d9e4e2)'];

// Exact allowlist, in order: ink on canvas for the sheet; ink on paper with a quiet inset edge
// for the direct-child .container; ink on paper for every .table (no nested outlines); ink on
// paper for the close link and its .title, as one grouped rule. Colour only; no geometry,
// fonts, states or print.
const EXPECTED_RULES = [
    [SCOPE, [INK, CANVAS]],
    [`${SCOPE} > .container`, [INK, PAPER, EDGE]],
    [`${SCOPE} .table`, [INK, PAPER]],
    [`${SCOPE} > .container > .row > a, ${SCOPE} > .container > .row > a > .title`, [INK, PAPER]],
];
const ALLOWED_PROPS = new Set(['color', 'background-color', 'box-shadow']);

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const count = (haystack, needle) => haystack.split(needle).length - 1;

const selectorLines = (selector) => selector.split(', ');
const declText = (decls, indent) => decls.map(([prop, value]) => `${indent}${prop}: ${value};\n`).join('');
const ruleText = ([selector, decls]) => `  ${selectorLines(selector).join(',\n  ')} {\n`
    + declText(decls, '    ')
    + '  }\n';
// Non-canonical single-line rendering, kept only to build a negative mutant.
const singleLineRuleText = ([selector, decls]) => `  ${selector} {\n` + declText(decls, '    ') + '  }\n';
const renderStyle = (rules) => STYLE_OPEN + rules.map(ruleText).join('\n') + STYLE_CLOSE;

const STYLE_BLOCK = renderStyle(EXPECTED_RULES);
const SEAM = HEADER_LINE + STYLE_BLOCK;
const [RULE_BODY, RULE_CONTAINER, RULE_TABLE, RULE_ANCHOR] = EXPECTED_RULES.map(ruleText);

const CSS_SELECTOR_CONTINUATION = /^ {2}[^\s{},][^{},]*,$/;
const CSS_SELECTOR_OPEN = /^ {2}[^\s{},][^{},]*\{$/;
const CSS_DECLARATION = /^ {4}[a-z-]+: [^;]+;$/;
const isCanonicalCssLine = (line) => line === ''
    || CSS_SELECTOR_CONTINUATION.test(line)
    || CSS_SELECTOR_OPEN.test(line)
    || CSS_DECLARATION.test(line)
    || line === '  }';
const danglingContinuations = (lines) => lines.filter((line, i) => CSS_SELECTOR_CONTINUATION.test(line)
    && !(CSS_SELECTOR_CONTINUATION.test(lines[i + 1] ?? '') || CSS_SELECTOR_OPEN.test(lines[i + 1] ?? '')));

// Problems are "[code] detail"; codes let the untouched route be classified exactly.
const codes = (problems) => problems.map((p) => p.slice(1, p.indexOf(']')));
const MISSING_PRESENTATION = [
    'style-count',
    'style-after-header',
    'style-before-head-tail',
    'body-marker',
    'marker-count',
    'style-missing',
];

// The one synthetic candidate, built from exactly one verified anchor of each kind.
function buildCandidate(original) {
    assert.equal(count(original, HEADER_LINE + HEAD_TAIL), 1, 'exactly one Header/blank/</head> anchor in the original');
    assert.equal(count(original, BODY_ORIGINAL), 1, 'exactly one bare <body> anchor in the original');
    return original
        .replace(HEADER_LINE + HEAD_TAIL, () => SEAM + HEAD_TAIL)
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
    if (/\/\*|@|!important|\\/i.test(css)) {
        problems.push('[css-forbidden] style may not contain comments, at-rules (print/media), !important or escapes');
    }
    const rules = [];
    const rest = css.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, rawSelector, body) => {
        const selector = rawSelector.trim().replace(/\s+/g, ' ');
        // Any pseudo-class or pseudo-element (state overrides included) is out of scope.
        if (selector.includes(':')) problems.push(`[css-state] pseudo selector in ${selector}`);
        if (rules.some(([s]) => s === selector)) problems.push(`[css-duplicate-selector] ${selector}`);
        const decls = [];
        for (const raw of body.split(';')) {
            const decl = raw.trim();
            if (!decl) continue;
            const colon = decl.indexOf(':');
            if (colon < 1) {
                problems.push(`[css-malformed] "${decl}"`);
                continue;
            }
            const prop = decl.slice(0, colon).trim().toLowerCase();
            if (!ALLOWED_PROPS.has(prop)) problems.push(`[css-property] non-allowlisted ${prop} in ${selector}`);
            if (decls.some(([p]) => p === prop)) problems.push(`[css-duplicate-property] ${prop} in ${selector}`);
            decls.push([prop, decl.slice(colon + 1).trim().replace(/\s+/g, ' ')]);
        }
        rules.push([selector, decls]);
        return '';
    });
    if (rest.trim() !== '') problems.push('[css-stray] CSS text outside rules');
    return { rules, problems };
}

// Full route check: placement, counts, format, exact rules AND restored-source equality.
function validate(source, original) {
    const problems = [];
    if (count(source, HEADER_LINE) !== 1) problems.push('[header] Header::setupHeader() line must appear exactly once, unchanged');
    if (count(source, '<style') !== 1 || count(source, '</style>') !== 1) problems.push('[style-count] exactly one <style> element is allowed');
    if (count(source, HEADER_LINE + STYLE_OPEN) !== 1) problems.push('[style-after-header] <style media="screen"> must directly follow the Header line');
    if (count(source, STYLE_CLOSE + HEAD_TAIL) !== 1) problems.push('[style-before-head-tail] the style block must be followed by the original blank line and </head>');
    if (count(source, BODY_MARKED) !== 1) problems.push(`[body-marker] the existing <body> must carry class="${MARKER}" exactly once`);
    const expectedMarkers = count(STYLE_BLOCK, MARKER) + 1;
    if (count(source, MARKER) !== expectedMarkers) problems.push(`[marker-count] ${MARKER} must appear ${expectedMarkers} times; found ${count(source, MARKER)}`);
    const css = extractStyle(source);
    if (css === null) {
        problems.push('[style-missing] no screen style block after the Header line');
    } else {
        const lines = css.split('\n');
        const bad = lines.filter((line) => !isCanonicalCssLine(line)).concat(danglingContinuations(lines));
        if (bad.length) problems.push(`[style-format] non-canonical lines: ${JSON.stringify(bad)}`);
        const parsed = parseCss(css);
        problems.push(...parsed.problems);
        if (JSON.stringify(parsed.rules) !== JSON.stringify(EXPECTED_RULES)) {
            problems.push(`[css-rules] rules or order differ from the allowlist: ${JSON.stringify(parsed.rules)}`);
        }
    }
    if (invert(source) !== original) problems.push('[inverse] removing the approved delta does not restore the frozen original');
    return problems;
}

// The caller's launch must stay the named-target POST: no features, no explicit size, num1
// selected only when use_custom_daysheet == 1.
const CALLER_LAUNCH = [
    '        function SubmitTheEndDayPrint() { //Action on View End of Day Report link',
    '            if (!ProcessBeforeSubmitting()) return false;',
    '            top.restoreSession();',
    "            document.the_form.target = 'new';",
    "            <?php if (OEGlobalsBag::getInstance()->get('use_custom_daysheet') == 1) { ?>",
    "            document.the_form.action = 'print_daysheet_report_num1.php';",
    '            <?php } ?>',
    "            <?php if (OEGlobalsBag::getInstance()->get('use_custom_daysheet') == 2) { ?>",
    "            document.the_form.action = 'print_daysheet_report_num2.php';",
    '            <?php } ?>',
    "            <?php if (OEGlobalsBag::getInstance()->get('use_custom_daysheet') == 3) { ?>",
    "            document.the_form.action = 'print_daysheet_report_num3.php';",
    '            <?php } ?>',
    '            document.the_form.submit();',
    '            return true;',
    '        }',
    '',
].join('\n');
const CALLER_FORM = "<form class=\"form\" name='the_form' method='post' action='billing_report.php' onsubmit='return top.restoreSession()'>";

function validateCaller(source) {
    const problems = [];
    if (count(source, CALLER_LAUNCH) !== 1) problems.push('SubmitTheEndDayPrint must stay the unchanged named-target submit');
    if (count(source, CALLER_FORM) !== 1) problems.push('the_form must stay the unchanged POST form');
    if (count(source, 'function SubmitTheEndDayPrint(') !== 1) problems.push('exactly one SubmitTheEndDayPrint definition');
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

// A mutation applies only to an anchor that exists exactly once; a missing or repeated anchor
// fails the test as an error, never as a "rejected" mutant.
const swap = (from, to) => (c) => {
    assert.equal(count(c, from), 1, `mutation anchor must be unique: ${JSON.stringify(from)}`);
    return c.replace(from, () => to);
};
// Edit one rule of the candidate style; the edit itself must hit exactly once in that rule.
const inRule = (rule, from, to) => {
    assert.equal(count(rule, from), 1, `rule edit anchor must be unique: ${JSON.stringify(from)}`);
    return swap(rule, rule.replace(from, () => to));
};

const fixtureBytes = fs.readFileSync(FIXTURE);
const original = fixtureBytes.toString('utf8');

test('frozen fixture digest is pinned and the file is the complete 664-line original', () => {
    const actual = crypto.createHash('sha256').update(fixtureBytes).digest('hex');
    assert.equal(actual, FIXTURE_SHA256, `fixture sha256 is ${actual}`);
    assert.ok(original.endsWith('</body>\n</html>\n'), 'terminal newline kept');
    assert.equal(original.split('\n').length - 1, FIXTURE_LINES);
    assert.equal(count(original, '\r'), 0, 'LF line endings');
});

test('baseline mode is explicit', () => {
    const mode = process.env.REQUIRE_GIT_BASELINE;
    assert.ok(mode === undefined || mode === '' || mode === '0' || mode === '1', `REQUIRE_GIT_BASELINE must be unset, 0 or 1; got ${JSON.stringify(mode)}`);
});

if (process.env.REQUIRE_GIT_BASELINE === '1') {
    // Registered only on request, so portable runs neither call git nor report a skip.
    test(`mandatory Git baseline at ${BASE_COMMIT}: fixture, full inverse, caller and shared sources`, () => {
        const { execFileSync } = require('node:child_process');
        const git = (args) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 });
        // Throws, and so fails, when the base commit is absent (e.g. a shallow clone).
        assert.equal(git(['rev-parse', '--verify', `${BASE_COMMIT}^{commit}`]).toString('utf8').trim(), BASE_COMMIT);
        const base = git(['show', `${BASE_COMMIT}:${ROUTE}`]);
        assert.equal(crypto.createHash('sha256').update(base).digest('hex'), FIXTURE_SHA256);
        assert.ok(base.equals(fixtureBytes), `fixture differs byte-wise from ${BASE_COMMIT}:${ROUTE}`);
        assert.equal(invert(read(ROUTE)), base.toString('utf8'), 'live route minus the approved delta must equal the base route');
        for (const rel of [CALLER, ...SHARED]) {
            assert.ok(git(['show', `${BASE_COMMIT}:${rel}`]).equals(fs.readFileSync(path.join(ROOT, rel))), `${rel} changed from ${BASE_COMMIT}`);
        }
    });
}

test('frozen original has the anchors and legacy behaviour the seam must preserve', () => {
    for (const needle of [
        "if (!AclMain::aclCheckCore('acct', 'eob', '', 'write') && !AclMain::aclCheckCore('acct', 'bill', '', 'write')) {",
        'AccessDeniedHelper::denyWithTemplate(',
        '//global variables:\nif (!isset($_GET["mode"])) {',
        'if (isset($_GET["mode"]) && $_GET["mode"] === \'bill\') {\n                BillingReport::billCodesList($list);\n            }\n',
        'getBillsBetweendayReport($code_type)',
        '$daySheetTotals = (new DaySheetAggregator())->aggregate($all4);',
        "filter_input(INPUT_POST, 'end_of_day_provider_only', FILTER_VALIDATE_INT) === 1",
        "filter_input(INPUT_POST, 'end_of_day_totals_only', FILTER_VALIDATE_INT) === 1",
        'substr($query_part_day, 37, 10)',
        'substr($query_part_day, 63, 10)',
        "$user_info['patref'][$i] + $user_info['insref'][$i] + $user_info['inspay'][$i] + $user_info['patpay'][$i]",
        "print \"<div class='table-responsive'><table class='table'>\";",
        '<a href="javascript:window.close();" target="Main"><p class="title"><?php echo xlt(\'Day Sheet Report\')?></p></a>\n',
        HEADER_LINE + HEAD_TAIL + BODY_ORIGINAL + '    <div class="container">\n        <div class="row">\n',
        '</body>\n</html>\n',
    ]) {
        assert.equal(count(original, needle), 1, needle);
    }
    // Duplicated GET computation stays; criteria and mode come from GET only.
    assert.equal(count(original, 'if (!isset($_GET["mode"])) {'), 2);
    assert.equal(count(original, '$_POST'), 0);
    assert.equal(count(original, '$_REQUEST'), 0);
    assert.equal(count(original, 'INPUT_POST'), 2);
    // Raw malformed nesting: 12 nested borderless tables, two closers, one stray </div>.
    assert.equal(count(original, "<table class='table table-borderless'>"), 12);
    assert.equal(count(original, '</table>'), 2);
    // No print audit, auto print, style, marker or wrapper in this target.
    assert.equal(count(original, 'printLogPrint'), 0);
    assert.equal(count(original, 'window.print'), 0);
    assert.equal(count(original, '<style'), 0);
    assert.equal(count(original, MARKER), 0);
});

test('activation context the seam relies on is present', () => {
    assert.match(read('config/config.yaml'), / {2}workbench-popup:\n {4}basePath: '%webroot%\/interface\/clinical-workspace\/'\n {4}script: popup\.js\n {4}link: popup\.css\n {4}autoload: true\n/);
    assert.ok(read('interface/clinical-workspace/popup.js').includes("const CONTEXT_CLASS = 'oe-workbench-context';"));
    const popupCss = read('interface/clinical-workspace/popup.css');
    const tokens = Array.from(JSON.stringify(EXPECTED_RULES).matchAll(/var\((--oe-wb-[a-z-]+), (#[0-9a-f]+)\)/g));
    assert.deepEqual([...new Set(tokens.map(([, token]) => token))].sort(), ['--oe-wb-canvas', '--oe-wb-ink', '--oe-wb-line', '--oe-wb-paper']);
    for (const [, token, fallback] of tokens) {
        assert.ok(popupCss.includes(`    ${token}: ${fallback};\n`), `${token} default is ${fallback} in popup.css`);
    }
});

test('opener discovery model: active, closed, cross-origin and missing opener snapshots', () => {
    const { findWorkbenchHost } = require(path.join(ROOT, 'interface/clinical-workspace/popup.js'));
    const origin = 'https://emr.test';
    const shell = (closed = false, at = origin) => {
        const win = {
            closed,
            location: { origin: at },
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
    assert.equal(findWorkbenchHost({ self, parentWindow: self, openerWindow: shell(false, 'https://other.test'), origin }), null, 'cross-origin opener');
    assert.equal(findWorkbenchHost({ self, parentWindow: self, openerWindow: null, origin }), null, 'no opener');
});

test('caller launch is the live named-target POST and alterations are rejected', () => {
    const caller = read(CALLER);
    assert.deepEqual(validateCaller(caller), []);
    const inLaunch = (from, to) => {
        assert.equal(count(CALLER_LAUNCH, from), 1, `launch edit anchor must be unique: ${from}`);
        return swap(CALLER_LAUNCH, CALLER_LAUNCH.replace(from, () => to));
    };
    const mutants = {
        'blank target': inLaunch("target = 'new';", "target = '_blank';"),
        'self target': inLaunch("target = 'new';", "target = '_self';"),
        'num1 route changed': inLaunch("'print_daysheet_report_num1.php'", "'print_daysheet_report_num1.php?mode=bill'"),
        'num1 condition widened': inLaunch("get('use_custom_daysheet') == 1)", "get('use_custom_daysheet') >= 1)"),
        'num2 retargeted to num1': inLaunch("'print_daysheet_report_num2.php'", "'print_daysheet_report_num1.php'"),
        'mode forced': inLaunch('            top.restoreSession();\n', "            top.restoreSession();\n            document.the_form.mode.value = 'bill';\n"),
        'sized window': inLaunch('            document.the_form.submit();\n', "            window.open('', 'new', 'width=800,height=600');\n            document.the_form.submit();\n"),
        'noopener': inLaunch('            document.the_form.submit();\n', "            window.open('', 'new', 'noopener');\n            document.the_form.submit();\n"),
        'form switched to GET': swap("name='the_form' method='post'", "name='the_form' method='get'"),
        'second definition': swap(CALLER_LAUNCH, CALLER_LAUNCH + CALLER_LAUNCH.replace('{ //Action', '{ // copy')),
    };
    for (const [name, mutate] of Object.entries(mutants)) {
        const mutant = mutate(caller);
        assert.notEqual(mutant, caller, name);
        assert.notDeepEqual(validateCaller(mutant), [], `caller mutant accepted: ${name}`);
    }
});

test('paired palette fallbacks meet AAA contrast as declared pairs (not native effective contrast)', () => {
    assert.ok(contrast('#17343b', '#f3f7f5') >= 7, 'ink on canvas');
    assert.ok(contrast('#17343b', '#ffffff') >= 7, 'ink on paper');
});

test('synthetic candidate passes, inverts to the frozen original, and the original alone fails only for missing presentation', () => {
    const candidate = buildCandidate(original);
    assert.deepEqual(validate(candidate, original), []);
    assert.equal(invert(candidate), original);
    assert.ok(candidate.includes(`<head>\n\n${HEADER_LINE}${STYLE_BLOCK}${HEAD_TAIL}${BODY_MARKED}    <div class="container">\n`));
    const css = extractStyle(candidate);
    const cssLines = css.split('\n');
    const dedented = cssLines.map((line) => (line === '' ? '' : line.slice(2))).join('\n');
    assert.ok(cssLines.every((line) => line === '' || line.startsWith('  ')));
    assert.equal(dedented, EXPECTED_RULES.map(([s, d]) => `${selectorLines(s).join(',\n')} {\n${declText(d, '  ')}}\n`).join('\n'));
    assert.equal(count(css, `  ${SCOPE} > .container > .row > a,\n  ${SCOPE} > .container > .row > a > .title {\n`), 1);
    assert.deepEqual(cssLines.filter((line) => CSS_SELECTOR_CONTINUATION.test(line)), [`  ${SCOPE} > .container > .row > a,`]);
    assert.ok(cssLines.filter((line) => line.endsWith('{')).every((line) => !line.includes(',')));
    assert.deepEqual(danglingContinuations(cssLines), []);
    assert.equal(count(css, 'box-shadow'), 1, 'only the container carries an edge');
    assert.equal(count(css, ':'), count(css, ';'), 'no pseudo selectors; one colon per declaration');
    // The candidate changes nothing below <body>: same bytes from the first <div> on.
    assert.equal(candidate.slice(candidate.indexOf(BODY_MARKED) + BODY_MARKED.length), original.slice(original.indexOf(BODY_ORIGINAL) + BODY_ORIGINAL.length));
    assert.deepEqual(codes(validate(original, original)), MISSING_PRESENTATION);
});

test('meaningful mutations of the candidate are rejected', () => {
    const candidate = buildCandidate(original);
    const deeperIndent = STYLE_BLOCK.replace(/^ {4}(?=[a-z])/gm, ' '.repeat(6));
    const swappedRules = renderStyle([EXPECTED_RULES[2], EXPECTED_RULES[1], EXPECTED_RULES[0], EXPECTED_RULES[3]]);
    const splitAnchor = ruleText([`${SCOPE} > .container > .row > a`, [INK, PAPER]]) + '\n'
        + ruleText([`${SCOPE} > .container > .row > a > .title`, [INK, PAPER]]);
    const colorLine = `    ${INK[0]}: ${INK[1]};\n`;
    const canvasLine = `    ${CANVAS[0]}: ${CANVAS[1]};\n`;
    const paperLine = `    ${PAPER[0]}: ${PAPER[1]};\n`;
    const edgeLine = `    ${EDGE[0]}: ${EDGE[1]};\n`;
    const tail = STYLE_CLOSE + HEAD_TAIL;
    const mutants = {
        // ACL
        'ACL write downgraded to view': swap("AclMain::aclCheckCore('acct', 'eob', '', 'write')", "AclMain::aclCheckCore('acct', 'eob', '', 'view')"),
        'ACL deny removed': swap('    AccessDeniedHelper::denyWithTemplate("ACL check failed for acct/eob or acct/bill: Billing Manager", xl("Billing Manager"));\n', ''),
        'ACL widened': swap("'write') && !AclMain::aclCheckCore('acct', 'bill'", "'write') || !AclMain::aclCheckCore('acct', 'bill'"),
        // GET/POST semantics and billing path
        'billing call removed': swap('                BillingReport::billCodesList($list);\n', ''),
        'billing mode moved to POST': swap('if (isset($_GET["mode"]) && $_GET["mode"] === \'bill\') {', 'if (isset($_POST["mode"]) && $_POST["mode"] === \'bill\') {'),
        'GET reads moved to POST': swap('//global variables:\nif (!isset($_GET["mode"])) {', '//global variables:\nif (!isset($_POST["mode"])) {'),
        'provider switch moved to GET': swap("filter_input(INPUT_POST, 'end_of_day_provider_only'", "filter_input(INPUT_GET, 'end_of_day_provider_only'"),
        'totals switch loosened': swap("'end_of_day_totals_only', FILTER_VALIDATE_INT) === 1", "'end_of_day_totals_only', FILTER_VALIDATE_INT) == 1"),
        // SQL / aggregation / formulas / dates
        'report query changed': swap('getBillsBetweendayReport($code_type)', 'getBillsBetweenReport($code_type)'),
        'aggregation dropped': swap('$daySheetTotals = (new DaySheetAggregator())->aggregate($all4);', "$daySheetTotals = new DaySheetTotals([], [], new SlotTotals('x'));"),
        'receipts formula changed': swap("$user_info['patref'][$i] + $user_info['insref'][$i] + $user_info['inspay'][$i] + $user_info['patpay'][$i]", "$user_info['inspay'][$i] + $user_info['patpay'][$i]"),
        'adjustment sign changed': swap("text($user_info['patadj'][$i] + $user_info['insadj'][$i])", "text($user_info['patadj'][$i] - $user_info['insadj'][$i])"),
        'money precision changed': swap('"%1\\$.2f", text($user_info[\'fee\'][$i])', '"%1\\$.0f", text($user_info[\'fee\'][$i])'),
        'query_part_day offset changed': swap('substr($query_part_day, 37, 10)', 'substr($query_part_day, 36, 10)'),
        'date format changed': swap("<td class='text text-center' width='70'>\n" + ' '.repeat(40) + '<?php echo text(date("Y-m-d"', "<td class='text text-center' width='70'>\n" + ' '.repeat(40) + '<?php echo text(date("m/d/Y"'),
        // escaping / translations
        'user escaping removed': swap("<?php echo text($user_info['user'][$i]); ?>", "<?php echo $user_info['user'][$i]; ?>"),
        'name escaping removed': swap("<?php echo text($iter['last']) . \", \" . text($iter['first']) ?>", "<?php echo $iter['last'] . \", \" . $iter['first'] ?>"),
        'title translation helper': swap("xlt('Day Sheet Report')", "xl('Day Sheet Report')"),
        'translation key changed': swap("xlt('No Data to Process')", "xlt('No data')"),
        'range translation key changed': swap("xlt('To{{Range}}')", "xlt('To')"),
        'header comment edited': swap(' * Program for Generating an End of Day report\n', ' * Program for generating an end of day report\n'),
        // widths / classes / raw structure
        'header width changed': swap("<td class='text text-center font-weight-bold' width='70'>", "<td class='text text-center font-weight-bold' width='90'>"),
        'detail table class changed': swap("print \"<div class='table-responsive'><table class='table'>\";", "print \"<div class='table-responsive'><table class='table table-sm'>\";"),
        'title class changed': swap('<p class="title">', '<p class="title h4">'),
        'stray div repaired': swap('                    </table>\n                </div>\n', '                    </table>\n'),
        'nested tables closed': swap('                print "</table>";\n', '                print "</table></table>";\n'),
        // close action, body, print
        'close action changed': swap('<a href="javascript:window.close();" target="Main">', '<a href="javascript:history.back();" target="Main">'),
        'close target dropped': swap(' target="Main"><p', '><p'),
        'print audit added': swap('</body>\n', '<script>\n    opener.top.printLogPrint(window);\n</script>\n</body>\n'),
        'auto print added': swap('</body>\n', '<script>window.print();</script>\n</body>\n'),
        'control added': swap('            <br />\n\n            <?php\n            $my_authorized', '            <button type="button" onclick="window.print()">Print</button>\n            <br />\n\n            <?php\n            $my_authorized'),
        // Header / placement / whitespace outside the delta
        'Header assets changed': swap(HEADER_LINE + STYLE_OPEN, "<?php Header::setupHeader(['common']); ?>\n" + STYLE_OPEN),
        'blank line before </head> dropped': swap(tail, STYLE_CLOSE + HEAD_CLOSE),
        'blank line after Header added': swap(HEADER_LINE + STYLE_OPEN, HEADER_LINE + '\n' + STYLE_OPEN),
        'duplicated style': swap(HEAD_CLOSE, STYLE_BLOCK + HEAD_CLOSE),
        'style moved to body end': (c) => swap('</body>\n', STYLE_BLOCK + '</body>\n')(swap(SEAM, HEADER_LINE)(c)),
        'style before Header': swap(SEAM, STYLE_BLOCK + HEADER_LINE),
        'shared asset link': swap(HEADER_LINE + STYLE_OPEN, `${HEADER_LINE}<link rel="stylesheet" href="../clinical-workspace/popup.css">\n${STYLE_OPEN}`),
        // media
        'media all': swap(STYLE_OPEN, '<style media="all">\n'),
        'media print': swap(STYLE_OPEN, '<style media="print">\n'),
        'media screen and print': swap(STYLE_OPEN, '<style media="screen, print">\n'),
        'media missing': swap(STYLE_OPEN, '<style>\n'),
        // scope / selectors / states
        'context scope dropped': inRule(RULE_BODY, 'html.oe-workbench-context body.', 'body.'),
        'popup scope substituted': inRule(RULE_CONTAINER, 'html.oe-workbench-context', 'html.oe-workbench-popup'),
        'container descendant': inRule(RULE_CONTAINER, ' > .container {', ' .container {'),
        'table scope narrowed': inRule(RULE_TABLE, ' .table {', ' > .container .table {'),
        'table hover state': inRule(RULE_TABLE, ' .table {', ' .table:hover {'),
        'anchor rule split': swap(RULE_ANCHOR, splitAnchor),
        'anchor title dropped': inRule(RULE_ANCHOR, `,\n  ${SCOPE} > .container > .row > a > .title`, ''),
        'focus-visible grouped': inRule(RULE_ANCHOR, ' > a > .title {', ` > a > .title,\n  ${SCOPE} > .container > .row > a:focus-visible {`),
        'selector order': swap(STYLE_BLOCK, swappedRules),
        'extra unscoped selector': swap(tail, `\n  table {\n    color: #17343b;\n  }\n${tail}`),
        // properties / values / pairing
        'declaration order': inRule(RULE_BODY, colorLine + canvasLine, canvasLine + colorLine),
        'body canvas swapped for paper': inRule(RULE_BODY, CANVAS[1], PAPER[1]),
        'container paper swapped for canvas': inRule(RULE_CONTAINER, PAPER[1], CANVAS[1]),
        'anchor paper swapped for canvas': inRule(RULE_ANCHOR, PAPER[1], CANVAS[1]),
        'ink fallback changed': inRule(RULE_TABLE, 'var(--oe-wb-ink, #17343b)', 'var(--oe-wb-ink, #000)'),
        'token renamed': inRule(RULE_BODY, '--oe-wb-ink,', '--oe-wb-text,'),
        'unpaired table ink': inRule(RULE_TABLE, colorLine, ''),
        'unpaired anchor ink': inRule(RULE_ANCHOR, paperLine, ''),
        'nested table outline': inRule(RULE_TABLE, paperLine, paperLine + edgeLine),
        'container edge dropped': inRule(RULE_CONTAINER, edgeLine, ''),
        'container edge outset': inRule(RULE_CONTAINER, 'inset 0 0 0 1px', '0 0 0 1px'),
        'geometry declaration': inRule(RULE_CONTAINER, edgeLine, `${edgeLine}    padding: 0;\n`),
        'width declaration': inRule(RULE_TABLE, paperLine, `${paperLine}    width: 100%;\n`),
        'font declaration': inRule(RULE_BODY, canvasLine, `${canvasLine}    font-family: Arial, sans-serif;\n`),
        'duplicate property': inRule(RULE_BODY, colorLine, colorLine + colorLine),
        'important': inRule(RULE_TABLE, 'var(--oe-wb-paper, #fff);', 'var(--oe-wb-paper, #fff) !important;'),
        'print rule': swap(tail, `\n  @media print {\n    body { color: #000; }\n  }\n${tail}`),
        'css comment': inRule(RULE_BODY, ' {\n', ' {\n    /* note */\n'),
        // marker
        'marker missing': swap(BODY_MARKED, BODY_ORIGINAL),
        'marker on html': (c) => swap('<html>\n', `<html class="${MARKER}">\n`)(swap(BODY_MARKED, BODY_ORIGINAL)(c)),
        'marker duplicated': swap('    <div class="container">\n', `    <div class="container ${MARKER}">\n`),
        'marker with extra class': swap(BODY_MARKED, `<body class="${MARKER} body_top">\n`),
        'marker single-quoted': swap(BODY_MARKED, `<body class='${MARKER}'>\n`),
        'body wrapper': swap(BODY_MARKED, `${BODY_MARKED}<div class="${MARKER}-wrap">\n`),
        // format
        'declaration indentation': swap(STYLE_BLOCK, deeperIndent),
        'blank line between rules removed': swap(STYLE_BLOCK, STYLE_BLOCK.replace('  }\n\n  html', '  }\n  html')),
        'grouped selector on one line': swap(RULE_ANCHOR, singleLineRuleText(EXPECTED_RULES[3])),
        'grouped selector continuation indented': inRule(RULE_ANCHOR, `,\n  ${SCOPE} > .container > .row > a > .title {`, `,\n    ${SCOPE} > .container > .row > a > .title {`),
        'blank line inside grouped selector': inRule(RULE_ANCHOR, `,\n  ${SCOPE} > .container > .row > a > .title {`, `,\n\n  ${SCOPE} > .container > .row > a > .title {`),
    };
    for (const [name, mutate] of Object.entries(mutants)) {
        const mutant = mutate(candidate);
        assert.notEqual(mutant, candidate, `mutant did not change the candidate: ${name}`);
        assert.notDeepEqual(validate(mutant, original), [], `mutant accepted: ${name}`);
    }
    assert.ok(codes(validate(mutants['declaration indentation'](candidate), original)).includes('style-format'));
    assert.ok(codes(validate(mutants['table hover state'](candidate), original)).includes('css-state'));
    for (const name of ['grouped selector on one line', 'grouped selector continuation indented', 'blank line inside grouped selector']) {
        assert.deepEqual(codes(validate(mutants[name](candidate), original)), ['style-format', 'inverse'], name);
    }
    // Every non-presentation mutant is caught by the restored-source equality itself.
    for (const name of ['billing mode moved to POST', 'receipts formula changed', 'user escaping removed', 'stray div repaired']) {
        assert.deepEqual(codes(validate(mutants[name](candidate), original)), ['inverse'], name);
    }
});

test('live route is the untouched original or exactly the approved candidate', () => {
    const live = read(ROUTE);
    const candidate = buildCandidate(original);
    assert.ok(live === original || live === candidate, 'live route differs from both the frozen original and the approved candidate');
    assert.equal(invert(live), original);
    assert.deepEqual(codes(validate(live, original)), live === original ? MISSING_PRESENTATION : []);
});

test('production route carries the screen-only presentation seam', () => {
    assert.deepEqual(validate(read(ROUTE), original), []);
});
