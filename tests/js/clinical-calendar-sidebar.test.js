/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const { createSidebarToggle, NARROW_QUERY } = require('../../interface/clinical-workspace/calendar-sidebar.js');

const repo = path.join(__dirname, '../..');
const fixtureDir = path.join(repo, 'tests/Tests/Isolated/Common/Twig/fixtures/render');
const cssPath = path.join(repo, 'interface/clinical-workspace/calendar.css');
const themePath = path.join(repo, 'interface/themes/ajax_calendar_sass.scss');
const SCOPE = 'body.oe-clinical-workspace.oe-clinical-calendar';
const VIEWS = ['day', 'week', 'month'];

function fixture(view) {
    return fs.readFileSync(path.join(fixtureDir, `calendar-${view}-screen-empty.html`), 'utf8');
}

function loadFixture(view) {
    const doc = new DOMParser().parseFromString(fixture(view), 'text/html');
    document.body.innerHTML = doc.body.innerHTML;
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
    const mql = {
        matches,
        addEventListener: (type, cb) => listeners.push(cb),
        removeEventListener: (type, cb) => listeners.splice(listeners.indexOf(cb), 1),
        set(value) {
            this.matches = value;
            listeners.slice().forEach((cb) => cb({ matches: value }));
        },
        listeners
    };
    return mql;
}

// Engines before Safari 14 expose MediaQueryList only through the deprecated addListener/removeListener.
function legacyMedia(matches) {
    const mql = fakeMedia(matches);
    const { listeners } = mql;
    delete mql.addEventListener;
    delete mql.removeEventListener;
    mql.addListener = (cb) => listeners.push(cb);
    mql.removeListener = (cb) => listeners.splice(listeners.indexOf(cb), 1);
    return mql;
}

function mount(media, extra = {}) {
    const resizeCallbacks = [];
    const controller = createSidebarToggle({
        document,
        media,
        observeClass: (target, cb) => {
            const observer = new MutationObserver(cb);
            observer.observe(target, { attributes: true, attributeFilter: ['class'] });
            return observer;
        },
        observeResize: (target, cb) => {
            resizeCallbacks.push(cb);
            return { disconnect() { resizeCallbacks.length = 0; } };
        },
        ...extra
    });
    return { controller, resize: () => resizeCallbacks.forEach((cb) => cb()) };
}

const flush = () => Promise.resolve();

describe('rendered calendar screens name and wire the sidebar toggle', () => {
    test.each(VIEWS)('%s screen toggle is a named button controlling the sidebar', (view) => {
        loadFixture(view);
        const toggle = document.getElementById('menu-toggle');
        expect(toggle.getAttribute('role')).toBe('button');
        expect(toggle.getAttribute('aria-label')).toBe('Toggle Calendar Sidebar');
        expect(toggle.getAttribute('title')).toBe('Toggle Calendar Sidebar');
        expect(toggle.getAttribute('aria-controls')).toBe('bottomLeft');
        expect(document.getElementById(toggle.getAttribute('aria-controls')).classList).toContain('sidebar-wrapper');
        // Original route and target are unchanged.
        expect(toggle.getAttribute('href')).toBe('#');
        expect(toggle.closest('#wrapper')).not.toBeNull();
    });

    test.each(VIEWS)('%s screen keeps the original toggle handler and loads the sidebar helper after it', (view) => {
        const html = fixture(view);
        const original = html.indexOf('$("#wrapper").toggleClass("toggled");');
        const helper = html.indexOf('<script src="/interface/clinical-workspace/calendar-sidebar.js?v=');
        expect(original).toBeGreaterThan(-1);
        expect(helper).toBeGreaterThan(original);
    });

    test.each(VIEWS)('%s print view does not load the screen sidebar helper', (view) => {
        const html = fs.readFileSync(path.join(fixtureDir, `calendar-${view}-print-empty.html`), 'utf8');
        expect(html).not.toContain('calendar-sidebar.js');
    });
});

describe('sidebar toggle state follows the actual #wrapper toggled class', () => {
    test('narrow query mirrors the theme breakpoint where the sidebar starts hidden', () => {
        const theme = fs.readFileSync(themePath, 'utf8');
        expect(theme).toContain('@media (max-width: map-get($grid-breakpoints, "md"))');
        expect(NARROW_QUERY).toBe('(max-width: 768px)');
    });

    test('desktop: sidebar shown until toggled; click flips aria-expanded with the class', async () => {
        loadFixture('day');
        attachOriginalToggle();
        const { controller } = mount(fakeMedia(false));
        const toggle = document.getElementById('menu-toggle');
        const wrapper = document.getElementById('wrapper');
        expect(toggle.getAttribute('aria-expanded')).toBe('true');

        toggle.click();
        await flush();
        expect(wrapper.classList).toContain('toggled');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');

        toggle.click();
        await flush();
        expect(wrapper.classList).not.toContain('toggled');
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        controller.dispose();
    });

    test('narrow: sidebar hidden until toggled, and a viewport change re-derives the state', async () => {
        loadFixture('week');
        attachOriginalToggle();
        const media = fakeMedia(true);
        const { controller } = mount(media);
        const toggle = document.getElementById('menu-toggle');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');

        toggle.click();
        await flush();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');

        media.set(false);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        controller.dispose();
        expect(media.listeners).toEqual([]);
    });

    test('addListener-only MediaQueryList still re-derives state and is released on dispose', async () => {
        loadFixture('week');
        attachOriginalToggle();
        const media = legacyMedia(true);
        const { controller } = mount(media);
        const toggle = document.getElementById('menu-toggle');
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(media.listeners).toHaveLength(1);

        toggle.click();
        await flush();
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        media.set(false);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');

        controller.dispose();
        expect(media.listeners).toEqual([]);
    });

    test('a MediaQueryList with no listener API is read once and never subscribed', () => {
        loadFixture('day');
        const media = { matches: true };
        const { controller } = mount(media);
        expect(document.getElementById('menu-toggle').getAttribute('aria-expanded')).toBe('false');
        expect(() => controller.dispose()).not.toThrow();
    });

    test('state set by any other code path is reflected too', async () => {
        loadFixture('month');
        const { controller } = mount(fakeMedia(false));
        document.getElementById('wrapper').classList.add('toggled');
        await flush();
        expect(document.getElementById('menu-toggle').getAttribute('aria-expanded')).toBe('false');
        controller.dispose();
    });

    test('Space activates the toggle through its original click handler; Enter stays native', async () => {
        loadFixture('day');
        attachOriginalToggle();
        const { controller } = mount(fakeMedia(true));
        const toggle = document.getElementById('menu-toggle');
        const wrapper = document.getElementById('wrapper');

        const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        toggle.dispatchEvent(space);
        await flush();
        expect(space.defaultPrevented).toBe(true);
        expect(wrapper.classList).toContain('toggled');
        expect(toggle.getAttribute('aria-expanded')).toBe('true');

        const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        toggle.dispatchEvent(enter);
        expect(enter.defaultPrevented).toBe(false);
        expect(wrapper.classList).toContain('toggled');
        controller.dispose();
    });

    test('missing toggle or wrapper is a no-op', () => {
        document.body.innerHTML = '<div id="wrapper"></div>';
        const { controller } = mount(fakeMedia(false));
        expect(() => controller.dispose()).not.toThrow();
    });
});

describe('browser bootstrap on the real window', () => {
    const modulePath = '../../interface/clinical-workspace/calendar-sidebar.js';
    const offset = () => document.getElementById('wrapper').style.getPropertyValue('--oe-calendar-toolbar-height');
    let height;

    function boot() {
        jest.isolateModules(() => require(modulePath));
    }

    beforeEach(() => {
        loadFixture('day');
        height = 120;
        document.getElementById('menu-toggle').closest('.sticky-top').getBoundingClientRect = () => ({ height });
    });

    afterEach(() => {
        window.dispatchEvent(new Event('unload'));
        delete window.matchMedia;
        delete window.ResizeObserver;
        delete document.readyState;
    });

    test('uses window.matchMedia with the theme breakpoint and falls back to resize events', () => {
        const media = fakeMedia(true);
        window.matchMedia = jest.fn(() => media);
        boot();
        expect(window.matchMedia).toHaveBeenCalledWith(NARROW_QUERY);
        expect(document.getElementById('menu-toggle').getAttribute('aria-expanded')).toBe('false');
        expect(offset()).toBe('120px');

        height = 150;
        window.dispatchEvent(new Event('resize'));
        expect(offset()).toBe('150px');

        window.dispatchEvent(new Event('unload'));
        expect(offset()).toBe('');
        expect(media.listeners).toEqual([]);
        height = 99;
        window.dispatchEvent(new Event('resize'));
        expect(offset()).toBe('');
    });

    test('boots on an addListener-only window.matchMedia and releases it on unload', () => {
        const media = legacyMedia(true);
        window.matchMedia = jest.fn(() => media);
        expect(() => boot()).not.toThrow();
        expect(document.getElementById('menu-toggle').getAttribute('aria-expanded')).toBe('false');
        expect(offset()).toBe('120px');
        expect(media.listeners).toHaveLength(1);

        window.dispatchEvent(new Event('unload'));
        expect(media.listeners).toEqual([]);
        expect(offset()).toBe('');
    });

    test('prefers ResizeObserver on the toolbar and treats a missing matchMedia as desktop', () => {
        const observed = [];
        let disconnected = 0;
        window.ResizeObserver = class {
            constructor(cb) { this.cb = cb; }
            observe(target) { observed.push([target, this.cb]); }
            disconnect() { disconnected++; }
        };
        boot();
        expect(document.getElementById('menu-toggle').getAttribute('aria-expanded')).toBe('true');
        expect(observed.map(([t]) => t)).toEqual([document.getElementById('menu-toggle').closest('.sticky-top')]);

        height = 140;
        observed[0][1]();
        expect(offset()).toBe('140px');

        window.dispatchEvent(new Event('unload'));
        expect(disconnected).toBe(1);
    });

    test('waits for DOMContentLoaded while the document is still loading', () => {
        Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
        boot();
        expect(document.getElementById('menu-toggle').hasAttribute('aria-expanded')).toBe(false);
        document.dispatchEvent(new Event('DOMContentLoaded'));
        expect(document.getElementById('menu-toggle').getAttribute('aria-expanded')).toBe('true');
    });
});

describe('narrow sidebar is placed below the real toolbar height', () => {
    test('publishes the measured toolbar height and re-measures when it wraps', () => {
        loadFixture('day');
        const toolbar = document.querySelector('#wrapper > form > .container-fluid.sticky-top');
        let height = 132;
        toolbar.getBoundingClientRect = () => ({ height });
        const { controller, resize } = mount(fakeMedia(true));
        const wrapper = document.getElementById('wrapper');
        expect(wrapper.style.getPropertyValue('--oe-calendar-toolbar-height')).toBe('132px');

        height = 176.4;
        resize();
        expect(wrapper.style.getPropertyValue('--oe-calendar-toolbar-height')).toBe('177px');

        controller.dispose();
        expect(wrapper.style.getPropertyValue('--oe-calendar-toolbar-height')).toBe('');
    });

    // Every declaration calendar.css makes on the sidebar inside a media query, exactly. Other media
    // queries (e.g. toolbar layout) are not this feature's, but may not touch these selectors.
    const SIDEBAR_SELECTOR = /(#bottomLeft|#pc_username|\.sidebar-wrapper)\b/;
    const MEDIA_RULES = {
        '(max-width: 768px)': [
            [`${SCOPE} #bottomLeft`, 'height', 'calc(100% - var(--oe-calendar-toolbar-height, 4.78rem))'],
            [`${SCOPE} #bottomLeft`, 'overflow-y', 'auto'],
            [`${SCOPE} #bottomLeft`, 'top', 'var(--oe-calendar-toolbar-height, 4.78rem)'],
            // The multi-select keeps every option and native multiple selection; it scrolls itself
            // instead of growing past the space left under the toolbar.
            [`${SCOPE} #providerPicker #pc_username`, 'max-height', 'calc(100vh - var(--oe-calendar-toolbar-height, 4.78rem) - 1.5rem)']
        ],
        // Without the measured height, the fallback must still clear the theme's taller small-screen toolbar.
        '(max-width: 576px)': [
            [`${SCOPE} #bottomLeft`, 'height', 'calc(100% - var(--oe-calendar-toolbar-height, 6.9rem))'],
            [`${SCOPE} #bottomLeft`, 'top', 'var(--oe-calendar-toolbar-height, 6.9rem)'],
            [`${SCOPE} #providerPicker #pc_username`, 'max-height', 'calc(100vh - var(--oe-calendar-toolbar-height, 6.9rem) - 1.5rem)']
        ],
        // Desktop starts one pixel above the narrow query, so exactly 768px keeps the narrow behaviour.
        '(min-width: 769px)': [
            [`${SCOPE} #wrapper.toggled .sidebar-wrapper`, 'display', 'none']
        ]
    };

    function sidebarMediaRules(css) {
        const found = {};
        postcss.parse(css).walkAtRules('media', (at) => {
            at.walkRules((rule) => {
                if (!SIDEBAR_SELECTOR.test(rule.selector)) return;
                rule.walkDecls((d) => {
                    (found[at.params] ||= []).push([rule.selector, d.prop, d.value]);
                });
            });
        });
        return found;
    }

    const calendarCss = () => fs.readFileSync(cssPath, 'utf8');

    test('media-scoped sidebar rules are exactly the placement, provider list cap and desktop hide', () => {
        expect(sidebarMediaRules(calendarCss())).toEqual(MEDIA_RULES);
    });

    test('an independent toolbar media query does not disturb the sidebar rule set, but a stray sidebar rule does', () => {
        // The shape the clinical toolbar change adds alongside this feature.
        const toolbarQuery = `\n@media (max-width: 768px) {\n  ${SCOPE} #topToolbarRight {\n    flex-wrap: wrap;\n  }\n}\n`
            + `@media (max-width: 991.98px) {\n  ${SCOPE} #viewPicker {\n    margin-top: 0.25rem;\n  }\n}\n`;
        expect(sidebarMediaRules(calendarCss() + toolbarQuery)).toEqual(MEDIA_RULES);

        const straySidebar = `\n@media (max-width: 768px) {\n  ${SCOPE} #bottomLeft {\n    width: 80%;\n  }\n}\n`;
        expect(sidebarMediaRules(calendarCss() + straySidebar)).not.toEqual(MEDIA_RULES);
    });

    test('without the measured height the fallback offset equals the theme offset at every narrow breakpoint', () => {
        // Theme: @media (max-width: map-get($grid-breakpoints, "<bp>")) { ... #bottomLeft { ... top: X; } }
        const variables = fs.readFileSync(require.resolve('bootstrap/scss/_variables.scss'), 'utf8');
        const breakpoints = Object.fromEntries([...variables.match(/\$grid-breakpoints:\s*\(([^)]*)\)/)[1]
            .matchAll(/(\w+):\s*(\d+)px/g)].map(([, name, px]) => [name, Number(px)]));
        const theme = fs.readFileSync(themePath, 'utf8');
        const themeTops = [...theme.matchAll(/@media \(max-width: map-get\(\$grid-breakpoints, "(\w+)"\)\) \{(?:(?!@media)[\s\S])*?#bottomLeft \{[^}]*?top: ([\d.]+rem);/g)]
            .map(([, bp, top]) => [breakpoints[bp], top]);
        expect(themeTops).toEqual([[768, '4.78rem'], [576, '6.9rem']]);

        themeTops.forEach(([px, top]) => {
            const decls = MEDIA_RULES[`(max-width: ${px}px)`].filter(([sel]) => sel === `${SCOPE} #bottomLeft`);
            expect(decls).toContainEqual([`${SCOPE} #bottomLeft`, 'top', `var(--oe-calendar-toolbar-height, ${top})`]);
            expect(decls).toContainEqual([`${SCOPE} #bottomLeft`, 'height', `calc(100% - var(--oe-calendar-toolbar-height, ${top}))`]);
        });
        // The smaller breakpoint must come later so it wins the cascade inside both queries.
        const order = Object.keys(sidebarMediaRules(calendarCss()));
        expect(order.indexOf('(max-width: 576px)')).toBeGreaterThan(order.indexOf('(max-width: 768px)'));
    });

    test('desktop toggled sidebar is removed from view rather than shifted by a direction-dependent margin', () => {
        // The theme hides it with margin-left: -30rem, which leaves a fixed sidebar on screen when
        // direction is rtl; display:none hides it in either direction. Narrow screens are untouched.
        const theme = fs.readFileSync(themePath, 'utf8');
        expect(theme).toContain('@media (min-width: map-get($grid-breakpoints, "md"))');
        expect(MEDIA_RULES['(max-width: 768px)'].some(([sel]) => /toggled/.test(sel))).toBe(false);
    });

    test('legacy theme offsets stay as they were', () => {
        const theme = fs.readFileSync(themePath, 'utf8');
        expect(theme).toContain('top: 4.78rem;');
        expect(theme).toContain('top: 6.9rem;');
    });
});
