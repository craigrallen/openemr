# OPEMR-40: AI note review boundary

`interface/clinical-workspace/ai-note-review.js` exports the dependency-free CommonJS function `createAiNoteReview()`. Each call creates an independent, inert, in-memory candidate review. The module does not attach to a browser, generate a note, call a model, collect audio, transmit data, persist a record, log content, or provide save or sign operations. This is synthetic module behavior, not native integration or product acceptance.

## API and lifecycle

| Operation | Result | Effect |
| --- | --- | --- |
| `propose(context, text)` | Opaque ticket or `null` | Cancels any pending candidate before reading `context`. A valid proposal stores a private copy of the four context fields and the exact text at revision `1`. An invalid proposal leaves no candidate. |
| `revise(ticket, text)` | Next integer revision or `false` | Replaces the current ticket's text exactly and increments its revision. Invalid text or an unsafe increment cancels that candidate. A foreign or stale ticket has no effect. |
| `approve(ticket, currentContext, revision, explicitApproval)` | Frozen approved value or `null` | Releases once only when the ticket is current, `revision` exactly equals its current positive integer revision, `explicitApproval === true`, and the newly read context matches all four copied fields. A context mismatch or malformed current context cancels that candidate. Other failed approval attempts do not release text. |
| `reject(ticket)` | `undefined` | Cancels only the current ticket. |
| `dispose()` | `undefined` | Clears the candidate and permanently disables the instance. Repeated calls are safe. |

Context must be a plain object with an ordinary or null prototype. `patientId` and `encounterId` must each be a primitive canonical positive decimal string (`1`, `123`; no sign, zero, or leading zero). `draftRevision` and `transcriptRevision` must each be a primitive, nonempty, whitespace-free opaque string of at most 256 UTF-16 code units. The four fields are read once per snapshot; throwing getters or proxy traps fail closed. Each accepted snapshot is copied, so later changes to the caller's object do not change the candidate.

Text must be a primitive, nonempty string containing at least one non-whitespace character and no more than 100,000 UTF-16 code units. It is held and released without coercion, trimming, normalization, escaping, or markup interpretation. Unicode, control characters, and markup remain plaintext. A ticket contains no text or context fields and cannot retrieve the text. The caller already owns the proposed or revised text and must present **that exact version** for review. A revision starts at `1` and increases by one for each successful `revise`; any revision change requires a new review of the changed text.

The one-use approved value contains exactly `text`, `patientId`, `encounterId`, `draftRevision`, `transcriptRevision`, `origin: 'ai-draft'`, and `reviewed: true`. It is only a local review result. Neither accepted inputs nor a literal `true` prove patient authority, clinician identity, consent, or clinical approval. The value is not an audit entry, authorization decision, signed note, or permission to save.

## Consumer requirements and scope

A future consumer must re-read authoritative patient and encounter identity, editability, ACL, locks, and CSRF at save time, and record the required audit evidence. It must invalidate the candidate on navigation and on transcript or editor changes. It must display untrusted candidate text with `textContent` only, require a real review gesture and consent, meet provider privacy requirements, and verify clinical accuracy before any record action. This module itself performs none of those actions. No actual clinical record or model transmission is allowed by this implementation, and there is no live national integration.

OPEMR-40 supplies only the candidate review boundary. The broader original 22-feature backend and integration register remains partial; this module does not complete generation, the editor workflow, a save path, deployment, or clinical acceptance. Existing features are not wired to it.

## Verification status

The controller previously verified a tests-only `446bba7c` hosted JS run `39132835620` as an actual missing-module RED before production. The strengthened tests-only `cce821c4` contract was also required to complete RED before this production invocation. This work adds the missing module and dedicated documentation against the existing `tests/js/clinical-ai-note-review.test.js` contract without changing that test. GREEN remains pending controller verification. No test, native command, install, import, or browser run was performed in this implementation pass.
