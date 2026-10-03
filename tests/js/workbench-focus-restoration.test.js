/** @jest-environment jsdom */
/**
 * Keyboard focus must survive workbench rail rerenders (runtime menu changes
 * and global search) for branch summaries as well as actions, and must never
 * land inside hidden, collapsed or inert DOM. Synthetic menu data only.
 */
const ko = require('knockout');
const fs = require('fs');
const path = require('path');

require('../../interface/main/tabs/js/menu_launcher.js');
require('../../interface/main/tabs/js/workbench_shell.js');

const Shell = window.OpenEMRWorkbenchShell;
const repoRoot = path.resolve(__dirname, '../..');

function liveMenu(objects, app) {
    const source = fs.readFileSync(path.join(repoRoot, 'templates/interface/main/tabs/menu_json.html.twig'), 'utf8');
    const body = source.match(/<script>([\s\S]*)<\/script>/)[1].replace('{{ menu_restrictions|json_encode }}', JSON.stringify(objects));
    new Function('ko', 'app_view_model', body)(ko, app);
    return app.application_data.menu;
}

// Duplicate labels containing quotes live in different branches on purpose:
// restoration must follow node identity, never label text.
const synthetic = () => [
    { label: 'Calendar', url: '/calendar', target: 'cal', requirement: 0, children: [] },
    { label: 'Patient', requirement: 0, children: [
        { label: 'Visits "A"', requirement: 0, children: [
            { label: 'Open "x"', url: '/visit-x', target: 'enc', requirement: 0, children: [] },
            { label: 'Popup', url: '/popup', target: 'pop', requirement: 0, children: [] },
        ] },
    ] },
    { label: 'Admin', requirement: 0, children: [
        { label: 'Visits "A"', requirement: 0, children: [
            { label: 'Open "x"', url: '/admin-x', target: 'adm', requirement: 0, children: [] },
        ] },
        { label: 'Settings', url: '/settings', target: 'adm', requirement: 0, children: [] },
    ] },
];

const SHELL_HTML = '<div id="mainBox"><nav><div id="mainMenu"></div><div role="group" aria-label="Work areas" data-workbench-areas><button type="button" data-workbench-area="Work" aria-pressed="false">Work</button><button type="button" data-workbench-area="Patient" aria-pressed="false">Patient</button><button type="button" data-workbench-area="Practice" aria-pressed="false">Practice</button></div><button data-workbench-mode data-workbench-label="Workbench navigation" data-legacy-label="Legacy navigation">Legacy navigation</button><button data-workbench-mobile-toggle>Navigation</button></nav><div id="workbench"><div data-workbench-backdrop></div><aside id="workbenchRail" data-msg-area-empty="Nothing in this area" data-msg-patient="Select a patient" data-msg-encounter="Select an encounter" data-msg-unavailable="Unavailable"><button data-workbench-mobile-close>Close</button><input type="search" data-workbench-search><p id="workbenchNotice" role="status" aria-live="polite" data-workbench-notice></p><div data-workbench-tree></div></aside><main id="workbenchContent"><div id="attendantData"></div><div class="workbench-content-head"></div><div id="tabs_div"></div><div id="mainFrames_div"><div id="framesDisplay"><iframe></iframe></div></div></main></div></div>';

let shell;
let dispatch;
function setup() {
    document.body.innerHTML = SHELL_HTML;
    const app = { application_data: { patient: ko.observable(null), therapy_group: ko.observable(null) } };
    const menu = liveMenu(synthetic(), app);
    dispatch = jest.fn();
    shell = Shell.create({ root: document.querySelector('#mainBox'), menu, ko, dispatch, storage: { getItem: () => null, setItem: jest.fn() } });
    return menu;
}
afterEach(() => {
    if (shell) shell.destroy();
    shell = null;
    document.body.innerHTML = '';
    jest.restoreAllMocks();
});

const search = () => document.querySelector('[data-workbench-search]');
const branches = () => Array.from(document.querySelectorAll('.workbench-branch'));
const branchFor = node => branches().find(branch => branch.__workbenchNode === node);
const summaryFor = node => branchFor(node).querySelector(':scope > summary');
const actionFor = node => Array.from(document.querySelectorAll('[data-workbench-action]')).find(button => button.__workbenchNode === node);
const chooseArea = key => document.querySelector(`[data-workbench-area="${key}"]`).click();
const extra = label => ({ label: ko.observable(label), header: false, url: ko.observable('/' + label), target: 'adm', requirement: 0, enabled: ko.observable(true) });
function type(value) {
    search().value = value;
    search().dispatchEvent(new Event('input', { bubbles: true }));
}
// Focus is usable only if no ancestor hides it, makes it inert, or collapses it.
function reachable(element) {
    for (let current = element; current; current = current.parentElement) {
        if (current.hidden || current.inert || current.hasAttribute('inert')) return false;
        if (current !== element && current.matches('details') && !current.open && element.parentElement !== current) return false;
    }
    return element.isConnected;
}
// Rerender the whole rail once, after silently restructuring the live arrays.
function restructure(menu, mutate) {
    mutate();
    menu.valueHasMutated();
}

test('focused branch summary is restored when the same duplicate-labelled branch survives a menu change', () => {
    const menu = setup();
    chooseArea('Practice');
    const adminVisits = menu()[2].children()[0];
    const patientVisits = menu()[1].children()[0];
    expect(String(adminVisits.label())).toBe(String(patientVisits.label()));
    branchFor(menu()[2]).open = true;
    summaryFor(adminVisits).focus();
    const before = document.activeElement;

    menu()[2].children.push(extra('Extra'));

    expect(before.isConnected).toBe(false);
    expect(document.activeElement).toBe(summaryFor(adminVisits));
    expect(document.activeElement.parentElement.__workbenchNode).not.toBe(patientVisits);
    expect(reachable(document.activeElement)).toBe(true);
    expect(branchFor(menu()[2]).open).toBe(true);
    expect(document.querySelector('[data-workbench-area="Practice"]').getAttribute('aria-pressed')).toBe('true');
});

test('focused branch summary is restored on a menu change while global search is active', () => {
    const menu = setup();
    type('Open');
    const patientVisits = menu()[1].children()[0];
    summaryFor(patientVisits).focus();

    menu()[1].children()[0].children.push(extra('Open later'));

    expect(document.activeElement).toBe(summaryFor(patientVisits));
    expect(reachable(document.activeElement)).toBe(true);
    expect(search().value).toBe('Open');
    expect(Array.from(document.querySelectorAll('[data-workbench-group]')).every(section => !section.hidden)).toBe(true);
});

test('removed branch falls back to its nearest surviving visible ancestor summary', () => {
    const menu = setup();
    chooseArea('Patient');
    branchFor(menu()[1]).open = true;
    summaryFor(menu()[1].children()[0]).focus();

    menu()[1].children.removeAll();

    expect(document.activeElement).toBe(summaryFor(menu()[1]));
    expect(reachable(document.activeElement)).toBe(true);
});

test('branch moved into a hidden area is not focused; focus stays in the selected area', () => {
    const menu = setup();
    chooseArea('Patient');
    branchFor(menu()[1]).open = true;
    const visits = menu()[1].children()[0];
    summaryFor(visits).focus();

    restructure(menu, () => {
        menu()[1].children.peek().splice(0, 1);
        menu()[2].children.peek().push(visits);
    });

    expect(branchFor(visits).closest('[data-workbench-group]').hidden).toBe(true);
    expect(document.activeElement).toBe(summaryFor(menu()[1]));
    expect(reachable(document.activeElement)).toBe(true);
    expect(document.querySelector('[data-workbench-area="Patient"]').getAttribute('aria-pressed')).toBe('true');
});

test('branch moved under a collapsed branch is not focused through the closed details', () => {
    const menu = setup();
    chooseArea('Patient');
    branchFor(menu()[1]).open = true;
    const visits = menu()[1].children()[0];
    summaryFor(visits).focus();

    restructure(menu, () => {
        const archive = { label: ko.observable('Archive'), header: true, requirement: 0, enabled: ko.observable(true), children: ko.observableArray([visits]) };
        menu()[1].children.peek().splice(0, 1, archive);
    });

    expect(branchFor(visits).parentElement.closest('details').open).toBe(false);
    expect(document.activeElement).toBe(summaryFor(menu()[1]));
    expect(reachable(document.activeElement)).toBe(true);
});

test.each(['summary', 'action'])('focused %s collapsed away before a rerender falls back to the reachable ancestor summary', kind => {
    const menu = setup();
    chooseArea('Patient');
    branchFor(menu()[1]).open = true;
    const visits = menu()[1].children()[0];
    branchFor(visits).open = true;
    const target = kind === 'summary' ? summaryFor(visits) : actionFor(visits.children()[0]);
    target.focus();
    expect(reachable(target)).toBe(true);

    // Synchronous collapse leaves focus on the now-unreachable element; the next rerender must not restore it.
    branchFor(menu()[1]).open = false;
    expect(document.activeElement).toBe(target);
    menu()[2].children.push(extra('Extra'));

    expect(branchFor(menu()[1]).open).toBe(false);
    expect(document.activeElement).toBe(summaryFor(menu()[1]));
    expect(reachable(document.activeElement)).toBe(true);
});

test('branch filtered out of an active search falls back to the search field, never the body', () => {
    const menu = setup();
    type('Popup');
    const visits = menu()[1].children()[0];
    summaryFor(visits).focus();

    visits.children.remove(child => String(child.label()) === 'Popup');

    expect(document.querySelector('[data-workbench-group="Patient"]')).toBeNull();
    expect(document.activeElement).toBe(search());
    expect(search().value).toBe('Popup');
});

test('focused duplicate-labelled action keeps identity and original dispatch across a rerender', () => {
    const menu = setup();
    chooseArea('Practice');
    branchFor(menu()[2]).open = true;
    branchFor(menu()[2].children()[0]).open = true;
    const adminOpen = menu()[2].children()[0].children()[0];
    actionFor(adminOpen).focus();

    menu()[2].children.push(extra('Extra'));

    expect(document.activeElement).toBe(actionFor(adminOpen));
    document.activeElement.click();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toBe(adminOpen);
    expect(dispatch.mock.calls[0][0]).not.toBe(menu()[1].children()[0].children()[0]);
});

test('focus restoration never mutates or reparents the iframe or its ancestors', () => {
    const menu = setup();
    const iframe = document.querySelector('iframe');
    const chain = [];
    for (let node = iframe; node; node = node.parentNode) chain.push(node);
    const observer = new MutationObserver(() => {});
    observer.observe(document.querySelector('#workbenchContent'), { childList: true, subtree: true, attributes: true });
    chooseArea('Patient');
    branchFor(menu()[1]).open = true;
    summaryFor(menu()[1].children()[0]).focus();

    menu()[1].children.removeAll();
    menu()[2].children.push(extra('Extra'));

    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
    const after = [];
    for (let node = document.querySelector('iframe'); node; node = node.parentNode) after.push(node);
    expect(after).toEqual(chain);
    expect(after.every((node, index) => node === chain[index])).toBe(true);
});

test('teardown removes every shell listener and later menu changes neither rerender nor move focus', () => {
    const added = [];
    const removed = [];
    const realAdd = EventTarget.prototype.addEventListener;
    const realRemove = EventTarget.prototype.removeEventListener;
    jest.spyOn(EventTarget.prototype, 'addEventListener').mockImplementation(function (type, listener, opts) {
        added.push([this, type, listener]);
        return realAdd.call(this, type, listener, opts);
    });
    jest.spyOn(EventTarget.prototype, 'removeEventListener').mockImplementation(function (type, listener, opts) {
        removed.push([this, type, listener]);
        return realRemove.call(this, type, listener, opts);
    });
    const menu = setup();
    const tree = document.querySelector('[data-workbench-tree]');
    chooseArea('Practice');
    branchFor(menu()[2]).open = true;
    const summary = summaryFor(menu()[2].children()[0]);
    summary.focus();

    shell.destroy();
    shell = null;
    const rendered = Array.from(tree.children);
    menu()[2].children.push(extra('Extra'));

    expect(Array.from(tree.children)).toEqual(rendered);
    expect(document.activeElement).toBe(summary);
    // Per-action click handlers die with their discarded elements; every
    // listener on a persistent target must be removed by destroy().
    const persistent = added.filter(([target]) => !(target instanceof Node && tree.contains(target)));
    persistent.forEach(([target, type, listener]) => {
        expect(removed.some(([t, ty, l]) => t === target && ty === type && l === listener)).toBe(true);
    });

    // A detached root must not throw when its observables change afterwards.
    document.querySelector('#mainBox').remove();
    expect(() => menu()[2].children.push(extra('Detached'))).not.toThrow();
});
