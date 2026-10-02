/** @jest-environment jsdom */
const ko = require('knockout');
const fs = require('fs');
const path = require('path');

require('../../interface/main/tabs/js/menu_launcher.js');
require('../../interface/main/tabs/js/workbench_shell.js');

const Shell = window.OpenEMRWorkbenchShell;
const root = path.resolve(__dirname, '../..');

function liveMenu(objects, app) {
    const source = fs.readFileSync(path.join(root, 'templates/interface/main/tabs/menu_json.html.twig'), 'utf8');
    const body = source.match(/<script>([\s\S]*)<\/script>/)[1].replace('{{ menu_restrictions|json_encode }}', JSON.stringify(objects));
    new Function('ko', 'app_view_model', body)(ko, app);
    return app.application_data.menu;
}

const sample = [
    { label: 'Calendar', url: '/calendar', target: 'cal', requirement: 0, children: [] },
    { label: 'Patient', requirement: 1, children: [
        { label: 'Visits', requirement: 0, children: [
            { label: 'New Form', url: '/load_form.php?formname=x', target: 'enc', requirement: 2, children: [] },
            { label: 'Popup', url: '/popup', target: 'pop', requirement: 0, children: [] },
        ] },
    ] },
    { label: 'Admin', requirement: 0, children: [
        { label: 'Settings', url: '/settings', target: 'adm', requirement: 0, children: [] },
    ] },
];

let shell;
let app;
let dispatch;
function setup(objects = sample) {
    document.body.innerHTML = '<div id="mainBox"><nav><div id="mainMenu"></div><div role="group" aria-label="Work areas" data-workbench-areas><button type="button" data-workbench-area="Work" aria-pressed="false">Arbeit</button><button type="button" data-workbench-area="Patient" aria-pressed="false">Patient</button><button type="button" data-workbench-area="Practice" aria-pressed="false">Praxis</button></div><button data-workbench-mode data-workbench-label="Workbench navigation" data-legacy-label="Legacy navigation">Legacy navigation</button><button data-workbench-mobile-toggle>Navigation</button></nav><div id="workbench"><div data-workbench-backdrop></div><aside id="workbenchRail" data-msg-area-empty="Nothing in this area" data-msg-patient="Select a patient" data-msg-encounter="Select an encounter" data-msg-unavailable="Unavailable"><button data-workbench-mobile-close>Close</button><input type="search" data-workbench-search><p id="workbenchNotice" role="status" aria-live="polite" data-workbench-notice></p><div data-workbench-tree></div></aside><main id="workbenchContent"><div id="attendantData"></div><div class="workbench-content-head"></div><div id="tabs_div"></div><div id="mainFrames_div"><div id="framesDisplay"><iframe></iframe></div></div></main></div></div>';
    app = { application_data: { patient: ko.observable(null), therapy_group: ko.observable(null) } };
    const menu = liveMenu(objects, app);
    dispatch = jest.fn();
    shell = Shell.create({ root: document.querySelector('#mainBox'), menu, ko, dispatch, storage: { getItem: () => null, setItem: jest.fn() } });
    return menu;
}
afterEach(() => { if (shell) shell.destroy(); shell = null; document.body.innerHTML = ''; });

test('default rail accounts for every live action at arbitrary depth and uses original objects', () => {
    const menu = setup();
    const buttons = Array.from(document.querySelectorAll('[data-workbench-action]'));
    let eventTarget;
    dispatch.mockImplementation((item, event) => { eventTarget = event.currentTarget; });
    expect(buttons.map(b => b.textContent)).toEqual(['Calendar', 'New Form', 'Popup', 'Settings']);
    expect(document.querySelectorAll('[data-workbench-group]')).toHaveLength(3);
    buttons[0].click();
    expect(dispatch.mock.calls[0][0]).toBe(menu()[0]);
    expect(dispatch.mock.calls[0][1]).toBeInstanceOf(Event);
    expect(eventTarget).toBe(buttons[0]);
    expect(buttons[0].getAttribute('aria-current')).toBe('page');
});

test('live requirements include ancestors and reject popup before original dispatch', () => {
    const menu = setup();
    const findAction = label => Array.from(document.querySelectorAll('[data-workbench-action]')).find(b => b.textContent === label);
    let popup = findAction('Popup');
    expect(popup.getAttribute('aria-disabled')).toBe('true');
    popup.click();
    expect(dispatch).not.toHaveBeenCalled();
    app.application_data.patient({ selectedEncounter: ko.observable(null) });
    popup = findAction('Popup');
    expect(popup.getAttribute('aria-disabled')).toBe('false');
    popup.click();
    expect(dispatch).toHaveBeenCalledWith(menu()[1].children()[0].children()[1], expect.anything());
    let form = findAction('New Form');
    expect(form.getAttribute('aria-disabled')).toBe('true');
    app.application_data.patient().selectedEncounter({ id: 2 });
    form = findAction('New Form');
    expect(form.getAttribute('aria-disabled')).toBe('false');
});

test('search and runtime module refresh retain every live entry', () => {
    const menu = setup();
    const search = document.querySelector('[data-workbench-search]');
    search.value = 'new form';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(Array.from(document.querySelectorAll('[data-workbench-action]')).map(b => b.textContent)).toEqual(['New Form']);
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const dynamic = { label: ko.observable('Installed Form'), header: false, url: ko.observable('/dynamic'), target: 'enc', requirement: 0, enabled: ko.observable(true) };
    menu()[1].children()[0].children.push(dynamic);
    expect(Array.from(document.querySelectorAll('[data-workbench-action]')).map(b => b.textContent)).toContain('Installed Form');
    search.value = 'patient installed';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(Array.from(document.querySelectorAll('[data-workbench-action]')).map(b => b.textContent)).toEqual(['Installed Form']);
});

test.each(['standard.json', 'front_office.json', 'answering_service.json', 'chart_review.json'])(
    'every shipped %s role action appears exactly once in the live rail', filename => {
        const objects = JSON.parse(fs.readFileSync(path.join(root, 'interface/main/tabs/menu/menus', filename), 'utf8'));
        const menu = setup(objects);
        const entries = window.OpenEMRMenuLauncher.collectEntries(menu());
        const actions = document.querySelectorAll('[data-workbench-action]');
        expect(actions).toHaveLength(entries.length);
        expect(Array.from(actions).map(b => b.textContent).sort()).toEqual(entries.map(e => e.label).sort());
        expect(menu()[0].label()).toBe(objects[0].label);
    }
);

test('shipped Admin Clinic Calendar is reachable through the hierarchical sidebar', () => {
    const objects = JSON.parse(fs.readFileSync(path.join(root, 'interface/main/tabs/menu/menus/standard.json'), 'utf8'));
    setup(objects);
    const admin = Array.from(document.querySelectorAll('[data-workbench-tree] > section > details'))
        .find(branch => branch.querySelector(':scope > summary').textContent === 'Admin');
    expect(admin).toBeDefined();
    expect(admin.open).toBe(false);
    expect(admin.getAttribute('open')).toBeNull();
    admin.open = true;
    const clinic = Array.from(admin.querySelectorAll(':scope > .workbench-children > details'))
        .find(branch => branch.querySelector(':scope > summary').textContent === 'Clinic');
    expect(clinic).toBeDefined();
    clinic.open = true;
    const calendar = Array.from(clinic.querySelectorAll(':scope > .workbench-children > button[data-workbench-action]'))
        .find(button => button.textContent === 'Calendar');
    expect(calendar).toBeDefined();
    calendar.click();
    expect(dispatch).toHaveBeenCalledTimes(1);
});

test('legacy switch, mobile toggle, Escape and focus are accessible', () => {
    setup();
    const mode = document.querySelector('[data-workbench-mode]');
    mode.click();
    expect(document.querySelector('#mainBox').classList.contains('workbench-legacy')).toBe(true);
    mode.click();
    const toggle = document.querySelector('[data-workbench-mobile-toggle]');
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(document.querySelector('[data-workbench-search]'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
});

test('visible tab title follows the real tab observable', () => {
    setup();
    const title = document.createElement('span');
    title.setAttribute('data-workbench-title', '');
    document.querySelector('#mainBox').appendChild(title);
    shell.destroy();
    const tab = { title: ko.observable('Calendar'), visible: ko.observable(true) };
    const tabs = ko.observableArray([tab]);
    shell = Shell.create({ root: document.querySelector('#mainBox'), menu: app.application_data.menu, ko, tabs, dispatch, storage: { getItem: () => null, setItem: jest.fn() } });
    expect(title.textContent).toBe('Calendar');
    tab.title('Finder');
    expect(title.textContent).toBe('Finder');
});

test('workbench viewport chain is bounded and categories start collapsed', () => {
    setup();
    const css = fs.readFileSync(path.join(root, 'interface/main/tabs/css/workbench_shell.css'), 'utf8');
    expect(css).toMatch(/#mainBox:not\(\.workbench-legacy\)\s*\{[^}]*height:\s*100dvh/s);
    expect(css).toMatch(/#mainBox:not\(\.workbench-legacy\)\s*\{[^}]*overflow:\s*hidden/s);
    expect(css).toMatch(/#mainBox:not\(\.workbench-legacy\) \.workbench-rail\s*\{[^}]*overflow-y:\s*auto/s);
    expect(css).toMatch(/#mainBox:not\(\.workbench-legacy\) #framesDisplay[^}]*min-height:\s*0/s);
    expect(Array.from(document.querySelectorAll('.workbench-branch')).every(branch => !branch.open)).toBe(true);
});

test('without moveBefore, switching modes never reparents the live iframe or its ancestors', () => {
    setup();
    const box = document.querySelector('#mainBox');
    const ids = ['attendantData', 'tabs_div', 'mainFrames_div'];
    const nodes = ids.map(id => document.getElementById(id));
    const originalParents = nodes.map(node => node.parentElement);
    const insert = jest.spyOn(box, 'insertBefore');
    const boxAppend = jest.spyOn(box, 'appendChild');
    const main = document.querySelector('#workbenchContent');
    const append = jest.spyOn(main, 'appendChild');
    const mainInsert = jest.spyOn(main, 'insertBefore');
    document.querySelector('[data-workbench-mode]').click();
    expect(box.classList.contains('workbench-static-legacy')).toBe(true);
    expect(nodes.map(node => node.parentElement)).toEqual(originalParents);
    document.querySelector('[data-workbench-mode]').click();
    expect(nodes.map(node => node.parentElement)).toEqual(originalParents);
    expect(insert).not.toHaveBeenCalled();
    expect(boxAppend).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
    expect(mainInsert).not.toHaveBeenCalled();
    insert.mockRestore();
    boxAppend.mockRestore();
    append.mockRestore();
    mainInsert.mockRestore();
});

test('native moveBefore keeps direct-child legacy order and uses no ordinary reparenting', () => {
    const nativeMove = Element.prototype.moveBefore;
    const moves = [];
    Element.prototype.moveBefore = function (node, before) {
        moves.push([this, node, before]);
        if (before) this.insertBefore(node, before);
        else this.appendChild(node);
    };
    try {
        setup();
        const box = document.querySelector('#mainBox');
        const nodes = ['attendantData', 'tabs_div', 'mainFrames_div'].map(id => document.getElementById(id));
        moves.length = 0;
        document.querySelector('[data-workbench-mode]').click();
        expect(nodes.map(node => node.parentElement)).toEqual([box, box, box]);
        expect(nodes.map(node => node.id)).toEqual(['attendantData', 'tabs_div', 'mainFrames_div']);
        expect(moves).toHaveLength(3);
        expect(moves.every(move => move[0] === box)).toBe(true);
        document.querySelector('[data-workbench-mode]').click();
        expect(nodes.every(node => node.parentElement.id === 'workbenchContent')).toBe(true);
        expect(moves).toHaveLength(6);
        expect(box.classList.contains('workbench-static-legacy')).toBe(false);
    } finally {
        if (nativeMove) Element.prototype.moveBefore = nativeMove;
        else delete Element.prototype.moveBefore;
    }
});

test('static legacy fallback exposes original nodes as flex items with full and compact frame rules', () => {
    const css = fs.readFileSync(path.join(root, 'interface/main/tabs/css/workbench_shell.css'), 'utf8');
    expect(css).toMatch(/#mainBox\.workbench-static-legacy\.workbench-legacy \.workbench-layout\s*\{[^}]*display:\s*contents/s);
    expect(css).toMatch(/#mainBox\.workbench-static-legacy\.workbench-legacy \.workbench-main\s*\{[^}]*display:\s*contents/s);
    expect(css).toMatch(/#mainBox\.workbench-static-legacy\.workbench-legacy #mainFrames_div\s*\{[^}]*flex:\s*1 0 auto/s);
});

test('legacy toolbar wraps rather than stretching the viewport with the mode switch', () => {
    const css = fs.readFileSync(path.join(root, 'interface/main/tabs/css/workbench_shell.css'), 'utf8');
    expect(css).toMatch(/#mainBox\.workbench-legacy\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(/#mainBox\.workbench-legacy\s*>\s*nav\s*\{[^}]*flex-wrap:\s*wrap/s);
});

test('clinical UI scripts use the same changed asset version in main.php', () => {
    const php = fs.readFileSync(path.join(root, 'interface/main/tabs/main.php'), 'utf8');
    expect(php).toMatch(/\$clinicalUiAssetVersion\s*=\s*'[^']+'/);
    for (const asset of ['menu_launcher.js', 'workbench_shell.js']) {
        expect(php).toContain(`js/${asset}?v=<?php echo OEGlobalsBag::getInstance()->getString('v_js_includes'); ?>&clinical_ui=<?php echo $clinicalUiAssetVersion; ?>`);
    }
});

test('blocked descendant explains the ancestor requirement without dispatch', () => {
    setup();
    const popup = Array.from(document.querySelectorAll('[data-workbench-action]')).find(button => button.textContent === 'Popup');
    popup.click();
    expect(dispatch).not.toHaveBeenCalled();
    expect(document.querySelector('[data-workbench-notice]').textContent).toBe('Select a patient');
    expect(popup.getAttribute('aria-describedby')).toBe('workbenchNotice');
});

test('context changes retain open branches, action identity and keyboard focus', () => {
    setup();
    const branch = document.querySelector('.workbench-branch');
    branch.open = true;
    const popup = Array.from(document.querySelectorAll('[data-workbench-action]')).find(button => button.textContent === 'Popup');
    popup.focus();
    app.application_data.patient({ selectedEncounter: ko.observable(null) });
    expect(document.querySelector('.workbench-branch')).toBe(branch);
    expect(branch.open).toBe(true);
    expect(document.activeElement).toBe(popup);
    expect(popup.getAttribute('aria-disabled')).toBe('false');
});

test('translated labels retain source category provenance', () => {
    const objects = [
        { label: 'Kalender', sourceLabel: 'Calendar', menu_id: 'cal0', url: '/calendar', requirement: 0 },
        { label: 'Patienten', sourceLabel: 'Patient', menu_id: 'patimg', requirement: 0, children: [{ label: 'A', url: '/a', requirement: 0 }] },
        { label: 'Verwaltung', sourceLabel: 'Admin', menu_id: 'admimg', requirement: 0, children: [{ label: 'B', url: '/b', requirement: 0 }] },
    ];
    setup(objects);
    expect(Array.from(document.querySelectorAll('[data-workbench-group]')).map(section => [section.dataset.workbenchGroup, section.querySelector('.workbench-action').textContent])).toEqual([['Work', 'Kalender'], ['Patient', 'A'], ['Practice', 'B']]);
});

test('mobile drawer contains focus, closes on backdrop and restores trigger after dispatch', () => {
    setup();
    const toggle = document.querySelector('[data-workbench-mobile-toggle]');
    toggle.click();
    expect(document.querySelector('#workbenchContent').inert).toBe(true);
    const close = document.querySelector('[data-workbench-mobile-close]');
    close.focus();
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(document.querySelector('[data-workbench-search]'));
    document.querySelector('[data-workbench-mode]').focus();
    expect(document.activeElement).toBe(document.querySelector('[data-workbench-search]'));
    document.querySelector('[data-workbench-backdrop]').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(document.activeElement).toBe(toggle);
    toggle.click();
    document.querySelector('[data-workbench-action]').click();
    expect(document.activeElement).toBe(toggle);
});

test('runtime menu insert retains branch state and focus on existing action', () => {
    const menu = setup();
    const branch = document.querySelector('.workbench-branch');
    branch.open = true;
    const popup = Array.from(document.querySelectorAll('[data-workbench-action]')).find(button => button.textContent === 'Popup');
    popup.focus();
    menu()[1].children()[0].children.push({ label: ko.observable('Extra'), header: false, url: ko.observable('/extra'), target: 'enc', requirement: 0, enabled: ko.observable(true) });
    expect(document.querySelector('.workbench-branch').open).toBe(true);
    expect(document.activeElement.textContent).toBe('Popup');
    expect(Array.from(document.querySelectorAll('[data-workbench-action]')).some(button => button.textContent === 'Extra')).toBe(true);
});

const areaButton = key => document.querySelector(`[data-workbench-area="${key}"]`);
const section = key => document.querySelector(`[data-workbench-group="${key}"]`);
const visibleGroups = () => Array.from(document.querySelectorAll('[data-workbench-group]')).filter(s => !s.hidden).map(s => s.dataset.workbenchGroup);
const actionLabels = () => Array.from(document.querySelectorAll('[data-workbench-action]')).map(b => b.textContent);
function type(value) {
    const search = document.querySelector('[data-workbench-search]');
    search.value = value;
    search.dispatchEvent(new Event('input', { bubbles: true }));
}

test('work areas default to Work with native pressed buttons while every group stays in the DOM', () => {
    setup();
    expect(visibleGroups()).toEqual(['Work']);
    expect(['Work', 'Patient', 'Practice'].map(key => areaButton(key).getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(document.querySelectorAll('[data-workbench-group]')).toHaveLength(3);
    expect(actionLabels()).toEqual(['Calendar', 'New Form', 'Popup', 'Settings']);
    expect(document.querySelectorAll('[role="tab"], [role="tablist"]')).toHaveLength(0);
    expect(areaButton('Work').tagName).toBe('BUTTON');
});

test('switching areas changes group visibility only and keeps action identity and original dispatch', () => {
    const menu = setup();
    const before = Array.from(document.querySelectorAll('[data-workbench-action]'));
    const sections = Array.from(document.querySelectorAll('[data-workbench-group]'));
    areaButton('Practice').click();
    expect(visibleGroups()).toEqual(['Practice']);
    expect(areaButton('Practice').getAttribute('aria-pressed')).toBe('true');
    expect(areaButton('Work').getAttribute('aria-pressed')).toBe('false');
    areaButton('Patient').click();
    expect(visibleGroups()).toEqual(['Patient']);
    expect(Array.from(document.querySelectorAll('[data-workbench-action]'))).toEqual(before);
    expect(Array.from(document.querySelectorAll('[data-workbench-group]'))).toEqual(sections);
    areaButton('Practice').click();
    section('Practice').querySelector('.workbench-branch').open = true;
    section('Practice').querySelector('[data-workbench-action]').click();
    expect(dispatch.mock.calls[0][0]).toBe(menu()[2].children()[0]);
});

test('area switches never mutate, reparent or reload the content and iframe tree', () => {
    setup();
    const main = document.querySelector('#workbenchContent');
    const iframe = main.querySelector('iframe');
    const ancestry = [];
    for (let node = iframe; node; node = node.parentElement) ancestry.push([node, node.parentElement]);
    const observer = new MutationObserver(() => {});
    observer.observe(main, { childList: true, subtree: true, attributes: true });
    const spies = ['appendChild', 'insertBefore', 'removeChild', 'replaceChildren'].map(name => jest.spyOn(main, name));
    const load = jest.fn();
    iframe.addEventListener('load', load);
    ['Patient', 'Practice', 'Work', 'Practice'].forEach(key => areaButton(key).click());
    expect(visibleGroups()).toEqual(['Practice']);
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
    spies.forEach(spy => { expect(spy).not.toHaveBeenCalled(); spy.mockRestore(); });
    expect(main.querySelector('iframe')).toBe(iframe);
    expect(ancestry.every(([node, parent]) => node.parentElement === parent)).toBe(true);
    expect(load).not.toHaveBeenCalled();
});

test('sidebar search is global across areas and clearing it restores the selected area', () => {
    setup();
    areaButton('Practice').click();
    type('calendar');
    expect(visibleGroups()).toEqual(['Work']);
    expect(actionLabels()).toEqual(['Calendar']);
    type('e');
    expect(visibleGroups()).toEqual(['Work', 'Patient', 'Practice']);
    expect(areaButton('Practice').getAttribute('aria-pressed')).toBe('true');
    type('');
    expect(visibleGroups()).toEqual(['Practice']);
    expect(actionLabels()).toEqual(['Calendar', 'New Form', 'Popup', 'Settings']);
});

test('choosing an area while searching clears the search and shows that area', () => {
    setup();
    type('settings');
    areaButton('Patient').click();
    expect(document.querySelector('[data-workbench-search]').value).toBe('');
    expect(visibleGroups()).toEqual(['Patient']);
});

test('an ACL-filtered area with no actions remains selectable and explains itself', () => {
    setup([{ label: 'Calendar', url: '/calendar', target: 'cal', requirement: 0, children: [] }]);
    areaButton('Practice').click();
    expect(visibleGroups()).toEqual(['Practice']);
    expect(section('Practice').querySelector('.workbench-empty').textContent).toBe('Nothing in this area');
    expect(section('Practice').querySelectorAll('[data-workbench-action]')).toHaveLength(0);
    type('cal');
    expect(visibleGroups()).toEqual(['Work']);
});

test('area controls belong to workbench mode only', () => {
    setup();
    const areas = document.querySelector('[data-workbench-areas]');
    areaButton('Patient').click();
    expect(areas.hidden).toBe(false);
    document.querySelector('[data-workbench-mode]').click();
    expect(areas.hidden).toBe(true);
    document.querySelector('[data-workbench-mode]').click();
    expect(areas.hidden).toBe(false);
    expect(visibleGroups()).toEqual(['Patient']);
});

test('mobile drawer keeps the selected area through Escape and dispatch', () => {
    setup();
    areaButton('Practice').click();
    const toggle = document.querySelector('[data-workbench-mobile-toggle]');
    toggle.click();
    expect(visibleGroups()).toEqual(['Practice']);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.activeElement).toBe(toggle);
    toggle.click();
    section('Practice').querySelector('[data-workbench-action]').click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
    expect(visibleGroups()).toEqual(['Practice']);
});

test('main.php renders native work-area buttons with stable keys and translated labels', () => {
    const php = fs.readFileSync(path.join(root, 'interface/main/tabs/main.php'), 'utf8');
    const nav = php.slice(php.indexOf('<nav class="navbar'), php.indexOf('</nav>'));
    const start = nav.lastIndexOf('<div', nav.indexOf('data-workbench-areas'));
    expect(start).toBeGreaterThan(-1);
    const group = nav.slice(start, nav.indexOf('</div>', start));
    expect(group).toMatch(/^<div class="workbench-areas" role="group"/);
    expect(group).toContain("aria-label=\"<?php echo xla('Work areas'); ?>\"");
    const buttons = Array.from(group.matchAll(/<button([^>]*)>(.*?)<\/button>/g));
    expect(buttons.map(b => b[1].match(/data-workbench-area="([^"]+)"/)[1])).toEqual(['Work', 'Patient', 'Practice']);
    buttons.forEach(([, attrs, label]) => {
        expect(attrs).toMatch(/type="button"/);
        expect(attrs).toMatch(/aria-controls="workbenchRail"/);
        expect(label).toMatch(/^<\?php echo xlt\('(Work|Patient|Practice)'\); \?>$/);
    });
    expect(nav.indexOf('data-workbench-areas')).toBeLessThan(nav.indexOf('id="userData"'));
    expect(php).toMatch(/data-msg-area-empty="<\?php echo xla\('[^']+'\); \?>"/);
    expect(php).not.toContain("$clinicalUiAssetVersion = '20261002';");
});

test('work-area CSS follows the 66px top bar and 206px rail with current, hover and legacy rules', () => {
    const css = fs.readFileSync(path.join(root, 'interface/main/tabs/css/workbench_shell.css'), 'utf8');
    expect(css).toMatch(/#mainBox:not\(\.workbench-legacy\) > nav\s*\{[^}]*min-height:\s*66px/s);
    expect(css).toMatch(/#mainBox:not\(\.workbench-legacy\) \.workbench-rail\s*\{[^}]*flex:\s*0 0 206px/s);
    expect(css).toMatch(/\.workbench-area\[aria-pressed='true'\]\s*\{[^}]*border-bottom-color:\s*var\(--wb-petrol\)/s);
    expect(css).toMatch(/\.workbench-area:hover/);
    expect(css).toMatch(/#mainBox\.workbench-legacy \.workbench-areas[^{]*\{[^}]*display:\s*none/s);
    expect(css).toMatch(/\.workbench-group\[hidden\]\s*\{[^}]*display:\s*none/s);
});
