// Portable PHQ-9 contract: run with `node tests/clinical-ui/phq9-difficulty-contract.cjs`.
// The small DOM below models native select.onchange assignment and change dispatch.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const nativePath = path.resolve(__dirname, '../../interface/forms/phq9/phq9_javasrc.js');
const original = '        menu.onchange = "record_score_q10(my_form.difficulty.value);";';
const replacement = '        menu.onchange = function () { record_score_q10(this.value); };';
const originalHash = '2f8be6a2784b9dfc61ad4e57219f1dba323956c20c411d08fdd70b90b53821c1';
const values = ['0', '1', '2', '3', 'undef'];
const failures = [];
let count = 0;

function check(name, action) {
    count++;
    try {
        action();
    } catch (error) {
        failures.push({ name, message: String(error && error.message || error) });
    }
}

function occurrences(source, fragment) {
    return source.split(fragment).length - 1;
}

let source;
check('full source has exactly the intended handler change', () => {
    source = fs.readFileSync(nativePath, 'utf8');
    const oldCount = occurrences(source, original);
    const newCount = occurrences(source, replacement);
    assert.equal(oldCount + newCount, 1, 'expected exactly one complete handler fragment');
    const baseline = newCount === 1 ? source.replace(replacement, original) : source;
    assert.equal(crypto.createHash('sha256').update(baseline).digest('hex'), originalHash,
        'full source differs beyond the intended handler');
});

// Faithful synthetic DOM for the native script. String assignment to an event-handler
// property is ignored; a callable receives the select as `this` on change dispatch.
function page() {
    assert.equal(typeof source, 'string');
    const nodes = [];
    function element(tag) {
        const node = {
            tag, parentNode: null, children: [],
            appendChild(child) {
                if (child.parentNode) child.remove();
                this.children.push(child);
                child.parentNode = this;
                return child;
            },
            remove() {
                if (this.parentNode) {
                    const siblings = this.parentNode.children;
                    siblings.splice(siblings.indexOf(this), 1);
                    this.parentNode = null;
                }
            },
        };
        if (tag === 'select') {
            node.options = [];
            node.value = '';
            let handler = null;
            Object.defineProperty(node, 'onchange', {
                get: () => handler,
                set: (value) => { handler = typeof value === 'function' ? value : null; },
            });
            node.dispatchChange = function () {
                if (this.onchange) this.onchange.call(this, { type: 'change', target: this });
            };
        }
        nodes.push(node);
        return node;
    }
    const form = element('form');
    const q10Place = element('span');
    const scorePlace = element('span');
    form.appendChild(q10Place);
    form.appendChild(scorePlace);
    Object.defineProperty(form, 'difficulty', {
        get: () => form.children.find((node) => node.tag === 'select' && node.name === 'difficulty') || null,
    });
    const document = {
        my_form: form,
        createElement: element,
        createTextNode: (text) => ({ text, parentNode: null, remove() {} }),
        getElementById: (id) => ({ q10_place: q10Place, show_phq9_score: scorePlace })[id],
    };
    const context = vm.createContext({ document, xl: (text) => text, phq9_score: 0 });
    context.create_q10 = (_question, menu) => {
        values.forEach((value, index) => {
            let selected = false;
            const option = { value };
            Object.defineProperty(option, 'defaultSelected', {
                get: () => selected,
                set: (state) => {
                    selected = state;
                    if (state) menu.value = value;
                },
            });
            menu.options[index] = option;
        });
    };
    vm.runInContext(source, context, { filename: nativePath });
    const recorded = [];
    const nativeRecorder = context.record_score_q10;
    context.record_score_q10 = (value) => {
        recorded.push(value);
        nativeRecorder(value);
    };
    return { context, form, recorded, nodes };
}

check('new form starts without optional difficulty or dirty global', () => {
    const { context, form, recorded } = page();
    context.update_score('undef', 0);
    assert.equal(form.difficulty, null);
    assert.equal(context.phq9_score, 0);
    assert.equal(context.all_answered.length, 9);
    assert.equal(Object.hasOwn(context, 'changes_made'), false);
    assert.deepEqual(recorded, []);
});

check('existing selection initializes without recording a change', () => {
    const { context, form, recorded } = page();
    context.phq9_score = 4;
    context.manage_question_10(2);
    context.update_score('undef', 4);
    assert.equal(form.difficulty.value, '2');
    assert.equal(form.difficulty.options[2].defaultSelected, true);
    assert.equal(context.phq9_score, 4);
    assert.deepEqual(recorded, []);
});

for (const value of values) {
    check(`new form native change records ${value} exactly once`, () => {
        const { context, form, recorded } = page();
        context.update_score(0, 1);
        const menu = form.difficulty;
        assert.equal(menu.options[4].defaultSelected, true);
        assert.equal(typeof menu.onchange, 'function');
        const beforeScores = Array.from(context.all_scores).slice(0, 9);
        const beforeAnswered = Array.from(context.all_answered);
        const beforeTotal = context.phq9_score;
        menu.value = value;
        menu.dispatchChange();
        assert.deepEqual(recorded, [value]);
        if (value === 'undef') assert.equal(Number.isNaN(context.all_scores[9]), true);
        else assert.equal(context.all_scores[9], Number(value));
        assert.deepEqual(Array.from(context.all_scores).slice(0, 9), beforeScores);
        assert.deepEqual(Array.from(context.all_answered), beforeAnswered);
        assert.equal(context.phq9_score, beforeTotal);
        assert.equal(Object.hasOwn(context, 'changes_made'), false);
    });
}

check('existing selection changes through its native handler', () => {
    const { context, form, recorded } = page();
    context.phq9_score = 3;
    context.all_scores[0] = 3;
    context.manage_question_10(1);
    form.difficulty.value = '2';
    form.difficulty.dispatchChange();
    assert.deepEqual(recorded, ['2']);
    assert.equal(context.all_scores[9], 2);
    assert.equal(context.phq9_score, 3);
});

check('zero removes difficulty and a later score recreates it', () => {
    const { context, form, recorded } = page();
    context.update_score(0, 1);
    const first = form.difficulty;
    const question = context.question;
    context.update_score(0, 0);
    assert.equal(form.difficulty, null);
    assert.equal(first.parentNode, null);
    assert.equal(question.parentNode, null);
    assert.equal(context.q10_gone, true);
    context.update_score(0, 2);
    assert.notEqual(form.difficulty, first);
    assert.equal(typeof form.difficulty.onchange, 'function');
    form.difficulty.value = '3';
    form.difficulty.dispatchChange();
    assert.deepEqual(recorded, ['3']);
    assert.equal(context.all_scores[9], 3);
});

check('detached select passes its own value instead of the current form value', () => {
    const { context, form, recorded } = page();
    context.update_score(0, 1);
    const detached = form.difficulty;
    context.update_score(0, 0);
    context.update_score(0, 1);
    form.difficulty.value = '3';
    detached.value = '2';
    detached.dispatchChange();
    assert.deepEqual(recorded, ['2']);
    assert.equal(context.all_scores[9], 2);
});

check('nine-item score update path remains intact', () => {
    const { context, form } = page();
    for (let index = 0; index < 9; index++) context.update_score(index, String(index % 4));
    assert.equal(context.phq9_score, 12);
    assert.deepEqual(Array.from(context.all_scores).slice(0, 9), [0, 1, 2, 3, 0, 1, 2, 3, 0]);
    assert.deepEqual(Array.from(context.all_answered), Array(9).fill(true));
    assert.notEqual(form.difficulty, null);
    context.update_score(1, 3);
    assert.equal(context.phq9_score, 14);
    assert.equal(context.all_scores[1], 3);
    assert.equal(context.all_scores[9], 0);
});

process.stdout.write(`${JSON.stringify({ count, failures })}\n`);
if (failures.length) process.exitCode = 1;
