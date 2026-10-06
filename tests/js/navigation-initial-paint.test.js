/** @jest-environment jsdom */
// The saved navigation mode must be on the shell before its first child can
// paint, so neither navigation flashes while the rest of main.php still loads.
const ko = require('knockout');
const fs = require('fs');
const path = require('path');

require('../../interface/main/tabs/js/menu_launcher.js');
require('../../interface/main/tabs/js/workbench_shell.js');

const root = path.resolve(__dirname, '../..');
const mainPhp = fs.readFileSync(path.join(root, 'interface/main/tabs/main.php'), 'utf8');
const KEY = 'openemr.navigation.mode';

function bootScript() {
    const match = mainPhp.match(/<script data-navigation-boot>([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    expect(match[1]).not.toContain('<?');
    return match[1];
}

function createScript() {
    const match = mainPhp.match(/ko\.applyBindings\(app_view_model\);\s*([\s\S]*?)\n\s*\$\(function \(\) \{/);
    expect(match).not.toBeNull();
    return match[1];
}

// The real mode button and the inline script that follows it, with translations resolved.
function controlSnippet() {
    const match = mainPhp.match(/(<button[^>]*data-workbench-mode[\s\S]*?<\/button>)\s*<script data-navigation-control>([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const html = match[1].replace(/<\?php echo xl[at]\('([^']*)'\); \?>/g, '$1');
    expect(html).not.toContain('<?');
    expect(match[2]).not.toContain('<?');
    return { html, script: match[2] };
}

const fixtureShellMarkup = '<nav><div id="mainMenu"></div><div data-workbench-areas><button type="button" data-workbench-area="Work">Work</button></div><button data-workbench-mode data-workbench-label="Workbench navigation" data-legacy-label="Legacy navigation">Legacy navigation</button><button data-workbench-mobile-toggle>Navigation</button></nav><div id="workbench"><div data-workbench-backdrop></div><aside id="workbenchRail"><button data-workbench-mobile-close>Close</button><input type="search" data-workbench-search><p id="workbenchNotice" data-workbench-notice></p><div data-workbench-tree></div></aside><main id="workbenchContent"><div id="attendantData"></div><div class="workbench-content-head"></div><div id="tabs_div"></div><div id="mainFrames_div"><iframe></iframe></div></main></div>';

// Parses the shell as main.php does: the control script runs right after the mode button.
function parseShell(box) {
    const control = controlSnippet();
    box.innerHTML = fixtureShellMarkup.replace(/<button data-workbench-mode[\s\S]*?<\/button>/, control.html);
    new Function('window', 'document', 'OpenEMRNavigationBoot', control.script)(bootWindow, document, bootWindow.OpenEMRNavigationBoot);
    return box.querySelector('[data-workbench-mode]');
}

function memoryStorage(initial) {
    const values = new Map(initial === undefined ? [] : [[KEY, initial]]);
    return { getItem: key => (values.has(key) ? values.get(key) : null), setItem: (key, v) => values.set(key, String(v)) };
}

// Simulates the parser having just opened #mainBox: no navigation child exists yet.
let bootWindow;
function parseUpToBoot(storageAccessor) {
    document.documentElement.className = '';
    document.body.className = 'min-vw-100';
    document.body.innerHTML = '<div id="mainBox"></div>';
    const win = {};
    bootWindow = win;
    Object.defineProperty(win, 'localStorage', { get: storageAccessor });
    new Function('window', 'document', bootScript())(win, document);
    return document.getElementById('mainBox');
}

function state() {
    const box = document.getElementById('mainBox');
    return {
        legacy: box.classList.contains('workbench-legacy'),
        staticLegacy: box.classList.contains('workbench-static-legacy'),
        html: document.documentElement.classList.contains('workbench-active'),
        body: document.body.classList.contains('workbench-active')
    };
}

const WORKBENCH = { legacy: false, staticLegacy: false, html: true, body: true };
const LEGACY_IN_PLACE = { legacy: true, staticLegacy: true, html: false, body: false };

afterEach(() => { document.body.innerHTML = ''; document.documentElement.className = ''; });

test('boot script runs immediately after #mainBox opens, before any navigation markup', () => {
    const open = mainPhp.indexOf('<div id="mainBox"');
    const boot = mainPhp.indexOf('<script data-navigation-boot>');
    expect(boot).toBeGreaterThan(open);
    expect(mainPhp.slice(open, boot)).not.toMatch(/<nav|id="mainMenu"|id="workbench"/);
    expect(bootScript()).toContain(`'${KEY}'`);
});

test.each([
    ['nothing saved', () => memoryStorage(), WORKBENCH],
    ['saved workbench', () => memoryStorage('workbench'), WORKBENCH],
    ['saved legacy', () => memoryStorage('legacy'), LEGACY_IN_PLACE],
    ['unknown value', () => memoryStorage('compact'), WORKBENCH],
    ['getItem throws', () => ({ getItem() { throw new Error('blocked'); } }), WORKBENCH],
    ['no storage', () => null, WORKBENCH],
])('%s: initial parse already carries the final mode', (label, storage, expected) => {
    parseUpToBoot(storage);
    expect(state()).toEqual(expected);
});

test('storage access denied by the browser defaults to workbench', () => {
    parseUpToBoot(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(state()).toEqual(WORKBENCH);
});

function control(button) {
    return { text: button.textContent, pressed: button.getAttribute('aria-pressed'), disabled: button.disabled };
}

test.each([
    ['workbench', undefined, WORKBENCH, { text: 'Legacy navigation', pressed: 'false' }],
    ['legacy', 'legacy', LEGACY_IN_PLACE, { text: 'Workbench navigation', pressed: 'true' }],
])('early %s mode control already matches the boot state and stays inert until init', (label, saved, expected, labelled) => {
    const storage = memoryStorage(saved);
    const box = parseUpToBoot(() => storage);
    const button = parseShell(box);
    expect(state()).toEqual(expected);
    expect(control(button)).toEqual({ ...labelled, disabled: true });
    const listener = jest.fn();
    box.addEventListener('click', listener);
    button.click();
    expect(listener).not.toHaveBeenCalled();
    expect(storage.getItem(KEY)).toBe(saved === undefined ? null : saved);
});

test.each([
    ['workbench', undefined, WORKBENCH],
    ['legacy', 'legacy', LEGACY_IN_PLACE],
])('a successful init keeps the early %s control and round trips stay consistent', (label, saved, expected) => {
    const storage = memoryStorage(saved);
    const box = parseUpToBoot(() => storage);
    const button = parseShell(box);
    const early = { state: state(), control: { ...control(button), disabled: false } };
    let created;
    const shell = { create: jest.fn(options => { created = window.OpenEMRWorkbenchShell.create({ ...options, ko, storage }); }) };
    runCreateScript(box, shell);
    expect(shell.create).toHaveBeenCalledTimes(1);
    expect({ state: state(), control: control(button) }).toEqual(early);
    button.click();
    expect(state()).toEqual(expected.legacy ? WORKBENCH : LEGACY_IN_PLACE);
    expect(control(button)).toEqual(expected.legacy
        ? { text: 'Legacy navigation', pressed: 'false', disabled: false }
        : { text: 'Workbench navigation', pressed: 'true', disabled: false });
    button.click();
    expect({ state: state(), control: control(button) }).toEqual(early);
    expect(storage.getItem(KEY)).toBe(expected.legacy ? 'legacy' : 'workbench');
    created.destroy();
});

test('with moveBefore, early legacy keeps nodes visible in place until create moves them', () => {
    const nativeMove = Element.prototype.moveBefore;
    Element.prototype.moveBefore = function (node, before) { this.insertBefore(node, before); };
    try {
        const storage = memoryStorage('legacy');
        const box = parseUpToBoot(() => storage);
        expect(state()).toEqual(LEGACY_IN_PLACE);
        parseShell(box);
        const shell = window.OpenEMRWorkbenchShell.create({ root: box, menu: ko.observableArray([]), ko, storage });
        expect(state()).toEqual({ legacy: true, staticLegacy: false, html: false, body: false });
        expect(document.getElementById('mainFrames_div').parentElement).toBe(box);
        shell.destroy();
    } finally {
        if (nativeMove) Element.prototype.moveBefore = nativeMove;
        else delete Element.prototype.moveBefore;
    }
});

test('a failing workbench init falls back explicitly to the usable legacy menu', () => {
    const box = parseUpToBoot(() => memoryStorage());
    parseShell(box);
    expect(state()).toEqual(WORKBENCH);
    const error = new Error('init failed');
    const shell = { create: jest.fn(() => { throw error; }) };
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const app = { application_data: { menu: ko.observableArray([]), tabs: { tabsList: ko.observableArray([]) } } };
    new Function('window', 'document', 'OpenEMRWorkbenchShell', 'OpenEMRNavigationBoot', 'app_view_model', 'jsGlobals', createScript())(
        window, document, shell, bootWindow.OpenEMRNavigationBoot, app, { enable_group_therapy: '0' }
    );
    expect(shell.create).toHaveBeenCalledTimes(1);
    expect(state()).toEqual(LEGACY_IN_PLACE);
    expect(logged).toHaveBeenCalledWith(expect.any(String), error);
    logged.mockRestore();
});

function runCreateScript(box, shell) {
    const app = { application_data: { menu: ko.observableArray([]), tabs: { tabsList: ko.observableArray([]) } } };
    new Function('window', 'document', 'OpenEMRWorkbenchShell', 'OpenEMRNavigationBoot', 'app_view_model', 'jsGlobals', createScript())(
        window, document, shell, bootWindow.OpenEMRNavigationBoot, app, { enable_group_therapy: '0' }
    );
    return box.querySelector('[data-workbench-mode]');
}

test.each([
    ['workbench', undefined],
    ['legacy', 'legacy'],
])('after a failed init from early %s the mode control cannot reach a listener left by the partial create', (label, saved) => {
    const storage = memoryStorage(saved);
    const box = parseUpToBoot(() => storage);
    parseShell(box);
    const partial = jest.fn(() => { storage.setItem(KEY, 'workbench'); bootWindow.OpenEMRNavigationBoot.apply(false); });
    const shell = { create: jest.fn(options => {
        options.root.querySelector('[data-workbench-mode]').addEventListener('click', partial);
        throw new Error('init failed late');
    }) };
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const button = runCreateScript(box, shell);
    logged.mockRestore();

    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Workbench navigation');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(partial).not.toHaveBeenCalled();
    expect(state()).toEqual(LEGACY_IN_PLACE);
    expect(storage.getItem(KEY)).toBe(saved === undefined ? null : saved);
    expect(box.querySelector('[data-workbench-area]').disabled).toBe(false);
    expect(box.querySelector('[data-workbench-mobile-toggle]').disabled).toBe(false);
});
