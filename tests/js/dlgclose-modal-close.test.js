/**
 * @jest-environment jsdom
 */

/*
 * Regression backfill for upstream 861cf93d "fix(calendar): guard opener-refresh chain so
 * appointment-save modal always closes" (#14325), merged into this fork at ee94cec7. The fix
 * landed upstream without JS tests; these were written afterwards against the accepted patch.
 *
 * Chronology / negative fixture: the pre-fix blobs (861cf93d^) are not committed. To reproduce
 * the original failures, point the overrides at extracted copies of those blobs:
 *   git show 861cf93d^:interface/main/tabs/js/include_opener.js > /tmp/old_include_opener.js
 *   git show 861cf93d^:interface/main/calendar/add_edit_event.js > /tmp/old_add_edit_event.js
 *   INCLUDE_OPENER_SOURCE=/tmp/old_include_opener.js ADD_EDIT_EVENT_SOURCE=/tmp/old_add_edit_event.js \
 *     npx jest tests/js/dlgclose-modal-close.test.js
 * Without overrides the real production files are loaded.
 *
 * Both sources are classic scripts with no exports, so they are run as scripts in the window
 * they belong to. Requiring them as modules would hide the top-level `var dlgclose`, and plain
 * eval of raw source never reaches Jest's coverage map, so each source is instrumented with the
 * installed istanbul-lib-instrument under its real path. The instrumented script writes its
 * counters into the shared `__coverage__` object, which is the one Jest reads from the test
 * environment's global when run with --coverage. Instrumentation happens whether or not
 * coverage is on, so the same code path is tested either way.
 *
 * Real jQuery and real Bootstrap 4 Modal run in jsdom. Only the parent-window collaborators
 * (get_opener, setCallBack, restoreSession, dlgopen) are recorded stubs, plus two shims for
 * browser behaviour jsdom lacks (iframe window.opener, form.<controlName> lookup) and one that
 * suppresses jsdom's non-browser window.close() call on iframe detach.
 */

const fs = require('fs');
const path = require('path');
const { createInstrumenter } = require('istanbul-lib-instrument');

const repo = path.join(__dirname, '../..');
const openerPath = process.env.INCLUDE_OPENER_SOURCE
    || path.join(repo, 'interface/main/tabs/js/include_opener.js');
const addEditPath = process.env.ADD_EDIT_EVENT_SOURCE
    || path.join(repo, 'interface/main/calendar/add_edit_event.js');

const instrumenter = createInstrumenter({ coverageVariable: '__coverage__', esModules: false });
const instrumented = (file) => instrumenter.instrumentSync(fs.readFileSync(file, 'utf8'), file);

const $ = require('jquery');
window.$ = window.jQuery = $;
require('bootstrap/js/dist/modal');

window.__coverage__ = window.__coverage__ || {};

// Events Bootstrap fires on the modal, in the order they happen, plus whatever the tests log.
let log;
const MODAL_EVENTS = ['show', 'shown', 'hide', 'hidden'];

function waitFor(predicate, label) {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        (function poll() {
            if (predicate()) {
                resolve();
            } else if (Date.now() - started > 1000) {
                reject(new Error(`timed out waiting for ${label}; log was ${JSON.stringify(log)}`));
            } else {
                setTimeout(poll, 5);
            }
        }());
    });
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

// The markup library/dialog.js builds for an iframe dlgopen(): a .dialogModal div whose id is the
// winname, holding an iframe named after the same winname. include_opener.js runs inside that iframe.
function openDialog(winname, { iframeName = winname } = {}) {
    document.body.innerHTML = `
        <div id="${winname}" class="modal fade dialogModal" tabindex="-1" role="dialog">
            <div class="modal-dialog"><div class="modal-content"><div class="modal-body">
                <iframe class="modalIframe" name="${iframeName}"></iframe>
            </div></div></div>
        </div>`;
    const modal = $(`#${winname}`);
    const iframe = document.querySelector('iframe.modalIframe');
    // Bound to this test's log array, so a transition timer left over from an earlier test can
    // never write into the current one.
    const sink = log;
    MODAL_EVENTS.forEach((name) => modal.on(`${name}.bs.modal`, () => sink.push(name)));
    // Logged before dlgclose's own hidden.bs.modal handler runs, so it sees the iframe as it was
    // at the moment the modal finished hiding.
    modal.on('hidden.bs.modal', () => sink.push(`iframe attached at hidden: ${iframe.isConnected}`));

    const win = iframe.contentWindow;
    win.name = iframeName;
    // jsdom leaves `opener` undefined on iframe windows; browsers expose it as null there.
    if (!('opener' in win)) {
        win.opener = null;
    }
    // Same coverage object as the test window, so counters from the iframe's copy reach Jest.
    win.__coverage__ = window.__coverage__;
    win.eval(instrumented(openerPath));
    // jsdom (HTMLFrameElement _detach) calls contentWindow.close() when an iframe is removed;
    // browsers do not. Here that would run include_opener.js's own window.close override and fire
    // an extra modal('hide') that a real browser never sends, so detach-time close is a no-op.
    win.close = () => {};
    return { modal, iframe, win };
}

const isOpen = (modal) => modal.hasClass('show') && modal[0].style.display === 'block';

beforeEach(() => {
    log = [];
    window.get_opener = jest.fn(() => ({ name: 'tab-opener' }));
    window.setCallBack = jest.fn((call, args) => log.push(['setCallBack', call, args]));
});

afterEach(() => {
    $('.modal').off();
    $('.modal-backdrop').remove();
    document.body.innerHTML = '';
    document.body.className = '';
});

describe('include_opener.js dlgclose()', () => {
    test('script bootstrap: opener is resolved from top.get_opener(window.name) when the iframe has none', () => {
        const { win } = openDialog('dlg_boot');
        expect(window.get_opener).toHaveBeenCalledWith('dlg_boot');
        expect(win.opener).toEqual({ name: 'tab-opener' });
        expect(typeof win.dlgclose).toBe('function');
    });

    test('no .dialogModal for this window.name: returns without registering a callback or touching other dialogs', async () => {
        const { modal, iframe, win } = openDialog('dlg_present', { iframeName: 'dlg_absent' });
        modal.modal('show');
        await waitFor(() => log.includes('shown'), 'shown');
        log.length = 0;

        expect(win.dlgclose('refreshme', ['x'])).toBeUndefined();
        await settle();

        expect(window.setCallBack).not.toHaveBeenCalled();
        expect(log).toEqual([]);
        expect(isOpen(modal)).toBe(true);
        expect(iframe.isConnected).toBe(true);
    });

    test('callback and args are handed to top.setCallBack before the hide starts', async () => {
        const { modal, win } = openDialog('dlg_cb');
        modal.modal('show');
        await waitFor(() => log.includes('shown'), 'shown');
        log.length = 0;

        win.dlgclose('refreshme', { eid: 42, mode: 'save' });
        await waitFor(() => log.includes('hidden'), 'hidden');

        expect(window.setCallBack).toHaveBeenCalledTimes(1);
        expect(window.setCallBack).toHaveBeenCalledWith('refreshme', { eid: 42, mode: 'save' });
        expect(log[0]).toEqual(['setCallBack', 'refreshme', { eid: 42, mode: 'save' }]);
        expect(log.slice(1)).toEqual(['hide', 'hidden', 'iframe attached at hidden: true']);
    });

    test('no callback: setCallBack is not called and the dialog still closes', async () => {
        const { modal, win } = openDialog('dlg_nocb');
        modal.modal('show');
        await waitFor(() => log.includes('shown'), 'shown');

        win.dlgclose();
        await waitFor(() => log.includes('hidden'), 'hidden');

        expect(window.setCallBack).not.toHaveBeenCalled();
        expect(isOpen(modal)).toBe(false);
    });

    test('settled modal: hide starts synchronously, iframe survives until hidden.bs.modal, then is removed', async () => {
        const { modal, iframe, win } = openDialog('dlg_settled');
        modal.modal('show');
        await waitFor(() => log.includes('shown'), 'shown');
        expect(modal.data('bs.modal')._isTransitioning).toBe(false);
        log.length = 0;

        win.dlgclose();
        // The calling script lives in this iframe; it must still be attached when dlgclose returns.
        expect(iframe.isConnected).toBe(true);
        expect(iframe.contentWindow).toBe(win);
        expect(log).toEqual(['hide']);

        await waitFor(() => log.includes('hidden'), 'hidden');
        expect(log).toEqual(['hide', 'hidden', 'iframe attached at hidden: true']);
        expect(iframe.isConnected).toBe(false);
        expect(modal.find('iframe').length).toBe(0);
        expect(isOpen(modal)).toBe(false);
    });

    test('dlgclose during the show transition waits for shown.bs.modal, then hides and cleans up', async () => {
        const { modal, iframe, win } = openDialog('dlg_transition');
        modal.modal('show');
        // Bootstrap is mid-fade; a hide() now would be silently dropped.
        expect(modal.data('bs.modal')._isTransitioning).toBe(true);

        win.dlgclose('refreshme', [7]);
        expect(iframe.isConnected).toBe(true);
        expect(log).toEqual(['show', ['setCallBack', 'refreshme', [7]]]);

        await waitFor(() => log.includes('hidden'), 'hidden');
        expect(log).toEqual([
            'show',
            ['setCallBack', 'refreshme', [7]],
            'shown',
            'hide',
            'hidden',
            'iframe attached at hidden: true',
        ]);
        expect(iframe.isConnected).toBe(false);
        expect(isOpen(modal)).toBe(false);
    });

    test('no Bootstrap instance yet: takes the direct hide path and leaves the iframe for hidden.bs.modal', async () => {
        const { modal, iframe, win } = openDialog('dlg_noinstance');
        expect(modal.data('bs.modal')).toBeUndefined();

        win.dlgclose();
        await settle();

        // Bootstrap creates an instance on .modal('hide'); hiding a never-shown modal is a no-op,
        // so no hidden.bs.modal fires and the deferred cleanup correctly does not run.
        expect(modal.data('bs.modal')).toBeDefined();
        expect(modal.data('bs.modal')._isShown).toBe(false);
        expect(log).toEqual([]);
        expect(iframe.isConnected).toBe(true);
    });
});

describe('add_edit_event.js find_available() opens a named popup that dlgclose can close', () => {
    let dlgopenCalls;

    beforeAll(() => {
        window.eval(instrumented(addEditPath));
    });

    function eventForm({ userId }) {
        const provider = userId
            ? '<input name="form_provider" value="9">'
            : '<select name="form_provider"><option value="3">A</option><option value="9" selected>B</option></select>';
        const facility = userId
            ? '<input name="facility" value="4">'
            : '<select name="facility"><option value="1">F1</option><option value="4" selected>F4</option></select>';
        document.body.innerHTML = `
            <form>${provider}${facility}
                <select name="form_category"><option value="5">Office</option><option value="10" selected>New Patient</option></select>
                <input name="form_date" value="2026-10-07">
                <input name="form_duration" value="30">
            </form>
            <button id="form_save" disabled>Save</button>`;
        // jsdom has no HTMLFormElement named getter; browsers resolve form.<name> to the control.
        const form = document.forms[0];
        Array.from(form.elements).forEach((el) => Object.defineProperty(form, el.name, { value: el, configurable: true }));
        dlgopenCalls = [];
        window.restoreSession = jest.fn();
        window.dlgopen = (...args) => dlgopenCalls.push(args);
        window.addEditEventConfig = {
            userId,
            eid: 42,
            webRoot: '/openemr',
            translations: { availableAppointments: 'Available Appointments' },
        };
    }

    const expectedUrl = '/openemr/interface/main/calendar/find_appt_popup.php'
        + '?providerid=9&catid=10&facility=4&startdate=2026-10-07&evdur=30&eid=42';

    test.each([
        ['provider/facility selects (userId 0)', 0],
        ['fixed provider/facility inputs (userId set)', 7],
    ])('%s: dlgopen gets the unchanged URL, size and title with winname find_appt_popup', (_label, userId) => {
        eventForm({ userId });
        window.find_available('&extra=1');

        expect(window.restoreSession).toHaveBeenCalledTimes(1);
        expect(document.getElementById('form_save').disabled).toBe(false);
        expect(dlgopenCalls).toEqual([
            [`${expectedUrl}&extra=1`, 'find_appt_popup', 725, 200, '', 'Available Appointments'],
        ]);
    });

    test('dlgclose() inside the popup named by find_available() finds and closes that modal', async () => {
        eventForm({ userId: 0 });
        window.find_available('');
        const winname = dlgopenCalls[0][1];

        const { modal, iframe, win } = openDialog(winname);
        modal.modal('show');
        await waitFor(() => log.includes('shown'), 'shown');

        win.dlgclose();
        await waitFor(() => log.includes('hidden'), 'hidden');
        expect(isOpen(modal)).toBe(false);
        expect(iframe.isConnected).toBe(false);
    });
});

test('both sources ran through the instrumented loader under their real paths', () => {
    [openerPath, addEditPath].forEach((file) => {
        const record = window.__coverage__[file];
        expect(record).toBeDefined();
        expect(Object.values(record.s).some((hits) => hits > 0)).toBe(true);
    });
});
