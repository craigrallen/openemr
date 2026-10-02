/**
 * @jest-environment jsdom
 */
/* global __dirname */

const fs = require('fs');
const path = require('path');
const { bindRowKeyboard } = require('../../interface/clinical-workspace/visit-history.js');

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

function press(target, key) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
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

test('the module publishes its API on window for the page script', () => {
    expect(window.oeVisitHistory.bindRowKeyboard).toBe(bindRowKeyboard);
});

test('Visit History loads the module with a strict per-file version and hands it the page routers', () => {
    const php = page();
    const url = php.split('\n').find(line => line.includes('/interface/clinical-workspace/visit-history.js?v='));
    expect(url).toBeDefined();
    expect(url).toContain("attr_url($clinicalAssets->version('visit-history.js'))");
    expect(url).toMatch(/\bdefer\b/);
    expect(php).toMatch(/oeVisitHistory\.bindRowKeyboard\(document, \{\s*openEncounter: toencounter,\s*openDocument: todocument\s*\}\)/);
    expect(php).not.toMatch(/\.encrow, \.docrow"\)\.on\("keydown"/);
    expect(php).toContain('$(".encrow").on("click", function() { toencounter(this.id); });');
    expect(php).toContain('$(".docrow").on("click", function() { todocument(this.id); });');
});
