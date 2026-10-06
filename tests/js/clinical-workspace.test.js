/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const { createModeController } = require('../../interface/clinical-workspace/mode.js');

describe('clinical workspace mode controller', () => {
    let parentBody;
    let observer;

    beforeEach(() => {
        document.body.className = '';
        parentBody = document.createElement('body');
        observer = null;
    });

    afterEach(() => {
        if (observer) observer.disconnect();
    });

    function mount(options = {}) {
        return createModeController({
            body: document.body,
            parentWindow: {
                location: { origin: window.location.origin },
                document: { body: parentBody }
            },
            origin: window.location.origin,
            observe: (target, callback) => {
                observer = new MutationObserver(callback);
                observer.observe(target, { attributes: true, attributeFilter: ['class'] });
                return observer;
            },
            ...options
        });
    }

    test('follows parent workbench mode and removes its class on legacy toggle', async () => {
        const controller = mount();
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);
        parentBody.classList.add('workbench-active');
        await Promise.resolve();
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(true);
        parentBody.classList.remove('workbench-active');
        await Promise.resolve();
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);
        controller.dispose();
    });

    test('leaves direct page and cross-origin parent in legacy presentation', () => {
        expect(mount({ parentWindow: window }).active).toBe(false);
        const denied = { get location() { throw new DOMException('denied', 'SecurityError'); } };
        expect(mount({ parentWindow: denied }).active).toBe(false);
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);
    });

    test('allows an explicit workbench mode prop for isolated route rendering', () => {
        const controller = mount({ parentWindow: window, mode: 'workbench' });
        expect(controller.active).toBe(true);
        controller.dispose();
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);
    });

    test('disposes observer and does not touch draft fields', async () => {
        document.body.innerHTML = '<textarea name="subjective">In progress</textarea>';
        const controller = mount();
        controller.dispose();
        parentBody.classList.add('workbench-active');
        await Promise.resolve();
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);
        expect(document.querySelector('[name="subjective"]').value).toBe('In progress');
    });

    function frame(body, parent) {
        const win = { location: { origin: window.location.origin }, document: { body } };
        win.parent = parent || win;
        return win;
    }

    function mountFrom(parentWindow) {
        const observed = [];
        const controller = mount({
            parentWindow,
            observe: (target, callback) => {
                observed.push(target);
                observer = new MutationObserver(callback);
                observer.observe(target, { attributes: true, attributeFilter: ['class'] });
                return observer;
            }
        });
        return { controller, observed };
    }

    test('follows the workbench host above an intermediate encounter frame', async () => {
        // main.php -> encounter_top.php -> load_form.php (SOAP)
        const mainBody = document.createElement('body');
        const encounterBody = document.createElement('body');
        const { controller, observed } = mountFrom(frame(encounterBody, frame(mainBody)));
        expect(observed).toEqual([mainBody]);
        mainBody.classList.add('workbench-active');
        await Promise.resolve();
        expect(controller.active).toBe(true);
        mainBody.classList.remove('workbench-active');
        await Promise.resolve();
        expect(controller.active).toBe(false);
        controller.dispose();
        expect(document.body.classList.contains('oe-clinical-workspace')).toBe(false);
    });

    test('observes the nearest ancestor that already carries workbench mode', () => {
        const mainBody = document.createElement('body');
        const encounterBody = document.createElement('body');
        encounterBody.classList.add('workbench-active');
        const { controller, observed } = mountFrom(frame(encounterBody, frame(mainBody)));
        expect(observed).toEqual([encounterBody]);
        expect(controller.active).toBe(true);
        controller.dispose();
    });

    test('stops at a cross-origin ancestor and keeps the same-origin host', () => {
        const encounterBody = document.createElement('body');
        const foreign = { get location() { throw new DOMException('denied', 'SecurityError'); } };
        const { controller, observed } = mountFrom(frame(encounterBody, foreign));
        expect(observed).toEqual([encounterBody]);
        expect(controller.active).toBe(false);
        controller.dispose();
    });

    test('terminates on cyclic and very deep ancestor chains', () => {
        const a = frame(document.createElement('body'));
        const b = frame(document.createElement('body'), a);
        a.parent = b;
        expect(mountFrom(a).observed).toHaveLength(1);
        if (observer) observer.disconnect();

        let deep = frame(document.createElement('body'));
        for (let i = 0; i < 100; i++) deep = frame(document.createElement('body'), deep);
        const { observed } = mountFrom(deep);
        expect(observed).toHaveLength(1);
    });
});

describe('clinical workspace record card colors', () => {
    const css = fs.readFileSync(require.resolve('../../interface/clinical-workspace/workspace.css'), 'utf8');

    beforeEach(() => {
        document.head.innerHTML = '';
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        document.body.className = 'oe-clinical-record oe-clinical-workspace';
    });

    function colorRulesMatching(element) {
        return Array.from(document.styleSheets[0].cssRules)
            .filter((rule) => rule.style && rule.style.color && rule.style.color !== 'inherit')
            .filter((rule) => element.matches(rule.selectorText))
            .map((rule) => rule.selectorText);
    }

    test('applies workspace ink to neutral card titles', () => {
        document.body.innerHTML = '<section class="card"><div class="card-body">'
            + '<div class="card-title">Allergies</div></div></section>';
        expect(colorRulesMatching(document.querySelector('.card-title'))).not.toHaveLength(0);
    });

    test.each(['bg-danger text-white', 'bg-warning', 'bg-success', 'bg-info', 'bg-primary', 'bg-dark'])(
        'keeps Bootstrap text color on %s alert cards',
        (classes) => {
            // Same markup as templates/patient/partials/deceased.html.twig
            document.body.innerHTML = `<section class="card ${classes}"><div class="card-body p-1">`
                + '<div class="card-title mb-0 d-flex p-1"><strong>Deceased</strong></div></div></section>';
            expect(colorRulesMatching(document.querySelector('.card-title'))).toEqual([]);
            expect(colorRulesMatching(document.querySelector('strong'))).toEqual([]);
        }
    );
});

describe('clinical workspace record card sizing', () => {
    const css = fs.readFileSync(require.resolve('../../interface/clinical-workspace/workspace.css'), 'utf8');
    // Real card_base.html.twig output, recorded by TwigTemplateRenderTest.
    const fixture = (name) => fs.readFileSync(
        require.resolve(`../Tests/Isolated/Common/Twig/fixtures/render/${name}`),
        'utf8'
    );

    beforeEach(() => {
        document.head.innerHTML = '';
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        document.body.className = 'oe-clinical-record oe-clinical-workspace';
    });

    function declared(element, property) {
        return Array.from(document.styleSheets[0].cssRules)
            .filter((rule) => rule.style && rule.style.getPropertyValue(property) !== '')
            .filter((rule) => element.matches(rule.selectorText))
            .map((rule) => rule.style.getPropertyValue(property));
    }

    test.each(['care-plan-card-empty.html', 'care-plan-card-collapsed.html'])(
        '%s sizes to its content instead of its column',
        (name) => {
            document.body.innerHTML = `<div class="row"><div class="col-12">${fixture(name)}</div></div>`;
            const card = document.querySelector('section.card');
            expect(declared(card, 'height')).not.toContain('100%');
            expect(declared(card, 'height')).toContain('auto');
            expect(declared(card, 'max-height')).toEqual([]);
            expect(declared(card, 'overflow')).toEqual([]);
        }
    );

    test('card sections get one layer of padding, from the card body only', () => {
        document.body.innerHTML = fixture('care-plan-card-collapsed.html');
        expect(declared(document.querySelector('section.card'), 'padding')).toEqual([]);
        expect(declared(document.querySelector('.card-body'), 'padding')).not.toHaveLength(0);
    });

    test('collapsed card has no header separator; the open body carries it', () => {
        document.body.innerHTML = fixture('care-plan-card-collapsed.html');
        const title = document.querySelector('.card-title');
        expect(declared(title, 'border-bottom')).toEqual([]);
        expect(declared(title, 'padding-bottom')).toEqual([]);
        expect(declared(document.querySelector('.card-text'), 'border-top')).not.toHaveLength(0);
    });

    test('legacy non-card sections keep their workspace frame', () => {
        document.body.innerHTML = '<section id="legacy">Notes</section>';
        expect(declared(document.querySelector('#legacy'), 'padding')).not.toHaveLength(0);
    });

    test('alert cards keep Bootstrap colors and are not shrunk', () => {
        document.body.innerHTML = '<section class="card bg-danger text-white"><div class="card-body p-1">'
            + '<div class="card-title mb-0 d-flex p-1"><strong>Deceased</strong></div></div></section>';
        const card = document.querySelector('section.card');
        expect(declared(card, 'background')).toEqual(['var(--oe-paper)']);
        expect(declared(card, 'max-height')).toEqual([]);
        expect(declared(card, 'display')).toEqual([]);
    });
});

describe('clinical workspace demographics facts', () => {
    const css = fs.readFileSync(require.resolve('../../interface/clinical-workspace/workspace.css'), 'utf8');
    // Real production-selected tab_base.html.twig + card_base.html.twig around layout output,
    // recorded by TwigTemplateRenderTest.
    const fixture = fs.readFileSync(
        require.resolve('../Tests/Isolated/Common/Twig/fixtures/render/demographics-card-custom-groups.html'),
        'utf8'
    );
    const scope = 'body.oe-clinical-record.oe-clinical-workspace .oe-demographics-facts';

    beforeEach(() => {
        document.head.innerHTML = '';
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        document.body.className = 'oe-clinical-record oe-clinical-workspace';
        document.body.innerHTML = fixture
            + '<section class="card"><table><tr><td class="label_custom">Other</td><td class="text data">x</td></tr></table></section>';
    });

    // Every style rule with the media queries it sits under; pseudo-classes are kept in the
    // selector but stripped for matching, since jsdom cannot focus or hover.
    function styleRules() {
        const out = [];
        const walk = (rules, media) => Array.from(rules).forEach((rule) => {
            if (rule.media) walk(rule.cssRules, [...media, rule.media.mediaText]);
            else if (rule.style) out.push({ rule, media });
        });
        walk(document.styleSheets[0].cssRules, []);
        return out;
    }

    function declared(element, property, { pseudo = '' } = {}) {
        return styleRules()
            .filter(({ rule }) => rule.style.getPropertyValue(property) !== '')
            .filter(({ rule }) => rule.selectorText.split(',').some((sel) => {
                const s = sel.trim();
                if (pseudo !== '' && !s.endsWith(pseudo)) return false;
                if (pseudo === '' && /:(focus|hover)/.test(s)) return false;
                try {
                    return element.matches(s.replace(/:(focus-visible|focus|hover)$/, ''));
                } catch (e) {
                    // jsdom cannot parse selector lists inside :not(); those rules are not demographics rules.
                    if (e.name === 'SyntaxError' && !s.includes('oe-demographics-facts')) return false;
                    throw e;
                }
            }))
            .map(({ rule, media }) => ({ value: rule.style.getPropertyValue(property), media }));
    }

    const values = (element, property, options) => declared(element, property, options).map((d) => d.value);
    const rem = (value) => parseFloat(value);

    test('every demographics rule is screen-only and scoped to the record workbench wrapper', () => {
        const own = styleRules().filter(({ rule }) => rule.selectorText.includes('oe-demographics-facts'));
        expect(own.length).toBeGreaterThan(5);
        own.forEach(({ rule, media }) => {
            expect(media.length).toBeGreaterThan(0);
            media.forEach((m) => expect(m).toMatch(/^screen\b/));
            rule.selectorText.split(',').forEach((sel) => expect(sel.trim().startsWith(scope)).toBe(true));
        });
        expect(styleRules().some(({ rule }) => /tabNav|tabContainer|label_custom/.test(rule.selectorText)
            && !rule.selectorText.includes('oe-demographics-facts'))).toBe(false);
    });

    test('labels and values form a readable, padded hierarchy', () => {
        const label = document.querySelector('#card_demographics td.label_custom');
        const value = document.querySelector('#card_demographics td.data');
        expect(rem(values(value, 'font-size')[0])).toBeGreaterThanOrEqual(1);
        expect(rem(values(label, 'font-size')[0])).toBeGreaterThanOrEqual(0.875);
        expect(rem(values(label, 'font-size')[0])).toBeLessThan(rem(values(value, 'font-size')[0]));
        expect(values(label, 'color')).toEqual(['var(--oe-muted)']);
        expect(values(value, 'color')).toEqual(['var(--oe-ink)']);
        [label, value].forEach((cell) => {
            expect(values(cell, 'padding')).not.toHaveLength(0);
            expect(values(cell, 'vertical-align')).toEqual(['top']);
            expect(values(cell, 'border-top')).not.toHaveLength(0);
        });
        // The real compiled theme marks both legacy .8rem font sizes important.
        const typography = styleRules().filter(({ rule }) => rule.style.getPropertyValue('font-size')
            && (label.matches(rule.selectorText) || value.matches(rule.selectorText)));
        typography.forEach(({ rule }) => expect(rule.style.getPropertyPriority('font-size')).toBe('important'));
    });

    test('fact panes and tabs pair readable ink with the paper background in either theme', () => {
        const pane = document.querySelector('#card_demographics .tabContainer > .tab');
        const nav = document.querySelector('#card_demographics .tabNav');
        expect(values(pane, 'background-color')).toEqual(['var(--oe-paper)']);
        expect(values(nav, 'background-color')).toEqual(['var(--oe-paper)']);
        expect(values(nav.querySelector('li.current a'), 'background-color')).toEqual(['var(--oe-paper)']);
    });

    test('long values wrap inside a bounded, full-width fact table', () => {
        const value = document.querySelector('#text_email');
        expect(values(value, 'overflow-wrap')).toEqual(['anywhere']);
        const table = document.querySelector('#card_demographics .tabContainer table');
        expect(values(table, 'width')).toEqual(['100%']);
        expect(values(table, 'border-collapse')).toEqual(['collapse']);
        const wrapper = document.querySelector('.oe-demographics-facts');
        expect(values(wrapper, 'max-width')).toHaveLength(1);
        expect(values(wrapper, 'max-width')[0]).toMatch(/rem$/);
    });

    test('narrow screens stack each label above its value', () => {
        const label = document.querySelector('#card_demographics td.label_custom');
        const value = document.querySelector('#card_demographics td.data');
        [label, value].forEach((cell) => {
            const stacked = declared(cell, 'display').filter((d) => d.value === 'block');
            expect(stacked).toHaveLength(1);
            expect(stacked[0].media.join(' ')).toMatch(/^screen and \(width <= \d+px\)$/);
        });
    });

    test('subgroup headings are restrained; spacer rows and inline styles stay in the DOM', () => {
        const heading = Array.from(document.querySelectorAll('#card_demographics td.label'))
            .find((td) => td.textContent === 'Identifiers');
        expect(heading.getAttribute('style')).toBe('background-color: var(--gray300); padding: 4px');
        const background = declared(heading, 'background-color');
        expect(background.map((d) => d.value)).toEqual(['transparent']);
        expect(heading.style.getPropertyPriority('background-color')).toBe('');
        expect(styleRules().find(({ rule }) => rule.style.getPropertyValue('background-color') === 'transparent'
            && heading.matches(rule.selectorText)).rule.style.getPropertyPriority('background-color')).toBe('important');
        expect(values(heading, 'border-bottom')).not.toHaveLength(0);
        expect(values(heading, 'color')).toEqual(['var(--oe-muted)']);
        const spacer = document.querySelector('#card_demographics td.label[style*="height"]');
        expect(values(spacer, 'display')).toEqual([]);
        // The actual renderer's K option emits a nonempty nbsp spacer; it is not a heading.
        spacer.textContent = '\u00a0';
        expect(values(spacer, 'border-bottom')).toEqual([]);
        expect(values(spacer, 'background-color')).toEqual([]);
    });

    test('tabs show the selected one clearly and a visible keyboard focus ring', () => {
        const nav = document.querySelector('#card_demographics ul.tabNav');
        expect(values(nav, 'flex-wrap')).toEqual(['wrap']);
        const current = document.querySelector('#header_tab_Who');
        const other = document.querySelector('#header_tab_Contact');
        expect(values(current, 'border-bottom')).toEqual(['2px solid var(--oe-petrol)']);
        expect(values(other, 'border-bottom')).toEqual([]);
        expect(values(current, 'font-weight').map(Number).every((w) => w >= 600)).toBe(true);
        expect(values(other, 'outline', { pseudo: ':focus-visible' })).toEqual(['2px solid var(--oe-petrol)']);
        expect(values(other, 'outline-offset', { pseudo: ':focus-visible' })).not.toHaveLength(0);
    });

    test('warnings, other cards and the legacy view keep their own styling', () => {
        const warning = document.querySelector('#card_demographics .text-danger');
        expect(values(warning, 'color')).toEqual([]);
        const other = document.querySelector('section.card:not(#x) > table td.data');
        expect(declared(other, 'font-size')).toEqual([]);
        expect(declared(other, 'overflow-wrap')).toEqual([]);
        document.body.className = '';
        const value = document.querySelector('#card_demographics td.data');
        expect(declared(value, 'font-size')).toEqual([]);
        expect(declared(document.querySelector('#header_tab_Who'), 'border-bottom-color')).toEqual([]);
    });
});
