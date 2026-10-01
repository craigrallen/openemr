/**
 * @jest-environment jsdom
 */

/**
 * Tests for interface/main/tabs/js/menu_launcher.js (the "All menus" launcher).
 *
 * The harness deliberately uses the production pieces rather than stand-ins:
 *  - the real `menu_entry` constructor, extracted from
 *    templates/interface/main/tabs/menu_json.html.twig, so `enabled()` is the
 *    same live Knockout computed the dropdown menu uses;
 *  - the real launcher markup from
 *    templates/interface/main/tabs/menu_launcher.html.twig, with translation
 *    filters replaced by their source strings;
 *  - the shipped menu JSON definitions for recursive coverage.
 *
 * Run with: node_modules/.bin/jest tests/js/menu-launcher.test.js
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

const fs = require('fs');
const path = require('path');
const ko = require('knockout');

const ROOT = path.resolve(__dirname, '../..');
const MENU_DIR = path.join(ROOT, 'interface/main/tabs/menu/menus');
const MENU_FILES = ['standard.json', 'front_office.json', 'answering_service.json', 'chart_review.json'];

require('../../interface/main/tabs/js/menu_launcher.js');
const Launcher = global.window.OpenEMRMenuLauncher;

/**
 * Build the live Knockout menu tree exactly as main.php does, using the
 * script body of menu_json.html.twig.
 */
function buildLiveMenu(menuObjects, appViewModel) {
    const twig = fs.readFileSync(path.join(ROOT, 'templates/interface/main/tabs/menu_json.html.twig'), 'utf8');
    const match = twig.match(/<script>([\s\S]*)<\/script>/);
    if (!match) {
        throw new Error('menu_json.html.twig script block not found');
    }
    const body = match[1].replace('{{ menu_restrictions|json_encode }}', JSON.stringify(menuObjects));
    new Function('ko', 'app_view_model', body)(ko, appViewModel);
    return appViewModel.application_data.menu;
}

function renderLauncherTemplate() {
    const twig = fs.readFileSync(path.join(ROOT, 'templates/interface/main/tabs/menu_launcher.html.twig'), 'utf8');
    const html = twig
        .replace(/\{#[\s\S]*?#\}/g, '')
        .replace(/\{\{\s*'((?:[^'\\]|\\.)*)'\s*\|\s*(?:xlt|xla)\s*\}\}/g, (m, s) => s.replace(/\\'/g, "'"));
    if (/\{\{|\{%/.test(html)) {
        throw new Error('Unexpected Twig syntax left in launcher template');
    }
    return html;
}

function newAppViewModel() {
    return {
        application_data: {
            patient: ko.observable(null),
            therapy_group: ko.observable(null),
        },
    };
}

function patientWithEncounter(encounterId) {
    return { selectedEncounter: ko.observable(encounterId ? { id: encounterId } : null) };
}

function collectUrlNodes(nodes, trail, out) {
    nodes.forEach((node) => {
        if ('url' in node) {
            out.push({ label: node.label, url: node.url, trail: trail.slice() });
        } else {
            collectUrlNodes(node.children || [], trail.concat(node.label), out);
        }
    });
    return out;
}

const SMALL_MENU = [
    { label: 'Calendar', url: '/interface/main/main_info.php', target: 'cal', requirement: 0, children: [] },
    {
        label: 'Patient',
        requirement: 0,
        children: [
            { label: 'Dashboard', url: '/interface/patient_file/summary/demographics.php', target: 'pat', requirement: 1, children: [] },
            {
                label: 'Visits',
                requirement: 0,
                children: [
                    { label: 'Current', url: '/interface/patient_file/encounter/encounter_top.php', target: 'enc', requirement: 3, children: [] },
                ],
            },
        ],
    },
    {
        label: 'Ensora eRx',
        requirement: 1,
        children: [
            { label: 'Compose', url: '/interface/eRx.php?page=compose', target: 'rx', requirement: 0, children: [] },
        ],
    },
    {
        label: 'Popups',
        requirement: 0,
        children: [
            { label: 'Issues', url: '/interface/patient_file/problem_encounter.php', target: 'pop', requirement: 1, children: [] },
            { label: 'Payment', url: '/interface/patient_file/front_payment.php', target: 'pop', requirement: 0, children: [] },
        ],
    },
    {
        label: 'Groups',
        requirement: 0,
        children: [
            { label: 'Group Encounter', url: '/interface/forms/newGroupEncounter/new.php', target: 'enc', requirement: 5, children: [] },
            { label: 'Group Details', url: '/interface/therapy_groups/index.php', target: 'gdg', requirement: 4, children: [] },
        ],
    },
    {
        label: 'Reports',
        requirement: 0,
        children: [
            { label: 'Clinic Report <b>x</b>', url: '/interface/reports/clinical_reports.php', target: 'rep', requirement: 0, children: [] },
        ],
    },
];

let app;
let menu;
let dispatch;
let controller;
let trigger;

function q(sel) {
    return document.querySelector(sel);
}

function input() {
    return q('[data-oe-menu-launcher="search"]');
}

function options() {
    return Array.from(document.querySelectorAll('[data-oe-menu-launcher="results"] [role="option"]'));
}

function optionLabels() {
    return options().map((o) => o.querySelector('[data-oe-menu-launcher="label"]').textContent);
}

function status() {
    return q('[data-oe-menu-launcher="status"]').textContent;
}

function overlay() {
    return q('[data-oe-menu-launcher="overlay"]');
}

function type(value) {
    input().value = value;
    input().dispatchEvent(new Event('input', { bubbles: true }));
}

function key(target, keyName, extra = {}) {
    const ev = new KeyboardEvent('keydown', Object.assign({ key: keyName, bubbles: true, cancelable: true }, extra));
    target.dispatchEvent(ev);
    return ev;
}

/**
 * Keydown carrying IME state. KeyboardEventInit has no keyCode, so it is
 * defined on the instance, as browsers report 229 for IME-processed keys.
 */
function imeKey(target, keyName, { isComposing = false, keyCode } = {}) {
    const ev = new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true, isComposing });
    if (keyCode !== undefined) {
        Object.defineProperty(ev, 'keyCode', { value: keyCode });
    }
    target.dispatchEvent(ev);
    return ev;
}

function composition(type) {
    input().dispatchEvent(new (window.CompositionEvent || Event)(type, { bubbles: true }));
}

/**
 * jsdom does not run the mousedown default action. Browsers do: unless the
 * mousedown is cancelled, focus moves to the nearest focusable ancestor of the
 * target or, when there is none, falls back to the body (the active element
 * is blurred). Emulate that so focus loss is observable in tests.
 */
function nativeMousedown(target) {
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    if (!ev.defaultPrevented) {
        const focusable = target.closest('input, button, select, textarea, a[href], [tabindex]');
        if (focusable && !focusable.closest('[hidden]')) {
            focusable.focus();
        } else if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }
    }
    return ev;
}

/** Full pointer sequence on an element: mousedown (with default action), then click. */
function nativeClick(target) {
    const down = nativeMousedown(target);
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return down;
}

function setup(menuObjects = SMALL_MENU, opts = {}) {
    document.body.innerHTML = '<button id="before" type="button">before</button>' + renderLauncherTemplate();
    app = newAppViewModel();
    menu = buildLiveMenu(menuObjects, app);
    dispatch = jest.fn();
    controller = Launcher.create(Object.assign({
        root: q('[data-oe-menu-launcher="root"]'),
        menu,
        ko,
        dispatch,
    }, opts));
    trigger = q('[data-oe-menu-launcher="trigger"]');
}

afterEach(() => {
    if (controller) {
        controller.destroy();
        controller = null;
    }
    document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// Pure index / availability helpers against the live tree
// ---------------------------------------------------------------------------

describe('collectEntries', () => {
    test.each(MENU_FILES)('indexes every URL-bearing node of %s recursively, once, with its breadcrumb', (file) => {
        const raw = JSON.parse(fs.readFileSync(path.join(MENU_DIR, file), 'utf8'));
        const liveMenu = buildLiveMenu(raw, newAppViewModel());
        const expected = collectUrlNodes(raw, [], []);
        const entries = Launcher.collectEntries(liveMenu());

        expect(expected.length).toBeGreaterThan(0);
        expect(entries).toHaveLength(expected.length);
        entries.forEach((entry, i) => {
            expect(entry.label).toBe(expected[i].label);
            expect(entry.path).toEqual(expected[i].trail);
            expect(entry.item.url()).toBe(expected[i].url);
        });
    });

    test('keeps references to the original model objects and their ancestors', () => {
        const liveMenu = buildLiveMenu(SMALL_MENU, newAppViewModel());
        const entries = Launcher.collectEntries(liveMenu());
        const current = entries.find((e) => e.label === 'Current');
        const patientHeader = liveMenu()[1];
        const visitsHeader = patientHeader.children()[1];

        expect(current.item).toBe(visitsHeader.children()[0]);
        expect(current.ancestors[0]).toBe(patientHeader);
        expect(current.ancestors[1]).toBe(visitsHeader);
    });

    test('includes server-generated dynamic form categories (visit forms, blank LBF popups)', () => {
        const withDynamic = SMALL_MENU.concat([{
            label: 'Visit Forms',
            requirement: 0,
            children: [{
                label: 'Clinical',
                icon: 'fa-caret-right',
                requirement: 2,
                children: [{ label: 'Vitals', url: '/interface/patient_file/encounter/load_form.php?formname=vitals', target: 'enc', requirement: 2 }],
            }, {
                label: 'Blank LBF',
                icon: 'fa-caret-right',
                requirement: 0,
                children: [{ label: 'Intake', url: '/interface/forms/LBF/printable.php?isform=1&formname=LBFintake', target: 'pop', requirement: 0 }],
            }],
        }]);
        const entries = Launcher.collectEntries(buildLiveMenu(withDynamic, newAppViewModel())());
        const vitals = entries.find((e) => e.label === 'Vitals');
        expect(vitals.path).toEqual(['Visit Forms', 'Clinical']);
        expect(entries.find((e) => e.label === 'Intake').item.target).toBe('pop');
    });
});

describe('findBlockingNode (live requirement evaluation)', () => {
    let liveApp;
    let entries;
    const byLabel = (label) => entries.find((e) => e.label === label);

    beforeEach(() => {
        liveApp = newAppViewModel();
        entries = Launcher.collectEntries(buildLiveMenu(SMALL_MENU, liveApp)());
    });

    test('requirement 0 items are available', () => {
        expect(Launcher.findBlockingNode(byLabel('Calendar'))).toBeNull();
    });

    test('patient requirement follows the current patient observable', () => {
        const dashboard = byLabel('Dashboard');
        expect(Launcher.findBlockingNode(dashboard)).toBe(dashboard.item);
        liveApp.application_data.patient(patientWithEncounter(null));
        expect(Launcher.findBlockingNode(dashboard)).toBeNull();
        liveApp.application_data.patient(null);
        expect(Launcher.findBlockingNode(dashboard)).toBe(dashboard.item);
    });

    test('encounter requirement needs a selected encounter', () => {
        const current = byLabel('Current');
        liveApp.application_data.patient(patientWithEncounter(null));
        expect(Launcher.findBlockingNode(current)).toBe(current.item);
        liveApp.application_data.patient().selectedEncounter({ id: 7 });
        expect(Launcher.findBlockingNode(current)).toBeNull();
    });

    test('a disabled ancestor blocks an otherwise enabled child', () => {
        const compose = byLabel('Compose');
        expect(compose.item.enabled()).toBe(true);
        expect(Launcher.findBlockingNode(compose)).toBe(compose.ancestors[0]);
        liveApp.application_data.patient(patientWithEncounter(null));
        expect(Launcher.findBlockingNode(compose)).toBeNull();
    });

    test('therapy group requirements follow the therapy group observable', () => {
        const details = byLabel('Group Details');
        expect(Launcher.findBlockingNode(details)).toBe(details.item);
        liveApp.application_data.therapy_group({ selectedEncounter: ko.observable(null) });
        expect(Launcher.findBlockingNode(details)).toBeNull();
        const groupEncounter = byLabel('Group Encounter');
        expect(Launcher.findBlockingNode(groupEncounter)).toBe(groupEncounter.item);
    });

    test('an action item without an enabled() function fails closed', () => {
        const fake = { item: { label: () => 'x', url: () => '/x' }, ancestors: [] };
        expect(Launcher.findBlockingNode(fake)).toBe(fake.item);
    });
});

describe('filterEntries', () => {
    let entries;
    beforeEach(() => {
        entries = Launcher.collectEntries(buildLiveMenu(SMALL_MENU, newAppViewModel())());
    });

    test('empty query returns every entry in menu order', () => {
        expect(Launcher.filterEntries(entries, '   ')).toEqual(entries);
    });

    test('matches labels case-insensitively', () => {
        expect(Launcher.filterEntries(entries, 'dASH').map((e) => e.label)).toEqual(['Dashboard']);
    });

    test('matches breadcrumb text and requires every token', () => {
        expect(Launcher.filterEntries(entries, 'visits').map((e) => e.label)).toEqual(['Current']);
        expect(Launcher.filterEntries(entries, 'patient cur').map((e) => e.label)).toEqual(['Current']);
        expect(Launcher.filterEntries(entries, 'patient zzz')).toEqual([]);
    });

    test('ignores diacritics', () => {
        const accented = Launcher.collectEntries(buildLiveMenu([
            { label: 'Préférences', url: '/p', target: 'p', requirement: 0 },
        ], newAppViewModel())());
        expect(Launcher.filterEntries(accented, 'prefer')).toHaveLength(1);
    });

    test('ranks label matches ahead of breadcrumb-only matches', () => {
        const ranked = Launcher.collectEntries(buildLiveMenu([
            { label: 'Reports', requirement: 0, children: [{ label: 'Summary', url: '/a', target: 'a', requirement: 0 }] },
            { label: 'Report Builder', url: '/b', target: 'b', requirement: 0 },
        ], newAppViewModel())());
        expect(Launcher.filterEntries(ranked, 'report').map((e) => e.label)).toEqual(['Report Builder', 'Summary']);
    });
});

// ---------------------------------------------------------------------------
// Controller: DOM, keyboard, dispatch
// ---------------------------------------------------------------------------

describe('launcher dialog', () => {
    test('template is closed by default and the trigger describes the dialog', () => {
        setup();
        expect(overlay().hidden).toBe(true);
        expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(trigger.textContent).toContain('All menus');
        const dialog = q('[role="dialog"]');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent).toContain('All menus');
    });

    test('opening shows all entries with breadcrumbs and focuses the search field', () => {
        setup();
        trigger.focus();
        trigger.click();
        expect(overlay().hidden).toBe(false);
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(document.activeElement).toBe(input());
        expect(optionLabels()).toEqual(['Calendar', 'Dashboard', 'Current', 'Compose', 'Issues', 'Payment', 'Group Encounter', 'Group Details', 'Clinic Report <b>x</b>']);
        const current = options()[2];
        expect(current.querySelector('[data-oe-menu-launcher="path"]').textContent).toBe('Patient › Visits');
    });

    test('renders labels as text, never as HTML', () => {
        const hostile = [{ label: '<img src=x onerror="window.__pwned=1">', url: '/x', target: 'x', requirement: 0 }];
        setup(hostile.concat([{ label: '<script>window.__pwned=2</script>', requirement: 0, children: [{ label: 'Child', url: '/y', target: 'y', requirement: 0 }] }]));
        trigger.click();
        const results = q('[data-oe-menu-launcher="results"]');
        expect(results.querySelector('img')).toBeNull();
        expect(results.querySelector('script')).toBeNull();
        expect(optionLabels()[0]).toBe('<img src=x onerror="window.__pwned=1">');
        expect(options()[1].querySelector('[data-oe-menu-launcher="path"]').textContent).toBe('<script>window.__pwned=2</script>');
        expect(window.__pwned).toBeUndefined();
    });

    test('search filters results and announces the count', () => {
        setup();
        trigger.click();
        type('pop');
        expect(optionLabels()).toEqual(['Issues', 'Payment']);
        expect(status()).toContain('2');
        expect(q('[data-oe-menu-launcher="empty"]').hidden).toBe(true);
    });

    test('no results shows the empty state', () => {
        setup();
        trigger.click();
        type('no such menu item');
        expect(options()).toHaveLength(0);
        expect(q('[data-oe-menu-launcher="empty"]').hidden).toBe(false);
        expect(input().getAttribute('aria-activedescendant')).toBeNull();
    });

    test('unavailable entries are marked from live state and update while open', () => {
        setup();
        trigger.click();
        const dashboard = () => options().find((o) => o.textContent.includes('Dashboard'));
        expect(dashboard().getAttribute('aria-disabled')).toBe('true');
        expect(dashboard().textContent).toContain('You must first select or add a patient.');
        app.application_data.patient(patientWithEncounter(null));
        expect(dashboard().getAttribute('aria-disabled')).toBeNull();
    });

    test('clicking an available entry dispatches menuActionClick with the original object', () => {
        setup();
        trigger.click();
        const calendarItem = menu()[0];
        options()[0].click();
        expect(dispatch).toHaveBeenCalledTimes(1);
        const [item, evt] = dispatch.mock.calls[0];
        expect(item).toBe(calendarItem);
        expect(evt.type).toBe('click');
        expect(evt.currentTarget.textContent).toBe('Calendar');
        expect(evt.originalEvent).toBeInstanceOf(Event);
        expect(overlay().hidden).toBe(true);
    });

    test('defaults to the global menuActionClick when no dispatcher is given', () => {
        document.body.innerHTML = renderLauncherTemplate();
        app = newAppViewModel();
        menu = buildLiveMenu(SMALL_MENU, app);
        window.menuActionClick = jest.fn();
        controller = Launcher.create({ root: q('[data-oe-menu-launcher="root"]'), menu, ko });
        q('[data-oe-menu-launcher="trigger"]').click();
        options()[0].click();
        expect(window.menuActionClick).toHaveBeenCalledWith(menu()[0], expect.objectContaining({ type: 'click' }));
        delete window.menuActionClick;
    });

    test('popup entries keep their label as the dialog title source', () => {
        setup();
        trigger.click();
        type('payment');
        options()[0].click();
        const [item, evt] = dispatch.mock.calls[0];
        expect(item.target).toBe('pop');
        expect(window.jQuery ? window.jQuery(evt.currentTarget).text() : evt.currentTarget.textContent).toBe('Payment');
    });

    test('a popup that needs a patient is rejected before dispatch (menuActionClick skips enabled() for popups)', () => {
        setup();
        trigger.click();
        type('issues');
        options()[0].click();
        expect(dispatch).not.toHaveBeenCalled();
        expect(overlay().hidden).toBe(false);
        expect(status()).toContain('You must first select or add a patient.');
    });

    test('a disabled ancestor blocks dispatch of an enabled child', () => {
        setup();
        trigger.click();
        type('compose');
        options()[0].click();
        expect(dispatch).not.toHaveBeenCalled();
        expect(status()).toContain('You must first select or add a patient.');
        app.application_data.patient(patientWithEncounter(null));
        options()[0].click();
        expect(dispatch).toHaveBeenCalledTimes(1);
    });

    test('requirement is re-evaluated at activation time, not render time', () => {
        setup();
        app.application_data.patient(patientWithEncounter({ id: 1 }));
        trigger.click();
        type('dashboard');
        app.application_data.patient(null);
        key(input(), 'Enter');
        expect(dispatch).not.toHaveBeenCalled();
    });

    test('encounter-scoped entries report the encounter requirement', () => {
        setup();
        app.application_data.patient(patientWithEncounter(null));
        trigger.click();
        type('current');
        key(input(), 'Enter');
        expect(dispatch).not.toHaveBeenCalled();
        expect(status()).toContain('You must first select or create an encounter.');
    });

    test('patient requirement message mentions therapy groups when enabled', () => {
        setup(SMALL_MENU, { groupTherapyEnabled: true });
        trigger.click();
        type('dashboard');
        key(input(), 'Enter');
        expect(status()).toContain('You must first select or add a patient or therapy group.');
    });

    test('arrow keys move the active option and Enter dispatches it', () => {
        setup();
        trigger.click();
        expect(input().getAttribute('aria-activedescendant')).toBe(options()[0].id);
        key(input(), 'ArrowDown');
        key(input(), 'ArrowDown');
        key(input(), 'ArrowDown');
        expect(input().getAttribute('aria-activedescendant')).toBe(options()[3].id);
        expect(options()[3].getAttribute('aria-selected')).toBe('true');
        key(input(), 'ArrowUp');
        expect(options()[2].getAttribute('aria-selected')).toBe('true');
        app.application_data.patient(patientWithEncounter({ id: 3 }));
        const ev = key(input(), 'Enter');
        expect(ev.defaultPrevented).toBe(true);
        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch.mock.calls[0][0].label()).toBe('Current');
    });

    test('ArrowUp from the first option wraps to the last', () => {
        setup();
        trigger.click();
        key(input(), 'ArrowUp');
        expect(options()[options().length - 1].getAttribute('aria-selected')).toBe('true');
    });

    test('Escape closes and restores focus to the trigger', () => {
        setup();
        trigger.focus();
        trigger.click();
        key(input(), 'Escape');
        expect(overlay().hidden).toBe(true);
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(trigger);
        expect(dispatch).not.toHaveBeenCalled();
    });

    test('close button and backdrop click close the dialog', () => {
        setup();
        trigger.click();
        q('[data-oe-menu-launcher="close"]').click();
        expect(overlay().hidden).toBe(true);
        trigger.click();
        overlay().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(overlay().hidden).toBe(true);
        trigger.click();
        q('[role="dialog"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(overlay().hidden).toBe(false);
    });

    test('Tab is kept inside the dialog', () => {
        setup();
        trigger.click();
        const close = q('[data-oe-menu-launcher="close"]');
        close.focus();
        const ev = key(close, 'Tab');
        expect(ev.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(input());
        const back = key(input(), 'Tab', { shiftKey: true });
        expect(back.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(close);
    });

    test('does not intercept typing or shortcuts outside the dialog', () => {
        setup();
        const before = q('#before');
        before.focus();
        ['k', '/', 'Enter', 'Escape'].forEach((k) => {
            const ev = key(before, k, { ctrlKey: k === 'k', metaKey: k === 'k' });
            expect(ev.defaultPrevented).toBe(false);
        });
        expect(overlay().hidden).toBe(true);
    });

    test('reopening starts with a cleared search and nothing is persisted', () => {
        const setItem = jest.spyOn(Storage.prototype, 'setItem');
        setup();
        trigger.click();
        type('dashboard');
        key(input(), 'Escape');
        expect(options()).toHaveLength(0);
        trigger.click();
        expect(input().value).toBe('');
        expect(options().length).toBe(9);
        expect(setItem).not.toHaveBeenCalled();
        setItem.mockRestore();
    });

    test('reflects runtime changes to the menu tree while open', () => {
        setup();
        trigger.click();
        const moduleHeader = new (buildMenuEntryCtor())({ label: 'Module X', requirement: 0, children: [] });
        menu.push(moduleHeader);
        moduleHeader.children.push(new (buildMenuEntryCtor())({ label: 'Module Page', url: '/interface/modules/x.php', target: 'mod', requirement: 0 }));
        type('module page');
        expect(optionLabels()).toEqual(['Module Page']);
        expect(options()[0].querySelector('[data-oe-menu-launcher="path"]').textContent).toBe('Module X');
        menu()[0].label('Agenda');
        type('');
        expect(optionLabels()[0]).toBe('Agenda');
        menu.remove(moduleHeader);
        expect(optionLabels()).not.toContain('Module Page');
    });

    test('destroy removes listeners and computed subscriptions', () => {
        setup();
        controller.destroy();
        controller = null;
        trigger.click();
        expect(overlay().hidden).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Native pointer focus (mousedown default action) and IME composition
// ---------------------------------------------------------------------------

describe('pointer focus', () => {
    test('mousedown on a result is cancelled so the search field keeps focus', () => {
        setup();
        trigger.click();
        const down = nativeMousedown(options()[1]);
        expect(down.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(input());
    });

    test('mousedown on text inside a result also keeps focus in the search field', () => {
        setup();
        trigger.click();
        nativeMousedown(options()[1].querySelector('[data-oe-menu-launcher="label"]'));
        expect(document.activeElement).toBe(input());
    });

    test('clicking a blocked result leaves the dialog keyboard-operable (arrows, then Escape)', () => {
        setup();
        trigger.focus();
        trigger.click();
        type('issues');
        nativeClick(options()[0]);
        expect(dispatch).not.toHaveBeenCalled();
        expect(overlay().hidden).toBe(false);
        expect(document.activeElement).toBe(input());

        type('');
        key(document.activeElement, 'ArrowDown');
        expect(options()[1].getAttribute('aria-selected')).toBe('true');
        key(document.activeElement, 'Escape');
        expect(overlay().hidden).toBe(true);
        expect(document.activeElement).toBe(trigger);
    });

    test('a blocked click returns focus to the search field even when focus had already left it', () => {
        setup();
        trigger.click();
        type('issues');
        input().blur();
        expect(document.activeElement).toBe(document.body);
        options()[0].click();
        expect(dispatch).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(input());
    });

    test('clicking an available result still dispatches once and closes', () => {
        setup();
        trigger.click();
        nativeClick(options()[0]);
        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(overlay().hidden).toBe(true);
    });

    test('backdrop mousedown closes and the trigger keeps the restored focus', () => {
        setup();
        trigger.focus();
        trigger.click();
        const down = nativeMousedown(overlay());
        expect(down.defaultPrevented).toBe(true);
        expect(overlay().hidden).toBe(true);
        expect(document.activeElement).toBe(trigger);
    });

    test('mousedown inside the dialog (not a result) keeps its default behaviour', () => {
        setup();
        trigger.click();
        const down = nativeMousedown(q('[data-oe-menu-launcher="status"]'));
        expect(down.defaultPrevented).toBe(false);
        expect(overlay().hidden).toBe(false);
    });

    describe.each([
        ['title', () => q('#oeMenuLauncherTitle')],
        ['header area', () => q('.oe-menu-launcher__head')],
        ['status text', () => q('[data-oe-menu-launcher="status"]')],
        ['empty-state text', () => q('[data-oe-menu-launcher="empty"]')],
        ['dialog padding', () => q('[role="dialog"]')],
    ])('clicking the %s', (name, target) => {
        function openAndClick() {
            setup();
            trigger.focus();
            trigger.click();
            if (name === 'empty-state text') {
                type('zzzz no match');
                expect(target().hidden).toBe(false);
            }
            nativeClick(target());
            expect(overlay().hidden).toBe(false);
        }

        test('keeps focus inside the dialog', () => {
            openAndClick();
            expect(q('[role="dialog"]').contains(document.activeElement)).toBe(true);
        });

        test('leaves Escape working and restores focus to the trigger', () => {
            openAndClick();
            key(document.activeElement, 'Escape');
            expect(overlay().hidden).toBe(true);
            expect(document.activeElement).toBe(trigger);
        });

        test('leaves the Tab trap working (search field, then close button)', () => {
            openAndClick();
            const tab = key(document.activeElement, 'Tab');
            expect(tab.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(input());
            key(document.activeElement, 'Tab');
            expect(document.activeElement).toBe(q('[data-oe-menu-launcher="close"]'));
        });
    });

    test('mousedown on the search field still focuses it and typing still filters', () => {
        setup();
        trigger.click();
        nativeMousedown(q('#oeMenuLauncherTitle'));
        const down = nativeMousedown(input());
        expect(down.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(input());
        type('zzzz no match');
        expect(options()).toHaveLength(0);
    });
});

describe('IME composition', () => {
    test('Enter that commits a composition (isComposing) does not navigate', () => {
        setup();
        trigger.click();
        const ev = imeKey(input(), 'Enter', { isComposing: true, keyCode: 229 });
        expect(dispatch).not.toHaveBeenCalled();
        expect(ev.defaultPrevented).toBe(false);
        expect(overlay().hidden).toBe(false);
    });

    test('isComposing alone is enough to ignore Enter (no keyCode 229, no composition events seen)', () => {
        setup();
        trigger.click();
        imeKey(input(), 'Enter', { isComposing: true, keyCode: 13 });
        expect(dispatch).not.toHaveBeenCalled();
    });

    test('Enter reported with keyCode 229 after compositionend (Safari order) does not navigate', () => {
        setup();
        trigger.click();
        composition('compositionstart');
        composition('compositionend');
        const ev = imeKey(input(), 'Enter', { isComposing: false, keyCode: 229 });
        expect(dispatch).not.toHaveBeenCalled();
        expect(ev.defaultPrevented).toBe(false);
    });

    test('Enter between compositionstart and compositionend is ignored even without isComposing', () => {
        setup();
        trigger.click();
        composition('compositionstart');
        imeKey(input(), 'Enter', { isComposing: false, keyCode: 13 });
        expect(dispatch).not.toHaveBeenCalled();
        composition('compositionend');
    });

    test('a normal Enter after the composition ends still navigates', () => {
        setup();
        trigger.click();
        composition('compositionstart');
        imeKey(input(), 'Enter', { isComposing: true, keyCode: 229 });
        composition('compositionend');
        expect(dispatch).not.toHaveBeenCalled();
        const ev = imeKey(input(), 'Enter', { isComposing: false, keyCode: 13 });
        expect(ev.defaultPrevented).toBe(true);
        expect(dispatch).toHaveBeenCalledTimes(1);
    });

    test('arrows and Escape during composition are left to the IME', () => {
        setup();
        trigger.click();
        composition('compositionstart');
        const down = imeKey(input(), 'ArrowDown', { isComposing: true, keyCode: 229 });
        expect(down.defaultPrevented).toBe(false);
        expect(options()[0].getAttribute('aria-selected')).toBe('true');
        const esc = imeKey(input(), 'Escape', { isComposing: true, keyCode: 229 });
        expect(esc.defaultPrevented).toBe(false);
        expect(overlay().hidden).toBe(false);
        composition('compositionend');
        key(input(), 'ArrowDown');
        expect(options()[1].getAttribute('aria-selected')).toBe('true');
    });

    test('an unfinished composition does not carry over to the next opening', () => {
        setup();
        trigger.click();
        composition('compositionstart');
        controller.close();
        trigger.click();
        imeKey(input(), 'Enter', { isComposing: false, keyCode: 13 });
        expect(dispatch).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// Integration with the real menuActionClick from tabs_view_model.js
// ---------------------------------------------------------------------------

describe('dispatch through the real menuActionClick', () => {
    const FORM_MENU = SMALL_MENU.concat([{
        label: 'Visit Forms',
        requirement: 0,
        children: [{
            label: 'Clinical',
            requirement: 2,
            children: [{ label: 'Vitals', url: '/interface/patient_file/encounter/load_form.php?formname=vitals', target: 'enc', requirement: 2 }],
        }],
    }]);

    beforeAll(() => {
        window.$ = window.jQuery = require('jquery');
        const src = fs.readFileSync(path.join(ROOT, 'interface/main/tabs/js/tabs_view_model.js'), 'utf8');
        // Indirect eval so the function declarations become globals, as in main.php.
        (0, eval)(src);
    });

    beforeEach(() => {
        window.webroot_url = '/oe';
        window.attendant_type = 'patient';
        window.telemetryEnabled = false;
        window.xl = (s) => s;
        window.restoreSession = jest.fn();
        window.navigateTab = jest.fn();
        window.dlgopen = jest.fn();
        window.alert = jest.fn();
        window.isEncounterLocked = jest.fn(() => false);
        document.body.innerHTML = renderLauncherTemplate();
        app = newAppViewModel();
        window.app_view_model = app;
        menu = buildLiveMenu(FORM_MENU, app);
        controller = Launcher.create({ root: q('[data-oe-menu-launcher="root"]'), menu, ko });
        trigger = q('[data-oe-menu-launcher="trigger"]');
    });

    function selectPatientAndEncounter() {
        app.application_data.patient({
            selectedEncounter: ko.observable({ id: 42 }),
            selectedEncounterID: ko.observable(42),
        });
    }

    test('tab entries navigate to their target through navigateTab', () => {
        trigger.click();
        type('calendar');
        key(input(), 'Enter');
        expect(window.navigateTab).toHaveBeenCalledTimes(1);
        const [url, target] = window.navigateTab.mock.calls[0];
        expect(url).toBe('/oe/interface/main/main_info.php');
        expect(target).toBe('cal');
    });

    test('popup entries open popMenuDialog titled with the menu label only', () => {
        trigger.click();
        type('payment');
        key(input(), 'Enter');
        expect(window.navigateTab).not.toHaveBeenCalled();
        expect(window.dlgopen).toHaveBeenCalledTimes(1);
        const [url, name, , , , title] = window.dlgopen.mock.calls[0];
        expect(url).toBe('/oe/interface/patient_file/front_payment.php');
        expect(name).toBe('menupopup');
        expect(title).toBe('Payment');
    });

    test('patient-scoped popups never reach dlgopen without a patient', () => {
        trigger.click();
        type('issues');
        key(input(), 'Enter');
        expect(window.dlgopen).not.toHaveBeenCalled();
        expect(window.alert).not.toHaveBeenCalled();
    });

    test('locked encounters are still refused by menuActionClick', () => {
        selectPatientAndEncounter();
        window.isEncounterLocked = jest.fn(() => true);
        trigger.click();
        type('vitals');
        key(input(), 'Enter');
        expect(window.isEncounterLocked).toHaveBeenCalledWith(42);
        expect(window.alert).toHaveBeenCalledWith('This encounter is locked. No new forms can be added.');
        expect(window.navigateTab).not.toHaveBeenCalled();
    });

    test('encounter form entries keep the load_form fixup', () => {
        selectPatientAndEncounter();
        trigger.click();
        type('vitals');
        key(input(), 'Enter');
        expect(window.navigateTab).toHaveBeenCalledTimes(1);
        expect(window.navigateTab.mock.calls[0][0]).toBe('/oe/interface/patient_file/encounter/encounter_top.php?formname=vitals&formdesc=Vitals');
        expect(window.navigateTab.mock.calls[0][1]).toBe('enc');
    });
});

describe('main tabs shell wiring', () => {
    const mainPhp = fs.readFileSync(path.join(ROOT, 'interface/main/tabs/main.php'), 'utf8');

    test('loads the launcher after tabs_view_model.js so menuActionClick exists', () => {
        const tabs = mainPhp.indexOf('js/tabs_view_model.js');
        const launcher = mainPhp.indexOf('js/menu_launcher.js');
        expect(tabs).toBeGreaterThan(-1);
        expect(launcher).toBeGreaterThan(tabs);
    });

    test('keeps the dropdown menu and adds the launcher beside it', () => {
        const dropdown = mainPhp.indexOf("template: {name: 'menu-template', data: application_data}");
        const render = mainPhp.indexOf('interface/main/tabs/menu_launcher.html.twig');
        expect(dropdown).toBeGreaterThan(-1);
        expect(render).toBeGreaterThan(dropdown);
    });

    test('creates the launcher over the live menu after bindings are applied', () => {
        const bind = mainPhp.indexOf('ko.applyBindings(app_view_model);');
        const create = mainPhp.indexOf('OpenEMRMenuLauncher.create(');
        expect(create).toBeGreaterThan(bind);
        expect(mainPhp.slice(create, create + 300)).toContain('menu: app_view_model.application_data.menu');
    });
});

/**
 * Re-extract the real menu_entry constructor bound to the current `app` so
 * runtime-added entries behave like server-provided ones.
 */
function buildMenuEntryCtor() {
    const twig = fs.readFileSync(path.join(ROOT, 'templates/interface/main/tabs/menu_json.html.twig'), 'utf8');
    const body = twig.match(/<script>([\s\S]*)<\/script>/)[1].replace('{{ menu_restrictions|json_encode }}', '[]');
    const scratch = { application_data: app.application_data };
    const saved = scratch.application_data.menu;
    const ctor = new Function('ko', 'app_view_model', body + '\nreturn menu_entry;')(ko, scratch);
    scratch.application_data.menu = saved;
    return ctor;
}
