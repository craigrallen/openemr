/** @jest-environment jsdom */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createInstrumenter } = require('istanbul-lib-instrument');

const nativePath = path.resolve(__dirname, '../../interface/forms/phq9/phq9_javasrc.js');
const contractPath = path.resolve(__dirname, '../clinical-ui/phq9-difficulty-contract.cjs');
const instrumenter = createInstrumenter({ coverageVariable: '__coverage__', esModules: false });
const nativeScript = instrumenter.instrumentSync(fs.readFileSync(nativePath, 'utf8'), nativePath);

window.__coverage__ = window.__coverage__ || {};
global.__coverage__ = window.__coverage__;

test('portable native PHQ-9 difficulty contract', () => {
    const result = spawnSync(process.execPath, [contractPath], {
        encoding: 'utf8', timeout: 5000,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe('');
    expect(result.stdout.trim()).not.toBe('');
    let report;
    try {
        report = JSON.parse(result.stdout.trim());
    } catch (error) {
        throw new Error(`Invalid contract JSON: ${error.message}`);
    }
    expect(Object.keys(report).sort()).toEqual(['count', 'failures']);
    expect(report.count).toBe(12);
    expect(Array.isArray(report.failures)).toBe(true);
    for (const failure of report.failures) {
        expect(Object.keys(failure).sort()).toEqual(['message', 'name']);
        expect(typeof failure.name).toBe('string');
        expect(typeof failure.message).toBe('string');
    }
    if (result.status !== 0 || report.failures.length !== 0) {
        throw new Error(`PHQ-9 contract exited ${result.status}: ${JSON.stringify(report.failures)}`);
    }
});

function nativePage() {
    document.body.innerHTML = '<form name="my_form"><span id="q10_place"></span><span id="show_phq9_score"></span></form>';
    const form = document.forms.namedItem('my_form');
    Object.defineProperty(document, 'my_form', { configurable: true, value: form });
    Object.defineProperty(form, 'difficulty', {
        configurable: true,
        get: () => form.querySelector('select[name="difficulty"]'),
    });
    window.xl = (value) => value;
    window.create_q10 = (question, menu) => {
        question.appendChild(document.createTextNode('Difficulty'));
        ['0', '1', '2', '3', 'undef'].forEach((value, index) => {
            menu.options[index] = new Option(value, value);
        });
    };
    window.phq9_score = 0;
    window.eval(nativeScript);
    const recorded = [];
    const nativeRecorder = window.record_score_q10;
    window.record_score_q10 = function (value) {
        recorded.push(value);
        return nativeRecorder(value);
    };
    return { form, recorded };
}

afterEach(() => {
    document.body.innerHTML = '';
    delete document.my_form;
    delete window.create_q10;
    delete window.xl;
});

test('new form starts with no difficulty and no dirty flag', () => {
    const { form, recorded } = nativePage();
    window.update_score('undef', 0);
    expect(form.difficulty).toBeNull();
    expect(window.all_answered).toHaveLength(9);
    expect(Object.hasOwn(window, 'changes_made')).toBe(false);
    expect(recorded).toEqual([]);
});

test('edit form displays the saved difficulty without firing change', () => {
    const { form, recorded } = nativePage();
    window.phq9_score = 4;
    window.manage_question_10(2);
    window.update_score('undef', 4);
    expect(form.difficulty.value).toBe('2');
    expect(form.difficulty.options[2].defaultSelected).toBe(true);
    expect(window.phq9_score).toBe(4);
    expect(recorded).toEqual([]);
});

for (const value of ['0', '1', '2', '3', 'undef']) {
    test(`native change event records ${value} once and excludes it from the score`, () => {
        const { form, recorded } = nativePage();
        window.update_score(0, 1);
        const menu = form.difficulty;
        expect(menu.options[4].defaultSelected).toBe(true);
        expect(typeof menu.onchange).toBe('function');
        const firstNine = window.all_scores.slice(0, 9);
        const answered = window.all_answered.slice();
        const total = window.phq9_score;
        menu.value = value;
        menu.dispatchEvent(new Event('change', { bubbles: true }));
        expect(recorded).toEqual([value]);
        if (value === 'undef') expect(Number.isNaN(window.all_scores[9])).toBe(true);
        else expect(window.all_scores[9]).toBe(Number(value));
        expect(window.all_scores.slice(0, 9)).toEqual(firstNine);
        expect(window.all_answered).toEqual(answered);
        expect(window.phq9_score).toBe(total);
        expect(Object.hasOwn(window, 'changes_made')).toBe(false);
    });
}

test('edit form change updates the existing difficulty score', () => {
    const { form, recorded } = nativePage();
    window.phq9_score = 3;
    window.all_scores[0] = 3;
    window.manage_question_10(1);
    form.difficulty.value = '2';
    form.difficulty.dispatchEvent(new Event('change', { bubbles: true }));
    expect(recorded).toEqual(['2']);
    expect(window.all_scores[9]).toBe(2);
    expect(window.phq9_score).toBe(3);
});

test('zero removes the menu and a later score creates a working new menu', () => {
    const { form, recorded } = nativePage();
    window.update_score(0, 1);
    const first = form.difficulty;
    const question = window.question;
    window.update_score(0, 0);
    expect(form.difficulty).toBeNull();
    expect(first.isConnected).toBe(false);
    expect(question.isConnected).toBe(false);
    expect(window.q10_gone).toBe(true);
    window.update_score(0, 2);
    const second = form.difficulty;
    expect(second).not.toBe(first);
    expect(typeof second.onchange).toBe('function');
    second.value = '3';
    second.dispatchEvent(new Event('change', { bubbles: true }));
    expect(recorded).toEqual(['3']);
    expect(window.all_scores[9]).toBe(3);
});

test('detached menu change reads its own value', () => {
    const { form, recorded } = nativePage();
    window.update_score(0, 1);
    const first = form.difficulty;
    window.update_score(0, 0);
    window.update_score(0, 1);
    form.difficulty.value = '3';
    first.value = '2';
    first.dispatchEvent(new Event('change', { bubbles: true }));
    expect(recorded).toEqual(['2']);
    expect(window.all_scores[9]).toBe(2);
});

test('instrumented native handler assignment and callback executed', () => {
    const { form } = nativePage();
    window.update_score(0, 1);
    form.difficulty.value = '1';
    form.difficulty.dispatchEvent(new Event('change', { bubbles: true }));
    const coverage = window.__coverage__[nativePath];
    expect(coverage).toBeDefined();
    const handlerStatements = Object.entries(coverage.statementMap)
        .filter(([, location]) => location.start.line === 44);
    expect(handlerStatements.length).toBeGreaterThanOrEqual(2);
    for (const [id] of handlerStatements) expect(coverage.s[id]).toBeGreaterThan(0);
});
