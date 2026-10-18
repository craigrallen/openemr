# Local dictation foundation (OPEMR-39)

`interface/clinical-workspace/local-dictation.js` exports `createLocalDictation` through CommonJS. A browser script can access the same factory at `window.OpenEMRLocalDictation.createLocalDictation`. Importing the module does not mount a control, look up a browser speech API, start recognition, or touch a clinical note. No consultation UI consumes it yet. This is a partial foundation for the original request, not working consultation speech to text.

## Interface

The caller supplies `{ Recognition, secureContext, lang, onDraft, onState }`. `Recognition` must be the standard `SpeechRecognition` constructor supplied by a future integration; this module does not discover it or accept a prefixed substitute. `secureContext` must be the literal `true`. `lang` must be a valid BCP 47 language tag; its supplied spelling is passed unchanged. Both callbacks are required.

The returned object has `async start()`, `cancel()`, and `dispose()`:

- `start()` checks the injected standard API, its `available` method, and prototype support for `processLocally` before construction. It requests `Recognition.available({ langs: [lang], processLocally: true })`, accepts only the literal result `available`, sets `processLocally = true` on the instance, and checks that the instance still reads as the literal `true` immediately before `start()`. It rejects with a fixed, sanitized error when support, availability, a callback, construction, or native start fails. A call made while an operation is pending or listening resolves `false` without another listener. A call invalidated by cancellation or disposal resolves `false`.
- `cancel()` invalidates the session and calls native `abort()` when a listener exists. It never calls `stop()`. It returns whether a session was active. A later explicit `start()` may create a fresh session.
- `dispose()` invalidates pending work, aborts an existing listener, and permanently disables `start()`. Repeated disposal is safe.

`onState(status, message)` receives fixed strings only. Statuses are `checking` (`Checking local dictation availability.`), `listening` (`Local dictation listening.`), `cancelled` (`Local dictation cancelled.`), `ended` (`Local dictation ended.`), and `error` (`Local dictation is unavailable.` or `Local dictation failed.`). Rejected errors use those same fixed failure messages, or `Local dictation has been disposed.` Native error fields and exception text are never exposed. A failed state callback terminates a session; exceptions from terminal state callbacks are contained.

`onDraft(text)` receives the exact transcript string from each valid final result index once per session. Interim, duplicate, stale, and malformed results are ignored. The module does not trim, normalize, insert, persist, or clinically interpret text. A throwing draft callback invalidates the session and aborts the listener. There is no automatic restart.

## Limits and required integration

Only an already available local language pack is eligible. A downloadable, downloading, unknown, or unsupported result is unavailable. There is no pack installation and no remote fallback. This browser API contract is a gate, not proof of native browser transport behavior or a transport attestation. The adapter itself makes no transport, media, storage, or logging calls.

Before clinical use, a protected editor integration must enforce patient and encounter context, ACL and encounter permissions, draft review eligibility, and explicit clinician review before insertion or save. It also needs native browser transport proof, microphone consent and disclosure, locale support decisions, and clinical acceptance testing. No consumer or clinical UI is included here.

The synthetic Jest suite in `tests/js/clinical-local-dictation.test.js` defines the expected behavior. An independent Gemini4ArgonHigh review of the bounded three-file contract returned substantive feedback with no denied actions or P1/P2 findings; its P3 test gaps are addressed in the suite. The added assertions have not been executed in this workspace session. Hosted GREEN verification and native browser acceptance remain pending.
