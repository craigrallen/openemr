/**
 * @jest-environment jsdom
 */

// Lifecycle of the collapsed sidebar's inert state across workbench/legacy mode changes,
// desktop/narrow viewport changes and controller disposal.

const fs = require('fs');
const path = require('path');
const { createSidebarToggle } = require('../../interface/clinical-workspace/calendar-sidebar.js');

const fixtureDir = path.join(__dirname, '../../tests/Tests/Isolated/Common/Twig/fixtures/render');
const WORKBENCH = 'oe-clinical-workspace';
const flush = () => Promise.resolve();

function loadFixture(view) {
    const html = fs.readFileSync(path.join(fixtureDir, `calendar-${view}-screen-empty.html`), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    document.body.innerHTML = doc.body.innerHTML;
    document.body.className = 'calsearch_body w-100 oe-clinical-calendar';
}

// Mirrors the original, unchanged handler in _calendar_screen_js.html.twig.
function attachOriginalToggle() {
    document.getElementById('menu-toggle').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('wrapper').classList.toggle('toggled');
    });
}

function fakeMedia(matches) {
    const listeners = [];
    return {
        matches,
        addEventListener: (type, cb) => listeners.push(cb),
        removeEventListener: (type, cb) => listeners.splice(listeners.indexOf(cb), 1),
        set(value) {
            this.matches = value;
            listeners.slice().forEach((cb) => cb({ matches: value }));
        },
        listeners
    };
}

function mount(media) {
    return createSidebarToggle({
        document,
        media,
        observeClass: (target, cb) => {
            const observer = new MutationObserver(cb);
            observer.observe(target, { attributes: true, attributeFilter: ['class'] });
            return observer;
        },
        observeResize: () => ({ disconnect() {} }),
        observeInert: watchInert
    });
}

// Real MutationObserver on the sidebar's inert attribute, as the browser bootstrap wires it.
// Counts live watchers so tests can check the watcher only exists while the helper holds inert.
let liveInertWatchers = 0;
function watchInert(target, cb) {
    const observer = new MutationObserver(cb);
    observer.observe(target, { attributes: true, attributeFilter: ['inert'] });
    liveInertWatchers += 1;
    let live = true;
    return {
        takeRecords: () => observer.takeRecords(),
        disconnect() {
            observer.disconnect();
            if (live) liveInertWatchers -= 1;
            live = false;
        }
    };
}

// mode.js toggles the workbench class on the calendar body when the host navigation mode changes.
async function setWorkbench(enabled) {
    document.body.classList.toggle(WORKBENCH, enabled);
    await flush();
}

const sidebar = () => document.getElementById('bottomLeft');
const toggle = () => document.getElementById('menu-toggle');

describe('collapsed calendar sidebar inert state', () => {
    test('desktop: workbench round trip makes the collapsed sidebar inert and restores legacy controls', async () => {
        loadFixture('day');
        attachOriginalToggle();
        document.body.classList.add(WORKBENCH);
        const controller = mount(fakeMedia(false));

        // Desktop default: sidebar shown, controls reachable.
        expect(sidebar().hasAttribute('inert')).toBe(false);

        toggle().click();
        await flush();
        expect(toggle().getAttribute('aria-expanded')).toBe('false');
        expect(sidebar().hasAttribute('inert')).toBe(true);

        // Leaving workbench: the legacy desktop controls must not stay inert.
        await setWorkbench(false);
        expect(sidebar().hasAttribute('inert')).toBe(false);
        expect(toggle().getAttribute('aria-expanded')).toBe('false');

        await setWorkbench(true);
        expect(sidebar().hasAttribute('inert')).toBe(true);

        toggle().click();
        await flush();
        expect(sidebar().hasAttribute('inert')).toBe(false);
        controller.dispose();
    });

    test('legacy navigation never makes the sidebar inert, whatever its toggled state', async () => {
        loadFixture('week');
        attachOriginalToggle();
        const media = fakeMedia(false);
        const controller = mount(media);
        expect(sidebar().hasAttribute('inert')).toBe(false);

        toggle().click();
        await flush();
        expect(sidebar().hasAttribute('inert')).toBe(false);
        media.set(true);
        expect(sidebar().hasAttribute('inert')).toBe(false);
        controller.dispose();
        expect(sidebar().hasAttribute('inert')).toBe(false);
    });

    test('narrow/desktop round trip in workbench follows the visible state', async () => {
        loadFixture('week');
        attachOriginalToggle();
        document.body.classList.add(WORKBENCH);
        const media = fakeMedia(true);
        const controller = mount(media);

        // Narrow default: hidden until toggled.
        expect(sidebar().hasAttribute('inert')).toBe(true);
        toggle().click();
        await flush();
        expect(sidebar().hasAttribute('inert')).toBe(false);

        // Same toggled class means hidden on desktop.
        media.set(false);
        expect(toggle().getAttribute('aria-expanded')).toBe('false');
        expect(sidebar().hasAttribute('inert')).toBe(true);

        media.set(true);
        expect(sidebar().hasAttribute('inert')).toBe(false);

        // Narrow and collapsed, then leave workbench on a narrow screen.
        toggle().click();
        await flush();
        expect(sidebar().hasAttribute('inert')).toBe(true);
        await setWorkbench(false);
        expect(sidebar().hasAttribute('inert')).toBe(false);

        // Back to desktop in legacy: still nothing inert.
        media.set(false);
        expect(sidebar().hasAttribute('inert')).toBe(false);
        controller.dispose();
    });

    test.each([
        ['empty', ''],
        ['named', 'inert']
    ])('a pre-existing %s inert value is kept through every mode and on dispose', async (label, value) => {
        loadFixture('month');
        attachOriginalToggle();
        sidebar().setAttribute('inert', value);
        document.body.classList.add(WORKBENCH);
        const media = fakeMedia(false);
        const controller = mount(media);

        // Expanded in workbench: an intentionally hidden sidebar is not exposed.
        expect(sidebar().getAttribute('inert')).toBe(value);

        toggle().click();
        await flush();
        expect(sidebar().getAttribute('inert')).not.toBeNull();

        await setWorkbench(false);
        expect(sidebar().getAttribute('inert')).toBe(value);

        await setWorkbench(true);
        media.set(true);
        toggle().click();
        await flush();
        expect(sidebar().getAttribute('inert')).not.toBeNull();

        controller.dispose();
        expect(sidebar().getAttribute('inert')).toBe(value);
    });

    test('dispose restores the original inert and aria-expanded state and stops tracking', async () => {
        loadFixture('day');
        attachOriginalToggle();
        document.body.classList.add(WORKBENCH);
        const media = fakeMedia(false);
        expect(toggle().hasAttribute('aria-expanded')).toBe(false);
        const controller = mount(media);

        toggle().click();
        await flush();
        expect(sidebar().hasAttribute('inert')).toBe(true);

        controller.dispose();
        expect(sidebar().hasAttribute('inert')).toBe(false);
        expect(toggle().hasAttribute('aria-expanded')).toBe(false);
        expect(media.listeners).toEqual([]);

        // Later mode, viewport and class changes are no longer acted on.
        await setWorkbench(false);
        await setWorkbench(true);
        media.set(true);
        toggle().click();
        await flush();
        toggle().click();
        await flush();
        expect(sidebar().hasAttribute('inert')).toBe(false);
        expect(toggle().hasAttribute('aria-expanded')).toBe(false);
    });

    test('dispose restores a pre-existing aria-expanded value on the toggle', () => {
        loadFixture('day');
        toggle().setAttribute('aria-expanded', 'true');
        document.body.classList.add(WORKBENCH);
        document.getElementById('wrapper').classList.add('toggled');
        const controller = mount(fakeMedia(false));
        expect(toggle().getAttribute('aria-expanded')).toBe('false');

        controller.dispose();
        expect(toggle().getAttribute('aria-expanded')).toBe('true');
        expect(sidebar().hasAttribute('inert')).toBe(false);
    });

    test('unload on the real window disposes and releases the inert state', () => {
        loadFixture('day');
        document.body.classList.add(WORKBENCH);
        document.getElementById('wrapper').classList.add('toggled');
        window.matchMedia = jest.fn(() => fakeMedia(false));
        try {
            jest.isolateModules(() => require('../../interface/clinical-workspace/calendar-sidebar.js'));
            expect(sidebar().hasAttribute('inert')).toBe(true);

            window.dispatchEvent(new Event('unload'));
            expect(sidebar().hasAttribute('inert')).toBe(false);
            expect(toggle().hasAttribute('aria-expanded')).toBe(false);
        } finally {
            delete window.matchMedia;
        }
    });
});

describe('focus when the sidebar collapses to inert', () => {
    const sidebarControl = () => sidebar().querySelector('a[href], button, input, select');

    // Records where focus is at the instant inert is set, because a browser drops focus from a
    // newly inert subtree to <body> (jsdom does not emulate that). The setAttribute seam runs
    // synchronously with the write; an observer callback would only show focus at delivery time.
    function watchFocusAtInert() {
        const seen = [];
        const element = sidebar();
        const original = element.setAttribute;
        element.setAttribute = function (name, value) {
            if (String(name).toLowerCase() === 'inert') seen.push(document.activeElement);
            return original.call(this, name, value);
        };
        return { seen, stop: () => { delete element.setAttribute; } };
    }

    test('focus inside the sidebar moves to the visible toggle before inert is applied', async () => {
        loadFixture('week');
        attachOriginalToggle();
        document.body.classList.add(WORKBENCH);
        const media = fakeMedia(false);
        const controller = mount(media);
        const control = sidebarControl();
        expect(control).not.toBeNull();
        control.focus();
        expect(document.activeElement).toBe(control);

        const watcher = watchFocusAtInert();
        // Collapse without the toggle having focus: desktop -> narrow with no `toggled` class.
        media.set(true);
        await flush();
        watcher.stop();

        expect(sidebar().hasAttribute('inert')).toBe(true);
        expect(document.activeElement).toBe(toggle());
        expect(watcher.seen).toEqual([toggle()]);
        controller.dispose();
    });

    test('collapsing via the wrapper class or entering workbench also rescues sidebar focus', async () => {
        loadFixture('day');
        attachOriginalToggle();
        const controller = mount(fakeMedia(false));

        // Legacy and collapsed: nothing inert, focus is left alone.
        document.getElementById('wrapper').classList.add('toggled');
        await flush();
        sidebarControl().focus();
        expect(document.activeElement).toBe(sidebarControl());

        await setWorkbench(true);
        expect(sidebar().hasAttribute('inert')).toBe(true);
        expect(document.activeElement).toBe(toggle());

        toggle().click();
        await flush();
        sidebarControl().focus();
        document.getElementById('wrapper').classList.add('toggled');
        await flush();
        expect(sidebar().hasAttribute('inert')).toBe(true);
        expect(document.activeElement).toBe(toggle());
        controller.dispose();
    });

    test('focus outside the sidebar is not moved when the sidebar collapses', async () => {
        loadFixture('week');
        attachOriginalToggle();
        document.body.classList.add(WORKBENCH);
        const outside = document.createElement('button');
        outside.textContent = 'unrelated';
        document.body.appendChild(outside);
        const media = fakeMedia(false);
        const controller = mount(media);

        outside.focus();
        media.set(true);
        await flush();
        expect(sidebar().hasAttribute('inert')).toBe(true);
        expect(document.activeElement).toBe(outside);
        controller.dispose();
    });

    test('a pre-existing inert value is untouched and focus is not moved by the helper', async () => {
        loadFixture('day');
        attachOriginalToggle();
        sidebar().setAttribute('inert', 'inert');
        document.body.classList.add(WORKBENCH);
        const media = fakeMedia(false);
        const controller = mount(media);
        // jsdom lets focus enter an inert subtree; a browser would not.
        sidebarControl().focus();
        const focused = document.activeElement;

        media.set(true);
        await flush();
        expect(sidebar().getAttribute('inert')).toBe('inert');
        expect(document.activeElement).toBe(focused);

        controller.dispose();
        expect(sidebar().getAttribute('inert')).toBe('inert');
    });

    test('a hidden toggle is not used as the focus target', async () => {
        loadFixture('week');
        attachOriginalToggle();
        document.body.classList.add(WORKBENCH);
        const media = fakeMedia(false);
        const controller = mount(media);
        toggle().setAttribute('hidden', '');
        const control = sidebarControl();
        control.focus();

        media.set(true);
        await flush();
        expect(sidebar().hasAttribute('inert')).toBe(true);
        expect(document.activeElement).not.toBe(toggle());
        controller.dispose();
    });

    test.each([
        ['expansion then dispose', true],
        ['dispose', false]
    ])('inert written by a focus handler during the focus rescue is kept through %s', async (label, expand) => {
        loadFixture('week');
        attachOriginalToggle();
        document.body.classList.add(WORKBENCH);
        const media = fakeMedia(false);
        const controller = mount(media);
        // Another component reacts to the toggle gaining focus by making the sidebar inert itself.
        toggle().addEventListener('focus', () => sidebar().setAttribute('inert', 'owner'), { once: true });
        sidebarControl().focus();

        // Collapse: desktop -> narrow with no `toggled` class, so the helper rescues focus.
        media.set(true);
        expect(document.activeElement).toBe(toggle());
        expect(sidebar().getAttribute('inert')).toBe('owner');
        await flush();
        expect(sidebar().getAttribute('inert')).toBe('owner');

        if (expand) {
            media.set(false);
            expect(toggle().getAttribute('aria-expanded')).toBe('true');
            expect(sidebar().getAttribute('inert')).toBe('owner');
            await flush();
            expect(sidebar().getAttribute('inert')).toBe('owner');
        }
        controller.dispose();
        expect(sidebar().getAttribute('inert')).toBe('owner');
    });

    describe('focus the browser already dropped to <body> before the viewport callback', () => {
        // In Chrome the narrow CSS hides the sidebar during the resize's style update, which
        // blurs the focused control to <body> (blur/focusout with no relatedTarget) before the
        // MediaQueryList change callback runs. The frame itself keeps focus, so hasFocus() stays
        // true. jsdom reports hasFocus() false whenever no element is focused, so the frame's
        // focus is stated explicitly here.
        let frameFocused;
        beforeEach(() => {
            frameFocused = true;
            document.hasFocus = () => frameFocused;
        });
        afterEach(() => {
            delete document.hasFocus;
        });

        function desktopWorkbench(view = 'week') {
            loadFixture(view);
            attachOriginalToggle();
            document.body.classList.add(WORKBENCH);
            const outside = document.createElement('button');
            outside.textContent = 'unrelated';
            const blank = document.createElement('div');
            document.body.append(outside, blank);
            const media = fakeMedia(false);
            const controller = mount(media);
            return { media, controller, outside, blank };
        }

        // Native-like: the focused control loses focus to <body> with no user action.
        const nativeBlur = (element) => element.blur();

        test('a viewport collapse returns focus blurred from the sidebar to the toggle', async () => {
            const { media, controller } = desktopWorkbench();
            const control = sidebarControl();
            control.focus();
            nativeBlur(control);
            expect(document.activeElement).toBe(document.body);

            const watcher = watchFocusAtInert();
            media.set(true);
            watcher.stop();
            expect(sidebar().getAttribute('inert')).toBe('');
            expect(toggle().getAttribute('aria-expanded')).toBe('false');
            expect(document.activeElement).toBe(toggle());
            expect(watcher.seen).toEqual([toggle()]);
            await flush();
            expect(document.activeElement).toBe(toggle());
            controller.dispose();
        });

        test('repeated week/month resizes recover focus on every collapse', async () => {
            for (const view of ['week', 'month']) {
                const { media, controller } = desktopWorkbench(view);
                for (let i = 0; i < 3; i += 1) {
                    sidebarControl().focus();
                    nativeBlur(sidebarControl());
                    media.set(true);
                    expect(document.activeElement).toBe(toggle());
                    media.set(false);
                    await flush();
                    expect(sidebar().hasAttribute('inert')).toBe(false);
                }
                controller.dispose();
            }
        });

        test('an explicit pointer press outside the sidebar is not undone', async () => {
            const { media, controller, blank } = desktopWorkbench();
            sidebarControl().focus();
            // Clicking a non-focusable area: pointerdown, then the browser blurs to <body>.
            blank.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
            blank.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            nativeBlur(sidebarControl());
            media.set(true);
            expect(document.activeElement).toBe(document.body);
            controller.dispose();
        });

        test('a pointer press inside the sidebar that drops focus is not undone', async () => {
            const { media, controller } = desktopWorkbench();
            sidebarControl().focus();
            sidebar().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
            nativeBlur(sidebarControl());
            media.set(true);
            expect(document.activeElement).toBe(document.body);
            controller.dispose();
        });

        test('focus moved from the sidebar to another control is not taken back', async () => {
            const { media, controller, outside } = desktopWorkbench();
            sidebarControl().focus();
            outside.focus();
            media.set(true);
            expect(document.activeElement).toBe(outside);
            media.set(false);

            // Even if that other control is later blurred to <body>.
            sidebarControl().focus();
            outside.focus();
            nativeBlur(outside);
            media.set(true);
            expect(document.activeElement).toBe(document.body);
            controller.dispose();
        });

        test('a keyboard action that blurs the sidebar control is not undone', async () => {
            const { media, controller } = desktopWorkbench();
            const control = sidebarControl();
            control.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') control.blur();
            });
            control.focus();
            control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            expect(document.activeElement).toBe(document.body);
            media.set(true);
            expect(document.activeElement).toBe(document.body);
            controller.dispose();
        });

        test('focus in another frame or the browser chrome is not stolen', async () => {
            const { media, controller } = desktopWorkbench();
            // The frame is no longer the focused one when the collapse runs.
            sidebarControl().focus();
            nativeBlur(sidebarControl());
            frameFocused = false;
            media.set(true);
            expect(document.activeElement).toBe(document.body);
            media.set(false);

            // The window lost focus in between, then regained it without a focus move here.
            frameFocused = true;
            sidebarControl().focus();
            window.dispatchEvent(new FocusEvent('blur'));
            nativeBlur(sidebarControl());
            media.set(true);
            expect(document.activeElement).toBe(document.body);
            controller.dispose();
        });

        test('a collapse not caused by the viewport does not recover blurred focus', async () => {
            const { controller } = desktopWorkbench();
            sidebarControl().focus();
            nativeBlur(sidebarControl());
            document.getElementById('wrapper').classList.add('toggled');
            await flush();
            expect(sidebar().hasAttribute('inert')).toBe(true);
            expect(document.activeElement).toBe(document.body);
            controller.dispose();
        });

        test('leaving workbench clears the remembered sidebar focus', async () => {
            const { media, controller } = desktopWorkbench();
            sidebarControl().focus();
            nativeBlur(sidebarControl());
            await setWorkbench(false);
            await setWorkbench(true);
            media.set(true);
            expect(sidebar().hasAttribute('inert')).toBe(true);
            expect(document.activeElement).toBe(document.body);
            controller.dispose();
        });

        test('a removed sidebar control is not recovered', async () => {
            const { media, controller } = desktopWorkbench();
            const control = sidebarControl();
            control.focus();
            nativeBlur(control);
            control.remove();
            media.set(true);
            expect(document.activeElement).toBe(document.body);
            controller.dispose();
        });

        test('dispose removes every focus listener it added', () => {
            loadFixture('week');
            document.body.classList.add(WORKBENCH);
            const added = [];
            const removed = [];
            const spy = (target, name) => {
                const add = jest.spyOn(target, 'addEventListener');
                const remove = jest.spyOn(target, 'removeEventListener');
                return { add, remove, target: name };
            };
            const spies = [spy(document, 'document'), spy(window, 'window')];
            try {
                const controller = mount(fakeMedia(false));
                spies.forEach(({ add, target }) => add.mock.calls.forEach((c) => added.push([target, ...c])));
                controller.dispose();
                spies.forEach(({ remove, target }) => remove.mock.calls.forEach((c) => removed.push([target, ...c])));
            } finally {
                spies.forEach(({ add, remove }) => { add.mockRestore(); remove.mockRestore(); });
            }
            expect(added.length).toBeGreaterThan(0);
            expect(removed).toEqual(added);
        });

        test('after dispose a blurred sidebar control is not recovered', async () => {
            const { media, controller } = desktopWorkbench();
            sidebarControl().focus();
            nativeBlur(sidebarControl());
            controller.dispose();
            media.set(true);
            expect(document.activeElement).toBe(document.body);
        });
    });

    describe('an external owner writing inert while the helper holds it', () => {
        // Desktop, workbench, collapsed: the helper has applied inert.
        async function collapsed(view = 'day') {
            loadFixture(view);
            attachOriginalToggle();
            document.body.classList.add(WORKBENCH);
            const media = fakeMedia(false);
            const controller = mount(media);
            toggle().click();
            await flush();
            expect(sidebar().getAttribute('inert')).toBe('');
            return { media, controller };
        }

        test('a same-value write delivered before expansion is kept', async () => {
            const { controller } = await collapsed();
            sidebar().setAttribute('inert', '');
            await flush();
            toggle().click();
            await flush();
            expect(sidebar().getAttribute('inert')).toBe('');
            controller.dispose();
            expect(sidebar().getAttribute('inert')).toBe('');
        });

        test('a named write is kept when expansion happens before observer delivery', async () => {
            const { media, controller } = await collapsed('week');
            sidebar().setAttribute('inert', 'owner');
            // Narrow + toggled = expanded, synchronously through the media listener.
            media.set(true);
            expect(toggle().getAttribute('aria-expanded')).toBe('true');
            expect(sidebar().getAttribute('inert')).toBe('owner');
            controller.dispose();
            expect(sidebar().getAttribute('inert')).toBe('owner');
        });

        test('a same-value write is kept when disposal happens before observer delivery', async () => {
            const { controller } = await collapsed('month');
            sidebar().setAttribute('inert', '');
            controller.dispose();
            expect(sidebar().getAttribute('inert')).toBe('');
        });

        test('an external removal is not undone and the helper does not re-apply in that collapse', async () => {
            const { media, controller } = await collapsed();
            sidebar().removeAttribute('inert');
            await flush();
            media.set(false);
            expect(sidebar().hasAttribute('inert')).toBe(false);
            controller.dispose();
            expect(sidebar().hasAttribute('inert')).toBe(false);
        });

        test("the helper's own pending writes are not mistaken for an external owner", async () => {
            loadFixture('day');
            attachOriginalToggle();
            document.body.classList.add(WORKBENCH);
            const media = fakeMedia(true);
            // Narrow, untoggled: collapsed at mount, so inert is written synchronously.
            const controller = mount(media);
            expect(sidebar().getAttribute('inert')).toBe('');
            // Expand and collapse repeatedly with no observer delivery in between.
            media.set(false);
            expect(sidebar().hasAttribute('inert')).toBe(false);
            media.set(true);
            expect(sidebar().getAttribute('inert')).toBe('');
            await flush();
            media.set(false);
            expect(sidebar().hasAttribute('inert')).toBe(false);
            media.set(true);
            controller.dispose();
            expect(sidebar().hasAttribute('inert')).toBe(false);
        });

        test('the inert watcher only exists while the helper holds inert', async () => {
            liveInertWatchers = 0;
            const { controller } = await collapsed();
            expect(liveInertWatchers).toBe(1);
            toggle().click();
            await flush();
            expect(liveInertWatchers).toBe(0);
            toggle().click();
            await flush();
            expect(liveInertWatchers).toBe(1);
            controller.dispose();
            expect(liveInertWatchers).toBe(0);
        });

        test('without an inert watcher the helper does not apply inert', async () => {
            loadFixture('day');
            attachOriginalToggle();
            document.body.classList.add(WORKBENCH);
            const controller = createSidebarToggle({
                document,
                media: fakeMedia(true),
                observeClass: (target, cb) => {
                    const observer = new MutationObserver(cb);
                    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
                    return observer;
                },
                observeResize: () => ({ disconnect() {} })
            });
            expect(toggle().getAttribute('aria-expanded')).toBe('false');
            expect(sidebar().hasAttribute('inert')).toBe(false);
            controller.dispose();
        });
    });
});

