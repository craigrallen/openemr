/**
 * @jest-environment jsdom
 */
/* global __dirname */

const fs = require('fs');
const path = require('path');
const { bindRowKeyboard, bindRowClicks } = require('../../interface/clinical-workspace/visit-history.js');

const root = path.join(__dirname, '../..');
const page = () => fs.readFileSync(path.join(root, 'interface/patient_file/history/encounters.php'), 'utf8');

// Markup shaped like the rows encounters.php emits: an encounter row with a nested
// follow-up button and billing-note control, and a document row with a nested link.
function renderRows() {
    document.body.innerHTML = `
        <table id="visits">
            <tr class="encrow text" tabindex="0" id="42~2026-03-04">
                <td>2026-03-04</td>
                <td><button type="button" class="btn btn-sm">Follow up</button></td>
                <td><input type="text" class="note" value=""></td>
            </tr>
            <tr class="text docrow" tabindex="0" id="77">
                <td><a href="#doc">Lab report</a></td>
            </tr>
            <tr class="text other" tabindex="0" id="99"><td>header</td></tr>
        </table>`;
    return {
        table: document.getElementById('visits'),
        encounter: document.getElementById('42~2026-03-04'),
        doc: document.getElementById('77'),
        other: document.getElementById('99')
    };
}

function press(target, key, init = {}) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

function bind(container) {
    const openEncounter = jest.fn();
    const openDocument = jest.fn();
    const binding = bindRowKeyboard(container, { openEncounter, openDocument });
    return { openEncounter, openDocument, binding };
}

afterEach(() => {
    // Release any binding a failed test left behind; each binder returns the live one if present.
    bindRowKeyboard(document, { openEncounter() {}, openDocument() {} }).dispose();
    bindRowClicks(document, { openEncounter() {}, openDocument() {} }).dispose();
    document.body.innerHTML = '';
});

test('Enter and Space on an encounter row route its raw id to the encounter opener and suppress the default', () => {
    const rows = renderRows();
    const { openEncounter, openDocument, binding } = bind(document);

    const enter = press(rows.encounter, 'Enter');
    const space = press(rows.encounter, ' ');

    expect(openEncounter.mock.calls).toEqual([['42~2026-03-04'], ['42~2026-03-04']]);
    expect(openDocument).not.toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(true);
    expect(space.defaultPrevented).toBe(true);
    binding.dispose();
});

test('Enter and Space on a document row route its id to the document opener', () => {
    const rows = renderRows();
    const { openEncounter, openDocument, binding } = bind(document);

    press(rows.doc, 'Enter');
    press(rows.doc, ' ');

    expect(openDocument.mock.calls).toEqual([['77'], ['77']]);
    expect(openEncounter).not.toHaveBeenCalled();
    binding.dispose();
});

test('keys from nested buttons, inputs and links are left to that control', () => {
    const rows = renderRows();
    const { openEncounter, openDocument, binding } = bind(document);

    const fromButton = press(rows.encounter.querySelector('button'), 'Enter');
    const fromInput = press(rows.encounter.querySelector('input'), ' ');
    const fromLink = press(rows.doc.querySelector('a'), 'Enter');

    expect(openEncounter).not.toHaveBeenCalled();
    expect(openDocument).not.toHaveBeenCalled();
    for (const event of [fromButton, fromInput, fromLink]) expect(event.defaultPrevented).toBe(false);
    binding.dispose();
});

test('other keys and non-history rows are ignored', () => {
    const rows = renderRows();
    const { openEncounter, openDocument, binding } = bind(document);

    const tab = press(rows.encounter, 'Tab');
    const arrow = press(rows.doc, 'ArrowDown');
    const otherRow = press(rows.other, 'Enter');
    const textNode = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    rows.table.dispatchEvent(textNode);
    const onContainer = press(document, 'Enter');

    expect(openEncounter).not.toHaveBeenCalled();
    expect(openDocument).not.toHaveBeenCalled();
    for (const event of [tab, arrow, otherRow, textNode, onContainer]) expect(event.defaultPrevented).toBe(false);
    binding.dispose();
});

test('holding Enter opens the row once; auto-repeated keydowns do not navigate again', () => {
    const rows = renderRows();
    const { openEncounter, openDocument, binding } = bind(document);

    press(rows.encounter, 'Enter');
    const repeatEnc = press(rows.encounter, 'Enter', { repeat: true });
    press(rows.doc, ' ');
    const repeatDoc = press(rows.doc, ' ', { repeat: true });

    expect(openEncounter).toHaveBeenCalledTimes(1);
    expect(openDocument).toHaveBeenCalledTimes(1);
    // Still swallow the repeat so Space does not start scrolling mid-navigation.
    expect(repeatEnc.defaultPrevented).toBe(true);
    expect(repeatDoc.defaultPrevented).toBe(true);
    binding.dispose();
});

test('modified Enter/Space is left to the browser and assistive technology', () => {
    const rows = renderRows();
    const { openEncounter, openDocument, binding } = bind(document);

    const events = [
        press(rows.encounter, ' ', { shiftKey: true }),
        press(rows.encounter, 'Enter', { ctrlKey: true }),
        press(rows.doc, 'Enter', { metaKey: true }),
        press(rows.doc, 'Enter', { altKey: true })
    ];

    expect(openEncounter).not.toHaveBeenCalled();
    expect(openDocument).not.toHaveBeenCalled();
    for (const event of events) expect(event.defaultPrevented).toBe(false);
    binding.dispose();
});

test('a key already handled by another listener does not also route the row', () => {
    const rows = renderRows();
    const { openEncounter, openDocument, binding } = bind(document);
    const claim = (event) => event.preventDefault();
    rows.encounter.addEventListener('keydown', claim);
    rows.doc.addEventListener('keydown', claim);

    press(rows.encounter, 'Enter');
    press(rows.doc, ' ');

    expect(openEncounter).not.toHaveBeenCalled();
    expect(openDocument).not.toHaveBeenCalled();
    binding.dispose();
});

test('keys bubbling from nested controls never reach the row opener, even when the control does not prevent them', () => {
    const rows = renderRows();
    const { openEncounter, openDocument, binding } = bind(document);
    const seen = [];
    const record = (event) => seen.push(event.target);
    document.addEventListener('keydown', record);

    press(rows.encounter.querySelector('button'), ' ');
    press(rows.doc.querySelector('a'), ' ');
    document.removeEventListener('keydown', record);

    // The event really bubbled past the row to the bound container...
    expect(seen).toEqual([rows.encounter.querySelector('button'), rows.doc.querySelector('a')]);
    // ...and was neither routed nor had native activation blocked.
    expect(openEncounter).not.toHaveBeenCalled();
    expect(openDocument).not.toHaveBeenCalled();
    binding.dispose();
});

test('binding twice reuses one listener, and dispose removes it', () => {
    const rows = renderRows();
    const first = bind(document);
    const second = bindRowKeyboard(document, { openEncounter: jest.fn(), openDocument: jest.fn() });

    expect(second).toBe(first.binding);
    press(rows.encounter, 'Enter');
    expect(first.openEncounter).toHaveBeenCalledTimes(1);

    first.binding.dispose();
    press(rows.encounter, 'Enter');
    expect(first.openEncounter).toHaveBeenCalledTimes(1);

    const rebound = bind(document);
    press(rows.doc, 'Enter');
    expect(rebound.openDocument).toHaveBeenCalledWith('77');
    rebound.binding.dispose();
});

// Markup shaped like encounters.php output for an encounter that has tagged documents:
// getDocListByEncID() prints div.docrow (with a native document href and the inline
// restoreSession onclick) inside the encounter's tr.encrow, next to the follow-up action.
function renderNestedRows() {
    document.body.innerHTML = `
        <table id="visits">
            <tr class="encrow text" tabindex="0" id="42~2026-03-04">
                <td>2026-03-04</td>
                <td class="forms">SOAP
                    <div class="text docrow" id="77" data-toggle="tooltip" title="View document">
                        <a href="/openemr/controller.php?document&amp;view&amp;patient_id=1&amp;doc_id=77" onclick="window.restoreCalls++">Document: lab.pdf-77 (Lab Report)</a>
                    </div>
                </td>
                <td><span class="billing_note_text" id="42">note</span></td>
                <td><div><a href="#" class="btn btn-sm btn-primary followup"><span>Create follow-up encounter</span></a></div></td>
            </tr>
            <tr class="text docrow" tabindex="0" id="88"><td>2026-02-01</td><td><b>orphan doc</b></td></tr>
        </table>`;
    window.restoreCalls = 0;
    return {
        encounter: document.getElementById('42~2026-03-04'),
        nestedDoc: document.getElementById('77'),
        docLink: document.getElementById('77').querySelector('a'),
        forms: document.querySelector('td.forms'),
        followUp: document.querySelector('a.followup'),
        followUpLabel: document.querySelector('a.followup span'),
        docRow: document.getElementById('88')
    };
}

function click(target, init = {}) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 1, ...init });
    target.dispatchEvent(event);
    return event;
}

function bindClicks(container) {
    const openEncounter = jest.fn();
    const openDocument = jest.fn();
    const binding = bindRowClicks(container, { openEncounter, openDocument });
    return { openEncounter, openDocument, binding };
}

describe('row click routing', () => {
    test('a document link nested in an encounter row keeps only its native href activation', () => {
        const rows = renderNestedRows();
        const { openEncounter, openDocument, binding } = bindClicks(document);
        const seen = [];
        const record = (event) => seen.push(event.target);
        document.addEventListener('click', record);

        const mouse = click(rows.docLink);
        // Enter on a focused link makes the browser dispatch a synthetic click (detail 0).
        const enter = click(rows.docLink, { detail: 0 });
        document.removeEventListener('click', record);

        expect(seen).toEqual([rows.docLink, rows.docLink]); // bubbling is not blanket-stopped
        expect(openDocument).not.toHaveBeenCalled();
        expect(openEncounter).not.toHaveBeenCalled();
        expect(mouse.defaultPrevented).toBe(false);
        expect(enter.defaultPrevented).toBe(false);
        expect(window.restoreCalls).toBe(2); // inline restoreSession onclick still runs
        binding.dispose();
    });

    test('modified clicks on the document link are left entirely to the browser', () => {
        const rows = renderNestedRows();
        const { openEncounter, openDocument, binding } = bindClicks(document);

        const events = [
            click(rows.docLink, { ctrlKey: true }),
            click(rows.docLink, { metaKey: true }),
            click(rows.docLink, { shiftKey: true })
        ];

        expect(openDocument).not.toHaveBeenCalled();
        expect(openEncounter).not.toHaveBeenCalled();
        for (const event of events) expect(event.defaultPrevented).toBe(false);
        binding.dispose();
    });

    test('clicking the nested document row outside its link opens that document once and never the encounter', () => {
        const rows = renderNestedRows();
        const { openEncounter, openDocument, binding } = bindClicks(document);

        click(rows.nestedDoc);

        expect(openDocument.mock.calls).toEqual([['77']]);
        expect(openEncounter).not.toHaveBeenCalled();
        binding.dispose();
    });

    test('clicking encounter row content opens the encounter once', () => {
        const rows = renderNestedRows();
        const { openEncounter, openDocument, binding } = bindClicks(document);

        click(rows.forms);
        click(rows.encounter);

        expect(openEncounter.mock.calls).toEqual([['42~2026-03-04'], ['42~2026-03-04']]);
        expect(openDocument).not.toHaveBeenCalled();
        binding.dispose();
    });

    test('a standalone document row opens its document once from any cell', () => {
        const rows = renderNestedRows();
        const { openEncounter, openDocument, binding } = bindClicks(document);

        click(rows.docRow.querySelector('b'));

        expect(openDocument.mock.calls).toEqual([['88']]);
        expect(openEncounter).not.toHaveBeenCalled();
        binding.dispose();
    });

    test('nested buttons and links keep native activation even without their own stopPropagation', () => {
        const rows = renderNestedRows();
        const { openEncounter, openDocument, binding } = bindClicks(document);

        const fromLabel = click(rows.followUpLabel);
        const fromKeyboard = click(rows.followUp, { detail: 0 });

        expect(openEncounter).not.toHaveBeenCalled();
        expect(openDocument).not.toHaveBeenCalled();
        expect(fromLabel.defaultPrevented).toBe(false);
        expect(fromKeyboard.defaultPrevented).toBe(false);
        binding.dispose();
    });

    test('row clicks another handler already claimed, or non-primary buttons, do not route', () => {
        const rows = renderNestedRows();
        const { openEncounter, openDocument, binding } = bindClicks(document);
        rows.forms.addEventListener('click', (event) => event.preventDefault());

        click(rows.forms);
        click(rows.docRow, { button: 1 });

        expect(openEncounter).not.toHaveBeenCalled();
        expect(openDocument).not.toHaveBeenCalled();
        binding.dispose();
    });

    test('modifier clicks on plain row content still open the row, as the original handlers did', () => {
        const rows = renderNestedRows();
        const { openEncounter, openDocument, binding } = bindClicks(document);

        click(rows.forms, { shiftKey: true });
        click(rows.docRow, { ctrlKey: true });

        expect(openEncounter.mock.calls).toEqual([['42~2026-03-04']]);
        expect(openDocument.mock.calls).toEqual([['88']]);
        binding.dispose();
    });

    test('rows outside the bound container are not routed', () => {
        const rows = renderNestedRows();
        const container = document.createElement('div');
        document.body.appendChild(container);
        const { openEncounter, openDocument, binding } = bindClicks(container);

        click(rows.forms);

        expect(openEncounter).not.toHaveBeenCalled();
        expect(openDocument).not.toHaveBeenCalled();
        binding.dispose();
    });

    test('keyboard Enter on the focused row and its click path together open it once', () => {
        const rows = renderNestedRows();
        const keys = bind(document);
        const clicks = bindRowClicks(document, { openEncounter: keys.openEncounter, openDocument: keys.openDocument });

        // Rows are not native controls, so Enter on one produces no synthetic click.
        press(rows.docRow, 'Enter');
        press(rows.docRow, 'Enter', { repeat: true });

        expect(keys.openDocument.mock.calls).toEqual([['88']]);
        expect(keys.openEncounter).not.toHaveBeenCalled();
        keys.binding.dispose();
        clicks.dispose();
    });

    test('binding twice reuses one click listener, and dispose removes it', () => {
        const rows = renderNestedRows();
        const first = bindClicks(document);
        expect(bindRowClicks(document, { openEncounter: jest.fn(), openDocument: jest.fn() })).toBe(first.binding);

        click(rows.docRow);
        first.binding.dispose();
        click(rows.docRow);

        expect(first.openDocument).toHaveBeenCalledTimes(1);
    });
});

test('the module publishes its API on window for the page script', () => {
    expect(window.oeVisitHistory.bindRowKeyboard).toBe(bindRowKeyboard);
    expect(window.oeVisitHistory.bindRowClicks).toBe(bindRowClicks);
});

test('Visit History loads the module with a strict per-file version and hands it the page routers', () => {
    const php = page();
    const url = php.split('\n').find(line => line.includes('/interface/clinical-workspace/visit-history.js?v='));
    expect(url).toBeDefined();
    expect(url).toContain("attr_url($clinicalAssets->version('visit-history.js'))");
    expect(url).toMatch(/\bdefer\b/);
    expect(php).toMatch(/oeVisitHistory\.bindRowKeyboard\(document, \{\s*openEncounter: toencounter,\s*openDocument: todocument\s*\}\)/);
    expect(php).not.toMatch(/\.encrow, \.docrow"\)\.on\("keydown"/);
    expect(php).toMatch(/oeVisitHistory\.bindRowClicks\(document, \{\s*openEncounter: toencounter,\s*openDocument: todocument\s*\}\)/);
    // Per-element click handlers made a nested document link fire href + todocument + toencounter.
    // They survive only as the fallback for when the module failed to load.
    const wiring = php.slice(php.indexOf('if (window.oeVisitHistory) {'));
    const fallback = wiring.slice(wiring.indexOf('} else {'), wiring.indexOf('$(".billing_note_text")'));
    expect(wiring.indexOf('oeVisitHistory.bindRowClicks(')).toBeLessThan(wiring.indexOf('} else {'));
    expect(fallback).toContain('$(".encrow").on("click", function() { toencounter(this.id); });');
    expect(fallback).toContain('$(".docrow").on("click", function() { todocument(this.id); });');
    expect(php.split('$(".encrow").on("click"').length - 1).toBe(1);
    expect(php.split('$(".docrow").on("click"').length - 1).toBe(1);
    expect(php).toContain('<a href=\'$docHref\' onclick=\'top.restoreSession()\' >');
});
