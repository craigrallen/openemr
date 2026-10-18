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
        class CancellingRecognition extends Recognition {
            constructor() {
                super();
                adapter.cancel();
            }
        }
        adapter = createLocalDictation({
            Recognition: CancellingRecognition,
            secureContext: true,
            lang: 'sv-SE',
            onDraft: jest.fn(),
            onState: jest.fn()
        });
        await Promise.resolve(adapter.start()).catch(() => {});
        expect(instances).toHaveLength(1);
        expect(instances[0].start).not.toHaveBeenCalled();
    });

    test('synchronous constructor and start exceptions are contained and sanitized', async () => {
        const badConstructor = class Recognition {
            constructor() { throw new Error('private constructor detail'); }
        };
        badConstructor.prototype.processLocally = false;
        badConstructor.available = jest.fn().mockResolvedValue('available');
        const onState = jest.fn();
        const options = { Recognition: badConstructor, secureContext: true, lang: 'sv-SE', onDraft: jest.fn(), onState };
        await expect(createLocalDictation(options).start()).rejects.toThrow();
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
        const failing = createLocalDictation({
            Recognition: ThrowsOnStart, secureContext: true, lang: 'sv-SE', onDraft: jest.fn(), onState: jest.fn()
        });
        await expect(failing.start()).rejects.toThrow();
        expect(instances).toHaveLength(1);
        expect(instances[0].abort).toHaveBeenCalled();
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

    test('a second explicit start while availability is pending or listening never opens a second listener', async () => {
        const pending = deferred();
        const { Recognition, instances, adapter } = harness();
        Recognition.available.mockReturnValue(pending.promise);
        const first = adapter.start();
        const second = adapter.start();
        expect(Recognition.available).toHaveBeenCalledTimes(1);
        pending.resolve('available');
        await first;
        await Promise.resolve(second).catch(() => {});
        await Promise.resolve(adapter.start()).catch(() => {});
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
        await Promise.resolve(first).catch(() => {});
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
        await Promise.resolve(starting).catch(() => {});
        expect(other.instances).toHaveLength(0);
        await expect(other.adapter.start()).rejects.toThrow();
    });
});
