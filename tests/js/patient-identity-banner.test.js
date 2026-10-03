/** @jest-environment jsdom */
const ko = require('knockout');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const harness = path.join(__dirname, 'fixtures/patient-data-template-harness.php');
const variants = ['btn', 'text-large', 'default'];

// Real template output for a patient_name_display variant, rendered by PHP.
function renderTemplate(variant) {
    const html = execFileSync('php', [harness, variant], { encoding: 'utf8' });
    const match = html.match(/<script type="text\/html" id="patient-data-template">([\s\S]*?)<\/script>/);
    return match[1];
}

const handlers = ['refreshPatient', 'clearPatient', 'clickEncounterList', 'clickNewEncounter', 'chooseEncounterEvent',
    'reviewEncounterEvent', 'refreshEncounter', 'viewMessages', 'viewPortalMail', 'viewPortalAudits',
    'viewPortalPayments', 'viewFaxCount', 'viewSmsCount'];

function patient() {
    const encounter = { id: ko.observable('42'), date: ko.observable('2026-10-01'), category: 'Office Visit' };
    return {
        pname: ko.observable('Doe, Jane'),
        pubpid: ko.observable('PUB-7'),
        str_dob: ko.observable('DOB: 1980-01-02 Age: 46'),
        patient_picture: ko.observable('/pic.png'),
        encounterArray: ko.observableArray([encounter]),
        selectedEncounter: ko.observable(encounter),
    };
}

function user() {
    return {
        messages: ko.observable(3), portal: ko.observable(true), portalAlerts: ko.observable(1), portalMail: ko.observable(1),
        portalAudits: ko.observable(0), portalPayments: ko.observable(0), servicesOther: ko.observable(true),
        serviceAlerts: ko.observable(2), faxAlerts: ko.observable(1), smsAlerts: ko.observable(1),
    };
}

let data;
function bind(variant, selected = patient()) {
    handlers.forEach(name => { window[name] = jest.fn(); });
    document.body.innerHTML = '<div id="mainBox"><div id="attendantData"><div data-bind="template: {name: \'tpl\', data: data}"></div></div></div>';
    const script = document.createElement('script');
    script.type = 'text/html';
    script.id = 'tpl';
    script.text = renderTemplate(variant);
    document.head.appendChild(script);
    data = { patient: ko.observable(selected), user: ko.observable(user()) };
    ko.applyBindings({ data }, document.getElementById('attendantData'));
    return document.getElementById('attendantData');
}
afterEach(() => {
    ko.cleanNode(document.body);
    document.head.innerHTML = '';
    document.body.innerHTML = '';
});

const accessibleName = el => el.getAttribute('aria-label')
    || Array.from(el.querySelectorAll('.sr-only')).map(s => s.textContent.trim()).join(' ');

describe.each(variants)('patient_name_display=%s identity banner', variant => {
    test('composes live name, labelled record ID, DOB and encounter as one horizontal banner', () => {
        const box = bind(variant);
        const banner = box.querySelector('.workbench-identity');
        expect(banner).not.toBeNull();
        const identity = banner.querySelector('[role="group"].workbench-identity-patient');
        expect(identity.getAttribute('aria-label')).toBe('Patient');
        const name = identity.querySelector('a.ptName');
        expect(name.querySelector('[data-bind="text: pname()"]').textContent).toBe('Doe, Jane');
        const id = identity.querySelector('.workbench-identity-id');
        expect(id.querySelector('.workbench-identity-label').textContent.trim()).toBe('External ID');
        expect(id.textContent).toContain('PUB-7');
        expect(identity.querySelector('.workbench-identity-dob').textContent.trim()).toBe('DOB: 1980-01-02 Age: 46');
        const encounter = banner.querySelector('[role="group"].workbench-identity-encounter');
        expect(encounter.getAttribute('aria-label')).toBe('Encounter');
        expect(encounter.querySelector('#pastEncounters').textContent).toContain('(1)');
        expect(encounter.querySelector('.patientCurrentEncounter').textContent).toContain('2026-10-01');
        expect(encounter.querySelector('.patientCurrentEncounter').textContent).toContain('(42)');
    });

    test('every icon-only control has an accessible name and decorative icons are hidden', () => {
        const box = bind(variant);
        const names = ['Close Patient Chart', 'Visit History', 'New Encounter', 'View Messages'];
        const controls = names.map(label => Array.from(box.querySelectorAll('a')).find(a => accessibleName(a) === label));
        controls.forEach((control, i) => expect([names[i], control]).not.toEqual([names[i], undefined]));
        box.querySelectorAll('.workbench-identity i.fa, .workbench-identity i.fas').forEach(icon => {
            expect(icon.getAttribute('aria-hidden')).toBe('true');
        });
        expect(Array.from(box.querySelectorAll('a')).find(a => accessibleName(a) === 'View Messages').textContent).toContain('3');
    });

    test('original bindings still drive patient, encounter and user actions', () => {
        const box = bind(variant);
        box.querySelector('a.ptName').click();
        expect(window.refreshPatient).toHaveBeenCalledTimes(1);
        Array.from(box.querySelectorAll('a')).find(a => accessibleName(a) === 'Close Patient Chart').click();
        expect(window.clearPatient).toHaveBeenCalledTimes(1);
        Array.from(box.querySelectorAll('a')).find(a => accessibleName(a) === 'Visit History').click();
        expect(window.clickEncounterList).toHaveBeenCalledTimes(1);
        Array.from(box.querySelectorAll('a')).find(a => accessibleName(a) === 'New Encounter').click();
        expect(window.clickNewEncounter).toHaveBeenCalledTimes(1);
        box.querySelector('.patientCurrentEncounter a').click();
        expect(window.refreshEncounter).toHaveBeenCalledTimes(1);
        expect(box.querySelector('#portalMsgAlerts')).not.toBeNull();
        expect(box.querySelector('#servicesMsgAlerts')).not.toBeNull();
    });

    test('unselected patient renders no identity content or empty labelled groups but keeps user alerts', () => {
        const box = bind(variant, null);
        expect(box.querySelector('.ptName')).toBeNull();
        expect(box.querySelectorAll('[role="group"]')).toHaveLength(0);
        expect(box.querySelector('.workbench-identity-label')).toBeNull();
        expect(box.querySelector('#portalMsgAlerts')).not.toBeNull();
        data.patient(patient());
        expect(box.querySelector('.ptName')).not.toBeNull();
        data.patient(null);
        expect(box.querySelector('.ptName')).toBeNull();
    });

    test('switching patient replaces name, ID, DOB and encounter with no stale identity', () => {
        const box = bind(variant);
        const encounter = { id: ko.observable('77'), date: ko.observable('2026-09-30'), category: 'Telehealth' };
        data.patient({
            pname: ko.observable('Roe, Rick'),
            pubpid: ko.observable('PUB-9'),
            str_dob: ko.observable('DOB: 1990-05-06 Age: 36'),
            patient_picture: ko.observable('/pic2.png'),
            encounterArray: ko.observableArray([encounter]),
            selectedEncounter: ko.observable(encounter),
        });
        const text = box.textContent;
        ['Doe, Jane', 'PUB-7', '1980-01-02', '2026-10-01', '(42)'].forEach(stale => expect(text).not.toContain(stale));
        ['Roe, Rick', 'PUB-9', '1990-05-06', '2026-09-30', '(77)'].forEach(fresh => expect(text).toContain(fresh));
    });

    test('patient with no encounters shows a zero count and no current encounter', () => {
        const empty = patient();
        empty.encounterArray([]);
        empty.selectedEncounter(null);
        const box = bind(variant, empty);
        const encounter = box.querySelector('[role="group"].workbench-identity-encounter');
        expect(encounter.querySelector('#pastEncounters').textContent).toContain('(0)');
        expect(box.querySelector('.patientCurrentEncounter')).toBeNull();
        expect(box.querySelector('[data-bind="click:chooseEncounterEvent"]')).toBeNull();
    });

    test('unselected encounter shows no current encounter date or ID', () => {
        const unselected = patient();
        unselected.selectedEncounter(null);
        const box = bind(variant, unselected);
        expect(box.querySelector('[data-bind="text:selectedEncounter().id()"]')).toBeNull();
        const current = box.querySelector('.patientCurrentEncounter');
        expect(current ? current.textContent : '').not.toContain('(42)');
        expect(box.querySelector('#pastEncounters').textContent).toContain('(1)');
    });

    test('encounter choose/review callbacks receive the encounter', () => {
        const box = bind(variant);
        const encounter = data.patient().encounterArray()[0];
        box.querySelector('[data-bind="click:chooseEncounterEvent"]').click();
        expect(window.chooseEncounterEvent).toHaveBeenCalledTimes(1);
        expect(window.chooseEncounterEvent.mock.calls[0][0]).toBe(encounter);
        box.querySelector('[data-bind="click:reviewEncounterEvent"]').click();
        expect(window.reviewEncounterEvent).toHaveBeenCalledTimes(1);
        expect(window.reviewEncounterEvent.mock.calls[0][0]).toBe(encounter);
    });

    test.each(['viewMessages', 'viewPortalMail', 'viewPortalAudits', 'viewPortalPayments', 'viewFaxCount', 'viewSmsCount'])(
        'user alert control %s fires its callback once',
        callback => {
            const box = bind(variant);
            box.querySelector(`[data-bind="click: ${callback}"]`).click();
            expect(window[callback]).toHaveBeenCalledTimes(1);
        },
    );
});

test('identity banner CSS is workbench-scoped, logical-direction and adaptive', () => {
    const css = fs.readFileSync(path.join(root, 'interface/main/tabs/css/workbench_shell.css'), 'utf8');
    const scope = '#mainBox:not\\(\\.workbench-legacy\\) #attendantData';
    expect(css).toMatch(new RegExp(`${scope} \\.workbench-identity\\s*\\{[^}]*display:\\s*flex[^}]*align-items:\\s*center[^}]*gap:`, 's'));
    expect(css).toMatch(new RegExp(`${scope} \\.workbench-identity-patient \\.ptName[^{]*\\{[^}]*font-size:\\s*18px[^}]*font-weight:\\s*700`, 's'));
    expect(css).toMatch(new RegExp(`${scope} \\.workbench-identity-label\\s*\\{[^}]*position:\\s*static[^}]*text-transform:\\s*uppercase`, 's'));
    expect(css).toMatch(new RegExp(`${scope} \\.workbench-identity-encounter\\s*\\{[^}]*border-inline-start:`, 's'));
    expect(css).toMatch(new RegExp(`${scope} \\.workbench-identity-user\\s*\\{[^}]*margin-inline:\\s*auto\\s+0`, 's'));
    // The banner's available width depends on the rail, not only the viewport
    // (1024px Chrome left a 568px banner), so the base rule must wrap at all widths.
    const base = css.slice(0, css.indexOf('@media (width <= 760px)'));
    expect(base).toMatch(new RegExp(`${scope} \\.workbench-identity\\s*\\{[^}]*flex-wrap:\\s*wrap`, 's'));
    expect(base).not.toMatch(new RegExp(`${scope} \\.workbench-identity[^{]*\\{[^}]*overflow:\\s*hidden`, 's'));
    const mobile = css.slice(css.indexOf('@media (width <= 760px)'));
    expect(mobile).toMatch(new RegExp(`${scope} \\.workbench-identity\\s*\\{[^}]*flex-wrap:\\s*wrap`, 's'));
    expect(mobile).toMatch(new RegExp(`${scope} \\.workbench-identity-encounter\\s*\\{[^}]*border-inline-start:\\s*0`, 's'));
    const identityRules = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^}]*workbench-identity[^{]*\{/g);
    identityRules.forEach(rule => expect(rule).toMatch(/#mainBox:not\(\.workbench-legacy\) #attendantData/));
    expect(identityRules.join('')).not.toMatch(/\b(left|right)\b/);
});
