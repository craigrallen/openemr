// Portable, source-derived contract for the native GAD-7 difficulty menu.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.resolve(__dirname, '../../interface/forms/gad7/gad7_javasrc.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const originalHash = '26c2eec6727deb76e68b0ff0557f4c762fdc85a2e98f2b64aaf637017182501a';
const oldLine = '        menu.onchange = "record_score_q8(my_form.difficulty.value);changes_made = true;" ;';
const fixedLine = '        menu.onchange = function () { record_score_q8(this.value); changes_made = true; };';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function nativePage() {
    const form = {};
    class Element {
        constructor(tag) {
            this.tagName = tag;
            this.children = [];
            this.parentNode = null;
            this.options = [];
            this._onchange = null;
            this._value = undefined;
        }
        appendChild(child) {
            if (child.parentNode) child.remove();
            this.children.push(child);
            child.parentNode = this;
            return child;
        }
        remove() {
            if (!this.parentNode) return;
            const siblings = this.parentNode.children;
            siblings.splice(siblings.indexOf(this), 1);
            this.parentNode = null;
        }
        set length(count) { this.options.length = count; }
        get length() { return this.options.length; }
        set onchange(handler) { this._onchange = typeof handler === 'function' ? handler : null; }
        get onchange() { return this._onchange; }
        set value(value) { this._value = String(value); }
        get value() {
            if (this._value !== undefined) return this._value;
            const selected = this.options.find((option) => option && option.defaultSelected);
            return selected ? selected.value : this.options[0]?.value;
        }
        dispatchEvent(event) {
            if (event.type === 'change' && this.onchange) this.onchange.call(this, event);
            return true;
        }
    }
    const root = new Element('form');
    const q8Place = root.appendChild(new Element('span'));
    const scorePlace = root.appendChild(new Element('span'));
    Object.defineProperty(form, 'difficulty', {
        get() { return root.children.find((node) => node.name === 'difficulty'); },
    });
    const document = {
        my_form: form,
        createElement: (tag) => new Element(tag),
        createTextNode: (value) => ({ textContent: value, parentNode: null, remove() {} }),
        getElementById: (id) => id === 'q8_place' ? q8Place : id === 'show_gad7_score' ? scorePlace : null,
    };
    const context = vm.createContext({
        document,
        my_form: form,
        gad7_score: 0,
        xl: (text) => text,
        Option: function Option(label, value) { this.label = label; this.value = value; this.defaultSelected = false; },
        create_q8(question, menu) {
            question.appendChild(document.createTextNode('Difficulty'));
            ['undef', '0', '1', '2', '3'].forEach((value, index) => {
                menu.options[index] = new context.Option(value, value);
            });
        },
    });
    vm.runInContext(source, context, { filename: sourcePath });
    const recorded = [];
    const nativeRecord = context.record_score_q8;
    context.record_score_q8 = function (value) {
        recorded.push(value);
        return nativeRecord(value);
    };
    return { context, form, root, recorded };
}

const failures = [];
let count = 0;
function check(name, body) {
    count++;
    try { body(); } catch (error) { failures.push({ name, message: error.message }); }
}

check('inverse guard permits only the exact handler replacement', () => {
    const isOriginal = hash(source) === originalHash;
    if (isOriginal) {
        assert.equal(source.split(oldLine).length, 2);
        const prospective = source.replace(oldLine, fixedLine);
        assert.notEqual(prospective, source);
        assert.equal(prospective.replace(fixedLine, oldLine), source);
        assert.equal(hash(prospective.replace(fixedLine, oldLine)), originalHash);
    } else {
        assert.equal(source.split(fixedLine).length, 2);
        const reversed = source.replace(fixedLine, oldLine);
        assert.equal(hash(reversed), originalHash);
        assert.equal(reversed.replace(oldLine, fixedLine), source);
    }
});

check('new form startup stays clean with no difficulty menu', () => {
    const { context, form, recorded } = nativePage();
    context.update_score('undef', 0);
    assert.equal(form.difficulty, undefined);
    assert.equal(context.changes_made, false);
    assert.equal(recorded.length, 0);
});

check('edit startup preserves the saved difficulty selection without dirtying', () => {
    const { context, form, recorded } = nativePage();
    context.gad7_score = 4;
    context.manage_question_8(2);
    context.update_score('undef', 4);
    assert.equal(form.difficulty.value, '2');
    assert.equal(form.difficulty.options[3].defaultSelected, true);
    assert.equal(context.gad7_score, 4);
    assert.equal(context.changes_made, false);
    assert.equal(recorded.length, 0);
});

for (const value of ['0', '1', '2', '3', 'undef']) {
    check(`native change records ${value} exactly once without changing the GAD-7 total`, () => {
        const { context, form, recorded } = nativePage();
        context.update_score(0, 1);
        const menu = form.difficulty;
        assert.equal(typeof menu.onchange, 'function');
        const firstSeven = Array.from(context.all_scores.slice(0, 7));
        const total = context.gad7_score;
        menu.value = value;
        menu.dispatchEvent({ type: 'change' });
        assert.equal(recorded.length, 1);
        assert.equal(recorded[0], value);
        if (value === 'undef') assert.ok(Number.isNaN(context.all_scores[7]));
        else assert.equal(context.all_scores[7], Number(value));
        assert.equal(context.changes_made, true);
        assert.deepEqual(Array.from(context.all_scores.slice(0, 7)), firstSeven);
        assert.equal(context.gad7_score, total);
    });
}

check('score zero removes the menu and its question', () => {
    const { context, form, root } = nativePage();
    context.update_score(0, 1);
    const menu = form.difficulty;
    const question = context.question;
    context.update_score(0, 0);
    assert.equal(form.difficulty, undefined);
    assert.equal(menu.parentNode, null);
    assert.equal(question.parentNode, null);
    assert.equal(root.children.includes(menu), false);
    assert.equal(context.q8_gone, true);
});

check('recreated menu receives a fresh callable handler', () => {
    const { context, form, recorded } = nativePage();
    context.update_score(0, 1);
    const first = form.difficulty;
    context.update_score(0, 0);
    context.update_score(0, 1);
    const second = form.difficulty;
    assert.notEqual(second, first);
    assert.equal(typeof second.onchange, 'function');
    second.value = '3';
    second.dispatchEvent({ type: 'change' });
    assert.deepEqual(recorded, ['3']);
    assert.equal(context.all_scores[7], 3);
});

check('detached menu handler reads its own value, not the current form menu', () => {
    const { context, form, recorded } = nativePage();
    context.update_score(0, 1);
    const detached = form.difficulty;
    context.update_score(0, 0);
    context.update_score(0, 1);
    form.difficulty.value = '3';
    detached.value = '2';
    detached.dispatchEvent({ type: 'change' });
    assert.deepEqual(recorded, ['2']);
    assert.equal(context.all_scores[7], 2);
    assert.equal(context.changes_made, true);
});

process.stdout.write(JSON.stringify({ count, failures }) + '\n');
if (failures.length) process.exitCode = 1;
