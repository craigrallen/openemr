'use strict';

/*
 * Procedure type editor (interface/orders/types_edit.php) presentation guards.
 *
 * Dependency-free and history-independent (no git): run with
 * `node --test tests/clinical-ui/procedure-editor.test.cjs`. The git-baseline
 * restoration, mutation and pinned-caller checks live in
 * procedure-editor-baseline.test.cjs and are run separately.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    ROUTE, HELPER, SHEET, SHEET_NAME, DOC, SCOPE, BASELINE_SUPPORTED, LINK, changes,
    read, exists, count, restore, supportedList, parseCss, walkRules,
} = require('./procedure-editor-support.cjs');

test('route: every declared presentation edit is present exactly once and invertible', () => {
    const php = read(ROUTE);
    for (const [before, after] of changes) {
        assert.equal(count(php, after), 1, `presentation edit missing: ${after}`);
        assert.equal(count(php, before), 0, `original form still present: ${before}`);
    }
    const restored = restore(php);
    assert.notEqual(restored, null);
    for (const [before, after] of changes) {
        assert.equal(count(restored, before), 1, `inverse did not restore: ${before}`);
        assert.equal(count(restored, after), 0);
    }
    assert.equal(count(restored, 'oe-procedure-'), 0);
    assert.equal(count(restored, 'ClinicalWorkspaceAssets'), 0);
});

test('route: no synthetic headings or controls, one styled body, bare save response', () => {
    const php = read(ROUTE);
    assert.equal(count(php, '<body class="oe-procedure-editor">'), 1);
    assert.equal((php.match(/<body[ >]/g) || []).length, 1);
    assert.equal((php.match(/<h[1-6][ >]/g) || []).length, 0);
    assert.equal(count(php, '<button'), 3);
    assert.equal(count(php, '<legend'), 1);
    assert.equal(count(php, '<fieldset'), 1);
    assert.equal(count(php, SHEET_NAME), 2);
    assert.equal(count(php, LINK), 1);
    // Linked after the inline style so ties resolve to the screen sheet, before any script.
    assert.ok(php.indexOf(LINK) > php.indexOf('    </style>'));
    assert.ok(php.indexOf(LINK) < php.indexOf('    <script>'));
    assert.ok(php.includes('echo "</script></body></html>\\n";'));
});

test('asset helper: exact allowlist entry added to the copied baseline names, sorted', () => {
    const php = read(HELPER);
    assert.equal(count(php, `        '${SHEET_NAME}',\n`), 1);
    assert.equal(count(php, SHEET_NAME), 1);
    const list = supportedList(php);
    assert.notEqual(list, null);
    assert.deepEqual(list, [...list].sort());
    assert.ok(!BASELINE_SUPPORTED.includes(SHEET_NAME));
    assert.deepEqual(list.filter(name => name !== SHEET_NAME), BASELINE_SUPPORTED);
    assert.deepEqual(list, [...BASELINE_SUPPORTED, SHEET_NAME].sort());
});

// Shared tokens are defined by the common popup sheet; this route adds none.
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
const PASSIVE = new Set(['inherit', 'transparent', 'currentcolor', 'none']);
const SCRIPT_OWNED = /\.(ordonly|resonly|fgponly|foronly|collapse|show|disabled)\b|_info\b|\.label-div\s*>\s*a\b|#form_legend\b/;
const COLOUR_PROPS = ['color', 'background', 'background-color', 'border-color', 'outline-color', 'border', 'outline', 'box-shadow'];

// The only !important declarations the sheet may carry, each at most once, together, in a
// single-selector rule directly inside the top-level @media screen block: the document's paper
// pair, which must beat theme-defaults.scss `fieldset { background-color/color: ... !important }`.
const DOC_SELECTOR = `${SCOPE} .oe-procedure-document`;
const IMPORTANT_ALLOWED = [
    { selector: DOC_SELECTOR, prop: 'background', value: 'var(--oe-wb-paper)' },
    { selector: DOC_SELECTOR, prop: 'color', value: 'var(--oe-wb-ink)' },
];
const allowedKey = ({ selector, prop, value }) => `${selector} { ${prop}: ${value} }`;

// Returns human-readable violations for a stylesheet; [] when it meets every guard.
function cssViolations(text) {
    const out = [];
    const importantSeen = new Map(IMPORTANT_ALLOWED.map(a => [allowedKey(a), 0]));
    const tree = parseCss(text);
    const tokens = sharedTokens();
    if (tree.length !== 1 || tree[0].type !== 'atrule' || tree[0].name !== 'media' || tree[0].params !== 'screen') {
        out.push('sheet must be exactly one top-level @media screen block');
    }
    const walkAt = (nodes, nested) => {
        for (const node of nodes) {
            if (node.type === 'statement') out.push(`statement at-rule not allowed: ${node.prelude}`);
            if (node.type !== 'atrule') continue;
            if (nested && !(node.name === 'media' && /^\((max|min)-width: \d+px\)$/.test(node.params))) {
                out.push(`nested at-rule not allowed: @${node.name} ${node.params}`);
            }
            if (!nested && node.name !== 'media') out.push(`top-level at-rule not allowed: @${node.name}`);
            if (node.nodes) walkAt(node.nodes, true);
        }
    };
    walkAt(tree, false);

    const rules = walkRules(tree);
    for (const { selectors, decls, media } of rules) {
        const map = Object.fromEntries(decls.map(d => [d.prop, d.value]));
        const focusVisible = selectors.filter(s => s.includes(':focus-visible'));
        if (focusVisible.length && focusVisible.length !== selectors.length) {
            out.push(`:focus-visible mixed into a selector list: ${selectors.join(', ')}`);
        }
        for (const selector of selectors) {
            if (!(selector === SCOPE || selector.startsWith(`${SCOPE} `))) out.push(`unscoped selector: ${selector}`);
            if (count(selector, 'oe-workbench-popup') !== 1 || /oe-workbench-context|workbench-active|dialogModal/.test(selector)) {
                out.push(`foreign activation scope: ${selector}`);
            }
            if (/::?(before|after)\b/.test(selector)) out.push(`generated content selector: ${selector}`);
            if (SCRIPT_OWNED.test(selector) && 'display' in map) out.push(`display on script-owned visibility: ${selector}`);
            if (/\.btn-cancel\b/.test(selector) && !/:not\(\.btn-(danger|delete)\)/.test(selector)
                && COLOUR_PROPS.some(prop => prop in map)) {
                out.push(`.btn-cancel colour also hits Delete: ${selector}`);
            }
            if (/\.btn-(danger|delete)\b(?!\))/.test(selector) && COLOUR_PROPS.some(prop => prop in map)) {
                out.push(`semantic danger palette overridden: ${selector}`);
            }
        }
        for (const { prop, value, important } of decls) {
            if (important) {
                const key = allowedKey({ selector: selectors[0], prop, value });
                if (media.length === 1 && selectors.length === 1 && importantSeen.has(key)) {
                    importantSeen.set(key, importantSeen.get(key) + 1);
                } else {
                    out.push(`!important outside the allowlist: ${selectors.join(', ')} { ${prop}: ${value} }`);
                }
            }
            if (/^font(-family|-size|-weight|-style)?$/.test(prop)) out.push(`font override: ${prop}`);
            if (prop === 'content') out.push('generated content');
            if (prop.startsWith('--')) out.push(`new custom property: ${prop}`);
            if (/^(pointer-events|visibility|opacity|user-select)$/.test(prop)) out.push(`behaviour-affecting property: ${prop}`);
            if (prop === 'display' && /none/.test(value)) out.push('display: none');
            if (prop === 'position' && value === 'fixed') out.push('position: fixed');
            if (/^outline(-style)?$/.test(prop) && /^(none|0)\b/.test(value)) out.push(`focus ring removed: ${prop}: ${value}`);
            if (COLOUR_PROPS.includes(prop) && /#[0-9a-f]{3,8}\b|\b(rgb|hsl)a?\(|\b(white|black|red|blue|green|gray|grey)\b/i.test(value)
                && !(prop === 'box-shadow' && /^[\d.\s\w-]*rgb\(\d+ \d+ \d+ \/ \d+%\)$/.test(value))) {
                out.push(`raw colour instead of shared token: ${prop}: ${value}`);
            }
            for (const [, name] of value.matchAll(/var\((--[\w-]+)\)/g)) if (!tokens.has(name)) out.push(`unknown token: ${name}`);
        }
        // Foreground and background travel together and form a known pair.
        const fg = map.color;
        const bg = map['background-color'] ?? map.background;
        if ((fg === undefined) !== (bg === undefined)) out.push(`unpaired foreground/background: ${selectors.join(', ')}`);
        if (fg !== undefined && bg !== undefined) {
            const f = tokenOf(fg);
            const b = tokenOf(bg);
            const passive = PASSIVE.has(fg.toLowerCase()) && PASSIVE.has(bg.toLowerCase());
            if (!passive && !(f && b && (FG_BG[f] || []).includes(b))) out.push(`unknown colour pair ${fg} on ${bg}: ${selectors.join(', ')}`);
        }
    }
    const seen = [...importantSeen.values()];
    if (seen.some(n => n > 1)) out.push('allowlisted !important declared more than once');
    if (seen.some(n => n === 0) && seen.some(n => n > 0)) out.push('allowlisted !important pair split');
    return out;
}

const sheet = () => read(SHEET);
const rules = () => walkRules(parseCss(sheet()));
const declsFor = selector => Object.assign({}, ...rules().filter(r => r.selectors.includes(selector))
    .map(r => Object.fromEntries(r.decls.map(d => [d.prop, d.value]))));
const indexOf = predicate => rules().findIndex(r => r.selectors.some(predicate));

test('guard self-check: negative fixtures are rejected and a minimal sheet passes', () => {
    const ok = `@media screen {
  ${SCOPE} { color: var(--oe-wb-ink); background: var(--oe-wb-canvas); }
  ${SCOPE} .oe-procedure-commit .btn { outline: 2px solid transparent; outline-offset: 2px; }
  ${SCOPE} .oe-procedure-commit .btn:focus { outline-color: var(--oe-wb-petrol); }
  ${SCOPE} .oe-procedure-commit .btn:focus-visible { outline-color: var(--oe-wb-petrol); }
  @media (max-width: 640px) { ${SCOPE} .oe-procedure-commit { flex-wrap: wrap; } }
}`;
    assert.deepEqual(cssViolations(ok), []);
    const wrap = body => `@media screen {\n${body}\n}`;
    const pair = 'color: var(--oe-wb-ink) !important; background: var(--oe-wb-paper) !important;';
    assert.deepEqual(cssViolations(wrap(`${DOC_SELECTOR} { ${pair} padding: 4px; }`)), []);
    const fixtures = {
        unscoped: wrap('body.oe-procedure-editor .btn { outline-offset: 2px; }'),
        'inactive-context scope': wrap(`html.oe-workbench-context body.oe-procedure-editor .btn { outline-offset: 2px; }`),
        'shell scope': wrap(`body.workbench-active ${SCOPE} .btn { outline-offset: 2px; }`),
        print: `@media print { ${SCOPE} { outline-offset: 0; } }`,
        'screen and print': `@media screen, print { ${SCOPE} { outline-offset: 0; } }`,
        'all media': `@media all { ${SCOPE} { outline-offset: 0; } }`,
        'bare rule': `${SCOPE} { outline-offset: 0; }`,
        'range syntax': wrap(`@media (width <= 640px) { ${SCOPE} { outline-offset: 0; } }`),
        import: `@import url("x.css");\n${wrap(`${SCOPE} { outline-offset: 0; }`)}`,
        'mixed focus list': wrap(`${SCOPE} .btn:focus, ${SCOPE} .btn:focus-visible { outline-color: var(--oe-wb-petrol); }`),
        'ring removed': wrap(`${SCOPE} .btn:focus { outline: none; }`),
        'font family': wrap(`${SCOPE} td { font-family: Georgia, serif; }`),
        'font size': wrap(`${SCOPE} td { font-size: 0.9rem; }`),
        'font shorthand': wrap(`${SCOPE} td { font: 12px serif; }`),
        'synthetic heading': wrap(`${SCOPE} .oe-procedure-document::before { content: "Procedure"; }`),
        'script-owned display': wrap(`${SCOPE} .ordonly { display: block; }`),
        'collapse display': wrap(`${SCOPE} div[id$="_info"].collapse { display: block; }`),
        'hover help display': wrap(`${SCOPE} .label-div > a { display: inline-block; }`),
        'hidden': wrap(`${SCOPE} .oe-procedure-commit { display: none; }`),
        'pointer events': wrap(`${SCOPE} .disabled { pointer-events: auto; }`),
        important: wrap(`${SCOPE} .btn { outline-offset: 2px !important; }`),
        'important unrelated property beside the pair': wrap(`${DOC_SELECTOR} { ${pair} padding: 4px !important; }`),
        'important pair on another selector': wrap(`${SCOPE} { color: var(--oe-wb-ink) !important; background: var(--oe-wb-canvas) !important; }`),
        'important pair on a descendant': wrap(`${DOC_SELECTOR} a { color: var(--oe-wb-ink) !important; background: var(--oe-wb-paper) !important; }`),
        'important pair in a selector list': wrap(`${DOC_SELECTOR}, ${SCOPE} .oe-procedure-sheet { ${pair} }`),
        'important longhand instead of the allowed shorthand': wrap(`${DOC_SELECTOR} { color: var(--oe-wb-ink) !important; background-color: var(--oe-wb-paper) !important; }`),
        'important pair with another value': wrap(`${DOC_SELECTOR} { color: var(--oe-wb-ink) !important; background: var(--oe-wb-canvas) !important; }`),
        'important pair in a nested media block': wrap(`@media (max-width: 640px) { ${DOC_SELECTOR} { ${pair} } }`),
        'important pair duplicated across rules': wrap(`${DOC_SELECTOR} { ${pair} }\n${DOC_SELECTOR} { ${pair} }`),
        'important declaration duplicated in the rule': wrap(`${DOC_SELECTOR} { ${pair} color: var(--oe-wb-ink) !important; }`),
        'important pair split': wrap(`${DOC_SELECTOR} { color: var(--oe-wb-ink) !important; background: var(--oe-wb-paper); }`),
        'raw colour': wrap(`${SCOPE} .btn { color: #fff; background: #086878; }`),
        'unpaired foreground': wrap(`${SCOPE} .btn { color: var(--oe-wb-ink); }`),
        'unpaired background': wrap(`${SCOPE} .btn { background: var(--oe-wb-paper); }`),
        'mismatched pair': wrap(`${SCOPE} .btn { color: var(--oe-wb-on-petrol); background: var(--oe-wb-paper); }`),
        'unknown token': wrap(`${SCOPE} .btn { color: var(--oe-wb-ink); background: var(--oe-wb-sheet); }`),
        'new token': wrap(`${SCOPE} { --oe-wb-sheet: #fff; }`),
        'delete via cancel': wrap(`${SCOPE} .oe-procedure-commit .btn-cancel { color: var(--oe-wb-ink); background: var(--oe-wb-paper); }`),
        'danger palette': wrap(`${SCOPE} .oe-procedure-commit .btn-delete { color: var(--oe-wb-on-petrol); background: var(--oe-wb-petrol); }`),
    };
    for (const [name, css] of Object.entries(fixtures)) assert.notDeepEqual(cssViolations(css), [], `fixture accepted: ${name}`);
});

test('sheet: exists, screen-only, scoped to the active popup and within every guard', () => {
    assert.ok(exists(SHEET), `${SHEET} is missing`);
    assert.deepEqual(cssViolations(sheet()), []);
    assert.ok(rules().length >= 8);
});

test('sheet: quiet document surface on paired shared tokens', () => {
    assert.deepEqual(
        { color: declsFor(SCOPE).color, background: declsFor(SCOPE).background ?? declsFor(SCOPE)['background-color'] },
        { color: 'var(--oe-wb-ink)', background: 'var(--oe-wb-canvas)' },
    );
    const doc = declsFor(`${SCOPE} .oe-procedure-document`);
    assert.equal(doc.color, 'var(--oe-wb-ink)');
    assert.equal(doc.background ?? doc['background-color'], 'var(--oe-wb-paper)');
    for (const part of ['.oe-procedure-sheet', '.oe-procedure-document', '.oe-procedure-actions', '.oe-procedure-commit']) {
        assert.ok(rules().some(r => r.selectors.some(s => s.includes(part))), `no rule for ${part}`);
    }
});

// Source-only cascade model: author !important beats ordinary declarations regardless of
// specificity or order, and between !important declarations the higher specificity wins.
const THEME_DEFAULTS = 'interface/themes/theme-defaults.scss';
// [ids, classes, types] for the plain compound selectors compared here (no pseudo-classes).
const specificity = selector => [
    (selector.match(/#[\w-]+/g) || []).length,
    (selector.match(/\.[\w-]+/g) || []).length,
    (selector.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length,
];
const beats = (a, b) => {
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
};
const LONGHAND = { background: ['background-color'], 'background-color': ['background-color'], color: ['color'] };

test('cascade: the document paper pair beats the theme fieldset !important colours', () => {
    // The original competing rule, read from the real theme source every compiled theme imports.
    const block = read(THEME_DEFAULTS).match(/^fieldset \{\n[\s\S]*?\n\}/m);
    assert.notEqual(block, null, `${THEME_DEFAULTS} no longer has a top-level fieldset rule`);
    const [theme] = walkRules(parseCss(block[0]));
    const competing = theme.decls.filter(d => d.important).map(d => d.prop).sort();
    assert.deepEqual(competing, ['background-color', 'color'], 'competing theme !important set changed');

    assert.equal(count(read(ROUTE), '<fieldset class="oe-procedure-document">'), 1);
    const docRules = rules().filter(r => r.selectors.includes(DOC_SELECTOR));
    const important = docRules.flatMap(r => r.decls.filter(d => d.important).map(d => ({ prop: d.prop, value: d.value })));
    assert.deepEqual(
        important.sort((a, b) => a.prop.localeCompare(b.prop)),
        [{ prop: 'background', value: 'var(--oe-wb-paper)' }, { prop: 'color', value: 'var(--oe-wb-ink)' }],
        'document paper pair must be exactly color/background !important',
    );
    for (const prop of competing) {
        const ours = important.filter(d => LONGHAND[d.prop].includes(prop));
        assert.equal(ours.length, 1, `no single !important declaration covers ${prop}`);
    }
    assert.deepEqual(specificity(DOC_SELECTOR), [0, 3, 2]);
    assert.deepEqual(specificity(theme.selectors[0]), [0, 0, 1]);
    assert.ok(beats(specificity(DOC_SELECTOR), specificity(theme.selectors[0])), `${DOC_SELECTOR} does not outrank fieldset`);
});

test('sheet: original actions wrap instead of overflowing', () => {
    const wraps = rules().filter(r => r.selectors.some(s => s.endsWith('.oe-procedure-commit'))
        && r.decls.some(d => d.prop === 'flex-wrap' && d.value === 'wrap'));
    assert.ok(wraps.length >= 1);
    assert.ok(wraps.some(r => r.media.length === 1), 'wrapping must not depend on a narrow breakpoint');
});

test('sheet: focus rings are reserved, with a separate :focus fallback before :focus-visible', () => {
    for (const target of [`${SCOPE} .oe-procedure-commit .btn`, `${SCOPE} .oe-procedure-document a`]) {
        const rest = declsFor(target);
        assert.match(rest.outline ?? '', /\btransparent\b/, `${target} reserves no ring`);
        assert.ok(rest['outline-offset'], `${target} has no ring offset`);
        const focus = indexOf(s => s === `${target}:focus`);
        const visible = indexOf(s => s === `${target}:focus-visible`);
        assert.ok(focus >= 0, `${target}:focus fallback missing`);
        assert.ok(visible >= 0, `${target}:focus-visible missing`);
        assert.ok(focus < visible, `${target}:focus must precede :focus-visible`);
        for (const index of [focus, visible]) {
            const decls = Object.fromEntries(rules()[index].decls.map(d => [d.prop, d.value]));
            assert.match(decls['outline-color'] ?? decls.outline ?? '', /var\(--oe-wb-petrol\)/);
        }
    }
});

test('docs: describes the slice without unverified fit or contrast claims', () => {
    assert.ok(exists(DOC), `${DOC} is missing`);
    const doc = read(DOC);
    for (const part of [ROUTE, SHEET, 'screen', 'restoreSession', 'CSRF']) assert.ok(doc.includes(part), `docs omit ${part}`);
    for (const suite of ['tests/clinical-ui/procedure-editor.test.cjs', 'tests/clinical-ui/procedure-editor-baseline.test.cjs']) {
        assert.ok(doc.includes(suite), `docs omit ${suite}`);
    }
    assert.doesNotMatch(doc, /\b\d+(\.\d+)?\s*:\s*1\b/);
    assert.doesNotMatch(doc, /\bWCAG\b[^\n.]*\b(pass(es)?|meets?|conform(s|ant)?|compliant)\b/i);
    assert.doesNotMatch(doc, /\b(fits?|verified)\s+(at|in|within)\s+\d+\s*px\b/i);
});
