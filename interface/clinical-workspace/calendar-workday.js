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
                    observer.observe(target, { childList: true, subtree: true });
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
                    providerId: provider.id,
                    providerName: provider.name,
                    startMin: startMinutes(node, timing),
                    timeLabel: cleanText(node.querySelector('a.event_time')),
                    patientLabel: patientLabel(link),
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

        function onClick(event) {
            const trigger = event.target.closest('[data-role]');
            if (!trigger || !surface.contains(trigger) || disposed) return;
            const next = state && state.first;
            switch (trigger.getAttribute('data-role')) {
                case 'open-booking': {
                    const anchor = next && next.node.isConnected ? next.node.querySelector('a.event_time') : null;
                    if (anchor) anchor.click();
                    break;
                }
                case 'open-patient': {
                    const link = next && next.node.isConnected ? bookingLink(next.node) : null;
                    if (link) link.click();
                    break;
                }
                case 'show-booking':
                    if (next && next.node.isConnected && typeof next.node.scrollIntoView === 'function') {
                        next.node.scrollIntoView({ block: 'center', inline: 'nearest' });
                    }
                    break;
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
        // Direct-select drops .apptMarker nodes on every mousemove; only event changes matter.
        const touchesEvent = (records) => !Array.isArray(records) || records.some((record) =>
            [...Array.from(record.addedNodes || []), ...Array.from(record.removedNodes || [])].some((n) =>
                n.nodeType === 1 && (n.classList.contains('event') || (n.querySelector && n.querySelector('.event')))));
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
