/*
 * OPEMR-48 source contract: the prescription label popup gains exactly one
 * screen-only presentation addition (an inline <style media="screen"> block right
 * after its workbench-popup opt-in, and a body marker class) and nothing else changes.
 * The label keeps its black legacy ink, 200pt table, 7pt/9pt type, black separator,
 * nowrap cells, escaping, include_opener script and print/audit callback.
 *
 * Dependency-free: run with `node --test tests/fixtures/clinical-workspace/prescription-label-popup.contract.cjs`.
 * The frozen master source sits next to this file, so shallow and fresh clones need no Git history.
 * Local history mode is explicit: OPENEMR_PRESCRIPTION_LABEL_GIT_HISTORY=1 compares the fixture
 * with the exact base commit and fails (never skips) if that history is unavailable.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen <craig@interconnected.au>
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURE = path.join(__dirname, 'dispense_drug.master-18647270.txt');
const BASE_SHA = '18647270e0c799189d2dc10f801e8de2bff1a360';
const HISTORY_ENV = 'OPENEMR_PRESCRIPTION_LABEL_GIT_HISTORY';
const LABEL = 'interface/drugs/dispense_drug.php';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const POPUP_JS = 'interface/clinical-workspace/popup.js';

// Same digest WorkbenchPopupHeaderfreeTest pins for the dispense label (opt-in lines removed).
const PIN = '65a545871d768db317f6250bed79e0be92ac191893deef70616a161814ffc481';
const OPT_IN = "<?php echo Header::setupAssets(['workbench-popup']); ?>";
const USE_HEADER = 'use OpenEMR\\Core\\Header;';
const OPT_IN_LINE = '   ' + OPT_IN + '\n';

const MARKER = 'oe-prescription-label-popup';
const SCOPE = 'html.oe-workbench-context body.' + MARKER;
const STYLE_BLOCK = [
    '<style media="screen">',
    SCOPE + ' {',
    '  background-color: var(--oe-wb-canvas, #f3f7f5);',
    '}',
    '',
    SCOPE + ' > center > table {',
    '  background-color: var(--oe-wb-paper, #fff);',
    '}',
    '</style>',
    ''
].join('\n');
const MARGINS = "leftmargin='0' topmargin='0' marginwidth='0' marginheight='0'>";
const ORIGINAL_BODY = '</head>\n<body ' + MARGINS + '\n';
const MARKED_BODY = '</head>\n<body class="' + MARKER + '" ' + MARGINS + '\n';

const EXPECTED_RULES = [
    { selector: SCOPE, declarations: [['background-color', 'var(--oe-wb-canvas, #f3f7f5)']] },
    { selector: SCOPE + ' > center > table', declarations: [['background-color', 'var(--oe-wb-paper, #fff)']] }
];
// The label text keeps its legacy black ink; no ink, shadow, border, padding, geometry or type.
const ALLOWED_PROPERTIES = ['background-color'];
const LEGACY_INK = '#000000';

const LABEL_TABLE = "<center>\n<table border='0' cellpadding='0' cellspacing='0' style='width: 200pt'>\n";
const SEPARATOR = " <tr><td style='background-color: #000000; height: 5pt;'></td></tr>\n";
const PRESERVED = [
    ['legacy body type', 'body {\n    font-family: sans-serif;\n    font-size: 9pt;\n    font-weight: normal;\n}\n'],
    ['labtop black 7pt', '.labtop {\n    color: #000000;\n    font-family: sans-serif;\n    font-size: 7pt;\n'],
    ['labbot black 9pt', '.labbot {\n    color: #000000;\n    font-family: sans-serif;\n    font-size: 9pt;\n'],
    ['200pt label table', LABEL_TABLE],
    ['black separator', SEPARATOR],
    ['nowrap header cell', ' <tr><td class="labtop" nowrap>\n'],
    ['nowrap label cell', ' <tr><td class="labbot" nowrap>\n'],
    ['header escaping', '        <?php echo nl2br(text($header_text)); ?>\n'],
    ['label escaping', '        <?php echo nl2br(text($label_text)); ?>\n'],
    ['title escaping', "   <title><?php echo xlt('Prescription Label') ; ?></title>\n"],
    ['include_opener script', '    <script src="<?php echo $webroot ?>/interface/main/tabs/js/include_opener.js?v=<?php echo attr_url('],
    ['print/audit callback', ' var win = top.printLogPrint ? top : opener.top;\n win.printLogPrint(window);\n'],
    ['admin/drugs ACL', "if (!AclMain::aclCheckCore('admin', 'drugs')) {\n"],
    ['sale query binding', '    "s.sale_id = ? AND " .\n'],
    ['sale query parameters', '    "u.id = r.provider_id", [$sale_id]);\n'],
    ['sellDrug call', '$sale_id = sellDrug($drug_id, $quantity, $fee, $pid, $encounter, $prescription_id, $today, $user);'],
    ['exception escaping', '    die(text($e->getMessage()));\n']
];

function read(relative) {
    return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function count(haystack, needle) {
    return haystack.split(needle).length - 1;
}

function sha256(text) {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// Mirrors WorkbenchPopupHeaderfreeTest::withoutOptIn().
function withoutOptIn(source) {
    return source
        .split(/(?<=\n)/)
        .filter((line) => ![OPT_IN, USE_HEADER].includes(line.trim()))
        .join('');
}

// Exact inverse of the approved addition (style and marker together, once each);
// any other shape is left in place so it shows up as drift.
function withoutPresentation(source) {
    const styled = OPT_IN_LINE + STYLE_BLOCK;
    if (
        count(source, styled) !== 1
        || count(source, STYLE_BLOCK) !== 1
        || count(source, MARKED_BODY) !== 1
        || count(source, MARKER) !== 3
    ) {
        return source;
    }
    return source.replace(styled, OPT_IN_LINE).replace(MARKED_BODY, ORIGINAL_BODY);
}

function withPresentation(source) {
    assert.equal(count(source, OPT_IN_LINE), 1, 'opt-in line must be unique');
    assert.equal(count(source, ORIGINAL_BODY), 1, 'original body must be unique');
    return source.replace(OPT_IN_LINE, OPT_IN_LINE + STYLE_BLOCK).replace(ORIGINAL_BODY, MARKED_BODY);
}

function parseRules(block) {
    const match = /^<style media="screen">\n([\s\S]*)<\/style>\n$/.exec(block);
    if (!match) return null;
    const rules = [];
    const pattern = /([^{}]+)\{([^{}]*)\}/g;
    let rest = match[1];
    let found;
    while ((found = pattern.exec(match[1])) !== null) {
        rules.push({
            selector: found[1].trim(),
            declarations: found[2].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
                const colon = d.indexOf(':');
                return [d.slice(0, colon).trim(), d.slice(colon + 1).trim()];
            })
        });
        rest = rest.replace(found[0], '');
    }
    return rest.trim() === '' ? rules : null;
}

function luminance(hex) {
    const full = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1);
    const [r, g, b] = [0, 2, 4].map((i) => {
        const c = parseInt(full.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

// Semantic checks on the approved block itself, against the shared palette tokens.
function blockViolations(block, popupCss) {
    const violations = [];
    const rules = parseRules(block);
    if (!rules) return ['block is not a single screen-only <style> of plain rules'];
    if (/!important|@media|@import|@supports|url\(|<script|expression\(/i.test(block)) violations.push('block carries forbidden CSS');
    if (/\b(td|tr|tbody)\b|\[|:not|:nth|~|\+/.test(rules.map((r) => r.selector).join('\n'))) violations.push('selector reaches the separator or cells');
    if (JSON.stringify(rules) !== JSON.stringify(EXPECTED_RULES)) violations.push('rules differ from the approved two rules');
    for (const rule of rules) {
        if (!rule.selector.startsWith(SCOPE)) violations.push(`unscoped selector: ${rule.selector}`);
        for (const [prop, value] of rule.declarations) {
            if (!ALLOWED_PROPERTIES.includes(prop)) violations.push(`property beyond background-color: ${prop}`);
            for (const token of value.matchAll(/var\((--oe-wb-[a-z-]+), (#[0-9a-f]{3,6})\)/g)) {
                if (!popupCss.includes(`    ${token[1]}: ${token[2]};`)) violations.push(`fallback ${token[2]} is not the ${token[1]} token`);
                if (contrast(LEGACY_INK, token[2]) < 4.5) violations.push(`legacy black ink below 4.5:1 on ${token[2]}`);
            }
        }
    }
    return violations;
}

// Everything a candidate dispense_drug.php must satisfy; [] means approved.
// Baseline restoration is part of approval, not a separate test.
function candidateViolations(candidate, fixture, popupCss) {
    const violations = [];
    if (count(candidate, STYLE_BLOCK) !== 1) violations.push('approved screen style block missing or repeated');
    if (count(candidate, OPT_IN_LINE + STYLE_BLOCK + '</head>\n') !== 1) violations.push('style block not directly after the opt-in, closing the head');
    if (count(candidate, MARKED_BODY) !== 1) violations.push('body marker class missing, relocated or altered');
    if (count(candidate, MARKER) !== 3) violations.push('marker class repeated or relocated');
    if (count(candidate, '<style') !== 2) violations.push('unexpected number of <style> elements');
    if (count(candidate, 'media=') !== 1 || count(candidate, '<style media="screen">') !== 1) violations.push('presentation is not screen-only');
    if (withoutPresentation(candidate) !== fixture) violations.push('original source, legacy label CSS or markup drifted from the frozen baseline');
    if (sha256(withoutOptIn(withoutPresentation(candidate))) !== PIN) violations.push('PHP whole-file pin would fail');
    const start = candidate.indexOf(OPT_IN_LINE);
    const end = candidate.indexOf('</head>\n', start);
    if (start >= 0 && end > start) violations.push(...blockViolations(candidate.slice(start + OPT_IN_LINE.length, end), popupCss));
    for (const [label, needle] of PRESERVED) {
        if (count(candidate, needle) !== 1) violations.push(`${label} changed`);
    }
    return violations;
}

const fixture = fs.readFileSync(FIXTURE, 'utf8');
const popupCss = read(POPUP_CSS);

test('frozen fixture is the pinned master prescription label', () => {
    assert.equal(sha256(withoutOptIn(fixture)), PIN);
    assert.equal(count(fixture, OPT_IN_LINE), 1);
    assert.equal(count(fixture, ORIGINAL_BODY), 1);
    assert.equal(count(fixture, MARKER), 0);
    assert.equal(count(fixture, '<center>'), 1);
    assert.equal(count(fixture, '<table'), 1);
    assert.equal(count(fixture, ORIGINAL_BODY + LABEL_TABLE), 1, 'the paper selector targets body > center > table');
    for (const [label, needle] of PRESERVED) {
        assert.equal(count(fixture, needle), 1, label);
    }
    assert.equal(withoutPresentation(fixture), fixture);
});

test('current source normalizes back to the frozen baseline', () => {
    const current = read(LABEL);
    assert.equal(withoutPresentation(current), fixture);
    assert.equal(sha256(withoutOptIn(withoutPresentation(current))), PIN);
});

test('shared assets put the palette tokens and context class on <html>', () => {
    const popupJs = read(POPUP_JS);
    assert.ok(popupJs.includes("const CONTEXT_CLASS = 'oe-workbench-context';"));
    assert.ok(popupJs.includes('never touches body attributes'), 'a body.oe-workbench-context selector would be inert');
    assert.ok(popupCss.includes('@media screen {\n  html.oe-workbench-context,\n'));
    for (const token of ['--oe-wb-paper: #fff;', '--oe-wb-canvas: #f3f7f5;']) {
        assert.equal(count(popupCss, `    ${token}\n`), 1, token);
    }
    assert.equal(count(popupCss, MARKER), 0, 'shared CSS stays generic');
    assert.equal(count(popupJs, MARKER), 0, 'shared JS stays generic');
});

test('approved addition is screen-only, html-scoped, background-only and geometry-free', () => {
    assert.deepEqual(blockViolations(STYLE_BLOCK, popupCss), []);
    assert.equal(count(STYLE_BLOCK, '}\n\n'), 1, 'one blank line between the two rules');
});

test('synthetic approved candidate passes and normalizes back to the pin', () => {
    const candidate = withPresentation(fixture);
    assert.notEqual(candidate, fixture);
    assert.deepEqual(candidateViolations(candidate, fixture, popupCss), []);
    assert.equal(withoutPresentation(candidate), fixture);
    assert.equal(sha256(withoutOptIn(withoutPresentation(candidate))), PIN);
    assert.notEqual(sha256(withoutOptIn(candidate)), PIN, 'the raw pin still sees the addition');
});

test('untouched original is not an approved candidate', () => {
    assert.notDeepEqual(candidateViolations(fixture, fixture, popupCss), []);
});

const SEPARATOR_RULE = '}\n\n' + SCOPE + ' > center > table td[style] {\n  background-color: inherit;\n}\n</style>\n</head>\n';
const MUTATIONS = {
    'style block without body marker': [MARKED_BODY, ORIGINAL_BODY],
    'body marker without style block': [OPT_IN_LINE + STYLE_BLOCK, OPT_IN_LINE],
    'style block duplicated': [STYLE_BLOCK, STYLE_BLOCK + STYLE_BLOCK],
    'style block before the opt-in': [OPT_IN_LINE + STYLE_BLOCK, STYLE_BLOCK + OPT_IN_LINE],
    'style block moved into the body': (c) => c.replace(OPT_IN_LINE + STYLE_BLOCK, OPT_IN_LINE).replace(MARKED_BODY, MARKED_BODY + STYLE_BLOCK),
    'style block merged into the legacy style': (c) => c.replace(OPT_IN_LINE + STYLE_BLOCK, OPT_IN_LINE).replace('<style>\n', '<style>\n' + STYLE_BLOCK.split('\n').slice(1, -2).join('\n') + '\n'),
    'marker duplicated': [`class="${MARKER}"`, `class="${MARKER} ${MARKER}"`],
    'marker relocated to center': (c) => c.replace(MARKED_BODY, ORIGINAL_BODY).replace('<center>\n', `<center class="${MARKER}">\n`),
    'marker with extra class': [`class="${MARKER}"`, `class="${MARKER} oe-extra"`],
    'marker drops legacy margins': [`class="${MARKER}" leftmargin='0' `, `class="${MARKER}" `],
    'media print': ['<style media="screen">', '<style media="print">'],
    'media all': ['<style media="screen">', '<style media="all">'],
    'media dropped': ['<style media="screen">', '<style>'],
    'media screen and print': ['<style media="screen">', '<style media="screen, print">'],
    'generic body scope': [SCOPE + ' {\n', 'body {\n'],
    'inert body-only context scope': [SCOPE, 'body.oe-workbench-context.' + MARKER, true],
    'popup-class scope': [SCOPE, 'html.oe-workbench-popup body.' + MARKER, true],
    'unscoped table': [SCOPE + ' > center > table {\n', 'table {\n'],
    'ink override': ['  background-color: var(--oe-wb-canvas, #f3f7f5);\n', '  color: var(--oe-wb-ink, #17343b);\n  background-color: var(--oe-wb-canvas, #f3f7f5);\n'],
    'label ink override': ['  background-color: var(--oe-wb-paper, #fff);\n', '  color: var(--oe-wb-ink, #17343b);\n  background-color: var(--oe-wb-paper, #fff);\n'],
    'paper shadow': ['  background-color: var(--oe-wb-paper, #fff);\n', '  background-color: var(--oe-wb-paper, #fff);\n  box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);\n'],
    'paper border': ['  background-color: var(--oe-wb-paper, #fff);\n', '  background-color: var(--oe-wb-paper, #fff);\n  border: 1px solid var(--oe-wb-line, #d9e4e2);\n'],
    'paper padding': ['  background-color: var(--oe-wb-paper, #fff);\n', '  background-color: var(--oe-wb-paper, #fff);\n  padding: 4pt;\n'],
    'css width override': ['  background-color: var(--oe-wb-paper, #fff);\n', '  background-color: var(--oe-wb-paper, #fff);\n  width: 100%;\n'],
    'css font override': ['  background-color: var(--oe-wb-canvas, #f3f7f5);\n', '  background-color: var(--oe-wb-canvas, #f3f7f5);\n  font-size: 10pt;\n'],
    'extra rule reaching the separator': ['}\n</style>\n</head>\n', SEPARATOR_RULE],
    'blank line between rules dropped': ['}\n\n' + SCOPE, '}\n' + SCOPE],
    'canvas and paper swapped': ['var(--oe-wb-canvas, #f3f7f5)', 'var(--oe-wb-paper, #fff)'],
    'invented token value': ['var(--oe-wb-paper, #fff)', 'var(--oe-wb-paper, #fafafa)'],
    'important flag': ['background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'],
    'script after style': ['</style>\n</head>\n', '</style>\n<script src="label.js"></script>\n</head>\n'],
    'table width altered': ["style='width: 200pt'", "style='width: 100%'"],
    'separator altered': ["background-color: #000000; height: 5pt;", "background-color: #333333; height: 5pt;"],
    'labtop ink altered': ['.labtop {\n    color: #000000;', '.labtop {\n    color: #17343b;'],
    'labtop size altered': ['    font-size: 7pt;\n', '    font-size: 8pt;\n'],
    'nowrap dropped': ['<td class="labbot" nowrap>', '<td class="labbot">'],
    'acl altered': ["AclMain::aclCheckCore('admin', 'drugs')", "AclMain::aclCheckCore('patients', 'med')"],
    'query scope altered': ['"s.sale_id = ? AND " .', '"s.pid = ? AND " .'],
    'escaping dropped': ['nl2br(text($label_text))', 'nl2br($label_text)'],
    'title escaping dropped': ["xlt('Prescription Label')", "xl('Prescription Label')"],
    'print callback dropped': [' win.printLogPrint(window);\n', ''],
    'include_opener dropped': ['/interface/main/tabs/js/include_opener.js', '/interface/main/tabs/js/opener.js'],
    'sellDrug altered': ['sellDrug($drug_id, $quantity, $fee,', 'sellDrug($drug_id, 1, $fee,']
};

for (const [name, mutation] of Object.entries(MUTATIONS)) {
    test(`unapproved mutation is rejected: ${name}`, () => {
        const candidate = withPresentation(fixture);
        let mutated;
        if (typeof mutation === 'function') {
            mutated = mutation(candidate);
        } else {
            const [search, replace, all] = mutation;
            assert.ok(count(candidate, search) >= 1, `anchor missing: ${search}`);
            if (!all) assert.equal(count(candidate, search), 1, `anchor not unique: ${search}`);
            mutated = all ? candidate.split(search).join(replace) : candidate.replace(search, replace);
        }
        assert.notEqual(mutated, candidate, 'mutation must change the candidate');
        assert.notDeepEqual(candidateViolations(mutated, fixture, popupCss), []);
    });
}

// Intended RED until production carries the approved addition.
test('actual dispense_drug.php carries exactly the approved screen presentation', () => {
    assert.deepEqual(candidateViolations(read(LABEL), fixture, popupCss), []);
});

test(`local history mode (${HISTORY_ENV}=1) compares the fixture with ${BASE_SHA}`, () => {
    const mode = process.env[HISTORY_ENV];
    if (mode === undefined || mode === '' || mode === '0') {
        // Hosted/shallow mode: the frozen fixture and its pin are the baseline proof.
        assert.equal(sha256(withoutOptIn(fixture)), PIN);
        return;
    }
    assert.equal(mode, '1', `${HISTORY_ENV} must be unset, 0 or 1`);
    // Mandatory once requested: missing history throws here and fails the test.
    const resolved = execFileSync('git', ['rev-parse', '--verify', `${BASE_SHA}^{commit}`], { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.equal(resolved, BASE_SHA);
    const historical = execFileSync('git', ['show', `${BASE_SHA}:${LABEL}`], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(historical, fixture);
});
