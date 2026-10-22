/**
 * @jest-environment jsdom
 */
/* global __dirname */

const fs = require('fs');
const path = require('path');
const { createLocalDictation } = require('../../interface/clinical-workspace/local-dictation.js');

const modulePath = path.join(__dirname, '../../interface/clinical-workspace/local-dictation.js');

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function fakeRecognition() {
    const instances = [];
    class Recognition {
        constructor() {
            this.start = jest.fn();
            this.abort = jest.fn();
            this.stop = jest.fn();
            instances.push(this);
        }
    }
    Recognition.prototype.processLocally = false;
    Recognition.available = jest.fn().mockResolvedValue('available');
    return { Recognition, instances };
}

function harness(overrides = {}) {
    const fake = fakeRecognition();
    const onDraft = jest.fn();
    const onState = jest.fn();
    const options = {
        Recognition: fake.Recognition,
        secureContext: true,
        lang: 'sv-SE',
        onDraft,
        onState,
        ...overrides
    };
    return { ...fake, onDraft: options.onDraft, onState: options.onState, options, adapter: createLocalDictation(options) };
}

function result(transcript, isFinal = true) {
    return { isFinal, 0: { transcript }, length: 1 };
}

function emitResults(listener, entries, resultIndex = 0) {
    listener.onresult({ results: entries, resultIndex });
}

describe('local dictation privacy gate', () => {
    test('import is inert, including when browser globals advertise speech and transport APIs', () => {
        const original = {
            SpeechRecognition: globalThis.SpeechRecognition,
            webkitSpeechRecognition: globalThis.webkitSpeechRecognition,
            fetch: globalThis.fetch,
            mediaDevices: navigator.mediaDevices
        };
        const browserSpeech = jest.fn();
        const prefixedSpeech = jest.fn();
        const fetch = jest.fn();
        const getUserMedia = jest.fn();
        try {
            globalThis.SpeechRecognition = browserSpeech;
            globalThis.webkitSpeechRecognition = prefixedSpeech;
            globalThis.fetch = fetch;
            Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
            jest.isolateModules(() => {
                const loaded = require('../../interface/clinical-workspace/local-dictation.js');
                expect(typeof loaded.createLocalDictation).toBe('function');
            });
            expect(browserSpeech).not.toHaveBeenCalled();
            expect(prefixedSpeech).not.toHaveBeenCalled();
            expect(fetch).not.toHaveBeenCalled();
            expect(getUserMedia).not.toHaveBeenCalled();
        } finally {
            globalThis.SpeechRecognition = original.SpeechRecognition;
            globalThis.webkitSpeechRecognition = original.webkitSpeechRecognition;
            globalThis.fetch = original.fetch;
            Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: original.mediaDevices });
        }
    });

    test('source has no transport, microphone, recorder, prefixed recognition or pack install calls', () => {
        const source = fs.readFileSync(modulePath, 'utf8');
        expect(source).not.toMatch(/\bwebkitSpeechRecognition\b|\bMediaRecorder\b|\bgetUserMedia\s*\(/);
        expect(source).not.toMatch(/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bsendBeacon\s*\(/);
        expect(source).not.toMatch(/\binstall\s*\(|\binstallLanguagePack\s*\(/);
        expect(source).not.toMatch(/\b(?:localStorage|sessionStorage|indexedDB)\b|\bconsole\s*\./);
    });

    test.each([
        ['insecure context', { secureContext: false }],
        ['missing standard API', { Recognition: undefined }],
        ['missing availability API', { Recognition: class Recognition {} }]
    ])('%s never constructs or starts', async (label, override) => {
        const fake = fakeRecognition();
        const onDraft = jest.fn();
        const onState = jest.fn();
        const adapter = createLocalDictation({
            Recognition: fake.Recognition, secureContext: true, lang: 'sv-SE', onDraft, onState, ...override
        });
        await expect(adapter.start()).rejects.toThrow();
        expect(fake.instances).toHaveLength(0);
        expect(fake.Recognition.available).not.toHaveBeenCalled();
        expect(onDraft).not.toHaveBeenCalled();
    });

    test('missing prototype processLocally fails before availability', async () => {
        const { Recognition, instances } = fakeRecognition();
        delete Recognition.prototype.processLocally;
        const adapter = createLocalDictation({
            Recognition, secureContext: true, lang: 'sv-SE', onDraft: jest.fn(), onState: jest.fn()
        });
        await expect(adapter.start()).rejects.toThrow();
        expect(Recognition.available).not.toHaveBeenCalled();
        expect(instances).toHaveLength(0);
    });

    test.each(['', 'sv_SE', 'en US', 'x', 'en-US<script>', 'en-US,fr-FR', 42, null])(
        'invalid language %p is rejected before availability', async (lang) => {
            const { Recognition, instances } = fakeRecognition();
            let adapter;
            try {
                adapter = createLocalDictation({
                    Recognition, secureContext: true, lang, onDraft: jest.fn(), onState: jest.fn()
                });
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
            }
            if (adapter) await expect(adapter.start()).rejects.toThrow();
            expect(Recognition.available).not.toHaveBeenCalled();
            expect(instances).toHaveLength(0);
        }
    );

    test.each(['onDraft', 'onState'])('missing %s callback is rejected', async (missing) => {
        const { Recognition } = fakeRecognition();
        const options = {
            Recognition, secureContext: true, lang: 'sv-SE', onDraft: jest.fn(), onState: jest.fn()
        };
        delete options[missing];
        let adapter;
        try {
            adapter = createLocalDictation(options);
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
        }
        if (adapter) await expect(adapter.start()).rejects.toThrow();
        expect(Recognition.available).not.toHaveBeenCalled();
    });

    test.each(['downloadable', 'downloading', 'unavailable', null, { status: 'available' }])(
        'availability %p fails closed without construction or install', async (availability) => {
            const { Recognition, instances, adapter } = harness();
            Recognition.available.mockResolvedValue(availability);
            await expect(adapter.start()).rejects.toThrow();
            expect(Recognition.available).toHaveBeenCalledWith({ langs: ['sv-SE'], processLocally: true });
            expect(instances).toHaveLength(0);
        }
    );

    test('rejected availability and synchronous availability exception fail closed', async () => {
        for (const failure of [() => Promise.reject(new Error('private vendor detail')), () => { throw new Error('private vendor detail'); }]) {
            const { Recognition, instances, onState, adapter } = harness();
            Recognition.available.mockImplementation(failure);
            await expect(adapter.start()).rejects.toThrow();
            expect(instances).toHaveLength(0);
            expect(JSON.stringify(onState.mock.calls)).not.toContain('private vendor detail');
        }
    });

    test.each(['sv-SE', 'en-US', 'zh-Hant-TW'])('starts only after exact local availability for %s', async (lang) => {
        const { Recognition, instances, adapter } = harness({ lang });
        expect(instances).toHaveLength(0);
        await adapter.start();
        expect(Recognition.available).toHaveBeenCalledWith({ langs: [lang], processLocally: true });
        expect(instances).toHaveLength(1);
        expect(instances[0].lang).toBe(lang);
        expect(instances[0].processLocally).toBe(true);
        expect(instances[0].start).toHaveBeenCalledTimes(1);
        expect(instances[0].stop).not.toHaveBeenCalled();
        adapter.dispose();
    });

    test('support disappearing during availability prevents construction', async () => {
        const pending = deferred();
        const { Recognition, instances, adapter } = harness();
        Recognition.available.mockReturnValue(pending.promise);
        const starting = adapter.start();
        delete Recognition.prototype.processLocally;
        pending.resolve('available');
        await expect(starting).rejects.toThrow();
        expect(instances).toHaveLength(0);
    });

    test('an instance that cannot retain strict local mode is never started', async () => {
        const { Recognition, instances, adapter } = harness();
        Object.defineProperty(Recognition.prototype, 'processLocally', {
            configurable: true,
            get() { return false; },
            set() {}
        });
        await expect(adapter.start()).rejects.toThrow();
        expect(instances).toHaveLength(1);
        expect(instances[0].start).not.toHaveBeenCalled();
    });

    test('cancellation during construction cannot cross the final start gate', async () => {
        const { Recognition, instances } = fakeRecognition();
        let adapter;
        let cancellation;
        class CancellingRecognition extends Recognition {
            constructor() {
                super();
                cancellation = adapter.cancel();
            }
        }
        adapter = createLocalDictation({
            Recognition: CancellingRecognition,
            secureContext: true,
            lang: 'sv-SE',
            onDraft: jest.fn(),
            onState: jest.fn()
        });
        await expect(adapter.start()).resolves.toBe(false);
        expect(cancellation).toBe(true);
        expect(instances).toHaveLength(1);
        expect(instances[0].start).not.toHaveBeenCalled();
        expect(instances[0].abort).toHaveBeenCalledTimes(1);
        expect(adapter.cancel()).toBe(false);
    });

    test('synchronous constructor and start exceptions are contained and sanitized', async () => {
        const badConstructor = class Recognition {
            constructor() { throw new Error('private constructor detail'); }
        };
        badConstructor.prototype.processLocally = false;
        badConstructor.available = jest.fn().mockResolvedValue('available');
        const onState = jest.fn();
        const options = { Recognition: badConstructor, secureContext: true, lang: 'sv-SE', onDraft: jest.fn(), onState };
        await expect(createLocalDictation(options).start()).rejects.toThrow(/^Local dictation failed\.$/);
        expect(JSON.stringify(onState.mock.calls)).not.toContain('private constructor detail');

        const { Recognition, instances } = harness();
        // The fake constructor assigns start per instance, so replace it at construction time.
        const Original = Recognition;
        class ThrowsOnStart extends Original {
            constructor() {
                super();
                this.start = jest.fn(() => { throw new Error('private start detail'); });
            }
        }
        ThrowsOnStart.available = Recognition.available;
        const startState = jest.fn();
        const failing = createLocalDictation({
            Recognition: ThrowsOnStart, secureContext: true, lang: 'sv-SE', onDraft: jest.fn(), onState: startState
        });
        await expect(failing.start()).rejects.toThrow(/^Local dictation failed\.$/);
        expect(instances).toHaveLength(1);
        expect(instances[0].abort).toHaveBeenCalled();
        expect(JSON.stringify(startState.mock.calls)).not.toContain('private start detail');
    });

    test.each(['cancel', 'dispose'])('onState checking can %s before availability', async (action) => {
        let adapter;
        const onState = jest.fn((status) => {
            if (status === 'checking') adapter[action]();
        });
        const setup = harness({ onState });
        adapter = setup.adapter;
        await expect(adapter.start()).resolves.toBe(false);
        expect(setup.Recognition.available).not.toHaveBeenCalled();
        expect(setup.instances).toHaveLength(0);
        if (action === 'cancel') expect(adapter.cancel()).toBe(false);
        else await expect(adapter.start()).rejects.toThrow('Local dictation has been disposed.');
    });

    test.each(['cancel', 'dispose'])('onState listening can %s before native start', async (action) => {
        let adapter;
        const onState = jest.fn((status) => {
            if (status === 'listening') adapter[action]();
        });
        const setup = harness({ onState });
        adapter = setup.adapter;
        await expect(adapter.start()).resolves.toBe(false);
        expect(setup.instances).toHaveLength(1);
        expect(setup.instances[0].abort).toHaveBeenCalledTimes(1);
        expect(setup.instances[0].start).not.toHaveBeenCalled();
        if (action === 'cancel') expect(adapter.cancel()).toBe(false);
        else await expect(adapter.start()).rejects.toThrow('Local dictation has been disposed.');
    });

    test('onState listening cannot disable instance local mode before native start', async () => {
        let instances;
        const onState = jest.fn((status) => {
            if (status === 'listening') instances[0].processLocally = false;
        });
        const setup = harness({ onState });
        instances = setup.instances;
        await expect(setup.adapter.start()).rejects.toThrow('Local dictation is unavailable.');
        expect(instances).toHaveLength(1);
        expect(instances[0].start).not.toHaveBeenCalled();
        expect(instances[0].abort).toHaveBeenCalledTimes(1);
    });
});

describe('local dictation session lifecycle and drafts', () => {
    test('interim results are ignored; each final index is delivered once with exact text', async () => {
        const { instances, onDraft, adapter } = harness();
        await adapter.start();
        const listener = instances[0];
        const entries = [result('interim', false), result('  BP 120/80\n<unchanged>  '), result('assessment & plan')];
        emitResults(listener, entries);
        emitResults(listener, entries);
        emitResults(listener, entries, 1);
        expect(onDraft.mock.calls).toEqual([['  BP 120/80\n<unchanged>  '], ['assessment & plan']]);
        adapter.dispose();
    });

    test('final index is delivered only once even when interim becomes final and events repeat', async () => {
        const { instances, onDraft, adapter } = harness();
        await adapter.start();
        const listener = instances[0];
        emitResults(listener, [result('draft', false)]);
        emitResults(listener, [result('final')]);
        emitResults(listener, [result('final')]);
        expect(onDraft.mock.calls).toEqual([['final']]);
        adapter.dispose();
    });

    test('malformed result entries cannot deliver non-string or interim drafts', async () => {
        const { instances, onDraft, adapter } = harness();
        await adapter.start();
        const listener = instances[0];
        expect(() => emitResults(listener, [null, {}, { isFinal: true }, result(5), result('valid')])).not.toThrow();
        expect(onDraft.mock.calls).toEqual([['valid']]);
        adapter.dispose();
    });

    test('malformed events, indexes and lengths are ignored without losing later valid drafts', async () => {
        const { instances, onDraft, adapter } = harness();
        await adapter.start();
        const listener = instances[0];
        const throwingResults = Object.defineProperty({}, 'results', {
            get() { throw new Error('private results detail'); }
        });
        const throwingIndex = Object.defineProperty({ results: [result('hidden')] }, 'resultIndex', {
            get() { throw new Error('private index detail'); }
        });
        const throwingLength = Object.defineProperty({}, 'length', {
            get() { throw new Error('private length detail'); }
        });
        const invalid = [
            null, throwingResults, throwingIndex,
            { results: throwingLength, resultIndex: 0 },
            { results: [result('hidden')], resultIndex: -1 },
            { results: [result('hidden')], resultIndex: 1.5 },
            { results: [result('hidden')], resultIndex: NaN },
            { results: [result('hidden')], resultIndex: 2 },
            { results: { length: -1 }, resultIndex: 0 },
            { results: { length: 1.5 }, resultIndex: 0 },
            { results: { length: 10001 }, resultIndex: 0 }
        ];
        for (const event of invalid) expect(() => listener.onresult(event)).not.toThrow();
        expect(onDraft).not.toHaveBeenCalled();
        emitResults(listener, [result('valid')]);
        expect(onDraft.mock.calls).toEqual([['valid']]);
        adapter.dispose();
    });

    test('throwing result entry getters are skipped and later final indexes still deliver', async () => {
        const { instances, onDraft, adapter } = harness();
        await adapter.start();
        const listener = instances[0];
        const entries = [result('hidden'), result('hidden'), result('hidden'), result('hidden'), result('hidden'), result('valid')];
        Object.defineProperty(entries, 0, { get() { throw new Error('private entry detail'); } });
        entries[1] = Object.defineProperty({}, 'isFinal', {
            get() { throw new Error('private final detail'); }
        });
        entries[2] = Object.defineProperty({ isFinal: true }, 'length', {
            get() { throw new Error('private entry length detail'); }
        });
        entries[3] = Object.defineProperty({ isFinal: true, length: 1 }, 0, {
            get() { throw new Error('private alternative detail'); }
        });
        entries[4] = { isFinal: true, length: 1, 0: Object.defineProperty({}, 'transcript', {
            get() { throw new Error('private transcript detail'); }
        }) };
        expect(() => emitResults(listener, entries)).not.toThrow();
        expect(onDraft.mock.calls).toEqual([['valid']]);
        adapter.dispose();
    });

    test('a second explicit start while availability is pending or listening never opens a second listener', async () => {
        const pending = deferred();
        const { Recognition, instances, adapter } = harness();
        Recognition.available.mockReturnValue(pending.promise);
        const first = adapter.start();
        const second = adapter.start();
        expect(Recognition.available).toHaveBeenCalledTimes(1);
        pending.resolve('available');
        await first;
        await expect(second).resolves.toBe(false);
        await expect(adapter.start()).resolves.toBe(false);
        expect(instances).toHaveLength(1);
        expect(instances[0].start).toHaveBeenCalledTimes(1);
        adapter.dispose();
    });

    test('cancel during availability invalidates the pending start and permits a fresh explicit start', async () => {
        const pending = deferred();
        const { Recognition, instances, adapter } = harness();
        Recognition.available.mockReturnValueOnce(pending.promise).mockResolvedValueOnce('available');
        const first = adapter.start();
        adapter.cancel();
        const second = adapter.start();
        pending.resolve('available');
        await expect(first).resolves.toBe(false);
        await second;
        expect(instances).toHaveLength(1);
        expect(instances[0].start).toHaveBeenCalledTimes(1);
        adapter.dispose();
    });

    test('cancel after start aborts and discards late results, errors and end', async () => {
        const { instances, onDraft, onState, adapter } = harness();
        await adapter.start();
        const old = instances[0];
        const oldCallbacks = { result: old.onresult, error: old.onerror, end: old.onend };
        adapter.cancel();
        expect(old.abort).toHaveBeenCalledTimes(1);
        expect(old.stop).not.toHaveBeenCalled();
        const stateCount = onState.mock.calls.length;
        oldCallbacks.result({ results: [result('private dictated text')], resultIndex: 0 });
        oldCallbacks.error({ error: 'private device detail' });
        oldCallbacks.end();
        expect(onDraft).not.toHaveBeenCalled();
        expect(onState.mock.calls).toHaveLength(stateCount);
    });

    test.each(['cancel', 'dispose', 'restart'])('onDraft %s stops the old result loop', async (action) => {
        let adapter;
        let nextStart;
        const onDraft = jest.fn(() => {
            if (onDraft.mock.calls.length !== 1) return;
            if (action === 'restart') {
                expect(adapter.cancel()).toBe(true);
                nextStart = adapter.start();
            } else {
                adapter[action]();
            }
        });
        const setup = harness({ onDraft });
        adapter = setup.adapter;
        await adapter.start();
        const old = setup.instances[0];
        const callbacks = { result: old.onresult, error: old.onerror, end: old.onend };
        expect(() => emitResults(old, [result('first'), result('stale second')])).not.toThrow();
        expect(onDraft.mock.calls).toEqual([['first']]);
        expect(old.abort).toHaveBeenCalledTimes(1);
        if (action === 'restart') {
            await expect(nextStart).resolves.toBe(true);
            expect(setup.instances).toHaveLength(2);
        }
        const stateCount = setup.onState.mock.calls.length;
        callbacks.result({ results: [result('stale callback')], resultIndex: 0 });
        callbacks.error({ error: 'private stale detail' });
        callbacks.end();
        expect(onDraft.mock.calls).toEqual([['first']]);
        expect(setup.onState.mock.calls).toHaveLength(stateCount);
        if (action === 'restart') {
            expect(setup.instances[1].abort).not.toHaveBeenCalled();
            emitResults(setup.instances[1], [result('current')]);
            expect(onDraft.mock.calls).toEqual([['first'], ['current']]);
            adapter.dispose();
        }
    });

    test.each(['cancel', 'dispose'])('throwing abort during %s still invalidates callbacks', async (action) => {
        const { instances, onDraft, onState, adapter } = harness();
        await adapter.start();
        const listener = instances[0];
        const callbacks = { result: listener.onresult, error: listener.onerror, end: listener.onend };
        listener.abort.mockImplementation(() => { throw new Error('private abort detail'); });
        if (action === 'cancel') {
            expect(() => adapter.cancel()).not.toThrow();
            expect(adapter.cancel()).toBe(false);
        } else {
            expect(() => adapter.dispose()).not.toThrow();
            await expect(adapter.start()).rejects.toThrow('Local dictation has been disposed.');
        }
        expect(listener.abort).toHaveBeenCalledTimes(1);
        const stateCount = onState.mock.calls.length;
        callbacks.result({ results: [result('stale')], resultIndex: 0 });
        callbacks.error({ error: 'private native detail' });
        callbacks.end();
        expect(onDraft).not.toHaveBeenCalled();
        expect(onState.mock.calls).toHaveLength(stateCount);
        expect(JSON.stringify(onState.mock.calls)).not.toContain('private abort detail');
    });

    test('late callbacks from an old recognition cannot affect a newer session', async () => {
        const { instances, onDraft, onState, adapter } = harness();
        await adapter.start();
        const old = instances[0];
        const oldCallbacks = { result: old.onresult, error: old.onerror, end: old.onend };
        adapter.cancel();
        await adapter.start();
        const current = instances[1];
        const stateCount = onState.mock.calls.length;
        oldCallbacks.result({ results: [result('stale')], resultIndex: 0 });
        oldCallbacks.error({ error: 'stale private error' });
        oldCallbacks.end();
        expect(onDraft).not.toHaveBeenCalled();
        expect(onState.mock.calls).toHaveLength(stateCount);
        expect(current.abort).not.toHaveBeenCalled();
        emitResults(current, [result('current')]);
        expect(onDraft.mock.calls).toEqual([['current']]);
        adapter.dispose();
    });

    test.each(['onerror', 'onend'])('%s releases listener without automatic restart', async (eventName) => {
        const { Recognition, instances, onDraft, onState, adapter } = harness();
        await adapter.start();
        const listener = instances[0];
        const lateResult = listener.onresult;
        if (eventName === 'onerror') listener.onerror({ error: 'private device detail', message: 'private message' });
        else listener.onend();
        lateResult({ results: [result('late')], resultIndex: 0 });
        expect(onDraft).not.toHaveBeenCalled();
        expect(Recognition.available).toHaveBeenCalledTimes(1);
        expect(listener.start).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(onState.mock.calls)).not.toMatch(/private device detail|private message/);
    });

    test('draft callback failure aborts and cannot leave an active listener', async () => {
        const onDraft = jest.fn(() => { throw new Error('private draft detail'); });
        const { instances, onState, adapter } = harness({ onDraft });
        await adapter.start();
        const listener = instances[0];
        const lateResult = listener.onresult;
        expect(() => emitResults(listener, [result('first'), result('second')])).not.toThrow();
        expect(listener.abort).toHaveBeenCalledTimes(1);
        expect(listener.stop).not.toHaveBeenCalled();
        lateResult({ results: [result('late')], resultIndex: 0 });
        expect(onDraft).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(onState.mock.calls)).not.toContain('private draft detail');
    });

    test('state callback failure during start aborts and contains the exception', async () => {
        let instances;
        const onState = jest.fn(() => {
            if (instances.length) throw new Error('private state detail');
        });
        const setup = harness({ onState });
        instances = setup.instances;
        const { adapter } = setup;
        await expect(adapter.start()).rejects.toThrow();
        expect(instances).toHaveLength(1);
        expect(instances.every((listener) => listener.abort.mock.calls.length > 0)).toBe(true);
    });

    test('dispose aborts, discards callbacks, invalidates pending work and permanently rejects start', async () => {
        const { instances, onDraft, adapter } = harness();
        await adapter.start();
        const listener = instances[0];
        const lateResult = listener.onresult;
        adapter.dispose();
        expect(listener.abort).toHaveBeenCalledTimes(1);
        expect(listener.stop).not.toHaveBeenCalled();
        lateResult({ results: [result('late')], resultIndex: 0 });
        expect(onDraft).not.toHaveBeenCalled();
        await expect(adapter.start()).rejects.toThrow();

        const pending = deferred();
        const other = harness();
        other.Recognition.available.mockReturnValue(pending.promise);
        const starting = other.adapter.start();
        other.adapter.dispose();
        pending.resolve('available');
        await expect(starting).resolves.toBe(false);
        expect(other.instances).toHaveLength(0);
        await expect(other.adapter.start()).rejects.toThrow();
    });
});
