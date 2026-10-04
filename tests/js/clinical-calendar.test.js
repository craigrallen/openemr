/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const process = require('node:process');
const postcss = require('postcss');
const { createModeController } = require('../../interface/clinical-workspace/mode.js');

const repo = path.join(__dirname, '../..');
const headerPath = path.join(repo, 'templates/calendar/default/views/header.html.twig');
const cssPath = path.join(repo, 'interface/clinical-workspace/calendar.css');
const fixtureDir = path.join(repo, 'tests/Tests/Isolated/Common/Twig/fixtures/render');
const SCOPE = 'body.oe-clinical-workspace.oe-clinical-calendar';

function calendarRules() {
    const rules = [];
    postcss.parse(fs.readFileSync(cssPath, 'utf8')).walkRules((rule) => {
        rule.selectors.forEach((selector) => {
            const media = rule.parent && rule.parent.type === 'atrule' ? rule.parent.params : null;
            rule.walkDecls((decl) => rules.push({ selector, media, prop: decl.prop, value: decl.value, important: decl.important }));
        });
    });
    return rules;
}

function loadFixture(name) {
    const html = fs.readFileSync(path.join(fixtureDir, name), 'utf8');
    document.documentElement.innerHTML = new DOMParser()
        .parseFromString(html, 'text/html').documentElement.innerHTML;
    const body = new DOMParser().parseFromString(html, 'text/html').body;
    document.body.className = body.className;
}

describe('calendar document loads the workbench presentation', () => {
    const header = () => fs.readFileSync(headerPath, 'utf8');

    test('shared calendar header loads calendar.css and the shared mode loader from the same origin', () => {
        expect(header()).toMatch(/<link rel="stylesheet" href="\{\{ webroot \}\}\/interface\/clinical-workspace\/calendar\.css\?v=\{\{ assetVersion\|attr_url \}\}">/);
        expect(header()).toMatch(/<script src="\{\{ webroot \}\}\/interface\/clinical-workspace\/mode\.js\?v=\{\{ assetVersion\|attr_url \}\}" defer><\/script>/);
    });

    test('calendar body carries a route class while keeping the original language-direction class', () => {
        expect(header()).toMatch(/<body class="\{\{ body_class\|default\(''\) \}\} calsearch_body w-100 oe-clinical-calendar">/);
    });

    test.each(['day', 'week', 'month'])('rendered %s screen fixture includes the loader and route class', (view) => {
        const html = fs.readFileSync(path.join(fixtureDir, `calendar-${view}-screen-empty.html`), 'utf8');
        expect(html).toContain('/interface/clinical-workspace/calendar.css?v=');
        expect(html).toContain('/interface/clinical-workspace/mode.js?v=');
        expect(html).toMatch(/<body class="[^"]*\boe-clinical-calendar\b/);
    });

    test.each(['day', 'week', 'month'])('%s print view stays on the legacy presentation', (view) => {
        const html = fs.readFileSync(path.join(fixtureDir, `calendar-${view}-print-empty.html`), 'utf8');
        expect(html).not.toContain('clinical-workspace');
    });
});

describe('calendar mode switch on the real calendar markup', () => {
    let hostBody;
    let observer;

    function mount() {
        return createModeController({
            body: document.body,
            parentWindow: { location: { origin: window.location.origin }, document: { body: hostBody } },
            origin: window.location.origin,
            observe: (target, callback) => {
                observer = new MutationObserver(callback);
                observer.observe(target, { attributes: true, attributeFilter: ['class'] });
                return observer;
            }
        });
    }

    beforeEach(() => {
        hostBody = document.createElement('body');
        observer = null;
    });

    afterEach(() => {
        if (observer) observer.disconnect();
    });

    test('day screen gains workbench mode only under an active workbench and leaves controls in place', async () => {
        loadFixture('calendar-day-screen-empty.html');
        const controlIds = ['menu-toggle', 'prevday', 'nextday', 'printview', 'dayview', 'weekview', 'monthview', 'pc_username', 'jumpdate', 'viewtype'];
        const before = controlIds.map((id) => document.getElementById(id));
        hostBody.className = 'workbench-active';

        const controller = mount();
        expect(document.body.classList).toContain('oe-clinical-workspace');
        expect(document.body.classList).toContain('oe-clinical-calendar');
        expect(controlIds.map((id) => document.getElementById(id))).toEqual(before);

        hostBody.classList.remove('workbench-active');
        await Promise.resolve();
        expect(document.body.classList).not.toContain('oe-clinical-workspace');
        expect(document.body.classList).toContain('oe-clinical-calendar');
        controller.dispose();
    });

    test('direct calendar page without a workbench host keeps the legacy theme', () => {
        loadFixture('calendar-week-screen-empty.html');
        const controller = createModeController({
            body: document.body,
            parentWindow: null,
            origin: window.location.origin,
            observe: () => ({ disconnect() {} })
        });
        expect(document.body.classList).not.toContain('oe-clinical-workspace');
        controller.dispose();
    });
});

// The only geometry/visibility declarations allowed past the guards below, matched exactly
// (media, selector, property, value); the full media rule set is pinned in clinical-calendar-sidebar.test.js.
const MEDIA_EXCEPTIONS = [
    ['(max-width: 768px)', `${SCOPE} #bottomLeft`, 'top', 'var(--oe-calendar-toolbar-height, 4.78rem)'],
    ['(max-width: 768px)', `${SCOPE} #bottomLeft`, 'height', 'calc(100% - var(--oe-calendar-toolbar-height, 4.78rem))'],
    ['(max-width: 576px)', `${SCOPE} #bottomLeft`, 'top', 'var(--oe-calendar-toolbar-height, 6.9rem)'],
    ['(max-width: 576px)', `${SCOPE} #bottomLeft`, 'height', 'calc(100% - var(--oe-calendar-toolbar-height, 6.9rem))'],
    ['(min-width: 769px)', `${SCOPE} #wrapper.toggled .sidebar-wrapper`, 'display', 'none']
];
const mediaException = (r) => MEDIA_EXCEPTIONS.some(([media, selector, prop, value]) => r.media === media
    && r.selector === selector && r.prop === prop && r.value === value);

describe('calendar.css preserves clinical meaning and booking geometry', () => {
    test('every selector is scoped to the workbench calendar body', () => {
        const unscoped = calendarRules().filter((r) => !r.selector.startsWith(SCOPE));
        expect(unscoped).toEqual([]);
    });

    test('restyles toolbar, date navigation, view picker, providers and the booking surface', () => {
        const selectors = calendarRules().map((r) => r.selector).join('\n');
        ['#topToolbarRight', '#dateNAV', '#viewPicker', '#datePicker', '#providerPicker', '#pc_username', '#pc_facility', '#bigCal', '.providerheader', '.timeslot']
            .forEach((target) => expect(selectors).toContain(target));
    });

    test('never paints appointment, category, status or facility colours', () => {
        const colourProps = /^(background|background-color|background-image|border-left|border-left-color|color|filter|opacity)$/;
        const offending = calendarRules().filter((r) => colourProps.test(r.prop)
            && /(\.event\b|\.in_start|\.event_|\.month_event|#facilityColor|\.apptMarker|\.holiday|\.tdHoliday|\.schedule-holiday|\.timeslot-holiday|\.text-success|\.text-primary|\.text-danger|\bs\b)/.test(r.selector));
        expect(offending).toEqual([]);
    });

    test('does not change slot or event geometry used by booking, drag and reschedule', () => {
        const geometry = /^(height|min-height|max-height|line-height|padding|padding-top|padding-bottom|margin|margin-top|margin-bottom|top|left|width|position|border|border-width|border-top|border-bottom|box-sizing|font-size|display|zoom|transform)$/;
        const offending = calendarRules().filter((r) => geometry.test(r.prop)
            && /(\.timeslot|\.event\b|\.in_start|\.calendar_day|td\.schedule|\.schedule\b|#times|\.calendar-times|\.apptMarker)/.test(r.selector));
        expect(offending).toEqual([]);
    });

    test('keeps toolbar and provider header heights that the fixed sidebar and slot rows are aligned to', () => {
        const vertical = /^(height|min-height|max-height|line-height|font-size|padding|padding-top|padding-bottom|margin|margin-top|margin-bottom|border|border-width|border-top|border-bottom|border-top-width|border-bottom-width|position|top|display)$/;
        // Sole exception: the narrow fixed sidebar is placed below the measured toolbar (calendar-sidebar.js).
        const offending = calendarRules().filter((r) => vertical.test(r.prop) && !mediaException(r)
            && /(#topToolbarRight|#functions|#dateNAV|#viewPicker|\.providerheader|\.providerday|\.providerXbtn|#bottomLeft|\.sidebar-wrapper|\.page-content-wrapper|#wrapper|\.sticky-top|#bigCal)/.test(r.selector));
        expect(offending).toEqual([]);
    });

    test('leaves today, weekend, current-date and selected-view markers to the theme', () => {
        const paint = /^(background|background-color|color|border-color|border-left-color|box-shadow|outline)$/;
        const offending = calendarRules().filter((r) => paint.test(r.prop)
            && /(\.currentDate|\.currentWeek|\.tdWeekend-small|\.tdOtherMonthDay-small|\.tdDatePickerHighlight)/.test(r.selector));
        expect(offending).toEqual([]);
    });

    test('keeps theme typography that sets toolbar and slot heights', () => {
        const type = /^(font|font-family|font-weight|font-size|letter-spacing|white-space|word-spacing)$/;
        const offending = calendarRules().filter((r) => type.test(r.prop)
            && (r.selector === SCOPE || /(#topToolbarRight|#functions|#dateNAV|#viewPicker|\.timeslot|#times|\.providerheader|\.event)/.test(r.selector)));
        expect(offending).toEqual([]);
    });

    test('sidebar panels with added margin, padding or border stay inside the fixed sidebar', () => {
        const byPanel = {};
        calendarRules().filter((r) => /^body\S* (#datePicker|#providerPicker)$/.test(r.selector)).forEach((r) => {
            const panel = r.selector.split(' ').pop();
            byPanel[panel] = { ...byPanel[panel], [r.prop]: r.value };
        });
        Object.entries(byPanel).forEach(([panel, decls]) => {
            const boxed = Object.keys(decls).some((p) => /^(margin|padding|border)/.test(p));
            if (!boxed) return;
            expect([panel, decls['box-sizing']]).toEqual([panel, 'border-box']);
            expect([panel, decls.width]).toEqual([panel, 'auto']);
        });
    });

    test('week header links that are recoloured keep a hover state', () => {
        const selectors = calendarRules().map((r) => r.selector);
        selectors.filter((s) => /\.week_(dateheader|currday)[^ ]* a$/.test(s)).forEach((s) => {
            expect(selectors).toContain(`${s}:hover`);
        });
    });

    test('provider header and its close control stay white on petrol over the dark/solar theme !important override', () => {
        // ajax_calendar_sass.scss forces `.providerheader` / `.providerXbtn` colour with !important in dark and solar
        // themes; without a matching scoped override that dark text lands on the petrol header (~2.4:1).
        const forced = (sel) => calendarRules().filter((r) => r.selector === `${SCOPE} ${sel}` && r.prop === 'color' && r.important);
        expect(forced('.providerheader').map((r) => r.value)).toEqual(['#fff']);
        expect(forced('.providerheader .providerXbtn').map((r) => r.value)).toEqual(['#fff']);
        expect(forced('.providerheader .providerXbtn:hover').length).toBe(1);
        // Only these UI-chrome selectors may use !important; the outer week/day unselect-all button is not on petrol.
        const chrome = new Set(['.providerheader', '.providerheader .providerXbtn', '.providerheader .providerXbtn:hover'].map((s) => `${SCOPE} ${s}`));
        const important = calendarRules().filter((r) => r.important);
        expect(important.filter((r) => !chrome.has(r.selector) || r.prop !== 'color')).toEqual([]);
    });

    test('hides nothing and never forces clinical colours with !important', () => {
        const rules = calendarRules();
        expect(rules.filter((r) => r.prop === 'display' && r.value === 'none' && !mediaException(r))).toEqual([]);
        expect(rules.filter((r) => r.prop === 'visibility' || r.prop === 'pointer-events')).toEqual([]);
        expect(rules.filter((r) => r.important && /\.event|#facilityColor/.test(r.selector))).toEqual([]);
    });
});

describe('calendar toolbar and mini calendar fit the workbench frame', () => {
    // Bootstrap's md breakpoint, where the theme's col-md-3/6/3 toolbar split starts.
    const DESKTOP = '(min-width: 768px)';

    function rulesWithMedia() {
        const rules = [];
        postcss.parse(fs.readFileSync(cssPath, 'utf8')).walkRules((rule) => {
            const media = rule.parent.type === 'atrule' && rule.parent.name === 'media' ? rule.parent.params : null;
            rule.selectors.forEach((selector) => {
                rule.walkDecls((decl) => rules.push({ selector, media, prop: decl.prop, value: decl.value }));
            });
        });
        return rules;
    }

    function decls(selector, media) {
        return Object.fromEntries(rulesWithMedia()
            .filter((r) => r.selector === `${SCOPE} ${selector}` && r.media === media)
            .map((r) => [r.prop, r.value]));
    }

    test.each(['day', 'week', 'month'])('%s toolbar keeps every function, navigation and view control', (view) => {
        loadFixture(`calendar-${view}-screen-empty.html`);
        const toolbar = document.getElementById('topToolbarRight');
        expect([...toolbar.children].map((el) => el.id)).toEqual(['functions', 'dateNAV', 'viewPicker']);
        expect(document.querySelectorAll('#functions #menu-toggle, #functions a[title="New Appointment"], #functions a[title="Search Appointment"]')).toHaveLength(3);
        expect(document.querySelectorAll(`#dateNAV a[id^="prev${view}"], #dateNAV a[id^="next${view}"]`)).toHaveLength(2);
        const picker = [...document.querySelectorAll('#viewPicker a')].map((a) => a.id || a.title);
        expect(picker).toEqual(['printview', 'Refresh', 'dayview', 'weekview', 'monthview']);
    });

    test.each(['day', 'week', 'month'])('%s mini calendar is a seven-column table inside the scrolling wrapper', (view) => {
        loadFixture(`calendar-${view}-screen-empty.html`);
        const table = document.querySelector('#datePicker .table-responsive > table');
        // The empty fixtures render the month/navigation and weekday rows; live QA covers the date rows.
        const rows = [...table.rows];
        expect(rows.length).toBeGreaterThanOrEqual(2);
        rows.forEach((row) => {
            expect([...row.cells].reduce((n, td) => n + td.colSpan, 0)).toBe(7);
        });
    });

    test('desktop toolbar sizes the function and view groups to their buttons and lets the date take the rest', () => {
        // The theme fixes #viewPicker at 25%, too narrow for print/refresh/Day/Week/Month in the workbench frame.
        // Its @extend .col-md-* also brings Bootstrap's `width: 100%`, which an `auto` flex basis would adopt
        // and stack the three groups, so the width has to be released too.
        expect(decls('#functions', DESKTOP)).toEqual({ flex: '0 1 auto', 'max-width': 'none', width: 'auto' });
        // In 768-945px frames the three groups can exceed one row (Today button, long dates). The date keeps
        // its intrinsic width (auto basis, no shrink, no min-width: 0) so the heading and both chevrons never
        // wrap; whole groups wrap instead, and #viewPicker goes to the end edge, clear of the fixed sidebar.
        expect(decls('#viewPicker', DESKTOP)).toEqual({ flex: '0 1 auto', 'margin-inline-start': 'auto', 'max-width': 'none', width: 'auto' });
        expect(decls('#dateNAV', DESKTOP)).toEqual({ flex: '1 0 auto', 'max-width': 'none', width: 'auto' });
    });

    test('below the desktop breakpoint the toolbar keeps the theme stacking that #bottomLeft offsets assume', () => {
        const sizing = /^(flex|flex-basis|flex-grow|flex-shrink|flex-wrap|width|min-width|max-width|order)$/;
        const offending = rulesWithMedia().filter((r) => r.media !== DESKTOP && sizing.test(r.prop)
            && /(#topToolbarRight|#functions|#dateNAV|#viewPicker)/.test(r.selector));
        expect(offending).toEqual([]);
    });

    test('media queries use prefix notation for older supported browsers', () => {
        const params = [];
        postcss.parse(fs.readFileSync(cssPath, 'utf8')).walkAtRules('media', (at) => params.push(at.params));
        expect(params).toContain(DESKTOP);
        expect(params.filter((p) => /[<>]/.test(p))).toEqual([]);
        expect(fs.readFileSync(cssPath, 'utf8')).not.toMatch(/stylelint-disable/);
    });

    test('stylelint enforces prefix media notation for calendar.css and finder.css only', () => {
        const config = JSON.parse(fs.readFileSync(path.join(repo, '.stylelintrc.json'), 'utf8'));
        expect(config.rules['media-feature-range-notation']).toBeUndefined();
        const calendarOverrides = config.overrides.filter((o) => o.files.includes('interface/clinical-workspace/calendar.css')
            || o.files.includes('interface/clinical-workspace/finder.css'));
        expect(calendarOverrides).toEqual([{
            files: ['interface/clinical-workspace/calendar.css', 'interface/clinical-workspace/finder.css'],
            rules: { 'media-feature-range-notation': 'prefix' },
        }]);
    });

    test.each([
        ['prefix', '@media (min-width: 768px) {\n  a {\n    color: red;\n  }\n}\n', 0],
        ['range', '@media (width >= 768px) {\n  a {\n    color: red;\n  }\n}\n', 1],
    ])('stylelint on calendar.css accepts %s notation only when it is prefix', (_name, code, expected) => {
        // The real stylelint CLI with the repo config; its Node API cannot load under the jsdom environment.
        const { spawnSync } = require('child_process');
        const cli = path.join(path.dirname(require.resolve('stylelint/package.json')), 'bin/stylelint.mjs');
        const run = spawnSync(process.execPath, [cli, '--formatter', 'json', '--stdin-filename', cssPath], { cwd: repo, input: code, encoding: 'utf8' });
        const [result] = JSON.parse(run.stdout || run.stderr);
        const hits = result.warnings.filter((w) => w.rule === 'media-feature-range-notation');
        expect(hits.map((w) => w.text)).toEqual(expected ? ['Expected "prefix" media feature range notation (media-feature-range-notation)'] : []);
    });

    test('mini calendar shares the sidebar width across all seven columns instead of scrolling the last one away', () => {
        expect(decls('#datePicker table', null)).toEqual({ 'table-layout': 'fixed' });
        expect(decls('#datePicker td', null)).toEqual({ 'padding-left': '0', 'padding-right': '0' });
    });

    test('layout repair never clips, hides or shrinks toolbar and mini-calendar content', () => {
        const clipping = /^(overflow|overflow-x|overflow-y|text-overflow|clip|clip-path|max-height|height|transform|zoom)$/;
        const offending = rulesWithMedia().filter((r) => clipping.test(r.prop)
            && /(#topToolbarRight|#functions|#dateNAV|#viewPicker|#datePicker|\.table-responsive)/.test(r.selector));
        expect(offending).toEqual([]);
        // Date numbers keep the theme size; only the pre-existing weekday-initial row is restyled.
        const sized = rulesWithMedia().filter((r) => r.prop === 'font-size' && /#datePicker/.test(r.selector));
        expect(sized.map((r) => [r.selector, r.value])).toEqual([[`${SCOPE} #datePicker tr:nth-child(2) .tdDOW-small`, '0.72rem']]);
    });
});
