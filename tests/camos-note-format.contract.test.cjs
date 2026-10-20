'use strict';

/**
 * OPEMR-67 CAMOS note-format chooser source contract.
 * Portable: node --test tests/camos-note-format.contract.test.cjs
 * Local provenance: node tests/camos-note-format.contract.test.cjs --history
 * (run directly; `node --test ... --history` does not forward the flag and
 * silently runs only the portable tests)
 *
 * Text only. notegen.php bootstraps globals, includes content_parser.php (which
 * imports C_FormVitals and whose parser functions can write appointments, vitals
 * and billing), queries clinical data and audits through printLogPrint, so nothing
 * here executes, bootstraps or requests PHP. The popup.js checks run the real
 * controller in a vm sandbox against small window doubles: they model same-origin
 * parent/opener discovery and class toggling, not browser opener retention,
 * named-window reuse, COOP or native load timing. No rendering, contrast,
 * keyboard, RTL, print/PDF, browser, permission or clinical acceptance is asserted.
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
const ROUTE = 'interface/forms/CAMOS/notegen.php';
const CALLER = 'interface/forms/CAMOS/report.php';
const PARSER = 'interface/forms/CAMOS/content_parser.php';
const POPUP_JS = 'interface/clinical-workspace/popup.js';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const FIXTURE = 'tests/fixtures/camos-note-format-original.php.txt';
const HASH = 'daecd758053f8657088fc4f6b7a3bec4b3214d9ddaf4278bfc6ea42e8503e43b';
const BYTES = 24575;
const HISTORY = process.argv.includes('--history');

// notegen.php has three request branches. Only the first (GET pid+encounter, no
// submit_pdf/submit_html: the format chooser) gains presentation; the second
// (date/name chooser) and third (HTML/PDF output) stay byte-identical.
const FIRST_START = "if (!(filter_input(INPUT_POST, 'submit_pdf') || filter_input(INPUT_POST, 'submit_html')) && (filter_input(INPUT_GET, 'pid') && filter_input(INPUT_GET, 'encounter'))) {\n";
const SECOND_START = "if (!filter_input(INPUT_POST, 'submit_pdf') && !filter_input(INPUT_POST, 'submit_html') && !(filter_input(INPUT_GET, 'pid') && filter_input(INPUT_GET, 'encounter'))) {\n";
const THIRD_START = "if (filter_input(INPUT_POST, 'submit_pdf') || filter_input(INPUT_POST, 'submit_html') || (filter_input(INPUT_GET, 'pid') && filter_input(INPUT_GET, 'encounter'))) {\n";
const HTML_OPEN = "    ?>\n<html>\n<head>\n<title>\n";
const MARKER_TAG = "<html class='oe-camos-note-format'>";
const MARKED_OPEN = `    ?>\n${MARKER_TAG}\n<head>\n<title>\n`;
const TITLE = "<title>\n    <?php echo xlt('Print Notes'); ?>\n</title>\n";
const HEAD_END = '</head>\n<body>\n';
const PROMPT = "    <?php echo xlt('Choose print format for this encounter report.'); ?><br /><br />\n";
const CSRF_INPUT = '<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />';
const FIRST_FORM = `<form method=post name=choose_patients>\n${CSRF_INPUT}\n<input type='submit' name='submit_pdf'`;
const BUTTONS = "<input type='submit' name='submit_pdf' value='<?php echo xla('Print (PDF)'); ?>'>\n<input type='submit' name='submit_html' value='<?php echo xla('Print (HTML)'); ?>'>\n</form>\n";
const FIRST_EXIT = '    <?php\n    exit;\n}\n\n';
// Typed OEGlobalsBag getters; the whole URL is attribute-escaped and the cache token is
// URL-encoded. attr_url() over the full URL would percent-encode its slashes.
const POPUP_PATH = '/interface/clinical-workspace/popup.js';
const SCRIPT = `<script src="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot() . '${POPUP_PATH}?v=' . urlencode(OEGlobalsBag::getInstance()->getString('v_js_includes'))); ?>"></script>\n`;

const CONTEXT = 'oe-workbench-context';
const ROUTE_CLASS = 'oe-camos-note-format';
const PREFIX = `html.${CONTEXT}.${ROUTE_CLASS}`;
// popup.css is intentionally not loaded on this route, so every token carries its popup.css value.
const PALETTE = { '--oe-wb-canvas': '#f3f7f5', '--oe-wb-ink': '#17343b', '--oe-wb-paper': '#fff', '--oe-wb-line': '#d9e4e2' };
const RULES = [
    [`${PREFIX} body`, [
        ['background-color', 'var(--oe-wb-canvas, #f3f7f5)'],
        ['color', 'var(--oe-wb-ink, #17343b)']
    ]],
    [`${PREFIX} form`, [
        ['background-color', 'var(--oe-wb-paper, #fff)'],
        ['color', 'var(--oe-wb-ink, #17343b)'],
        ['box-shadow', 'inset 0 0 0 1px var(--oe-wb-line, #d9e4e2)']
    ]]
];
// Stylelint-compatible: 2-space selectors and 4-space declarations inside @media, a
// blank line between rules, and the style tag at column 0 like the chooser head.
const ruleText = ([selector, declarations]) => [
    `  ${selector} {`,
    ...declarations.map(([property, value]) => `    ${property}: ${value};`),
    '  }'
].join('\n');
const CSS = ['@media screen {', RULES.map(ruleText).join('\n\n'), '}'].join('\n');
const STYLE_OPEN = '<style>\n';
const STYLE_CLOSE = '\n</style>\n';
const STYLE = `${STYLE_OPEN}${CSS}${STYLE_CLOSE}`;
const ADDITION = SCRIPT + STYLE;
const BODY_RULE = ruleText(RULES[0]);
const FORM_RULE = ruleText(RULES[1]);

const UNCHANGED = [CALLER, PARSER, POPUP_JS, POPUP_CSS];
const ALLOWED = [ROUTE, FIXTURE, 'tests/camos-note-format.contract.test.cjs', 'tests/js/camos-note-format.test.js', 'docs/clinical-ui/CAMOS-NOTE-FORMAT-SCREEN.md'];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel));
const text = (rel) => read(rel).toString('utf8');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const count = (source, needle) => source.split(needle).length - 1;
const originalBytes = read(FIXTURE);
const ORIGINAL = originalBytes.toString('utf8');

function replaceOnce(source, from, to) {
    assert.equal(count(source, from), 1, `anchor must be unique: ${from}`);
    const changed = source.replace(from, () => to);
    assert.notEqual(changed, source, 'mutation must change the source');
    return changed;
}

// pre: header, ACL, session. first: format chooser. rest: date/name chooser, output, helpers.
function split(source) {
    assert.equal(count(source, FIRST_START), 1, 'one format-chooser branch');
    assert.equal(count(source, SECOND_START), 1, 'one date/name chooser branch');
    const a = source.indexOf(FIRST_START);
    const b = source.indexOf(SECOND_START);
    assert.ok(a < b, 'branch order preserved');
    return { pre: source.slice(0, a), first: source.slice(a, b), rest: source.slice(b) };
}

function buildCandidate(original) {
    const { pre, first, rest } = split(original);
    const marked = replaceOnce(first, FIRST_START + HTML_OPEN, FIRST_START + MARKED_OPEN);
    return pre + replaceOnce(marked, TITLE + HEAD_END, TITLE + ADDITION + HEAD_END) + rest;
}

// Removes exactly the html marker and the script+style addition at their pinned positions.
function inverse(source) {
    const { pre, first, rest } = split(source);
    const unmarked = replaceOnce(first, FIRST_START + MARKED_OPEN, FIRST_START + HTML_OPEN);
    return pre + replaceOnce(unmarked, TITLE + ADDITION + HEAD_END, TITLE + HEAD_END) + rest;
}

function inspectCss(css) {
    assert.ok(!css.includes('\t'), 'no tab indentation');
    assert.ok(!css.includes('!important'), 'no important overrides');
    assert.ok(!/\bprint\b|@import|font|url\(/.test(css), 'no print, import, font or url rules');
    assert.equal(count(css, '@media'), 1, 'one media wrapper');
    assert.ok(css.startsWith('@media screen {\n') && css.endsWith('\n}'), 'screen-only CSS');
    const blocks = css.slice('@media screen {\n'.length, -'\n}'.length).split('\n\n');
    assert.equal(blocks.length, RULES.length, 'exact rule allowlist');
    blocks.forEach((block, index) => {
        const match = /^ {2}([^\n{}]+) \{\n((?: {4}[^\n]+\n)+) {2}\}$/.exec(block);
        assert.ok(match, 'two-space selector, four-space declaration format');
        assert.equal(match[1], RULES[index][0], 'exact html-marker context selector');
        const lines = match[2].trimEnd().split('\n');
        assert.equal(lines.length, RULES[index][1].length, 'exact declaration allowlist');
        lines.forEach((line, at) => {
            const declaration = /^ {4}([a-z-]+): ([^;]+);$/.exec(line);
            assert.ok(declaration, 'declaration format');
            assert.deepEqual(declaration.slice(1), RULES[index][1][at], 'approved property and paired value');
        });
    });
    const uses = [...css.matchAll(/var\(([^)]*)\)/g)].map((m) => m[1]);
    assert.equal(uses.length, 5, 'five token uses');
    for (const use of uses) {
        const token = /^(--oe-wb-[a-z]+), (#[0-9a-f]{3,6})$/.exec(use);
        assert.ok(token, `token carries a literal fallback: ${use}`);
        assert.equal(PALETTE[token[1]], token[2], `fallback equals the popup.css value: ${use}`);
    }
    assert.equal(css, CSS, 'no geometry, typography, wrapper or extra CSS');
}

function verifyCandidate(source, original) {
    const s = split(source);
    const o = split(original);
    assert.ok(s.pre === o.pre, 'header, includes, ACL and session bytes preserved');
    assert.ok(s.rest === o.rest, 'date/name chooser, HTML/PDF output, printLogPrint, signature and getFormData bytes preserved');
    assert.equal(count(s.first, FIRST_START + MARKED_OPEN), 1, 'html note-format marker on the format-chooser root');
    assert.equal(count(source, '<html class='), 1, 'only the format-chooser html is marked');
    assert.equal(count(source, ROUTE_CLASS), 3, 'html marker plus two scoped selectors only');
    assert.equal(count(source, '<script src='), 1, 'one external script');
    assert.equal(count(source, POPUP_PATH), 1, 'popup.js referenced once');
    assert.equal(count(source, '<style>'), 2, 'one added style block beside the output style');
    assert.equal(count(s.first, '<script'), 1, 'no inline script in the chooser');
    assert.equal(count(s.first, '<body>\n'), 1, 'chooser body opening keeps no attributes');
    assert.equal(count(s.first, '<body'), 1);
    for (const banned of ['<link', 'popup.css', 'workspace.css', 'Header::', 'setupHeader', '$GLOBALS', '@import', 'fonts.', 'attr_url', 'oe-workbench-popup']) {
        assert.equal(count(s.first, banned), 0, `no shared asset loader, stylesheet, font, raw global or popup typography: ${banned}`);
    }
    assert.equal(count(s.first, '<head>\n'), 1, 'one chooser head');
    assert.equal(count(s.first, '</head>\n'), 1);
    const headStart = s.first.indexOf('<head>\n');
    const headEnd = s.first.indexOf('</head>\n');
    assert.ok(headStart > 0 && headEnd > headStart, 'chooser head present');
    const head = s.first.slice(headStart + '<head>\n'.length, headEnd);
    assert.ok(head.startsWith(TITLE), 'title stays first in the head');
    const after = head.slice(TITLE.length);
    assert.ok(after.startsWith(SCRIPT), 'unchanged popup.js controller directly after the title with the pinned src expression');
    const style = after.slice(SCRIPT.length);
    assert.ok(style.startsWith(STYLE_OPEN) && style.endsWith(STYLE_CLOSE), 'inline style directly after the script, last in the head');
    inspectCss(style.slice(STYLE_OPEN.length, -STYLE_CLOSE.length));
    assert.equal(after, ADDITION, 'exact head addition');
    assert.ok(s.first.slice(headEnd).startsWith(HEAD_END + PROMPT), 'head closes straight into the unchanged body and prompt');
    assert.equal(inverse(source), original, 'full inverse reproduces every original ACL, session, CSRF, branch, input, output, audit, signature and query byte');
}

describe('frozen original route', () => {
    test('fixture has the base digest and size', () => {
        assert.equal(originalBytes.length, BYTES);
        assert.equal(sha(originalBytes), HASH);
    });

    test('anchors are present once and the original has no seam', () => {
        const { pre, first, rest } = split(ORIGINAL);
        assert.equal(count(ORIGINAL, THIRD_START), 1);
        assert.ok(rest.indexOf(THIRD_START) > 0, 'output branch follows the date/name chooser');
        assert.equal(count(first, FIRST_START + HTML_OPEN), 1);
        assert.equal(count(first, TITLE + HEAD_END + PROMPT), 1);
        assert.ok(first.endsWith(`</body>\n</html>\n${FIRST_EXIT}`), 'chooser exits before the other branches');
        assert.equal(count(first, FIRST_FORM), 1);
        assert.equal(count(first, BUTTONS), 1);
        assert.equal(count(first, '<input'), 3, 'CSRF token plus PDF and HTML submit buttons');
        assert.equal(count(first, '<form'), 1);
        assert.equal(count(first, 'action='), 0, 'chooser posts back to its own pid+encounter URL');
        assert.equal(count(first, '<style'), 0);
        assert.equal(count(first, '<script'), 0);
        assert.ok(pre.includes("if (!AclMain::aclCheckCore('patients', 'med')) {"), 'ACL gate precedes every branch');
        assert.ok(pre.includes('require_once("content_parser.php");'));
        assert.equal(count(ORIGINAL, '<html'), 3);
        assert.equal(count(ORIGINAL, '<head>'), 3);
        assert.equal(count(ORIGINAL, '<style'), 1, 'only the HTML output has a style block');
        assert.equal(count(ORIGINAL, '<script src='), 0);
        assert.equal(count(ORIGINAL, '<link'), 0);
        assert.equal(count(ORIGINAL, 'target='), 0);
        assert.equal(count(ORIGINAL, "Header::setupHeader('datetime-picker')"), 1, 'only the date/name chooser loads Header assets');
        assert.equal(count(ORIGINAL, CSRF_INPUT), 2, 'both choosers carry the CSRF token');
        assert.equal(count(ORIGINAL, 'printLogPrint'), 2, 'HTML output audits through the opener print log');
        assert.equal(count(ORIGINAL, '$pdf->ezStream();'), 1);
        assert.equal(count(ORIGINAL, 'function getFormData('), 1);
        for (const absent of [ROUTE_CLASS, 'oe-workbench', 'popup.js', 'popup.css', 'workspace.css', '$GLOBALS']) {
            assert.equal(count(ORIGINAL, absent), 0, absent);
        }
    });
});

describe('planned presentation seam (synthetic)', () => {
    const candidate = buildCandidate(ORIGINAL);

    test('synthetic candidate passes and its inverse is the original byte for byte', () => {
        assert.notEqual(candidate, ORIGINAL);
        assert.doesNotThrow(() => verifyCandidate(candidate, ORIGINAL));
        assert.ok(Buffer.from(inverse(candidate), 'utf8').equals(originalBytes));
        assert.equal(candidate.length - ORIGINAL.length, ADDITION.length + MARKED_OPEN.length - HTML_OPEN.length, 'only the two additions');
    });

    test('untouched baseline is rejected for the missing presentation only', () => {
        const s = split(ORIGINAL);
        assert.ok(s.pre === split(candidate).pre && s.rest === split(candidate).rest, 'baseline shares every byte outside the chooser');
        assert.throws(() => verifyCandidate(ORIGINAL, ORIGINAL), /html note-format marker/);
    });

    test('marker is on html, the CSS is screen-only and context-scoped, typography untouched', () => {
        inspectCss(CSS);
        assert.ok(RULES.every(([selector]) => selector.startsWith(`${PREFIX} `)));
        assert.ok(!CSS.includes(`body.${ROUTE_CLASS}`) && !CSS.includes('oe-workbench-popup'));
        assert.ok(!/font|line-height|letter-spacing|padding|margin|width|height|border-radius/.test(CSS));
    });

    const sub = (from, to) => (s) => replaceOnce(s, from, to);
    const swap = (block, from, to) => {
        assert.ok(block.includes(from), `fixture mutation anchor: ${from}`);
        return block.replace(from, () => to);
    };
    const within = (block) => (from, to) => (s) => replaceOnce(s, block, swap(block, from, to));
    const inScript = within(SCRIPT);
    const bodyRule = within(BODY_RULE);
    const formRule = within(FORM_RULE);
    const inForm = within(FIRST_FORM);
    const inButtons = within(BUTTONS);
    const scriptAs = (other) => sub(SCRIPT, other);
    const styleAs = (css) => sub(STYLE, `${STYLE_OPEN}${css}${STYLE_CLOSE}`);
    const extraRule = (selector, declaration) => sub(`${FORM_RULE}\n}`, `${FORM_RULE}\n\n  ${selector} {\n    ${declaration}\n  }\n}`);
    const then = (...steps) => (s) => steps.reduce((acc, step) => step(acc), s);
    const TOKEN = "OEGlobalsBag::getInstance()->getString('v_js_includes')";
    const WEBROOT = 'OEGlobalsBag::getInstance()->getWebRoot()';
    const SECOND_HEAD_END = '</head>\n\n<body>\n';
    const OUTPUT_TITLE = "    <title><?php echo xl('Patient Notes'); ?></title>\n    </head>";
    const unmark = sub(FIRST_START + MARKED_OPEN, FIRST_START + HTML_OPEN);
    const mutations = [
        // Marker: html, format chooser only, exact class.
        ['missing html marker', unmark],
        ['double-quoted marker', sub(MARKER_TAG, `<html class="${ROUTE_CLASS}">`)],
        ['extra html class', sub(MARKER_TAG, `<html class='${ROUTE_CLASS} body_top'>`)],
        ['html inline style', sub(MARKER_TAG, `<html class='${ROUTE_CLASS}' style='background:#fff'>`)],
        ['malformed marker tag', sub(`${MARKER_TAG}\n<head>`, `<html class='${ROUTE_CLASS}'\n<head>`)],
        ['marker moved to body', then(unmark, sub(ADDITION + HEAD_END, `${ADDITION}</head>\n<body class='${ROUTE_CLASS}'>\n`))],
        ['body class added', sub(ADDITION + HEAD_END, `${ADDITION}</head>\n<body class='body_top'>\n`)],
        ['date/name chooser marker', sub('<html>\n<head>\n\n<title>', `${MARKER_TAG}\n<head>\n\n<title>`)],
        ['HTML output marker', sub('        <html>\n        <head>\n        <style>', `        ${MARKER_TAG}\n        <head>\n        <style>`)],
        // Controller script: one, unchanged asset, pinned location and expression.
        ['missing script', sub(SCRIPT, '')],
        ['duplicate script', sub(SCRIPT, SCRIPT + SCRIPT)],
        ['script before title', sub(TITLE + SCRIPT, SCRIPT + TITLE)],
        ['script after head', then(sub(SCRIPT, ''), sub(STYLE + HEAD_END, `${STYLE}</head>\n${SCRIPT}<body>\n`))],
        ['script in chooser body', then(sub(SCRIPT, ''), sub(HEAD_END + PROMPT, HEAD_END + SCRIPT + PROMPT))],
        ['script relocated to date/name chooser', then(sub(SCRIPT, ''), sub(SECOND_HEAD_END, SCRIPT + SECOND_HEAD_END))],
        ['script added to date/name chooser', sub(SECOND_HEAD_END, SCRIPT + SECOND_HEAD_END)],
        ['script added to HTML output', sub(OUTPUT_TITLE, OUTPUT_TITLE.replace('    </head>', `${SCRIPT}    </head>`))],
        ['unclosed script', inScript('></script>\n', '>\n')],
        ['deferred script', inScript('<script src', '<script defer src')],
        ['async script', inScript('<script src', '<script async src')],
        ['module script', inScript('<script src', '<script type="module" src')],
        ['attr_url over full URL', scriptAs(`<script src="<?php echo attr_url(${WEBROOT} . '${POPUP_PATH}?v=' . ${TOKEN}); ?>"></script>\n`)],
        ['unpinned split expression', scriptAs(`<script src="<?php echo attr(${WEBROOT}); ?>${POPUP_PATH}?v=<?php echo attr_url(${TOKEN}); ?>"></script>\n`)],
        ['unescaped URL', scriptAs(`<script src="<?php echo ${WEBROOT} . '${POPUP_PATH}?v=' . urlencode(${TOKEN}); ?>"></script>\n`)],
        ['raw cache token', inScript(`urlencode(${TOKEN})`, TOKEN)],
        ['raw global webroot', inScript(WEBROOT, "$GLOBALS['webroot']")],
        ['hard-coded webroot', inScript(WEBROOT, "'/openemr'")],
        ['untyped global read', inScript("->getString('v_js_includes')", "->get('v_js_includes')")],
        ['different token', inScript("'v_js_includes'", "'v_css_includes'")],
        ['missing version token', inScript(`?v=' . urlencode(${TOKEN})`, "'")],
        ['different asset', inScript('popup.js', 'popup.min.js')],
        ['different directory', inScript('/interface/clinical-workspace/', '/public/assets/')],
        ['inline controller', scriptAs('<script>document.documentElement.classList.add("oe-workbench-context");</script>\n')],
        // Shared and generic popup assets that are intentionally not loaded.
        ['popup.css link', sub(SCRIPT, `${SCRIPT}<link rel="stylesheet" href="<?php echo attr(${WEBROOT} . '/interface/clinical-workspace/popup.css'); ?>" />\n`)],
        ['workspace.css link', sub(SCRIPT, `${SCRIPT}<link rel="stylesheet" href="<?php echo attr(${WEBROOT} . '/interface/clinical-workspace/workspace.css'); ?>" />\n`)],
        ['Header asset loader', sub(TITLE + SCRIPT, `${TITLE}<?php Header::setupHeader(['opener']); ?>\n${SCRIPT}`)],
        ['font link', sub(SCRIPT, `${SCRIPT}<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />\n`)],
        ['font import', sub(`${STYLE_OPEN}@media`, `${STYLE_OPEN}@import url("fonts.css");\n@media`)],
        // Style placement, form and media.
        ['missing style', sub(STYLE, '')],
        ['duplicate style', sub(STYLE, STYLE + STYLE)],
        ['style before script', sub(SCRIPT + STYLE, STYLE + SCRIPT)],
        ['style after head', then(sub(STYLE, ''), sub(SCRIPT + HEAD_END, `${SCRIPT}</head>\n${STYLE}<body>\n`))],
        ['style relocated to date/name chooser', then(sub(STYLE, ''), sub(SECOND_HEAD_END, STYLE + SECOND_HEAD_END))],
        ['unclosed style', sub(`}${STYLE_CLOSE}</head>`, '}\n</head>')],
        ['print media', sub('@media screen {', '@media screen, print {')],
        ['all media', sub('@media screen {', '@media all {')],
        ['narrowed media', sub('@media screen {', '@media screen and (min-width: 40rem) {')],
        ['no media wrapper', styleAs(`${BODY_RULE}\n\n${FORM_RULE}`)],
        ['extra print block', sub(`\n}${STYLE_CLOSE}`, `\n}\n@media print {\n  html.${ROUTE_CLASS} body {\n    color: #000;\n  }\n}${STYLE_CLOSE}`)],
        ['indented CSS', styleAs(CSS.split('\n').map((line) => (line ? `    ${line}` : line)).join('\n'))],
        ['tab indentation', styleAs(CSS.replace(/^ {4}/gm, '\t'))],
        ['minified CSS', styleAs(CSS.replace(/\n\s*/g, ''))],
        ['no blank line between rules', styleAs(CSS.replace('  }\n\n  html', '  }\n  html'))],
        // Selector scope.
        ['global body rule', bodyRule(`${PREFIX} body`, 'body')],
        ['global form rule', formRule(`${PREFIX} form`, 'form')],
        ['html-wide rule', bodyRule(`${PREFIX} body`, PREFIX)],
        ['no context class', bodyRule(PREFIX, `html.${ROUTE_CLASS}`)],
        ['no route class', formRule(PREFIX, `html.${CONTEXT}`)],
        ['popup-only context', bodyRule(CONTEXT, 'oe-workbench-popup')],
        ['body marker selector', bodyRule(`${PREFIX} body`, `body.${ROUTE_CLASS}`)],
        ['descendant overreach', formRule(`${PREFIX} form {`, `${PREFIX} form * {`)],
        ['selector list widening', formRule(`${PREFIX} form {`, `${PREFIX} form,\n  form {`)],
        ['extra input rule', extraRule(`${PREFIX} input`, 'background-color: var(--oe-wb-paper, #fff);')],
        ['extra submit rule', extraRule(`${PREFIX} input[type='submit']`, 'color: var(--oe-wb-ink, #17343b);')],
        // Palette and fallbacks.
        ['bare token', bodyRule('var(--oe-wb-canvas, #f3f7f5)', 'var(--oe-wb-canvas)')],
        ['wrong fallback', formRule('var(--oe-wb-paper, #fff)', 'var(--oe-wb-paper, #fafafa)')],
        ['hard-coded colour', bodyRule('var(--oe-wb-ink, #17343b)', '#17343b')],
        ['unknown token', formRule('var(--oe-wb-line, #d9e4e2)', 'var(--oe-wb-border, #d9e4e2)')],
        ['semantic status colour', bodyRule('var(--oe-wb-ink, #17343b)', 'var(--oe-wb-warning-ink, #5c4300)')],
        ['swapped surfaces', bodyRule('var(--oe-wb-canvas, #f3f7f5)', 'var(--oe-wb-paper, #fff)')],
        // Altered declarations, geometry and typography.
        ['padding', formRule('    color: var(--oe-wb-ink, #17343b);', '    color: var(--oe-wb-ink, #17343b);\n    padding: 1rem;')],
        ['margin', bodyRule('    color: var(--oe-wb-ink, #17343b);', '    color: var(--oe-wb-ink, #17343b);\n    margin: 0;')],
        ['font family', bodyRule('    color: var(--oe-wb-ink, #17343b);', '    color: var(--oe-wb-ink, #17343b);\n    font-family: sans-serif;')],
        ['font size', formRule('    color: var(--oe-wb-ink, #17343b);', '    color: var(--oe-wb-ink, #17343b);\n    font-size: 14px;')],
        ['width', formRule('    color: var(--oe-wb-ink, #17343b);', '    color: var(--oe-wb-ink, #17343b);\n    max-width: 60rem;')],
        ['border radius', formRule('    color: var(--oe-wb-ink, #17343b);', '    color: var(--oe-wb-ink, #17343b);\n    border-radius: 8px;')],
        ['reordered declarations', bodyRule('    background-color: var(--oe-wb-canvas, #f3f7f5);\n    color: var(--oe-wb-ink, #17343b);', '    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-canvas, #f3f7f5);')],
        ['background shorthand', bodyRule('background-color:', 'background:')],
        ['missing outline', formRule(';\n    box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);', ';')],
        ['heavier outline', formRule('inset 0 0 0 1px', 'inset 0 0 0 2px')],
        ['outset outline', formRule('inset 0 0 0 1px', '0 0 0 1px')],
        ['missing semicolon', formRule('#d9e4e2);', '#d9e4e2)')],
        ['important', bodyRule('#f3f7f5);', '#f3f7f5) !important;')],
        // Wrappers.
        ['new wrapper', sub(HEAD_END + PROMPT, `${HEAD_END}<div class='container'>\n${PROMPT}`)],
        // Format chooser: request branch, form, CSRF, inputs, escaping and exit.
        ['first branch condition', sub(FIRST_START, FIRST_START.replace("&& (filter_input(INPUT_GET, 'pid')", "|| (filter_input(INPUT_GET, 'pid')"))],
        ['first branch exit', sub(`</html>\n${FIRST_EXIT}`, '</html>\n    <?php\n}\n\n')],
        ['form method', inForm('method=post', 'method=get')],
        ['form target blank', inForm('name=choose_patients>', 'name=choose_patients target=_blank>')],
        ['form action', inForm('<form method=post', "<form action='notegen.php' method=post")],
        ['chooser CSRF', inForm(`${CSRF_INPUT}\n`, '')],
        ['PDF submit name', inButtons("name='submit_pdf'", "name='print_pdf'")],
        ['HTML submit name', inButtons("name='submit_html'", "name='print_html'")],
        ['submit type', inButtons("<input type='submit' name='submit_pdf'", "<input type='button' name='submit_pdf'")],
        ['button label escaping', inButtons("xla('Print (PDF)')", "xl('Print (PDF)')")],
        ['button order', sub(BUTTONS, "<input type='submit' name='submit_html' value='<?php echo xla('Print (HTML)'); ?>'>\n<input type='submit' name='submit_pdf' value='<?php echo xla('Print (PDF)'); ?>'>\n</form>\n")],
        ['prompt escaping', sub(PROMPT, PROMPT.replace('xlt(', 'xl('))],
        ['title escaping', sub(TITLE + SCRIPT, TITLE.replace('xlt(', 'xl(') + SCRIPT)],
        ['body close', sub(`</form>\n</body>\n</html>\n${FIRST_EXIT}`, `</form>\n</html>\n${FIRST_EXIT}`)],
        // Header, includes, ACL and session.
        ['ACL section', sub("aclCheckCore('patients', 'med')", "aclCheckCore('patients', 'demo')")],
        ['ACL denial', sub('AccessDeniedHelper::denyWithTemplate(', '(')],
        ['parser include', sub('require_once("content_parser.php");\n', '')],
        ['session source', sub('SessionWrapperFactory::getInstance()->getActiveSession()', 'null')],
        ['prepended bytes', (s) => `\n${s}`],
        // Date/name chooser stays byte-identical.
        ['date picker assets', sub("Header::setupHeader('datetime-picker')", "Header::setupHeader()")],
        ['date/name CSRF', sub(`<form method=post name=choose_patients>\n${CSRF_INPUT}\n\n<table>`, '<form method=post name=choose_patients>\n\n<table>')],
        ['start input', sub("name='start' id='start'", "name='from' id='start'")],
        ['last name input', sub("<input type='text' name='lname'/>", "<input type='search' name='lname'/>")],
        ['date/name buttons', sub("'>\n</td><td>\n</td></tr>\n</table>", "'>\n</td></tr>\n</table>")],
        // HTML/PDF output, signature, audit and query paths.
        ['output CSRF', sub("    if (!CsrfUtils::verifyCsrfToken(filter_input(INPUT_POST, 'csrf_token_form') ?: '', session: $session)) {", "    if (false && !CsrfUtils::verifyCsrfToken(filter_input(INPUT_POST, 'csrf_token_form') ?: '', session: $session)) {")],
        ['output ordering', sub('    ksort($output);\n', '')],
        ['HTML print typography', sub('     font-size: 8pt;', '     font-size: 10pt;')],
        ['HTML print navigation', sub('    @media print {\n     .navigate {', '    @media screen {\n     .navigate {')],
        ['HTML signature label', sub('xlt("Digitally Signed")', 'xlt("Signed")')],
        ['HTML signer escaping', sub(`print "<span class='heading'>" . text($name) . "</span><br/>";`, `print "<span class='heading'>" . $name . "</span><br/>";`)],
        ['opener print log', sub('var win = top.printLogPrint ? top : opener.top;', 'var win = top;')],
        ['print log audit', sub('win.printLogPrint(window);', 'window.print();')],
        ['PDF font', sub("$pdf->selectFont('Helvetica');", "$pdf->selectFont('Courier');")],
        ['PDF signature label', sub('$pdf->ezText(xl("Digitally Signed"), 12);', '$pdf->ezText(xl("Digitally Signed"), 14);')],
        ['PDF signature image', sub("0.0, 72.0, '', 'left', '');", "0.0, 96.0, '', 'left', '');")],
        ['PDF stream', sub('$pdf->ezStream();', '$pdf->ezOutput();')],
        ['encounter pid validation', sub("$getPid = filter_input(INPUT_GET, 'pid', FILTER_VALIDATE_INT);", "$getPid = filter_input(INPUT_GET, 'pid');")],
        ['billing activity', sub('AND activity = 1",', 'AND activity = 0",')],
        ['billing code type', sub("AND code_type LIKE 'ICD10'", "AND code_type LIKE 'ICD9'")],
        ['vitals label', sub('xl("O2 Sat")', 'xl("SpO2")')],
        ['appended bytes', (s) => `${s}<!-- -->\n`]
    ];
    for (const [name, mutate] of mutations) {
        test(`rejects ${name}`, () => {
            const changed = mutate(candidate);
            assert.notEqual(changed, candidate, 'mutant differs from the approved candidate');
            assert.throws(() => verifyCandidate(changed, ORIGINAL));
        });
    }

    test('rejects arbitrary single-byte edits across every region', () => {
        const step = Math.floor(candidate.length / 60);
        let tried = 0;
        for (let at = 11; at < candidate.length; at += step) {
            const changed = candidate.slice(0, at) + (candidate[at] === 'x' ? 'y' : 'x') + candidate.slice(at + 1);
            assert.notEqual(changed, candidate);
            assert.throws(() => verifyCandidate(changed, ORIGINAL), undefined, `edit at offset ${at} accepted`);
            tried++;
        }
        assert.ok(tried >= 60, 'at least sixty sampled offsets');
    });
});

describe('unchanged caller and assets (text only)', () => {
    test('report.php opens the chooser through a named target=_new link with pid and encounter', () => {
        const caller = text(CALLER);
        assert.ok(caller.includes('$webroot = OEGlobalsBag::getInstance()->getWebRoot();'));
        assert.equal(count(caller, 'notegen.php'), 2, 'Print This Encounter and Print Any Encounter');
        assert.equal(count(caller, `<a href='{$webroot}/interface/forms/CAMOS/notegen.php?pid=" . attr_url("$pid") . "&encounter=" . attr_url("$encounter") . "' target=_new>" . xlt('Print This Encounter') . "</a>`), 1, 'pid+encounter reaches the format chooser');
        assert.equal(count(caller, `<a href='{$webroot}/interface/forms/CAMOS/notegen.php' target=_new>" . xlt('Print Any Encounter') . "</a>`), 1, 'no-parameter link reaches the unchanged date/name chooser');
        // _new is a named browsing context, not the implicit-noopener _blank keyword, so the
        // source supports an opener path back to the workbench shell. It does not prove runtime
        // opener retention: COOP, user, browser and reused-window policies remain gates.
        for (const absent of ['_blank', 'noopener', 'noreferrer', 'rel=', 'window.open', 'dlgopen']) {
            assert.equal(count(caller, absent), 0, absent);
        }
    });

    test('popup.css defines every fallback value the seam uses, screen only', () => {
        const popupCss = text(POPUP_CSS);
        assert.ok(popupCss.includes(`@media screen {\n  html.${CONTEXT},\n  body.workbench-active > .dialogModal {`));
        for (const [token, value] of Object.entries(PALETTE)) assert.equal(count(popupCss, `    ${token}: ${value};\n`), 1, token);
    });

    test('content_parser.php is present and not referenced by the seam', () => {
        assert.ok(fs.existsSync(path.join(ROOT, PARSER)));
        assert.ok(!ADDITION.includes('content_parser'));
    });
});

// Synthetic only: the real popup.js runs in a vm sandbox against window doubles. A
// target=_new window is top-level (parent === self) with an opener; that opener is the
// encounter frame report.php renders in, whose parent is the shell. This models the
// controller's discovery walk and mode return, not browser opener retention, named
// window reuse, COOP or native timing.
describe('unchanged popup.js controller on the format chooser (synthetic)', () => {
    const ORIGIN = 'https://emr.test';
    const api = (() => {
        const ctx = vm.createContext({ module: { exports: {} } });
        vm.runInContext(text(POPUP_JS), ctx, { filename: POPUP_JS });
        return ctx.module.exports;
    })();
    const classes = (...initial) => {
        const values = new Set(initial);
        return { contains: (n) => values.has(n), add: (n) => values.add(n), remove: (n) => values.delete(n), list: () => [...values].sort() };
    };
    const docFor = (body, root) => {
        const doc = { body, querySelector: (sel) => (root && sel === '#mainBox [data-workbench-mode]' ? {} : null) };
        if (body) body.ownerDocument = doc;
        return doc;
    };
    function world({ active = true, shellRoot = true, opener = 'frame', frameClosed = false, crossOrigin = false, html = [ROUTE_CLASS] } = {}) {
        const shellBody = { classList: classes(...(active ? ['workbench-active'] : [])) };
        const shell = { closed: false, location: { origin: ORIGIN }, opener: null, document: docFor(shellBody, shellRoot) };
        shell.parent = shell;
        const frameBody = { classList: classes('body_top') };
        const frame = { closed: frameClosed, parent: shell, opener: null, frameElement: { closest: () => null }, document: docFor(frameBody, false) };
        Object.defineProperty(frame, 'location', {
            get() {
                if (crossOrigin) throw new Error('SecurityError: cross-origin frame');
                return { origin: ORIGIN };
            }
        });
        const listeners = new Map();
        const docListeners = new Map();
        const root = { classList: classes(...html) };
        const doc = docFor(null, false);
        Object.assign(doc, {
            documentElement: root,
            readyState: 'loading',
            addEventListener: (name, cb) => docListeners.set(name, cb),
            removeEventListener: (name) => docListeners.delete(name)
        });
        const popup = { closed: false, location: { origin: ORIGIN }, opener: opener === 'frame' ? frame : null, document: doc, addEventListener: (name, cb) => listeners.set(name, cb) };
        popup.parent = popup;
        const seen = { observed: null, disconnected: false };
        const observe = (body, cb) => {
            seen.observed = { body, cb };
            return { disconnect() { seen.disconnected = true; } };
        };
        // Runs from <head>: the chooser body is not parsed yet.
        const controller = api.createPopupController({ win: popup, observe });
        return { controller, root, shellBody, frameBody, listeners, docListeners, popup, seen };
    }

    test('exports the context class the route CSS is keyed on', () => {
        assert.equal(api.CONTEXT_CLASS, CONTEXT);
        assert.equal(api.POPUP_CLASS, 'oe-workbench-popup');
        assert.equal(typeof api.createPopupController, 'function');
    });

    test('active same-origin named opener marks html context and popup', () => {
        const w = world();
        assert.equal(w.controller.active, true);
        assert.deepEqual(w.root.classList.list(), [CONTEXT, ROUTE_CLASS, 'oe-workbench-popup'].sort());
        assert.equal(w.seen.observed.body, w.shellBody, 'observes the shell body, not the opener frame');
        assert.ok(w.listeners.has('pagehide'));
        assert.ok(!w.docListeners.has('DOMContentLoaded'), 'an opened window does not wait for its own body');
        assert.deepEqual(w.shellBody.classList.list(), ['workbench-active'], 'shell untouched');
        assert.deepEqual(w.frameBody.classList.list(), ['body_top'], 'opener frame untouched');
    });

    test('workbench mode flips toggle only the owned classes and return to legacy', () => {
        const w = world({ active: false });
        assert.equal(w.controller.active, false);
        assert.deepEqual(w.root.classList.list(), [ROUTE_CLASS]);
        assert.equal(w.seen.observed.body, w.shellBody, 'legacy-mode shell root is still observed');
        w.shellBody.classList.add('workbench-active');
        w.seen.observed.cb();
        assert.equal(w.controller.active, true);
        assert.deepEqual(w.root.classList.list(), [CONTEXT, ROUTE_CLASS, 'oe-workbench-popup'].sort());
        w.shellBody.classList.remove('workbench-active');
        w.seen.observed.cb();
        assert.equal(w.controller.active, false);
        assert.deepEqual(w.root.classList.list(), [ROUTE_CLASS], 'server-set route marker survives; scoped CSS no longer matches');
    });

    test('disposal restores owned classes and ignores later mode changes', () => {
        const w = world();
        w.listeners.get('pagehide')();
        assert.equal(w.controller.active, false);
        assert.ok(w.seen.disconnected);
        assert.deepEqual(w.root.classList.list(), [ROUTE_CLASS]);
        w.shellBody.classList.remove('workbench-active');
        w.shellBody.classList.add('workbench-active');
        w.seen.observed.cb();
        assert.deepEqual(w.root.classList.list(), [ROUTE_CLASS]);
    });

    test('classes the page already had are not owned and are not removed', () => {
        const w = world({ html: [ROUTE_CLASS, CONTEXT] });
        w.listeners.get('pagehide')();
        assert.deepEqual(w.root.classList.list(), [CONTEXT, ROUTE_CLASS].sort());
    });

    for (const [name, options] of [
        ['inactive legacy shell without the mode control', { active: false, shellRoot: false }],
        ['closed opener', { frameClosed: true }],
        ['cross-origin opener', { crossOrigin: true }]
    ]) {
        test(`${name} leaves the route inactive and unmarked`, () => {
            const w = world(options);
            assert.equal(w.controller.active, false);
            assert.deepEqual(w.root.classList.list(), [ROUTE_CLASS]);
            assert.equal(w.seen.observed, null, 'nothing observed');
            assert.ok(!w.listeners.has('pagehide'));
        });
    }

    test('absent opener leaves the route inactive, also after DOMContentLoaded', () => {
        const w = world({ opener: null });
        assert.equal(w.controller.active, false);
        assert.ok(w.docListeners.has('DOMContentLoaded'), 'top-level page retries once its body exists');
        const body = { classList: classes() };
        w.popup.document.body = body;
        body.ownerDocument = w.popup.document;
        w.popup.document.readyState = 'interactive';
        w.docListeners.get('DOMContentLoaded')();
        assert.equal(w.controller.active, false);
        assert.deepEqual(w.root.classList.list(), [ROUTE_CLASS]);
        assert.equal(w.seen.observed, null);
    });
});

describe('live route candidate acceptance', () => {
    test('live notegen.php contains exactly the approved presentation delta', () => {
        verifyCandidate(text(ROUTE), ORIGINAL);
    });
});

if (HISTORY) {
    const git = (args) => execFileSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    const lines = (bytes) => bytes.toString('utf8').split('\n').filter(Boolean);
    describe('local Git provenance (--history)', () => {
        test('base commit exists and is a HEAD ancestor', () => {
            assert.doesNotThrow(() => git(['cat-file', '-e', `${BASE}^{commit}`]), 'base commit missing: --history requires full Git history');
            assert.doesNotThrow(() => git(['merge-base', '--is-ancestor', BASE, 'HEAD']), 'base is not an ancestor of HEAD');
        });
        test('fixture and restored live route equal the base blob', () => {
            const blob = git(['show', `${BASE}:${ROUTE}`]);
            assert.equal(blob.length, BYTES);
            assert.equal(sha(blob), HASH);
            assert.ok(blob.equals(originalBytes), 'fixture');
            assert.ok(Buffer.from(inverse(text(ROUTE)), 'utf8').equals(blob), 'restored route');
        });
        test('report.php caller, content_parser.php, popup.js and popup.css equal base', () => {
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

module.exports = { buildCandidate, verifyCandidate, inverse, SCRIPT, STYLE, CSS };
