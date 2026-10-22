'use strict';

/**
 * OPEMR-66 CAMOS entry-selection screen source contract.
 * Portable: node --test tests/camos-selection.contract.test.cjs
 * Local provenance: node tests/camos-selection.contract.test.cjs --history
 * (run directly; `node --test ... --history` does not forward the flag and
 * silently runs only the portable tests)
 *
 * Text only. rx_print.php reads patient data, can UPDATE users and prints
 * prescriptions, so nothing here executes, bootstraps or requests PHP. The
 * popup.js checks run the real controller in a vm sandbox against small window
 * doubles: they model same-origin parent/opener discovery and class toggling,
 * not browser opener retention, named-window reuse or native load timing. No
 * rendering, contrast, browser or clinical acceptance is asserted.
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
const ROUTE = 'interface/forms/CAMOS/rx_print.php';
const CALLER = 'interface/forms/CAMOS/report.php';
const RX_CSS = 'interface/forms/CAMOS/rx.css';
const POPUP_JS = 'interface/clinical-workspace/popup.js';
const POPUP_CSS = 'interface/clinical-workspace/popup.css';
const FIXTURE = 'tests/fixtures/camos-selection-original.php.txt';
const HASH = 'aabf10c036b6f39feed1854c5dfd90ba0063cc41e9234071a53609878cfe8133';
const BYTES = 23468;
const HISTORY = process.argv.includes('--history');

// Everything up to and including this line is the print/letterhead/PDF path and stays byte-identical.
const SELECT_MARKER = '} else { // end of if print. OPTION selection of what to print';
const HTML_OPEN = "\n    ?>\n<html>\n<head>\n<title>\n";
const MARKED_OPEN = "\n    ?>\n<html class='oe-camos-selection'>\n<head>\n<title>\n";
// Present twice in the original: once in the print branch head, once in the selection head.
const LINK = `<link rel="stylesheet" href="./rx.css?v=<?php echo attr_url(OEGlobalsBag::getInstance()->getString('v_js_includes')); ?>" />\n`;
const HEAD_END = '</head>\n<h1>';
// Typed OEGlobalsBag getters; the whole URL is attribute-escaped and the cache token is
// URL-encoded. attr_url() over the full URL would percent-encode its slashes.
const POPUP_PATH = '/interface/clinical-workspace/popup.js';
const SCRIPT = `<script src="<?php echo attr(OEGlobalsBag::getInstance()->getWebRoot() . '${POPUP_PATH}?v=' . urlencode(OEGlobalsBag::getInstance()->getString('v_js_includes'))); ?>"></script>\n`;

const CONTEXT = 'oe-workbench-context';
const PREFIX = `html.${CONTEXT}.oe-camos-selection`;
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
// Standalone CSS: 2-space selectors and 4-space declarations inside @media. The selection
// head is written at column 0, so the style block embeds the CSS unindented.
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

const LAUNCHERS = [
    'rx_print.php?sigline=embossed',
    'rx_print.php?sigline=signed',
    'rx_print.php?letterhead=true&signer=patient',
    'rx_print.php?letterhead=true&signer=doctor'
];
const UNCHANGED = [CALLER, RX_CSS, POPUP_JS, POPUP_CSS];
const ALLOWED = [ROUTE, FIXTURE, 'tests/camos-selection.contract.test.cjs', 'tests/js/camos-selection.test.js', 'docs/clinical-ui/CAMOS-SELECTION-SCREEN.md'];

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

function split(source) {
    assert.equal(count(source, SELECT_MARKER), 1, 'one selection-branch marker');
    const at = source.indexOf(SELECT_MARKER);
    return [source.slice(0, at), source.slice(at)];
}

function buildCandidate(original) {
    const [before, tail] = split(original);
    const marked = replaceOnce(tail, SELECT_MARKER + HTML_OPEN, SELECT_MARKER + MARKED_OPEN);
    return before + replaceOnce(marked, LINK + HEAD_END, LINK + ADDITION + HEAD_END);
}

// Removes exactly the html marker and the script+style addition at their pinned positions.
function inverse(source) {
    const [before, tail] = split(source);
    const unmarked = replaceOnce(tail, SELECT_MARKER + MARKED_OPEN, SELECT_MARKER + HTML_OPEN);
    return before + replaceOnce(unmarked, LINK + ADDITION + HEAD_END, LINK + HEAD_END);
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
    const [before, tail] = split(source);
    const [originalBefore] = split(original);
    assert.ok(before + SELECT_MARKER === originalBefore + SELECT_MARKER, 'every byte through the selection marker (print, letterhead, PDF, update, CSRF) preserved');
    assert.equal(count(tail, SELECT_MARKER + MARKED_OPEN), 1, 'html selection marker on the selection branch root');
    assert.equal(count(source, "<html class="), 1, 'only the selection html is marked');
    assert.equal(count(source, 'oe-camos-selection'), 3, 'html marker plus two scoped selectors only');
    assert.equal(count(tail, '<body'), 0, 'selection branch keeps no explicit body opening');
    assert.equal(count(source, '<script src='), 1, 'one external script');
    assert.equal(count(source, POPUP_PATH), 1, 'popup.js referenced once');
    assert.equal(count(source, '<link'), 2, 'no stylesheet link added');
    for (const banned of ['popup.css', 'workspace.css', 'Header::', 'setupHeader', '$GLOBALS', '@import', 'fonts.']) {
        assert.equal(count(source, banned), 0, `no shared asset loader, stylesheet, font or raw global: ${banned}`);
    }
    const headStart = tail.indexOf('<head>\n');
    const headEnd = tail.indexOf('</head>\n', headStart);
    assert.ok(headStart > 0 && headEnd > headStart, 'selection head present');
    const head = tail.slice(headStart, headEnd);
    assert.equal(count(head, LINK), 1, 'existing rx.css link retained in the selection head');
    const after = head.slice(head.indexOf(LINK) + LINK.length);
    assert.ok(after.startsWith(SCRIPT), 'unchanged popup.js controller directly after rx.css with the pinned src expression');
    const style = after.slice(SCRIPT.length);
    assert.ok(style.startsWith(STYLE_OPEN) && style.endsWith(STYLE_CLOSE), 'inline style directly after the script, last in the head');
    inspectCss(style.slice(STYLE_OPEN.length, -STYLE_CLOSE.length));
    assert.equal(after, ADDITION, 'exact head addition');
    assert.ok(tail.indexOf(HEAD_END) === headEnd, 'head still closes straight into the heading');
    assert.equal(inverse(source), original, 'full inverse reproduces every original SQL, CSRF, PID, escaping, control, form-target, callback, print, signature and PDF byte');
}

describe('frozen original route', () => {
    test('fixture has the base digest and size', () => {
        assert.equal(originalBytes.length, BYTES);
        assert.equal(sha(originalBytes), HASH);
    });

    test('anchors are present once and the original has no seam', () => {
        const [, tail] = split(ORIGINAL);
        assert.equal(count(ORIGINAL, SELECT_MARKER + HTML_OPEN), 1);
        assert.equal(count(ORIGINAL, LINK), 2, 'rx.css link in both print and selection heads');
        assert.equal(count(tail, LINK + HEAD_END), 1);
        assert.equal(count(tail, '<html'), 1);
        assert.equal(count(tail, '<head>'), 1);
        assert.equal(count(tail, '<body'), 0, 'selection branch has no body opening');
        assert.equal(count(tail, '<style'), 0);
        assert.equal(count(tail, '<form'), 2);
        assert.equal(count(ORIGINAL, '<script src='), 0);
        assert.equal(count(ORIGINAL, '<link'), 2);
        assert.equal(count(ORIGINAL, 'target=_new'), 1, 'selection form posts to the named print window');
        for (const absent of ['oe-camos-selection', 'oe-workbench', 'popup.js', 'popup.css', 'workspace.css', 'Header::', '$GLOBALS']) {
            assert.equal(count(ORIGINAL, absent), 0, absent);
        }
        assert.ok(ORIGINAL.includes("if (filter_input(INPUT_POST, 'print_pdf') || filter_input(INPUT_POST, 'print_html')) {"), 'GET launchers reach the selection branch');
    });
});

describe('planned presentation seam', () => {
    const candidate = buildCandidate(ORIGINAL);

    test('synthetic candidate passes and its inverse is the original byte for byte', () => {
        assert.notEqual(candidate, ORIGINAL);
        assert.doesNotThrow(() => verifyCandidate(candidate, ORIGINAL));
        assert.ok(Buffer.from(inverse(candidate), 'utf8').equals(originalBytes));
    });

    test('untouched original is rejected', () => {
        assert.throws(() => verifyCandidate(ORIGINAL, ORIGINAL), /html selection marker/);
    });

    test('marker is on html, the CSS is screen-only and context-scoped, typography untouched', () => {
        inspectCss(CSS);
        assert.ok(RULES.every(([selector]) => selector.startsWith(`${PREFIX} `)));
        assert.ok(!CSS.includes('body.oe-camos-selection') && !CSS.includes('oe-workbench-popup'));
        assert.ok(!/font|line-height|letter-spacing|padding|margin|width|height|border-radius/.test(CSS));
    });

    const sub = (from, to) => (s) => replaceOnce(s, from, to);
    const swap = (block, from, to) => {
        assert.ok(block.includes(from), `fixture mutation anchor: ${from}`);
        return block.replace(from, () => to);
    };
    const inScript = (from, to) => (s) => replaceOnce(s, SCRIPT, swap(SCRIPT, from, to));
    const scriptAs = (other) => sub(SCRIPT, other);
    const bodyRule = (from, to) => (s) => replaceOnce(s, BODY_RULE, swap(BODY_RULE, from, to));
    const formRule = (from, to) => (s) => replaceOnce(s, FORM_RULE, swap(FORM_RULE, from, to));
    const extraRule = (selector, declaration) => sub(`${FORM_RULE}\n}`, `${FORM_RULE}\n\n  ${selector} {\n    ${declaration}\n  }\n}`);
    const styleAs = (css) => sub(STYLE, `${STYLE_OPEN}${css}${STYLE_CLOSE}`);
    const TOKEN = "OEGlobalsBag::getInstance()->getString('v_js_includes')";
    const WEBROOT = 'OEGlobalsBag::getInstance()->getWebRoot()';
    const mutations = [
        // Marker: html, selection branch only, exact class.
        ['missing html marker', sub(SELECT_MARKER + MARKED_OPEN, SELECT_MARKER + HTML_OPEN)],
        ['double-quoted marker', sub("<html class='oe-camos-selection'>", '<html class="oe-camos-selection">')],
        ['extra html class', sub("<html class='oe-camos-selection'>", "<html class='oe-camos-selection body_top'>")],
        ['html inline style', sub("<html class='oe-camos-selection'>", "<html class='oe-camos-selection' style='background:#fff'>")],
        ['marker moved to body', (s) => replaceOnce(sub(SELECT_MARKER + MARKED_OPEN, SELECT_MARKER + HTML_OPEN)(s), ADDITION + HEAD_END, `${ADDITION}</head>\n<body class='oe-camos-selection'>\n<h1>`)],
        ['explicit body opening', sub(ADDITION + HEAD_END, `${ADDITION}</head>\n<body>\n<h1>`)],
        ['print-branch html marker', sub('  <html>\n  <head>', "  <html class='oe-camos-selection'>\n  <head>")],
        // Controller script: one, unchanged asset, pinned location and expression.
        ['missing script', sub(SCRIPT, '')],
        ['duplicate script', sub(SCRIPT, SCRIPT + SCRIPT)],
        ['script before rx.css', sub(LINK + SCRIPT, SCRIPT + LINK)],
        ['script after head', (s) => replaceOnce(sub(SCRIPT, '')(s), STYLE + HEAD_END, `${STYLE}</head>\n${SCRIPT}<h1>`)],
        ['script in print branch', sub(`${LINK}</head>\n<body onload`, `${LINK}${SCRIPT}</head>\n<body onload`)],
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
        // Shared assets that are intentionally not loaded.
        ['popup.css link', sub(SCRIPT, `${SCRIPT}<link rel="stylesheet" href="<?php echo attr(${WEBROOT} . '/interface/clinical-workspace/popup.css'); ?>" />\n`)],
        ['workspace.css link', sub(SCRIPT, `${SCRIPT}<link rel="stylesheet" href="<?php echo attr(${WEBROOT} . '/interface/clinical-workspace/workspace.css'); ?>" />\n`)],
        ['Header asset loader', sub(LINK + SCRIPT, `${LINK}<?php Header::setupHeader(['opener']); ?>\n${SCRIPT}`)],
        ['font link', sub(SCRIPT, `${SCRIPT}<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />\n`)],
        ['font import', sub(`${STYLE_OPEN}@media`, `${STYLE_OPEN}@import url("fonts.css");\n@media`)],
        // Style placement and media.
        ['missing style', sub(STYLE, '')],
        ['duplicate style', sub(STYLE, STYLE + STYLE)],
        ['style before script', sub(SCRIPT + STYLE, STYLE + SCRIPT)],
        ['style after head', (s) => replaceOnce(sub(STYLE, '')(s), SCRIPT + HEAD_END, `${SCRIPT}</head>\n${STYLE}<h1>`)],
        ['print media', sub('@media screen {', '@media screen, print {')],
        ['all media', sub('@media screen {', '@media all {')],
        ['no media wrapper', styleAs(`${BODY_RULE}\n\n${FORM_RULE}`)],
        ['extra print block', sub('\n}\n</style>\n', '\n}\n@media print {\n  html.oe-camos-selection body {\n    color: #000;\n  }\n}\n</style>\n')],
        ['indented CSS', styleAs(CSS.split('\n').map((line) => (line ? `    ${line}` : line)).join('\n'))],
        ['tab indentation', styleAs(CSS.replace(/^ {4}/gm, '\t'))],
        // Selector scope.
        ['global body rule', bodyRule(`${PREFIX} body`, 'body')],
        ['global form rule', formRule(`${PREFIX} form`, 'form')],
        ['no context class', bodyRule(PREFIX, 'html.oe-camos-selection')],
        ['no route class', formRule(PREFIX, `html.${CONTEXT}`)],
        ['popup-only context', bodyRule(CONTEXT, 'oe-workbench-popup')],
        ['body marker selector', bodyRule(`${PREFIX} body`, 'body.oe-camos-selection')],
        ['descendant overreach', formRule(`${PREFIX} form {`, `${PREFIX} form * {`)],
        ['extra heading rule', extraRule(`${PREFIX} h1`, 'color: var(--oe-wb-ink, #17343b);')],
        ['extra input rule', extraRule(`${PREFIX} input`, 'background-color: var(--oe-wb-paper, #fff);')],
        ['extra table rule', extraRule(`${PREFIX} table`, 'color: var(--oe-wb-ink, #17343b);')],
        // Palette and fallbacks.
        ['bare token', bodyRule('var(--oe-wb-canvas, #f3f7f5)', 'var(--oe-wb-canvas)')],
        ['wrong fallback', formRule('var(--oe-wb-paper, #fff)', 'var(--oe-wb-paper, #fafafa)')],
        ['hard-coded colour', bodyRule('var(--oe-wb-ink, #17343b)', '#17343b')],
        ['unknown token', formRule('var(--oe-wb-line, #d9e4e2)', 'var(--oe-wb-border, #d9e4e2)')],
        ['semantic status colour', bodyRule('var(--oe-wb-ink, #17343b)', 'var(--oe-wb-warning-ink, #5c4300)')],
        ['swapped surfaces', bodyRule('var(--oe-wb-canvas, #f3f7f5)', 'var(--oe-wb-paper, #fff)')],
        // Geometry, typography and ordering.
        ['padding', formRule('    color: var(--oe-wb-ink, #17343b);', '    color: var(--oe-wb-ink, #17343b);\n    padding: 1rem;')],
        ['margin', bodyRule('    color: var(--oe-wb-ink, #17343b);', '    color: var(--oe-wb-ink, #17343b);\n    margin: 0;')],
        ['font family', bodyRule('    color: var(--oe-wb-ink, #17343b);', '    color: var(--oe-wb-ink, #17343b);\n    font-family: sans-serif;')],
        ['font size', formRule('    color: var(--oe-wb-ink, #17343b);', '    color: var(--oe-wb-ink, #17343b);\n    font-size: 14px;')],
        ['width', formRule('    color: var(--oe-wb-ink, #17343b);', '    color: var(--oe-wb-ink, #17343b);\n    max-width: 60rem;')],
        ['border radius', formRule('    color: var(--oe-wb-ink, #17343b);', '    color: var(--oe-wb-ink, #17343b);\n    border-radius: 8px;')],
        ['reordered declarations', bodyRule('    background-color: var(--oe-wb-canvas, #f3f7f5);\n    color: var(--oe-wb-ink, #17343b);', '    color: var(--oe-wb-ink, #17343b);\n    background-color: var(--oe-wb-canvas, #f3f7f5);')],
        ['missing outline', formRule(';\n    box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);', ';')],
        ['heavier outline', formRule('inset 0 0 0 1px', 'inset 0 0 0 2px')],
        ['outset outline', formRule('inset 0 0 0 1px', '0 0 0 1px')],
        ['important', bodyRule('#f3f7f5);', '#f3f7f5) !important;')],
        // Wrappers.
        ['new wrapper', sub("</head>\n<h1><?php echo xlt('Select CAMOS Entries for Printing'); ?></h1>\n", "</head>\n<div class='container'>\n<h1><?php echo xlt('Select CAMOS Entries for Printing'); ?></h1>\n")],
        // Selection form: target, method, CSRF, SQL, PID, escaping, controls and callbacks.
        ['form target blank', sub('target=_new>', 'target=_blank>')],
        ['form target removed', sub(" name='pick_items' target=_new>", " name='pick_items'>")],
        ['form method', sub("<form method=POST name='pick_items' target=_new>", "<form method=GET name='pick_items' target=_new>")],
        ['selection CSRF', sub(`<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />\n<input type=button name=cyclerx`, '<input type=button name=cyclerx')],
        ['update CSRF', sub(`<form method=POST name='pick_items'>\n<input type="hidden" name="csrf_token_form" value="<?php echo CsrfUtils::collectCsrfToken(session: $session); ?>" />\n`, "<form method=POST name='pick_items'>\n")],
        ['SQL activity', sub(`AND x.activity = 1", [$session->get('pid')]`, `AND x.activity = 0", [$session->get('pid')]`)],
        ['encounter scope', sub("if ($session->get('encounter') == null) {", 'if (true) {')],
        ['entry PID source', sub(`WHERE y.pid = ? AND y.form_name LIKE 'CAMOS%' AND x.activity = 1", [$session->get('pid')]`, `WHERE y.pid = ? AND y.form_name LIKE 'CAMOS%' AND x.activity = 1", [$_GET['pid']]`)],
        ['prescription PID source', sub("Prescription::prescriptions_factory($session->get('pid'))", "Prescription::prescriptions_factory($_GET['pid'])")],
        ['category escaping', sub('text($category)', '$category')],
        ['entry id escaping', sub(`attr("{$camosRow['id']}")`, `"{$camosRow['id']}"`)],
        ['item escaping', sub("text($camosRow['item'] ?? '')", "($camosRow['item'] ?? '')")],
        ['prescription id escaping', sub('attr((string) $val->id)', '(string) $val->id')],
        ['heading translation escaping', sub("xlt('Select CAMOS Entries for Printing')", "xl('Select CAMOS Entries for Printing')")],
        ['button translation escaping', sub("value='<?php echo xla('Unselect All'); ?>'", "value='<?php echo xl('Unselect All'); ?>'")],
        ['default prescription count', sub('$count < 4', '$count < 5')],
        ['default checked state', sub("$checked = 'checked';", "$checked = '';")],
        ['letterhead PDF control', sub(`onClick='uncheckall()'>\n\n    <?php if (filter_input(INPUT_GET, 'letterhead')) { ?>`, `onClick='uncheckall()'>\n\n    <?php if (true) { ?>`)],
        ['cycle callback', sub("onClick='cycle()'", "onClick=''")],
        ['check-all callback', sub("onClick='checkall()'", "onClick='uncheckall()'")],
        ['cycle engine', sub("if (cbc[2].innerHTML == 'prescriptions') {", "if (cbc[2].innerHTML == 'rx') {")],
        ['init callback', sub('function init() {}', 'function init() { window.print(); }')],
        ['update control', sub('<input type=submit name=update value=', '<input type=submit name=save value=')],
        ['trailing body close', sub('} //end of else statement\n?>\n</body>\n</html>', '} //end of else statement\n?>\n</html>')],
        ['appended bytes', (s) => `${s}<!-- -->\n`],
        // Print, letterhead, signature, PDF and update paths before the marker.
        ['print condition', sub("if (filter_input(INPUT_POST, 'print_pdf') || filter_input(INPUT_POST, 'print_html')) {", "if (filter_input(INPUT_POST, 'print_html')) {")],
        ['print CSRF', sub('        CsrfUtils::csrfNotVerified();\n    }\n    $camos_content = [];', '    }\n    $camos_content = [];')],
        ['print SQL PID', sub('SELECT content FROM $tbl_camos WHERE id = ? AND pid = ?', 'SELECT content FROM $tbl_camos WHERE id = ?')],
        ['update SQL', sub('federaldrugid = ? WHERE id = ?"', 'federaldrugid = ?"')],
        ['signature image', sub("<img src='./sig.jpg'>", "<img src='./sig.png'>")],
        ['signature selection', sub("'embossed' => $sigline['embossed'],", "'embossed' => $sigline['signed'],")],
        ['letterhead opener callback', sub('var win = top.printLogPrint ? top : opener.top;', 'var win = top;')],
        ['print log callback', sub('win.printLogPrint(window);', 'window.print();')],
        ['PDF stream', sub('$pdf->ezStream();', '$pdf->ezOutput();')]
    ];
    for (const [name, mutate] of mutations) {
        test(`rejects ${name}`, () => {
            const changed = mutate(candidate);
            assert.notEqual(changed, candidate, 'mutant differs from the approved candidate');
            assert.throws(() => verifyCandidate(changed, ORIGINAL));
        });
    }
});

describe('unchanged caller and assets (text only)', () => {
    test('report.php opens the route through four named target=_new links', () => {
        const caller = text(CALLER);
        assert.ok(caller.includes('$webroot = OEGlobalsBag::getInstance()->getWebRoot();'));
        assert.equal(count(caller, 'rx_print.php'), LAUNCHERS.length);
        for (const launcher of LAUNCHERS) {
            assert.equal(count(caller, `<a href='{$webroot}/interface/forms/CAMOS/${launcher}' target=_new>`), 1, launcher);
        }
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
        for (const [token, value] of Object.entries(PALETTE)) assert.ok(popupCss.includes(`    ${token}: ${value};\n`), token);
    });

    test('rx.css has no media, html, body or form rules for the seam to fight', () => {
        const rxCss = text(RX_CSS);
        assert.ok(!/@media|^(?:html|body|form)\b|oe-/m.test(rxCss));
    });
});

// Synthetic only: the real popup.js runs in a vm sandbox against window doubles. A
// target=_new window is top-level (parent === self) with an opener; that opener is the
// encounter frame report.php renders in, whose parent is the shell. This models the
// controller's discovery walk, not browser opener retention or native timing.
describe('unchanged popup.js controller on the selection window (synthetic)', () => {
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
    function world({ active = true, shellRoot = true, opener = 'frame', frameClosed = false, crossOrigin = false, html = ['oe-camos-selection'] } = {}) {
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
        // Runs from <head>: the selection body is not parsed yet.
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
        assert.deepEqual(w.root.classList.list(), ['oe-camos-selection', CONTEXT, 'oe-workbench-popup']);
        assert.equal(w.seen.observed.body, w.shellBody, 'observes the shell body, not the opener frame');
        assert.ok(w.listeners.has('pagehide'));
        assert.ok(!w.docListeners.has('DOMContentLoaded'), 'an opened window does not wait for its own body');
        assert.deepEqual(w.shellBody.classList.list(), ['workbench-active'], 'shell untouched');
        assert.deepEqual(w.frameBody.classList.list(), ['body_top'], 'opener frame untouched');
    });

    test('workbench mode flips toggle only the owned classes', () => {
        const w = world({ active: false });
        assert.equal(w.controller.active, false);
        assert.deepEqual(w.root.classList.list(), ['oe-camos-selection']);
        assert.equal(w.seen.observed.body, w.shellBody, 'legacy-mode shell root is still observed');
        w.shellBody.classList.add('workbench-active');
        w.seen.observed.cb();
        assert.equal(w.controller.active, true);
        assert.deepEqual(w.root.classList.list(), ['oe-camos-selection', CONTEXT, 'oe-workbench-popup']);
        w.shellBody.classList.remove('workbench-active');
        w.seen.observed.cb();
        assert.equal(w.controller.active, false);
        assert.deepEqual(w.root.classList.list(), ['oe-camos-selection'], 'server-set route marker survives');
    });

    test('disposal restores owned classes and ignores later mode changes', () => {
        const w = world();
        w.listeners.get('pagehide')();
        assert.equal(w.controller.active, false);
        assert.ok(w.seen.disconnected);
        assert.deepEqual(w.root.classList.list(), ['oe-camos-selection']);
        w.shellBody.classList.remove('workbench-active');
        w.shellBody.classList.add('workbench-active');
        w.seen.observed.cb();
        assert.deepEqual(w.root.classList.list(), ['oe-camos-selection']);
    });

    test('classes the page already had are not owned and are not removed', () => {
        const w = world({ html: ['oe-camos-selection', CONTEXT] });
        w.listeners.get('pagehide')();
        assert.deepEqual(w.root.classList.list(), ['oe-camos-selection', CONTEXT]);
    });

    for (const [name, options] of [
        ['legacy shell without the mode control', { active: false, shellRoot: false }],
        ['closed opener', { frameClosed: true }],
        ['cross-origin opener', { crossOrigin: true }]
    ]) {
        test(`${name} leaves the route inactive and unmarked`, () => {
            const w = world(options);
            assert.equal(w.controller.active, false);
            assert.deepEqual(w.root.classList.list(), ['oe-camos-selection']);
            assert.equal(w.seen.observed, null, 'nothing observed');
            assert.ok(!w.listeners.has('pagehide'));
        });
    }

    test('no opener leaves the route inactive, also after DOMContentLoaded', () => {
        const w = world({ opener: null });
        assert.equal(w.controller.active, false);
        assert.ok(w.docListeners.has('DOMContentLoaded'), 'top-level page retries once its body exists');
        const body = { classList: classes() };
        w.popup.document.body = body;
        body.ownerDocument = w.popup.document;
        w.popup.document.readyState = 'interactive';
        w.docListeners.get('DOMContentLoaded')();
        assert.equal(w.controller.active, false);
        assert.deepEqual(w.root.classList.list(), ['oe-camos-selection']);
        assert.equal(w.seen.observed, null);
    });
});

test('live route contains exactly the approved presentation delta', () => {
    verifyCandidate(text(ROUTE), ORIGINAL);
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
            assert.equal(sha(blob), HASH);
            assert.ok(blob.equals(originalBytes), 'fixture');
            assert.ok(Buffer.from(inverse(text(ROUTE)), 'utf8').equals(blob), 'restored route');
        });
        test('report.php caller, rx.css, popup.js and popup.css equal base', () => {
            for (const rel of UNCHANGED) assert.ok(read(rel).equals(git(['show', `${BASE}:${rel}`])), rel);
        });
        test('exactly the five intended files changed, including untracked files', () => {
            const changed = new Set([
                ...lines(git(['diff', '--name-only', '--no-renames', BASE])),
                ...lines(git(['ls-files', '--others', '--exclude-standard']))
            ]);
            assert.deepEqual([...changed].sort(), [...ALLOWED].sort());
        });
    });
}

module.exports = { buildCandidate, verifyCandidate, inverse, SCRIPT, STYLE, CSS };
