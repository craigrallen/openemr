/* Inert, injected browser speech adapter. No clinical editor mounts this module. */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else if (root) root.OpenEMRLocalDictation = api;
}(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    const MESSAGES = Object.freeze({
        unavailable: 'Local dictation is unavailable.',
        failed: 'Local dictation failed.',
        disposed: 'Local dictation has been disposed.'
    });

    function validLanguage(lang) {
        if (typeof lang !== 'string' || !lang || !/^[A-Za-z0-9-]+$/.test(lang)) return false;
        try {
            return Intl.getCanonicalLocales(lang).length === 1;
        } catch (_) {
            return false;
        }
    }

    function supported(options) {
        const Recognition = options.Recognition;
        try {
            return options.secureContext === true &&
                typeof Recognition === 'function' &&
                typeof Recognition.available === 'function' &&
                Recognition.prototype != null &&
                'processLocally' in Recognition.prototype &&
                validLanguage(options.lang) &&
                typeof options.onDraft === 'function' &&
                typeof options.onState === 'function';
        } catch (_) {
            return false;
        }
    }

    function createLocalDictation(options) {
        let config;
        try {
            const supplied = options || {};
            config = Object.freeze({
                Recognition: supplied.Recognition,
                secureContext: supplied.secureContext,
                lang: supplied.lang,
                onDraft: supplied.onDraft,
                onState: supplied.onState
            });
        } catch (_) {
            config = Object.freeze({});
        }
        let disposed = false;
        let session = null;
        let nextToken = 0;

        function current(operation) {
            return !disposed && session === operation && operation.token === nextToken;
        }

        function report(status, message) {
            config.onState(status, message);
        }

        function abortSafely(listener) {
            if (!listener) return;
            try {
                if (typeof listener.abort === 'function') listener.abort();
            } catch (_) {
                // An abort failure must never restore a session or reveal native details.
            }
        }

        function release(operation, abort) {
            if (!current(operation)) return false;
            ++nextToken;
            session = null;
            if (abort) abortSafely(operation.listener);
            return true;
        }

        function fail(operation, message) {
            if (!current(operation)) return false;
            release(operation, true);
            try { report('error', message); } catch (_) { /* Callback failure is contained. */ }
            return true;
        }

        function resultHandler(operation, event) {
            if (!current(operation)) return;
            try {
                const results = event && event.results;
                const index = event && event.resultIndex;
                const length = results && results.length;
                if (!Number.isSafeInteger(index) || !Number.isSafeInteger(length) ||
                    index < 0 || length < 0 || index > length || length > 10000) return;
                for (let i = index; i < length && current(operation); ++i) {
                    if (operation.delivered.has(i)) continue;
                    let entry;
                    let alternative;
                    let transcript;
                    try {
                        entry = results[i];
                        if (!entry || entry.isFinal !== true ||
                            !Number.isSafeInteger(entry.length) || entry.length < 1) continue;
                        alternative = entry[0];
                        transcript = alternative && alternative.transcript;
                        if (typeof transcript !== 'string') continue;
                    } catch (_) {
                        continue;
                    }
                    if (!current(operation)) return;
                    operation.delivered.add(i);
                    try {
                        config.onDraft(transcript);
                    } catch (_) {
                        fail(operation, MESSAGES.failed);
                        return;
                    }
                }
            } catch (_) {
                // Invalid native event shapes carry no usable transcript.
            }
        }

        async function start() {
            if (disposed) throw new Error(MESSAGES.disposed);
            if (session) return false;
            if (!supported(config)) throw new Error(MESSAGES.unavailable);

            const operation = { token: ++nextToken, listener: null, delivered: new Set() };
            session = operation;
            let failureMessage = MESSAGES.failed;
            try {
                report('checking', 'Checking local dictation availability.');
                if (!current(operation)) return false;

                const availability = await config.Recognition.available({
                    langs: [config.lang], processLocally: true
                });
                if (!current(operation)) return false;
                if (availability !== 'available' || !supported(config)) {
                    failureMessage = MESSAGES.unavailable;
                    throw new Error(MESSAGES.unavailable);
                }

                const listener = new config.Recognition();
                if (!current(operation)) {
                    abortSafely(listener);
                    return false;
                }
                operation.listener = listener;
                listener.lang = config.lang;
                if (!current(operation)) return false;
                listener.processLocally = true;
                if (!current(operation)) return false;
                listener.interimResults = false;
                if (!current(operation)) return false;

                listener.onresult = (event) => resultHandler(operation, event);
                if (!current(operation)) return false;
                listener.onerror = () => { fail(operation, MESSAGES.failed); };
                if (!current(operation)) return false;
                listener.onend = () => {
                    if (!release(operation, false)) return;
                    try { report('ended', 'Local dictation ended.'); } catch (_) { /* Contained. */ }
                };
                if (!current(operation)) return false;

                if (listener.lang !== config.lang || listener.processLocally !== true) {
                    failureMessage = MESSAGES.unavailable;
                    throw new Error(MESSAGES.unavailable);
                }
                report('listening', 'Local dictation listening.');
                if (!current(operation)) return false;
                // Recheck the actual instance after the callback, immediately before start.
                if (listener.lang !== config.lang || listener.processLocally !== true) {
                    failureMessage = MESSAGES.unavailable;
                    throw new Error(MESSAGES.unavailable);
                }
                if (!current(operation)) return false;
                listener.start();
                return current(operation);
            } catch (_) {
                if (!current(operation)) return false;
                fail(operation, failureMessage);
                throw new Error(failureMessage);
            }
        }

        function cancel() {
            const operation = session;
            if (!operation) return false;
            release(operation, true);
            try { report('cancelled', 'Local dictation cancelled.'); } catch (_) { /* Contained. */ }
            return true;
        }

        function dispose() {
            if (disposed) return;
            const operation = session;
            disposed = true;
            ++nextToken;
            session = null;
            if (operation) abortSafely(operation.listener);
        }

        return { start, cancel, dispose };
    }

    return { createLocalDictation };
}));
