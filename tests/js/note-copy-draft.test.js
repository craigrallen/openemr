'use strict';

const test = typeof globalThis.test === 'function' ? globalThis.test : require('node:test');
const assert = require('node:assert/strict');
const { appendNoteCopy } = require('../../interface/clinical-workspace/note-copy-draft.js');

function request(sourceText = 'Copied note', draftText = '') {
    return {
        source: { patientId: '1', noteId: '2', text: sourceText },
        draft: { patientId: '1', text: draftText },
    };
}

function errorFrom(value) {
    try {
        appendNoteCopy(value);
    } catch (error) {
        return error;
    }
    assert.fail('Expected appendNoteCopy to reject the request');
}

test('returns copied text with UTF-16 provenance and no authority metadata', () => {
    const input = request('a😀\r\n<b>&amp;</b>  ', 'Existing\n');
    const originalSource = { ...input.source };
    const originalDraft = { ...input.draft };
    const result = appendNoteCopy(input);

    assert.deepStrictEqual(result, {
        text: 'Existing\n\n\na😀\r\n<b>&amp;</b>  ',
        provenance: {
            patientId: '1', sourceNoteId: '2', start: 11,
            end: 11 + input.source.text.length,
        },
    });
    assert.deepStrictEqual(input.source, originalSource);
    assert.deepStrictEqual(input.draft, originalDraft);
});

test('copies a nonempty source directly into an empty draft', () => {
    assert.deepStrictEqual(appendNoteCopy(request(' \r\n😀<script>')), {
        text: ' \r\n😀<script>',
        provenance: { patientId: '1', sourceNoteId: '2', start: 0, end: 13 },
    });
});

test('requires plain object containers at every level', () => {
    for (const invalid of [null, undefined, [], () => {}, 1, 'object']) {
        assert.ok(errorFrom(invalid) instanceof TypeError);
        for (const field of ['source', 'draft']) {
            const input = request();
            input[field] = invalid;
            assert.ok(errorFrom(input) instanceof TypeError, field);
        }
    }
});

test('rejects malformed patient and note identities without coercion', () => {
    const invalid = [0, 1, 1n, '', '0', '00', '01', '+1', '-1', ' 1', '1 ', '1\n', '\n1', '١', '１',
        '1'.repeat(21), '550e8400-e29b-41d4-a716-446655440000', null, new String('1')];
    for (const value of invalid) {
        for (const [container, field] of [
            ['source', 'patientId'], ['source', 'noteId'], ['draft', 'patientId'],
        ]) {
            const input = request();
            input[container][field] = value;
            assert.ok(errorFrom(input) instanceof TypeError, `${container}.${field}: ${String(value)}`);
        }
    }
    const maxId = '9'.repeat(20);
    const input = request();
    input.source.patientId = maxId;
    input.source.noteId = maxId;
    input.draft.patientId = maxId;
    assert.equal(appendNoteCopy(input).provenance.sourceNoteId, maxId);
});

test('requires exact same-patient identity', () => {
    const input = request();
    input.draft.patientId = '2';
    assert.ok(errorFrom(input) instanceof TypeError);
});

test('rejects missing, inherited, and accessor required properties at every level', () => {
    for (const [container, field] of [
        [null, 'source'], [null, 'draft'],
        ['source', 'patientId'], ['source', 'noteId'], ['source', 'text'],
        ['draft', 'patientId'], ['draft', 'text'],
    ]) {
        const missing = request();
        const target = container === null ? missing : missing[container];
        delete target[field];
        assert.ok(errorFrom(missing) instanceof TypeError, `missing ${container || 'request'}.${field}`);

        const inherited = request();
        const inheritedTarget = container === null ? inherited : inherited[container];
        const value = inheritedTarget[field];
        delete inheritedTarget[field];
        Object.setPrototypeOf(inheritedTarget, { [field]: value });
        assert.ok(errorFrom(inherited) instanceof TypeError, `inherited ${container || 'request'}.${field}`);

        const accessor = request();
        const accessorTarget = container === null ? accessor : accessor[container];
        let calls = 0;
        Object.defineProperty(accessorTarget, field, {
            configurable: true,
            get() { calls += 1; throw new Error('secret accessor content'); },
        });
        assert.ok(errorFrom(accessor) instanceof TypeError, `accessor ${container || 'request'}.${field}`);
        assert.equal(calls, 0, `getter called for ${container || 'request'}.${field}`);
    }
});

test('ignores additional own properties without reading or coercing them', () => {
    const input = request();
    let calls = 0;
    for (const target of [input, input.source, input.draft]) {
        Object.defineProperty(target, 'extra', {
            get() { calls += 1; throw new Error('unrelated secret'); },
        });
    }
    assert.equal(appendNoteCopy(input).text, 'Copied note');
    assert.equal(calls, 0);
});

test('rejects malformed text fields without coercion', () => {
    for (const value of [null, undefined, 0, 1, {}, [], new String('text')]) {
        for (const container of ['source', 'draft']) {
            const input = request();
            input[container].text = value;
            assert.ok(errorFrom(input) instanceof TypeError, container);
        }
    }
    assert.ok(errorFrom(request('')) instanceof TypeError);
});

test('accepts source and aggregate length boundaries including separator', () => {
    const sourceMax = 's'.repeat(65536);
    const empty = appendNoteCopy(request(sourceMax));
    assert.equal(empty.text.length, 65536);
    assert.equal(empty.provenance.end, 65536);

    const draftMax = 'd'.repeat(262144 - 2 - 65536);
    const exact = appendNoteCopy(request(sourceMax, draftMax));
    assert.equal(exact.text.length, 262144);
    assert.equal(exact.provenance.start, draftMax.length + 2);
    assert.equal(exact.provenance.end, 262144);

    assert.ok(errorFrom(request('s'.repeat(65537))) instanceof RangeError);
    assert.ok(errorFrom(request('x', 'd'.repeat(262145))) instanceof RangeError);
    assert.ok(errorFrom(request(sourceMax, `${draftMax}d`)) instanceof RangeError);
    assert.ok(errorFrom(request('x', 'd'.repeat(262143))) instanceof RangeError);
});

test('rejects copied NUL and lone surrogates but preserves arbitrary existing draft text', () => {
    for (const text of ['a\0b', '\uD800', '\uDC00', 'a\uD800b', 'a\uDC00b']) {
        assert.ok(errorFrom(request(text)) instanceof TypeError);
    }
    const existing = '\0\uD800\uDC00\uD800';
    const result = appendNoteCopy(request('😀', existing));
    assert.equal(result.text, `${existing}\n\n😀`);
    assert.deepStrictEqual(result.provenance, {
        patientId: '1', sourceNoteId: '2', start: existing.length + 2, end: existing.length + 4,
    });
});

test('does not mutate frozen inputs and has no hidden state across repeated appends', () => {
    const input = request('second', 'first');
    Object.freeze(input.source);
    Object.freeze(input.draft);
    Object.freeze(input);
    const first = appendNoteCopy(input);
    const repeated = appendNoteCopy(input);
    assert.deepStrictEqual(repeated, first);
    assert.notStrictEqual(repeated, first);
    assert.notStrictEqual(repeated.provenance, first.provenance);

    const next = appendNoteCopy({ source: input.source, draft: { patientId: '1', text: first.text } });
    assert.equal(next.text, 'first\n\nsecond\n\nsecond');
    assert.equal(next.provenance.start, first.text.length + 2);
    assert.equal(input.draft.text, 'first');
});

test('leaves source and draft fields untouched after rejection', () => {
    const input = request('Signed source', 'Current draft');
    input.source.signature = 'signed-source-field';
    input.draft.patientId = '3';
    const sourceBefore = { ...input.source };
    const draftBefore = { ...input.draft };
    assert.ok(errorFrom(input) instanceof TypeError);
    assert.deepStrictEqual(input.source, sourceBefore);
    assert.deepStrictEqual(input.draft, draftBefore);
});

test('redacts malformed input and descriptor inspection exceptions', () => {
    const malformed = request();
    malformed.source.patientId = 'secret-id';
    const first = errorFrom(malformed);
    assert.equal(first.constructor, TypeError);
    assert.ok(!first.message.includes('secret-id'));

    const second = errorFrom(request('', ''));
    assert.equal(second.constructor, TypeError);
    assert.equal(second.message, first.message);

    const proxy = new Proxy(request().source, {
        getOwnPropertyDescriptor() { throw new Error('private descriptor failure'); },
    });
    const inspection = errorFrom({ source: proxy, draft: request().draft });
    assert.equal(inspection.constructor, TypeError);
    assert.equal(inspection.message, first.message);
    assert.ok(!inspection.message.includes('private descriptor failure'));

    const tooLong = errorFrom(request('x'.repeat(65537)));
    const aggregateTooLong = errorFrom(request('x', 'd'.repeat(262143)));
    assert.equal(tooLong.constructor, RangeError);
    assert.equal(aggregateTooLong.constructor, RangeError);
    assert.equal(tooLong.message, aggregateTooLong.message);
});
