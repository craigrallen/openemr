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
