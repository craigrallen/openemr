/**
 * @jest-environment jsdom
 */

// Synthetic-only fixtures: every name, id and time below is invented for the test.
const path = require('path');
const fs = require('fs');

const repo = path.join(__dirname, '../..');
const modulePath = path.join(repo, 'interface/clinical-workspace/calendar-workday.js');
const { createWorkdaySummary, collectSchedule } = require(modulePath);

const LABELS = {
    'data-l-count-one': '1 booking · {providers} provider(s)',
    'data-l-count': '{count} bookings · {providers} provider(s)',
    'data-l-empty': 'No bookings for the selected providers on this day',
    'data-l-unavailable': 'Schedule not loaded',
    'data-l-first': 'First booking',
    'data-l-time-unknown': 'Start time not available'
};

function surfaceHtml({ date = '20261001', slotStart = '480', interval = '15', height = '20', withToday = false, labels: overrides = {} } = {}) {
    const labels = Object.entries({ ...LABELS, ...overrides })
        .filter(([, v]) => v !== null)
        .map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<section id="oe-calendar-workday" class="oe-cal-workday" hidden data-date="${date}"
        data-slot-start-min="${slotStart}" data-slot-interval-min="${interval}" data-slot-height="${height}" ${labels}>
        <h2 class="oe-cal-workday__date">Thursday October 1 2026</h2>
        <p data-role="count"></p>
        <p data-role="next" hidden><span data-role="next-label"></span> <span data-role="next-time"></span>
            <span data-role="next-provider"></span> <span data-role="next-patient"></span></p>
        <button type="button" data-role="open-booking" hidden>Open booking</button>
        <button type="button" data-role="open-patient" hidden>Open patient</button>
        <button type="button" data-role="show-booking" hidden>Show in calendar</button>
        <button type="button" data-role="new-appointment" hidden>New appointment</button>
        ${withToday ? '<button type="button" data-role="today" hidden>Today</button>' : ''}
    </section>`;
}

function toolbarHtml(withToday) {
    return `<div id="functions">
        <a href="#" data-oe-workday-action="new-appointment" onclick="window.__newEvt(); return false;">+</a>
        ${withToday ? '<a href="#" data-oe-workday-action="today" onclick="window.__today(); return false;">Today</a>' : ''}
    </div>`;
}

function event({ date = '20261001', eid, top, patient, pid = '1', href = `#p${pid}`, cls = 'event_appointment', status = '-', group = false, inStart = false }) {
    const link = group
        ? `<a href="javascript:goGid(&quot;9&quot;)" title="g"><i class="fas fa-user text-primary"></i>${patient}</a>`
        : `<a class="link_title" data-pid="${pid}" href="${href}" title="t"><i class="fas fa-user text-success"></i>${patient}</a>`;
    const minutes = 480 + (top / 20) * 15;
    const shownTime = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
    const body = patient === null ? '' : `<span class="appointment"><a class="event_time" onclick="event_time_click(this)" title="Click to edit">${shownTime}</a>&nbsp;${status}${link}</span>`;
    return `<div data-eid="${eid}" class="${cls} event${inStart ? ' in_start' : ''}" style="top:${top}px; height:20px; background-color: #abcdef;" title="tip" id="${date}-${eid}-0">${body}</div>`;
}

function column(id, name, events, date = '20261001') {
    return `<td class="schedule work-day" title="${name}" date="${date}" provider="${id}">
        <div class="providerheader providerday">${name}<a class="providerXbtn userClose" data-username="u${id}"></a></div>
        <div class="calendar_day">${events.join('')}</div></td>`;
}

function mount({ columns = [], surface = {}, withToday = false, noGrid = false } = {}) {
    document.body.innerHTML = `${toolbarHtml(withToday)}${surfaceHtml({ ...surface, withToday })}`
        + (noGrid ? '' : `<div id="bigCal"><table><tr><td id="times"></td>${columns.join('')}</tr></table></div>`);
    return document.getElementById('oe-calendar-workday');
}

const text = (role) => document.querySelector(`[data-role="${role}"]`).textContent.trim();
const shown = (role) => !document.querySelector(`[data-role="${role}"]`).hidden;

afterEach(() => {
    document.body.innerHTML = '';
    delete window.event_time_click;
    delete window.__newEvt;
    delete window.__today;
});

describe('calendar workday summary', () => {
    test('zero events is reported as empty, not as missing data', () => {
        const surface = mount({ columns: [column(5, 'Robin Example', [])] });
        const ctl = createWorkdaySummary({ document, surface });
        expect(ctl.getState().status).toBe('empty');
        expect(text('count')).toBe(LABELS['data-l-empty']);
        expect(shown('next')).toBe(false);
        expect(shown('open-booking')).toBe(false);
        expect(surface.hidden).toBe(false);
        ctl.destroy();
    });

    test('no provider columns is reported as not loaded', () => {
        const surface = mount({ noGrid: true });
        const ctl = createWorkdaySummary({ document, surface });
        expect(ctl.getState().status).toBe('unavailable');
        expect(text('count')).toBe(LABELS['data-l-unavailable']);
        expect(shown('next')).toBe(false);
        ctl.destroy();
    });

    test('multiple providers: counts all columns, orders by start then column, picks the first booking', () => {
        const surface = mount({
            columns: [
                column(5, 'Robin Example', [
                    event({ eid: 11, top: 40, patient: 'Alpha,Test' }),     // 08:30
                    event({ eid: 12, top: 120, patient: 'Gamma,Test' })     // 09:30
                ]),
                column(6, 'Sam Sample', [
                    event({ eid: 21, top: 80, patient: 'Beta,Test' }),      // 09:00
                    event({ eid: 22, top: 120, patient: 'Delta,Test' })     // 09:30
                ])
            ]
        });
        const ctl = createWorkdaySummary({ document, surface });
        const state = ctl.getState();
        expect(state.status).toBe('ready');
        expect(state.providers.map((p) => [p.id, p.count])).toEqual([['5', 2], ['6', 2]]);
        expect(state.bookings.map((b) => b.eid)).toEqual(['11', '21', '12', '22']);
        expect(state.bookings.map((b) => b.startMin)).toEqual([510, 540, 570, 570]);
        expect(state.first.eid).toBe('11');
        expect(text('count')).toBe('4 bookings · 2 provider(s)');
        expect(text('next-label')).toBe('First booking');
        expect(text('next-time')).toBe('8:30');
        expect(text('next-provider')).toBe('Robin Example');
        expect(text('next-patient')).toBe('Alpha,Test');
        ctl.destroy();
    });

    test('no browser-clock "next": the first booking is shown whatever the local time', () => {
        // Rendered times are calendar wall-clock; nothing on the page proves the browser
        // shares that timezone, so the summary must not compare against new Date().
        jest.useFakeTimers().setSystemTime(new Date(2026, 9, 1, 17, 0, 0));
        try {
            const surface = mount({ columns: [column(5, 'Robin Example', [event({ eid: 11, top: 40, patient: 'Alpha,Test' })])] });
            const ctl = createWorkdaySummary({ document, surface });
            expect(ctl.getState().first.eid).toBe('11');
            expect(ctl.getState()).not.toHaveProperty('next');
            expect(text('next-label')).toBe('First booking');
            expect(shown('open-booking')).toBe(true);
            ctl.destroy();
        } finally {
            jest.useRealTimers();
        }
    });

    test.each(['count-one', 'count', 'empty', 'unavailable', 'first', 'time-unknown'])(
        'surface stays hidden when the %s label is missing or blank',
        (key) => {
            ['missing', 'blank'].forEach((mode) => {
                const surface = mount({
                    surface: { labels: { [`data-l-${key}`]: mode === 'missing' ? null : '  ' } },
                    columns: [column(5, 'Robin Example', [event({ eid: 11, top: 40, patient: 'Alpha,Test' })])]
                });
                const ctl = createWorkdaySummary({ document, surface });
                expect(surface.hidden).toBe(true);
                expect(text('count')).toBe('');
                expect(shown('next')).toBe(false);
                ctl.destroy();
            });
        }
    );

    test('first booking follows start order, and refresh follows a date change', () => {
        const surface = mount({
            columns: [column(5, 'Robin Example', [
                event({ eid: 11, top: 100, patient: 'Later,Test' }),
                event({ eid: 12, top: 0, patient: 'Early,Test' })
            ])]
        });
        const ctl = createWorkdaySummary({ document, surface });
        expect(ctl.getState().first.eid).toBe('12');
        expect(text('next-label')).toBe('First booking');
        expect(text('next-time')).toBe('8:00');

        // Simulate a re-rendered grid for a different date: old-date nodes must not count.
        surface.dataset.date = '20261002';
        const td = document.querySelector('td.schedule');
        td.setAttribute('date', '20261002');
        td.querySelector('.calendar_day').insertAdjacentHTML('beforeend', event({ date: '20261002', eid: 31, top: 60, patient: 'Next,Day' }));
        ctl.refresh();
        expect(ctl.getState().bookings.map((b) => b.eid)).toEqual(['31']);
        expect(ctl.getState().date).toBe('20261002');
        ctl.destroy();
    });

    test('status text in the event is never surfaced or interpreted', () => {
        const surface = mount({ columns: [column(5, 'Robin Example', [event({ eid: 11, top: 40, patient: 'Alpha,Test', status: '@' })])] });
        const ctl = createWorkdaySummary({ document, surface });
        const booking = ctl.getState().bookings[0];
        expect(booking).not.toHaveProperty('status');
        expect(surface.textContent).not.toContain('@');
        expect(text('next-patient')).toBe('Alpha,Test');
        ctl.destroy();
    });

    test('appointment comment free text inside the patient link is not copied, and the link is untouched', () => {
        // Appointment display style >= 4 appends "(title: <span class='text-success'>comment</span>)"
        // inside a.link_title (CalendarViewModel::buildDayScreenEventContent).
        const surface = mount({ columns: [column(5, 'Robin Example', [
            event({ eid: 11, top: 40, patient: "Alpha,Test(Office Visit: <span class='text-success'>Private note</span>)" })
        ])] });
        const link = document.querySelector('#bigCal a.link_title');
        const before = link.outerHTML;
        const ctl = createWorkdaySummary({ document, surface });
        expect(text('next-patient')).toBe('Alpha,Test(Office Visit)');
        expect(surface.textContent).not.toContain('Private note');
        expect(link.outerHTML).toBe(before);
        ctl.destroy();
    });

    test('unknown slot geometry hides times and next-booking but keeps the count', () => {
        const surface = mount({
            surface: { interval: '' },
            columns: [column(5, 'Robin Example', [event({ eid: 11, top: 40, patient: 'Alpha,Test' })])]
        });
        const ctl = createWorkdaySummary({ document, surface });
        expect(ctl.getState().timing).toBe('unknown');
        expect(ctl.getState().bookings[0].startMin).toBeNull();
        expect(text('count')).toBe('1 booking · 1 provider(s)');
        expect(text('next-label')).toBe(LABELS['data-l-time-unknown']);
        expect(shown('open-booking')).toBe(false);
        ctl.destroy();
    });

    test('labels are inserted as text, never as markup', () => {
        const surface = mount({ columns: [column(5, 'Robin &lt;b&gt;Example&lt;/b&gt;', [
            event({ eid: 11, top: 40, patient: '&lt;img src=x onerror=alert(1)&gt;' })
        ])] });
        const ctl = createWorkdaySummary({ document, surface });
        expect(surface.querySelector('img')).toBeNull();
        expect(surface.querySelector('b')).toBeNull();
        expect(text('next-patient')).toBe('<img src=x onerror=alert(1)>');
        expect(text('next-provider')).toBe('Robin <b>Example</b>');
        ctl.destroy();
    });

    test('dedups in_start labels and duplicate ids; skips non-booking and other-date nodes', () => {
        const surface = mount({ columns: [column(5, 'Robin Example', [
            event({ eid: 11, top: 40, patient: 'Alpha,Test' }),
            event({ eid: 11, top: 40, patient: 'Alpha,Test' }),
            event({ eid: 11, top: 20, patient: 'Alpha,Test', inStart: true }),
            event({ eid: 12, top: 60, patient: null, cls: 'event_out' }),
            event({ eid: 13, top: 60, patient: null, cls: 'event_appointment' }), // facility-filtered placeholder
            event({ eid: 14, top: 80, patient: 'Group,Session', group: true }),
            event({ eid: 15, top: 90, patient: 'Gone,Test', cls: 'event_noshow' }),
            event({ date: '20260930', eid: 16, top: 10, patient: 'Other,Day' })
        ])] });
        const state = collectSchedule(document, surface);
        expect(state.bookings.map((b) => b.eid)).toEqual(['11', '14', '15']);
        surface.hidden = true;
    });

    test('actions delegate to the original handlers and leave event nodes untouched', () => {
        window.event_time_click = jest.fn();
        window.__newEvt = jest.fn();
        window.__today = jest.fn();
        const surface = mount({
            withToday: true,
            columns: [column(5, 'Robin Example', [event({ eid: 11, top: 40, patient: 'Alpha,Test', pid: '77' })])]
        });
        const node = document.getElementById('20261001-11-0');
        const before = node.outerHTML;
        const parent = node.parentNode;
        const patientClicks = jest.fn((e) => e.preventDefault());
        node.querySelector('a.link_title').addEventListener('click', patientClicks);
        node.scrollIntoView = jest.fn();

        const ctl = createWorkdaySummary({ document, surface });
        surface.querySelector('[data-role="open-booking"]').click();
        expect(window.event_time_click).toHaveBeenCalledWith(node.querySelector('a.event_time'));
        surface.querySelector('[data-role="open-patient"]').click();
        expect(patientClicks).toHaveBeenCalledTimes(1);
        surface.querySelector('[data-role="show-booking"]').click();
        expect(node.scrollIntoView).toHaveBeenCalled();
        surface.querySelector('[data-role="new-appointment"]').click();
        expect(window.__newEvt).toHaveBeenCalledTimes(1);
        surface.querySelector('[data-role="today"]').click();
        expect(window.__today).toHaveBeenCalledTimes(1);

        expect(node.parentNode).toBe(parent);
        expect(node.outerHTML).toBe(before);
        ctl.destroy();
    });

    test('proxies stay hidden when the original controls are absent', () => {
        const surface = mount({ withToday: true, columns: [column(5, 'Robin Example', [])] });
        document.querySelector('[data-oe-workday-action="new-appointment"]').remove();
        document.querySelector('[data-oe-workday-action="today"]').remove();
        const ctl = createWorkdaySummary({ document, surface });
        expect(shown('new-appointment')).toBe(false);
        expect(shown('today')).toBe(false);
        ctl.destroy();
    });

    test('each proxy follows only its own original control', () => {
        const surface = mount({ withToday: true, columns: [column(5, 'Robin Example', [])] });
        document.querySelector('[data-oe-workday-action="new-appointment"]').remove();
        const ctl = createWorkdaySummary({ document, surface });
        expect(shown('new-appointment')).toBe(false);
        expect(shown('today')).toBe(true);
        ctl.destroy();
    });

    test('mutation observer refreshes, and teardown disconnects and removes listeners', () => {
        window.event_time_click = jest.fn();
        const surface = mount({ columns: [column(5, 'Robin Example', [])] });
        let callback = null;
        const observer = { disconnect: jest.fn() };
        const ctl = createWorkdaySummary({
            document, surface,
            observe: (target, cb) => { callback = cb; return observer; }
        });
        expect(ctl.getState().status).toBe('empty');
        callback([{ addedNodes: [document.createElement('div')], removedNodes: [] }]);
        expect(ctl.getState().status).toBe('empty');
        document.querySelector('.calendar_day').insertAdjacentHTML('beforeend', event({ eid: 11, top: 40, patient: 'Alpha,Test' }));
        const added = document.getElementById('20261001-11-0');
        // A direct-select marker mutation is ignored; an event mutation refreshes.
        callback([{ addedNodes: [document.createElement('span')], removedNodes: [] }]);
        expect(ctl.getState().status).toBe('empty');
        callback([{ addedNodes: [added], removedNodes: [] }]);
        expect(ctl.getState().status).toBe('ready');

        ctl.destroy();
        expect(observer.disconnect).toHaveBeenCalled();
        expect(surface.hidden).toBe(true);
        expect(text('count')).toBe('');
        surface.querySelector('[data-role="open-booking"]').click();
        expect(window.event_time_click).not.toHaveBeenCalled();
        expect(document.getElementById('20261001-11-0')).not.toBeNull();
    });
});

// The real page bootstrap (window wrapper + browser MutationObserver), not an injected stub.
function bootPage(columns) {
    mount({ columns });
    jest.isolateModules(() => { require(modulePath); });
}
const flush = async () => { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); };
const node = (eid) => document.getElementById(`20261001-${eid}-0`);
const twoBookings = () => [column(5, 'Robin Example', [
    event({ eid: 11, top: 40, patient: 'Alpha,Test' }),   // 08:30
    event({ eid: 12, top: 80, patient: 'Beta,Test' })     // 09:00
])];

describe('live refresh of existing event nodes (real page observer)', () => {
    test('a moved event (style top + time text) changes the first booking', async () => {
        bootPage(twoBookings());
        expect(text('next-patient')).toBe('Alpha,Test');
        node(11).style.top = '160px';
        node(11).querySelector('a.event_time').firstChild.data = '10:00';
        await flush();
        expect(text('next-time')).toBe('9:00');
        expect(text('next-patient')).toBe('Beta,Test');
    });

    test('changed time text alone is reflected', async () => {
        bootPage(twoBookings());
        node(11).querySelector('a.event_time').firstChild.data = '8:31';
        await flush();
        expect(text('next-time')).toBe('8:31');
    });

    test('changed patient link text is reflected; comment span still stripped', async () => {
        bootPage(twoBookings());
        const link = node(11).querySelector('a.link_title');
        link.lastChild.data = 'Renamed,Test';
        await flush();
        expect(text('next-patient')).toBe('Renamed,Test');
        link.insertAdjacentHTML('beforeend', "(Visit: <span class='text-success'>Private note</span>)");
        await flush();
        expect(text('next-patient')).toBe('Renamed,Test(Visit)');
        expect(document.getElementById('oe-calendar-workday').textContent).not.toContain('Private note');
    });

    test.each([
        ['booking class replaced', (n) => { n.classList.remove('event_appointment'); n.classList.add('event_out'); }],
        ['event class removed', (n) => { n.className = 'event_appointment'; }]
    ])('%s: no longer counted or offered as first booking', async (_name, change) => {
        bootPage(twoBookings());
        expect(text('count')).toBe('2 bookings · 1 provider(s)');
        change(node(11));
        await flush();
        expect(text('count')).toBe('1 booking · 1 provider(s)');
        expect(text('next-patient')).toBe('Beta,Test');
    });

    test('column date and provider header metadata changes are reflected', async () => {
        bootPage(twoBookings());
        document.querySelector('.providerheader').firstChild.data = 'Robin Renamed';
        await flush();
        expect(text('next-provider')).toBe('Robin Renamed');
        document.querySelector('td.schedule').setAttribute('date', '20261002');
        await flush();
        expect(text('count')).toBe(LABELS['data-l-unavailable']);
        expect(shown('next')).toBe(false);
    });

    test('direct-select marker churn does not re-render, and a real change renders once (no loop)', async () => {
        bootPage(twoBookings());
        const surface = document.getElementById('oe-calendar-workday');
        let surfaceRecords = 0;
        const counter = new MutationObserver((records) => { surfaceRecords += records.length; });
        counter.observe(surface, { childList: true, subtree: true, attributes: true, characterData: true });
        // Mirrors library/js/calendarDirectSelect.js displayApptTime on mousemove.
        const day = document.querySelector('.calendar_day');
        day.insertAdjacentHTML('beforeend', "<a class='apptMarker event event_appointment' style='height:20px;'></a>");
        const marker = day.querySelector('a.apptMarker');
        for (let y = 20; y <= 100; y += 20) {
            marker.style.top = y + 'px';
            marker.innerHTML = '<span>9:' + y + '</span>';
            marker.setAttribute('href', 'javascript:newEvt(9,' + y + ')');
            marker.style.display = '';
        }
        marker.style.display = 'none';
        await flush();
        expect(surfaceRecords).toBe(0);
        node(11).style.top = '160px';
        await flush();
        const afterOne = surfaceRecords;
        expect(afterOne).toBeGreaterThan(0);
        await flush();
        expect(surfaceRecords).toBe(afterOne);
        counter.disconnect();
    });
});

describe('actions taken before the observer has delivered', () => {
    const clicks = () => {
        window.event_time_click = jest.fn();
        const patientClicks = jest.fn((e) => e.preventDefault());
        document.querySelectorAll('#bigCal a.link_title').forEach((a) => a.addEventListener('click', patientClicks));
        document.querySelectorAll('#bigCal .event').forEach((n) => { n.scrollIntoView = jest.fn(); });
        return patientClicks;
    };
    const press = (role) => document.querySelector(`[data-role="${role}"]`).click();

    test.each(['open-booking', 'open-patient', 'show-booking'])(
        '%s: stale first booking is not acted on and no other booking is substituted; summary refreshes',
        (role) => {
            const surface = mount({ columns: twoBookings() });
            const patientClicks = clicks();
            const ctl = createWorkdaySummary({ document, surface });
            node(11).style.top = '160px';
            press(role);
            expect(window.event_time_click).not.toHaveBeenCalled();
            expect(patientClicks).not.toHaveBeenCalled();
            expect(node(11).scrollIntoView).not.toHaveBeenCalled();
            expect(node(12).scrollIntoView).not.toHaveBeenCalled();
            expect(text('next-patient')).toBe('Beta,Test');
            ctl.destroy();
        }
    );

    test('after the refresh, a deliberate click on the now-visible booking proceeds', () => {
        const surface = mount({ columns: twoBookings() });
        clicks();
        const ctl = createWorkdaySummary({ document, surface });
        node(11).style.top = '160px';
        press('open-booking');
        expect(window.event_time_click).not.toHaveBeenCalled();
        press('open-booking');
        expect(window.event_time_click).toHaveBeenCalledTimes(1);
        expect(window.event_time_click).toHaveBeenCalledWith(node(12).querySelector('a.event_time'));
        ctl.destroy();
    });

    test('a different patient reference behind identical text blocks the patient action', () => {
        const surface = mount({ columns: twoBookings() });
        const patientClicks = clicks();
        const ctl = createWorkdaySummary({ document, surface });
        node(11).querySelector('a.link_title').setAttribute('data-pid', '999');
        press('open-patient');
        expect(patientClicks).not.toHaveBeenCalled();
        press('open-patient');
        expect(patientClicks).toHaveBeenCalledTimes(1);
        ctl.destroy();
    });

    test('real observer: destroy disconnects, later grid changes do not touch the surface', async () => {
        const surface = mount({ columns: twoBookings() });
        let observer = null;
        const ctl = createWorkdaySummary({
            document, surface,
            observe: (target, cb) => {
                observer = new MutationObserver(cb);
                observer.observe(target, { childList: true, subtree: true, attributes: true, characterData: true });
                jest.spyOn(observer, 'disconnect');
                return observer;
            }
        });
        ctl.destroy();
        expect(observer.disconnect).toHaveBeenCalledTimes(1);
        node(11).style.top = '160px';
        node(11).querySelector('a.link_title').lastChild.data = 'Renamed,Test';
        await flush();
        expect(surface.hidden).toBe(true);
        expect(text('count')).toBe('');
        expect(text('next-patient')).toBe('');
    });

    test('changed patient label on the same node blocks the patient action', () => {
        const surface = mount({ columns: twoBookings() });
        const patientClicks = clicks();
        const ctl = createWorkdaySummary({ document, surface });
        node(11).querySelector('a.link_title').lastChild.data = 'Other,Person';
        press('open-patient');
        expect(patientClicks).not.toHaveBeenCalled();
        expect(text('next-patient')).toBe('Other,Person');
        ctl.destroy();
    });

    test('booking that lost eligibility is not opened', () => {
        const surface = mount({ columns: twoBookings() });
        clicks();
        const ctl = createWorkdaySummary({ document, surface });
        node(11).classList.replace('event_appointment', 'event_out');
        press('open-booking');
        expect(window.event_time_click).not.toHaveBeenCalled();
        expect(text('count')).toBe('1 booking · 1 provider(s)');
        ctl.destroy();
    });
});

// Production handlers and routes, read from the shared calendar screen script rather than mocked.
const screenJs = fs.readFileSync(path.join(repo, 'templates/calendar/default/views/_calendar_screen_js.html.twig'), 'utf8')
    .replace(/\{\{ webroot \}\}/g, '/oe');
function productionSource(start) {
    const at = screenJs.indexOf(start);
    if (at < 0) throw new Error('production source not found: ' + start);
    let depth = 0;
    for (let i = screenJs.indexOf('{', at); i < screenJs.length; i++) {
        if (screenJs[i] === '{') depth++;
        if (screenJs[i] === '}' && --depth === 0) return screenJs.slice(at, i + 1);
    }
    throw new Error('unbalanced production source: ' + start);
}
const ROUTE_GLOBALS = ['$', 'jQuery', 'dlgopen', 'restoreSession', 'RTop', 'event_time_click', 'EditEvent',
    'oldEvt', 'oldGroupEvt', 'goPid', 'goGid', 'objID', 'parts', 'editing_group'];
function loadProductionRoutes() {
    window.$ = window.jQuery = require('jquery');
    window.dlgopen = jest.fn();
    window.restoreSession = jest.fn();
    window.RTop = { location: '' };
    ['function event_time_click(', 'function oldEvt(', 'function oldGroupEvt(', 'function goPid(', 'function goGid(', 'var EditEvent = function(']
        .forEach((start) => window.eval(productionSource(start)));
}
function bindProductionHover() {
    const hover = screenJs.match(/\$\("\.event"\)\.mouse(over|out)\(function\(\) \{ \$\(this\)\.toggleClass\("event_highlight"\); \}\);/g);
    expect(hover).toHaveLength(2);
    hover.forEach((line) => window.eval(line));
}
const prodHref = (pid) => `javascript:goPid(&quot;${pid}&quot;)`;
const prodBookings = () => [column(5, 'Robin Example', [
    event({ eid: 11, top: 40, patient: 'Alpha,Test', pid: '1', href: prodHref('1') }),
    event({ eid: 12, top: 80, patient: 'Beta,Test', pid: '2', href: prodHref('2') })
])];
const editUrl = (eid, prov) => `add_edit_event.php?date=20261001&eid=${eid}&prov=${prov}`;
const groupUrl = (eid, prov) => `add_edit_event.php?group=true&date=20261001&eid=${eid}&prov=${prov}`;
const settle = () => new Promise((r) => setTimeout(r, 20));

describe('presentation-only hover does not rescan the grid', () => {
    afterEach(() => { ROUTE_GLOBALS.forEach((name) => { delete window[name]; }); jest.restoreAllMocks(); });

    const surfaceRecorder = () => {
        const records = { count: 0 };
        const counter = new MutationObserver((list) => { records.count += list.length; });
        counter.observe(document.getElementById('oe-calendar-workday'), { childList: true, subtree: true, attributes: true, characterData: true });
        return { records, counter };
    };
    const hover = (n, type) => n.dispatchEvent(new MouseEvent(type, { bubbles: true }));

    test('production mouseover/mouseout event_highlight toggles neither re-render nor re-read the grid', async () => {
        bootPage(twoBookings());
        loadProductionRoutes();
        bindProductionHover();
        const { records, counter } = surfaceRecorder();
        const clones = jest.spyOn(Node.prototype, 'cloneNode');
        hover(node(11), 'mouseover');
        expect(node(11).classList.contains('event_highlight')).toBe(true);
        await flush();
        hover(node(11), 'mouseout');
        hover(node(12), 'mouseover');
        hover(node(12), 'mouseout');
        await flush();
        expect(records.count).toBe(0);
        expect(clones).not.toHaveBeenCalled();
        counter.disconnect();
    });

    test.each([
        ['while highlighted', (n) => { n.classList.replace('event_appointment', 'event_out'); }],
        ['in the same batch as a hover toggle', (n) => {
            hover(n, 'mouseout');
            n.classList.replace('event_appointment', 'event_out');
        }]
    ])('a booking-eligibility class change %s still refreshes', async (_name, change) => {
        bootPage(twoBookings());
        loadProductionRoutes();
        bindProductionHover();
        hover(node(11), 'mouseover');
        await flush();
        change(node(11));
        await flush();
        expect(text('count')).toBe('1 booking · 1 provider(s)');
        expect(text('next-patient')).toBe('Beta,Test');
    });

    test('becoming a group booking (routing class) still refreshes', async () => {
        bootPage(twoBookings());
        const { records, counter } = surfaceRecorder();
        node(11).classList.add('groups');
        await flush();
        expect(records.count).toBeGreaterThan(0);
        counter.disconnect();
    });
});

describe('column provider removal and provider header replacement (real page observer)', () => {
    test('removing a column provider attribute stops counting that column', async () => {
        bootPage([...twoBookings(), column(6, 'Sam Sample', [event({ eid: 21, top: 120, patient: 'Gamma,Test' })])]);
        expect(text('count')).toBe('3 bookings · 2 provider(s)');
        document.querySelector('td.schedule[provider="6"]').removeAttribute('provider');
        await flush();
        expect(text('count')).toBe('2 bookings · 1 provider(s)');
    });

    test('replacing the provider header element updates the provider name', async () => {
        bootPage(twoBookings());
        const td = document.querySelector('td.schedule');
        const header = document.createElement('div');
        header.className = 'providerheader providerday';
        header.textContent = 'Robin Replaced';
        td.replaceChild(header, td.querySelector('.providerheader'));
        await flush();
        expect(text('next-provider')).toBe('Robin Replaced');
    });
});

describe('actions reach the production route only for the unchanged booking', () => {
    afterEach(() => { ROUTE_GLOBALS.forEach((name) => { delete window[name]; }); });

    const setup = () => {
        const surface = mount({ columns: prodBookings() });
        loadProductionRoutes();
        return createWorkdaySummary({ document, surface });
    };
    const press = (role) => document.querySelector(`[data-role="${role}"]`).click();

    test('unchanged booking: production routes receive the shown booking arguments', async () => {
        const ctl = setup();
        press('open-booking');
        expect(window.dlgopen).toHaveBeenCalledTimes(1);
        expect(window.dlgopen).toHaveBeenCalledWith(editUrl(11, 0), '_blank', 780, 650);
        press('open-patient');
        await settle();
        expect(window.RTop.location).toBe('../../patient_file/summary/demographics.php?set_pid=1');
        ctl.destroy();
    });

    test('unchanged group booking routes to the group editor and group page', async () => {
        const surface = mount({ columns: [column(5, 'Robin Example', [
            event({ eid: 14, top: 40, patient: 'Group,Session', group: true, cls: 'event_appointment groups' })
        ])] });
        loadProductionRoutes();
        const ctl = createWorkdaySummary({ document, surface });
        press('open-booking');
        expect(window.dlgopen).toHaveBeenCalledWith(groupUrl(14, 0), '_blank', 780, 675);
        press('open-patient');
        await settle();
        expect(window.RTop.location).toBe('/oe/therapy_groups/index.php?method=groupDetails&group_id=9');
        ctl.destroy();
    });

    test.each([
        ['provider-category segment of the event id', '20261001-11-7', editUrl(11, 7)],
        ['eid segment of the event id (data-eid unchanged)', '20261001-13-0', editUrl(13, 0)]
    ])('changed %s: first click is not routed; the next click routes the refreshed booking', (_name, id, url) => {
        const ctl = setup();
        node(11).id = id;
        press('open-booking');
        expect(window.dlgopen).not.toHaveBeenCalled();
        press('open-booking');
        expect(window.dlgopen).toHaveBeenCalledTimes(1);
        expect(window.dlgopen).toHaveBeenCalledWith(url, '_blank', 780, 650);
        ctl.destroy();
    });

    test('becoming a group booking: first click is not routed; the next click opens the group editor', () => {
        const ctl = setup();
        node(11).classList.add('groups');
        press('open-booking');
        expect(window.dlgopen).not.toHaveBeenCalled();
        press('open-booking');
        expect(window.dlgopen).toHaveBeenCalledWith(groupUrl(11, 0), '_blank', 780, 675);
        ctl.destroy();
    });

    test('changed executable href behind the same data-pid: first click is not routed', async () => {
        const ctl = setup();
        node(11).querySelector('a.link_title').setAttribute('href', 'javascript:goPid("2")');
        press('open-patient');
        await settle();
        expect(window.RTop.location).toBe('');
        press('open-patient');
        await settle();
        expect(window.RTop.location).toBe('../../patient_file/summary/demographics.php?set_pid=2');
        ctl.destroy();
    });

    test('changed data-pid behind the same href: first click is not routed', async () => {
        const ctl = setup();
        node(11).querySelector('a.link_title').setAttribute('data-pid', '2');
        press('open-patient');
        await settle();
        expect(window.RTop.location).toBe('');
        ctl.destroy();
    });
});

describe('day template wiring', () => {
    const tpl = fs.readFileSync(path.join(repo, 'templates/calendar/default/views/day/ajax_template.html.twig'), 'utf8');

    test('surface, assets and original-control markers are present; original handlers kept', () => {
        expect(tpl).toContain('id="oe-calendar-workday"');
        expect(tpl).toContain('clinical-workspace/calendar-workday.js');
        expect(tpl).toContain('clinical-workspace/calendar-workday.css');
        expect(tpl).toMatch(/data-oe-workday-action="new-appointment"[^>]*onclick="newEvt\(1, 9, 00, \{\{ Date\|attr_js \}\}, 0, 0\)"/);
        expect(tpl).toMatch(/data-oe-workday-action="today"[^>]*onclick="GoToToday\(theform\);"/);
        expect(tpl).toContain('{{ event.displayContentHtml|raw }}');
        expect(tpl).not.toMatch(/data-l-(next|none-remaining)=/);
        ['count-one', 'count', 'empty', 'unavailable', 'first', 'time-unknown'].forEach((key) => {
            expect(tpl).toMatch(new RegExp(`data-l-${key}="[^"]*\\|xla[^"]*"`));
        });
    });
});
