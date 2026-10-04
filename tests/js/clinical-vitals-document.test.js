/**
 * @jest-environment jsdom
 */
/* global __dirname */

// Vitals as a document/table in the workbench. The production change is markup-only
// (body class, named scroll region, mode.js) plus screen-only CSS appended to vitals.css,
// so these tests pin that everything else in the template and stylesheet is unchanged.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const postcss = require('postcss');
const { createModeController } = require('../../interface/clinical-workspace/mode.js');

const root = path.join(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

const TEMPLATE = 'interface/forms/vitals/templates/vitals/vitals.html.twig';
const HISTORY = 'interface/forms/vitals/templates/vitals/vitals_historical_values_complete.html.twig';
const CSS = 'interface/forms/vitals/vitals.css';
// Rendered by the native Twig test VitalsDocumentTemplateTest from the real template.
const FIXTURE = 'tests/Tests/Isolated/Forms/Vitals/fixtures/vitals-form-document.html';

// sha256 of the files at master ba11545, before this change.
const ORIGINAL = {
    template: 'f80b7a9140ea7c4342b89fded9e5a5aa198cd9586a3d338f622990cb20853277',
    history: '48c9c41df89df53612ef37c24544238c2aac13b6a1557c8a6f73067cedd13c37',
    css: 'd3b596fc535636da92b90579a08eb6ec5d44427891bb0337756119d6c1cd09ce',
    modeJs: '10736b36a4ad44ae3dd0c7a519708bf5957c2d53b88dd2057ec8e791f61f2599'
};

// Bumped from -vitals-document-1 when the observation-date rule was added after the first published head.
const VERSION = "{{ (assetVersion ~ '-vitals-document-2')|attr_url }}";
const SCOPE = 'body.oe-clinical-vitals.oe-clinical-workspace';
const CSS_MARKER = '/* Workbench document presentation';

// Each [candidate, original] pair is the whole of the allowed template change.
const TEMPLATE_EDITS = [
    [
        `<link rel="stylesheet" href="{{ FORM_ACTION|attr }}/interface/forms/vitals/vitals.css?v=${VERSION}" />\n`
            + `<script src="{{ FORM_ACTION|attr }}/interface/clinical-workspace/mode.js?v=${VERSION}" defer></script>\n`,
        '<link rel="stylesheet" href="{{ FORM_ACTION|attr }}/interface/forms/vitals/vitals.css?v={{ assetVersion|attr_url }}" />\n'
    ],
    ['<body class="oe-clinical-vitals">\n', '<body>\n'],
    [
        '<div class="table-responsive" id="vitals-measurements" role="region" aria-label="{{ \'Vitals\'|xla }}" tabindex="0">',
        '<div class="table-responsive">'
    ]
];
const HISTORY_EDITS = [[
    '<div class="table-responsive" id="vitals-history-measurements" role="region" aria-label="{{ \'Vitals History\'|xla }}" tabindex="0">',
    '<div class="table-responsive">'
]];

function revert(text, edits) {
    return edits.reduce((out, [candidate, original]) => {
        expect(out.split(candidate)).toHaveLength(2);
        return out.replace(candidate, original);
    }, text);
}

function splitCss() {
    const css = read(CSS);
    const at = css.indexOf(CSS_MARKER);
    expect(at).toBeGreaterThan(0);
    return { legacy: css.slice(0, at), added: css.slice(at) };
}

describe('vitals template source preservation', () => {
    test('the only template changes are the asset tags, body class and named scroll region', () => {
        expect(sha256(revert(read(TEMPLATE), TEMPLATE_EDITS))).toBe(ORIGINAL.template);
    });

    test('the history table only gains its named scroll region', () => {
        expect(sha256(revert(read(HISTORY), HISTORY_EDITS))).toBe(ORIGINAL.history);
    });

    test('mode.js is reused unchanged and the shared workspace.css is not loaded', () => {
        expect(sha256(read('interface/clinical-workspace/mode.js'))).toBe(ORIGINAL.modeJs);
        expect(read(TEMPLATE)).not.toContain('workspace.css');
    });

    test('changed vitals.css and newly loaded mode.js carry an explicit version token; vitals.js keeps its own', () => {
        const source = read(TEMPLATE);
        expect(source).toContain(`vitals.css?v=${VERSION}`);
        expect(source).toContain(`mode.js?v=${VERSION}" defer`);
        expect(source).toContain('vitals.js?v={{ assetVersion|attr_url }}');
    });
});

describe('vitals.css document presentation', () => {
    test('original stylesheet rules are byte-for-byte unchanged ahead of the appended block', () => {
        expect(sha256(splitCss().legacy.replace(/\n$/, ''))).toBe(ORIGINAL.css);
    });

    const addedRoot = () => postcss.parse(splitCss().added);

    test('every appended rule is screen-only and scoped to the workbench vitals body', () => {
        const added = addedRoot();
        added.each((node) => {
            if (node.type === 'comment') return;
            expect(node.type).toBe('atrule');
            expect(node.name).toBe('media');
            expect(node.params).toMatch(/^screen\b/);
        });
        let rules = 0;
        added.walkRules((rule) => {
            rules++;
            rule.selectors.forEach((selector) => expect(selector.startsWith(SCOPE)).toBe(true));
        });
        expect(rules).toBeGreaterThan(5);
        added.walkAtRules((rule) => expect(rule.params).not.toMatch(/print/));
    });

    test('nothing appended hides controls, shrinks text below 14px or overrides validation highlights', () => {
        const added = addedRoot();
        added.walkDecls((decl) => {
            expect(decl.important === true).toBe(false);
            expect(`${decl.prop}: ${decl.value}`).not.toMatch(/^(display: none|visibility: hidden|opacity: 0)$/);
            expect(decl.prop).not.toMatch(/^(clip|clip-path)$/);
            if (decl.prop === 'font-size') {
                const px = decl.value.endsWith('rem') ? parseFloat(decl.value) * 16 : parseFloat(decl.value);
                expect(px).toBeGreaterThanOrEqual(14);
            }
        });
        added.walkRules((rule) => {
            expect(rule.selector).not.toMatch(/\.(error|warning|readonly|hide|d-none|editonly)\b/);
            // The one allowed warning rule is the colour pair tested below; nothing else touches it.
            if (/vitals-warning-message/.test(rule.selector)) {
                expect(rule.selector).toBe(`${SCOPE} .vitals-warning-message`);
            }
            // Validation borders come from the legacy .error/.warning rules; never repaint control borders.
            if (/(input|select|textarea|form-control)/.test(rule.selector)) {
                rule.walkDecls((decl) => expect(decl.prop).not.toMatch(/^border/));
            }
        });
    });

    test('surfaces given ink text also get the paper background, so dark themes cannot leave ink on black', () => {
        // The compiled dark theme paints .card #000 and gives .table light text; the sheet
        // must re-pair both the history card and the expanded reason cards.
        const decls = {};
        addedRoot().walkRules((rule) => rule.selectors.forEach((selector) => {
            rule.walkDecls((decl) => { decls[`${selector} | ${decl.prop}`] = decl.value; });
        }));
        [`${SCOPE} .card`, `${SCOPE} .card-header`, `${SCOPE} .card-body`].forEach((surface) => {
            expect([surface, decls[`${surface} | background`]]).toEqual([surface, 'var(--oe-paper)']);
            expect([surface, decls[`${surface} | color`]]).toEqual([surface, 'var(--oe-ink)']);
        });
        // Semantic surfaces keep their own theme pairs.
        addedRoot().walkRules((rule) => {
            expect(rule.selector).not.toMatch(/\.(alert[\w-]*|unfocus|valuesunfocus)\b/);
        });
    });

    test('warning messages get a readable colour pair on the white sheet, nothing else', () => {
        // Themes colour .vitals-warning-message var(--warning) (#ffc107): 12.88:1 on the dark
        // theme's black page but 1.63:1 on the white sheet. Pair it with its own background;
        // visibility, size, text and borders stay as the legacy rule sets them.
        const rules = [];
        addedRoot().walkRules((rule) => {
            if (rule.selector === `${SCOPE} .vitals-warning-message`) rules.push(rule);
        });
        expect(rules).toHaveLength(1);
        const decls = {};
        rules[0].walkDecls((decl) => { decls[decl.prop] = decl.value; });
        expect(Object.keys(decls).sort()).toEqual(['background-color', 'color']);
        const tokens = {};
        addedRoot().walkRules((rule) => {
            if (rule.selector === SCOPE) rule.walkDecls((decl) => { tokens[decl.prop] = decl.value; });
        });
        const resolve = (value) => (value.match(/^var\((--[\w-]+)\)$/) ? tokens[value.slice(4, -1)] : value);
        const lum = (hex) => {
            const [r, g, b] = hex.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i).slice(1).map((h) => parseInt(h, 16) / 255)
                .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const [fg, bg] = [lum(resolve(decls.color)), lum(resolve(decls['background-color']))];
        expect((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)).toBeGreaterThanOrEqual(4.5);
    });

    test('narrow geometry: container keeps the 15px Bootstrap gutter and the heading column fits its text', () => {
        // The date row is a .row (-15px margins) inside .no-gutters columns, and #chart has an inline
        // -15px margin; both rely on the container's 15px padding. Native Chrome measured a 3px page
        // overflow at 390/320px when the padding dropped to 12px, and "Vitals" plus its &nbsp;s
        // outgrows a one-third column at 320px.
        const decls = {};
        addedRoot().walkRules((rule) => rule.selectors.forEach((selector) => {
            rule.walkDecls((decl) => { decls[`${selector} | ${decl.prop}`] = decl.value; });
        }));
        const padding = decls[`${SCOPE} > .container | padding-inline`];
        expect(padding).toMatch(/^clamp\(/);
        expect(padding.match(/^clamp\(\s*([^,]+),/)[1].trim()).toBe('15px');
        expect(decls[`${SCOPE} .container > .row > .col-4 | flex`]).toBe('0 0 auto');
        expect(decls[`${SCOPE} .container > .row > .col-4 | max-width`]).toBe('100%');
    });

    test('observation date: complete YYYY-MM-DD HH:mm width and a paired readable colour, focused or not', () => {
        // The legacy size='14' input clips the 16-character value in the auto-width column, and the
        // dark theme draws its #dee2e6 text on .oe-patient-background's white (!important): 1.3:1.
        // Only colour, background and a minimum inline size are set; the theme's white !important
        // background, borders (validation highlights), font size, padding and markup are untouched.
        const rules = {};
        addedRoot().walkRules((rule) => {
            if (/#date\b/.test(rule.selector)) rules[rule.selectors.join(', ')] = rule;
        });
        expect(Object.keys(rules)).toEqual([`${SCOPE} #date, ${SCOPE} #date:focus`]);
        const rule = Object.values(rules)[0];
        expect(rule.parent.type).toBe('atrule');
        expect(rule.parent.params).toMatch(/^screen\b/);
        const decls = {};
        rule.walkDecls((decl) => {
            expect(decl.important === true).toBe(false);
            decls[decl.prop] = decl.value;
        });
        expect(Object.keys(decls).sort()).toEqual(['background-color', 'color', 'min-inline-size']);
        expect(decls.color).toBe('var(--oe-ink)');
        expect(decls['background-color']).toBe('var(--oe-paper)');
        // 16ch (digit advance) covers the 16 characters; plus Bootstrap's 0.75rem padding each side and 1px borders.
        expect(decls['min-inline-size']).toBe('calc(16ch + 1.5rem + 2px)');
        const tokens = {};
        addedRoot().walkRules((r) => {
            if (r.selector === SCOPE) r.walkDecls((decl) => { tokens[decl.prop] = decl.value; });
        });
        const lum = (hex) => {
            const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
            const [r, g, b] = full.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i).slice(1).map((h) => parseInt(h, 16) / 255)
                .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        // The theme forces white behind the date (.oe-patient-background); ink must read on white and on paper.
        const ink = lum(tokens['--oe-ink']);
        [tokens['--oe-paper'], '#ffffff'].forEach((bg) => {
            const b = lum(bg);
            expect((Math.max(ink, b) + 0.05) / (Math.min(ink, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
        });
    });

    test('paper document: Arial 14px base, 28px heading, petrol Save and focus, scrollable named region', () => {
        const decls = {};
        addedRoot().walkRules((rule) => rule.selectors.forEach((selector) => {
            rule.walkDecls((decl) => { decls[`${selector} | ${decl.prop}`] = decl.value; });
        }));
        expect(decls[`${SCOPE} | font-family`]).toMatch(/^Arial\b/);
        expect(decls[`${SCOPE} | font-size`]).toBe('14px');
        expect(decls[`${SCOPE} | background`]).toBe('var(--oe-paper)');
        expect(decls[`${SCOPE} .container > .row > .col-4 > h2 | font-size`]).toBe('28px');
        expect(decls[`${SCOPE} .btn-save | background`]).toBe('var(--oe-petrol)');
        expect(decls[`${SCOPE} :focus-visible | outline`]).toBe('2px solid var(--oe-petrol)');
        expect(decls[`${SCOPE} #vitals-measurements | overflow-x`]).toBe('auto');
        expect(decls[`${SCOPE} #vitals-history-measurements | overflow-x`]).toBe('auto');
    });
});

describe('rendered vitals form in and out of the workbench', () => {
    const loadFixture = () => {
        const html = read(FIXTURE);
        document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html>/, '').replace(/<\/html>\s*$/, '');
        const body = html.match(/<body([^>]*)>/);
        expect(body).not.toBeNull();
        document.body.className = (body[1].match(/class="([^"]*)"/) || [])[1] || '';
        // The inline scripts need jQuery and the app runtime; this checks presentation state only.
        document.querySelectorAll('script').forEach((node) => node.remove());
    };
    const controls = () => Array.from(document.querySelectorAll('#vitalsForm input, #vitalsForm select, #vitalsForm textarea, #vitalsForm button'));
    const snapshot = () => controls().map((node) => [node.tagName, node.type, node.name, node.id, node.value]);

    beforeEach(() => {
        loadFixture();
    });

    test('the rendered page opts into the route class and starts in legacy presentation', () => {
        expect(document.body.classList.contains('oe-clinical-vitals')).toBe(true);
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);
    });

    test('mode changes keep every control, value and node identity', () => {
        const before = controls();
        const values = snapshot();
        expect(values.length).toBeGreaterThan(20);
        const byName = (name) => document.querySelector(`#vitalsForm [name="${name}"]`);
        expect(byName('csrf_token_form').value).toBe('test-csrf-token');
        expect(byName('bps').value).toBe('128');

        // Standalone (no workbench ancestor): stays legacy.
        const standalone = createModeController({ body: document.body, parentWindow: null, origin: 'http://localhost', observe: () => null });
        expect(standalone.active).toBe(false);
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);

        const workbench = createModeController({ body: document.body, mode: 'workbench' });
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(true);
        byName('bps').value = '131';
        workbench.dispose();
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);

        const after = controls();
        expect(after).toHaveLength(before.length);
        after.forEach((node, i) => expect(node).toBe(before[i]));
        expect(snapshot()).toEqual(values.map((row) => (row[2] === 'bps' ? [...row.slice(0, 4), '131'] : row)));
    });

    test('measurement and history tables sit in named keyboard-focusable scroll regions', () => {
        [['vitals-measurements', 'Vitals'], ['vitals-history-measurements', 'Vitals History']].forEach(([id, name]) => {
            const region = document.getElementById(id);
            expect(region).not.toBeNull();
            expect(region.classList.contains('table-responsive')).toBe(true);
            expect(region.getAttribute('role')).toBe('region');
            expect(region.getAttribute('aria-label')).toBe(name);
            expect(region.tabIndex).toBe(0);
            expect(region.querySelector('table')).not.toBeNull();
        });
        expect(document.querySelector('#vitals-measurements').closest('form').id).toBe('vitalsForm');
    });

    test('the observation date control keeps its original attributes and value', () => {
        const date = document.getElementById('date');
        expect(date).not.toBeNull();
        expect(date.closest('form').id).toBe('vitalsForm');
        expect(document.querySelectorAll('#vitalsForm [name="date"]')).toHaveLength(1);
        expect([date.tagName, date.getAttribute('type'), date.getAttribute('size'), date.getAttribute('name'),
            date.getAttribute('title'), date.className, date.value]).toEqual(['INPUT', 'text', '14', 'date',
            'Date and time of this observation', 'form-control datetimepicker oe-patient-background', '2026-10-01 09:30']);
        expect(date.value).toHaveLength(16);
        expect(document.querySelector('label[for="date"]')).not.toBeNull();
    });

    test('heading, save, cancel, growth chart and history link contracts are present', () => {
        const save = document.querySelector('button.btn-save[type="submit"][name="Submit"]');
        expect(save).not.toBeNull();
        expect(document.querySelector('#cancel.btn-cancel[type="button"]')).not.toBeNull();
        expect(document.querySelector('#pdfchart')).not.toBeNull();
        expect(document.querySelector('#htmlchart')).not.toBeNull();
        expect(document.querySelector('a[href="#patient-vitals-history"]')).not.toBeNull();
        const form = document.getElementById('vitalsForm');
        expect(form.getAttribute('method')).toBe('post');
        expect(form.getAttribute('action')).toBe('/openemr/interface/forms/vitals/save.php');
    });
});
