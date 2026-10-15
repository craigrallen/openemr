'use strict';

/*
 * Dynamic code finder popup (interface/patient_file/encounter/find_code_dynamic.php)
 * presentation guards.
 *
 * Dependency-free and history-independent (no git):
 *
 *   node --test tests/clinical-ui/code-search.test.cjs
 *
 * The full inverse comparison against the base commit, and the unchanged
 * AJAX endpoint, callers and shared popup/theme files, live in
 * code-search-baseline.test.cjs.
 *
 * Source checks only: native geometry, rendered contrast, keyboard use, real
 * DataTables AJAX and a real selection reaching an opener are NOT proved here.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    ROUTE, CALLERS, HELPER, SHEET, SHEET_NAME, BODY_CLASS, SCOPE, DOCUMENT, BASELINE_SUPPORTED, HEADER, LINK,
    changes, MUTATIONS, PRESENTATION_MUTATIONS, read, exists, count, restore, routeViolations,
    supportedList, parseCss, walkRules,
} = require('./code-search-support.cjs');

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
test('route: declared presentation edits present once, business source and elements preserved', () => {
    const php = read(ROUTE);
    assert.deepEqual(routeViolations(php), []);
    const restored = restore(php);
    assert.notEqual(restored, null);
    for (const [before] of changes) assert.equal(count(restored, before), 1, `inverse did not restore: ${before}`);
    for (const added of [BODY_CLASS, 'ClinicalWorkspaceAssets', SHEET_NAME, '<link ']) {
        assert.equal(count(restored, added), 0, `inverse left ${added}`);
    }
});

test('route: body keeps id=codes_search and the existing theform is the document', () => {
    const php = read(ROUTE);
    assert.equal(count(php, `<body id="codes_search" class="${BODY_CLASS}">`), 1);
    assert.equal(count(php, `<form method='post' name='theform' class='${DOCUMENT}'>`), 1);
    // The document class wraps the controls row and the DataTable, with no new wrapper element.
    const form = php.indexOf(`class='${DOCUMENT}'`);
    assert.ok(form > php.indexOf('<div class="container-fluid">'));
    assert.ok(form < php.indexOf("echo \"<div class='form-group row mb-3'>\\n\";"));
    assert.ok(form < php.indexOf('<table id="my_data_table"'));
});

test('route: one screen-only versioned link directly after the header setup, before the scripts', () => {
    const php = read(ROUTE);
    assert.equal(count(php, LINK), 1);
    assert.equal(php.indexOf(LINK), php.indexOf(HEADER) + HEADER.length + 1);
    assert.ok(php.indexOf(LINK) < php.indexOf('    <script>'));
    assert.ok(php.indexOf(LINK) < php.indexOf('</head>'));
    assert.equal(count(php, 'use OpenEMR\\Common\\Assets\\ClinicalWorkspaceAssets;\n'), 1);
});

test('route: AJAX/CSRF, limit, selection, promise, opener and control mutations are rejected', () => {
    const php = read(ROUTE);
    for (const [from, to] of MUTATIONS) {
        assert.equal(count(php, from), 1, `mutation anchor not unique: ${from}`);
        assert.notDeepEqual(routeViolations(php.replace(from, () => to)), [], `mutation survived: ${from}`);
    }
    for (const [from, to] of PRESENTATION_MUTATIONS) {
        assert.equal(count(php, from), 1, `presentation mutation anchor not unique: ${from}`);
        assert.equal(restore(php.replace(from, () => to)), null, `presentation mutation survived: ${from}`);
    }
    const strays = [
        ['            <table id="my_data_table"', '            <div class="table-responsive">\n            <table id="my_data_table"'],
        ['</head>', '    <style>body { font-size: 13px; }</style>\n</head>'],
        ['<div class="container-fluid">', '<div class="container-fluid">\n        <h2 class="oe-code-search-popup__title">x</h2>'],
        ['</form>', '<div class="oe-code-search-popup__actions"></div></form>'],
        ['</head>', '    <link rel="stylesheet" href="../../clinical-workspace/workspace.css">\n</head>'],
    ];
    for (const [from, to] of strays) {
        // The route's head close is unindented; each source anchor must exist exactly once so the stray really inserts.
        assert.equal(count(php, from), 1, `stray anchor not unique: ${from}`);
        assert.notEqual(php.replace(from, () => to), php, `stray did not insert: ${to}`);
    }
    for (const [from, to] of strays) assert.notDeepEqual(routeViolations(php.replace(from, () => to)), [], `stray survived: ${to}`);
});

// ---------------------------------------------------------------------------
// Asset helper
// ---------------------------------------------------------------------------
test('asset helper: exactly one sorted allowlist entry added to the copied baseline names', () => {
    const php = read(HELPER);
    assert.equal(count(php, `        '${SHEET_NAME}',\n`), 1);
    assert.equal(count(php, SHEET_NAME), 1);
    assert.ok(!BASELINE_SUPPORTED.includes(SHEET_NAME));
    assert.deepEqual(supportedList(php), [...BASELINE_SUPPORTED, SHEET_NAME].sort());
});

// ---------------------------------------------------------------------------
// Popup engine, callers and the semantic states the sheet must keep
// ---------------------------------------------------------------------------
test('popup engine marks <html> only, so the sheet scope is the genuine-popup marker', () => {
    const engine = read('interface/clinical-workspace/popup.js');
    assert.ok(engine.includes("const POPUP_CLASS = 'oe-workbench-popup';"));
    assert.ok(engine.includes('html.classList.add(name);'));
    assert.doesNotMatch(engine, /body\.classList\.(add|toggle)\(/);
});

test('callers still open the finder with their original URLs, sizes and promise', () => {
    for (const [file, needles] of Object.entries(CALLERS)) {
        const text = read(file);
        for (const needle of needles) assert.ok(text.includes(needle), `${file} lost: ${needle}`);
    }
});

test('cascade: shared popup sheet styles readonly/disabled fields this sheet must restate', () => {
    const shared = read('interface/clinical-workspace/popup.css');
    assert.ok(shared.includes('  html.oe-workbench-popup .form-control[readonly],\n'));
    assert.ok(shared.includes('    color: var(--oe-wb-disabled-ink);\n    background-color: var(--oe-wb-disabled-paper);\n'));
    // The shared sheet already sets the popup body font; this sheet inherits it and sets none.
    assert.ok(shared.includes('  html.oe-workbench-popup body {\n'));
});

// ---------------------------------------------------------------------------
// Stylesheet guard
// ---------------------------------------------------------------------------
const sharedTokens = () => new Set([...read('interface/clinical-workspace/popup.css').matchAll(/(--oe-wb-[\w-]+)\s*:/g)].map(m => m[1]));
const tokenOf = value => (value.match(/^var\((--oe-wb-[\w-]+)\)$/) || [])[1] ?? null;

const DOC_SEL = `${SCOPE} .${DOCUMENT}`;
const FIELD_SEL = `${DOC_SEL} .form-control`;
const SELECT_SEL = `${DOC_SEL} select`;
const TABLE_SEL = `${DOC_SEL} #my_data_table`;
const BTN_SEL = `${DOC_SEL} .btn`;
const STATE_SELS = [`${FIELD_SEL}[readonly]`, `${FIELD_SEL}:disabled`, `${SELECT_SEL}:disabled`];

// Paint is allowed only on these surfaces, with exactly this token pair.
const INK_CANVAS = ['var(--oe-wb-ink)', 'var(--oe-wb-canvas)'];
const INK_PAPER = ['var(--oe-wb-ink)', 'var(--oe-wb-paper)'];
const DISABLED = ['var(--oe-wb-disabled-ink)', 'var(--oe-wb-disabled-paper)'];
const PAINT = new Map([
    [SCOPE, INK_CANVAS],
    [DOC_SEL, INK_PAPER],
    [FIELD_SEL, INK_PAPER],
    [SELECT_SEL, INK_PAPER],
    [`${FIELD_SEL}:focus`, INK_PAPER],
    [`${SELECT_SEL}:focus`, INK_PAPER],
    [TABLE_SEL, INK_PAPER],
    ...STATE_SELS.map(s => [s, DISABLED]),
]);
// Fields, selects and buttons keep Bootstrap's borders, box-shadows and
// background images, so .is-valid/.is-invalid/.was-validated borders and icons,
// select carets and the original button palettes survive. At this sheet's
// specificity any such declaration would beat `.form-control.is-invalid`.
const escapeRe = s => s.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
const CONTROL_SEL = new RegExp('^(' + [FIELD_SEL, SELECT_SEL, BTN_SEL].map(escapeRe).join('|') + ')');
const CONTROL_CUE = /^(border(-[\w-]+)?|box-shadow|background-image|background)$/;
const PAINT_PROPS = ['color', 'background', 'background-color'];
const COLOUR_PROPS = ['color', 'background', 'background-color', 'border-color', 'border', 'outline', 'outline-color', 'box-shadow'];
const TYPOGRAPHY = /^(font(-[\w-]+)?|letter-spacing|line-height|text-transform|word-spacing|text-decoration|text-align|text-shadow)$/;
// Layout that could reflow DataTables, its wrapper or the original gutters.
const LAYOUT = /^(padding(-[\w-]+)?|margin(-[\w-]+)?|width|min-width|max-width|height|min-height|max-height|white-space|overflow(-[xy])?|display|position|float|flex(-[\w-]+)?|gap|table-layout|border-collapse|border-spacing)$/;
// The document sheet may be inset; nothing else moves.
const LAYOUT_ALLOWED = [[DOC_SEL, 'padding', /^\d*\.?\d+(rem|px)( \d*\.?\d+(rem|px))?$/]];
// No theme declaration currently forces a need here: !important is not allowed at all.
const IMPORTANT_ALLOWED = [];
const BANNED_SELECTOR = /table-responsive|dataTables_(wrapper|scroll|length|filter|info|paginate|processing)|tbody|thead|\btr\b|:hover|nth-|::?(before|after)\b|:not\(|\.alert|moreResults|\.table-striped|#codes_search|dialogModal|modal|is-(in)?valid|was-validated|:(in)?valid\b/;

function cssViolations(text) {
    const out = [];
    const tree = parseCss(text);
    const tokens = sharedTokens();
    if (tree.length !== 1 || tree[0].type !== 'atrule' || tree[0].name !== 'media' || tree[0].params !== 'screen') {
        out.push('sheet must be exactly one top-level @media screen block');
    }
    for (const node of tree.flatMap(n => (n.type === 'statement' ? [n] : n.nodes || []))) {
        if (node.type === 'statement') out.push(`statement not allowed: ${node.prelude}`);
        if (node.type === 'atrule') out.push(`nested at-rule not allowed: @${node.name} ${node.params}`);
    }
    for (const { selectors, decls } of walkRules(tree)) {
        const map = Object.fromEntries(decls.map(d => [d.prop, d.value]));
        const focusy = selectors.filter(s => /:focus/.test(s));
        if (focusy.length && selectors.length !== 1) out.push(`focus rule in a list: ${selectors.join(', ')}`);
        for (const selector of selectors) {
            if (!(selector === SCOPE || selector.startsWith(`${SCOPE} `))) out.push(`unscoped selector: ${selector}`);
            if (count(selector, 'oe-workbench-popup') !== 1 || /oe-workbench-context|workbench-active|body\.oe-workbench/.test(selector)) {
                out.push(`foreign activation scope: ${selector}`);
            }
            if (BANNED_SELECTOR.test(selector)) out.push(`DataTables, semantic or generated selector: ${selector}`);
            const paint = PAINT.get(selector);
            const painted = PAINT_PROPS.filter(p => p in map);
            if (painted.length && !paint) out.push(`paint outside the declared surfaces: ${selector}`);
            if (paint) {
                const fg = map.color;
                const bg = map['background-color'] ?? map.background;
                if (fg !== paint[0] || bg !== paint[1]) out.push(`wrong or unpaired paint on ${selector}: ${fg} on ${bg}`);
            }
            if ('border-color' in map) out.push(`border-color overrides theme or validation borders: ${selector}`);
            if (CONTROL_SEL.test(selector)) {
                for (const prop of Object.keys(map).filter(p => CONTROL_CUE.test(p))) {
                    out.push(`control border/shadow/image overrides semantic cues: ${selector} ${prop}`);
                }
            }
        }
        for (const { prop, value, important } of decls) {
            if (important && !(selectors.length === 1 && IMPORTANT_ALLOWED.some(a => a.selector === selectors[0] && a.prop === prop && a.value === value))) {
                out.push(`!important outside the allowlist: ${prop}`);
            }
            if (TYPOGRAPHY.test(prop)) out.push(`typography change: ${prop}`);
            if (LAYOUT.test(prop) && !(selectors.length === 1 && LAYOUT_ALLOWED.some(([s, p, v]) => s === selectors[0] && p === prop && v.test(value)))) {
                out.push(`layout change: ${prop}: ${value}`);
            }
            if (prop === 'content') out.push('generated content');
            if (prop.startsWith('--')) out.push(`new custom property: ${prop}`);
            if (/^(pointer-events|visibility|opacity|user-select|cursor|clip|clip-path|transform|z-index)$/.test(prop)) out.push(`behaviour-affecting property: ${prop}`);
            if (/^outline(-style|-width)?$/.test(prop) && /^(none|0)\b/.test(value)) out.push(`focus ring removed: ${prop}: ${value}`);
            if (COLOUR_PROPS.includes(prop) && /#[0-9a-f]{3,8}\b|\b(rgb|hsl)a?\(|\b(white|black|red|blue|green|gray|grey|yellow)\b/i.test(value)) {
                out.push(`raw colour instead of a shared token: ${prop}: ${value}`);
            }
            for (const [, name] of value.matchAll(/var\((--[\w-]+)\)/g)) if (!tokens.has(name)) out.push(`unknown token: ${name}`);
        }
    }
    return out;
}

const rules = () => walkRules(parseCss(read(SHEET)));
const indexOf = selector => rules().findIndex(r => r.selectors.length === 1 && r.selectors[0] === selector);
const declsFor = selector => Object.assign({}, ...rules().filter(r => r.selectors.includes(selector))
    .map(r => Object.fromEntries(r.decls.map(d => [d.prop, d.value]))));
const paintOf = selector => {
    const d = declsFor(selector);
    return [d.color, d['background-color'] ?? d.background];
};

test('guard self-check: a minimal sheet passes and negative fixtures are rejected', () => {
    const wrap = body => `@media screen {\n${body}\n}`;
    assert.deepEqual(cssViolations(wrap(`
  ${SCOPE} { color: var(--oe-wb-ink); background-color: var(--oe-wb-canvas); }
  ${DOC_SEL} { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); border: 1px solid var(--oe-wb-line); padding: 0.75rem; }
  ${FIELD_SEL} { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); outline: 2px solid transparent; outline-offset: 1px; }
  ${FIELD_SEL}:focus { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); outline-color: var(--oe-wb-petrol); }
  ${FIELD_SEL}[readonly] { color: var(--oe-wb-disabled-ink); background-color: var(--oe-wb-disabled-paper); }
  ${TABLE_SEL} { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); }
  ${BTN_SEL}:focus { outline-color: var(--oe-wb-petrol); }`)), []);
    const fixtures = {
        'context scope': wrap(`html.oe-workbench-context body.${BODY_CLASS} { outline-offset: 0; }`),
        unscoped: wrap(`body.${BODY_CLASS} .btn { outline-offset: 2px; }`),
        'global table': wrap('html.oe-workbench-popup .table { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); }'),
        'bare rule': `${SCOPE} { outline-offset: 0; }`,
        print: `@media print { ${SCOPE} { outline-offset: 0; } }`,
        'width query': wrap(`@media (max-width: 480px) { ${DOC_SEL} { padding: 0; } }`),
        import: `@import url("workspace.css");\n${wrap(`${SCOPE} { outline-offset: 0; }`)}`,
        'font family': wrap(`${DOC_SEL} { font-family: Georgia, serif; }`),
        'font size': wrap(`${FIELD_SEL} { font-size: 0.875rem; }`),
        'font weight': wrap(`${TABLE_SEL} th { font-weight: 600; }`),
        'responsive wrapper': wrap(`${DOC_SEL} .table-responsive { border-radius: 4px; }`),
        'wrapper overflow': wrap(`${DOC_SEL} .dataTables_wrapper { overflow-x: auto; }`),
        'table layout': wrap(`${TABLE_SEL} { table-layout: fixed; }`),
        'table width': wrap(`${TABLE_SEL} { width: 100%; }`),
        'stripe repaint': wrap(`${TABLE_SEL} tbody tr:nth-of-type(odd) { background-color: var(--oe-wb-canvas); }`),
        'hover repaint': wrap(`${TABLE_SEL}:hover { outline-offset: 0; }`),
        'more-results alert': wrap(`${DOC_SEL} .alert-warning { border-color: var(--oe-wb-line); }`),
        'delete palette': wrap(`${DOC_SEL} .btn-danger { color: var(--oe-wb-on-petrol); background-color: var(--oe-wb-petrol); }`),
        'button paint': wrap(`${BTN_SEL} { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); }`),
        'readonly suppressed': wrap(`${FIELD_SEL}[readonly] { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); }`),
        'unpaired field': wrap(`${FIELD_SEL} { color: var(--oe-wb-ink); }`),
        'focus in list': wrap(`${FIELD_SEL}:focus, ${BTN_SEL}:focus { outline-color: var(--oe-wb-petrol); }`),
        'ring removed': wrap(`${FIELD_SEL}:focus { outline: 0; }`),
        'button border': wrap(`${BTN_SEL} { border-color: var(--oe-wb-line); }`),
        'field border colour': wrap(`${FIELD_SEL} { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); border-color: var(--oe-wb-line); }`),
        'focus border colour': wrap(`${SELECT_SEL}:focus { color: var(--oe-wb-ink); background-color: var(--oe-wb-paper); border-color: var(--oe-wb-petrol); }`),
        'field border shorthand': wrap(`${FIELD_SEL} { border: 1px solid var(--oe-wb-line); }`),
        'focus shadow': wrap(`${FIELD_SEL}:focus { box-shadow: none; }`),
        'background shorthand drops icons': wrap(`${FIELD_SEL} { color: var(--oe-wb-ink); background: var(--oe-wb-paper); }`),
        'validation state': wrap(`${FIELD_SEL}.is-invalid { outline-offset: 1px; }`),
        important: wrap(`${DOC_SEL} { border: 1px solid var(--oe-wb-line) !important; }`),
        'raw colour': wrap(`${DOC_SEL} { color: #17343b; background-color: #fff; }`),
        'unknown token': wrap(`${DOC_SEL} { color: var(--oe-wb-ink); background-color: var(--oe-wb-sheet); }`),
        'gutter margin': wrap(`${DOC_SEL} { margin: 0; }`),
        'hidden processing': wrap(`${DOC_SEL} .dataTables_processing { display: none; }`),
        'hidden control': wrap(`${SELECT_SEL} { visibility: hidden; }`),
        'not chain': wrap(`${FIELD_SEL}:not([readonly]) { outline-offset: 1px; }`),
        'custom property': wrap(`${SCOPE} { --oe-wb-paper: #fafafa; }`),
    };
    for (const [name, css] of Object.entries(fixtures)) assert.notDeepEqual(cssViolations(css), [], `fixture accepted: ${name}`);
});

test('sheet: exists, screen-only, scoped to the genuine popup and within every guard', () => {
    assert.ok(exists(SHEET), `${SHEET} is missing`);
    assert.deepEqual(cssViolations(read(SHEET)), []);
});

// This sheet adds no typography. It does not restore the pre-workbench font:
// the shared popup.css already sets the popup body font before this sheet loads.
test('sheet: quiet canvas, paper document sheet with a line border, no added typography', () => {
    assert.deepEqual(paintOf(SCOPE), INK_CANVAS);
    assert.deepEqual(paintOf(DOC_SEL), INK_PAPER);
    assert.match(declsFor(DOC_SEL).border ?? '', /var\(--oe-wb-line\)/, 'document sheet has no line border');
    assert.doesNotMatch(read(SHEET), /font/i);
});

test('sheet: fields and selects paired in normal and focus states, table painted', () => {
    for (const target of [FIELD_SEL, SELECT_SEL]) {
        assert.deepEqual(paintOf(target), INK_PAPER, `${target} normal paint`);
        assert.deepEqual(paintOf(`${target}:focus`), INK_PAPER, `${target} focus paint`);
    }
    assert.deepEqual(paintOf(TABLE_SEL), INK_PAPER);
});

test('sheet: validation borders, shadows and icons stay Bootstrap\'s on every control rule', () => {
    const controlRules = rules().filter(r => r.selectors.some(s => CONTROL_SEL.test(s)));
    assert.ok(controlRules.length > 0);
    for (const { selectors, decls } of controlRules) {
        for (const { prop } of decls) {
            assert.doesNotMatch(prop, CONTROL_CUE, `${selectors.join(', ')} sets ${prop}`);
        }
    }
    for (const { selectors } of rules()) {
        for (const selector of selectors) assert.doesNotMatch(selector, /is-(in)?valid|was-validated|:(in)?valid\b/);
    }
    // The shared sheet documents the same contract for its own field rules.
    assert.ok(read('interface/clinical-workspace/popup.css').includes("Borders stay Bootstrap's so .is-invalid/.is-valid and .was-validated cues survive."));
});

test('sheet: readonly and disabled states restated after the field and focus rules', () => {
    const last = Math.max(...[FIELD_SEL, SELECT_SEL].flatMap(s => [indexOf(s), indexOf(`${s}:focus`)]));
    for (const state of STATE_SELS) {
        assert.deepEqual(paintOf(state), DISABLED, `${state} not restated`);
        assert.ok(indexOf(state) > last, `${state} must follow the field and focus rules`);
    }
});

test('sheet: independent :focus fallback precedes :focus-visible for fields, selects and buttons', () => {
    for (const target of [FIELD_SEL, SELECT_SEL, BTN_SEL]) {
        assert.match(declsFor(target).outline ?? '', /\btransparent\b/, `${target} reserves no ring`);
        assert.ok(declsFor(target)['outline-offset'], `${target} has no ring offset`);
        const focus = indexOf(`${target}:focus`);
        const visible = indexOf(`${target}:focus-visible`);
        assert.ok(focus >= 0, `${target}:focus fallback missing`);
        assert.ok(visible > focus, `${target}:focus-visible missing or before the fallback`);
        for (const index of [focus, visible]) {
            const d = Object.fromEntries(rules()[index].decls.map(x => [x.prop, x.value]));
            assert.equal(d['outline-color'], 'var(--oe-wb-petrol)');
        }
    }
});

test('sheet: no !important declarations', () => {
    const important = rules().flatMap(r => r.decls.filter(d => d.important));
    assert.deepEqual(important, IMPORTANT_ALLOWED);
});
