/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createInstrumenter } = require('istanbul-lib-instrument');

const root = path.join(__dirname, '../..');
const scriptPath = path.join(root, 'interface/main/calendar/add_edit_event.js');
const editorPath = path.join(root, 'interface/main/calendar/add_edit_event.php');
const script = fs.readFileSync(scriptPath, 'utf8');
const instrumentedScript = createInstrumenter({
    coverageVariable: '__coverage__',
    esModules: false,
}).instrumentSync(script, scriptPath);

global.__coverage__ = global.__coverage__ || {};

function singleProviderSubmitSource() {
    const php = fs.readFileSync(editorPath, 'utf8');
    const startMarker = 'function SubmitForm() {';
    const branchEnd = '<?php } else { ?>';
    expect(php.split(startMarker)).toHaveLength(2);
    const start = php.indexOf(startMarker);
    const end = php.indexOf(branchEnd, start);
    expect(end).toBeGreaterThan(start);
    expect(php.indexOf(branchEnd, end + branchEnd.length)).toBe(-1);
    const branch = php.slice(start, end);
    expect(branch).toMatch(/^function SubmitForm\(\) \{\s*var f = document\.forms\[0\];/);
    expect(branch).toMatch(/<\?php if \(!\(OEGlobalsBag::getInstance\(\)->getBoolean\('select_multi_providers'\)\) && empty\(\$_GET\['prov'\]\)\)/);
    const javascript = branch.replace(/<\?php if \([^\n]*\?>/, '');
    expect(javascript).not.toContain('<?php');
    const footerStart = php.indexOf('return true;', end);
    const footerEnd = php.indexOf('\n}', footerStart);
    expect(footerStart).toBeGreaterThan(end);
    expect(footerEnd).toBeGreaterThan(footerStart);
    const footer = php.slice(footerStart, footerEnd + 2);
    expect(footer).toMatch(/^return true;\s*}$/);
    return `${javascript}\n${footer}`;
}

function loadEditor({ hour = '12', minute = '00', meridiem = '1', format = 1 } = {}) {
    const form = {
        form_date: { value: '2026-10-20' },
        form_hour: { value: hour },
        form_minute: { value: minute },
        form_duration: { value: '45' },
        form_provider: { value: '17' },
        facility: { value: '3' },
        form_category: { options: [{ value: '5' }], selectedIndex: 0 },
        form_action: { value: 'save' },
        form_repeat_exdate: { value: '2026-10-22' },
    };
    if (meridiem !== null) {
        form.form_ampm = { value: meridiem, selectedIndex: meridiem === '2' ? 1 : 0 };
    }
    const dialogs = [];
    const context = {
        document: { forms: [form] },
        addEditEventConfig: {
            timeDisplayFormat: format,
            dateDisplayFormat: 0,
            userId: 17,
            eid: 901,
            webRoot: '/openemr',
            translations: { availableAppointments: 'Available appointments' },
        },
        window: { location: { origin: 'https://example.test' } },
        top: { restoreSession: jest.fn() },
        $: jest.fn(() => ({ attr: jest.fn() })),
        dlgopen: jest.fn((...args) => dialogs.push(args)),
        URL,
        __coverage__: global.__coverage__,
    };
    vm.runInNewContext(instrumentedScript, context, { filename: scriptPath });
    return { form, context, dialogs };
}

describe('appointment editor midnight conversion', () => {
    test.each(Array.from({ length: 12 }, (_, index) => index + 1).flatMap((hour) => [
        [hour, '1', hour === 12 ? 0 : hour],
        [hour, '2', hour === 12 ? 12 : hour + 12],
    ]))('%i with meridiem %s maps to hour %i', (hour, meridiem, expectedHour) => {
        const { context } = loadEditor({ hour: String(hour), minute: '07', meridiem });
        expect(context.getAppointmentStartMinutes()).toBe(expectedHour * 60 + 7);
    });

    test.each([
        ['12', '00', '1', 0],
        ['12', '37', '1', 37],
        ['12', '37', '2', 757],
        ['0', '05', '1', 5],
    ])('preserves minutes for %s:%s meridiem %s', (hour, minute, meridiem, expected) => {
        const { context } = loadEditor({ hour, minute, meridiem });
        expect(context.getAppointmentStartMinutes()).toBe(expected);
    });

    test.each([
        ['0', '09', 9],
        ['12', '37', 757],
        ['23', '59', 1439],
    ])('24-hour display retains %s:%s without a meridiem control', (hour, minute, expected) => {
        const { context } = loadEditor({ hour, minute, meridiem: null, format: 0 });
        expect(context.getAppointmentStartMinutes()).toBe(expected);
    });

    test('retains the existing parseInt result for invalid hour or minute', () => {
        expect(Number.isNaN(loadEditor({ hour: 'bad' }).context.getAppointmentStartMinutes())).toBe(true);
        expect(Number.isNaN(loadEditor({ minute: 'bad' }).context.getAppointmentStartMinutes())).toBe(true);
    });

    test('the inline availability branch calls the external helper once', () => {
        const php = fs.readFileSync(editorPath, 'utf8');
        const start = php.indexOf('function SubmitForm()');
        const end = php.indexOf('return true;', start);
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
        const submit = php.slice(start, end);
        expect(submit.match(/getAppointmentStartMinutes\(\)/g)).toHaveLength(1);
        expect(submit).toMatch(/find_available\('&cktime='\s*\+\s*mins\)/);
        expect(submit).not.toMatch(/parseInt\(f\.form_hour\.value\)/);
        expect(submit).not.toMatch(/f\.form_ampm\.value\s*==\s*'2'/);
    });

    test.each([
        ['save', '12', '37', '1', 1, 37],
        ['duplicate', '12', '37', '1', 1, 37],
        ['save', '12', '37', '2', 1, 757],
        ['duplicate', '12', '37', '2', 1, 757],
        ['save', '23', '37', null, 0, 1417],
    ])('actual SubmitForm %s uses external conversion for %s:%s meridiem %s',
        (action, hour, minute, meridiem, format, expectedMinutes) => {
            const { form, context, dialogs } = loadEditor({ hour, minute, meridiem, format });
            form.form_action.value = action;
            form.submit = jest.fn();
            vm.runInNewContext(singleProviderSubmitSource(), context, { filename: editorPath });

            expect(context.SubmitForm()).toBe(true);
            expect(dialogs).toHaveLength(1);
            const [url, name] = dialogs[0];
            expect(name).toBe('find_appt_popup');
            expect(new URL(url, 'https://example.test').searchParams.get('cktime'))
                .toBe(String(expectedMinutes));
            expect(context.top.restoreSession).toHaveBeenCalledTimes(1);
            expect(form.submit).not.toHaveBeenCalled();
            const coverage = global.__coverage__[scriptPath];
            expect(coverage).toBeDefined();
            ['getAppointmentStartMinutes', 'find_available'].forEach((name) => {
                const entry = Object.entries(coverage.fnMap).find(([, meta]) => meta.name === name);
                expect(entry).toBeDefined();
                expect(coverage.f[entry[0]]).toBeGreaterThan(0);
            });
        });

    test('actual SubmitForm delete submits without checking availability', () => {
        const { form, context, dialogs } = loadEditor();
        form.form_action.value = 'delete';
        form.submit = jest.fn();
        vm.runInNewContext(singleProviderSubmitSource(), context, { filename: editorPath });

        expect(context.SubmitForm()).toBe(true);
        expect(dialogs).toHaveLength(0);
        expect(context.top.restoreSession).toHaveBeenCalledTimes(1);
        expect(form.submit).toHaveBeenCalledTimes(1);
    });

    test('setappt retains its existing zero-AM callback behavior and other form fields', () => {
        const { form, context } = loadEditor({ hour: '9', minute: '30' });
        const retained = {
            duration: form.form_duration.value,
            provider: form.form_provider.value,
            eid: context.addEditEventConfig.eid,
            recurrence: form.form_repeat_exdate.value,
        };
        context.setappt(2026, 10, 21, 0, 7);
        expect(form.form_date.value).toBe('2026-10-21');
        expect(form.form_hour.value).toBe(0);
        expect(form.form_ampm.selectedIndex).toBe(0);
        expect(form.form_minute.value).toBe('07');
        expect({
            duration: form.form_duration.value,
            provider: form.form_provider.value,
            eid: context.addEditEventConfig.eid,
            recurrence: form.form_repeat_exdate.value,
        }).toEqual(retained);
    });

    test('find_available forwards the edited date, duration, provider and eid without requests', () => {
        const { form, context, dialogs } = loadEditor();
        context.setappt(2026, 10, 21, 0, 7);
        context.find_available('&cktime=7');
        expect(dialogs).toHaveLength(1);
        const [url, name] = dialogs[0];
        const parsed = new URL(url, 'https://example.test');
        expect(name).toBe('find_appt_popup');
        expect(parsed.searchParams.get('startdate')).toBe(form.form_date.value);
        expect(parsed.searchParams.get('evdur')).toBe(form.form_duration.value);
        expect(parsed.searchParams.get('providerid')).toBe(form.form_provider.value);
        expect(parsed.searchParams.get('eid')).toBe(String(context.addEditEventConfig.eid));
        expect(url).toContain('&cktime=7');
    });
});
