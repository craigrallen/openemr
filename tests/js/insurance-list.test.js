/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const $ = require('jquery');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const resultSource = () => read('interface/practice/ins_list.php');
let originalAlert;
let originalOpener;

test('portable node suite reports actual TAP pass/fail totals and successful exit', () => {
    const args = ['--test', '--test-reporter=tap', 'tests/clinical-ui/insurance-list-contract.cjs'];
    const child = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
    expect(child.error).toBeUndefined();
    const pass = Number(child.stdout.match(/^# pass (\d+)$/m)?.[1]);
    const fail = Number(child.stdout.match(/^# fail (\d+)$/m)?.[1]);
    const total = Number(child.stdout.match(/^# tests (\d+)$/m)?.[1]);
    expect(Number.isInteger(total)).toBe(true);
    expect(total).toBe(3);
    expect(pass + fail).toBe(total);
    expect(fail).toBe(0);
    expect(pass).toBe(total);
    expect(child.status).toBe(0);
});

function resultFragment() {
    // Only PHP is removed. This is inert source HTML, not a rendered route.
    return resultSource().replace(/<\?php[\s\S]*?\?>/g, '');
}

function embeddedStyle(fragment) {
    return fragment.match(/<style>([\s\S]*?)<\/style>/)?.[1];
}

function selectors(style) {
    return [...style.matchAll(/^ {2}(html\.oe-workbench-context [^{\n]+) \{$/gm)].map(match => match[1]);
}

beforeEach(() => {
    originalAlert = Object.getOwnPropertyDescriptor(window, 'alert');
    originalOpener = Object.getOwnPropertyDescriptor(window, 'opener');
    document.documentElement.className = '';
    document.body.innerHTML = '<div id="form_list"></div>';
    delete window.setins;
    delete window.dlgclose;
    delete window.alert;
    Object.defineProperty(window, 'opener', { configurable: true, value: null });
});

afterEach(() => {
    delete window.setins;
    delete window.dlgclose;
    if (originalAlert) Object.defineProperty(window, 'alert', originalAlert);
    else delete window.alert;
    if (originalOpener) Object.defineProperty(window, 'opener', originalOpener);
    else delete window.opener;
});

test('actual jQuery .load preserves the table, style and script inside the parent context', () => {
    document.documentElement.classList.add('oe-workbench-context');
    const previousAjax = $.ajax;
    const request = $.Deferred();
    $.ajax = jest.fn(() => request.promise());
    try {
        $('#form_list').load('ins_list.php?synthetic=1');
        expect($.ajax).toHaveBeenCalledWith(expect.objectContaining({ url: 'ins_list.php?synthetic=1', type: 'GET', dataType: 'html' }));
        const fragment = resultFragment();
        request.resolveWith(request, [fragment, 'success', request]);
        const container = document.querySelector('#form_list');
        expect(container.querySelector('table')).not.toBeNull();
        expect(container.querySelector('style')).not.toBeNull();
        const table = container.querySelector('table.oe-insurance-results');
        expect(table).not.toBeNull();
        expect(table.classList.contains('table-sm')).toBe(true);
        expect(container.querySelector('style')?.textContent).toContain('@media screen {');
        expect(container.querySelector('body')).toBeNull();
        expect(container.querySelector('html')).toBeNull();
        expect(container.querySelector('.body_top')).toBeNull();
        expect(document.documentElement.classList.contains('oe-workbench-context')).toBe(true);
        expect(typeof window.setins).toBe('function');
        const scoped = selectors(embeddedStyle(fragment));
        expect(scoped).toHaveLength(4);
        expect(scoped[0]).toBe('html.oe-workbench-context table.oe-insurance-results');
        expect(table.matches(scoped[0])).toBe(true);
        document.documentElement.classList.remove('oe-workbench-context');
        expect(scoped.every(selector => !table.matches(selector))).toBe(true);
    } finally {
        $.ajax = previousAjax;
    }
});

test('unchanged setins handles callback, message-only, closed and absent openers', () => {
    const script = resultFragment().match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toContain('function setins(ins_id, ins_name)');
    window.eval(script);
    const close = jest.fn();
    const alert = jest.fn();
    window.dlgclose = close;
    window.alert = alert;
    const callback = jest.fn();
    const postMessage = jest.fn();
    Object.defineProperty(window, 'opener', { configurable: true, value: { closed: false, set_insurance: callback, postMessage } });
    expect(window.setins(42, 'Payer')).toBe(false);
    expect(postMessage).toHaveBeenCalledWith({ action: 'insurance-search-set-insurance', insuranceId: 42, insuranceName: 'Payer' }, window.location.origin);
    expect(callback).toHaveBeenCalledWith(42, 'Payer');
    expect(close).toHaveBeenCalledTimes(1);

    callback.mockClear();
    close.mockClear();
    postMessage.mockClear();
    Object.defineProperty(window, 'opener', { configurable: true, value: { closed: false, postMessage } });
    expect(window.setins(7, 'Message only')).toBe(false);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);

    close.mockClear();
    postMessage.mockClear();
    Object.defineProperty(window, 'opener', { configurable: true, value: { closed: true, set_insurance: callback, postMessage } });
    expect(window.setins(8, 'Closed')).toBe(false);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('The target form was closed; I cannot apply your selection.');
    expect(callback).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();

    postMessage.mockClear();
    alert.mockClear();
    Object.defineProperty(window, 'opener', { configurable: true, value: null });
    expect(window.setins(9, 'Missing')).toBeUndefined();
    expect(postMessage).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
});
