/**
 * @jest-environment jsdom
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createInstrumenter } = require('istanbul-lib-instrument');

const nativePath = path.resolve(__dirname, '../../interface/forms/gad7/gad7_javasrc.js');
const contractPath = path.resolve(__dirname, '../clinical-ui/gad7-difficulty-contract.cjs');
const instrumenter = createInstrumenter({ coverageVariable: '__coverage__', esModules: false });
const nativeScript = instrumenter.instrumentSync(fs.readFileSync(nativePath, 'utf8'), nativePath);

window.__coverage__ = window.__coverage__ || {};
global.__coverage__ = window.__coverage__;

test('portable native GAD-7 difficulty contract', () => {
    const result = spawnSync(process.execPath, [contractPath], {
        encoding: 'utf8',
        timeout: 5000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    expect(result.stdout.trim()).not.toBe('');
    let report;
    try { report = JSON.parse(result.stdout.trim()); }
    catch (error) { throw new Error(`Invalid contract JSON: ${error.message}`); }
    expect(Object.keys(report).sort()).toEqual(['count', 'failures']);
    expect(report.count).toBe(11);
    expect(Array.isArray(report.failures)).toBe(true);
    for (const failure of report.failures) {
        expect(Object.keys(failure).sort()).toEqual(['message', 'name']);
        expect(typeof failure.name).toBe('string');
        expect(typeof failure.message).toBe('string');
    }
    if (result.status !== 0 || report.failures.length !== 0) {
        throw new Error(`GAD-7 contract exited ${result.status}: ${JSON.stringify(report.failures)}`);
    }
    expect(report.failures).toHaveLength(0);
});

function nativePage() {
    document.body.innerHTML = '<form name="my_form"><span id="q8_place"></span><span id="show_gad7_score"></span></form>';
    const form = document.forms.namedItem('my_form');
    // Supply the legacy named form and control lookups used by the native script.
    Object.defineProperty(document, 'my_form', { configurable: true, value: form });
    Object.defineProperty(form, 'difficulty', {
        configurable: true,
        get: () => form.querySelector('select[name="difficulty"]'),
    });
    window.xl = (value) => value;
    window.create_q8 = (question, menu) => {
        question.appendChild(document.createTextNode('Difficulty'));
        ['undef', '0', '1', '2', '3'].forEach((value, index) => {
            menu.options[index] = new Option(value, value);
        });
    };
    window.gad7_score = 0;
    window.eval(nativeScript);
    const recorded = [];
    const nativeRecord = window.record_score_q8;
    window.record_score_q8 = function (value) {
        recorded.push(value);
        return nativeRecord(value);
    };
    return { form, recorded };
}

afterEach(() => {
    document.body.innerHTML = '';
    delete document.my_form;
    delete window.create_q8;
    delete window.xl;
});

test('new form initialization leaves difficulty absent and clean', () => {
    const { form, recorded } = nativePage();
    window.update_score('undef', 0);
    expect(form.difficulty).toBeNull();
    expect(window.changes_made).toBe(false);
    expect(recorded).toHaveLength(0);
});

test('edit initialization retains the saved difficulty without a change event', () => {
    const { form, recorded } = nativePage();
    window.gad7_score = 4;
    window.manage_question_8(2);
    window.update_score('undef', 4);
    expect(form.difficulty.value).toBe('2');
    expect(form.difficulty.options[3].defaultSelected).toBe(true);
    expect(window.gad7_score).toBe(4);
    expect(window.changes_made).toBe(false);
    expect(recorded).toHaveLength(0);
});

for (const value of ['0', '1', '2', '3', 'undef']) {
    test(`real change event records ${value} once without changing the first seven scores or total`, () => {
        const { form, recorded } = nativePage();
        window.update_score(0, 1);
        const menu = form.difficulty;
        expect(typeof menu.onchange).toBe('function');
        const firstSeven = window.all_scores.slice(0, 7);
        const total = window.gad7_score;
        menu.value = value;
        menu.dispatchEvent(new Event('change', { bubbles: true }));
        expect(recorded).toEqual([value]);
        if (value === 'undef') expect(Number.isNaN(window.all_scores[7])).toBe(true);
        else expect(window.all_scores[7]).toBe(Number(value));
        expect(window.changes_made).toBe(true);
        expect(window.all_scores.slice(0, 7)).toEqual(firstSeven);
        expect(window.gad7_score).toBe(total);
    });
}

test('zero score removes the real menu and question', () => {
    const { form } = nativePage();
    window.update_score(0, 1);
    const menu = form.difficulty;
    const question = window.question;
    window.update_score(0, 0);
    expect(form.difficulty).toBeNull();
    expect(menu.isConnected).toBe(false);
    expect(question.isConnected).toBe(false);
    expect(window.q8_gone).toBe(true);
});

test('recreated menu has a callable handler that records its own value', () => {
    const { form, recorded } = nativePage();
    window.update_score(0, 1);
    const first = form.difficulty;
    window.update_score(0, 0);
    window.update_score(0, 1);
    const second = form.difficulty;
    expect(second).not.toBe(first);
    expect(typeof second.onchange).toBe('function');
    second.value = '3';
    second.dispatchEvent(new Event('change', { bubbles: true }));
    expect(recorded).toEqual(['3']);
    expect(window.all_scores[7]).toBe(3);
});

test('detached menu handler reads the detached menu value', () => {
    const { form, recorded } = nativePage();
    window.update_score(0, 1);
    const detached = form.difficulty;
    window.update_score(0, 0);
    window.update_score(0, 1);
    form.difficulty.value = '3';
    detached.value = '2';
    detached.dispatchEvent(new Event('change', { bubbles: true }));
    expect(recorded).toEqual(['2']);
    expect(window.all_scores[7]).toBe(2);
    expect(window.changes_made).toBe(true);
});

test('the native source path has executed handler line counters', () => {
    const { form } = nativePage();
    window.update_score(0, 1);
    form.difficulty.value = '1';
    form.difficulty.dispatchEvent(new Event('change', { bubbles: true }));
    const coverage = window.__coverage__[nativePath];
    expect(coverage).toBeDefined();
    const handlerStatements = Object.entries(coverage.statementMap)
        .filter(([, location]) => location.start.line === 44);
    // The fixed line contains the assignment and both statements inside its callback.
    expect(handlerStatements.length).toBeGreaterThanOrEqual(3);
    for (const [id] of handlerStatements) {
        expect(coverage.s[id]).toBeGreaterThan(0);
    }
});
