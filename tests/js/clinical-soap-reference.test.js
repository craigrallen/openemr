/**
 * @jest-environment jsdom
 */
/* global __dirname */

const fs = require('fs');
const path = require('path');
const soapReference = require('../../interface/clinical-workspace/soap-reference.js');

const { attach, render, SECTION_NAMES } = soapReference;

const root = path.join(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

// Synthetic fixture only: no real patient content.
function note(encounter, date, overrides = {}) {
    return {
        encounter,
        date,
        sections: {
            subjective: `Synthetic S ${encounter}`,
            objective: `Synthetic O ${encounter}`,
            assessment: `Synthetic A ${encounter}`,
            plan: `Synthetic P ${encounter}`,
            ...overrides,
        },
    };
}

function mount(payload, { draft = {}, eligibility = 'allowed' } = {}) {
    window.top.isSoapEdit = false;
    document.body.innerHTML = '';
    const form = document.createElement('form');
    form.setAttribute('name', 'soap');
    SECTION_NAMES.forEach((name) => {
        const field = document.createElement('textarea');
        field.name = name;
        field.value = draft[name] || '';
        field.setAttribute('onkeyup', 'top.isSoapEdit = true;');
        form.appendChild(field);
    });
    document.body.appendChild(form);

    const panel = document.createElement('aside');
    panel.className = 'oe-soap-reference';
    panel.setAttribute('data-soap-reference', JSON.stringify(payload));
    if (eligibility !== null) panel.setAttribute('data-copy-eligibility', eligibility);
    panel.setAttribute('data-label-copy', 'Copy to current draft');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'oe-soap-reference__toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'oe-soap-reference-body');
    panel.appendChild(toggle);
    const body = document.createElement('div');
    body.id = 'oe-soap-reference-body';
    body.hidden = true;
    const status = document.createElement('p');
    status.className = 'oe-soap-reference__status';
    status.setAttribute('data-status-available', 'Read-only reference');
    status.setAttribute('data-status-none', 'No earlier SOAP notes for this patient.');
    status.setAttribute('data-status-denied', 'Earlier SOAP notes are restricted for your account.');
    status.setAttribute('data-status-unavailable', 'Earlier SOAP notes could not be loaded.');
    status.setAttribute('data-status-withheld', 'Some earlier notes are hidden by access restrictions.');
    status.textContent = 'Earlier SOAP notes could not be loaded.';
    body.appendChild(status);
    const list = document.createElement('ol');
    list.className = 'oe-soap-reference__list';
    body.appendChild(list);
    const live = document.createElement('p');
    live.className = 'oe-soap-reference__live';
    live.setAttribute('aria-live', 'polite');
    body.appendChild(live);
    panel.appendChild(body);
    document.body.appendChild(panel);
    return { form, panel, toggle, body, status, list, live };
}

const field = (name) => document.querySelector(`form[name="soap"] textarea[name="${name}"]`);

describe('SOAP previous-note reference', () => {
    test('renders provenance and section text with textContent, so markup stays inert', () => {
        const hostile = '<img src=x onerror="window.pwned=1">\n<b>line two</b>';
        const dom = mount({ status: 'available', withheld: false, notes: [note(41, '2026-09-01', { plan: hostile })] });
        attach(window);

        const items = dom.list.querySelectorAll('li');
        expect(items).toHaveLength(1);
        expect(items[0].querySelector('.oe-soap-reference__provenance').textContent).toContain('41');
        expect(items[0].querySelector('.oe-soap-reference__provenance').textContent).toContain('2026-09-01');
        const plan = items[0].querySelector('[data-section="plan"] .oe-soap-reference__text');
        expect(plan.textContent).toBe(hostile);
        expect(dom.panel.querySelector('img')).toBeNull();
        expect(dom.panel.querySelector('b')).toBeNull();
        expect(window.pwned).toBeUndefined();
    });

    test('renders no more than five notes in the order supplied by the server', () => {
        const notes = [50, 49, 48, 47, 46, 45, 44].map((enc) => note(enc, `2026-08-${enc - 20}`));
        const dom = mount({ status: 'available', withheld: false, notes });
        attach(window);
        const encounters = Array.from(dom.list.querySelectorAll('li')).map((li) => li.getAttribute('data-encounter'));
        expect(encounters).toEqual(['50', '49', '48', '47', '46']);
    });

    test.each([
        ['denied', 'Earlier SOAP notes are restricted for your account.'],
        ['unavailable', 'Earlier SOAP notes could not be loaded.'],
        ['bogus-status', 'Earlier SOAP notes could not be loaded.'],
    ])('fails closed for %s without claiming the patient has no notes', (status, message) => {
        const dom = mount({ status, withheld: false, notes: [note(9, '2026-01-01')] });
        attach(window);
        expect(dom.status.textContent).toBe(message);
        expect(dom.status.textContent).not.toMatch(/No earlier/);
        expect(dom.list.children).toHaveLength(0);
    });

    test('malformed payload fails closed', () => {
        const dom = mount({});
        dom.panel.setAttribute('data-soap-reference', '{not json');
        attach(window);
        expect(dom.status.textContent).toBe('Earlier SOAP notes could not be loaded.');
        expect(dom.list.children).toHaveLength(0);
    });

    test('only an authorized empty result says the patient has no earlier notes', () => {
        const dom = mount({ status: 'none', withheld: false, notes: [] });
        attach(window);
        expect(dom.status.textContent).toBe('No earlier SOAP notes for this patient.');
    });

    test('says when some notes were withheld by access restrictions', () => {
        const dom = mount({ status: 'available', withheld: true, notes: [note(3, '2026-02-02')] });
        attach(window);
        expect(dom.status.textContent).toContain('Some earlier notes are hidden by access restrictions.');
    });

    test('collapse toggles by keyboard-operable button without touching the editor', () => {
        const dom = mount({ status: 'available', withheld: false, notes: [note(7, '2026-03-03')] }, {
            draft: { subjective: 'unsaved draft text' },
        });
        const editor = field('subjective');
        attach(window);
        expect(dom.body.hidden).toBe(true);
        dom.toggle.click();
        expect(dom.toggle.getAttribute('aria-expanded')).toBe('true');
        expect(dom.body.hidden).toBe(false);
        dom.toggle.click();
        expect(dom.toggle.getAttribute('aria-expanded')).toBe('false');
        expect(dom.body.hidden).toBe(true);
        expect(field('subjective')).toBe(editor);
        expect(editor.value).toBe('unsaved draft text');
        expect(window.top.isSoapEdit).toBe(false);
    });

    test('copy appends to the draft, keeps the source unchanged and fires the existing dirty handlers', () => {
        const dom = mount({ status: 'available', withheld: false, notes: [note(12, '2026-04-04', { assessment: 'Prior\nassessment' })] }, {
            draft: { assessment: 'current draft' },
        });
        const editor = field('assessment');
        const inputs = [];
        editor.addEventListener('input', (event) => inputs.push(event.bubbles));
        attach(window);

        const section = dom.list.querySelector('[data-section="assessment"]');
        const source = section.querySelector('.oe-soap-reference__text');
        section.querySelector('button.oe-soap-reference__copy').click();

        expect(field('assessment')).toBe(editor);
        expect(editor.value).toBe('current draft\n\nPrior\nassessment');
        expect(source.textContent).toBe('Prior\nassessment');
        expect(inputs).toEqual([true]);
        expect(window.top.isSoapEdit).toBe(true);
        expect(field('plan').value).toBe('');
        expect(dom.live.textContent).not.toBe('');
    });

    test('copy into an empty field does not add a leading separator', () => {
        const dom = mount({ status: 'available', withheld: false, notes: [note(13, '2026-05-05')] });
        attach(window);
        dom.list.querySelector('[data-section="plan"] button').click();
        expect(field('plan').value).toBe('Synthetic P 13');
    });

    test.each([
        ['absent', null],
        ['denied', 'denied'],
        ['wrong case', 'ALLOWED'],
        ['truthy string', 'true'],
        ['empty', ''],
    ])('copy is not offered unless the server explicitly allows it (%s)', (_label, eligibility) => {
        const dom = mount({ status: 'available', withheld: false, copy: true, notes: [note(17, '2026-07-09')] }, { eligibility });
        attach(window);
        expect(dom.list.querySelectorAll('[data-section]')).toHaveLength(4);
        expect(dom.list.querySelector('button')).toBeNull();
        expect(SECTION_NAMES.map((name) => field(name).value)).toEqual(['', '', '', '']);
    });

    test('copy refuses a read-only or disabled draft field even when allowed', () => {
        const dom = mount({ status: 'available', withheld: false, notes: [note(14, '2026-06-06')] }, {
            draft: { objective: 'signed text' },
        });
        field('objective').readOnly = true;
        field('subjective').disabled = true;
        attach(window);
        dom.list.querySelector('[data-section="objective"] button').click();
        dom.list.querySelector('[data-section="subjective"] button').click();
        expect(field('objective').value).toBe('signed text');
        expect(field('subjective').value).toBe('');
        expect(window.top.isSoapEdit).toBe(false);
    });

    test('empty sections offer no copy action', () => {
        const dom = mount({ status: 'available', withheld: false, notes: [note(15, '2026-07-07', { objective: '' })] });
        attach(window);
        expect(dom.list.querySelector('[data-section="objective"]')).toBeNull();
    });

    test('attach is idempotent and tolerates a page without the panel', () => {
        const dom = mount({ status: 'available', withheld: false, notes: [note(16, '2026-07-08')] });
        attach(window);
        attach(window);
        expect(dom.list.querySelectorAll('li')).toHaveLength(1);
        document.body.innerHTML = '';
        expect(attach(window)).toBeNull();
    });

    test('render() rejects notes whose shape is not the server contract', () => {
        const dom = mount({ status: 'available', withheld: false, notes: [{ encounter: 'x', sections: null }] });
        render(dom.panel);
        expect(dom.list.children).toHaveLength(0);
        expect(dom.status.textContent).toBe('Earlier SOAP notes could not be loaded.');
    });
});

describe('SOAP reference copy hands the appended draft to the clinician for review', () => {
    const copyButton = (dom, name, index = 0) => dom.list
        .querySelectorAll('li')[index]
        .querySelector(`[data-section="${name}"] button.oe-soap-reference__copy`);

    // Keyboard activation: the button has focus when it is clicked.
    function press(button) {
        button.focus();
        button.click();
    }

    function expectCaretAtEnd(editor) {
        expect(document.activeElement).toBe(editor);
        expect(editor.selectionStart).toBe(editor.value.length);
        expect(editor.selectionEnd).toBe(editor.value.length);
    }

    test('focuses the matching field with a collapsed caret after the appended multiline text', () => {
        const prior = '  Prior line one\n\n\tindented line two  \n';
        const draft = 'current draft  \n  second line\n';
        const payload = { status: 'available', withheld: false, notes: [note(21, '2026-08-08', { plan: prior })] };
        const dom = mount(payload, { draft: { plan: draft } });
        const payloadBefore = dom.panel.getAttribute('data-soap-reference');
        attach(window);

        const button = copyButton(dom, 'plan');
        const source = button.closest('[data-section]').querySelector('.oe-soap-reference__text');
        expect(button.type).toBe('button');
        press(button);

        const editor = field('plan');
        expect(editor.value).toBe(`${draft}\n\n${prior}`);
        expectCaretAtEnd(editor);
        expect(source.textContent).toBe(prior);
        expect(dom.panel.getAttribute('data-soap-reference')).toBe(payloadBefore);
        expect(['subjective', 'objective', 'assessment'].map((name) => field(name).value)).toEqual(['', '', '']);
    });

    test('focuses an initially empty field with the caret after the copied text', () => {
        const dom = mount({ status: 'available', withheld: false, notes: [note(22, '2026-08-09', { subjective: '\n  spaced  \n' })] });
        attach(window);
        press(copyButton(dom, 'subjective'));
        const editor = field('subjective');
        expect(editor.value).toBe('\n  spaced  \n');
        expectCaretAtEnd(editor);
    });

    test('moves focus only after the existing input and keyup handlers have run', () => {
        const dom = mount({ status: 'available', withheld: false, notes: [note(23, '2026-08-10')] }, {
            draft: { objective: 'draft' },
        });
        const editor = field('objective');
        const order = [];
        editor.addEventListener('input', () => order.push(['input', document.activeElement === editor, editor.value]));
        editor.addEventListener('keyup', () => order.push(['keyup', document.activeElement === editor, window.top.isSoapEdit]));
        editor.addEventListener('focus', () => order.push(['focus', true, editor.value]));
        attach(window);
        press(copyButton(dom, 'objective'));

        expect(order).toEqual([
            ['input', false, 'draft\n\nSynthetic O 23'],
            ['keyup', false, true],
            ['focus', true, 'draft\n\nSynthetic O 23'],
        ]);
        expectCaretAtEnd(editor);
    });

    test('each copy focuses its own section field across sections and notes', () => {
        const dom = mount({
            status: 'available',
            withheld: false,
            notes: [note(25, '2026-08-12'), note(24, '2026-08-11')],
        }, { draft: { assessment: 'kept' } });
        attach(window);

        press(copyButton(dom, 'plan', 0));
        expectCaretAtEnd(field('plan'));

        press(copyButton(dom, 'subjective', 1));
        expectCaretAtEnd(field('subjective'));

        press(copyButton(dom, 'plan', 1));
        expect(field('plan').value).toBe('Synthetic P 25\n\nSynthetic P 24');
        expectCaretAtEnd(field('plan'));

        expect(field('subjective').value).toBe('Synthetic S 24');
        expect(field('objective').value).toBe('');
        expect(field('assessment').value).toBe('kept');
    });

    test.each([
        ['read-only', (editor) => { editor.readOnly = true; }],
        ['disabled', (editor) => { editor.disabled = true; }],
        ['missing', (editor) => { editor.remove(); }],
    ])('a %s target copies nothing and leaves focus and selection alone', (_label, lock) => {
        const dom = mount({ status: 'available', withheld: false, notes: [note(26, '2026-08-13')] }, {
            draft: { assessment: 'signed text' },
        });
        const editor = field('assessment');
        editor.setSelectionRange(2, 4);
        lock(editor);
        attach(window);

        const button = copyButton(dom, 'assessment');
        press(button);

        expect(document.activeElement).toBe(button);
        expect(editor.value).toBe('signed text');
        expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 4]);
        expect(window.top.isSoapEdit).toBe(false);
        expect(dom.live.textContent).toBe('This field cannot be edited; nothing was copied.');
    });

    test('server default-deny offers no copy, so focus never moves to the draft', () => {
        const dom = mount({ status: 'available', withheld: false, notes: [note(27, '2026-08-14')] }, { eligibility: 'denied' });
        attach(window);
        dom.toggle.focus();
        expect(dom.list.querySelector('button')).toBeNull();
        expect(document.activeElement).toBe(dom.toggle);
        expect(SECTION_NAMES.map((name) => field(name).value)).toEqual(['', '', '', '']);
    });

    test('does not focus a field that an existing handler detached during the copy', () => {
        const dom = mount({ status: 'available', withheld: false, notes: [note(28, '2026-08-15')] });
        const editor = field('plan');
        editor.addEventListener('input', () => editor.remove());
        attach(window);

        const button = copyButton(dom, 'plan');
        expect(() => press(button)).not.toThrow();
        expect(editor.value).toBe('Synthetic P 28');
        expect(document.activeElement).not.toBe(editor);
    });
});

function mountFixture(name) {
    const html = read(`tests/Tests/Isolated/Common/Twig/fixtures/render/${name}`);
    document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*?)<script>/)[1];
}

describe('SOAP reference against the rendered template fixture', () => {
    test('server-allowed copy renders copy actions; the controller-less new-note render denies copy', () => {
        mountFixture('soap-form-saved-note.html');
        attach(window);
        expect(document.querySelector('.oe-soap-reference').getAttribute('data-copy-eligibility')).toBe('allowed');
        expect(document.querySelectorAll('.oe-soap-reference__copy')).toHaveLength(3);

        mountFixture('soap-form-new-note-no-reference.html');
        attach(window);
        const panel = document.querySelector('.oe-soap-reference');
        expect(panel.getAttribute('data-copy-eligibility')).toBe('denied');
        expect(panel.querySelector('button.oe-soap-reference__copy')).toBeNull();
        expect(panel.querySelector('.oe-soap-reference__status').textContent).toBe('Earlier SOAP notes could not be loaded.');
    });

    test('decodes the escaped server payload into inert text and leaves the editor untouched', () => {
        const html = read('tests/Tests/Isolated/Common/Twig/fixtures/render/soap-form-saved-note.html');
        const body = html.match(/<body[^>]*>([\s\S]*?)<script>/)[1];
        document.body.innerHTML = body;
        const plan = field('plan');
        const before = plan.value;
        attach(window);

        const panel = document.querySelector('.oe-soap-reference');
        expect(panel.getAttribute('aria-label')).toBe('Previous SOAP notes (read-only)');
        expect(panel.querySelector('script')).toBeNull();
        const text = (name) => panel.querySelector(`[data-section="${name}"] .oe-soap-reference__text`).textContent;
        expect(text('subjective')).toBe('<script>alert(1)</script>');
        expect(text('objective')).toBe("a & 'b'");
        expect(text('plan')).toBe('line one\nline two');
        expect(panel.querySelector('[data-section="assessment"]')).toBeNull();
        expect(panel.querySelector('.oe-soap-reference__provenance').textContent).toBe('2026-09-01 · Encounter 41');
        expect(panel.querySelector('.oe-soap-reference__status').textContent)
            .toBe('Read-only reference for this patient. Earlier notes cannot be edited here. Some earlier notes are hidden by access restrictions.');
        expect(field('plan')).toBe(plan);
        expect(plan.value).toBe(before);
        // The panel sits beside the form, not inside it, so nothing it renders is ever submitted.
        expect(panel.closest('form')).toBeNull();
        expect(document.querySelector('form[name="soap"] .oe-soap-reference')).toBeNull();
    });
});

describe('SOAP reference source hygiene', () => {
    const js = () => read('interface/clinical-workspace/soap-reference.js');
    const template = () => read('interface/forms/soap/templates/soap_form.twig');

    test('never writes HTML strings or editable markup', () => {
        expect(js()).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|contentEditable|eval\(/i);
    });

    test('template loads the reference assets with per-file helper versions and no filesystem expression', () => {
        const head = template().match(/<head>([\s\S]*?)<\/head>/)[1];
        expect(head).toContain('/interface/clinical-workspace/soap-reference.css?v={{ soapDocumentAssets.referenceCss|attr_url }}"');
        expect(head).toContain('/interface/clinical-workspace/soap-reference.js?v={{ soapDocumentAssets.referenceJs|attr_url }}" defer></script>');
        expect(head.indexOf('soap-document.js')).toBeLessThan(head.indexOf('soap-reference.css'));
    });

    test('template passes the server payload only as an escaped attribute and labels it read-only', () => {
        const html = template();
        expect(html).toContain('data-soap-reference="{{ soapReference|default({status: \'unavailable\', withheld: false, notes: []})|json_encode|attr }}"');
        expect(html).toMatch(/aria-label="\{\{ 'Previous SOAP notes \(read-only\)'\|xla \}\}"/);
        expect(html).toContain(`data-copy-eligibility="{{ soapCopyAllowed is same as(true) ? 'allowed' : 'denied' }}"`);
        expect(html).not.toMatch(/\{%/);
    });
});
