'use strict';

/*
 * Patient tracker status popup (interface/patient_tracker/patient_tracker_status.php)
 * presentation guards.
 *
 * Dependency-free and history-independent (no git):
 *
 *   node --test tests/clinical-ui/tracker-status.test.cjs
 *
 * The full inverse comparison against the base commit, and the unchanged
 * caller and shared popup/theme files, live in tracker-status-baseline.test.cjs.
 *
 * Source checks only: native geometry, rendered contrast, assistive-technology
 * roles and a real status submit are NOT proved here.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    ROUTE, HELPER, SHEET, SHEET_NAME, SCOPE, DOCUMENT, TITLE, ACTIONS, BASELINE_SUPPORTED, LINK,
    changes, MUTATIONS, PRESENTATION_MUTATIONS, read, exists, count, restore, routeViolations,
    supportedList, parseCss, walkRules,
} = require('./tracker-status-support.cjs');

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
test('route: declared presentation edits present once, business source and elements preserved', () => {
    const php = read(ROUTE);
    assert.deepEqual(routeViolations(php), []);
    const restored = restore(php);
    assert.notEqual(restored, null);
    for (const [before] of changes) assert.equal(count(restored, before), 1, `inverse did not restore: ${before}`);
    for (const added of ['oe-tracker-status-popup', 'ClinicalWorkspaceAssets', SHEET_NAME, '<link ']) {
        assert.equal(count(restored, added), 0, `inverse left ${added}`);
    }
});

test('route: one screen-only versioned link directly after the header setup, inside <head>', () => {
    const php = read(ROUTE);
    assert.equal(count(php, LINK), 1);
    assert.ok(php.indexOf(LINK) > php.indexOf("Header::setupHeader(['common','opener'])"));
    assert.ok(php.indexOf(LINK) < php.indexOf('</head>'));
    assert.ok(php.indexOf(LINK) < php.indexOf("if (!empty($_POST['statustype']))"), 'link must precede the POST response');
});

test('route: CSRF, SQL, encounter, status-write, opener, control and label mutations are rejected', () => {
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
        ['</form>', '<button type="button">x</button></form>'],
        ['    </head>', '    <style>h2 { font-size: 1rem; }</style>\n    </head>'],
        ['<div class="position-override">', '<div class="position-override" style="font-family: serif">'],
    ];
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
// Stylesheet guard
// ---------------------------------------------------------------------------
const sharedTokens = () => new Set([...read('interface/clinical-workspace/popup.css').matchAll(/(--oe-wb-[\w-]+)\s*:/g)].map(m => m[1]));
const FG_BG = {
    '--oe-wb-ink': ['--oe-wb-paper', '--oe-wb-canvas'],
    '--oe-wb-muted': ['--oe-wb-paper', '--oe-wb-canvas'],
    '--oe-wb-petrol': ['--oe-wb-paper', '--oe-wb-canvas'],
    '--oe-wb-on-petrol': ['--oe-wb-petrol'],
};
const tokenOf = value => (value.match(/^var\((--oe-wb-[\w-]+)\)$/) || [])[1] ?? null;
const COLOUR_PROPS = ['color', 'background', 'background-color', 'border-color', 'border', 'outline', 'outline-color', 'box-shadow'];
const PAINT_PROPS = ['color', 'background', 'background-color', 'border-color'];
const TYPOGRAPHY = /^(font(-[\w-]+)?|letter-spacing|line-height|text-transform|word-spacing|text-decoration|text-align)$/;
// Layout properties that could break the original container gutters or overflow a narrow popup.
const LAYOUT = /^(padding(-[\w-]+)?|margin(-[\w-]+)?|width|min-width|max-width|height|min-height|white-space|overflow(-[xy])?|display|position|float|flex|flex-basis|flex-shrink|flex-grow)$/;

const DOC_SEL = `${SCOPE} .${DOCUMENT}`;
const TITLE_SEL = `${DOC_SEL} .${TITLE}`;
const FIELD_SEL = `${DOC_SEL} .form-control`;
const ACTIONS_SEL = `${DOC_SEL} .${ACTIONS}`;
const BTN_SEL = `${ACTIONS_SEL} > .btn`;
// Colour themes square the first button's right corners with !important
// (interface/themes/colors/utilities/bootstrap.scss); wrapped buttons need them back.
// The unchanged route has exactly two plain buttons, so :first-child alone suffices; chained
// :not() is avoided (selector-not-notation, older browsers). The scoped selector outranks the theme's.
const FIRST_BTN_SEL = `${ACTIONS_SEL} > .btn:first-child`;
const IMPORTANT_ALLOWED = [
    { selector: FIRST_BTN_SEL, prop: 'border-top-right-radius', value: '3px' },
    { selector: FIRST_BTN_SEL, prop: 'border-bottom-right-radius', value: '3px' },
];
// Exact layout exceptions: [selector, prop, value].
const LAYOUT_ALLOWED = [
    [ACTIONS_SEL, 'max-width', '100%'],
    [BTN_SEL, 'margin-left', '0'],
];

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
        const visible = selectors.filter(s => s.includes(':focus-visible'));
        if (visible.length && visible.length !== selectors.length) out.push(`:focus-visible mixed into a list: ${selectors.join(', ')}`);
        for (const selector of selectors) {
            if (!(selector === SCOPE || selector.startsWith(`${SCOPE} `))) out.push(`unscoped selector: ${selector}`);
            if (count(selector, 'oe-workbench-popup') !== 1 || /oe-workbench-context|workbench-active|dialogModal|body\.oe-workbench/.test(selector)) {
                out.push(`foreign activation scope: ${selector}`);
            }
            if (/::?(before|after)\b/.test(selector)) out.push(`generated content selector: ${selector}`);
            if (/\.btn\b/.test(selector) && PAINT_PROPS.some(prop => prop in map)) out.push(`button palette overridden: ${selector}`);
        }
        for (const { prop, value, important } of decls) {
            if (important && !(selectors.length === 1 && IMPORTANT_ALLOWED.some(a => a.selector === selectors[0] && a.prop === prop && a.value === value))) {
                out.push(`!important outside the allowlist: ${prop}`);
            }
            if (TYPOGRAPHY.test(prop)) out.push(`typography change: ${prop}`);
            if (LAYOUT.test(prop) && !(selectors.length === 1 && LAYOUT_ALLOWED.some(([s, p, v]) => s === selectors[0] && p === prop && v === value))) {
                out.push(`layout change: ${prop}: ${value}`);
            }
            if (prop === 'content') out.push('generated content');
            if (prop.startsWith('--')) out.push(`new custom property: ${prop}`);
            if (/^(pointer-events|visibility|opacity|user-select|cursor|clip|clip-path)$/.test(prop)) out.push(`behaviour-affecting property: ${prop}`);
            if (/^outline(-style|-width)?$/.test(prop) && /^(none|0)\b/.test(value)) out.push(`focus ring removed: ${prop}: ${value}`);
            if (prop === 'flex-wrap' && value !== 'wrap') out.push(`flex-wrap: ${value}`);
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
  ${BTN_SEL} { margin-left: 0; outline: 2px solid transparent; outline-offset: 2px; }
  ${FIRST_BTN_SEL} { border-top-right-radius: 3px !important; border-bottom-right-radius: 3px !important; }
  ${BTN_SEL}:focus { outline-color: var(--oe-wb-petrol); }
  ${BTN_SEL}:focus-visible { outline-color: var(--oe-wb-petrol); }`)), []);
    const fixtures = {
        'context scope on html': wrap(`html.oe-workbench-context body.oe-tracker-status-popup { outline-offset: 0; }`),
        unscoped: wrap('body.oe-tracker-status-popup .btn { outline-offset: 2px; }'),
        'bare rule': `${SCOPE} { outline-offset: 0; }`,
        print: `@media print { ${SCOPE} { outline-offset: 0; } }`,
        'width query': wrap(`@media (max-width: 480px) { ${ACTIONS_SEL} { gap: 4px; } }`),
        import: `@import url("x.css");\n${wrap(`${SCOPE} { outline-offset: 0; }`)}`,
        'font size': wrap(`${TITLE_SEL} { font-size: 1.25rem; }`),
        'font family': wrap(`${SCOPE} .btn { font-family: Georgia, serif; }`),
        'font weight': wrap(`${SCOPE} label { font-weight: 600; }`),
        'gutter padding': wrap(`${DOC_SEL} { padding: 0; }`),
        'container width': wrap(`${DOC_SEL} { max-width: 480px; }`),
        'no wrap': wrap(`${ACTIONS_SEL} { white-space: nowrap; }`),
        'actions hidden': wrap(`${ACTIONS_SEL} { display: none; }`),
        'select hidden': wrap(`${FIELD_SEL} { visibility: hidden; }`),
        'pointer events': wrap(`${BTN_SEL} { pointer-events: none; }`),
        'mixed focus list': wrap(`${BTN_SEL}:focus, ${BTN_SEL}:focus-visible { outline-color: var(--oe-wb-petrol); }`),
        'ring removed': wrap(`${FIELD_SEL}:focus { outline: 0; }`),
        'important elsewhere': wrap(`${DOC_SEL} { color: var(--oe-wb-ink) !important; background: var(--oe-wb-paper) !important; }`),
        'important wrong value': wrap(`${FIRST_BTN_SEL} { border-top-right-radius: 0.25rem !important; }`),
        'important on chained :not': wrap(`${ACTIONS_SEL} > .btn:first-child:not(:last-child):not(.dropdown-toggle) { border-top-right-radius: 3px !important; }`),
        'important in a list': wrap(`${FIRST_BTN_SEL}, ${BTN_SEL} { border-top-right-radius: 3px !important; }`),
        'raw colour': wrap(`${FIELD_SEL} { color: #000; background: #fff; }`),
        'unpaired foreground': wrap(`${FIELD_SEL}:focus { color: var(--oe-wb-ink); }`),
        'mismatched pair': wrap(`${FIELD_SEL} { color: var(--oe-wb-on-petrol); background: var(--oe-wb-paper); }`),
        'unknown token': wrap(`${FIELD_SEL} { color: var(--oe-wb-ink); background: var(--oe-wb-sheet); }`),
        'save palette': wrap(`${ACTIONS_SEL} .btn-save { color: var(--oe-wb-on-petrol); background: var(--oe-wb-petrol); }`),
    };
    for (const [name, css] of Object.entries(fixtures)) assert.notDeepEqual(cssViolations(css), [], `fixture accepted: ${name}`);
});

test('sheet: exists, screen-only, scoped to the genuine popup and within every guard', () => {
    assert.ok(exists(SHEET), `${SHEET} is missing`);
    assert.deepEqual(cssViolations(read(SHEET)), []);
});

test('sheet: quiet canvas, paper document sheet and petrol title on shared tokens', () => {
    assert.deepEqual(paint(SCOPE), { color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-canvas)' });
    assert.deepEqual(paint(DOC_SEL), { color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)' });
    assert.deepEqual(paint(TITLE_SEL), { color: 'var(--oe-wb-petrol)', background: 'var(--oe-wb-paper)' });
    const doc = declsFor(DOC_SEL);
    assert.ok(doc.border && doc.border.includes('var(--oe-wb-line)'), 'document sheet has no line border');
});

test('sheet: selects paired in normal and focus states (Light, Dark and Solar alike)', () => {
    assert.deepEqual(paint(FIELD_SEL), { color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)' });
    assert.deepEqual(paint(`${FIELD_SEL}:focus`), { color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-paper)' });
    assert.equal(declsFor(FIELD_SEL)['border-color'], 'var(--oe-wb-line)');
    assert.equal(declsFor(`${FIELD_SEL}:focus`)['border-color'], 'var(--oe-wb-petrol)');
});

test('sheet: separate :focus fallback precedes :focus-visible for selects and buttons, ring reserved', () => {
    for (const target of [FIELD_SEL, BTN_SEL]) {
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

test('sheet: original btn-group wraps without a breakpoint, corners corrected, palettes untouched', () => {
    const actions = declsFor(ACTIONS_SEL);
    assert.equal(actions['flex-wrap'], 'wrap');
    assert.ok(actions.gap, 'wrapped actions need a gap');
    assert.equal(actions['max-width'], '100%');
    const btn = declsFor(BTN_SEL);
    assert.equal(btn['margin-left'], '0');
    assert.ok(btn['border-radius'] && !/^0(px)?$/.test(btn['border-radius']), 'joined square corners not corrected');
    // The corner rule follows the focus rules (no-descending-specificity) and avoids :not() notation.
    const all = rules();
    const corner = all.findIndex(r => r.selectors.length === 1 && r.selectors[0] === FIRST_BTN_SEL);
    assert.ok(corner > all.findIndex(r => r.selectors[0] === `${BTN_SEL}:focus-visible`), 'corner rule must follow the focus rules');
    assert.ok(!read(SHEET).includes(':not('), ':not() notation is not allowed in the sheet');
    const important = rules().flatMap(r => r.decls.filter(d => d.important).map(d => ({ selector: r.selectors[0], prop: d.prop, value: d.value })));
    assert.deepEqual(important.sort((a, b) => a.prop.localeCompare(b.prop)), [...IMPORTANT_ALLOWED].sort((a, b) => a.prop.localeCompare(b.prop)));
});

test('cascade: the theme !important that squares the first button is the one the allowlist answers', () => {
    const colors = read('interface/themes/colors/utilities/bootstrap.scss');
    assert.ok(colors.includes(
        '    > .btn:first-child:not(:last-child):not(.dropdown-toggle) {\n'
        + '      border-bottom-left-radius: 3px !important;\n'
        + '      border-bottom-right-radius: 0 !important;\n'
        + '      border-top-left-radius: 3px !important;\n'
        + '      border-top-right-radius: 0 !important;\n',
    ));
    // Solar's .btn-secondary ink is !important: the sheet leaves every button palette alone.
    assert.ok(read('interface/themes/oe-styles/style_solar.scss').includes('.btn-secondary {\n    color: $ovr-light !important;'));
    // generate_select_list renders the controls this sheet pairs as .form-control.
    assert.ok(read('library/options.inc.php').includes('$attributes[\'class\'] = (!empty($class)) ? "form-control " . attr($class) : "form-control";'));
});
