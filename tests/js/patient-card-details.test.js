/**
 * @jest-environment jsdom
 */

// Workbench readability for the secondary dashboard cards (preferences, care plan, billing).
// Fixtures are the real production-selected templates rendered by TwigTemplateRenderTest
// with SYNTHETIC parameters; the stylesheet is the one demographics.php links.

const fs = require('fs');

const css = fs.readFileSync(require.resolve('../../interface/clinical-workspace/workspace.css'), 'utf8');
const fixtureDir = '../Tests/Isolated/Common/Twig/fixtures/render/';
const fixtures = [
    'preference-card-care-experience-populated.html',
    'preference-card-treatment-empty.html',
    'preference-card-care-experience-read-only.html',
    'preference-card-treatment-unauthorized.html',
    'care-plan-card-empty.html',
    'care-plan-card-details-populated.html',
    'billing-card-full.html',
    'billing-card-minimal.html',
].map((name) => fs.readFileSync(require.resolve(fixtureDir + name), 'utf8'));

const scope = 'body.oe-clinical-record.oe-clinical-workspace .oe-card-details';
const WORKBENCH = 'oe-clinical-record oe-clinical-workspace';

function mount(bodyClass = WORKBENCH) {
    document.head.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    document.body.className = bodyClass;
    document.body.innerHTML = fixtures.join('\n');
}

// Every style rule with the media queries it sits under.
function styleRules() {
    const out = [];
    const walk = (rules, media) => Array.from(rules).forEach((rule) => {
        if (rule.media) walk(rule.cssRules, [...media, rule.media.mediaText]);
        else if (rule.style) out.push({ rule, media });
    });
    walk(document.styleSheets[0].cssRules, []);
    return out;
}

const own = () => styleRules().filter(({ rule }) => rule.selectorText.includes('oe-card-details'));

function matches(element, selectorText) {
    return selectorText.split(',').some((sel) => {
        const s = sel.trim();
        if (/:(focus|hover)/.test(s)) return false;
        try {
            return element.matches(s);
        } catch (e) {
            // jsdom cannot parse selector lists inside :not(); those rules are not card-details rules.
            if (e.name === 'SyntaxError' && !s.includes('oe-card-details')) return false;
            throw e;
        }
    });
}

function declared(element, property) {
    return own()
        .filter(({ rule }) => rule.style.getPropertyValue(property) !== '')
        .filter(({ rule }) => matches(element, rule.selectorText))
        .map(({ rule, media }) => ({
            value: rule.style.getPropertyValue(property),
            priority: rule.style.getPropertyPriority(property),
            media,
        }));
}

const values = (element, property) => declared(element, property).map((d) => d.value);
const rem = (value) => parseFloat(value);
// Palette from the stylesheet's own :root tokens, so the contrast check follows real values.
const tokens = Object.fromEntries(Array.from(css.matchAll(/(--oe-[a-z-]+):\s*(#[0-9a-f]{3,6})\s*;/gi), (m) => [m[1], m[2]]));
const resolve = (value) => {
    const name = /^var\((--oe-[a-z-]+)\)$/.exec(value);
    const hex = name ? tokens[name[1]] : value;
    expect(hex).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    return hex.toLowerCase();
};
const rgb = (hex) => {
    const h = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const luminance = (hex) => {
    const [r, g, b] = rgb(hex).map((c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};
const q = (selector) => {
    const element = document.querySelector(selector);
    expect(element).not.toBeNull();
    return element;
};

describe('patient dashboard secondary card details', () => {
    beforeEach(() => mount());

    test('hooks are present on every fixture body and only there', () => {
        expect(document.querySelectorAll('.oe-card-details')).toHaveLength(10);
        document.querySelectorAll('.oe-card-details').forEach((hook) => {
            expect(hook.closest('.card-text.collapse')).not.toBeNull();
        });
        expect(document.querySelectorAll('.card-title .oe-card-details, .card-title.oe-card-details')).toHaveLength(0);
    });

    test('every card-details rule is screen-only and scoped to the record workbench', () => {
        const rules = own();
        expect(rules.length).toBeGreaterThan(8);
        rules.forEach(({ rule, media }) => {
            expect(media.length).toBeGreaterThan(0);
            media.forEach((m) => expect(m).toMatch(/^screen\b/));
            rule.selectorText.split(',').forEach((sel) => expect(sel.trim().startsWith(scope)).toBe(true));
        });
    });

    test('legacy record pages and other workbench pages are untouched', () => {
        ['oe-clinical-record', 'oe-clinical-workspace', 'oe-clinical-finder oe-clinical-workspace', ''].forEach((bodyClass) => {
            mount(bodyClass);
            const hit = Array.from(document.querySelectorAll('.oe-card-details, .oe-card-details *'))
                .filter((el) => own().some(({ rule }) => matches(el, rule.selectorText)));
            expect(hit).toHaveLength(0);
        });
        mount();
        expect(own().some(({ rule }) => matches(q('.oe-card-details--billing'), rule.selectorText))).toBe(true);
    });

    test('table cells and headings read at 16px without shrinking the original headings', () => {
        ['#care_experience-view td', '#card_care_plan td', '#carepref_ps_expand .oe-card-details--preference-edit textarea']
            .forEach((sel) => expect(rem(values(q(sel), 'font-size').pop())).toBe(1));
        ['#care_experience-view th', '#card_care_plan th', '#carepref_ps_expand .oe-card-details--preference-edit label']
            .forEach((sel) => expect(rem(values(q(sel), 'font-size').pop())).toBe(1));
        const cell = q('#card_care_plan td');
        expect(values(cell, 'line-height')).not.toHaveLength(0);
        expect(values(cell, 'padding')).not.toHaveLength(0);
        expect(values(cell, 'vertical-align')).toEqual(['top']);
    });

    test('billing facts pair 16px labels and values and stack on narrow screens', () => {
        const label = q('#billing_ps_expand .row .col-4');
        const value = q('#billing_ps_expand .row .col');
        expect(rem(values(label, 'font-size')[0])).toBe(1);
        expect(rem(values(value, 'font-size')[0])).toBe(1);
        expect(values(value, 'font-variant-numeric')).toEqual(['tabular-nums']);
        const stacked = declared(label, 'max-width').filter((d) => d.value === '100%');
        expect(stacked).toHaveLength(1);
        expect(stacked[0].media.join(' ')).toMatch(/^screen and \(width <= \d+px\)$/);
    });

    test('any foreground the rules set is paired with a background; only muted ink is forced', () => {
        own().forEach(({ rule }) => {
            const hasColor = rule.style.getPropertyValue('color') !== '';
            const hasBackground = rule.style.getPropertyValue('background-color') !== '';
            expect(hasColor).toBe(hasBackground);
            expect(rule.style.getPropertyPriority('background-color')).toBe('');
            // Bootstrap compiles .text-muted as `color: ... !important`; only that pairing may match it.
            const forced = rule.style.getPropertyPriority('color') === 'important';
            expect(forced).toBe(hasColor && /\.text-muted$/.test(rule.selectorText.trim()));
        });
        expect(own().some(({ rule }) => rule.style.getPropertyValue('color') !== '')).toBe(true);
    });

    test('info and success badges retain distinct semantic hues with paired readable ink', () => {
        ['.badge-info', '.badge-success'].forEach((selector) => {
            const badges = document.querySelectorAll(`.oe-card-details--preference ${selector}`);
            expect(badges.length).toBeGreaterThan(0);
            badges.forEach((el) => {
                expect(values(el, 'color')).toEqual(['#fff']);
                expect(values(el, 'background-color')).toEqual([selector === '.badge-info' ? 'var(--oe-petrol)' : '#17633b']);
            });
        });
    });

    test('gray, yellow and muted preference ink is paired with a same-hue surface at WCAG AA', () => {
        const cases = [
            ['.badge-secondary', '#fff', 'var(--oe-muted)', ''],
            ['.badge-warning', 'var(--oe-ink)', '#ffc107', ''],
            ['table .text-muted', 'var(--oe-muted)', 'var(--oe-paper)', 'important'],
        ];
        cases.forEach(([selector, ink, surface, priority]) => {
            const found = document.querySelectorAll(`.oe-card-details--preference ${selector}`);
            expect(found.length).toBeGreaterThan(0);
            found.forEach((el) => {
                expect(declared(el, 'color')).toEqual([expect.objectContaining({ value: ink, priority })]);
                expect(values(el, 'background-color')).toEqual([surface]);
                expect(contrast(resolve(ink), resolve(surface))).toBeGreaterThanOrEqual(4.5);
            });
        });
        // The gray badge stays gray and the warning badge stays yellow.
        const [r, g, b] = rgb(resolve('var(--oe-muted)'));
        expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(40);
        expect(resolve('#ffc107')).toBe('#ffc107');
    });

    test('danger badges, alerts, buttons, warning rows and form help text keep their own colors', () => {
        const semantic = document.querySelectorAll(
            '.oe-card-details .badge-danger, .oe-card-details .alert, .oe-card-details .alert-danger, .oe-card-details .alert-danger *, '
            + '.oe-card-details .text-danger, .oe-card-details .form-text, .oe-card-details .btn, .oe-card-details tr'
        );
        expect(semantic.length).toBeGreaterThan(20);
        expect(document.querySelectorAll('.oe-card-details .badge-danger')).toHaveLength(3);
        semantic.forEach((el) => {
            expect(values(el, 'color')).toEqual([]);
            expect(values(el, 'background-color')).toEqual([]);
        });
        // Outside the preference card no badge or muted text is recoloured.
        document.querySelectorAll('.oe-card-details:not(.oe-card-details--preference) :is(.badge, .text-muted)').forEach((el) => {
            expect(values(el, 'color')).toEqual([]);
        });
    });

    test('long content wraps inside the card; wide tables keep their own horizontal scroller', () => {
        const longText = Array.from(document.querySelectorAll('#care_experience-view td'))
            .find((td) => td.textContent.includes('SYNTHETIC-free-text-answer'));
        expect(values(longText, 'overflow-wrap')).toEqual(['anywhere']);
        const description = Array.from(document.querySelectorAll('#card_care_plan td'))
            .find((td) => td.textContent.includes('SYNTHETIC-description'));
        expect(values(description, 'overflow-wrap')).toEqual(['anywhere']);
        expect(values(q('#billing_ps_expand .row .col'), 'overflow-wrap')).toEqual(['anywhere']);
        document.querySelectorAll('.oe-card-details .table-responsive, .oe-card-details.table-responsive').forEach((scroller) => {
            expect(values(scroller, 'overflow')).toEqual([]);
            expect(values(scroller, 'overflow-x')).toEqual([]);
        });
        document.querySelectorAll('.oe-card-details, .oe-card-details *').forEach((el) => {
            ['overflow', 'overflow-x', 'overflow-y'].forEach((p) => expect(values(el, p)).not.toContain('hidden'));
        });
    });

    test('preference row actions sit in their table cell instead of floating out of it', () => {
        const actions = q('#care_experience-view td.float-right');
        expect(declared(actions, 'float')).toEqual([expect.objectContaining({ value: 'none', priority: 'important' })]);
        expect(values(actions, 'white-space')).toEqual(['nowrap']);
    });

    test('no control, action or details link is hidden, shrunk or disabled by the rules', () => {
        const controls = document.querySelectorAll(
            '.oe-card-details :is(input, select, textarea, button, a, form, label, .js-edit, .js-view)'
        );
        expect(controls.length).toBeGreaterThan(60);
        controls.forEach((el) => {
            expect(values(el, 'display')).toEqual([]);
            expect(values(el, 'visibility')).toEqual([]);
            expect(values(el, 'pointer-events')).toEqual([]);
            expect(values(el, 'opacity')).toEqual([]);
            values(el, 'font-size').forEach((size) => expect(rem(size)).toBeGreaterThanOrEqual(0.875));
        });
        // The edit section's inline display:none and the value-type panes stay script-controlled.
        expect(q('#care_experience-edit').getAttribute('style')).toBe('display:none;');
        expect(q('#care_experience-textValueSection').getAttribute('style')).toBe('display:none;');
    });
});
