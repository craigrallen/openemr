/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const helperSource = fs.readFileSync(path.join(root, 'src/PostCalendar/ViewModel/CalendarViewModel.php'), 'utf8');
const template = fs.readFileSync(path.join(root, 'templates/calendar/default/views/_calendar_screen_js.html.twig'), 'utf8');

// This is a bounded source-JS seam, not a PHP/Twig render. It removes only Twig
// comments and supplies the known values of this shared template's expressions.
const twigValues = new Map([
    ['webroot', '/oe'],
    ["timeslotCss|default('20px')|js_escape", '"20px"'],
    ['timeslotHeightVal|default(20)', '20'],
    ["isHolidayDay|default(false) ? 'true' : 'false'", 'false'],
    ['webroot|js_escape', '"/oe"'],
    ["viewtype|default('day')|js_escape", '"day"'],
    ["Date|default('')|js_escape", '"20261001"'],
    ['calendarSidebarVersion|attr_url', '1']
]);

function inlineScripts() {
    const source = template.replace(/\{#[\s\S]*?#\}/g, '');
    const substituted = source.replace(/\{\{\s*([^{}]*?)\s*\}\}/g, (_match, expression) => {
        if (!twigValues.has(expression)) throw new Error(`Unexpected Twig expression: ${expression}`);
        return twigValues.get(expression);
    });
    if (substituted.includes('{{') || substituted.includes('{%')) throw new Error('Unresolved Twig syntax');
    return [...substituted.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
        .map((match) => match[1]);
}

function nativeAnchor(time) {
    // Fixture follows the exact emitted helper contract; it is not a native
    // PHP render. The separate PHP test calls eventTimeAnchorHtml itself.
    expect(helperSource).toContain('public static function eventTimeAnchorHtml(string $displayTime): string');
    expect(helperSource).toContain('"<a class=\'event_time\' onclick=\'event_time_click(this)\' title=\'"');
    expect(helperSource).toContain('. xla(\'Click to edit\') . "\'>" . text($displayTime) . "</a>"');
    return `<a class="event_time" onclick="event_time_click(this)" title="Click to edit">${time}</a>`;
}

function booking(id, time = '10:00', classes = 'event_appointment event') {
    return `<div class="${classes}" id="${id}"><span class="appointment">${nativeAnchor(time)}</span></div>`;
}

const key = (element, value, options = {}) => {
    const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options });
    element.dispatchEvent(event);
    return event;
};

describe('original calendar event time editor access', () => {
    let individual;
    let group;
    let other;
    let linked;
    let nestedLink;
    let nestedButton;

    beforeAll(async () => {
        window.$ = window.jQuery = require('jquery'); // repository-pinned jQuery
        window.dlgopen = jest.fn();
        window.restoreSession = jest.fn();

        document.body.innerHTML = `<div id="bigCal">
            ${booking('20261001-71-3', '10:00')}
            ${booking('20261002-82-4', '11:30', 'event_appointment event groups')}
            <div class="event_out event" id="20261003-91-5">${nativeAnchor('12:00')}</div>
            <div class="event_appointment event" id="20261004-92-6">
                <a class="event_time" href="#existing" title="Existing link">13:00</a>
                <a href="#patient" class="patient">Patient</a>
                <button type="button">Details</button>
            </div>
            <div class="event_appointment event" id="20261005-93-7"><span>14:00</span></div>
            <a class="event_time" onclick="event_time_click(this)">15:00</a>
        </div>`;

        // Execute every original inline block, including its real jQuery ready
        // callback and EditEvent route. External src scripts have no inline body.
        for (const script of inlineScripts()) window.eval(script);
        await new Promise((resolve) => window.$(resolve));

        [individual, group, other, linked] = document.querySelectorAll('#bigCal a.event_time');
        nestedLink = document.querySelector('a.patient');
        nestedButton = document.querySelector('button');

        // jsdom does not execute HTML inline onclick attributes in Jest's default
        // environment. Compile each fixture's exact attribute as its click handler.
        for (const anchor of [individual, group, other]) {
            anchor.onclick = new window.Function(anchor.getAttribute('onclick'));
        }
    });

    beforeEach(() => {
        window.dlgopen.mockClear();
        window.restoreSession.mockClear();
    });

    test('each native appointment time is a focusable button without altering text or title', () => {
        for (const anchor of [individual, group]) {
            expect(anchor.getAttribute('tabindex')).toBe('0');
            expect(anchor.getAttribute('role')).toBe('button');
            expect(anchor.hasAttribute('href')).toBe(false);
            expect(anchor.getAttribute('title')).toBe('Click to edit');
        }
        expect(individual.textContent).toBe('10:00');
        expect(group.textContent).toBe('11:30');
        expect(individual.getAttribute('onclick')).toBe('event_time_click(this)');
    });

    test.each(['Enter', ' '])('%s opens the individual editor once through the native route', (pressed) => {
        const event = key(individual, pressed);
        expect(event.defaultPrevented).toBe(true);
        expect(window.dlgopen).toHaveBeenCalledTimes(1);
        expect(window.dlgopen).toHaveBeenCalledWith(
            'add_edit_event.php?date=20261001&eid=71&prov=3', '_blank', 780, 650
        );
        expect(window.restoreSession).not.toHaveBeenCalled();
    });

    test.each(['Enter', ' '])('%s opens the group editor once and restores the session', (pressed) => {
        const event = key(group, pressed);
        expect(event.defaultPrevented).toBe(true);
        expect(window.restoreSession).toHaveBeenCalledTimes(1);
        expect(window.dlgopen).toHaveBeenCalledTimes(1);
        expect(window.dlgopen).toHaveBeenCalledWith(
            'add_edit_event.php?group=true&date=20261002&eid=82&prov=4', '_blank', 780, 675
        );
    });

    test('repeat, modifiers, and unrelated keys are not intercepted', () => {
        const rejected = [
            ['Enter', { repeat: true }], [' ', { repeat: true }],
            ...['ctrlKey', 'altKey', 'metaKey', 'shiftKey'].flatMap((modifier) => [
                ['Enter', { [modifier]: true }], [' ', { [modifier]: true }]
            ]),
            ['Escape', {}], ['Tab', {}], ['a', {}]
        ];
        for (const [pressed, options] of rejected) {
            expect(key(individual, pressed, options).defaultPrevented).toBe(false);
        }
        expect(window.dlgopen).not.toHaveBeenCalled();
    });

    test('existing click and event double click keep their original one-call behavior', () => {
        individual.click();
        expect(window.dlgopen).toHaveBeenCalledTimes(1);
        expect(window.dlgopen).toHaveBeenLastCalledWith(
            'add_edit_event.php?date=20261001&eid=71&prov=3', '_blank', 780, 650
        );
        window.dlgopen.mockClear();
        document.getElementById('20261001-71-3').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(window.dlgopen).toHaveBeenCalledTimes(1);
    });

    test('non-booking anchors, native links, and nested controls retain their behavior', () => {
        const outside = document.querySelectorAll('#bigCal a.event_time')[4];
        for (const anchor of [other, linked, outside, nestedLink]) {
            expect(anchor.hasAttribute('tabindex')).toBe(false);
            expect(anchor.hasAttribute('role')).toBe(false);
            expect(key(anchor, 'Enter').defaultPrevented).toBe(false);
            expect(key(anchor, ' ').defaultPrevented).toBe(false);
        }
        expect(nestedButton.hasAttribute('role')).toBe(false);
        expect(key(nestedButton, 'Enter').defaultPrevented).toBe(false);
        expect(linked.getAttribute('href')).toBe('#existing');
        expect(window.dlgopen).not.toHaveBeenCalled();
    });

    test('an empty grid is inert and remains empty', () => {
        const empty = document.createElement('div');
        empty.id = 'empty-calendar-grid';
        document.body.appendChild(empty);
        expect(key(empty, 'Enter').defaultPrevented).toBe(false);
        expect(empty.children).toHaveLength(0);
        expect(window.dlgopen).not.toHaveBeenCalled();
        empty.remove();
    });
});
