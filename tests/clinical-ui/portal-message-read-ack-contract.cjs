'use strict';

// Dependency-free contract for the complete native messaging script. The only
// source instrumentation exports existing IIFE bindings into this VM window.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.resolve(__dirname, '../../portal/messaging/js/messages.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const end = '\n})();';
assert.equal(source.endsWith(end + '\n'), true, 'native IIFE ending changed');
const instrumented = source.slice(0, -end.length - 1)
    + '\nwindow.__READ_ACK_CONTRACT__ = { state, readMessage, readAll };'
    + end + '\n';

function message(id, status = 'New') {
    return {
        id, message_status: status, mail_chain: id, body: 'Body', title: 'Title',
        sender_name: 'Sender', recipient_name: 'Recipient', sender_id: 'sender', date: 'today'
    };
}

function fixture(statuses = ['New']) {
    const inbox = statuses.map((status, index) => message(index + 1, status));
    const all = statuses.map((status, index) => message(index + 1, status));
    const sent = statuses.map((status, index) => message(index + 1, status));
    const requests = [];
    const responses = [];
    const errors = [];
    const elements = new Map();
    function element(id) {
        if (!elements.has(id)) {
            elements.set(id, {
                style: {}, classList: { add() {}, remove() {} },
                addEventListener() {}, querySelectorAll() { return []; },
                querySelector() { return null; }, innerHTML: '', textContent: ''
            });
        }
        return elements.get(id);
    }
    const document = {
        addEventListener() {},
        getElementById(id) {
            return ['navInbox', 'navSent', 'navAll', 'navTrash', 'messageListTable',
                'messageDetail', 'inboxToolbar'].includes(id) ? element(id) : null;
        },
        querySelectorAll() { return []; },
        createElement() { return { innerHTML: '', get textContent() { return this.innerHTML.replace(/<[^>]*>/g, ''); } }; }
    };
    // Exercise renderMessageList and renderMessageDetail through the real
    // renderAll; the table has a minimal tbody boundary.
    const tbody = element('tbody');
    element('messageListTable').querySelector = selector => selector === 'tbody' ? tbody : null;
    const window = {
        OE_MESSAGES_CONFIG: {
            inboxItems: inbox, userproper: 'Patient', isPortal: 1,
            isDashboard: false, authrecips: [], csrf: 'csrf-contract',
            strings: { forwardedRe: 'Fwd:', confirmOne: 'Archive?', confirmAll: 'Archive all?',
                sendingToSelf: 'Self?', conversationFrom: 'From', regarding: 'regarding',
                onPrep: 'on', archiveTitle: 'Archive', composeReplyTitle: 'Reply', composeNewTitle: 'Compose' }
        }
    };
    const $ = { param: values => new URLSearchParams(values).toString() };
    const fetch = (url, options) => {
        requests.push({ url, options });
        assert.ok(responses.length, 'unexpected fetch');
        const next = responses.shift();
        return next instanceof Error ? Promise.reject(next) : Promise.resolve({
            ok: next.status >= 200 && next.status < 300,
            status: next.status,
            text: async () => next.body
        });
    };
    vm.runInNewContext(instrumented, {
        window, document, $, fetch, URLSearchParams, DOMPurify: { sanitize: value => value },
        console: { error: (...parts) => errors.push(parts) }
    }, { filename: sourcePath });
    const api = window.__READ_ACK_CONTRACT__;
    api.state.allItems = all;
    api.state.sentItems = sent;
    api.state.filteredItems = inbox.slice();
    api.state.pagedItems = [inbox.slice()];
    return { api, inbox, all, sent, requests, responses, errors, elements };
}

const reply = (body, status = 200) => ({ body, status });
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
function statuses(f) {
    return [f.inbox, f.all, f.sent].map(list => list.map(item => item.message_status));
}
function request(f, index, id) {
    const { url, options } = f.requests[index];
    assert.equal(url, 'handle_note.php');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.deepEqual(Object.fromEntries(new URLSearchParams(options.body)), {
        task: 'setread', noteid: String(id), csrf_token_form: 'csrf-contract'
    });
}
function genericError(f, label, body) {
    assert.equal(f.errors.length, 1, 'expected one handled error');
    assert.equal(f.errors[0][0], label);
    if (body) {
        assert.equal(f.errors[0].slice(1).map(String).join(' ').includes(body), false,
            'response body exposed in error');
    }
}

const cases = [];
function test(name, run) { cases.push({ name, run }); }

test('single exact ok updates each cache and keeps selection', async () => {
    const f = fixture();
    f.responses.push(reply('ok'));
    f.api.readMessage(f.inbox[0]);
    assert.equal(f.api.state.selected, f.inbox[0]);
    await settle();
    assert.deepEqual(statuses(f), [['Read'], ['Read'], ['Read']]);
    assert.equal(f.elements.get('messageDetail').style.display, '');
    request(f, 0, 1);
    assert.equal(f.errors.length, 0);
});

for (const body of ['missing note id', '', '<html>disabled</html>', '{"ok":true}', '"ok"']) {
    test(`single rejects HTTP 200 body ${JSON.stringify(body)}`, async () => {
        const f = fixture();
        f.responses.push(reply(body));
        f.api.readMessage(f.inbox[0]);
        await settle();
        assert.deepEqual(statuses(f), [['New'], ['New'], ['New']]);
        assert.equal(f.api.state.selected, f.inbox[0]);
        assert.equal(f.elements.get('messageDetail').style.display, '');
        genericError(f, 'Error marking message as read:', body);
    });
}

for (const failure of [reply('denied', 403), new Error('network down')]) {
    test(`single handles ${failure instanceof Error ? 'network rejection' : 'HTTP failure'}`, async () => {
        const f = fixture();
        f.responses.push(failure);
        f.api.readMessage(f.inbox[0]);
        await settle();
        assert.deepEqual(statuses(f), [['New'], ['New'], ['New']]);
        assert.equal(f.api.state.selected, f.inbox[0]);
        genericError(f, 'Error marking message as read:', 'denied');
    });
}

test('already Read single and bulk are no-ops', async () => {
    const f = fixture(['Read']);
    f.api.readMessage(f.inbox[0]);
    f.api.readAll();
    await settle();
    assert.equal(f.requests.length, 0);
    assert.deepEqual(statuses(f), [['Read'], ['Read'], ['Read']]);
    assert.equal(f.api.state.selected, f.inbox[0]);
});

test('bulk exact ok updates unread caches only', async () => {
    const f = fixture(['New', 'Read', 'New']);
    f.responses.push(reply('ok'), reply('ok'));
    f.api.readAll();
    await settle();
    assert.deepEqual(statuses(f), [Array(3).fill('Read'), Array(3).fill('Read'), Array(3).fill('Read')]);
    assert.equal(f.requests.length, 2);
    request(f, 0, 1);
    request(f, 1, 3);
    assert.equal(f.errors.length, 0);
});

for (const body of ['missing note id', '', '<html>disabled</html>', '{"ok":true}', '"ok"']) {
    test(`bulk rejects mixed HTTP 200 body ${JSON.stringify(body)}`, async () => {
        const f = fixture(['New', 'New']);
        f.responses.push(reply('ok'), reply(body));
        f.api.readAll();
        await settle();
        assert.deepEqual(statuses(f), [['New', 'New'], ['New', 'New'], ['New', 'New']]);
        assert.equal(f.requests.length, 2);
        genericError(f, 'Error marking all as read:', body);
    });
}

for (const failure of [reply('denied', 403), new Error('network down')]) {
    test(`bulk handles ${failure instanceof Error ? 'network rejection' : 'HTTP failure'}`, async () => {
        const f = fixture(['New', 'New']);
        f.responses.push(reply('ok'), failure);
        f.api.readAll();
        await settle();
        assert.deepEqual(statuses(f), [['New', 'New'], ['New', 'New'], ['New', 'New']]);
        genericError(f, 'Error marking all as read:', 'denied');
    });
}

(async () => {
    let failures = 0;
    let passed = 0;
    const unhandled = [];
    process.on('unhandledRejection', reason => unhandled.push(reason));
    for (const { name, run } of cases) {
        try {
            await run();
            passed++;
            process.stdout.write(`PASS ${name}\n`);
        } catch (error) {
            failures++;
            process.stdout.write(`FAIL ${name}: ${error.message}\n`);
        }
    }
    if (unhandled.length) {
        failures++;
        process.stdout.write(`FAIL ${unhandled.length} unhandled rejection(s)\n`);
    }
    process.stdout.write(`${passed}/${cases.length} contract cases passed\n`);
    if (failures) process.exitCode = 1;
})();
