const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../interface/main/calendar/find_patient_popup.php'), 'utf8');

function runPopup(ids) {
    const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
    const inline = scripts.at(-1)[1]
        .replace(/<\?php echo xlj\([^;]*; \?>/g, '"destination closed"')
        .replace(/<\?php[\s\S]*?\?>/g, '');
    assert.doesNotMatch(inline, /<\?php/);

    const calls = [];
    const handlers = new Map();
    const rows = ids.map((id) => ({ id, kind: 'row', classes: ['oneresult'] }));
    const buttons = rows.map((row) => ({ kind: 'button', row, classes: ['patient-select'] }));
    const search = { kind: 'search' };
    const form = { kind: 'form' };
    const searchby = { kind: 'searchby' };
    const spinner = { kind: 'spinner' };
    const submit = { kind: 'submit' };
    const noresult = { kind: 'noresult' };

    function wrap(elements) {
        const api = { 0: elements[0], length: elements.length };
        for (const name of ['click', 'keydown', 'mouseover', 'mouseout', 'submit']) {
            api[name] = (callback) => {
                for (const element of elements) handlers.set(element.kind + ':' + (element.id ?? rows.indexOf(element.row)) + ':' + name, callback);
                return api;
            };
        }
        api.on = (name, callback) => { for (const element of elements) handlers.set(element.kind + ':' + name, callback); return api; };
        api.focus = () => api;
        api.toggleClass = () => api;
        api.css = () => api;
        api.val = () => 'Last';
        api.datetimepicker = () => api;
        api.closest = (selector) => wrap(selector === '.oneresult' ? elements.map((element) => element.row).filter(Boolean) : []);
        return api;
    }
    function $(selector) {
        if (typeof selector === 'function') { selector(); return; }
        if (typeof selector === 'object') return wrap([selector]);
        return wrap({ '.oneresult': rows, '.patient-select': buttons, '.noresult': [noresult], '#searchparm': [search], '#theform': [form], '#submitbtn': [submit], '#searchspinner': [spinner], 'select[name="searchby"]': [searchby] }[selector] ?? []);
    }
    const context = { $, opener: { closed: false, setpatient: (...args) => calls.push(['setpatient', ...args]) }, dlgclose: () => calls.push(['close']), alert: (message) => calls.push(['alert', message]) };
    vm.runInNewContext(inline, context, { filename: 'find_patient_popup.php inline script' });

    function rowClick(row) {
        const callback = handlers.get('row:' + row.id + ':click');
        if (callback) callback.call(row);
    }
    function click(button) { rowClick(button.row); }
    function keydown(button, key, extra = {}) {
        const event = { key, repeat: false, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; }, ...extra };
        const callback = handlers.get('button:' + rows.indexOf(button.row) + ':keydown');
        if (callback) callback.call(button, event);
        if (!event.defaultPrevented && (key === 'Enter' || key === ' ')) click(button);
        return event;
    }
    return { calls, rows, buttons, handlers, click, rowClick, keydown };
}

test('source emits a native Name-cell button with original escaped name and billing note, keeping seven table columns and row payload', () => {
    assert.match(source, /<table class="table table-sm">[\s\S]*?<tbody id="searchResults">/);
    assert.equal((source.match(/<th class="sr(?:Name|Phone|CellPhone|Email|SS|DOB|ID)">/g) ?? []).length, 7);
    assert.match(source, /<tr class='" \. \$trClass \. "' id='" \.\s*attr\(\$iterpid \. "~" \. \$iterlname \. "~" \. \$iterfname \. "~" \. \$iterdob\)/);
    assert.match(source, /<td class='srName'>[\s\S]*?<button type='button' class='[^']*patient-select[^']*'>" \. text\(\$iterlname \. ", " \. \$iterfname \. " " \. \$itermname\) \. "<\/button>"/);
    assert.match(source, /echo "<br \/>" \. text\(\$iter\['billing_note'\]\)/);
    assert.doesNotMatch(source, /<tr[^>]*role=['"]button/);
});

test('native ready callbacks register and mouse or assistive click selects exactly once via row payload', () => {
    const popup = runPopup(['17~Able~Ada~2000-01-02']);
    assert.equal(typeof popup.handlers.get('row:17~Able~Ada~2000-01-02:click'), 'function');
    assert.equal(typeof popup.handlers.get('button:0:keydown'), 'function');
    popup.click(popup.buttons[0]);
    assert.deepEqual(popup.calls, [['setpatient', '17', 'Able', 'Ada', '2000-01-02'], ['close']]);
});

test('Enter and Space use their containing result row once and prevent native duplicate activation', () => {
    for (const key of ['Enter', ' ']) {
        const popup = runPopup(['1~Wrong~First~1990', '2~Right~Second~2001']);
        const event = popup.keydown(popup.buttons[1], key);
        assert.equal(event.defaultPrevented, true);
        assert.deepEqual(popup.calls, [['setpatient', '2', 'Right', 'Second', '2001'], ['close']]);
    }
});

test('repeat and every modifier suppress activation; unrelated keys stay untouched', () => {
    for (const extra of [{ repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }]) {
        for (const key of ['Enter', ' ']) {
            const popup = runPopup(['3~Name~Given~2002']);
            assert.equal(popup.keydown(popup.buttons[0], key, extra).defaultPrevented, true);
            assert.deepEqual(popup.calls, []);
        }
    }
    const popup = runPopup(['3~Name~Given~2002']);
    assert.equal(popup.keydown(popup.buttons[0], 'ArrowDown').defaultPrevented, false);
    assert.deepEqual(popup.calls, []);
});

test('no matches leaves no selection controls or row selection callbacks', () => {
    const popup = runPopup([]);
    assert.equal(popup.buttons.length, 0);
    assert.equal([...popup.handlers.keys()].filter((key) => key.startsWith('row:') || key.startsWith('button:')).length, 0);
    assert.deepEqual(popup.calls, []);
});
