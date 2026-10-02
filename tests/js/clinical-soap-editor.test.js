/**
 * @jest-environment jsdom
 */
/* global __dirname */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const templatePath = path.join(root, 'interface/forms/soap/templates/soap_form.twig');
const template = () => fs.readFileSync(templatePath, 'utf8');

const FIELDS = [
    { name: 'subjective', legend: 'Subjective' },
    { name: 'objective', legend: 'Objective' },
    { name: 'assessment', legend: 'Assessment' },
    { name: 'plan', legend: 'Plan' }
];

// Saved note text with leading/trailing/internal whitespace and markup that `|text` must escape.
const SAVED = {
    subjective: '  pt reports <b>pain</b> & "fatigue"\n\n  since Monday  ',
    objective: '\tBP 120/80\n',
    assessment: '',
    plan: 'line one\r\n   line two   '
};

const escapeHtml = (value) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

// Minimal stand-in for the Twig runtime: translation filters return the source string,
// `|text`/`|attr` escape, csrfTokenRaw() returns a fixed token. Anything else renders empty.
function renderTemplate() {
    const rendered = template().replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (match, expr) => {
        const translated = expr.match(/^'([^']*)'\s*\|\s*(xlt|xla)$/);
        if (translated) {
            return escapeHtml(translated[1]);
        }
        const getter = expr.match(/^data\.get_(subjective|objective|assessment|plan)\(\)\s*\|\s*text$/);
        if (getter) {
            return escapeHtml(SAVED[getter[1]]);
        }
        if (/^csrfTokenRaw\(\)\s*\|\s*attr$/.test(expr)) {
            return 'TEST_CSRF_TOKEN';
        }
        return '';
    });
    expect(rendered).not.toMatch(/\{\{|\{%/);
    return rendered;
}

let clickHandler;

function loadForm() {
    const html = renderTemplate();
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
    // innerHTML does not run <script>; inline on* attributes are still compiled by jsdom.
    document.body.innerHTML = body;
    window.isSoapEdit = undefined;
    window.restoreSession = jest.fn(() => true);
    window.dlgopen = jest.fn();
    // parent === window in jsdom; the template closes via a javascript: URL calling parent.closeTab.
    window.closeTab = jest.fn();
    clickHandler = undefined;
    window.$ = jest.fn(() => ({ click: (fn) => { clickHandler = fn; } }));
    const inline = body.match(/<script>([\s\S]*?)<\/script>/)[1];
    const script = document.createElement('script');
    // The template's top-level consts would collide across loads in one realm; a block keeps the text intact.
    script.textContent = `{${inline}}`;
    document.body.appendChild(script);
    return document.forms.soap;
}

const textarea = (form, name) => form.querySelector(`textarea[name="${name}"]`);

// jsdom evaluates javascript: URL navigations on a timer.
const settleNavigation = () => new Promise((resolve) => setTimeout(resolve, 10));

function fireInput(el, init = {}) {
    el.dispatchEvent(new InputEvent('input', { bubbles: true, ...init }));
}

describe('SOAP editor template dirty tracking', () => {
    test.each(FIELDS)('$name: input without keyup marks the note dirty', ({ name }) => {
        const form = loadForm();
        const el = textarea(form, name);
        expect(top.isSoapEdit).toBeUndefined();
        el.value += ' pasted text';
        fireInput(el, { inputType: 'insertFromPaste' });
        expect(top.isSoapEdit).toBe(true);
    });

    test.each([
        ['insertFromPaste'],
        ['deleteByCut'],
        ['insertFromDrop'],
        ['insertReplacementText'],
        ['insertCompositionText']
    ])('%s input marks the note dirty with no key events', (inputType) => {
        const form = loadForm();
        const el = textarea(form, 'plan');
        fireInput(el, { inputType, isComposing: inputType === 'insertCompositionText' });
        expect(top.isSoapEdit).toBe(true);
    });

    test('keyup still marks the note dirty', () => {
        const form = loadForm();
        textarea(form, 'objective').dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
        expect(top.isSoapEdit).toBe(true);
    });

    test('loading the form and focusing fields does not mark it dirty', () => {
        const form = loadForm();
        FIELDS.forEach(({ name }) => {
            textarea(form, name).dispatchEvent(new FocusEvent('focus'));
        });
        expect(top.isSoapEdit).toBeUndefined();
    });

    test('saved whitespace and escaped markup round-trip unchanged, and input does not rewrite text', () => {
        const form = loadForm();
        FIELDS.forEach(({ name }) => {
            const el = textarea(form, name);
            // HTML parsing normalises CRLF to LF and drops one leading newline only.
            const expected = SAVED[name].replace(/\r\n/g, '\n');
            expect(el.value).toBe(expected);
            const typed = el.value + '  hi  \n';
            el.value = typed;
            fireInput(el, { inputType: 'insertText' });
            expect(el.value).toBe(typed);
        });
    });
});

describe('SOAP editor template field names and labels', () => {
    test('each textarea has a stable unique id and is named by its translated legend', () => {
        const form = loadForm();
        const ids = new Set();
        FIELDS.forEach(({ name, legend }) => {
            const el = textarea(form, name);
            expect(el.id).toBe(`soap-${name}`);
            ids.add(el.id);
            const labelledBy = el.getAttribute('aria-labelledby');
            expect(labelledBy).toBeTruthy();
            const names = labelledBy.split(/\s+/).map((id) => document.getElementById(id));
            names.forEach((node) => expect(node).not.toBeNull());
            expect(names.map((node) => node.textContent.trim()).join(' ')).toBe(legend);
            expect(names[0].tagName).toBe('LEGEND');
            expect(el.closest('fieldset').querySelector('legend')).toBe(names[0]);
        });
        expect(ids.size).toBe(FIELDS.length);
        expect(document.querySelectorAll('[id]').length).toBe(new Set([...document.querySelectorAll('[id]')].map((n) => n.id)).size);
    });

    test('no spellcheck/autocorrect behaviour is introduced', () => {
        const form = loadForm();
        FIELDS.forEach(({ name }) => {
            const el = textarea(form, name);
            ['spellcheck', 'autocorrect', 'autocapitalize', 'autocomplete'].forEach((attr) => {
                expect(el.hasAttribute(attr)).toBe(false);
            });
            expect(el.getAttribute('cols')).toBe('60');
            expect(el.getAttribute('rows')).toBe('6');
            expect(el.className).toBe('form-control');
        });
    });
});

describe('SOAP editor unchanged save/close/session/CSRF contracts', () => {
    test('form posts to save.php through top.restoreSession with the CSRF token and named fields', () => {
        const form = loadForm();
        expect(form.getAttribute('method')).toBe('post');
        expect(form.getAttribute('action')).toBe('/interface/forms/soap/save.php');
        expect(form.getAttribute('onsubmit')).toBe('return top.restoreSession()');
        expect(form.elements.csrf_token_form.value).toBe('TEST_CSRF_TOKEN');
        const names = [...form.elements].map((el) => el.name).filter(Boolean);
        expect(names).toEqual([
            'csrf_token_form', 'subjective', 'objective', 'assessment', 'plan',
            'Submit', 'id', 'activity', 'pid', 'process'
        ]);
        form.dispatchEvent(new Event('submit', { cancelable: true }));
        expect(top.restoreSession).toHaveBeenCalledTimes(1);
    });

    test('close after input-only edit raises the existing warning instead of closing', () => {
        const form = loadForm();
        expect(window.$).toHaveBeenCalledWith('#btnClose');
        fireInput(textarea(form, 'assessment'), { inputType: 'insertFromDrop' });
        clickHandler();
        expect(window.dlgopen).toHaveBeenCalledTimes(1);
        expect(top.restoreSession).not.toHaveBeenCalled();
    });

    test('close on a clean form restores the session and closes the tab without a warning', async () => {
        loadForm();
        clickHandler();
        expect(window.dlgopen).not.toHaveBeenCalled();
        expect(top.restoreSession).toHaveBeenCalledTimes(1);
        await settleNavigation();
        expect(window.closeTab).toHaveBeenCalledWith(window.name, false);
    });

    test('confirming the warning clears the dirty flag, restores the session and closes the tab', async () => {
        const form = loadForm();
        fireInput(textarea(form, 'subjective'), { inputType: 'insertFromPaste' });
        clickHandler();
        await settleNavigation();
        expect(window.closeTab).not.toHaveBeenCalled();
        const closeButton = window.dlgopen.mock.calls[0][6].buttons.find((b) => b.click);
        closeButton.click();
        expect(top.isSoapEdit).toBe(false);
        expect(top.restoreSession).toHaveBeenCalledTimes(1);
        await settleNavigation();
        expect(window.closeTab).toHaveBeenCalledWith(window.name, false);
    });
});
