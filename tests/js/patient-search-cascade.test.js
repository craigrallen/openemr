/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const repo = path.join(__dirname, '../..');
const cssPath = path.join(repo, 'interface/clinical-workspace/patient-search.css');
const css = () => fs.readFileSync(cssPath, 'utf8');

function selectorsAndDecls() {
    const rules = [];
    postcss.parse(css()).walkRules((rule) => {
        const decls = {};
        rule.walkDecls((d) => { decls[d.prop] = d.value; });
        for (const selector of rule.selectors) rules.push({ selector, decls, rule });
    });
    return rules;
}

function build(html) {
    document.body.innerHTML = '';
    document.documentElement.classList.add('oe-workbench-popup');
    document.body.className = 'oe-patient-search';
    document.body.innerHTML = html;
}

afterEach(() => {
    document.documentElement.classList.remove('oe-workbench-popup');
});

describe('patient-search.css popup controls: native/Bootstrap validation state is never overridden', () => {
    const rules = selectorsAndDecls();
    const neutralOrFocusSelectors = rules
        .map((r) => r.selector)
        .filter((s) => s.includes('.oe-search-controls') && (s.includes('select') || s.includes('input')) && !s.includes(':disabled') && !s.includes('[readonly]'));

    test('a plain, unvalidated control matches the neutral surface and focus selectors', () => {
        build('<div class="oe-search-controls"><input id="plain" class="form-control"></div>');
        const el = document.getElementById('plain');
        expect(neutralOrFocusSelectors.some((s) => el.matches(s.replace(/:focus$/, '')))).toBe(true);
    });

    test('an is-invalid control matches none of them, so Bootstrap keeps its own red ring/icon', () => {
        build('<div class="oe-search-controls"><input id="bad" class="form-control is-invalid"></div>');
        const el = document.getElementById('bad');
        for (const selector of neutralOrFocusSelectors) {
            expect(el.matches(selector.replace(/:focus$/, ''))).toBe(false);
        }
    });

    test('an is-valid control matches none of them, so Bootstrap keeps its own green ring/icon', () => {
        build('<div class="oe-search-controls"><input id="good" class="form-control is-valid"></div>');
        const el = document.getElementById('good');
        for (const selector of neutralOrFocusSelectors) {
            expect(el.matches(selector.replace(/:focus$/, ''))).toBe(false);
        }
    });

    test('any control inside a native .was-validated form matches none of them', () => {
        build('<form class="was-validated"><div class="oe-search-controls"><input id="validated" class="form-control"></div></form>');
        const el = document.getElementById('validated');
        for (const selector of neutralOrFocusSelectors) {
            expect(el.matches(selector.replace(/:focus$/, ''))).toBe(false);
        }
    });

    test('disabled and readonly controls still get the workbench disabled palette, not hardcoded colours', () => {
        build(`<div class="oe-search-controls">
            <input id="dis" class="form-control" disabled>
            <input id="ro" class="form-control" readonly>
        </div>`);
        const disabledSelectors = rules.filter((r) => r.selector.includes(':disabled') || r.selector.includes('[readonly]'));
        expect(disabledSelectors.length).toBeGreaterThan(0);
        for (const { selector, decls } of disabledSelectors) {
            const matches = document.getElementById('dis').matches(selector) || document.getElementById('ro').matches(selector);
            if (matches) {
                expect(decls.color).toBe('var(--oe-wb-disabled-ink)');
                expect(decls.background).toBe('var(--oe-wb-disabled-paper)');
                expect(Object.values(decls).join(' ')).not.toMatch(/#[0-9a-f]{3,6}\b/i);
            }
        }
    });
});

describe('patient-search.css never repaints alerts, billing or legacy/print rendering', () => {
    test('no selector in the file targets billing, alert or search-status elements', () => {
        for (const { selector } of selectorsAndDecls()) {
            expect(selector).not.toMatch(/\.billing\b/);
            expect(selector).not.toMatch(/\.alert-/);
            expect(selector).not.toMatch(/#searchstatus\b/);
        }
    });

    test('the toolbar and footer wrappers are layout-only: no colour/background repaint that could fight existing dark text', () => {
        const layoutOnly = ['.oe-search-toolbar', '.oe-search-footer'];
        for (const { selector, decls } of selectorsAndDecls()) {
            if (layoutOnly.some((cls) => selector.endsWith(cls))) {
                expect(decls.color).toBeUndefined();
                expect(decls.background).toBeUndefined();
                expect(decls['background-color']).toBeUndefined();
            }
        }
    });

    test('every rule lives under @media screen (or a screen-scoped width query); none applies to print', () => {
        postcss.parse(css()).walkRules((rule) => {
            let parent = rule.parent;
            let screen = false;
            while (parent && parent.type !== 'root') {
                if (parent.type === 'atrule' && parent.name === 'media' && /^screen\b/.test(parent.params)) screen = true;
                parent = parent.parent;
            }
            expect(screen).toBe(true);
        });
        expect(css()).not.toMatch(/@media print/);
        expect(css()).not.toMatch(/display:\s*none|visibility:\s*hidden/);
    });
});
