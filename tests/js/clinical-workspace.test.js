/**
 * @jest-environment jsdom
 */

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
});
