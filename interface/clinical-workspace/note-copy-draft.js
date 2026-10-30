'use strict';

const INVALID_INPUT = 'Invalid note copy input';
const TOO_LONG = 'Note copy text exceeds the limit';
const ID = /^[1-9][0-9]{0,19}(?![\s\S])/;
const SOURCE_LIMIT = 65536;
const DRAFT_LIMIT = 262144;

function invalid() {
    throw new TypeError(INVALID_INPUT);
}

function container(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid();
    return value;
}

function ownData(object, name) {
    let descriptor;
    try {
        descriptor = Object.getOwnPropertyDescriptor(object, name);
    } catch {
        invalid();
    }
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) invalid();
    return descriptor.value;
}

function identity(value) {
    if (typeof value !== 'string' || !ID.test(value)) invalid();
    return value;
}

function sourceText(value) {
    if (typeof value !== 'string' || value.length === 0) invalid();
    if (value.length > SOURCE_LIMIT) throw new RangeError(TOO_LONG);
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code === 0 || (code >= 0xdc00 && code <= 0xdfff)) invalid();
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = value.charCodeAt(index + 1);
            if (next < 0xdc00 || next > 0xdfff || Number.isNaN(next)) invalid();
            index += 1;
        }
    }
    return value;
}

function appendNoteCopy(request) {
    const input = container(request);
    const source = container(ownData(input, 'source'));
    const draft = container(ownData(input, 'draft'));
    const patientId = identity(ownData(source, 'patientId'));
    const sourceNoteId = identity(ownData(source, 'noteId'));
    const copied = sourceText(ownData(source, 'text'));
    if (identity(ownData(draft, 'patientId')) !== patientId) invalid();
    const existing = ownData(draft, 'text');
    if (typeof existing !== 'string') invalid();

    const separatorLength = existing.length === 0 ? 0 : 2;
    const start = existing.length + separatorLength;
    const end = start + copied.length;
    if (end > DRAFT_LIMIT) throw new RangeError(TOO_LONG);

    return {
        text: separatorLength === 0 ? copied : `${existing}\n\n${copied}`,
        provenance: { patientId, sourceNoteId, start, end },
    };
}

module.exports = { appendNoteCopy };
