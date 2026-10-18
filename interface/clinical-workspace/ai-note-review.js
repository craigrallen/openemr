'use strict';

// An in-memory review boundary. Tickets identify a candidate but carry no note or context.
const POSITIVE_DECIMAL = /^[1-9][0-9]*$/;
const WHITESPACE = /\s/u;
const NON_WHITESPACE = /\S/u;
const MAX_REVISION_LENGTH = 256;
const MAX_TEXT_LENGTH = 100000;

function readSnapshot(context) {
    try {
        if (context === null || typeof context !== 'object') return null;
        const prototype = Object.getPrototypeOf(context);
        if (prototype !== Object.prototype && prototype !== null) return null;

        // Each caller-controlled property is read exactly once, including accessor properties.
        const patientId = context.patientId;
        const encounterId = context.encounterId;
        const draftRevision = context.draftRevision;
        const transcriptRevision = context.transcriptRevision;
        if (typeof patientId !== 'string' || !POSITIVE_DECIMAL.test(patientId) ||
            typeof encounterId !== 'string' || !POSITIVE_DECIMAL.test(encounterId) ||
            typeof draftRevision !== 'string' || draftRevision.length < 1 ||
            draftRevision.length > MAX_REVISION_LENGTH || WHITESPACE.test(draftRevision) ||
            typeof transcriptRevision !== 'string' || transcriptRevision.length < 1 ||
            transcriptRevision.length > MAX_REVISION_LENGTH || WHITESPACE.test(transcriptRevision)) {
            return null;
        }
        return { patientId, encounterId, draftRevision, transcriptRevision };
    } catch (_) {
        // Getter and proxy failures invalidate the snapshot without exposing their errors.
        return null;
    }
}

function validText(value) {
    return typeof value === 'string' && value.length > 0 &&
        value.length <= MAX_TEXT_LENGTH && NON_WHITESPACE.test(value);
}

function sameSnapshot(left, right) {
    return left.patientId === right.patientId &&
        left.encounterId === right.encounterId &&
        left.draftRevision === right.draftRevision &&
        left.transcriptRevision === right.transcriptRevision;
}

function createAiNoteReview() {
    let disposed = false;
    let candidate = null;
    let mutation = 0n;

    function clear() {
        candidate = null;
        mutation += 1n;
    }

    return {
        propose(context, text) {
            if (disposed) return null;
            // A replacement attempt cancels the old candidate before any caller property read.
            clear();
            const startedAt = mutation;
            const snapshot = readSnapshot(context);
            if (disposed || mutation !== startedAt || !snapshot || !validText(text)) return null;
            const ticket = Object.freeze(Object.create(null));
            candidate = { ticket, snapshot, text, revision: 1 };
            mutation += 1n;
            return ticket;
        },

        revise(ticket, text) {
            if (disposed || !candidate || candidate.ticket !== ticket) return false;
            if (!validText(text) || !Number.isSafeInteger(candidate.revision + 1)) {
                clear();
                return false;
            }
            candidate.text = text;
            candidate.revision += 1;
            mutation += 1n;
            return candidate.revision;
        },

        approve(ticket, currentContext, revision, explicitApproval) {
            if (disposed || !candidate || candidate.ticket !== ticket) return null;
            const pending = candidate;
            const startedAt = mutation;
            const expectedRevision = pending.revision;
            if (explicitApproval !== true || revision !== expectedRevision) return null;

            const current = readSnapshot(currentContext);
            // Reading a getter or proxy trap can mutate this instance recursively.
            if (disposed || mutation !== startedAt || candidate !== pending ||
                pending.revision !== expectedRevision) return null;
            if (!current || !sameSnapshot(pending.snapshot, current)) {
                clear();
                return null;
            }

            clear();
            return Object.freeze({
                text: pending.text,
                patientId: pending.snapshot.patientId,
                encounterId: pending.snapshot.encounterId,
                draftRevision: pending.snapshot.draftRevision,
                transcriptRevision: pending.snapshot.transcriptRevision,
                origin: 'ai-draft',
                reviewed: true,
            });
        },

        reject(ticket) {
            if (!disposed && candidate && candidate.ticket === ticket) clear();
        },

        dispose() {
            if (disposed) return;
            disposed = true;
            clear();
        },
    };
}

module.exports = { createAiNoteReview };
