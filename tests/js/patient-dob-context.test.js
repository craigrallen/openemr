/** @jest-environment jsdom */
// Persistent DOB context in the workbench patient header. Drives the real
// left_nav.setPatient proxy, the real patient_data_view_model and the real
// PHP-rendered patient-data-template, so the header shows exactly what the
// authorized chart pages publish through setPatient.
const ko = require('knockout');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const harness = path.join(__dirname, 'fixtures/patient-data-template-harness.php');
const handlers = ['refreshPatient', 'clearPatient', 'clickEncounterList', 'clickNewEncounter', 'chooseEncounterEvent',
    'reviewEncounterEvent', 'refreshEncounter'];

function renderTemplate(variant) {
    const html = execFileSync('php', [harness, variant], { encoding: 'utf8' });
    return html.match(/<script type="text\/html" id="patient-data-template">([\s\S]*?)<\/script>/)[1];
}

// Loads the browser scripts into one scope with the shell globals they expect
// and returns the real left_nav proxy.
function loadProxies(app) {
    const source = ['patient_data_view_model.js', 'frame_proxies.js']
        .map(file => fs.readFileSync(path.join(root, 'interface/main/tabs/js', file), 'utf8'))
        .join('\n');
    const globals = {
        ko,
        app_view_model: app,
        webroot_url: '',
        patient_picture_default_url: '/images/patient-picture-default.png',
        WindowTitleAddPatient: false,
        navigateTab: jest.fn(),
        tabCloseByName: jest.fn(),
        activateTabByName: jest.fn(),
    };
    return new Function(...Object.keys(globals), `${source}\nreturn left_nav;`)(...Object.values(globals));
}

let app;
let leftNav;
function mount(variant) {
    handlers.forEach(name => { window[name] = jest.fn(); });
    document.body.innerHTML = '<div id="mainBox"><div id="attendantData"><div data-bind="template: {name: \'tpl\', data: application_data}"></div></div></div>';
    const script = document.createElement('script');
    script.type = 'text/html';
    script.id = 'tpl';
    script.text = renderTemplate(variant);
    document.head.appendChild(script);
    app = {
        application_data: { patient: ko.observable(null), therapy_group: ko.observable(null), user: ko.observable(null) },
        attendant_template_type: ko.observable('patient-data-template'),
    };
    leftNav = loadProxies(app);
    ko.applyBindings(app, document.getElementById('attendantData'));
    return document.getElementById('attendantData');
}
afterEach(() => {
    ko.cleanNode(document.body);
    document.head.innerHTML = '';
    document.body.innerHTML = '';
});

const dob = box => box.querySelector('.workbench-identity-dob');
const dobText = box => (dob(box) ? dob(box).textContent.replace(/\s+/g, ' ').trim() : null);
const DOE_DOB = ' DOB: 1980-01-02 Age: 46';

describe.each(['btn', 'text-large', 'default'])('patient_name_display=%s DOB context', variant => {
    test('renders the published DOB beside the name and record ID', () => {
        const box = mount(variant);
        leftNav.setPatient('Jane Doe', 1, 'PUB-1', '', DOE_DOB, false);
        const identity = box.querySelector('.workbench-identity-patient');
        expect(identity.textContent).toContain('Jane Doe');
        expect(identity.textContent).toContain('PUB-1');
        expect(identity.contains(dob(box))).toBe(true);
        expect(dobText(box)).toBe('DOB: 1980-01-02 Age: 46');
        expect(dob(box).getAttribute('data-dob-state')).toBe('known');
    });

    // pnotes_full.php and pnotes_full_add.php republish the open patient with
    // str_dob = null. That means "not supplied", not "DOB removed".
    test('a same-patient refresh that omits DOB keeps the known DOB', () => {
        const box = mount(variant);
        leftNav.setPatient('Jane Doe', 1, 'PUB-1', '', DOE_DOB, false);
        leftNav.setPatient('Jane Doe', 1, 'PUB-1', 'pnotes', null, false);
        expect(dobText(box)).toBe('DOB: 1980-01-02 Age: 46');
        leftNav.setPatient('Jane Doe', 1, 'PUB-1', '', undefined, false);
        expect(dobText(box)).toBe('DOB: 1980-01-02 Age: 46');
    });

    test('a same-patient refresh with a new DOB string replaces it', () => {
        const box = mount(variant);
        leftNav.setPatient('Jane Doe', 1, 'PUB-1', '', DOE_DOB, false);
        leftNav.setPatient('Jane Doe', 1, 'PUB-1', '', ' DOB: 1980-01-03 Age: 46', false);
        expect(dobText(box)).toBe('DOB: 1980-01-03 Age: 46');
    });

    test('a patient opened without a DOB shows a translated unknown state, not the previous DOB', () => {
        const box = mount(variant);
        leftNav.setPatient('Jane Doe', 1, 'PUB-1', '', DOE_DOB, false);
        leftNav.setPatient('Rick Roe', 2, 'PUB-2', 'pnotes', null, false);
        expect(box.textContent).not.toContain('1980-01-02');
        expect(dobText(box)).toBe('DOB: Unknown');
        expect(dob(box).getAttribute('data-dob-state')).toBe('unknown');
    });

    test.each([['empty', ''], ['whitespace', '   '], ['undefined', undefined]])('%s DOB is shown as unknown', (_label, value) => {
        const box = mount(variant);
        leftNav.setPatient('Rick Roe', 2, 'PUB-2', '', value, false);
        expect(dobText(box)).toBe('DOB: Unknown');
    });

    test('same-name patients are discriminated by record ID and DOB on switch', () => {
        const box = mount(variant);
        leftNav.setPatient('Jane Doe', 1, 'PUB-1', '', DOE_DOB, false);
        leftNav.setPatient('Jane Doe', 3, 'PUB-3', '', ' DOB: 1991-07-08 Age: 35', false);
        const text = box.textContent;
        expect(text).toContain('Jane Doe');
        expect(text).toContain('PUB-3');
        expect(text).toContain('1991-07-08');
        expect(text).not.toContain('PUB-1');
        expect(text).not.toContain('1980-01-02');
    });

    test('clearing the patient removes DOB and unknown text', () => {
        const box = mount(variant);
        leftNav.setPatient('Jane Doe', 1, 'PUB-1', '', DOE_DOB, false);
        app.application_data.patient(null);
        expect(dob(box)).toBeNull();
        expect(box.textContent).not.toContain('1980-01-02');
        expect(box.textContent).not.toContain('Unknown');
    });

    test('no patient renders no DOB context', () => {
        const box = mount(variant);
        expect(dob(box)).toBeNull();
    });

    test('DOB markup is escaped as text', () => {
        const box = mount(variant);
        leftNav.setPatient('Jane Doe', 1, 'PUB-1', '', '<img src=x onerror="window.pwned=1">', false);
        expect(dob(box).querySelector('img')).toBeNull();
        expect(dobText(box)).toBe('<img src=x onerror="window.pwned=1">');
        expect(window.pwned).toBeUndefined();
    });
});

// The chart pages (demographics.php, demographics_full.php, orders_results.php)
// build str_dob through PatientDobContext::headerString(). Run the real guard
// and pass its output into the real proxy and template.
const publisher = path.join(__dirname, 'fixtures/patient-dob-publisher-harness.php');
const publish = dobYmd => JSON.parse(execFileSync('php', [publisher, JSON.stringify(dobYmd)], { encoding: 'utf8' }));

describe('chart page DOB publisher', () => {
    test.each([
        ['SQL NULL', null],
        ['empty', ''],
        ['MySQL zero date', '0000-00-00'],
        ['zero year', '0000-01-01'],
        ['impossible day', '2020-02-30'],
        ['impossible month', '1980-13-01'],
        ['not Y-m-d', '01/02/1980'],
        ['trailing text', '1980-01-02x'],
    ])('%s DOB publishes an empty str_dob, not bare labels', (_label, value) => {
        expect(publish(value)).toBe('');
    });

    test.each([['ordinary', '1980-01-02'], ['leap day', '2000-02-29']])('%s DOB reaches the label builder unchanged', (_label, value) => {
        expect(publish(value)).toBe(` DOB: ${value}`);
    });

    test.each(['btn', 'text-large', 'default'])('%s: unknown DOB from the publisher shows Unknown and a same-patient null refresh keeps a valid DOB', variant => {
        const box = mount(variant);
        leftNav.setPatient('Rick Roe', 2, 'PUB-2', '', publish('0000-00-00'), false);
        expect(dobText(box)).toBe('DOB: Unknown');
        expect(dob(box).getAttribute('data-dob-state')).toBe('unknown');

        leftNav.setPatient('Jane Doe', 1, 'PUB-1', '', publish('1980-01-02'), false);
        expect(dobText(box)).toBe('DOB: 1980-01-02');
        leftNav.setPatient('Jane Doe', 1, 'PUB-1', 'pnotes', null, false);
        expect(dobText(box)).toBe('DOB: 1980-01-02');
        expect(dob(box).getAttribute('data-dob-state')).toBe('known');

        // An authoritative republish after the DOB was cleared in the record.
        leftNav.setPatient('Jane Doe', 1, 'PUB-1', '', publish(null), false);
        expect(dobText(box)).toBe('DOB: Unknown');
    });
});

test('main.php busts the cached frame_proxies.js with a new clinical UI token', () => {
    const php = fs.readFileSync(path.join(root, 'interface/main/tabs/main.php'), 'utf8');
    const token = php.match(/\$clinicalUiAssetVersion\s*=\s*'([^']+)'/)[1];
    expect(token).not.toBe('20261003-banner');
    expect(php).toContain("js/frame_proxies.js?v=<?php echo OEGlobalsBag::getInstance()->getString('v_js_includes'); ?>&clinical_ui=<?php echo $clinicalUiAssetVersion; ?>");
});

test.each([
    'interface/patient_file/summary/demographics.php',
    'interface/patient_file/summary/demographics_full.php',
    'interface/orders/orders_results.php',
])('%s publishes str_dob only through the DOB guard', file => {
    const php = fs.readFileSync(path.join(root, file), 'utf8');
    expect(php).toContain('use OpenEMR\\Patient\\PatientDobContext;');
    const calls = php.split('parent.left_nav.setPatient(').slice(1);
    expect(calls.length).toBeGreaterThan(0);
    calls.forEach(call => {
        const dobArg = call.slice(0, call.indexOf('hasPictureForPid'));
        expect(dobArg).toContain("PatientDobContext::headerString($result['DOB_YMD'] ?? null, fn(string $dob): string =>");
        expect(dobArg).not.toMatch(/oeFormatShortDate\(\$result\['DOB_YMD'\]\)/);
    });
});
