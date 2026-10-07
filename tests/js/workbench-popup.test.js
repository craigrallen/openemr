/** @jest-environment node */
// Every window below is a real JSDOM window. parent, opener and frameElement are
// wired the way a browser exposes them to same-origin script; cross-origin access
// is simulated with a throwing accessor because jsdom does not enforce SOP.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '../..');
const popupPath = path.join(root, 'interface/clinical-workspace/popup.js');
const ORIGIN = 'https://emr.test';

function makeWindow(html, { url = `${ORIGIN}/interface/legacy.php`, parent, opener, frameElement } = {}) {
    const { window } = new JSDOM(html, { url, runScripts: 'outside-only' });
    if (parent) Object.defineProperty(window, 'parent', { configurable: true, get: () => parent });
    if (frameElement) Object.defineProperty(window, 'frameElement', { configurable: true, get: () => frameElement });
    if (opener) window.opener = opener;
    return window;
}

function makeShell(active = true) {
    return makeWindow(
        `<body class="${active ? 'workbench-active' : ''}"><div id="mainBox" class="${active ? '' : 'workbench-legacy'}">` +
        '<button type="button" data-workbench-mode></button></div>' +
        '<div class="modal fade dialogModal"><div class="modal-dialog"><div class="modal-content">' +
        '<iframe class="modalIframe" name="dlg1"></iframe></div></div></div><iframe name="pat"></iframe></body>',
        { url: `${ORIGIN}/interface/main/tabs/main.php` }
    );
}

function loadPopupApi() {
    jest.resetModules();
    return require(popupPath);
}

function startIn(win) {
    const api = loadPopupApi();
    return api.createPopupController({ win });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const htmlClasses = (win) => [...win.document.documentElement.classList];

describe('workbench popup context discovery', () => {
    test('a dlgopen iframe under an active workbench is a genuine popup', () => {
        const shell = makeShell();
        const dialogFrame = shell.document.querySelector('iframe.modalIframe');
        const child = makeWindow('<body class="body_top"></body>', { parent: shell, frameElement: dialogFrame });
        const controller = startIn(child);

        expect(controller.active).toBe(true);
        expect(htmlClasses(child)).toEqual(expect.arrayContaining(['oe-workbench-context', 'oe-workbench-popup']));
        expect(child.document.body.className).toBe('body_top');
    });

    test('an ordinary workbench tab iframe gets overlay context but is not marked as a popup', () => {
        const shell = makeShell();
        const tabFrame = shell.document.querySelector('iframe[name="pat"]');
        const child = makeWindow('<body></body>', { parent: shell, frameElement: tabFrame });
        startIn(child);

        expect(htmlClasses(child)).toContain('oe-workbench-context');
        expect(htmlClasses(child)).not.toContain('oe-workbench-popup');
    });

    test('a nested frame inside dialog content inherits popup ancestry', () => {
        const shell = makeShell();
        const dialog = makeWindow('<body><iframe name="inner"></iframe></body>', {
            parent: shell, frameElement: shell.document.querySelector('iframe.modalIframe')
        });
        const inner = makeWindow('<body></body>', { parent: dialog, frameElement: dialog.document.querySelector('iframe') });
        startIn(inner);

        expect(htmlClasses(inner)).toEqual(expect.arrayContaining(['oe-workbench-context', 'oe-workbench-popup']));
    });

    test('the active shell marks its own root for local modals but never as popup content', () => {
        const shell = makeShell();
        const controller = startIn(shell);

        expect(controller.active).toBe(true);
        expect(htmlClasses(shell)).toEqual(['oe-workbench-context']);
        expect(shell.document.body.className).toBe('workbench-active');
    });

    test('a standalone window inherits the workbench through window.opener', () => {
        const shell = makeShell();
        const popup = makeWindow('<body></body>', { opener: shell });
        startIn(popup);

        expect(htmlClasses(popup)).toEqual(expect.arrayContaining(['oe-workbench-context', 'oe-workbench-popup']));
    });

    test('an opener inside a workbench tab frame resolves through the opener ancestors', () => {
        const shell = makeShell();
        const tab = makeWindow('<body></body>', { parent: shell, frameElement: shell.document.querySelector('iframe[name="pat"]') });
        const popup = makeWindow('<body></body>', { opener: tab });
        startIn(popup);

        expect(htmlClasses(popup)).toContain('oe-workbench-popup');
    });

    test('nested popups follow the original host, not the intermediate legacy window', async () => {
        const shell = makeShell();
        const first = makeWindow('<body></body>', { opener: shell });
        startIn(first);
        const second = makeWindow('<body></body>', { opener: first });
        startIn(second);
        expect(htmlClasses(second)).toContain('oe-workbench-popup');

        shell.document.body.classList.remove('workbench-active');
        await flush();
        expect(htmlClasses(second)).toEqual([]);
        expect(htmlClasses(first)).toEqual([]);
    });

    test('a standalone window opened outside the workbench stays legacy and observes nothing', () => {
        const legacyOpener = makeWindow('<body class="body_top"></body>');
        const popup = makeWindow('<body></body>', { opener: legacyOpener });
        const observe = jest.fn();
        const controller = loadPopupApi().createPopupController({ win: popup, observe });

        expect(controller.active).toBe(false);
        expect(htmlClasses(popup)).toEqual([]);
        expect(observe).not.toHaveBeenCalled();
    });
});

describe('workbench popup refusal cases', () => {
    test('opener cycles terminate without activation', () => {
        const a = makeWindow('<body></body>');
        const b = makeWindow('<body></body>', { opener: a });
        a.opener = b;
        const controller = startIn(b);

        expect(controller.active).toBe(false);
    });

    test('a cross-origin opener carrying workbench-active is never trusted', () => {
        const foreign = makeWindow('<body class="workbench-active"><div id="mainBox"></div></body>', { url: 'https://other.test/main.php' });
        const popup = makeWindow('<body></body>', { opener: foreign });
        startIn(popup);

        expect(htmlClasses(popup)).toEqual([]);
    });

    test('an access-denied ancestor stops the walk without throwing or leaking past it', () => {
        const shell = makeShell();
        // Like a cross-origin WindowProxy: closed is readable, location.origin/document throw.
        const denied = new Proxy(makeWindow('<body></body>', { parent: shell }), {
            get(target, prop) {
                if (prop === 'closed') return false;
                if (prop === 'location') return { get origin() { throw new Error('SecurityError'); } };
                throw new Error('SecurityError');
            }
        });
        const child = makeWindow('<body></body>', { parent: denied });

        expect(() => startIn(child)).not.toThrow();
        expect(htmlClasses(child)).toEqual([]);
    });

    test('a closed opener is ignored', () => {
        const shell = makeShell();
        const popup = makeWindow('<body></body>', { opener: shell });
        Object.defineProperty(shell, 'closed', { configurable: true, get: () => true });
        startIn(popup);

        expect(htmlClasses(popup)).toEqual([]);
    });

    test('a host document without a body is refused', () => {
        const shell = makeShell();
        shell.document.documentElement.removeChild(shell.document.body);
        const popup = makeWindow('<body></body>', { opener: shell });
        startIn(popup);

        expect(htmlClasses(popup)).toEqual([]);
    });
});

describe('workbench popup lifecycle', () => {
    test('follows the host mode toggle in both directions', async () => {
        const shell = makeShell(false);
        const child = makeWindow('<body></body>', { parent: shell, frameElement: shell.document.querySelector('iframe.modalIframe') });
        startIn(child);
        expect(htmlClasses(child)).toEqual([]);

        shell.document.body.classList.add('workbench-active');
        await flush();
        expect(htmlClasses(child)).toEqual(expect.arrayContaining(['oe-workbench-context', 'oe-workbench-popup']));

        shell.document.body.classList.remove('workbench-active');
        await flush();
        expect(htmlClasses(child)).toEqual([]);
    });

    test('unload disposes owned classes and the host observer, preserving external classes', async () => {
        const shell = makeShell();
        const child = makeWindow('<html class="theme-x oe-workbench-context"><body></body></html>', { opener: shell });
        startIn(child);
        expect(htmlClasses(child)).toEqual(['theme-x', 'oe-workbench-context', 'oe-workbench-popup']);

        child.dispatchEvent(new child.Event('pagehide'));
        expect(htmlClasses(child)).toEqual(['theme-x', 'oe-workbench-context']);

        shell.document.body.classList.remove('workbench-active');
        shell.document.body.classList.add('workbench-active');
        await flush();
        expect(htmlClasses(child)).toEqual(['theme-x', 'oe-workbench-context']);
    });

    test('activation leaves opener callbacks, returnValue, dlgclose and form state untouched', () => {
        const shell = makeShell();
        const setpatient = jest.fn();
        shell.setpatient = setpatient;
        const child = makeWindow(
            '<body><form><input name="dx" value="a" disabled><select required><option>x</option></select></form></body>',
            { opener: shell }
        );
        child.returnValue = 'keep';
        child.dlgclose = jest.fn();
        const before = child.document.body.outerHTML;
        startIn(child);

        expect(child.document.body.outerHTML).toBe(before);
        expect(child.returnValue).toBe('keep');
        expect(child.opener.setpatient).toBe(setpatient);
        expect(child.dlgclose).not.toHaveBeenCalled();
        expect(setpatient).not.toHaveBeenCalled();
        expect(child.document.querySelector('input').disabled).toBe(true);
    });

    test('the browser bundle starts synchronously in <head> and exposes its API', () => {
        const shell = makeShell();
        const child = makeWindow('<body></body>', { opener: shell });
        child.eval(fs.readFileSync(popupPath, 'utf8'));

        expect(htmlClasses(child)).toContain('oe-workbench-popup');
        expect(typeof child.OpenEMRWorkbenchPopup.findWorkbenchHost).toBe('function');
        expect(child.document.body.getAttribute('class')).toBeNull();
    });
});

describe('route mode controller opener inheritance', () => {
    test('mode.js activates a standalone route window opened from the workbench', () => {
        jest.resetModules();
        const { createModeController } = require('../../interface/clinical-workspace/mode.js');
        const shell = makeShell();
        const popup = makeWindow('<body></body>', { opener: shell });
        const controller = createModeController({
            body: popup.document.body,
            parentWindow: popup.parent,
            openerWindow: popup.opener,
            origin: ORIGIN,
            observe: (target, callback) => {
                const observer = new popup.MutationObserver(callback);
                observer.observe(target, { attributes: true, attributeFilter: ['class'] });
                return observer;
            }
        });

        expect(controller.active).toBe(true);
        expect(popup.document.body.classList.contains('oe-clinical-workspace')).toBe(true);
        controller.dispose();
        expect(popup.document.body.classList.contains('oe-clinical-workspace')).toBe(false);
    });
});

// Header autoloads popup.js from <head>, so on main.php itself the shell body does not
// exist yet. These documents run the real bundle inline from <head> during parsing; a
// prior inline script counts MutationObserver constructions.
describe('workbench shell self-detection from <head>', () => {
    const SOURCE = fs.readFileSync(popupPath, 'utf8');
    const COUNTER = '<script>window.__observers = 0; const M = window.MutationObserver;' +
        'window.MutationObserver = class extends M { constructor(cb) { super(cb); window.__observers++; } };</script>';
    const SHELL_BODY = '<div id="mainBox"><nav><button type="button" data-workbench-mode></button></nav></div>' +
        '<div class="modal fade" id="localModal"><div class="modal-dialog"><div class="modal-content"></div></div></div>';

    function parseTopLevel(body, { bodyClass = '', extraHead = '', url = `${ORIGIN}/interface/main/tabs/main.php` } = {}) {
        const { window } = new JSDOM(
            `<!DOCTYPE html><html><head>${COUNTER}<script>${SOURCE}</script>${extraHead}</head>` +
            `<body class="${bodyClass}">${body}</body></html>`,
            { url, runScripts: 'dangerously' }
        );
        return window;
    }

    test('the shell resolves itself after DOMContentLoaded with a single observer', async () => {
        const shell = parseTopLevel(SHELL_BODY, { bodyClass: 'workbench-active' });
        await flush();

        expect(htmlClasses(shell)).toEqual(['oe-workbench-context']);
        expect(shell.__observers).toBe(1);
        expect(shell.document.body.className).toBe('workbench-active');
    });

    test('mode toggles on the shell are followed without new controllers or observers', async () => {
        const shell = parseTopLevel(SHELL_BODY, { bodyClass: 'workbench-active' });
        await flush();
        shell.document.body.classList.remove('workbench-active');
        await flush();
        expect(htmlClasses(shell)).toEqual([]);

        shell.document.body.classList.add('workbench-active');
        await flush();
        expect(htmlClasses(shell)).toEqual(['oe-workbench-context']);
        expect(shell.__observers).toBe(1);
    });

    test('a shell booted in legacy mode activates when the workbench is switched on later', async () => {
        const shell = parseTopLevel(SHELL_BODY.replace('id="mainBox"', 'id="mainBox" class="workbench-legacy"'));
        await flush();
        expect(htmlClasses(shell)).toEqual([]);

        shell.document.body.classList.add('workbench-active');
        await flush();
        expect(htmlClasses(shell)).toEqual(['oe-workbench-context']);
        expect(shell.__observers).toBe(1);
    });

    test('an arbitrary top-level legacy page is never observed, even if its body later gains the class', async () => {
        const page = parseTopLevel('<div id="mainBox"></div><div class="modal"></div>', {
            url: `${ORIGIN}/interface/patient_file/summary/demographics.php`
        });
        await flush();
        page.document.body.classList.add('workbench-active');
        await flush();

        expect(htmlClasses(page)).toEqual([]);
        expect(page.__observers).toBe(0);
    });

    test('pagehide before DOMContentLoaded cancels the pending start', async () => {
        const shell = parseTopLevel(SHELL_BODY, {
            bodyClass: 'workbench-active',
            extraHead: '<script>window.dispatchEvent(new Event("pagehide"));</script>'
        });
        await flush();

        expect(htmlClasses(shell)).toEqual([]);
        expect(shell.__observers).toBe(0);
    });

    test('pre-existing html classes owned by the page survive shell dispose', async () => {
        const { window: shell } = new JSDOM(
            `<!DOCTYPE html><html class="workbench-active oe-workbench-context"><head><script>${SOURCE}</script></head>` +
            `<body class="workbench-active">${SHELL_BODY}</body></html>`,
            { url: `${ORIGIN}/interface/main/tabs/main.php`, runScripts: 'dangerously' }
        );
        await flush();
        shell.dispatchEvent(new shell.Event('pagehide'));

        expect(htmlClasses(shell)).toEqual(['workbench-active', 'oe-workbench-context']);
    });
});
