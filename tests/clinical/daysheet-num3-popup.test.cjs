'use strict';

/*
 * OPEMR-58 contract for interface/billing/print_daysheet_report_num3.php, opened from
 * interface/billing/billing_report.php by SubmitTheEndDayPrint(): when use_custom_daysheet == 3,
 * the_form is POSTed to the named target 'new' (no window features, no explicit size), while the
 * route reads its criteria and mode from $_GET and only end_of_day_totals_only from POST.
 *
 * Dependency-free (node:test, assert, fs, path, crypto). Portable run, no git at all:
 *   node --test tests/clinical/daysheet-num3-popup.test.cjs
 * Mandatory Git-base authentication of the frozen fixture, the full inverse, the unchanged caller,
 * Header, config, shared assets, theme and sibling routes, and the exact changed-file allowlist
 * (a checkout without BASE_COMMIT fails this mode instead of skipping it):
 *   REQUIRE_GIT_BASELINE=1 node --test tests/clinical/daysheet-num3-popup.test.cjs
 * Another checkout can be targeted with DAYSHEET_NUM3_TARGET_ROOT=<repo root>; the frozen
 * fixture always comes from this test tree.
 *
 * Nothing here executes the route, its bootstrap or its caller. Only source text is read.
 *
 * The only accepted production delta is:
 *   1. one <style media="screen"> directly after the existing Header::setupHeader() line,
 *      keeping the original blank line before </head>;
 *   2. the marker oe-daysheet-num3-document appended to the existing body class, so
 *      <body class="body_top"> becomes <body class="body_top oe-daysheet-num3-document">.
 *      No attribute is added; body_top stays first.
 * Removing exactly that delta must give back the frozen original byte for byte, and that
 * equality is part of validate() itself, so every ACL check, GET/POST read, billing path,
 * per-user aggregation, line_total/line_total_pay and patient transition, amount format, escape,
 * translation, width, raw border='1'/border-0 table, malformed nesting and the close link stay
 * untouched.
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

const ROOT = process.env.DAYSHEET_NUM3_TARGET_ROOT
    ? path.resolve(process.env.DAYSHEET_NUM3_TARGET_ROOT)
    : path.resolve(__dirname, '..', '..');
const ROUTE = 'interface/billing/print_daysheet_report_num3.php';
const CALLER = 'interface/billing/billing_report.php';
// Sources this slice must not touch; checked against BASE_COMMIT in baseline mode.
const SHARED = [
    'src/Core/Header.php',
    'interface/clinical-workspace/popup.css',
    'interface/clinical-workspace/popup.js',
    'src/Common/Assets/ClinicalWorkspaceAssets.php',
    'interface/themes/theme-defaults.scss',
    'config/config.yaml',
    'interface/billing/print_daysheet_report_num1.php',
    'interface/billing/print_daysheet_report_num2.php',
];
// Every path this slice may differ from BASE_COMMIT in (tracked or untracked).
const FIXTURE_REL = 'tests/fixtures/daysheet-num3-original.php.txt';
const TEST_PHASE_FILES = [
    FIXTURE_REL,
    'tests/clinical/daysheet-num3-popup.test.cjs',
    'tests/js/clinical-daysheet-num3-popup.test.js',
    'docs/clinical-ui/DAYSHEET-NUM3-POPUP.md',
];
const ALLOWED_CHANGES = new Set([ROUTE, ...TEST_PHASE_FILES]);
// Non-executable extension: PHP scanners and the web server must never run the frozen copy.
const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'daysheet-num3-original.php.txt');
const BASE_COMMIT = '18647270e0c799189d2dc10f801e8de2bff1a360';
// SHA-256 of BASE_COMMIT:ROUTE (431 lines, terminal newline). Any byte change must fail.
const FIXTURE_SHA256 = '8d192eaabb8d7038b219696b0c75a8d56d6230362eea2aeb675f97e5b0616eee';
const FIXTURE_LINES = 431;

const MARKER = 'oe-daysheet-num3-document';
const HEADER_LINE = '<?php Header::setupHeader(); ?>\n';
const HEAD_CLOSE = '</head>\n';
const STYLE_OPEN = '<style media="screen">\n';
const STYLE_CLOSE = '</style>\n';
// The original keeps one blank line between the Header line and </head>; it stays.
const HEAD_TAIL = `\n${HEAD_CLOSE}`;
const BODY_ORIGINAL = '<body class="body_top">\n';
const BODY_MARKED = `<body class="body_top ${MARKER}">\n`;
const SCOPE = `html.oe-workbench-context body.${MARKER}`;

const INK = ['color', 'var(--oe-wb-ink, #17343b)'];
const CANVAS = ['background-color', 'var(--oe-wb-canvas, #f3f7f5)'];
const PAPER = ['background-color', 'var(--oe-wb-paper, #fff)'];

// Exact allowlist, in order: ink on canvas for the sheet; ink on paper for every raw table;
// ink on canvas for the close link and its .title span (the anchor is a direct child of the
// body, there is no container), as one grouped rule. Paired colour only.
const EXPECTED_RULES = [
    [SCOPE, [INK, CANVAS]],
    [`${SCOPE} table`, [INK, PAPER]],
    [`${SCOPE} > a, ${SCOPE} > a > .title`, [INK, CANVAS]],
];
const ALLOWED_PROPS = new Set(['color', 'background-color']);

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
const [RULE_BODY, RULE_TABLE, RULE_ANCHOR] = EXPECTED_RULES.map(ruleText);

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
    assert.equal(count(original, BODY_ORIGINAL), 1, 'exactly one <body class="body_top"> anchor in the original');
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
        // Colour must always be paired with its background in the same rule.
        const props = decls.map(([p]) => p);
        if (props.includes('color') !== props.includes('background-color')) problems.push(`[css-unpaired] ${selector}`);
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
    if (count(source, BODY_MARKED) !== 1) problems.push(`[body-marker] the existing <body class="body_top"> must become <body class="body_top ${MARKER}"> exactly once`);
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

// The caller's launch must stay the named-target POST: no features, no explicit size, num3
// selected only when use_custom_daysheet == 3.
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
    if (count(source, "'print_daysheet_report_num3.php'") !== 1) problems.push('num3 must be the target of exactly one launch branch');
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

// Mutant construction is separate from rejection: each edit first proves its anchor exists
// exactly once in the text it edits, then the built mutant must differ from its input.
const replaceOnce = (text, from, to, label) => {
    assert.equal(count(text, from), 1, `mutation anchor must be unique (${label}): ${JSON.stringify(from)}`);
    const out = text.replace(from, () => to);
    assert.notEqual(out, text, `mutation did not change the text (${label})`);
    return out;
};
const swap = (from, to) => (c, label) => replaceOnce(c, from, to, label);
// Edit one rule of the candidate style; the edit itself must hit exactly once in that rule.
const inRule = (rule, from, to) => (c, label) => replaceOnce(c, rule, replaceOnce(rule, from, to, `${label} in rule`), label);
const chain = (...steps) => (c, label) => steps.reduce((acc, step, i) => step(acc, `${label} step ${i + 1}`), c);
const buildMutants = (base, specs) => Object.fromEntries(Object.entries(specs).map(([name, mutate]) => [name, mutate(base, name)]));

const fixtureBytes = fs.readFileSync(FIXTURE);
const original = fixtureBytes.toString('utf8');

test('frozen fixture digest is pinned and the file is the complete 431-line original', () => {
    const actual = crypto.createHash('sha256').update(fixtureBytes).digest('hex');
    assert.equal(actual, FIXTURE_SHA256, `fixture sha256 is ${actual}`);
    assert.ok(original.startsWith('<?php\n\n/*\n * interface/billing/print_daysheet_report.php'), 'original header kept');
    assert.ok(original.endsWith('?>\n</body>\n</html>\n'), 'terminal newline kept');
    assert.equal(original.split('\n').length - 1, FIXTURE_LINES);
    assert.equal(count(original, '\r'), 0, 'LF line endings');
    assert.ok(FIXTURE.endsWith('.php.txt'), 'fixture is never executable PHP');
});

test('baseline mode is explicit', () => {
    const mode = process.env.REQUIRE_GIT_BASELINE;
    assert.ok(mode === undefined || mode === '' || mode === '0' || mode === '1', `REQUIRE_GIT_BASELINE must be unset, 0 or 1; got ${JSON.stringify(mode)}`);
});

if (process.env.REQUIRE_GIT_BASELINE === '1') {
    // Registered only on request, so portable runs neither call git nor report a skip.
    test(`mandatory Git baseline at ${BASE_COMMIT}: fixture, full inverse, unchanged sources, exact changed-file allowlist`, () => {
        const { execFileSync } = require('node:child_process');
        const git = (args) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 });
        // Throws, and so fails, when the base commit is absent (e.g. a shallow clone).
        assert.equal(git(['rev-parse', '--verify', `${BASE_COMMIT}^{commit}`]).toString('utf8').trim(), BASE_COMMIT);
        const base = git(['show', `${BASE_COMMIT}:${ROUTE}`]);
        assert.equal(crypto.createHash('sha256').update(base).digest('hex'), FIXTURE_SHA256);
        assert.ok(base.equals(fixtureBytes), `fixture differs byte-wise from ${BASE_COMMIT}:${ROUTE}`);
        const baseText = base.toString('utf8');
        const live = read(ROUTE);
        assert.equal(invert(live), baseText, 'live route minus the approved delta must equal the base route');
        assert.ok(live === baseText || live === buildCandidate(baseText), 'live route is the base or exactly the approved candidate');
        for (const rel of [CALLER, ...SHARED]) {
            assert.ok(git(['show', `${BASE_COMMIT}:${rel}`]).equals(fs.readFileSync(path.join(ROOT, rel))), `${rel} changed from ${BASE_COMMIT}`);
        }
        const lines = (buf) => buf.toString('utf8').split('\n').filter(Boolean);
        const changed = new Set([
            ...lines(git(['diff', '--name-only', BASE_COMMIT, '--'])),
            ...lines(git(['ls-files', '--others', '--exclude-standard'])),
        ]);
        const outside = [...changed].filter((rel) => !ALLOWED_CHANGES.has(rel));
        assert.deepEqual(outside, [], `paths changed outside the OPEMR-58 allowlist: ${JSON.stringify(outside)}`);
        for (const rel of TEST_PHASE_FILES) assert.ok(changed.has(rel), `${rel} must be part of the change set`);
        // Exact: the route is in the change set if and only if production carries the seam.
        assert.equal(changed.has(ROUTE), live !== baseText, 'route change-set membership must match whether the seam is present');
    });
}

test('frozen original has the anchors and legacy behaviour the seam must preserve', () => {
    for (const needle of [
        "if (!AclMain::aclCheckCore('acct', 'eob', '', 'write') && !AclMain::aclCheckCore('acct', 'bill', '', 'write')) {",
        '    AccessDeniedHelper::denyWithTemplate("ACL check failed for acct/eob or acct/bill: Billing Manager", xl("Billing Manager"));\n',
        '//global variables:\nif (!isset($_GET["mode"])) {',
        '$list = [];\nif (isset($_GET["mode"]) && $_GET["mode"] === \'bill\') {\n    BillingReport::billCodesList($list);\n}\n',
        'getBillsBetweendayReport($code_type)',
        "filter_input(INPUT_POST, 'end_of_day_totals_only', FILTER_VALIDATE_INT) === 1",
        '$user_totals[$u] ??= [',
        "$user_totals[$u]['inspay'] += is_numeric($insCodeVal) ? (float) $insCodeVal : 0.0;",
        "static fn (array $t): bool => $t['fee'] != 0",
        "$line_total += $iter['fee'];",
        "$line_total_pay += $iter['ins_adjust_dollar'];",
        "if ($old_pid != $iter['pid'] and ($iter['code_type'] != 'payment_info')) {",
        '$new_old_pid = $old_pid;',
        'substr($query_part_day, 37, 10)',
        'substr($query_part_day, 63, 10)',
        "$user = text($row['user']);",
        "$gtotalFee = sprintf('%.2f', $gtotal_fee);",
        '<a href="javascript:window.close();" target="Main"><span class="title"><?php echo xlt(\'Day Sheet Report\')?></span></a>\n<br />\n',
        `<head>\n\n${HEADER_LINE}${HEAD_TAIL}${BODY_ORIGINAL}\n<a href=`,
        'print "<table class=\'border-0\'><tr>\\n";',
        '<br /></td></table>\n    HTML;',
        '?>\n</body>\n</html>\n',
    ]) {
        assert.equal(count(original, needle), 1, needle);
    }
    // Duplicated GET computation stays; criteria and mode come from GET, totals-only from POST.
    assert.equal(count(original, 'if (!isset($_GET["mode"])) {'), 2);
    assert.equal(count(original, '$_POST'), 0);
    assert.equal(count(original, '$_REQUEST'), 0);
    assert.equal(count(original, 'INPUT_POST'), 1);
    assert.equal(count(original, 'INPUT_GET'), 0);
    // Two identical running-total cells; both stay.
    assert.equal(count(original, '$totalValue = $line_total != 0 ? $line_total : $line_total_pay;'), 2);
    // Raw legacy tables: one border-0 detail table, two border='1' totals tables, one closer.
    assert.equal(count(original, "<table class='border-0'>"), 1);
    assert.equal(count(original, "<table border='1'>"), 2);
    assert.equal(count(original, '</table>'), 1);
    // No container, wrapper, font, style, script, print audit or auto print in this target.
    assert.equal(count(original, '<div'), 0);
    assert.equal(count(original, '<font'), 0);
    assert.equal(count(original, 'class="'), 2, 'only <body class="body_top"> and <span class="title"> carry double-quoted classes');
    assert.equal(count(original, '<style'), 0);
    assert.equal(count(original, '<script'), 0);
    assert.equal(count(original, 'printLogPrint'), 0);
    assert.equal(count(original, 'window.print'), 0);
    assert.equal(count(original, 'margin'), 0, 'no legacy margin attributes on this body');
    assert.equal(count(original, MARKER), 0);
});

test('activation context and token defaults the seam relies on are present', () => {
    assert.match(read('config/config.yaml'), / {2}workbench-popup:\n {4}basePath: '%webroot%\/interface\/clinical-workspace\/'\n {4}script: popup\.js\n {4}link: popup\.css\n {4}autoload: true\n/);
    assert.ok(read('interface/clinical-workspace/popup.js').includes("const CONTEXT_CLASS = 'oe-workbench-context';"));
    const popupCss = read('interface/clinical-workspace/popup.css');
    const tokens = Array.from(JSON.stringify(EXPECTED_RULES).matchAll(/var\((--oe-wb-[a-z-]+), (#[0-9a-f]+)\)/g));
    assert.deepEqual([...new Set(tokens.map(([, token]) => token))].sort(), ['--oe-wb-canvas', '--oe-wb-ink', '--oe-wb-paper']);
    for (const [, token, fallback] of tokens) {
        assert.ok(popupCss.includes(`    ${token}: ${fallback};\n`), `${token} default is ${fallback} in popup.css`);
    }
});

test('opener discovery model: active, closed, cross-origin and missing opener snapshots', () => {
    // A load-time snapshot model only; it is not proof of ongoing opener revocation.
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
    const inLaunch = (from, to) => swap(CALLER_LAUNCH, replaceOnce(CALLER_LAUNCH, from, to, 'launch'));
    const mutants = buildMutants(caller, {
        'blank target': inLaunch("target = 'new';", "target = '_blank';"),
        'self target': inLaunch("target = 'new';", "target = '_self';"),
        'num3 route given a GET mode': inLaunch("'print_daysheet_report_num3.php'", "'print_daysheet_report_num3.php?mode=bill'"),
        'num3 condition widened': inLaunch("get('use_custom_daysheet') == 3)", "get('use_custom_daysheet') >= 3)"),
        'num3 retargeted to num2': inLaunch("'print_daysheet_report_num3.php'", "'print_daysheet_report_num2.php'"),
        'mode forced': inLaunch('            top.restoreSession();\n', "            top.restoreSession();\n            document.the_form.mode.value = 'bill';\n"),
        'sized window': inLaunch('            document.the_form.submit();\n', "            window.open('', 'new', 'width=800,height=600');\n            document.the_form.submit();\n"),
        'noopener': inLaunch('            document.the_form.submit();\n', "            window.open('', 'new', 'noopener');\n            document.the_form.submit();\n"),
        'form switched to GET': swap("name='the_form' method='post'", "name='the_form' method='get'"),
        'second definition': swap(CALLER_LAUNCH, CALLER_LAUNCH + CALLER_LAUNCH.replace('{ //Action', '{ // copy')),
    });
    for (const [name, mutant] of Object.entries(mutants)) {
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
    assert.ok(candidate.includes(`<head>\n\n${HEADER_LINE}${STYLE_BLOCK}${HEAD_TAIL}${BODY_MARKED}\n<a href=`));
    const css = extractStyle(candidate);
    const cssLines = css.split('\n');
    assert.equal(cssLines.map((line) => (line === '' ? '' : line.slice(2))).join('\n'),
        EXPECTED_RULES.map(([s, d]) => `${selectorLines(s).join(',\n')} {\n${declText(d, '  ')}}\n`).join('\n'));
    assert.deepEqual(cssLines.filter((line) => CSS_SELECTOR_CONTINUATION.test(line)), [`  ${SCOPE} > a,`]);
    assert.equal(count(css, ':'), count(css, ';'), 'no pseudo selectors; one colon per declaration');
    assert.equal(count(css, 'color: var(--oe-wb-ink, #17343b);'), 3, 'every rule pairs ink');
    // Only the head seam and the appended class token differ; body_top stays first, no attribute added.
    assert.ok(BODY_MARKED.startsWith('<body class="body_top '));
    assert.equal(count(candidate, '<body '), 1);
    assert.equal(candidate.slice(candidate.indexOf(BODY_MARKED) + BODY_MARKED.length), original.slice(original.indexOf(BODY_ORIGINAL) + BODY_ORIGINAL.length));
    assert.equal(candidate.length - original.length, STYLE_BLOCK.length + ` ${MARKER}`.length);
    assert.deepEqual(codes(validate(original, original)), MISSING_PRESENTATION);
});

test('meaningful mutations of the candidate are rejected', () => {
    const candidate = buildCandidate(original);
    const colorLine = `    ${INK[0]}: ${INK[1]};\n`;
    const canvasLine = `    ${CANVAS[0]}: ${CANVAS[1]};\n`;
    const paperLine = `    ${PAPER[0]}: ${PAPER[1]};\n`;
    const tail = STYLE_CLOSE + HEAD_TAIL;
    const splitAnchor = ruleText([`${SCOPE} > a`, [INK, CANVAS]]) + '\n' + ruleText([`${SCOPE} > a > .title`, [INK, CANVAS]]);
    const marked = (attrs) => swap(BODY_MARKED, `<body ${attrs}>\n`);

    // Edits outside the presentation seam: the restored-source equality alone must catch them.
    const source = buildMutants(candidate, {
        // ACL
        'ACL write downgraded to view': swap("AclMain::aclCheckCore('acct', 'eob', '', 'write')", "AclMain::aclCheckCore('acct', 'eob', '', 'view')"),
        'ACL deny removed': swap('    AccessDeniedHelper::denyWithTemplate("ACL check failed for acct/eob or acct/bill: Billing Manager", xl("Billing Manager"));\n', ''),
        'ACL widened': swap("'write') && !AclMain::aclCheckCore('acct', 'bill'", "'write') || !AclMain::aclCheckCore('acct', 'bill'"),
        'bill ACL dropped': swap(" && !AclMain::aclCheckCore('acct', 'bill', '', 'write')", ''),
        // GET/POST and billing path
        'billing call removed': swap('    BillingReport::billCodesList($list);\n', ''),
        'billing mode moved to POST': swap('if (isset($_GET["mode"]) && $_GET["mode"] === \'bill\') {', 'if (isset($_POST["mode"]) && $_POST["mode"] === \'bill\') {'),
        'empty bill list prefilled': swap('$list = [];\nif (isset', '$list = [1];\nif (isset'),
        'criteria moved to POST': swap('//global variables:\nif (!isset($_GET["mode"])) {', '//global variables:\nif (!isset($_POST["mode"])) {'),
        'duplicated GET block disabled': swap('    $code_type = \'%\';\n}\n\nif (!isset($_GET["mode"])) {', '    $code_type = \'%\';\n}\n\nif (false && !isset($_GET["mode"])) {'),
        'totals switch moved to GET': swap("filter_input(INPUT_POST, 'end_of_day_totals_only'", "filter_input(INPUT_GET, 'end_of_day_totals_only'"),
        'totals switch loosened': swap("'end_of_day_totals_only', FILTER_VALIDATE_INT) === 1", "'end_of_day_totals_only', FILTER_VALIDATE_INT) == 1"),
        // query / dynamic per-user aggregation
        'report query changed': swap('getBillsBetweendayReport($code_type)', 'getBillsBetweenReport($code_type)'),
        'per-user map capped': swap('$user_totals[$u] ??= [', 'if (count($user_totals) < 20) $user_totals[$u] ??= ['),
        'user key collapsed': swap("$u = is_string($userVal) ? $userVal : '';", "$u = '';"),
        'inspay aggregates adjustments': swap("$user_totals[$u]['inspay'] += is_numeric($insCodeVal) ? (float) $insCodeVal : 0.0;", "$user_totals[$u]['inspay'] += is_numeric($insAdjVal) ? (float) $insAdjVal : 0.0;"),
        'fee aggregation truncated': swap("$user_totals[$u]['fee']    += is_numeric($feeVal) ? (float) $feeVal : 0.0;", "$user_totals[$u]['fee']    += is_numeric($feeVal) ? (int) $feeVal : 0.0;"),
        'zero-total filter changed': swap("static fn (array $t): bool => $t['fee'] != 0", "static fn (array $t): bool => $t['fee'] > 0"),
        // line_total / line_total_pay and patient transitions
        'line_total sums units': swap("$line_total += $iter['fee'];", "$line_total += $iter['units'];"),
        'line_total_pay sign flipped': swap("$line_total_pay += $iter['ins_adjust_dollar'];", "$line_total_pay -= $iter['ins_adjust_dollar'];"),
        'line totals not reset': swap('                    $line_total = 0;\n                    $line_total_pay = 0;\n', ''),
        'patient transition ignores payment_info': swap("if ($old_pid != $iter['pid'] and ($iter['code_type'] != 'payment_info')) {", "if ($old_pid != $iter['pid']) {"),
        'patient marker not advanced': swap('$new_old_pid = $old_pid;', "$new_old_pid = $iter['pid'];"),
        'payment_info rows printed': swap("if ($iter['code_type'] != 'payment_info') {", 'if (true) {'),
        'unbilled sentinel date changed': swap('== "1969-12-31"', '== "1970-01-01"'),
        // formulas and amount formatting
        'grand total sign changed': swap("$gtotal_patpay += $row['patpay'];", "$gtotal_patpay -= $row['patpay'];"),
        'grand money precision changed': swap("$gtotalFee = sprintf('%.2f', $gtotal_fee);", "$gtotalFee = sprintf('%.0f', $gtotal_fee);"),
        'per-user money format changed': swap("$fee = sprintf('%.2f', $row['fee']);", "$fee = number_format($row['fee'], 2);"),
        'query_part_day offset changed': swap('substr($query_part_day, 37, 10)', 'substr($query_part_day, 36, 10)'),
        'query_part_day end offset changed': swap('substr($query_part_day, 63, 10)', 'substr($query_part_day, 64, 10)'),
        // escaping / translations / comments
        'user escaping removed': swap("$user = text($row['user']);", "$user = $row['user'];"),
        'patient name escaping removed': swap('text($name["fname"])', '$name["fname"]'),
        'code type escaping removed': swap("text($iter['code_type'])", "$iter['code_type']"),
        'title translation helper': swap("xlt('Day Sheet Report')", "xl('Day Sheet Report')"),
        'translation key changed': swap("xlt('No Data to Process')", "xlt('No data')"),
        'range translation key changed': swap("xlt('To{{Range}}')", "xlt('To')"),
        'grand totals label unescaped': swap("$grandTotalsLabel = xlt('Grand Totals');", "$grandTotalsLabel = xl('Grand Totals');"),
        'header comment edited': swap(' * Program for Generating an End of Day report\n', ' * Program for generating an end of day report\n'),
        // raw tables, widths, weights, malformed markup
        'detail table bordered': swap('print "<table class=\'border-0\'><tr>\\n";', 'print "<table class=\'table-bordered\'><tr>\\n";'),
        'grand totals table unbordered': swap("    <table border='1'><tr>\n    <br /><br /><td width='70'><span class='text'><strong><center>{$grandTotalsLabel}", "    <table border='0'><tr>\n    <br /><br /><td width='70'><span class='text'><strong><center>{$grandTotalsLabel}"),
        'per-user table closed': swap('<br /></td>\n        HTML;', '<br /></td></table>\n        HTML;'),
        'grand totals nesting repaired': swap('<center>{$gtotalPatpay}<br /></td></table>', '<center>{$gtotalPatpay}</center></strong></span><br /></td></tr></table>'),
        'adjustment width changed': swap('<td width=\'250\'><span class=\'text\'><center>" . xlt("Insurance Adjustment")', '<td width=\'300\'><span class=\'text\'><center>" . xlt("Insurance Adjustment")'),
        'units cell width changed': swap('print "<td class=\'w-100\'><span class=\'text\'><center>" . "1" . "</center>" ;', 'print "<td class=\'w-50\'><span class=\'text\'><center>" . "1" . "</center>" ;'),
        'patient name weight changed': swap("<span class='font-weight-bold'>", "<span class='font-weight-normal'>"),
        'title span replaced': swap('<span class="title">', '<h2 class="title">'),
        'no-data span styled': swap("?><span><?php echo xlt('No Data to Process')", "?><span class='text-muted'><?php echo xlt('No Data to Process')"),
        // close action, print, state
        'close action changed': swap('<a href="javascript:window.close();" target="Main">', '<a href="javascript:history.back();" target="Main">'),
        'close target dropped': swap(' target="Main"><span', '><span'),
        'print audit added': swap('</body>\n', '<script>\n    opener.top.printLogPrint(window);\n</script>\n</body>\n'),
        'auto print added': swap('</body>\n', '<script>window.print();</script>\n</body>\n'),
        'control added': swap('</a>\n<br />\n', '</a>\n<button type="button" onclick="window.print()">Print</button>\n<br />\n'),
    });
    for (const [name, mutant] of Object.entries(source)) {
        assert.deepEqual(codes(validate(mutant, original)), ['inverse'], `source mutant not caught by restored-source equality alone: ${name}`);
    }

    const presentation = buildMutants(candidate, {
        // body marker on the existing body_top class; no attribute may be added
        'marker missing': swap(BODY_MARKED, BODY_ORIGINAL),
        'body_top dropped': marked(`class="${MARKER}"`),
        'marker prepended': marked(`class="${MARKER} body_top"`),
        'extra class': marked(`class="body_top ${MARKER} oe-extra"`),
        'double space between classes': marked(`class="body_top  ${MARKER}"`),
        'class single-quoted': marked(`class='body_top ${MARKER}'`),
        'second class attribute': marked(`class="body_top" class="${MARKER}"`),
        'legacy margin attributes added': marked(`class="body_top ${MARKER}" topmargin="0" leftmargin="2"`),
        'inline style added': marked(`class="body_top ${MARKER}" style="margin: 0"`),
        'body onload print': marked(`class="body_top ${MARKER}" onload="window.print()"`),
        'marker on html': chain(swap(BODY_MARKED, BODY_ORIGINAL), swap('<html>\n', `<html class="${MARKER}">\n`)),
        'marker duplicated on anchor': swap('<a href="javascript:window.close();"', `<a class="${MARKER}" href="javascript:window.close();"`),
        'body wrapper': swap(BODY_MARKED, `${BODY_MARKED}<div class="${MARKER}-wrap">\n`),
        // Header / placement / whitespace around the seam
        'Header assets changed': swap(HEADER_LINE + STYLE_OPEN, "<?php Header::setupHeader(['common']); ?>\n" + STYLE_OPEN),
        'blank line before </head> dropped': swap(tail, STYLE_CLOSE + HEAD_CLOSE),
        'blank line after Header added': swap(HEADER_LINE + STYLE_OPEN, HEADER_LINE + '\n' + STYLE_OPEN),
        'duplicated style': swap(HEAD_CLOSE, STYLE_BLOCK + HEAD_CLOSE),
        'style moved to body end': chain(swap(SEAM, HEADER_LINE), swap('</body>\n', STYLE_BLOCK + '</body>\n')),
        'style before Header': swap(SEAM, STYLE_BLOCK + HEADER_LINE),
        'shared asset link': swap(HEADER_LINE + STYLE_OPEN, `${HEADER_LINE}<link rel="stylesheet" href="../clinical-workspace/popup.css">\n${STYLE_OPEN}`),
        'head script': swap(tail, `${STYLE_CLOSE}<script src="../clinical-workspace/popup.js"></script>\n${HEAD_TAIL}`),
        // media
        'media all': swap(STYLE_OPEN, '<style media="all">\n'),
        'media print': swap(STYLE_OPEN, '<style media="print">\n'),
        'media screen and print': swap(STYLE_OPEN, '<style media="screen, print">\n'),
        'media missing': swap(STYLE_OPEN, '<style>\n'),
        // scope / selectors / states
        'context scope dropped': inRule(RULE_BODY, 'html.oe-workbench-context body.', 'body.'),
        'popup scope substituted': inRule(RULE_TABLE, 'html.oe-workbench-context', 'html.oe-workbench-popup'),
        'scope keyed on body_top': inRule(RULE_BODY, `body.${MARKER}`, 'body.body_top'),
        'table narrowed to child': inRule(RULE_TABLE, ' table {', ' > table {'),
        'table as bootstrap class': inRule(RULE_TABLE, ' table {', ' .table {'),
        'table hover state': inRule(RULE_TABLE, ' table {', ' table:hover {'),
        'anchor descendant': inRule(RULE_ANCHOR, `${SCOPE} > a,`, `${SCOPE} a,`),
        'anchor title dropped': inRule(RULE_ANCHOR, `,\n  ${SCOPE} > a > .title`, ''),
        'anchor rule split': swap(RULE_ANCHOR, splitAnchor),
        'focus-visible grouped': inRule(RULE_ANCHOR, ' > a > .title {', ` > a > .title,\n  ${SCOPE} > a:focus-visible {`),
        'descendant text classes': inRule(RULE_TABLE, ' table {', ` table,\n  ${SCOPE} .text {`),
        'selector order': swap(STYLE_BLOCK, renderStyle([EXPECTED_RULES[1], EXPECTED_RULES[0], EXPECTED_RULES[2]])),
        'extra unscoped selector': swap(tail, `\n  table {\n    color: #17343b;\n    background-color: #fff;\n  }\n${tail}`),
        'rule repeated': swap(tail, `\n${RULE_TABLE}${tail}`),
        // properties / values / pairing / tokens
        'declaration order': inRule(RULE_BODY, colorLine + canvasLine, canvasLine + colorLine),
        'body canvas swapped for paper': inRule(RULE_BODY, CANVAS[1], PAPER[1]),
        'table paper swapped for canvas': inRule(RULE_TABLE, PAPER[1], CANVAS[1]),
        'anchor canvas swapped for paper': inRule(RULE_ANCHOR, CANVAS[1], PAPER[1]),
        'transparent background': inRule(RULE_TABLE, PAPER[1], 'transparent'),
        'ink fallback changed': inRule(RULE_TABLE, 'var(--oe-wb-ink, #17343b)', 'var(--oe-wb-ink, #000)'),
        'raw ink without token': inRule(RULE_BODY, 'var(--oe-wb-ink, #17343b)', '#17343b'),
        'token renamed': inRule(RULE_BODY, '--oe-wb-ink,', '--oe-wb-text,'),
        'unpaired table ink': inRule(RULE_TABLE, paperLine, ''),
        'unpaired anchor background': inRule(RULE_ANCHOR, colorLine, ''),
        'table edge': inRule(RULE_TABLE, paperLine, `${paperLine}    box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);\n`),
        'table border': inRule(RULE_TABLE, paperLine, `${paperLine}    border: 1px solid #d9e4e2;\n`),
        'body geometry': inRule(RULE_BODY, canvasLine, `${canvasLine}    margin: 0;\n`),
        'table width': inRule(RULE_TABLE, paperLine, `${paperLine}    width: 100%;\n`),
        'font family': inRule(RULE_BODY, canvasLine, `${canvasLine}    font-family: Arial, sans-serif;\n`),
        'font size': inRule(RULE_ANCHOR, canvasLine, `${canvasLine}    font-size: 1rem;\n`),
        'text decoration': inRule(RULE_ANCHOR, canvasLine, `${canvasLine}    text-decoration: none;\n`),
        'duplicate property': inRule(RULE_BODY, colorLine, colorLine + colorLine),
        'important': inRule(RULE_TABLE, 'var(--oe-wb-paper, #fff);', 'var(--oe-wb-paper, #fff) !important;'),
        'print rule': swap(tail, `\n  @media print {\n    body { color: #000; }\n  }\n${tail}`),
        'css comment': inRule(RULE_BODY, ' {\n', ' {\n    /* note */\n'),
        // format
        'declaration indentation': swap(STYLE_BLOCK, STYLE_BLOCK.replace(/^ {4}(?=[a-z])/gm, ' '.repeat(6))),
        'selector indentation': inRule(RULE_BODY, `  ${SCOPE} {`, `${SCOPE} {`),
        'blank line between rules removed': swap(STYLE_BLOCK, STYLE_BLOCK.replace('  }\n\n  html', '  }\n  html')),
        'grouped selector on one line': swap(RULE_ANCHOR, singleLineRuleText(EXPECTED_RULES[2])),
        'grouped selector continuation indented': inRule(RULE_ANCHOR, `,\n  ${SCOPE} > a > .title {`, `,\n    ${SCOPE} > a > .title {`),
        'blank line inside grouped selector': inRule(RULE_ANCHOR, `,\n  ${SCOPE} > a > .title {`, `,\n\n  ${SCOPE} > a > .title {`),
    });
    for (const [name, mutant] of Object.entries(presentation)) {
        assert.notDeepEqual(validate(mutant, original), [], `presentation mutant accepted: ${name}`);
    }
    const codesOf = (name) => codes(validate(presentation[name], original));
    assert.ok(codesOf('declaration indentation').includes('style-format'));
    assert.ok(codesOf('selector indentation').includes('style-format'));
    assert.ok(codesOf('table hover state').includes('css-state'));
    assert.ok(codesOf('unpaired table ink').includes('css-unpaired'));
    assert.ok(codesOf('font family').includes('css-property'));
    assert.ok(codesOf('important').includes('css-forbidden'));
    assert.ok(codesOf('print rule').includes('css-forbidden'));
    assert.ok(codesOf('raw ink without token').includes('css-rules'));
    assert.ok(codesOf('Header assets changed').includes('header'));
    for (const name of ['body_top dropped', 'marker prepended', 'legacy margin attributes added', 'second class attribute']) {
        assert.ok(codesOf(name).includes('body-marker') && codesOf(name).includes('inverse'), name);
    }
    for (const name of ['grouped selector on one line', 'grouped selector continuation indented', 'blank line inside grouped selector']) {
        assert.deepEqual(codesOf(name), ['style-format', 'inverse'], name);
    }
});

test('arbitrary one-character edits to the restored source are rejected by the inverse', () => {
    // Insert or delete one character at evenly spaced offsets of the original that lie outside
    // the two seam anchors, rebuild the candidate around the edit, and require rejection.
    const headAt = original.indexOf(HEADER_LINE + HEAD_TAIL);
    const bodyAt = original.indexOf(BODY_ORIGINAL);
    const inAnchor = (i) => (i >= headAt && i <= headAt + HEADER_LINE.length + HEAD_TAIL.length)
        || (i >= bodyAt && i <= bodyAt + BODY_ORIGINAL.length);
    const offsets = Array.from({ length: 64 }, (_, k) => Math.floor((k * (original.length - 1)) / 63)).filter((i) => !inAnchor(i));
    assert.ok(offsets.length >= 56, 'enough sampled offsets');
    for (const i of offsets) {
        for (const edited of [original.slice(0, i) + 'Z' + original.slice(i), original.slice(0, i) + original.slice(i + 1)]) {
            assert.notEqual(edited, original);
            assert.deepEqual(codes(validate(buildCandidate(edited), original)), ['inverse'], `edit at offset ${i} accepted`);
        }
    }
});

test('decision record documents scope, owner, evidence limits and open native acceptance', () => {
    const doc = read('docs/clinical-ui/DAYSHEET-NUM3-POPUP.md');
    for (const needle of [
        'OPEMR-58', 'Hermes', BASE_COMMIT, FIXTURE_SHA256, MARKER, 'body_top', 'end_of_day_totals_only',
        'billCodesList', 'printLogPrint', 'line_total_pay', 'REQUIRE_GIT_BASELINE=1', 'native acceptance',
        'Hosted verification is pending',
    ]) {
        assert.ok(doc.includes(needle), `doc mentions ${needle}`);
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
    // Expected to fail before the production change with exactly MISSING_PRESENTATION codes.
    assert.deepEqual(validate(read(ROUTE), original), []);
});
