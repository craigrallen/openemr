'use strict';

/*
 * Procedure provider editor (interface/orders/procedure_provider_edit.php)
 * presentation guards.
 *
 * Dependency-free and history-independent (no git):
 *
 *   node --test tests/clinical-ui/procedure-provider.test.cjs
 *
 * The full inverse comparison against the base commit, and the unchanged
 * caller and shared popup files, live in procedure-provider-baseline.test.cjs.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    ROUTE, HELPER, SHEET, SHEET_NAME, DOC, SCOPE, DOCUMENT, ACTIONS, CANVAS, BASELINE_SUPPORTED, LINK,
    changes, MUTATIONS, PRESENTATION_MUTATIONS, read, exists, count, restore, routeViolations,
    supportedList, parseCss, walkRules,
} = require('./procedure-provider-support.cjs');

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
test('route: declared presentation edits present once, business source and elements preserved', () => {
    const php = read(ROUTE);
    assert.deepEqual(routeViolations(php), []);
    const restored = restore(php);
    assert.notEqual(restored, null);
    for (const [before] of changes) assert.equal(count(restored, before), 1, `inverse did not restore: ${before}`);
    assert.equal(count(restored, 'oe-procedure-provider-popup'), 0);
    assert.equal(count(restored, 'ClinicalWorkspaceAssets'), 0);
    assert.equal(count(restored, SHEET_NAME), 0);
});

test('route: one screen-only versioned link after the inline style, inside <head>', () => {
    const php = read(ROUTE);
    assert.equal(count(php, LINK), 1);
    assert.equal(count(php, '<link '), 1);
    assert.ok(php.indexOf(LINK) > php.indexOf('</style>'), 'link must follow the inline style so ties resolve to the sheet');
    assert.ok(php.indexOf(LINK) < php.indexOf('</head>'));
});

test('route: ACL, SQL, CSRF, credential, control, callback and font mutations are rejected', () => {
    const php = read(ROUTE);
    for (const [from, to] of MUTATIONS) {
        assert.equal(count(php, from), 1, `mutation anchor not unique: ${from}`);
        assert.notDeepEqual(routeViolations(php.replace(from, () => to)), [], `mutation survived: ${from}`);
    }
    for (const [from, to] of PRESENTATION_MUTATIONS) {
        assert.equal(count(php, from), 1, `presentation mutation anchor not unique: ${from}`);
        assert.equal(restore(php.replace(from, () => to)), null, `presentation mutation survived: ${from}`);
    }
    // Stray extra markup outside the declared edits.
    assert.notDeepEqual(routeViolations(php.replace('</form>', () => '<button type="button">x</button></form>')), []);
    assert.notDeepEqual(routeViolations(php.replace('<div class="page-header"', () => '<h2>x</h2><div class="page-header"')), []);
});

// ---------------------------------------------------------------------------
// Asset helper
// ---------------------------------------------------------------------------
test('asset helper: exactly one sorted allowlist entry added to the copied baseline names', () => {
    const php = read(HELPER);
    assert.equal(count(php, `        '${SHEET_NAME}',\n`), 1);
    assert.equal(count(php, SHEET_NAME), 1);
    const list = supportedList(php);
    assert.notEqual(list, null);
    assert.ok(!BASELINE_SUPPORTED.includes(SHEET_NAME));
    assert.deepEqual(list, [...BASELINE_SUPPORTED, SHEET_NAME].sort());
});

// ---------------------------------------------------------------------------
// Stylesheet guard
// ---------------------------------------------------------------------------
const sharedTokens = () => new Set([...read('interface/clinical-workspace/popup.css').matchAll(/(--oe-wb-[\w-]+)\s*:/g)].map(m => m[1]));
const FG_BG = {
    '--oe-wb-ink': ['--oe-wb-paper', '--oe-wb-canvas'],
    '--oe-wb-muted': ['--oe-wb-paper', '--oe-wb-canvas'],
    '--oe-wb-petrol': ['--oe-wb-paper', '--oe-wb-canvas'],
    '--oe-wb-on-petrol': ['--oe-wb-petrol'],
    '--oe-wb-disabled-ink': ['--oe-wb-disabled-paper'],
    '--oe-wb-warning-ink': ['--oe-wb-warning-paper'],
};
const tokenOf = value => (value.match(/^var\((--oe-wb-[\w-]+)\)$/) || [])[1] ?? null;
const COLOUR_PROPS = ['color', 'background', 'background-color', 'border-color', 'border', 'outline', 'outline-color', 'box-shadow'];
const PAINT_PROPS = ['color', 'background', 'background-color', 'border-color'];
const TYPOGRAPHY = /^(font(-[\w-]+)?|letter-spacing|line-height|text-transform|word-spacing|text-decoration)$/;
const SCRIPT_OWNED = /\.collapse\b|\.show\b|_info\b|\.label-div\b|\.tooltip\b/;
// No theme !important declaration reaches an element this sheet paints (see the cascade
// test), so the exact allowlist is empty: any !important in the sheet is a violation.
const IMPORTANT_ALLOWED = [];

function cssViolations(text) {
    const out = [];
    const tree = parseCss(text);
    const tokens = sharedTokens();
    if (tree.length !== 1 || tree[0].type !== 'atrule' || tree[0].name !== 'media' || tree[0].params !== 'screen') {
        out.push('sheet must be exactly one top-level @media screen block');
    }
    const walkAt = (nodes, nested) => {
        for (const node of nodes) {
            if (node.type === 'statement') out.push(`statement not allowed: ${node.prelude}`);
            if (node.type !== 'atrule') continue;
            if (nested && !(node.name === 'media' && /^\((max|min)-width: \d+px\)$/.test(node.params))) {
                out.push(`nested at-rule not allowed: @${node.name} ${node.params}`);
            }
            if (node.nodes) walkAt(node.nodes, true);
        }
    };
    walkAt(tree, false);

    for (const { selectors, decls } of walkRules(tree)) {
        const map = Object.fromEntries(decls.map(d => [d.prop, d.value]));
        const visible = selectors.filter(s => s.includes(':focus-visible'));
        if (visible.length && visible.length !== selectors.length) out.push(`:focus-visible mixed into a list: ${selectors.join(', ')}`);
        for (const selector of selectors) {
            if (!(selector === SCOPE || selector.startsWith(`${SCOPE} `))) out.push(`unscoped selector: ${selector}`);
            if (count(selector, 'oe-workbench-popup') !== 1 || /oe-workbench-context|workbench-active|dialogModal|body\.oe-workbench/.test(selector)) {
                out.push(`foreign activation scope: ${selector}`);
            }
            if (/::?(before|after)\b/.test(selector)) out.push(`generated content selector: ${selector}`);
            if (SCRIPT_OWNED.test(selector) && 'display' in map) out.push(`display on script-owned visibility: ${selector}`);
            if (/\.btn\b/.test(selector) && PAINT_PROPS.some(prop => prop in map)) out.push(`button palette overridden: ${selector}`);
        }
        for (const { prop, value, important } of decls) {
            if (important && !IMPORTANT_ALLOWED.some(a => a.selector === selectors[0] && a.prop === prop && a.value === value)) {
                out.push(`!important outside the allowlist: ${prop}`);
            }
            if (TYPOGRAPHY.test(prop)) out.push(`typography change: ${prop}`);
            if (prop === 'content') out.push('generated content');
            if (prop.startsWith('--')) out.push(`new custom property: ${prop}`);
            if (/^(pointer-events|visibility|opacity|user-select|cursor)$/.test(prop)) out.push(`behaviour-affecting property: ${prop}`);
            if (prop === 'display' && /none/.test(value)) out.push('display: none');
            if (prop === 'position' && /fixed|sticky/.test(value)) out.push(`position: ${value}`);
            if (/^outline(-style|-width)?$/.test(prop) && /^(none|0)\b/.test(value)) out.push(`focus ring removed: ${prop}: ${value}`);
            if (COLOUR_PROPS.includes(prop) && /#[0-9a-f]{3,8}\b|\b(rgb|hsl)a?\(|\b(white|black|red|blue|green|gray|grey|yellow)\b/i.test(value)) {
                out.push(`raw colour instead of a shared token: ${prop}: ${value}`);
            }
            for (const [, name] of value.matchAll(/var\((--[\w-]+)\)/g)) if (!tokens.has(name)) out.push(`unknown token: ${name}`);
        }
        const fg = map.color;
        const bg = map['background-color'] ?? map.background;
        if ((fg === undefined) !== (bg === undefined)) out.push(`unpaired foreground/background: ${selectors.join(', ')}`);
        if (fg !== undefined && bg !== undefined) {
            const f = tokenOf(fg);
            const b = tokenOf(bg);
            if (!(f && b && (FG_BG[f] || []).includes(b))) out.push(`unknown colour pair ${fg} on ${bg}: ${selectors.join(', ')}`);
        }
    }
    return out;
}

const DOC_SEL = `${SCOPE} .${DOCUMENT}`;
const ACTIONS_SEL = `${SCOPE} .${ACTIONS}`;
const FIELD_SEL = `${DOC_SEL} .form-control`;
const HELP_SEL = `${DOC_SEL} div[id$='_info']`;
const rules = () => walkRules(parseCss(read(SHEET)));
const declsFor = selector => Object.assign({}, ...rules().filter(r => r.selectors.includes(selector))
    .map(r => Object.fromEntries(r.decls.map(d => [d.prop, d.value]))));
const paint = selector => {
    const d = declsFor(selector);
    return { color: d.color, background: d.background ?? d['background-color'] };
};

test('guard self-check: a minimal sheet passes and negative fixtures are rejected', () => {
    const wrap = body => `@media screen {\n${body}\n}`;
    assert.deepEqual(cssViolations(wrap(`
  ${SCOPE} { color: var(--oe-wb-ink); background: var(--oe-wb-canvas); }
  ${HELP_SEL} { color: var(--oe-wb-warning-ink); background-color: var(--oe-wb-warning-paper); }
  ${ACTIONS_SEL} .btn { outline: 2px solid transparent; outline-offset: 2px; }
  ${ACTIONS_SEL} .btn:focus { outline-color: var(--oe-wb-petrol); }
  ${ACTIONS_SEL} .btn:focus-visible { outline-color: var(--oe-wb-petrol); }
  @media (max-width: 640px) { ${ACTIONS_SEL} { gap: 6px; } }`)), []);
    const fixtures = {
        'context scope on body': wrap(`body.oe-workbench-context.oe-procedure-provider-popup { outline-offset: 0; }`),
        'context scope on html': wrap(`html.oe-workbench-context body.oe-procedure-provider-popup { outline-offset: 0; }`),
        unscoped: wrap('body.oe-procedure-provider-popup .btn { outline-offset: 2px; }'),
        'bare rule': `${SCOPE} { outline-offset: 0; }`,
        print: `@media print { ${SCOPE} { outline-offset: 0; } }`,
        'screen and print': `@media screen, print { ${SCOPE} { outline-offset: 0; } }`,
        import: `@import url("x.css");\n${wrap(`${SCOPE} { outline-offset: 0; }`)}`,
        'font size': wrap(`${SCOPE} td { font-size: 0.875rem; }`),
        'font family': wrap(`${SCOPE} .btn { font-family: Georgia, serif; }`),
        'font weight': wrap(`${SCOPE} label { font-weight: 600; }`),
        'font shorthand': wrap(`${SCOPE} h4 { font: 12px serif; }`),
        'letter spacing': wrap(`${SCOPE} h4 { letter-spacing: 0.04em; }`),
        'text transform': wrap(`${SCOPE} label { text-transform: uppercase; }`),
        'synthetic heading': wrap(`${DOC_SEL}::before { content: "Provider"; }`),
        'help shown': wrap(`${HELP_SEL} { display: block; }`),
        'hover help shown': wrap(`${SCOPE} .label-div > a { display: inline-block; }`),
        'actions hidden': wrap(`${ACTIONS_SEL} { display: none; }`),
        'pointer events': wrap(`${DOC_SEL} a { pointer-events: none; }`),
        'mixed focus list': wrap(`${ACTIONS_SEL} .btn:focus, ${ACTIONS_SEL} .btn:focus-visible { outline-color: var(--oe-wb-petrol); }`),
        'ring removed': wrap(`${ACTIONS_SEL} .btn:focus { outline: none; }`),
        important: wrap(`${DOC_SEL} { color: var(--oe-wb-ink) !important; background: var(--oe-wb-paper) !important; }`),
        'raw colour': wrap(`${FIELD_SEL} { color: #000; background: #fff; }`),
        'unpaired foreground': wrap(`${FIELD_SEL} { color: var(--oe-wb-ink); }`),
        'unpaired background': wrap(`${FIELD_SEL} { background-color: var(--oe-wb-paper); }`),
        'mismatched pair': wrap(`${FIELD_SEL} { color: var(--oe-wb-on-petrol); background: var(--oe-wb-paper); }`),
        'unknown token': wrap(`${FIELD_SEL} { color: var(--oe-wb-ink); background: var(--oe-wb-sheet); }`),
        'new token': wrap(`${SCOPE} { --oe-wb-sheet: #fff; }`),
        'save palette': wrap(`${ACTIONS_SEL} .btn-save { color: var(--oe-wb-on-petrol); background: var(--oe-wb-petrol); }`),
        'cancel palette': wrap(`${ACTIONS_SEL} .btn-cancel { color: var(--oe-wb-ink); background: var(--oe-wb-paper); }`),
        'delete palette': wrap(`${ACTIONS_SEL} .btn-delete { border-color: var(--oe-wb-line); }`),
        'range syntax': wrap(`@media (width <= 640px) { ${SCOPE} { outline-offset: 0; } }`),
    };
    for (const [name, css] of Object.entries(fixtures)) assert.notDeepEqual(cssViolations(css), [], `fixture accepted: ${name}`);
});

test('sheet: exists, screen-only, scoped to the genuine popup and within every guard', () => {
    assert.ok(exists(SHEET), `${SHEET} is missing`);
    assert.deepEqual(cssViolations(read(SHEET)), []);
    // popup.js marks <html>, never <body>: a body-level context class would never match.
    const engine = read('interface/clinical-workspace/popup.js');
    assert.ok(engine.includes("const POPUP_CLASS = 'oe-workbench-popup';"));
    assert.ok(engine.includes('html.classList.add(name);'));
    assert.ok(!/body\.classList\.(add|toggle)\(/.test(engine));
});

test('sheet: canvas, paper document, paired fields and paired help on shared tokens', () => {
    assert.deepEqual(paint(SCOPE), { color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-canvas)' });
    assert.deepEqual(paint(DOC_SEL), { color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)' });
    assert.deepEqual(paint(FIELD_SEL), { color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)' });
    assert.deepEqual(paint(HELP_SEL), { color: 'var(--oe-wb-warning-ink)', background: 'var(--oe-wb-warning-paper)' });
    assert.ok(rules().some(r => r.selectors.includes(`${SCOPE} .${CANVAS}`)), 'no canvas layout rule');
    const doc = declsFor(DOC_SEL);
    assert.ok(doc.border && doc.border.includes('var(--oe-wb-line)'), 'document sheet has no line border');
    assert.ok(doc.padding, 'document sheet has no padding');
});

test('sheet: original actions wrap without a breakpoint and keep their own palettes', () => {
    const wraps = rules().filter(r => r.selectors.includes(ACTIONS_SEL) && r.media.length === 1
        && r.decls.some(d => d.prop === 'flex-wrap' && d.value === 'wrap'));
    assert.equal(wraps.length, 1);
    const d = declsFor(ACTIONS_SEL);
    assert.ok(d.gap, 'wrapped actions need a gap');
    assert.equal(d['max-width'], '100%');
    // Bootstrap .btn-group joins margins/radii; wrapped rows must not overlap.
    assert.equal(declsFor(`${ACTIONS_SEL} .btn`)['margin-left'], '0');
});

test('sheet: focus ring reserved, separate :focus fallback precedes :focus-visible', () => {
    for (const target of [`${ACTIONS_SEL} .btn`, `${DOC_SEL} a`]) {
        const rest = declsFor(target);
        assert.match(rest.outline ?? '', /\btransparent\b/, `${target} reserves no ring`);
        assert.ok(rest['outline-offset'], `${target} has no ring offset`);
        const all = rules();
        const focus = all.findIndex(r => r.selectors.length === 1 && r.selectors[0] === `${target}:focus`);
        const visible = all.findIndex(r => r.selectors.length === 1 && r.selectors[0] === `${target}:focus-visible`);
        assert.ok(focus >= 0, `${target}:focus fallback missing`);
        assert.ok(visible > focus, `${target}:focus-visible missing or before the fallback`);
        for (const index of [focus, visible]) {
            const d = Object.fromEntries(all[index].decls.map(x => [x.prop, x.value]));
            assert.equal(d['outline-color'], 'var(--oe-wb-petrol)');
        }
    }
});

// Source-only cascade model over the real theme sources every compiled theme imports.
const specificity = selector => [
    (selector.match(/#[\w-]+/g) || []).length,
    (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length,
    (selector.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length,
];
const beats = (a, b) => {
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
};

test('cascade: no theme !important reaches a painted element, so the !important allowlist is exactly empty', () => {
    const defaults = read('interface/themes/theme-defaults.scss');
    const solar = read('interface/themes/oe-styles/style_solar.scss');
    const php = read(ROUTE);
    // fieldset/legend colours are !important in every theme; the route has neither element.
    assert.ok(defaults.includes('fieldset {\n  background-color: $light !important;\n  color: $body-color !important;\n}'));
    assert.ok(defaults.includes('legend {\n  background-color: $gray-300 !important;\n  color: $body-color !important;\n}'));
    assert.equal((php.match(/<(fieldset|legend)[ >]/g) || []).length, 0);
    // #theform targets an id; this form only has name='theform'.
    assert.ok(defaults.includes('#theform input[type="text"] {'));
    assert.doesNotMatch(php, /id=['"]theform['"]/);
    // [onclick~="delete"] paints danger !important; no route onclick carries that word.
    assert.ok(defaults.includes('[onclick~="delete"] {\n  background: $danger !important;'));
    assert.doesNotMatch(php, /onclick=['"][^'"]*\bdelete\b/);
    // Solar's .btn-secondary ink is !important: the sheet leaves every button palette alone.
    assert.ok(solar.includes('.btn-secondary {\n    color: $ovr-light !important;'));
    assert.equal(IMPORTANT_ALLOWED.length, 0);
    assert.equal(rules().flatMap(r => r.decls).filter(d => d.important).length, 0);
    // The inline help panel colours are ordinary declarations the scoped pair outranks.
    assert.ok(beats(specificity(HELP_SEL), specificity('div[id$="_info"]')));
});

test('docs: describes the slice and both suites without unverified fit or contrast claims', () => {
    assert.ok(exists(DOC), `${DOC} is missing`);
    const doc = read(DOC);
    for (const part of [ROUTE, SHEET, 'screen', 'CSRF', 'tests/clinical-ui/procedure-provider.test.cjs', 'tests/clinical-ui/procedure-provider-baseline.test.cjs']) {
        assert.ok(doc.includes(part), `docs omit ${part}`);
    }
    assert.doesNotMatch(doc, /\b\d+(\.\d+)?\s*:\s*1\b/);
    assert.doesNotMatch(doc, /\bWCAG\b[^\n.]*\b(pass(es)?|meets?|conform(s|ant)?|compliant)\b/i);
    assert.doesNotMatch(doc, /\b(fits?|verified)\s+(at|in|within)\s+\d+\s*px\b/i);
});
