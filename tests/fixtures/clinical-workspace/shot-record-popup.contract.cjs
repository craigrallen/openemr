/*
 * OPEMR-47 source contract: the HTML shot record gains exactly one screen-only
 * presentation addition (an inline <style media="screen"> block right after its
 * workbench-popup opt-in, and a body marker class) and nothing else changes.
 *
 * Dependency-free: run with `node --test tests/fixtures/clinical-workspace/shot-record-popup.contract.cjs`.
 * The frozen master source sits next to this file, so fresh clones need no Git history.
 * Set OPENEMR_SHOT_RECORD_GIT_HISTORY=1 to also compare that fixture with Git commit 18647270.
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
const FIXTURE = path.join(__dirname, 'shot_record.master-18647270.txt');
const MASTER_COMMIT = '18647270';
const SHOT = 'interface/patient_file/summary/shot_record.php';
const CALLER = 'interface/patient_file/summary/immunizations.php';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const POPUP_JS = 'interface/clinical-workspace/popup.js';

// Same digest WorkbenchPopupHeaderfreeTest pins for the shot record (opt-in lines removed).
const PIN = '5843a40221f20779a1abd9cbce5c015a32e7e412de6cfd36b1669455677294b3';
const OPT_IN = "<?php echo Header::setupAssets(['workbench-popup']); ?>";
const USE_HEADER = 'use OpenEMR\\Core\\Header;';
const OPT_IN_LINE = '    ' + OPT_IN + '\n';

const SCOPE = 'html.oe-workbench-context body.oe-shot-record-popup';
const STYLE_BLOCK = [
    '  <style media="screen">',
    '    ' + SCOPE + ' {',
    '      color: var(--oe-wb-ink, #17343b);',
    '      background-color: var(--oe-wb-canvas, #f3f7f5);',
    '    }',
    '    ' + SCOPE + ' div.paddingdiv {',
    '      color: var(--oe-wb-ink, #17343b);',
    '      background-color: var(--oe-wb-paper, #fff);',
    '      box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);',
    '    }',
    '  </style>',
    ''
].join('\n');
const ORIGINAL_BODY = '  </head>\n  <body>\n';
const MARKED_BODY = '  </head>\n  <body class="oe-shot-record-popup">\n';

const EXPECTED_RULES = [
    {
        selector: SCOPE,
        declarations: [
            ['color', 'var(--oe-wb-ink, #17343b)'],
            ['background-color', 'var(--oe-wb-canvas, #f3f7f5)']
        ]
    },
    {
        selector: SCOPE + ' div.paddingdiv',
        declarations: [
            ['color', 'var(--oe-wb-ink, #17343b)'],
            ['background-color', 'var(--oe-wb-paper, #fff)'],
            ['box-shadow', 'inset 0 0 0 1px var(--oe-wb-line, #d9e4e2)']
        ]
    }
];
const FORBIDDEN_PROPERTIES = /^(width|height|min-|max-|margin|padding|border|outline|font|line-height|letter-spacing|text-|display|position|float|page-break|break-|zoom|transform|overflow|direction)/;

const CALLER_PRINT_FORM = [
    'var PrintForm = function(typ) {',
    '    top.restoreSession();',
    "    newURL='shot_record.php?output=' + encodeURIComponent(typ) + '&sortby=' + <?php echo js_url($sortby); ?>;",
    '    window.open(newURL, \'_blank\', "menubar=1,toolbar=1,scrollbars=1,resizable=1,width=600,height=450");',
    '}',
    ''
].join('\n');

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

// Exact inverse of the approved addition; anything else is left in place so it shows up as drift.
function withoutPresentation(source) {
    const styled = OPT_IN_LINE + STYLE_BLOCK;
    if (
        count(source, styled) !== 1
        || count(source, STYLE_BLOCK) !== 1
        || count(source, MARKED_BODY) !== 1
        || count(source, 'oe-shot-record-popup') !== 3
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
    const match = /^ {2}<style media="screen">\n([\s\S]*) {2}<\/style>\n$/.exec(block);
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
    const full = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, (c) => c + c).slice(1) : hex.slice(1);
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
    if (/!important|@media|@import|url\(|<script|expression\(/i.test(block)) violations.push('block carries forbidden CSS');
    if (JSON.stringify(rules) !== JSON.stringify(EXPECTED_RULES)) violations.push('rules differ from the approved two rules');
    for (const rule of rules) {
        if (!rule.selector.startsWith(SCOPE)) violations.push(`unscoped selector: ${rule.selector}`);
        const props = rule.declarations.map(([p]) => p);
        if (!props.includes('color') || !props.includes('background-color')) violations.push(`unpaired colours: ${rule.selector}`);
        for (const prop of props) {
            if (FORBIDDEN_PROPERTIES.test(prop)) violations.push(`geometry/typography property: ${prop}`);
        }
        for (const [, value] of rule.declarations) {
            for (const token of value.matchAll(/var\((--oe-wb-[a-z-]+), (#[0-9a-f]{3,6})\)/g)) {
                if (!popupCss.includes(`    ${token[1]}: ${token[2]};`)) violations.push(`fallback ${token[2]} is not the ${token[1]} token`);
            }
        }
        const colour = (prop) => /#[0-9a-f]{3,6}/.exec(rule.declarations.find(([p]) => p === prop)?.[1] ?? '')?.[0];
        const fg = colour('color');
        const bg = colour('background-color');
        if (fg && bg && contrast(fg, bg) < 4.5) violations.push(`contrast below 4.5:1 in ${rule.selector}`);
    }
    return violations;
}

// Everything a candidate shot_record.php must satisfy; [] means approved.
function candidateViolations(candidate, fixture, popupCss) {
    const violations = [];
    if (count(candidate, STYLE_BLOCK) !== 1) violations.push('approved screen style block missing or repeated');
    if (count(candidate, OPT_IN_LINE + STYLE_BLOCK + '  </head>\n') !== 1) violations.push('style block not directly after the opt-in, closing the head');
    if (count(candidate, MARKED_BODY) !== 1) violations.push('body marker class missing or altered');
    if (count(candidate, '<style') !== 2) violations.push('unexpected number of <style> elements');
    if (count(candidate, 'media=') !== 1 || count(candidate, '<style media="screen">') !== 1) violations.push('presentation is not screen-only');
    if (withoutPresentation(candidate) !== fixture) violations.push('original source, legacy CSS, PDF branch or caller-facing output drifted');
    if (sha256(withoutOptIn(withoutPresentation(candidate))) !== PIN) violations.push('PHP whole-file pin would fail');
    const start = candidate.indexOf(OPT_IN_LINE);
    const end = candidate.indexOf('  </head>\n', start);
    if (start >= 0 && end > start) violations.push(...blockViolations(candidate.slice(start + OPT_IN_LINE.length, end), popupCss));
    for (const [label, needle] of [
        ['print/audit callback', '    opener.top.printLogPrint(window);\n'],
        ['patient filter', ' from patient_data p where p.pid = ?", [$pid]);'],
        ['pagination', '    $linesPerPage = 15;\n'],
        ['PDF stream', '    $pdf->ezStream();\n'],
        ['paddingdiv geometry', '      width: 524pt;\n      height: 668pt;\n      page-break-after: always;\n'],
        ['row stripes', "echo \"<td class ='odd'>\";"],
        ['patient name escaping', 'text($res2[\'patient_name\'])']
    ]) {
        if (count(candidate, needle) !== 1) violations.push(`${label} changed`);
    }
    return violations;
}

const fixture = fs.readFileSync(FIXTURE, 'utf8');
const popupCss = read(POPUP_CSS);

test('frozen fixture is the pinned master shot record', () => {
    assert.equal(sha256(withoutOptIn(fixture)), PIN);
    assert.equal(count(fixture, OPT_IN_LINE), 1);
    assert.equal(count(fixture, ORIGINAL_BODY), 1);
    assert.equal(count(fixture, 'oe-shot-record-popup'), 0);
    assert.equal(withoutPresentation(fixture), fixture);
});

test('shared assets put the palette tokens and context class on <html>', () => {
    const popupJs = read(POPUP_JS);
    assert.ok(popupJs.includes("const CONTEXT_CLASS = 'oe-workbench-context';"));
    assert.ok(popupJs.includes('const html = doc.documentElement;'));
    assert.ok(popupJs.includes('never touches body attributes'), 'a body.oe-workbench-context selector would be inert');
    assert.ok(popupCss.includes('@media screen {\n  html.oe-workbench-context,\n'));
    for (const token of ['--oe-wb-ink: #17343b;', '--oe-wb-paper: #fff;', '--oe-wb-canvas: #f3f7f5;', '--oe-wb-line: #d9e4e2;']) {
        assert.equal(count(popupCss, `    ${token}\n`), 1, token);
    }
    assert.equal(count(popupCss, 'oe-shot-record-popup'), 0, 'shared CSS stays generic');
    assert.equal(count(popupJs, 'oe-shot-record-popup'), 0, 'shared JS stays generic');
});

test('caller still opens the original resizable 600x450 HTML/PDF popup', () => {
    const caller = read(CALLER);
    assert.equal(count(caller, CALLER_PRINT_FORM), 1);
    assert.equal(count(caller, '$("#printHtml").on("click", function() { PrintForm("html"); });'), 1);
    assert.equal(count(caller, '$("#print").on("click", function() { PrintForm("pdf"); });'), 1);
    assert.equal(count(caller, 'oe-shot-record-popup'), 0);
});

test('approved addition is screen-only, html-scoped, paired and geometry-free', () => {
    assert.deepEqual(blockViolations(STYLE_BLOCK, popupCss), []);
});

test('synthetic approved candidate passes and normalizes back to the pin', () => {
    const candidate = withPresentation(fixture);
    assert.notEqual(candidate, fixture);
    assert.deepEqual(candidateViolations(candidate, fixture, popupCss), []);
    assert.equal(withoutPresentation(candidate), fixture);
    assert.notEqual(sha256(withoutOptIn(candidate)), PIN, 'the raw pin still sees the addition');
});

const insertAfterBlock = (extra) => (c) => c.replace(STYLE_BLOCK, STYLE_BLOCK + extra);
const MUTATIONS = {
    'style block without body marker': [MARKED_BODY, ORIGINAL_BODY],
    'body marker without style block': [OPT_IN_LINE + STYLE_BLOCK, OPT_IN_LINE],
    'style block duplicated': [STYLE_BLOCK, STYLE_BLOCK + STYLE_BLOCK],
    'style block before the opt-in': [OPT_IN_LINE + STYLE_BLOCK, STYLE_BLOCK + OPT_IN_LINE],
    'media all': ['<style media="screen">', '<style media="all">'],
    'media print': ['<style media="screen">', '<style media="print">'],
    'media dropped': ['<style media="screen">', '<style>'],
    'media screen and print': ['<style media="screen">', '<style media="screen, print">'],
    'generic body scope': [`    ${SCOPE} {\n`, '    body {\n'],
    'inert body-only context scope': [SCOPE, 'body.oe-workbench-context.oe-shot-record-popup', true],
    'popup-class scope': [SCOPE, 'html.oe-workbench-popup body.oe-shot-record-popup', true],
    'unscoped paddingdiv': [`    ${SCOPE} div.paddingdiv {\n`, '    div.paddingdiv {\n'],
    'extra declaration': ['      box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);\n', '      box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);\n      padding: 12pt;\n'],
    'geometry override': ['      background-color: var(--oe-wb-paper, #fff);\n', '      background-color: var(--oe-wb-paper, #fff);\n      width: 100%;\n'],
    'extra rule overriding stripes': ['    }\n  </style>\n  </head>\n', '    }\n    ' + SCOPE + ' td.odd {\n      color: inherit;\n      background-color: inherit;\n    }\n  </style>\n  </head>\n'],
    'canvas and paper swapped': ['var(--oe-wb-canvas, #f3f7f5)', 'var(--oe-wb-paper, #fff)'],
    'unpaired paper': ['      color: var(--oe-wb-ink, #17343b);\n      background-color: var(--oe-wb-paper, #fff);\n', '      background-color: var(--oe-wb-paper, #fff);\n'],
    'invented token value': ['var(--oe-wb-line, #d9e4e2)', 'var(--oe-wb-line, #cccccc)'],
    'border instead of inset shadow': ['box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);', 'border: 1px solid var(--oe-wb-line, #d9e4e2);'],
    'important flag': ['background-color: var(--oe-wb-canvas, #f3f7f5);', 'background-color: var(--oe-wb-canvas, #f3f7f5) !important;'],
    'extra body class': ['<body class="oe-shot-record-popup">', '<body class="oe-shot-record-popup oe-extra">'],
    'script after style': insertAfterBlock('  <script src="shot.js"></script>\n'),
    'wrapper element': ["        echo \"<div class='paddingdiv'>\\n\";", "        echo \"<main><div class='paddingdiv'>\\n\";"],
    'legacy inline background altered': ['      background: white;\n', '      background: #f3f7f5;\n'],
    'legacy stripe colour altered': ['      background-color: #D8D8D8;\n', '      background-color: #eef2f1;\n'],
    'print callback dropped': ['    opener.top.printLogPrint(window);\n', ''],
    'patient filter dropped': [' where p.pid = ?", [$pid]);', ' where 1 = 1", []);'],
    'pagination changed': ['$linesPerPage = 15;', '$linesPerPage = 20;'],
    'pdf margins altered': ['$pdf->ezSetMargins(72, 30, 50, 30);', '$pdf->ezSetMargins(36, 30, 50, 30);'],
    'escaping dropped': ['text($res2[\'patient_name\'])', '$res2[\'patient_name\']']
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

test('actual shot_record.php carries exactly the approved screen presentation', () => {
    assert.deepEqual(candidateViolations(read(SHOT), fixture, popupCss), []);
});

test(
    'frozen fixture matches Git master (opt-in: OPENEMR_SHOT_RECORD_GIT_HISTORY=1)',
    { skip: process.env.OPENEMR_SHOT_RECORD_GIT_HISTORY === '1' ? false : 'historical proof is opt-in' },
    () => {
        const historical = execFileSync('git', ['show', `${MASTER_COMMIT}:${SHOT}`], { cwd: ROOT, encoding: 'utf8' });
        assert.equal(historical, fixture);
    }
);
