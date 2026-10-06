/*
 * Day-screen workday summary: booking count and first booking of the selected day.
 *
 * Read-only over the already-rendered, already-authorized day grid. It never
 * moves, replaces or edits an event node; it never interprets appointment status
 * or comment text (the comment span inside the patient link is dropped from the copied
 * label). Every action delegates to an original control:
 *  - Open booking  -> the event's own a.event_time (onclick event_time_click)
 *  - Open patient  -> the event's own a.link_title / group link
 *  - New/Today     -> the toolbar anchors marked data-oe-workday-action
 *
 * Start minutes are derived exactly as CalendarViewModel::computeEventGeometry
 * places events: top = (start - slotStart) / interval * slotHeight. When the
 * slot metadata is missing or inconsistent, times and the first booking are withheld.
 *
 * Deliberately no "next booking": rendered times are calendar wall-clock minutes and
 * the page carries no calendar timezone or server clock to compare them against, so a
 * browser-clock comparison could mislabel the next patient. That is unfinished work.
 *
 * The surface stays hidden unless every required data-l-* label is present.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && root.document) {
        const start = () => {
            const surface = root.document.getElementById('oe-calendar-workday');
            if (!surface) return;
            api.createWorkdaySummary({
                document: root.document,
                surface,
                observe: (target, callback) => {
                    const observer = new root.MutationObserver(callback);
                    observer.observe(target, {
                        childList: true,
                        subtree: true,
                        characterData: true,
                        attributes: true,
                        attributeOldValue: true,
                        attributeFilter: ['class', 'style', 'id', 'data-eid', 'data-pid', 'href', 'date', 'provider', 'title']
                    });
                    return observer;
                }
            });
        };
        if (root.document.readyState === 'loading') {
            root.document.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
            start();
        }
    }
}(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    const BOOKING_CLASSES = ['event_appointment', 'event_noshow'];
    const PATIENT_LINK = 'a.link_title[data-pid]';
    const GROUP_LINK = 'a[href^="javascript:goGid("]';
    const REQUIRED_LABELS = ['count-one', 'count', 'empty', 'unavailable', 'first', 'time-unknown'];
    // Booking fields compared before an action delegates: what is shown plus what routes it.
    const SNAPSHOT_FIELDS = ['eid', 'nodeId', 'groups', 'providerId', 'providerName', 'startMin',
        'timeLabel', 'patientLabel', 'linkPid', 'linkHref'];
    // The production calendar hover handler toggles event_highlight on every mouseover/mouseout.
    const PRESENTATION_CLASSES = ['event_highlight'];
    const COLUMN_ATTRIBUTES = ['provider', 'date', 'title'];

    function readInt(value) {
        if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) return null;
        return parseInt(value, 10);
    }

    function readTiming(surface) {
        const slotStart = readInt(surface.dataset.slotStartMin);
        const interval = readInt(surface.dataset.slotIntervalMin);
        const height = readInt(surface.dataset.slotHeight);
        if (slotStart === null || interval === null || height === null || interval <= 0 || height <= 0) {
            return null;
        }
        return { slotStart, interval, height };
    }

    function startMinutes(node, timing) {
        if (!timing) return null;
        const match = /^(-?\d+(?:\.\d+)?)px$/.exec((node.style.top || '').trim());
        if (!match) return null;
        const minutes = timing.slotStart + (parseFloat(match[1]) / timing.height) * timing.interval;
        if (!Number.isFinite(minutes) || minutes < 0 || minutes >= 24 * 60) return null;
        return Math.round(minutes);
    }

    function cleanText(node) {
        return node ? node.textContent.replace(/\s+/g, ' ').trim() : '';
    }

    function bookingLink(node) {
        return node.querySelector(PATIENT_LINK) || node.querySelector(GROUP_LINK);
    }

    // Appointment styles >= 4 append the free-text comment as span.text-success inside the
    // link; read a detached copy without it so the comment is never copied or interpreted.
    function patientLabel(link) {
        const copy = link.cloneNode(true);
        copy.querySelectorAll('span.text-success').forEach((span) => span.remove());
        return cleanText(copy).replace(/:\s*\)$/, ')');
    }

    function providerName(td) {
        const header = td.querySelector('.providerheader');
        return cleanText(header) || (td.getAttribute('title') || '').trim();
    }

    function collectSchedule(doc, surface) {
        const date = surface.dataset.date || '';
        const timing = readTiming(surface);
        const columns = Array.from(doc.querySelectorAll('#bigCal td.schedule[provider]'))
            .filter((td) => (td.getAttribute('date') || '') === date);

        const state = {
            status: 'unavailable',
            date,
            timing: timing ? 'derived' : 'unknown',
            providers: [],
            bookings: [],
            first: null
        };
        if (!date || columns.length === 0) return state;

        const seen = new Set();
        let order = 0;
        columns.forEach((td, columnIndex) => {
            const provider = { id: td.getAttribute('provider') || '', name: providerName(td), count: 0 };
            state.providers.push(provider);
            td.querySelectorAll('.calendar_day > .event').forEach((node) => {
                if (node.classList.contains('in_start')) return;
                if (!BOOKING_CLASSES.some((c) => node.classList.contains(c))) return;
                if (!node.id || node.id.indexOf(date + '-') !== 0) return;
                const link = bookingLink(node);
                if (!link) return;
                const key = provider.id + '|' + node.id;
                if (seen.has(key)) return;
                seen.add(key);
                provider.count += 1;
                state.bookings.push({
                    eid: node.getAttribute('data-eid') || '',
                    // EditEvent routes on the full id (date-eid-category) and the groups class.
                    nodeId: node.id,
                    groups: node.classList.contains('groups'),
                    providerId: provider.id,
                    providerName: provider.name,
                    startMin: startMinutes(node, timing),
                    timeLabel: cleanText(node.querySelector('a.event_time')),
                    patientLabel: patientLabel(link),
                    linkPid: link.getAttribute('data-pid'),
                    linkHref: link.getAttribute('href'),
                    node,
                    columnIndex,
                    order: order++
                });
            });
        });

        state.status = state.bookings.length ? 'ready' : 'empty';
        if (state.bookings.some((b) => b.startMin === null)) {
            state.timing = 'unknown';
            state.bookings.forEach((b) => { b.startMin = null; });
        }
        state.bookings.sort((a, b) => {
            if (a.startMin !== null && b.startMin !== null && a.startMin !== b.startMin) return a.startMin - b.startMin;
            if (a.columnIndex !== b.columnIndex) return a.columnIndex - b.columnIndex;
            return a.order - b.order;
        });

        if (state.timing === 'derived' && state.bookings.length) {
            state.first = state.bookings[0];
        }
        return state;
    }

    function formatTime(minutes) {
        const pad = (n) => String(n).padStart(2, '0');
        return pad(Math.floor(minutes / 60)) + ':' + pad(minutes % 60);
    }

    function createWorkdaySummary({ document: doc, surface, observe }) {
        const role = (name) => surface.querySelector('[data-role="' + name + '"]');
        const original = (action) => doc.querySelector('[data-oe-workday-action="' + action + '"]');
        const label = (key) => surface.getAttribute('data-l-' + key) || '';
        const setText = (name, value) => { const el = role(name); if (el) el.textContent = value; };
        const setShown = (name, shown) => { const el = role(name); if (el) el.hidden = !shown; };
        const labelsReady = REQUIRED_LABELS.every((key) => label(key).trim() !== '');

        let state = null;
        let disposed = false;

        function render() {
            state = collectSchedule(doc, surface);
            if (!labelsReady) {
                surface.hidden = true;
                return;
            }
            const { status, bookings, providers, first } = state;

            if (status === 'unavailable') {
                setText('count', label('unavailable'));
            } else if (status === 'empty') {
                setText('count', label('empty'));
            } else {
                const template = bookings.length === 1 ? label('count-one') : label('count');
                setText('count', template.replace('{count}', String(bookings.length)).replace('{providers}', String(providers.length)));
            }

            let nextLabel = '';
            if (status === 'ready') {
                nextLabel = first ? label('first') : label('time-unknown');
            }
            setShown('next', nextLabel !== '');
            setText('next-label', nextLabel);
            setText('next-time', first ? (first.timeLabel || formatTime(first.startMin)) : '');
            setText('next-provider', first ? first.providerName : '');
            setText('next-patient', first ? first.patientLabel : '');

            setShown('open-booking', !!(first && first.node.querySelector('a.event_time')));
            setShown('open-patient', !!(first && bookingLink(first.node)));
            setShown('show-booking', !!first);
            setShown('new-appointment', !!original('new-appointment'));
            setShown('today', !!original('today'));
            surface.hidden = false;
        }

        // Observer delivery is asynchronous, so a click can land after the grid changed but
        // before the summary re-rendered. Re-read the grid: act only when the booking shown is
        // still the first booking, on the same node, with every snapshotted field unchanged.
        // Otherwise show the fresh summary and do nothing for this click.
        const sameBooking = (a, b) => a.node === b.node && SNAPSHOT_FIELDS.every((key) => a[key] === b[key]);
        function confirmedFirst() {
            const shown = state && state.first;
            const fresh = collectSchedule(doc, surface).first;
            if (shown && fresh && sameBooking(fresh, shown)) return shown;
            render();
            return null;
        }

        function onClick(event) {
            const trigger = event.target.closest('[data-role]');
            if (!trigger || !surface.contains(trigger) || disposed) return;
            switch (trigger.getAttribute('data-role')) {
                case 'open-booking': {
                    const first = confirmedFirst();
                    const anchor = first ? first.node.querySelector('a.event_time') : null;
                    if (anchor) anchor.click();
                    break;
                }
                case 'open-patient': {
                    const first = confirmedFirst();
                    const link = first ? bookingLink(first.node) : null;
                    if (link) link.click();
                    break;
                }
                case 'show-booking': {
                    const first = confirmedFirst();
                    if (first && typeof first.node.scrollIntoView === 'function') {
                        first.node.scrollIntoView({ block: 'center', inline: 'nearest' });
                    }
                    break;
                }
                case 'new-appointment':
                case 'today': {
                    const control = original(trigger.getAttribute('data-role'));
                    if (control) control.click();
                    break;
                }
                default:
                    break;
            }
        }

        surface.addEventListener('click', onClick);
        const grid = doc.getElementById('bigCal');
        // Direct-select (library/js/calendarDirectSelect.js) appends and moves an
        // a.apptMarker.event on every mousemove; it is never a booking, so its churn is ignored.
        // Anything else collectSchedule reads -- event nodes and their text/attributes, column
        // date/provider/title, provider headers -- triggers a re-read, except a class change that
        // only adds/removes presentation classes (hover). render() writes only inside the
        // surface, which sits outside #bigCal, so a refresh cannot re-trigger itself.
        const MARKER = '.apptMarker';
        const classTokens = (value) => new Set((value || '').split(/\s+/).filter(Boolean));
        // Compares the pre-change class list with the current one; within one batch the earliest
        // record for a node still carries any net non-presentation change, so none is lost.
        const presentationOnly = (record, target) => {
            const before = classTokens(record.oldValue);
            const after = classTokens(target.getAttribute('class'));
            return [...before, ...after].every((c) => before.has(c) === after.has(c) || PRESENTATION_CLASSES.includes(c));
        };
        const isWatchedNode = (n) => n.nodeType === 1 && !n.matches(MARKER)
            && (n.matches('.event, .providerheader') || !!n.querySelector('.event:not(' + MARKER + '), .providerheader'));
        const relevant = (record) => {
            const t = record.target;
            const target = t && (t.nodeType === 1 ? t : t.parentElement);
            if (target && target.closest(MARKER)) return false;
            if (record.type === 'attributes') {
                if (record.attributeName === 'class' && presentationOnly(record, target)) return false;
                if (target.closest('.event, .providerheader')) return true;
                // A column that just lost its provider no longer matches [provider]; match on td.schedule.
                return (target.matches('td.schedule') && COLUMN_ATTRIBUTES.includes(record.attributeName))
                    || (record.attributeName === 'class' && classTokens(record.oldValue).has('event'));
            }
            if (target && target.closest('.event, .providerheader')) return true;
            if (record.type === 'characterData') return false;
            // A replaced provider header is reported on its column, so check the moved nodes.
            return [...Array.from(record.addedNodes || []), ...Array.from(record.removedNodes || [])].some(isWatchedNode);
        };
        const touchesEvent = (records) => !Array.isArray(records) || records.some(relevant);
        const observer = observe && grid
            ? observe(grid, (records) => { if (!disposed && touchesEvent(records)) render(); })
            : null;
        render();

        return {
            refresh: render,
            getState: () => state,
            destroy() {
                disposed = true;
                surface.removeEventListener('click', onClick);
                if (observer) observer.disconnect();
                ['count', 'next-label', 'next-time', 'next-provider', 'next-patient'].forEach((name) => setText(name, ''));
                ['next', 'open-booking', 'open-patient', 'show-booking', 'new-appointment', 'today'].forEach((name) => setShown(name, false));
                surface.hidden = true;
                state = null;
            }
        };
    }

    return { createWorkdaySummary, collectSchedule };
}));
