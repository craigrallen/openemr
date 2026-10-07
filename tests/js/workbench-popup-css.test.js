/** @jest-environment node */
// Static contract for the shared popup stylesheet and its Header registration.
// Contrast here is computed from the declared token values only; it is not a
// substitute for rendering the popup in a real browser.
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const yaml = require('js-yaml');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '../..');
const cssPath = path.join(root, 'interface/clinical-workspace/popup.css');
const SCOPES = ['html.oe-workbench-context', 'html.oe-workbench-popup', 'body.workbench-active > .dialogModal', 'body.workbench-active > .modal-backdrop'];
const FORBIDDEN_TARGETS = /(^|\s|>)(h[1-6]|table|th|td|\.text-danger|\.btn-danger|\.alert-danger|\.invalid-feedback|\.is-invalid)$/;

let ast;
beforeAll(() => {
    ast = postcss.parse(fs.readFileSync(cssPath, 'utf8'));
});

function rules() {
    const out = [];
    ast.walkRules((rule) => out.push(rule));
    return out;
}

function tokens() {
    const map = {};
    ast.walkDecls(/^--oe-wb-/, (decl) => { map[decl.prop] = decl.value.trim(); });
    return map;
}

function resolve(value, map) {
    const match = value.match(/var\((--oe-wb-[a-z-]+)\)/);
    return match ? map[match[1]] : value.trim();
}

function luminance(hex) {
    const full = hex.length === 4 ? '#' + [...hex.slice(1)].map((c) => c + c).join('') : hex;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

function pairFor(fragment) {
    const map = tokens();
    // Semantic :not() guards narrow a rule without changing which surface it paints.
    const rule = rules().find((r) => r.selectors.some((s) => s.replace(/:not\([^()]*\)/g, '').endsWith(fragment)));
    if (!rule) return null;
    const decls = {};
    rule.walkDecls((d) => { decls[d.prop] = resolve(d.value.replace(/\s*!important/, ''), map); });
    return { fg: decls.color, bg: decls['background-color'] || decls.background };
}

describe('popup stylesheet contract', () => {
    test('is registered once as an autoloaded, cache-versioned Header asset', () => {
        const config = yaml.load(fs.readFileSync(path.join(root, 'config/config.yaml'), 'utf8'));
        const entries = Object.entries(config.assets).filter(([, a]) => a.basePath === '%webroot%/interface/clinical-workspace/');
        expect(entries).toHaveLength(1);
        const [, asset] = entries[0];
        expect(asset).toMatchObject({ script: 'popup.js', link: 'popup.css', autoload: true });
        // alreadyBuilt would suppress the ?v=v_js_includes cache buster in Header::createElement.
        expect(asset.alreadyBuilt).toBeUndefined();
    });

    test('is screen-only so print and print preview keep the legacy rendering', () => {
        const topLevel = ast.nodes.filter((n) => n.type !== 'comment');
        expect(topLevel.length).toBeGreaterThan(0);
        topLevel.forEach((node) => {
            expect(node.type).toBe('atrule');
            expect(`${node.name} ${node.params}`).toBe('media screen');
        });
    });

    test('every selector is scoped to a positive workbench context', () => {
        rules().forEach((rule) => rule.selectors.forEach((selector) => {
            expect(SCOPES.some((scope) => selector.startsWith(scope))).toBe(true);
        }));
    });

    test('does not repaint global headings, tables or semantic danger states', () => {
        rules().forEach((rule) => rule.selectors.forEach((selector) => {
            expect(selector).not.toMatch(FORBIDDEN_TARGETS);
        }));
    });

    test('never hides controls or overrides Bootstrap modal mechanics', () => {
        ast.walkDecls((decl) => {
            const value = decl.value.replace(/\s*!important/, '').trim();
            expect(`${decl.prop}: ${value}`).not.toMatch(/^(display: none|visibility: hidden|opacity: 0|pointer-events: none)$/);
            expect(['position', 'z-index', 'transform', 'transition']).not.toContain(decl.prop);
        });
    });

    test('tokens are explicit values usable outside #mainBox', () => {
        const map = tokens();
        expect(Object.keys(map)).toEqual(expect.arrayContaining(['--oe-wb-ink', '--oe-wb-paper', '--oe-wb-petrol', '--oe-wb-line', '--oe-wb-muted']));
        Object.values(map).forEach((value) => expect(value).toMatch(/^#[0-9a-f]{3,6}$/i));
        const tokenRule = rules().find((r) => r.some((n) => n.prop === '--oe-wb-ink'));
        expect(tokenRule.selectors).toEqual(expect.arrayContaining(['html.oe-workbench-context', 'body.workbench-active > .dialogModal']));
    });

    test.each([
        ['popup paper body', 'html.oe-workbench-popup body'],
        ['dialog frame content', '.modal-content'],
        ['dialog header', '.modal-header'],
        ['dialog close control', '.modal-header .close'],
        ['form controls', '.form-control'],
        ['disabled controls', '.form-control:disabled'],
        ['datepicker overlay', '.xdsoft_datetimepicker'],
        ['select2 overlay', '.select2-dropdown'],
        ['primary button', '.btn-primary'],
        ['warning notice', '.alert-warning'],
    ])('%s pairs ink and background with at least 4.5:1 contrast', (_label, fragment) => {
        const pair = pairFor(fragment);
        expect(pair).not.toBeNull();
        expect(pair.fg).toMatch(/^#/);
        expect(pair.bg).toMatch(/^#/);
        expect(contrast(pair.fg, pair.bg)).toBeGreaterThanOrEqual(4.5);
    });
});

// Selector matching runs in jsdom against real elements; native cascade and Bootstrap's
// !important utilities are verified separately in a browser.
describe('popup stylesheet leaves semantic utility colours alone', () => {
    const PAINT = ['color', 'background', 'background-color', 'border-color'];

    function paintingSelectors() {
        return rules()
            .filter((rule) => rule.some((n) => n.type === 'decl' && PAINT.includes(n.prop)))
            .flatMap((rule) => rule.selectors);
    }

    function popupDocument(body) {
        const { window } = new JSDOM(`<html class="oe-workbench-context oe-workbench-popup"><body>${body}</body></html>`);
        return window.document;
    }

    const matching = (el) => paintingSelectors().filter((selector) => el.matches(selector));

    test.each([
        ['danger card header', '<div class="card"><div class="card-header bg-danger text-white" id="t">x</div></div>'],
        ['header inside a danger card', '<div class="card bg-danger text-white"><div class="card-header" id="t">x</div></div>'],
        ['danger card', '<div class="card bg-danger text-white" id="t"></div>'],
        ['semantic title', '<div class="title text-white bg-danger" id="t">x</div>'],
        ['warning title', '<span class="title text-warning" id="t">x</span>'],
        ['danger legend', '<fieldset><legend class="bg-danger text-white" id="t">x</legend></fieldset>'],
    ])('%s is not repainted', (_label, body) => {
        const el = popupDocument(body).getElementById('t');
        expect(matching(el)).toEqual([]);
    });

    // Every explicit bg-* palette class, including legacy custom ones, marks a header
    // whose colours carry meaning; neither it nor its close control is repainted.
    test.each([
        'bg-danger text-white',
        'bg-warning',
        'bg-success text-white',
        'bg-info',
        'bg-primary text-white',
        'bg-secondary',
        'bg-dark text-white',
        'bg-light',
        'bg-legacy-custom',
    ])('modal header with "%s" keeps its palette in content and shell dialogs', (palette) => {
        const header = `<div class="modal-content"><div class="modal-header ${palette}" id="t"><button class="close" id="x">x</button></div></div>`;
        const docs = [
            popupDocument(`<div class="modal">${header}</div>`),
            new JSDOM(`<html><body class="workbench-active"><div class="dialogModal">${header}</div></body></html>`).window.document,
        ];
        docs.forEach((doc) => {
            expect(matching(doc.getElementById('t'))).toEqual([]);
            expect(matching(doc.getElementById('x'))).toEqual([]);
        });
    });

    test('plain modal headers still take the workbench frame', () => {
        const doc = popupDocument('<div class="modal-header" id="t"><button class="close" id="x">x</button></div>');
        ['t', 'x'].forEach((id) => expect(matching(doc.getElementById(id)).length).toBeGreaterThan(0));
    });

    test('plain cards, headers and titles still take the workbench frame', () => {
        const doc = popupDocument('<div class="card" id="c"><div class="card-header" id="h">x</div></div><div class="title" id="t">x</div>');
        ['c', 'h', 't'].forEach((id) => expect(matching(doc.getElementById(id)).length).toBeGreaterThan(0));
    });

    test('a class merely containing "text-" or "bg-" mid-word is not treated as semantic', () => {
        const doc = popupDocument('<div class="card context-menu"><div class="card-header" id="h">x</div></div>');
        expect(matching(doc.getElementById('h')).length).toBeGreaterThan(0);
    });
});

// Bootstrap draws validation as a border colour; any scoped border colour that reaches
// a validated control (plain or focused) would replace that cue with a neutral one.
describe('popup stylesheet leaves validation borders alone', () => {
    const BORDER_COLOUR = /^border(-(top|right|bottom|left))?(-color)?$/;

    function borderSelectors() {
        return rules()
            .filter((rule) => rule.some((n) => n.type === 'decl' && BORDER_COLOUR.test(n.prop)
                && (n.prop.endsWith('-color') || /#|var\(|rgb/.test(n.value))))
            .flatMap((rule) => rule.selectors);
    }

    const CONTROLS = [
        '<input class="form-control" id="t">',
        '<input id="t">',
        '<input type="text" class="form-control" id="t">',
        '<input type="search" id="t">',
        '<input type="number" id="t">',
        '<input type="date" id="t">',
        '<select class="form-control" id="t"><option value="">-</option></select>',
        '<textarea class="form-control" id="t"></textarea>',
    ];

    function validated(control, state) {
        const markup = state === 'was-validated'
            ? `<form class="was-validated">${control.replace('id="t"', 'id="t" required')}</form>`
            : control.replace(/(class="[^"]*)"/, `$1 ${state}"`).replace(/^<(\w+)(?![^>]*class=)/, `<$1 class="${state}"`);
        const { window } = new JSDOM(`<html class="oe-workbench-context oe-workbench-popup"><body>${markup}</body></html>`);
        return window.document.getElementById('t');
    }

    const cases = CONTROLS.flatMap((control) => ['is-invalid', 'is-valid', 'was-validated']
        .flatMap((state) => [[state, control, false], [state, control, true]]));

    test.each(cases)('%s %s (focused: %s) keeps the Bootstrap validation border', (state, control, focused) => {
        const el = validated(control, state);
        if (state === 'was-validated') expect(el.matches(':invalid')).toBe(true);
        else expect(el.classList.contains(state)).toBe(true);
        if (focused) {
            el.focus();
            expect(el.matches(':focus')).toBe(true);
        }
        expect(borderSelectors().filter((selector) => el.matches(selector))).toEqual([]);
    });

    test('a valid control inside .was-validated keeps its border too', () => {
        const { window } = new JSDOM('<html class="oe-workbench-popup"><body><form class="was-validated"><input class="form-control" value="x" required id="t"></form></body></html>');
        const el = window.document.getElementById('t');
        expect(el.matches(':valid')).toBe(true);
        el.focus();
        expect(borderSelectors().filter((selector) => el.matches(selector))).toEqual([]);
    });
});

// Native dark-theme run: Bootstrap's `.table { color: $table-color }` ($body-color) beats the
// colour the body passes down, so once the popup body is repainted to paper the cell keeps
// the theme's near-white text (rgb(248,249,250) on #fff, 1.05:1). Popup.css therefore has to
// pair ink and paper at table level, without reaching semantic table/row/cell colours.
describe('popup stylesheet pairs neutral table text with its own paper', () => {
    const SEMANTIC_ROWS = ['table-warning', 'table-danger', 'table-success', 'table-info', 'table-active', 'bg-warning', 'bg-legacy-custom', 'text-white'];

    // The dark theme's table text is its $body-color, taken from the theme source itself.
    function darkThemeTableColour() {
        const scss = fs.readFileSync(path.join(root, 'interface/themes/oe-styles/style_dark.scss'), 'utf8');
        const vars = Object.fromEntries([...scss.matchAll(/^\$([\w-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]));
        let value = vars['body-color'];
        while (value && value.startsWith('$')) value = vars[value.slice(1)];
        return value;
    }

    function popupDocument(body) {
        return new JSDOM(`<html class="oe-workbench-context oe-workbench-popup"><body>${body}</body></html>`).window.document;
    }

    function declsFor(el, prop) {
        return rules().filter((rule) => rule.selectors.some((s) => el.matches(s)))
            .flatMap((rule) => rule.nodes.filter((n) => n.type === 'decl' && n.prop === prop));
    }

    // Resolve inherited table ink as well as cell ink: Bootstrap sets dark-theme
    // colour on .table, which overrides the newly painted popup body.
    function cellInk(cell) {
        const table = cell.closest('table');
        for (let el = cell; el; el = el.parentElement) {
            const own = declsFor(el, 'color');
            if (own.length) return resolve(own[own.length - 1].value, tokens());
            if (el === table) break;
        }
        return darkThemeTableColour();
    }

    // Nearest surface popup.css paints between the cell and its table.
    function tableSurface(cell) {
        const table = cell.closest('table');
        for (let el = cell; el; el = el.parentElement) {
            const bg = declsFor(el, 'background-color');
            if (bg.length) return { el, value: resolve(bg[bg.length - 1].value, tokens()) };
            if (el === table) break;
        }
        return null;
    }

    test('the theme source really gives dark-theme tables near-white text', () => {
        expect(darkThemeTableColour().toLowerCase()).toBe('#f8f9fa');
        expect(contrast('#f8f9fa', tokens()['--oe-wb-paper'])).toBeLessThan(1.1);
    });

    test.each([
        ['bare table', '<table class="table table-sm"><tr><td id="t">x</td></tr></table>'],
        ['header cell', '<table class="table"><thead><tr><th id="t">x</th></tr></thead></table>'],
        ['striped body', '<table class="table table-striped"><tbody><tr><td id="t">x</td></tr></tbody></table>'],
        ['inside a theme-painted fieldset', '<fieldset><table class="table"><tr><td id="t">x</td></tr></table></fieldset>'],
    ])('%s: neutral cell ink sits on the table paper at >= 4.5:1', (_label, body) => {
        const cell = popupDocument(body).getElementById('t');
        const surface = tableSurface(cell);
        expect(surface).not.toBeNull();
        expect(surface.el).toBe(cell.closest('table'));
        expect(contrast(cellInk(cell), surface.value)).toBeGreaterThanOrEqual(4.5);
    });

    const semanticCases = [
        ['table-dark', '<table class="table table-dark"><tr><td id="t">x</td></tr></table>'],
        ['table-warning', '<table class="table table-warning"><tr><td id="t">x</td></tr></table>'],
        ['thead-dark', '<table class="table"><thead class="thead-dark"><tr><th id="t">x</th></tr></thead></table>'],
        ['thead-light', '<table class="table"><thead class="thead-light"><tr><th id="t">x</th></tr></thead></table>'],
        ['table with explicit palette', '<table class="table bg-danger text-white"><tr><td id="t">x</td></tr></table>'],
        ...SEMANTIC_ROWS.map((cls) => [`row ${cls}`, `<table class="table"><tr class="${cls}" id="r"><td id="t">x</td></tr></table>`]),
        ...SEMANTIC_ROWS.map((cls) => [`cell ${cls}`, `<table class="table"><tr id="r"><td class="${cls}" id="t">x</td></tr></table>`]),
    ];

    test.each(semanticCases)('%s keeps its own text and background', (_label, body) => {
        const doc = popupDocument(body);
        [doc.getElementById('t'), doc.getElementById('r'), doc.getElementById('t').parentElement.parentElement]
            .filter(Boolean)
            .forEach((el) => ['color', 'background-color', 'background'].forEach((prop) => expect(declsFor(el, prop)).toEqual([])));
        if (['table-dark', 'table-warning', 'table with explicit palette'].includes(_label)) {
            ['color', 'background-color', 'background'].forEach((prop) => expect(declsFor(doc.querySelector('table'), prop)).toEqual([]));
        }
    });

    test('table rules never use !important and never paint bare td/th', () => {
        rules().filter((rule) => rule.selectors.some((s) => /\.table\b/.test(s))).forEach((rule) => {
            rule.walkDecls((d) => expect(d.important).toBeFalsy());
            rule.selectors.forEach((s) => expect(s).not.toMatch(/(\s|>)(td|th)$/));
        });
    });
});

describe('popup typography', () => {
    test('uses the workbench shell font stack, not an uninstalled webfont', () => {
        const shell = postcss.parse(fs.readFileSync(path.join(root, 'interface/main/tabs/css/workbench_shell.css'), 'utf8'));
        const stacks = new Set();
        shell.walkDecls('font-family', (d) => { if (d.value !== 'inherit') stacks.add(d.value.trim()); });
        const popupStacks = [];
        ast.walkDecls('font-family', (d) => popupStacks.push(d.value.trim()));

        expect(popupStacks.length).toBeGreaterThan(0);
        popupStacks.forEach((stack) => {
            expect(stack).not.toMatch(/Source Sans/i);
            expect(stacks.has(stack)).toBe(true);
        });
    });
});
