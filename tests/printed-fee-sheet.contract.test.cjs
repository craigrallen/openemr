'use strict';

/**
 * OPEMR-60 contract for the printed fee sheet (Superbill) popup body.
 *
 * Portable (no Git needed):  node --test tests/printed-fee-sheet.contract.test.cjs
 * History (local, mandatory): node tests/printed-fee-sheet.contract.test.cjs --history
 *
 * Source contracts only: nothing here renders PHP, opens a browser, prints or checks
 * contrast, RTL, window sizing or security. See docs/clinical-ui/PRINTED-FEE-SHEET.md.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const HISTORY = process.argv.includes('--history');

const BASE = '18647270e0c799189d2dc10f801e8de2bff1a360';
const FIXTURE_SHA256 = 'd339d5547d8170c464500bd56241fc710ddb6290b38c8f6775e8fe2531422d9f';
const ROUTE = 'interface/patient_file/printed_fee_sheet.php';
const FIXTURE = 'tests/fixtures/printed-fee-sheet-original.php.txt';

const ORIGINAL_BODY = "<body bgcolor='#ffffff'>";
const MARKED_BODY = "<body bgcolor='#ffffff' class='oe-printed-fee-sheet'>";
const STYLE_END = 'div.pagebreak {\npage-break-after: always;\nheight: " . attr($page_height) . "pt;\n}\n</style>";\n';
const TITLE_START = '\n$html .= "<title>"';
const SEAM_OPEN = '\n$html .= "\n<style>\n';
const SEAM_CLOSE = '\n</style>";\n';
const BODY_SELECTOR = 'html.oe-workbench-context body.oe-printed-fee-sheet';
const RULES = [
    { selector: BODY_SELECTOR, color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-canvas)' },
    { selector: `${BODY_SELECTOR} form[name='theform']`, color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)' }
];
const SEAM = [
    '',
    '$html .= "',
    '<style>',
    '@media screen {',
    `  ${RULES[0].selector} {`,
    `    color: ${RULES[0].color};`,
    `    background-color: ${RULES[0].background};`,
    '  }',
    '',
    `  ${RULES[1].selector} {`,
    `    color: ${RULES[1].color};`,
    `    background-color: ${RULES[1].background};`,
    '  }',
    '}',
    '</style>";',
    ''
].join('\n');

const ALLOWED_CHANGES = [
    ROUTE,
    FIXTURE,
    'tests/printed-fee-sheet.contract.test.cjs',
    'tests/js/printed-fee-sheet.test.js',
    'docs/clinical-ui/PRINTED-FEE-SHEET.md'
];
// Launch, Header and workbench-context chain the seam depends on; history mode pins them to BASE.
const UNCHANGED_CHAIN = [
    'src/Core/Header.php',
    'config/config.yaml',
    'interface/clinical-workspace/popup.js',
    'interface/clinical-workspace/popup.css',
    'interface/main/tabs/js/tabs_view_model.js',
    'interface/main/tabs/menu/menus/standard.json',
    'interface/main/tabs/menu/menus/front_office.json',
    'interface/reports/appointments_report.php',
    'library/dialog.js'
];

const readBuffer = (rel) => fs.readFileSync(path.join(ROOT, rel));
const readText = (rel) => readBuffer(rel).toString('utf8');
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const count = (haystack, needle) => haystack.split(needle).length - 1;

function replaceOnce(source, from, to) {
    assert.equal(count(source, from), 1, `anchor must be unique: ${JSON.stringify(from)}`);
    const result = source.replace(from, () => to);
    assert.notEqual(result, source, `edit must change the source: ${JSON.stringify(from)}`);
    return result;
}

function buildCandidate(original) {
    return replaceOnce(replaceOnce(original, STYLE_END, STYLE_END + SEAM), ORIGINAL_BODY, MARKED_BODY);
}

function reject(message) {
    throw new Error(`printed fee sheet contract: ${message}`);
}

const CONTROL = /#printbutton|#hideonprint|\.btn|(^|[\s>+~])(input|button|select|textarea|a)(?=$|[\s.#[:>+~])/;
const GEOMETRY = /^(width|height|min-|max-|margin|padding|border|outline|display|position|float|clear|top|right|bottom|left|inset|overflow|visibility|zoom|transform|box-|flex|grid|column|page-break|break-|table-layout|vertical-align|white-space)/;
const TYPOGRAPHY = /^(font|line-height|letter-spacing|word-spacing|text-)/;

function inspectCss(css) {
    if (/!important/i.test(css)) reject('the seam must not use !important');
    const media = css.match(/@media[^{]*/g) || [];
    if (media.some((query) => query.trim() !== '@media screen')) reject('the seam must stay screen-only (no print or all media)');
    if (media.length !== 1 || !css.startsWith('@media screen {\n') || !css.endsWith('\n}')) {
        reject('both rules must sit inside one @media screen block');
    }
    const blocks = css.slice('@media screen {\n'.length, -'\n}'.length).split('\n\n');
    const parsed = blocks.map((block) => {
        const match = /^ {2}([^\s{}][^\n{}]*) \{\n((?: {4}[^\n]+\n)+) {2}\}$/.exec(block);
        if (!match) reject('CSS formatting must be 2-space selectors and 4-space declarations');
        return { selector: match[1], lines: match[2].trimEnd().split('\n') };
    });
    if (parsed.length !== RULES.length) reject(`exactly two rules are approved (found ${parsed.length})`);
    parsed.forEach(({ selector, lines }, index) => {
        if (CONTROL.test(selector)) reject(`controls must not be restyled: ${selector}`);
        if (!selector.startsWith(BODY_SELECTOR)) reject(`unscoped selector: ${selector}`);
        if (selector !== RULES[index].selector) reject(`unexpected selector: ${selector}`);
        const declarations = lines.map((line) => {
            const match = /^ {4}([a-z-]+): ([^;]+);$/.exec(line);
            if (!match) reject(`CSS formatting: ${line.trim()}`);
            const [, property, value] = match;
            if (GEOMETRY.test(property)) reject(`geometry is out of scope: ${property}`);
            if (TYPOGRAPHY.test(property)) reject(`font and typography are out of scope: ${property}`);
            return [property, value];
        });
        const expected = [['color', RULES[index].color], ['background-color', RULES[index].background]];
        if (declarations.map(([property]) => property).join() !== 'color,background-color') {
            reject(`each rule pairs exactly color then background-color (${selector})`);
        }
        declarations.forEach(([property, value], at) => {
            if (value !== expected[at][1]) reject(`incorrect token for ${property}: ${value}`);
        });
    });
}

/** Throws unless source is the frozen original plus exactly the approved seam and body class. */
function verifyCandidate(source, original) {
    if (typeof source !== 'string' || typeof original !== 'string') reject('sources must be strings');
    if (count(source, '<body') !== 1) reject('exactly one <body> tag is allowed');
    if (count(source, MARKED_BODY) !== 1) reject(`body marker missing: expected ${MARKED_BODY}`);
    const styles = count(source, '<style>');
    if (styles !== count(source, '</style>')) reject('unbalanced style tags');
    if (styles < 2) reject('presentation seam missing');
    if (styles > 2) reject(`expected exactly one added screen style block (found ${styles - 1}); duplicated or extra`);
    if (count(source, STYLE_END) !== 1) reject('legacy style block end changed');
    const start = source.indexOf(STYLE_END) + STYLE_END.length;
    const title = source.indexOf(TITLE_START, start);
    if (title === -1) reject('title/Header append changed');
    const region = source.slice(start, title);
    if (region === '') reject('presentation seam is not at the approved location (after the legacy style, before the title/Header append)');
    if (!region.startsWith(SEAM_OPEN) || !region.endsWith(SEAM_CLOSE)) {
        reject('the seam must be a separate $html .= "<style>...</style>" append');
    }
    inspectCss(region.slice(SEAM_OPEN.length, region.length - SEAM_CLOSE.length));
    if (region !== SEAM) reject('seam bytes differ from the approved literal');
    const restored = source.replace(SEAM, '').replace(MARKED_BODY, ORIGINAL_BODY);
    if (restored !== original) {
        let at = 0;
        while (at < restored.length && restored[at] === original[at]) at++;
        const line = original.slice(0, at).split('\n').length;
        reject(`unrelated drift from the frozen original at line ${line}`);
    }
}

const fixtureBuffer = readBuffer(FIXTURE);
const ORIGINAL = fixtureBuffer.toString('utf8');

describe('frozen original route', () => {
    test('fixture is the authenticated base route', () => {
        assert.equal(sha256(fixtureBuffer), FIXTURE_SHA256);
    });

    test('route facts the seam relies on', () => {
        for (const anchor of [STYLE_END, TITLE_START, ORIGINAL_BODY, '\n$html .= "\n$(function () {']) {
            assert.equal(count(ORIGINAL, anchor), 1, anchor);
        }
        assert.equal(count(ORIGINAL, '<style>'), 1);
        assert.equal(count(ORIGINAL, '@media'), 0);
        // The form is the body's only direct wrapper; tables inside stay 100% wide.
        assert.ok(ORIGINAL.includes("<body bgcolor='#ffffff'>\n<form name='theform' method='post'"));
        assert.ok(ORIGINAL.includes("<table class='bordertbl' cellspacing='0' cellpadding='0' width='100%'>"));
        // Original colour carriers stay untouched by the two rules.
        assert.ok(ORIGINAL.includes('background-color: #cccccc;'));
        assert.ok(ORIGINAL.includes("<font color='red'><b>Missing Name</b></font>"));
        // Header autoloads workbench-popup (no exclusion token); print wiring is deferred click setup.
        assert.ok(ORIGINAL.includes("Header::setupHeader(['opener', 'topdialog'], false)"));
        assert.ok(!ORIGINAL.includes('no_workbench-popup'));
        assert.ok(ORIGINAL.includes("$(function () {\n var win = top.printLogSetup ? top : opener.top;\n win.printLogSetup(document.getElementById('printbutton'));\n});"));
        assert.ok(ORIGINAL.includes("onsubmit='return opener.top.restoreSession()'"));
        assert.ok(!ORIGINAL.includes('window.print('));
    });
});

describe('seam verifier', () => {
    const candidate = buildCandidate(ORIGINAL);

    test('accepts the synthetic candidate built from the frozen original', () => {
        assert.doesNotThrow(() => verifyCandidate(candidate, ORIGINAL));
        assert.equal(candidate.length, ORIGINAL.length + SEAM.length + MARKED_BODY.length - ORIGINAL_BODY.length);
    });

    test('rejects the untouched original', () => {
        assert.throws(() => verifyCandidate(ORIGINAL, ORIGINAL), /body marker missing/);
    });

    const seamRule = `  ${RULES[0].selector} {\n`;
    const formRule = `  ${RULES[1].selector} {\n`;
    const paperLine = `    background-color: ${RULES[1].background};\n`;
    const relocateAnchor = '\n$html .= "\n$(function () {';
    const mutations = [
        ['missing seam', (s) => replaceOnce(s, SEAM, ''), /presentation seam missing/],
        ['duplicated seam', (s) => replaceOnce(s, SEAM, SEAM + SEAM), /duplicated or extra/],
        ['relocated after the Header script', (s) => replaceOnce(replaceOnce(s, SEAM, ''), relocateAnchor, SEAM + relocateAnchor), /not at the approved location/],
        ['missing body class', (s) => replaceOnce(s, MARKED_BODY, ORIGINAL_BODY), /body marker missing/],
        ['changed body class', (s) => replaceOnce(s, "class='oe-printed-fee-sheet'", "class='oe-printed-fee-sheet oe-extra'"), /body marker missing/],
        ['duplicated body tag', (s) => replaceOnce(s, MARKED_BODY, MARKED_BODY + MARKED_BODY), /one <body> tag/],
        ['outside screen (all media)', (s) => replaceOnce(s, '@media screen {', '@media all {'), /screen-only/],
        ['print media added', (s) => replaceOnce(s, '@media screen {', '@media screen, print {'), /screen-only/],
        ['no media wrapper', (s) => replaceOnce(replaceOnce(s, '@media screen {\n', ''), '  }\n}\n</style>";\n\n$html .= "<title>"', '  }\n</style>";\n\n$html .= "<title>"'), /@media screen block/],
        ['unscoped body rule', (s) => replaceOnce(s, seamRule, '  body.oe-printed-fee-sheet {\n'), /unscoped selector/],
        ['unscoped form rule', (s) => replaceOnce(s, formRule, "  form[name='theform'] {\n"), /unscoped selector/],
        ['double-quoted attribute selector', (s) => replaceOnce(s, "form[name='theform'] {", 'form[name="theform"] {'), /unexpected selector/],
        ['wrong canvas token', (s) => replaceOnce(s, 'var(--oe-wb-canvas)', 'var(--oe-wb-paper)'), /incorrect token/],
        ['literal colour instead of token', (s) => replaceOnce(s, paperLine, '    background-color: #fff;\n'), /incorrect token/],
        ['extra rule', (s) => replaceOnce(s, formRule, `  ${BODY_SELECTOR} table {\n    color: var(--oe-wb-ink);\n    background-color: var(--oe-wb-paper);\n  }\n\n${formRule}`), /exactly two rules/],
        ['!important', (s) => replaceOnce(s, 'var(--oe-wb-canvas);', 'var(--oe-wb-canvas) !important;'), /!important/],
        ['geometry', (s) => replaceOnce(s, paperLine, `${paperLine}    padding: 1rem;\n`), /geometry/],
        ['hidden content', (s) => replaceOnce(s, paperLine, `${paperLine}    display: none;\n`), /geometry/],
        ['font', (s) => replaceOnce(s, paperLine, `${paperLine}    font-size: 12pt;\n`), /typography/],
        ['control restyle', (s) => replaceOnce(s, formRule, `  ${BODY_SELECTOR} #printbutton {\n`), /controls must not be restyled/],
        ['indentation', (s) => replaceOnce(s, seamRule, `    ${RULES[0].selector} {\n`), /CSS formatting/],
        ['declaration order', (s) => replaceOnce(s, `    color: ${RULES[0].color};\n    background-color: ${RULES[0].background};\n`, `    background-color: ${RULES[0].background};\n    color: ${RULES[0].color};\n`), /color then background-color/],
        ['seam whitespace', (s) => replaceOnce(s, '  }\n\n  html', '  }\n  \n  html'), /CSS formatting|approved literal/],
        ['legacy style block end', (s) => replaceOnce(s, 'page-break-after: always;', 'page-break-after: auto;'), /legacy style block end changed/],
        ['legacy fsgroup colour', (s) => replaceOnce(s, 'background-color: #cccccc;', 'background-color: #e0e0e0;'), /unrelated drift/],
        ['legacy warning font', (s) => replaceOnce(s, "<font color='red'>", "<font color='#a00'>"), /unrelated drift/],
        ['Header asset import', (s) => replaceOnce(s, "['opener', 'topdialog']", "['opener', 'topdialog', 'workbench-reminder-popup']"), /unrelated drift/],
        ['opener restoreSession', (s) => replaceOnce(s, "onsubmit='return opener.top.restoreSession()'", "onsubmit='return top.restoreSession()'"), /unrelated drift/],
        ['opener printLogSetup', (s) => replaceOnce(s, ' var win = top.printLogSetup ? top : opener.top;', ' var win = top;'), /unrelated drift/],
        ['issued print', (s) => replaceOnce(s, "win.printLogSetup(document.getElementById('printbutton'));", "win.printLogSetup(document.getElementById('printbutton'));\n window.print();"), /unrelated drift/],
        ['hideonprint callback', (s) => replaceOnce(s, "divstyle.display = 'none';", "divstyle.visibility = 'hidden';"), /unrelated drift/],
        ['print control markup', (s) => replaceOnce(s, "class='btn btn-secondary btn-print mt-3'", "class='btn btn-primary btn-print mt-3'"), /unrelated drift/],
        ['session fill parsing', (s) => replaceOnce(s, "$form_fill = empty($_GET['fill']) ? 0 : $_GET['fill'];", "$form_fill = (int) ($_GET['fill'] ?? 0);"), /unrelated drift/],
        ['custom include', (s) => replaceOnce(s, '    include_once($customFeeSheetCodes);\n', ''), /unrelated drift/],
        ['pagination', (s) => replaceOnce(s, '$lines_per_page = 55;', '$lines_per_page = 60;'), /unrelated drift/],
        ['escaping', (s) => replaceOnce(s, "text($appointment['pc_hometext'] ?? '')", "($appointment['pc_hometext'] ?? '')"), /unrelated drift/],
        ['translation', (s) => replaceOnce(s, "genFacilityTitle(xl('Superbill/Fee Sheet')", "genFacilityTitle('Superbill/Fee Sheet'"), /unrelated drift/],
        ['trailing whitespace', (s) => replaceOnce(s, 'echo $html;\n', 'echo $html; \n'), /unrelated drift/]
    ];

    for (const [name, apply, expected] of mutations) {
        test(`rejects ${name}`, () => {
            // The mutation is applied, and proven to change the candidate, outside assert.throws.
            const mutated = apply(candidate);
            assert.notEqual(mutated, candidate);
            assert.throws(() => verifyCandidate(mutated, ORIGINAL), expected);
        });
    }
});

describe('live route', () => {
    test('carries exactly the approved seam and body class over the frozen original', () => {
        verifyCandidate(readText(ROUTE), ORIGINAL);
    });
});

describe('launch and workbench context', () => {
    function classList(...names) {
        const set = new Set(names);
        return { contains: (n) => set.has(n), add: (n) => set.add(n), remove: (n) => set.delete(n) };
    }

    function fakeWindow({ parent = null, opener = null, frameElement = null, bodyClasses = [] } = {}) {
        const win = {
            parent, opener, frameElement, closed: false,
            location: { origin: 'https://emr.test' },
            addEventListener() {},
            document: {
                readyState: 'complete',
                documentElement: { classList: classList() },
                body: { classList: classList(...bodyClasses) },
                querySelector: () => null,
                addEventListener() {},
                removeEventListener() {}
            }
        };
        win.document.body.ownerDocument = win.document;
        return win;
    }

    const popup = require(path.join(ROOT, 'interface/clinical-workspace/popup.js'));
    const observe = () => ({ disconnect() {} });

    test('Superbill menu popups open through popMenuDialog in a modal-mlg dlgopen frame', () => {
        for (const menu of ['standard.json', 'front_office.json']) {
            const found = [];
            const walk = (items) => items.forEach((item) => {
                if (item.url === '/interface/patient_file/printed_fee_sheet.php?fill=1') found.push(item);
                walk(item.children || []);
            });
            walk(JSON.parse(readText(`interface/main/tabs/menu/menus/${menu}`)));
            assert.deepEqual(found.map(({ menu_id: id, label, target }) => [id, label, target]), [['Popup:Superbill', 'Superbill', 'pop']], menu);
        }
        const calls = [];
        const context = vm.createContext({ dlgopen: (...args) => calls.push(args) });
        vm.runInContext(readText('interface/main/tabs/js/tabs_view_model.js'), context, { filename: 'tabs_view_model.js' });
        context.popMenuDialog('/emr/interface/patient_file/printed_fee_sheet.php?fill=1', 'Superbill');
        assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
            ['/emr/interface/patient_file/printed_fee_sheet.php?fill=1', 'menupopup', 'modal-mlg', 500, '', 'Superbill', { sizeHeight: 'auto' }]
        ]);
    });

    test('a dlgopen frame on an active shell gets the workbench context classes', () => {
        const shell = fakeWindow({ bodyClasses: ['workbench-active'] });
        shell.parent = shell;
        const frame = fakeWindow({ parent: shell, frameElement: { closest: (s) => (s === '.dialogModal' ? {} : null) } });
        const controller = popup.createPopupController({ win: frame, observe });
        const html = frame.document.documentElement.classList;
        assert.equal(controller.active, true);
        assert.ok(html.contains(popup.CONTEXT_CLASS) && popup.CONTEXT_CLASS === 'oe-workbench-context');
        assert.ok(html.contains(popup.POPUP_CLASS));
    });

    test('the appointments report fill=2 launch nulls opener, so the seam stays inactive', () => {
        assert.ok(readText('interface/reports/appointments_report.php').includes(
            `onclick='window.open("../patient_file/printed_fee_sheet.php?fill=2", "_blank").opener = null'`
        ));
        const blank = fakeWindow();
        const controller = popup.createPopupController({ win: blank, observe });
        assert.equal(controller.active, false);
        assert.equal(blank.document.documentElement.classList.contains(popup.CONTEXT_CLASS), false);
    });

    test('Header autoloads the context assets that define the paired tokens on screen', () => {
        assert.ok(readText('config/config.yaml').includes(
            "  workbench-popup:\n    basePath: '%webroot%/interface/clinical-workspace/'\n    script: popup.js\n    link: popup.css\n    autoload: true\n"
        ));
        const css = readText('interface/clinical-workspace/popup.css');
        // The first block in the file is the screen-only token block.
        const tokens = css.slice(0, css.indexOf('}'));
        assert.ok(tokens.includes('@media screen {\n  html.oe-workbench-context,\n  body.workbench-active > .dialogModal {'));
        for (const token of ['--oe-wb-ink: #17343b;', '--oe-wb-paper: #fff;', '--oe-wb-canvas: #f3f7f5;']) {
            assert.ok(tokens.includes(token), token);
        }
    });
});

if (HISTORY) {
    const git = (args) => execFileSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
    const lines = (buffer) => buffer.toString('utf8').split('\n').filter(Boolean);

    describe('history (local Git)', () => {
        test('base commit exists and is an ancestor of HEAD', () => {
            git(['cat-file', '-e', `${BASE}^{commit}`]);
            git(['merge-base', '--is-ancestor', BASE, 'HEAD']);
        });

        test('fixture equals the base route blob byte for byte', () => {
            const blob = git(['show', `${BASE}:${ROUTE}`]);
            assert.equal(sha256(blob), FIXTURE_SHA256);
            assert.ok(blob.equals(fixtureBuffer));
        });

        test('launch, Header, config, popup and menu chain is unchanged from base', () => {
            for (const rel of UNCHANGED_CHAIN) {
                assert.ok(readBuffer(rel).equals(git(['show', `${BASE}:${rel}`])), rel);
            }
        });

        test('changed paths are limited to the five intended files', () => {
            const changed = new Set([
                ...lines(git(['diff', '--name-only', '--no-renames', BASE])),
                ...lines(git(['ls-files', '--others', '--exclude-standard']))
            ]);
            assert.deepEqual([...changed].filter((rel) => !ALLOWED_CHANGES.includes(rel)), []);
            for (const rel of ALLOWED_CHANGES.slice(1)) assert.ok(changed.has(rel), rel);
        });
    });
}

module.exports = { verifyCandidate, buildCandidate, SEAM, MARKED_BODY };
