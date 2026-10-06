/**
 * @jest-environment jsdom
 */
/* global __dirname */

const fs = require('fs');
const path = require('path');
const { createModeController } = require('../../interface/clinical-workspace/mode.js');
const soapDocument = require('../../interface/clinical-workspace/soap-document.js');

const { createAutoHeight, attach, FIELD_NAMES } = soapDocument;

const root = path.join(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const LINE = 20;
const CHAR = 8;
let fieldWidth;

// jsdom does no layout, so this models what browsers do (verified separately in a real
// browser): scrollHeight is wrapped text lines plus vertical padding, never less than the
// current box. Under height:auto the box is the native rows="6" height, so measuring
// there can never report a short note smaller than six blank rows.
const ROWS = 6;
function measuredContent(textarea) {
    const perLine = Math.max(1, Math.floor(fieldWidth / CHAR));
    const lines = textarea.value.split(/\r\n|\r|\n/)
        .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / perLine)), 0);
    return lines * LINE + 2 * 10;
}

function installLayout(textarea) {
    Object.defineProperty(textarea, 'scrollHeight', {
        configurable: true,
        get() {
            const content = measuredContent(textarea);
            if (textarea.style.height === 'auto') return Math.max(content, ROWS * LINE + 2 * 10);
            const fixed = parseFloat(textarea.style.height);
            return Number.isFinite(fixed) ? Math.max(content, fixed - 3) : content;
        }
    });
}

const SAVED = {
    subjective: '  pt reports <b>pain</b> & "fatigue"\n\n  since Monday  ',
    objective: '\tBP 120/80\r\n' + 'x'.repeat(400),
    assessment: '',
    plan: Array.from({ length: 30 }, (_, i) => `step ${i + 1}   `).join('\n')
};

function soapMarkup() {
    return '<div class="container mt-3 oe-soap-document" spellcheck="true"><form name="soap">'
        + FIELD_NAMES.map((name) => `<fieldset><legend>${name}</legend>`
            + `<textarea name="${name}" class="form-control" cols="60" rows="6" `
            + 'onkeyup="top.isSoapEdit = true;"></textarea></fieldset>').join('')
        + '<textarea name="unrelated"></textarea>'
        + '<input type="hidden" name="csrf_token_form" value="token"></form></div>';
}

function loadForm() {
    document.body.innerHTML = soapMarkup();
    const fields = FIELD_NAMES.map((name) => document.querySelector(`textarea[name="${name}"]`));
    fields.forEach((field) => {
        field.value = SAVED[field.name];
        installLayout(field);
    });
    return fields;
}

const STYLE = 'textarea { box-sizing: border-box; border-style: solid; '
    + 'border-top-width: 1px; border-bottom-width: 2px; padding-top: 10px; padding-bottom: 10px; }';

function setStyle(css) {
    document.head.innerHTML = `<style>${css}</style>`;
}

let observers;

function classObserver(target, callback) {
    const observer = new MutationObserver(callback);
    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
    observers.push(observer);
    return observer;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const heightFor = (field) => `${measuredContent(field) + 3}px`;

beforeEach(() => {
    observers = [];
    fieldWidth = 480;
    document.body.className = 'oe-clinical-soap';
    document.body.removeAttribute('dir');
    setStyle(STYLE);
    delete window.ResizeObserver;
});

afterEach(() => {
    observers.forEach((observer) => observer.disconnect());
    document.body.innerHTML = '';
});

describe('SOAP document auto-height', () => {
    test('grows each of the four note fields to its full text in workbench mode without changing values', () => {
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });

        fields.forEach((field) => {
            expect(field.style.height).toBe(heightFor(field));
            expect(field.value).toBe(field.name === 'objective' ? '\tBP 120/80\n' + 'x'.repeat(400) : SAVED[field.name]);
        });
        // 30 plan lines need far more than the six-row default ...
        expect(parseFloat(fields[3].style.height)).toBeGreaterThan(ROWS * LINE + 20 + 3);
        // ... while a short or empty note fits its text instead of six blank rows.
        expect(parseFloat(fields[2].style.height)).toBeLessThan(ROWS * LINE + 20);
        expect(fields[2].style.height).toBe(`${LINE + 20 + 3}px`);
        expect(document.querySelector('textarea[name="unrelated"]').style.height).toBe('');
        controller.dispose();
    });

    test('content-box fields subtract padding instead of adding borders', () => {
        setStyle('textarea { box-sizing: content-box; border-style: solid; border-top-width: 1px; '
            + 'border-bottom-width: 2px; padding-top: 10px; padding-bottom: 10px; }');
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        expect(fields[3].style.height).toBe(`${measuredContent(fields[3]) - 20}px`);
        controller.dispose();
    });

    test('typing and paste refit only the edited field, in both directions, and never cancel the event', () => {
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        const [subjective, objective] = fields;
        const objectiveHeight = objective.style.height;
        window.isSoapEdit = undefined;

        subjective.value += '\n' + 'pasted line\n'.repeat(40);
        const pasted = new Event('input', { bubbles: true, cancelable: true });
        const later = jest.fn();
        document.body.addEventListener('input', later);
        subjective.dispatchEvent(pasted);
        expect(subjective.style.height).toBe(heightFor(subjective));
        expect(objective.style.height).toBe(objectiveHeight);
        expect(pasted.defaultPrevented).toBe(false);
        expect(later).toHaveBeenCalledTimes(1);

        const grown = parseFloat(subjective.style.height);
        subjective.value = 'short';
        subjective.dispatchEvent(new Event('input', { bubbles: true }));
        expect(parseFloat(subjective.style.height)).toBeLessThan(grown);
        expect(subjective.style.height).toBe(heightFor(subjective));
        expect(subjective.value).toBe('short');
        // The page's own dirty flag belongs to the inline onkeyup handler.
        expect(window.isSoapEdit).toBeUndefined();
        document.body.removeEventListener('input', later);
        controller.dispose();
    });

    test('leaves legacy presentation untouched and restores the original inline height on mode exit', async () => {
        const fields = loadForm();
        fields[1].style.height = '77px';
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        expect(fields.map((field) => field.style.height)).toEqual(['', '77px', '', '']);

        fields[0].dispatchEvent(new Event('input', { bubbles: true }));
        expect(fields[0].style.height).toBe('');

        document.body.classList.add('oe-clinical-workspace');
        await flush();
        expect(fields.map((field) => field.style.height)).toEqual(fields.map(heightFor));

        document.body.classList.remove('oe-clinical-workspace');
        await flush();
        expect(fields.map((field) => field.style.height)).toEqual(['', '77px', '', '']);
        controller.dispose();
    });

    test('follows the real mode controller through a nested encounter frame', async () => {
        const fields = loadForm();
        const mainBody = document.createElement('body');
        const encounterBody = document.createElement('body');
        const frame = (body, parent) => {
            const win = { location: { origin: window.location.origin }, document: { body } };
            win.parent = parent || win;
            return win;
        };
        const mode = createModeController({
            body: document.body,
            parentWindow: frame(encounterBody, frame(mainBody)),
            origin: window.location.origin,
            observe: classObserver
        });
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        expect(fields[3].style.height).toBe('');

        mainBody.classList.add('workbench-active');
        await flush();
        expect(fields[3].style.height).toBe(heightFor(fields[3]));

        mainBody.classList.remove('workbench-active');
        await flush();
        expect(fields[3].style.height).toBe('');
        controller.dispose();
        mode.dispose();
    });

    test('refits on width change but keeps a manual drag height until the next edit', () => {
        const instances = [];
        window.ResizeObserver = class {
            constructor(callback) {
                this.callback = callback;
                this.targets = [];
                this.disconnected = false;
                instances.push(this);
            }
            observe(target) { this.targets.push(target); }
            disconnect() { this.disconnected = true; }
            fire(width) {
                this.callback(this.targets.map((target) => ({ target, contentRect: { width } })));
            }
        };
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        const [observer] = instances;
        expect(observer.targets).toEqual(fields);
        observer.fire(480);
        const wide = parseFloat(fields[1].style.height);

        fieldWidth = 160;
        observer.fire(160);
        expect(parseFloat(fields[1].style.height)).toBeGreaterThan(wide);
        expect(fields[1].style.height).toBe(heightFor(fields[1]));

        fields[2].style.height = '400px';
        observer.fire(160);
        expect(fields[2].style.height).toBe('400px');
        fields[2].dispatchEvent(new Event('input', { bubbles: true }));
        expect(fields[2].style.height).toBe(heightFor(fields[2]));

        controller.dispose();
        expect(observer.disconnected).toBe(true);
    });

    test('falls back to window resize when ResizeObserver is unavailable', () => {
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        const wide = parseFloat(fields[1].style.height);
        fieldWidth = 120;
        window.dispatchEvent(new Event('resize'));
        expect(parseFloat(fields[1].style.height)).toBeGreaterThan(wide);
        controller.dispose();

        fieldWidth = 480;
        window.dispatchEvent(new Event('resize'));
        expect(fields[1].style.height).toBe('');
    });

    test('does not collapse a field that cannot be measured, such as in a hidden frame', () => {
        const fields = loadForm();
        fields[0].style.height = '90px';
        Object.defineProperty(fields[0], 'scrollHeight', { configurable: true, get: () => 0 });
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        expect(fields[0].style.height).toBe('90px');
        controller.dispose();
    });

    test('ignores removed fields and documents without a window', () => {
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        const removed = fields[0];
        const before = removed.style.height;
        removed.remove();
        removed.value = 'more\n'.repeat(50);
        expect(() => removed.dispatchEvent(new Event('input'))).not.toThrow();
        expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
        expect(removed.style.height).toBe(before);
        controller.dispose();

        const detached = document.implementation.createHTMLDocument('closed');
        detached.body.className = 'oe-clinical-soap oe-clinical-workspace';
        detached.body.innerHTML = '<textarea name="plan"></textarea>';
        const orphan = detached.querySelector('textarea');
        let orphanController;
        expect(() => {
            orphanController = createAutoHeight({ body: detached.body, fields: [orphan], observe: classObserver });
            orphan.dispatchEvent(new Event('input'));
        }).not.toThrow();
        expect(orphan.style.height).toBe('');
        orphanController.dispose();
    });

    test('dispose is final, idempotent and restores every field', async () => {
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        controller.dispose();
        controller.dispose();
        expect(fields.map((field) => field.style.height)).toEqual(['', '', '', '']);

        document.body.classList.remove('oe-clinical-workspace');
        document.body.classList.add('oe-clinical-workspace');
        await flush();
        fields[3].dispatchEvent(new Event('input'));
        window.dispatchEvent(new Event('pageshow'));
        expect(fields.map((field) => field.style.height)).toEqual(['', '', '', '']);
    });

    test('measures right-to-left notes the same way and writes nothing but height', () => {
        document.body.setAttribute('dir', 'rtl');
        const fields = loadForm();
        fields[0].value = 'المريض يشكو من ألم\n'.repeat(12);
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        expect(fields[0].style.height).toBe(heightFor(fields[0]));
        fields.forEach((field) => {
            expect(field.getAttribute('style')).toMatch(/^height: \d+px;$/);
        });
        controller.dispose();
    });

    test('keeps the page scroll position while measuring', () => {
        const fields = loadForm();
        const scroller = { scrollTop: 250 };
        Object.defineProperty(document, 'scrollingElement', { configurable: true, get: () => scroller });
        // A browser clamps the page scroll when the field collapses to auto for measurement.
        Object.defineProperty(fields[3], 'scrollHeight', {
            configurable: true,
            get() {
                if (fields[3].style.height === 'auto' || fields[3].style.height === '0px') scroller.scrollTop = 0;
                return measuredContent(fields[3]);
            }
        });
        try {
            document.body.classList.add('oe-clinical-workspace');
            const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
            expect(fields[3].style.height).toBe(heightFor(fields[3]));
            expect(scroller.scrollTop).toBe(250);
            controller.dispose();
        } finally {
            delete document.scrollingElement;
        }
    });

    test('refits once web fonts finish loading', async () => {
        const fields = loadForm();
        let loaded;
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: { ready: new Promise((resolve) => { loaded = resolve; }) }
        });
        try {
            document.body.classList.add('oe-clinical-workspace');
            const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
            fieldWidth = 96;
            loaded();
            await flush();
            expect(fields[1].style.height).toBe(heightFor(fields[1]));
            controller.dispose();
        } finally {
            delete document.fonts;
        }
    });

    test('never touches storage or the network', () => {
        const spies = [
            jest.spyOn(Storage.prototype, 'setItem'),
            jest.spyOn(Storage.prototype, 'getItem'),
            jest.spyOn(XMLHttpRequest.prototype, 'open')
        ];
        window.fetch = jest.fn();
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        fields[0].dispatchEvent(new Event('input'));
        controller.dispose();
        spies.forEach((spy) => {
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });
        expect(window.fetch).not.toHaveBeenCalled();
        delete window.fetch;

        const source = read('interface/clinical-workspace/soap-document.js');
        expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|sendBeacon|\.value\s*=[^=]|contentEditable|innerHTML/);
    });
});

describe('SOAP document auto-height follows the document container width class', () => {
    // soap-reference.js sets this on .oe-soap-document; soap-document.css widens the sheet with it.
    const OPEN = 'oe-soap-document--reference-open';
    const heights = (fields) => fields.map((field) => field.style.height);
    const container = () => document.querySelector('.oe-soap-document');

    function recordingObserve() {
        const calls = [];
        const observe = (target, callback) => {
            const observer = classObserver(target, callback);
            const record = { target, disconnected: false };
            calls.push(record);
            const disconnect = observer.disconnect.bind(observer);
            observer.disconnect = () => {
                record.disconnected = true;
                disconnect();
            };
            return observer;
        };
        return { calls, observe };
    }

    test('without ResizeObserver, opening and closing the reference refits every field and keeps the draft', async () => {
        const fields = loadForm();
        const scroller = { scrollTop: 250 };
        Object.defineProperty(document, 'scrollingElement', { configurable: true, get: () => scroller });
        Object.defineProperty(fields[3], 'scrollHeight', {
            configurable: true,
            get() {
                if (fields[3].style.height === '0px') scroller.scrollTop = 0;
                return measuredContent(fields[3]);
            }
        });
        try {
            document.body.classList.add('oe-clinical-workspace');
            const { calls, observe } = recordingObserve();
            const controller = createAutoHeight({ body: document.body, fields, observe });
            expect(window.ResizeObserver).toBeUndefined();
            expect(calls.map((call) => call.target)).toEqual([document.body, container()]);
            const narrow = heights(fields);
            expect(narrow).toEqual(fields.map(heightFor));

            const values = fields.map((field) => field.value);
            const objective = fields[1];
            objective.focus();
            objective.setSelectionRange(3, 9);

            fieldWidth = 720;
            container().classList.add(OPEN);
            await flush();
            expect(heights(fields)).toEqual(fields.map(heightFor));
            expect(parseFloat(objective.style.height)).toBeLessThan(parseFloat(narrow[1]));

            // Closing narrows the field again; the old wide height would clip the text.
            fieldWidth = 480;
            container().classList.remove(OPEN);
            await flush();
            expect(heights(fields)).toEqual(narrow);
            fields.forEach((field) => {
                expect(parseFloat(field.style.height)).toBeGreaterThanOrEqual(measuredContent(field));
            });

            expect(fields.map((field) => field.value)).toEqual(values);
            FIELD_NAMES.forEach((name, index) => {
                expect(document.querySelector(`textarea[name="${name}"]`)).toBe(fields[index]);
            });
            expect(document.activeElement).toBe(objective);
            expect([objective.selectionStart, objective.selectionEnd]).toEqual([3, 9]);
            expect(scroller.scrollTop).toBe(250);
            fields.forEach((field) => expect(field.getAttribute('style')).toMatch(/^height: \d+px;$/));
            controller.dispose();
        } finally {
            delete document.scrollingElement;
        }
    });

    test('the page binding observes the real container through MutationObserver', async () => {
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = attach(window);
        fieldWidth = 720;
        container().classList.add(OPEN);
        await flush();
        expect(heights(fields)).toEqual(fields.map(heightFor));
        controller.dispose();
    });

    test('dispose disconnects the container observer and later class changes write nothing', async () => {
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const { calls, observe } = recordingObserve();
        const controller = createAutoHeight({ body: document.body, fields, observe });
        controller.dispose();
        expect(calls).toHaveLength(2);
        expect(calls.every((call) => call.disconnected)).toBe(true);

        fieldWidth = 720;
        container().classList.add(OPEN);
        await flush();
        expect(heights(fields)).toEqual(['', '', '', '']);
    });

    test('fields outside a document container observe only the body and still fit', () => {
        const fields = loadForm();
        const wrapper = container();
        wrapper.replaceWith(...wrapper.childNodes);
        document.body.classList.add('oe-clinical-workspace');
        const { calls, observe } = recordingObserve();
        let controller;
        expect(() => {
            controller = createAutoHeight({ body: document.body, fields, observe });
        }).not.toThrow();
        expect(calls.map((call) => call.target)).toEqual([document.body]);
        expect(heights(fields)).toEqual(fields.map(heightFor));
        controller.dispose();
        expect(calls[0].disconnected).toBe(true);
    });

    test('legacy presentation ignores container class changes', async () => {
        const fields = loadForm();
        fields[1].style.height = '77px';
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        container().classList.add(OPEN);
        await flush();
        container().classList.remove(OPEN);
        await flush();
        expect(heights(fields)).toEqual(['', '77px', '', '']);
        controller.dispose();
    });

    test('a container change during print keeps native heights until print ends, then fits the new width', async () => {
        const fields = loadForm();
        fields[2].style.height = '55px';
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        window.dispatchEvent(new Event('beforeprint'));
        fieldWidth = 720;
        container().classList.add(OPEN);
        await flush();
        expect(heights(fields)).toEqual(['', '', '55px', '']);
        window.dispatchEvent(new Event('afterprint'));
        expect(heights(fields)).toEqual(fields.map(heightFor));
        expect(fields[3].value).toBe(SAVED.plan);
        controller.dispose();
    });
});

describe('SOAP document auto-height while printing', () => {
    // jsdom has no matchMedia; emulate the print query with either listener API.
    function emulatePrintMedia({ legacyListeners = false, matches = false } = {}) {
        const listeners = new Set();
        const print = { media: 'print', matches };
        if (legacyListeners) {
            print.addListener = (listener) => listeners.add(listener);
            print.removeListener = (listener) => listeners.delete(listener);
        } else {
            print.addEventListener = (type, listener) => { if (type === 'change') listeners.add(listener); };
            print.removeEventListener = (type, listener) => { if (type === 'change') listeners.delete(listener); };
        }
        window.matchMedia = jest.fn((query) => {
            expect(query).toBe('print');
            return print;
        });
        return {
            listeners,
            set(value) {
                print.matches = value;
                [...listeners].forEach((listener) => listener({ matches: value, media: 'print' }));
            }
        };
    }

    const heights = (fields) => fields.map((field) => field.style.height);

    afterEach(() => {
        delete window.matchMedia;
    });

    test('beforeprint restores the original heights, suspends refits, and afterprint refits', () => {
        const fields = loadForm();
        fields[1].style.height = '77px';
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        expect(heights(fields)).toEqual(fields.map(heightFor));

        window.dispatchEvent(new Event('beforeprint'));
        expect(heights(fields)).toEqual(['', '77px', '', '']);

        fields[0].value += '\n' + 'typed during print\n'.repeat(20);
        fields[0].dispatchEvent(new Event('input', { bubbles: true }));
        fieldWidth = 120;
        window.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new Event('pageshow'));
        expect(heights(fields)).toEqual(['', '77px', '', '']);

        window.dispatchEvent(new Event('afterprint'));
        expect(heights(fields)).toEqual(fields.map(heightFor));
        expect(fields[2].value).toBe('');
        expect(fields[3].value).toBe(SAVED.plan);
        controller.dispose();
    });

    test('follows matchMedia print transitions, including emulated print media', () => {
        const media = emulatePrintMedia();
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        expect(window.matchMedia).toHaveBeenCalledWith('print');
        expect(heights(fields)).toEqual(fields.map(heightFor));

        media.set(true);
        expect(heights(fields)).toEqual(['', '', '', '']);
        fields[3].dispatchEvent(new Event('input'));
        expect(fields[3].style.height).toBe('');

        media.set(false);
        expect(heights(fields)).toEqual(fields.map(heightFor));
        controller.dispose();
    });

    test('supports the legacy addListener API and starts suspended when already printing', () => {
        const media = emulatePrintMedia({ legacyListeners: true, matches: true });
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        expect(heights(fields)).toEqual(['', '', '', '']);
        expect(media.listeners.size).toBe(1);

        media.set(false);
        expect(heights(fields)).toEqual(fields.map(heightFor));
        controller.dispose();
        expect(media.listeners.size).toBe(0);
    });

    test('stays suspended until both the print events and the print query have ended', () => {
        const media = emulatePrintMedia();
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });

        window.dispatchEvent(new Event('beforeprint'));
        media.set(true);
        window.dispatchEvent(new Event('afterprint'));
        expect(heights(fields)).toEqual(['', '', '', '']);

        media.set(false);
        expect(heights(fields)).toEqual(fields.map(heightFor));
        controller.dispose();
    });

    test('a font load that finishes during print does not refit', async () => {
        const fields = loadForm();
        let loaded;
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: { ready: new Promise((resolve) => { loaded = resolve; }) }
        });
        try {
            document.body.classList.add('oe-clinical-workspace');
            const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
            window.dispatchEvent(new Event('beforeprint'));
            loaded();
            await flush();
            expect(heights(fields)).toEqual(['', '', '', '']);
            controller.dispose();
        } finally {
            delete document.fonts;
        }
    });

    test('print never writes heights in legacy presentation', () => {
        const media = emulatePrintMedia();
        const fields = loadForm();
        fields[2].style.height = '55px';
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        window.dispatchEvent(new Event('beforeprint'));
        media.set(true);
        media.set(false);
        window.dispatchEvent(new Event('afterprint'));
        expect(heights(fields)).toEqual(['', '', '55px', '']);
        controller.dispose();
    });

    test('dispose removes every print listener', () => {
        const media = emulatePrintMedia();
        const added = jest.spyOn(window, 'addEventListener');
        const removed = jest.spyOn(window, 'removeEventListener');
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = createAutoHeight({ body: document.body, fields, observe: classObserver });
        const printTypes = (spy) => spy.mock.calls.map(([type]) => type).filter((type) => /print/.test(type)).sort();
        expect(printTypes(added)).toEqual(['afterprint', 'beforeprint']);
        expect(media.listeners.size).toBe(1);

        controller.dispose();
        expect(printTypes(removed)).toEqual(['afterprint', 'beforeprint']);
        expect(media.listeners.size).toBe(0);
        window.dispatchEvent(new Event('beforeprint'));
        window.dispatchEvent(new Event('afterprint'));
        expect(heights(fields)).toEqual(['', '', '', '']);
        added.mockRestore();
        removed.mockRestore();
    });
});

describe('SOAP document page binding', () => {
    test('binds exactly the four named SOAP fields and disposes on a real page hide', () => {
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = attach(window);
        expect(controller).not.toBeNull();
        expect(fields.map((field) => field.style.height)).toEqual(fields.map(heightFor));
        expect(document.querySelector('textarea[name="unrelated"]').style.height).toBe('');

        const restored = new Event('pagehide');
        restored.persisted = true;
        window.dispatchEvent(restored);
        fields[0].value += '\nmore';
        fields[0].dispatchEvent(new Event('input'));
        expect(fields[0].style.height).toBe(heightFor(fields[0]));

        window.dispatchEvent(new Event('pagehide'));
        expect(fields.map((field) => field.style.height)).toEqual(['', '', '', '']);
    });

    test('refits after back-forward restoration', () => {
        const fields = loadForm();
        document.body.classList.add('oe-clinical-workspace');
        const controller = attach(window);
        fields[2].value = 'restored by the browser\n'.repeat(20);
        window.dispatchEvent(new Event('pageshow'));
        expect(fields[2].style.height).toBe(heightFor(fields[2]));
        controller.dispose();
    });

    test('does nothing on pages without the SOAP form', () => {
        document.body.innerHTML = '<form name="other"><textarea name="plan"></textarea></form>';
        expect(attach(window)).toBeNull();
    });
});

describe('SOAP document template and styles', () => {
    const template = () => read('interface/forms/soap/templates/soap_form.twig');
    const css = () => read('interface/clinical-workspace/soap-document.css');

    test('loads the dedicated SOAP assets after the shared workspace assets with per-file versions', () => {
        const head = template().match(/<head>([\s\S]*?)<\/head>/)[1];
        const order = ['workspace.css', 'mode.js', 'soap-document.css', 'soap-document.js'].map((name) => head.indexOf(name));
        expect(order.every((index) => index >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
        expect(head).toContain('/interface/clinical-workspace/soap-document.css?v={{ soapDocumentAssets.css|attr_url }}"');
        expect(head).toMatch(/<script src="[^"]*\/interface\/clinical-workspace\/soap-document\.js\?v=\{\{ soapDocumentAssets\.js\|attr_url \}\}" defer><\/script>/);
    });

    test('enables browser spellcheck for every note field without changing the original fields', () => {
        const html = template();
        expect(html).toMatch(/<div class="container mt-3 oe-soap-document" spellcheck="true">/);
        expect(html).not.toMatch(/spellcheck="false"|autocorrect|autocomplete="off"/i);
        FIELD_NAMES.forEach((name) => {
            expect(html).toContain(`<textarea name="${name}" id="soap-${name}" aria-labelledby="soap-${name}-label" class="form-control" cols="60" rows="6" onkeyup="top.isSoapEdit = true;" oninput="top.isSoapEdit = true;">{{ data.get_${name}()|text }}</textarea>`);
        });
        expect(html).toContain('<input type="hidden" name="csrf_token_form" value="{{ csrfTokenRaw()|attr }}" />');
        expect(html).toContain('action="{{ FORM_ACTION | attr }}/interface/forms/soap/save.php" onsubmit="return top.restoreSession()"');
        expect(html).not.toMatch(/\{%/);
    });

    function rules() {
        document.head.innerHTML = '';
        const style = document.createElement('style');
        style.textContent = css();
        document.head.appendChild(style);
        return Array.from(document.styleSheets[0].cssRules);
    }

    test('styles apply on screen only inside the SOAP workbench presentation', () => {
        const top = rules();
        expect(top.length).toBeGreaterThan(0);
        top.forEach((rule) => {
            expect(rule.constructor.name).toBe('CSSMediaRule');
            expect(rule.conditionText || rule.media.mediaText).toMatch(/^screen\b/);
            Array.from(rule.cssRules).forEach((inner) => {
                const styleRules = inner.cssRules ? Array.from(inner.cssRules) : [inner];
                styleRules.forEach((styleRule) => {
                    styleRule.selectorText.split(',').forEach((selector) => {
                        expect(selector.trim()).toMatch(/^body\.oe-clinical-soap\.oe-clinical-workspace\s/);
                    });
                });
            });
        });
    });

    test('keeps every control visible, resizable and direction-neutral', () => {
        const text = css();
        expect(text).not.toMatch(/display:\s*none|visibility:\s*hidden|overflow(-y)?:\s*hidden|outline:\s*(none|0)\b|resize:\s*none|iframe/);
        expect(text).not.toMatch(/(margin|padding|border)-(left|right)\b|\b(left|right):|text-align:\s*(left|right)/);
        expect(text).toMatch(/resize:\s*vertical/);
    });

    function workbenchRule(suffix) {
        const found = rules()
            .flatMap((media) => Array.from(media.cssRules))
            .filter((rule) => rule.selectorText && rule.selectorText.endsWith(suffix));
        expect(found.length).toBeGreaterThan(0);
        return found[0].style;
    }

    test('section headings are plain document headings, not the legacy grey legend bars', () => {
        const legend = workbenchRule('.oe-soap-document legend');
        // The served light theme sets `legend { background-color: #d1d5db !important }` globally,
        // so only an important declaration in this scoped rule can clear the grey bar.
        expect(legend.getPropertyValue('background-color')).toBe('transparent');
        expect(legend.getPropertyPriority('background-color')).toBe('important');
        expect(legend.getPropertyValue('padding-inline')).toMatch(/^0(px)?$/);
    });

    test('fields start compact and leave the six-row floor to the native markup', () => {
        const field = workbenchRule('.oe-soap-document textarea.form-control');
        expect(field.getPropertyValue('min-height')).toBe('4.5rem');
        expect(template()).toMatch(/cols="60" rows="6"/);
    });

    test('widens the document to 1200px only on wide screens while the reference is open', () => {
        const OPEN = '.oe-soap-document.oe-soap-document--reference-open';
        const wide = rules().filter((media) => Array.from(media.cssRules)
            .some((rule) => rule.selectorText && rule.selectorText.includes('--reference-open')));
        expect(wide).toHaveLength(1);
        expect(wide[0].media.mediaText).toBe('screen and (min-width: 992px)');
        const inner = Array.from(wide[0].cssRules);
        expect(inner).toHaveLength(1);
        expect(inner[0].selectorText).toBe(`body.oe-clinical-soap.oe-clinical-workspace ${OPEN}`);
        expect(inner[0].style).toHaveLength(1);
        expect(inner[0].style.getPropertyValue('max-width')).toBe('1200px');
        expect(css().match(/--reference-open/g)).toHaveLength(1);
    });

    test('media queries use prefix notation the declared older browsers understand', () => {
        const queries = rules().map((media) => media.media.mediaText);
        expect(queries).toEqual(['screen', 'screen and (min-width: 992px)', 'screen and (max-width: 640px)']);
        expect(css()).not.toMatch(/@media[^{]*[<>]/);
        expect(css()).not.toMatch(/stylelint-disable/);
        const narrow = rules().find((media) => media.media.mediaText === 'screen and (max-width: 640px)');
        const declarations = Array.from(narrow.cssRules).map((rule) => [rule.selectorText, rule.style.cssText]);
        expect(declarations).toEqual([
            ['body.oe-clinical-soap.oe-clinical-workspace .oe-soap-document', 'padding-block: 1.1rem 1rem; border-radius: 0;'],
            ['body.oe-clinical-soap.oe-clinical-workspace .oe-soap-document h2', 'font-size: 1.4rem;'],
        ]);
    });

    test('the collapsed document keeps its 860px sheet', () => {
        const base = rules().find((media) => media.media.mediaText === 'screen');
        const sheet = Array.from(base.cssRules)
            .find((rule) => rule.selectorText === 'body.oe-clinical-soap.oe-clinical-workspace .oe-soap-document');
        expect(sheet.style.getPropertyValue('max-width')).toBe('860px');
    });

    test('gives note text a document line rhythm on paper', () => {
        document.body.className = 'oe-clinical-soap oe-clinical-workspace';
        document.body.innerHTML = soapMarkup();
        rules();
        const field = document.querySelector('textarea[name="plan"]');
        const fieldStyle = window.getComputedStyle(field);
        expect(parseFloat(fieldStyle.lineHeight)).toBeGreaterThanOrEqual(1.6);
        const paper = window.getComputedStyle(document.querySelector('.oe-soap-document'));
        expect(paper.backgroundColor).not.toBe('');
    });
});
