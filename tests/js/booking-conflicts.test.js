/**
 * Jest tests for the pure booking-conflict detector (OPEMR-65).
 *
 * detectBookingConflicts(proposal, occurrences) compares one proposed
 * provider interval against already-expanded occurrences using half-open
 * integer UTC-millisecond intervals. It is not a scheduling authority or a
 * live booking guard; timezone and recurrence expansion belong to the caller.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

const path = require('path');

const { detectBookingConflicts } = require(
    path.join(__dirname, '..', '..', 'interface', 'clinical-workspace', 'booking-conflicts.js')
);

const H = 3600000;
const T0 = 1700000000000;
const MIN_MS = -8640000000000000;
const MAX_MS = 8640000000000000;
const MAX_CAP = 10000;

function rec(id, providerId, startMs, endMs) {
    return { id, providerId, startMs, endMs };
}

function proposalAt(startH, endH, providerId = 5, id = null) {
    return rec(id, providerId, T0 + startH * H, T0 + endH * H);
}

function withField(record, key, value) {
    return { ...record, [key]: value };
}

function withoutField(record, key) {
    const copy = { ...record };
    delete copy[key];
    return copy;
}

function deepFreeze(value) {
    if (Array.isArray(value)) {
        value.forEach(deepFreeze);
    }
    return Object.freeze(value);
}

function expectRejects(proposal, occurrences, sentinels = []) {
    let thrown;
    try {
        detectBookingConflicts(proposal, occurrences);
    } catch (error) {
        thrown = error;
    }
    expect(thrown).toBeInstanceOf(TypeError);
    for (const sentinel of sentinels) {
        expect(thrown.message).not.toContain(sentinel);
    }
}

const BASE_PROPOSAL = proposalAt(10, 12);
const BASE_OCCURRENCE = rec(1, 9, T0 + 10 * H, T0 + 12 * H);

describe('detectBookingConflicts module', () => {
    test('exports detectBookingConflicts as a function', () => {
        expect(typeof detectBookingConflicts).toBe('function');
    });

    test('empty occurrences yield an empty array', () => {
        expect(detectBookingConflicts(BASE_PROPOSAL, [])).toEqual([]);
    });
});

describe('interval overlap (half-open, same provider)', () => {
    // Proposal is [10h, 12h) for provider 5.
    test.each([
        ['partial overlap at start', 9, 11, true],
        ['partial overlap at end', 11, 13, true],
        ['existing contains proposal', 9, 13, true],
        ['existing contained by proposal', 10.5, 11.5, true],
        ['identical interval', 10, 12, true],
        ['adjacent before (existing ends at proposal start)', 8, 10, false],
        ['adjacent after (existing starts at proposal end)', 12, 14, false],
        ['disjoint before', 2, 4, false],
        ['disjoint after', 20, 22, false],
    ])('%s', (_label, startH, endH, conflicts) => {
        const occurrences = [rec(42, 5, T0 + startH * H, T0 + endH * H)];
        expect(detectBookingConflicts(BASE_PROPOSAL, occurrences)).toEqual(conflicts ? [42] : []);
    });

    test.each([
        ['one millisecond overlap at proposal start', T0 + 8 * H, T0 + 10 * H + 1, true],
        ['one millisecond overlap at proposal end', T0 + 12 * H - 1, T0 + 14 * H, true],
        ['ends exactly at proposal start', T0 + 8 * H, T0 + 10 * H, false],
        ['starts exactly at proposal end', T0 + 12 * H, T0 + 14 * H, false],
    ])('%s', (_label, startMs, endMs, conflicts) => {
        const occurrences = [rec(7, 5, startMs, endMs)];
        expect(detectBookingConflicts(BASE_PROPOSAL, occurrences)).toEqual(conflicts ? [7] : []);
    });

    test('one-millisecond intervals compare correctly', () => {
        const proposal = rec(null, 5, 100, 101);
        expect(detectBookingConflicts(proposal, [rec(1, 5, 100, 101)])).toEqual([1]);
        expect(detectBookingConflicts(proposal, [rec(2, 5, 99, 100)])).toEqual([]);
        expect(detectBookingConflicts(proposal, [rec(3, 5, 101, 102)])).toEqual([]);
    });
});

describe('provider matching', () => {
    test.each([
        ['different providers never conflict', 5, 7, false],
        ['different providers, reversed', 7, 5, false],
        ['same nonzero provider conflicts', 5, 5, true],
        ['clinic-wide existing occurrence conflicts with any provider', 5, 0, true],
        ['clinic-wide proposal conflicts with any provider', 0, 7, true],
        ['clinic-wide on both sides conflicts', 0, 0, true],
    ])('%s', (_label, proposalProvider, existingProvider, conflicts) => {
        const proposal = proposalAt(10, 12, proposalProvider);
        const occurrences = [rec(3, existingProvider, T0 + 11 * H, T0 + 13 * H)];
        expect(detectBookingConflicts(proposal, occurrences)).toEqual(conflicts ? [3] : []);
    });

    test('clinic-wide does not make adjacent intervals conflict', () => {
        const proposal = proposalAt(10, 12, 0);
        const occurrences = [rec(3, 4, T0 + 12 * H, T0 + 13 * H), rec(4, 0, T0 + 9 * H, T0 + 10 * H)];
        expect(detectBookingConflicts(proposal, occurrences)).toEqual([]);
    });

    test('accepts the largest safe provider ID', () => {
        const big = Number.MAX_SAFE_INTEGER;
        const proposal = proposalAt(10, 12, big);
        expect(detectBookingConflicts(proposal, [rec(1, big, T0 + 10 * H, T0 + 11 * H)])).toEqual([1]);
    });
});

describe('moving an existing occurrence', () => {
    test('ignores the occurrence with the proposal ID but still reports an overlapping sibling', () => {
        const proposal = proposalAt(10, 12, 5, 10);
        const occurrences = [
            rec(10, 5, T0 + 10 * H, T0 + 12 * H),
            rec(11, 5, T0 + 11 * H, T0 + 12 * H),
        ];
        expect(detectBookingConflicts(proposal, occurrences)).toEqual([11]);
    });

    test('a move whose only overlap is itself yields no conflicts', () => {
        const proposal = proposalAt(10, 12, 5, 10);
        const occurrences = [rec(10, 5, T0 + 9 * H, T0 + 11 * H), rec(12, 5, T0 + 13 * H, T0 + 14 * H)];
        expect(detectBookingConflicts(proposal, occurrences)).toEqual([]);
    });

    test('a new proposal (null id) excludes nothing', () => {
        const proposal = proposalAt(10, 12, 5, null);
        const occurrences = [rec(10, 5, T0 + 10 * H, T0 + 12 * H)];
        expect(detectBookingConflicts(proposal, occurrences)).toEqual([10]);
    });

    test('a move ID absent from occurrences is allowed', () => {
        const proposal = proposalAt(10, 12, 5, 999);
        expect(detectBookingConflicts(proposal, [rec(1, 5, T0 + 11 * H, T0 + 13 * H)])).toEqual([1]);
    });

    test('the self record is still validated', () => {
        const proposal = proposalAt(10, 12, 5, 10);
        const occurrences = [rec(10, 5, T0 + 12 * H, T0 + 10 * H), rec(11, 5, T0 + 11 * H, T0 + 12 * H)];
        expectRejects(proposal, occurrences);
    });

    test('a self record with a malformed provider is still validated', () => {
        const proposal = proposalAt(10, 12, 5, 10);
        expectRejects(proposal, [rec(10, -1, T0 + 10 * H, T0 + 12 * H)]);
    });

    test('accepts the largest safe occurrence and proposal ID', () => {
        const big = Number.MAX_SAFE_INTEGER;
        const proposal = proposalAt(10, 12, 5, big);
        const occurrences = [rec(big, 5, T0 + 10 * H, T0 + 12 * H), rec(big - 1, 5, T0 + 10 * H, T0 + 12 * H)];
        expect(detectBookingConflicts(proposal, occurrences)).toEqual([big - 1]);
    });
});

describe('deterministic ordering', () => {
    test('sorts conflicts by startMs then ID ascending, independent of input order', () => {
        const occurrences = [
            rec(30, 5, T0 + 11 * H, T0 + 13 * H),
            rec(5, 5, T0 + 9 * H, T0 + 11 * H),
            rec(20, 5, T0 + 10 * H, T0 + 11 * H),
            rec(4, 5, T0 + 10 * H, T0 + 12 * H),
            rec(99, 7, T0 + 10 * H, T0 + 12 * H),
            rec(1, 5, T0 + 11 * H, T0 + 11.5 * H),
        ];
        const expected = [5, 4, 20, 1, 30];
        expect(detectBookingConflicts(BASE_PROPOSAL, occurrences)).toEqual(expected);
        expect(detectBookingConflicts(BASE_PROPOSAL, [...occurrences].reverse())).toEqual(expected);
        const rotated = [...occurrences.slice(3), ...occurrences.slice(0, 3)];
        expect(detectBookingConflicts(BASE_PROPOSAL, rotated)).toEqual(expected);
    });

    test('equal starts order by ID, including large IDs', () => {
        const big = Number.MAX_SAFE_INTEGER;
        const occurrences = [
            rec(big, 5, T0 + 10 * H, T0 + 11 * H),
            rec(2, 5, T0 + 10 * H, T0 + 12 * H),
            rec(big - 2, 5, T0 + 10 * H, T0 + 10.5 * H),
            rec(1, 5, T0 + 10 * H, T0 + 13 * H),
        ];
        expect(detectBookingConflicts(BASE_PROPOSAL, occurrences)).toEqual([1, 2, big - 2, big]);
    });

    test('orders extreme starts at both ends of the Date range without overflow', () => {
        const proposal = rec(null, 0, MIN_MS, MAX_MS);
        const occurrences = [
            rec(3, 1, MAX_MS - 1, MAX_MS),
            rec(2, 2, 0, 1),
            rec(9, 3, MIN_MS, MIN_MS + 1),
            rec(1, 4, MIN_MS, MAX_MS),
            rec(8, 5, -1, 0),
        ];
        expect(detectBookingConflicts(proposal, occurrences)).toEqual([1, 9, 8, 2, 3]);
    });
});

describe('timestamp ranges', () => {
    test('handles negative (pre-1970) timestamps', () => {
        const proposal = rec(null, 5, -2 * H, -1 * H);
        const occurrences = [
            rec(1, 5, -3 * H, -1.5 * H),
            rec(2, 5, -1 * H, 0),
            rec(3, 5, -4 * H, -2 * H),
            rec(4, 5, -1.5 * H, 1 * H),
        ];
        expect(detectBookingConflicts(proposal, occurrences)).toEqual([1, 4]);
    });

    test('accepts the exact Date range boundaries', () => {
        const proposal = rec(null, 5, MIN_MS, MAX_MS);
        const occurrences = [rec(1, 5, MIN_MS, MIN_MS + 1), rec(2, 5, MAX_MS - 1, MAX_MS)];
        expect(detectBookingConflicts(proposal, occurrences)).toEqual([1, 2]);
    });

    test('boundary intervals that only touch do not conflict', () => {
        const proposal = rec(null, 5, MIN_MS + 1, MAX_MS - 1);
        const occurrences = [rec(1, 5, MIN_MS, MIN_MS + 1), rec(2, 5, MAX_MS - 1, MAX_MS)];
        expect(detectBookingConflicts(proposal, occurrences)).toEqual([]);
    });
});

describe('inputs and outputs', () => {
    test('accepts deeply frozen inputs', () => {
        const proposal = Object.freeze(proposalAt(10, 12, 5, 10));
        const occurrences = deepFreeze([
            rec(10, 5, T0 + 10 * H, T0 + 12 * H),
            rec(12, 5, T0 + 11 * H, T0 + 13 * H),
            rec(11, 5, T0 + 9 * H, T0 + 11 * H),
        ]);
        expect(detectBookingConflicts(proposal, occurrences)).toEqual([11, 12]);
    });

    test('accepts null-prototype records', () => {
        const proposal = Object.assign(Object.create(null), proposalAt(10, 12));
        const occurrences = [Object.assign(Object.create(null), rec(1, 5, T0 + 11 * H, T0 + 13 * H))];
        expect(detectBookingConflicts(proposal, occurrences)).toEqual([1]);
    });

    test('accepts record fields declared in any order', () => {
        const proposal = { endMs: T0 + 12 * H, startMs: T0 + 10 * H, providerId: 5, id: null };
        const occurrences = [{ startMs: T0 + 11 * H, id: 1, endMs: T0 + 13 * H, providerId: 5 }];
        expect(detectBookingConflicts(proposal, occurrences)).toEqual([1]);
    });

    test('does not mutate or reorder inputs', () => {
        const proposal = proposalAt(10, 12);
        const occurrences = [
            rec(3, 5, T0 + 11 * H, T0 + 13 * H),
            rec(1, 5, T0 + 9 * H, T0 + 11 * H),
            rec(2, 7, T0 + 10 * H, T0 + 12 * H),
        ];
        const proposalBefore = JSON.stringify(proposal);
        const occurrencesBefore = JSON.stringify(occurrences);
        const recordRefs = [...occurrences];

        detectBookingConflicts(proposal, occurrences);

        expect(JSON.stringify(proposal)).toBe(proposalBefore);
        expect(JSON.stringify(occurrences)).toBe(occurrencesBefore);
        occurrences.forEach((record, index) => expect(record).toBe(recordRefs[index]));
        expect(occurrences).toHaveLength(3);
    });

    test('returns a fresh array of IDs only, never input records', () => {
        const occurrences = [rec(3, 5, T0 + 11 * H, T0 + 13 * H), rec(1, 5, T0 + 9 * H, T0 + 11 * H)];
        const result = detectBookingConflicts(BASE_PROPOSAL, occurrences);
        expect(Array.isArray(result)).toBe(true);
        expect(result).not.toBe(occurrences);
        expect(result).toEqual([1, 3]);
        expect(result.every((value) => Number.isSafeInteger(value))).toBe(true);
    });
});

describe('malformed proposal', () => {
    class Booking {
        constructor() {
            Object.assign(this, BASE_PROPOSAL);
        }
    }

    test.each([
        ['undefined', undefined],
        ['null', null],
        ['number', 5],
        ['string', 'proposal'],
        ['boolean', true],
        ['array', [null, 5, T0, T0 + H]],
        ['function', () => BASE_PROPOSAL],
        ['Date object', new Date(0)],
        ['class instance', new Booking()],
        ['object with a non-plain prototype', Object.assign(Object.create({ inherited: 1 }), BASE_PROPOSAL)],
        ['fields only inherited', Object.create(BASE_PROPOSAL)],
    ])('rejects %s', (_label, proposal) => {
        expectRejects(proposal, []);
    });

    test.each(['id', 'providerId', 'startMs', 'endMs'])('rejects a missing %s', (key) => {
        expectRejects(withoutField(BASE_PROPOSAL, key), []);
    });

    test('rejects an own field explicitly set to undefined', () => {
        expectRejects(withField(BASE_PROPOSAL, 'id', undefined), []);
    });

    test('rejects an unknown string field without echoing its name', () => {
        expectRejects(withField(BASE_PROPOSAL, 'sentinelExtraKey', 1), [], ['sentinelExtraKey']);
    });

    test('rejects an extra Symbol field', () => {
        const proposal = { ...BASE_PROPOSAL, [Symbol('extra')]: 1 };
        expectRejects(proposal, []);
    });

    test('rejects a non-enumerable Symbol accessor without invoking it', () => {
        const getter = jest.fn(() => 1);
        const proposal = { ...BASE_PROPOSAL };
        Object.defineProperty(proposal, Symbol('hidden'), { get: getter, enumerable: false });
        expectRejects(proposal, []);
        expect(getter).not.toHaveBeenCalled();
    });

    test.each(['id', 'providerId', 'startMs', 'endMs'])('rejects an accessor %s without invoking it', (key) => {
        const getter = jest.fn(() => BASE_PROPOSAL[key]);
        const proposal = withoutField(BASE_PROPOSAL, key);
        Object.defineProperty(proposal, key, { get: getter, enumerable: true, configurable: true });
        expectRejects(proposal, []);
        expect(getter).not.toHaveBeenCalled();
    });

    test('rejects an extra accessor field without invoking it', () => {
        const getter = jest.fn(() => 1);
        const proposal = { ...BASE_PROPOSAL };
        Object.defineProperty(proposal, 'extra', { get: getter, enumerable: true });
        expectRejects(proposal, []);
        expect(getter).not.toHaveBeenCalled();
    });

    test.each([
        ['zero', 0],
        ['negative', -1],
        ['fractional', 1.5],
        ['numeric string', '1'],
        ['NaN', NaN],
        ['Infinity', Infinity],
        ['unsafe integer', 2 ** 53],
        ['boolean', true],
        ['bigint', 1n],
        ['boxed number', new Number(1)],
        ['object', {}],
    ])('rejects id: %s', (_label, value) => {
        expectRejects(withField(BASE_PROPOSAL, 'id', value), []);
    });

    test.each([
        ['negative', -1],
        ['fractional', 1.5],
        ['numeric string', '0'],
        ['null', null],
        ['NaN', NaN],
        ['Infinity', Infinity],
        ['unsafe integer', 2 ** 53],
        ['boolean', false],
        ['bigint', 0n],
        ['boxed number', new Number(5)],
    ])('rejects providerId: %s', (_label, value) => {
        expectRejects(withField(BASE_PROPOSAL, 'providerId', value), []);
    });

    const badTimes = [
        ['numeric string', String(T0)],
        ['null', null],
        ['NaN', NaN],
        ['Infinity', Infinity],
        ['-Infinity', -Infinity],
        ['fractional', T0 + 0.5],
        ['boolean', true],
        ['bigint', BigInt(T0)],
        ['Date object', new Date(T0)],
        ['boxed number', new Number(T0)],
        ['ISO date string', '2026-01-01T00:00:00Z'],
    ];

    test.each(badTimes)('rejects startMs: %s', (_label, value) => {
        expectRejects(withField(BASE_PROPOSAL, 'startMs', value), []);
    });

    test.each(badTimes)('rejects endMs: %s', (_label, value) => {
        expectRejects(withField(BASE_PROPOSAL, 'endMs', value), []);
    });

    test('rejects times outside the Date range', () => {
        expectRejects(rec(null, 5, MIN_MS - 1, 0), []);
        expectRejects(rec(null, 5, 0, MAX_MS + 1), []);
        expectRejects(rec(null, 5, MAX_MS + 1, MAX_MS + 2), []);
    });

    test.each([
        ['empty range', T0, T0],
        ['inverted range', T0 + H, T0],
    ])('rejects %s', (_label, startMs, endMs) => {
        expectRejects(rec(null, 5, startMs, endMs), []);
    });

    test('does not echo a supplied value in the error message', () => {
        expectRejects(withField(BASE_PROPOSAL, 'startMs', 424242.125), [], ['424242']);
        expectRejects(withField(BASE_PROPOSAL, 'id', 'sentinelValueText'), [], ['sentinelValueText']);
    });

    test('rejects a missing occurrences argument', () => {
        expect(() => detectBookingConflicts(BASE_PROPOSAL)).toThrow(TypeError);
    });
});

describe('malformed occurrences collection', () => {
    test.each([
        ['undefined', undefined],
        ['null', null],
        ['plain object', {}],
        ['array-like object', { length: 1, 0: BASE_OCCURRENCE }],
        ['string', 'occurrences'],
        ['Set', new Set([BASE_OCCURRENCE])],
        ['single record', BASE_OCCURRENCE],
    ])('rejects %s', (_label, occurrences) => {
        expectRejects(BASE_PROPOSAL, occurrences);
    });

    test('rejects a sparse array with a hole', () => {
        // eslint-disable-next-line no-sparse-arrays
        const occurrences = [BASE_OCCURRENCE, , rec(2, 9, T0, T0 + H)];
        expectRejects(BASE_PROPOSAL, occurrences);
    });

    test('rejects an array whose length exceeds its entries', () => {
        const occurrences = new Array(2);
        occurrences[0] = BASE_OCCURRENCE;
        expectRejects(BASE_PROPOSAL, occurrences);
    });

    test('rejects an accessor index without invoking it', () => {
        const getter = jest.fn(() => rec(2, 9, T0, T0 + H));
        const occurrences = [BASE_OCCURRENCE];
        Object.defineProperty(occurrences, 1, { get: getter, enumerable: true, configurable: true });
        expectRejects(BASE_PROPOSAL, occurrences);
        expect(getter).not.toHaveBeenCalled();
    });

    test('rejects a custom string key on the array', () => {
        const occurrences = [BASE_OCCURRENCE];
        occurrences.extra = 1;
        expectRejects(BASE_PROPOSAL, occurrences);
    });

    test('rejects a custom accessor key on the array without invoking it', () => {
        const getter = jest.fn(() => 1);
        const occurrences = [BASE_OCCURRENCE];
        Object.defineProperty(occurrences, 'extra', { get: getter, enumerable: false });
        expectRejects(BASE_PROPOSAL, occurrences);
        expect(getter).not.toHaveBeenCalled();
    });

    test('rejects a Symbol key on the array', () => {
        const occurrences = [BASE_OCCURRENCE];
        occurrences[Symbol('extra')] = 1;
        expectRejects(BASE_PROPOSAL, occurrences);
    });

    test('rejects a Symbol accessor on the array without invoking it', () => {
        const getter = jest.fn(() => 1);
        const occurrences = [BASE_OCCURRENCE];
        Object.defineProperty(occurrences, Symbol('hidden'), { get: getter, enumerable: false });
        expectRejects(BASE_PROPOSAL, occurrences);
        expect(getter).not.toHaveBeenCalled();
    });
});

describe('malformed occurrence records', () => {
    // BASE_OCCURRENCE uses provider 9, unrelated to the provider-5 proposal,
    // so every rejection here proves irrelevant records are still validated.
    test.each([
        ['null', null],
        ['undefined', undefined],
        ['number', 1],
        ['array', [1, 9, T0, T0 + H]],
        ['Date object', new Date(0)],
        ['object with a non-plain prototype', Object.assign(Object.create({}), BASE_OCCURRENCE)],
        ['fields only inherited', Object.create(BASE_OCCURRENCE)],
    ])('rejects a %s entry', (_label, entry) => {
        expectRejects(BASE_PROPOSAL, [entry]);
    });

    test.each(['id', 'providerId', 'startMs', 'endMs'])('rejects a missing %s', (key) => {
        expectRejects(BASE_PROPOSAL, [withoutField(BASE_OCCURRENCE, key)]);
    });

    test('rejects an unknown string field without echoing its name', () => {
        expectRejects(BASE_PROPOSAL, [withField(BASE_OCCURRENCE, 'sentinelExtraKey', 1)], ['sentinelExtraKey']);
    });

    test('rejects an extra Symbol field', () => {
        expectRejects(BASE_PROPOSAL, [{ ...BASE_OCCURRENCE, [Symbol('extra')]: 1 }]);
    });

    test.each(['id', 'providerId', 'startMs', 'endMs'])('rejects an accessor %s without invoking it', (key) => {
        const getter = jest.fn(() => BASE_OCCURRENCE[key]);
        const entry = withoutField(BASE_OCCURRENCE, key);
        Object.defineProperty(entry, key, { get: getter, enumerable: true, configurable: true });
        expectRejects(BASE_PROPOSAL, [entry]);
        expect(getter).not.toHaveBeenCalled();
    });

    test('rejects a Symbol accessor field without invoking it', () => {
        const getter = jest.fn(() => 1);
        const entry = { ...BASE_OCCURRENCE };
        Object.defineProperty(entry, Symbol('hidden'), { get: getter, enumerable: false });
        expectRejects(BASE_PROPOSAL, [entry]);
        expect(getter).not.toHaveBeenCalled();
    });

    test.each([
        ['null (only proposals may be new)', null],
        ['zero', 0],
        ['negative', -3],
        ['fractional', 2.5],
        ['numeric string', '1'],
        ['NaN', NaN],
        ['Infinity', Infinity],
        ['unsafe integer', 2 ** 53],
        ['boolean', true],
        ['bigint', 1n],
        ['boxed number', new Number(1)],
    ])('rejects id: %s', (_label, value) => {
        expectRejects(BASE_PROPOSAL, [withField(BASE_OCCURRENCE, 'id', value)]);
    });

    test.each([
        ['negative', -1],
        ['fractional', 0.5],
        ['numeric string', '9'],
        ['null', null],
        ['NaN', NaN],
        ['unsafe integer', 2 ** 53],
        ['boolean', true],
        ['bigint', 9n],
    ])('rejects providerId: %s', (_label, value) => {
        expectRejects(BASE_PROPOSAL, [withField(BASE_OCCURRENCE, 'providerId', value)]);
    });

    test.each([
        ['numeric string', String(T0)],
        ['null', null],
        ['NaN', NaN],
        ['Infinity', Infinity],
        ['fractional', T0 + 0.25],
        ['boolean', false],
        ['bigint', BigInt(T0)],
        ['Date object', new Date(T0)],
        ['below Date range', MIN_MS - 1],
    ])('rejects startMs: %s', (_label, value) => {
        expectRejects(BASE_PROPOSAL, [withField(BASE_OCCURRENCE, 'startMs', value)]);
    });

    test.each([
        ['numeric string', String(T0 + H)],
        ['undefined', undefined],
        ['-Infinity', -Infinity],
        ['fractional', T0 + H + 0.75],
        ['Date object', new Date(T0 + H)],
        ['above Date range', MAX_MS + 1],
    ])('rejects endMs: %s', (_label, value) => {
        expectRejects(BASE_PROPOSAL, [withField(BASE_OCCURRENCE, 'endMs', value)]);
    });

    test.each([
        ['empty range', T0, T0],
        ['inverted range', T0 + H, T0],
    ])('rejects an occurrence with an %s', (_label, startMs, endMs) => {
        expectRejects(BASE_PROPOSAL, [rec(1, 9, startMs, endMs)]);
    });

    test('does not echo a supplied value in the error message', () => {
        expectRejects(BASE_PROPOSAL, [withField(BASE_OCCURRENCE, 'endMs', 515151.375)], ['515151']);
    });
});

describe('duplicate IDs and all-or-nothing validation', () => {
    test('rejects duplicate IDs even on unrelated providers and times', () => {
        const occurrences = [rec(4, 8, T0, T0 + H), rec(4, 9, T0 + 50 * H, T0 + 51 * H)];
        expectRejects(BASE_PROPOSAL, occurrences);
    });

    test('rejects duplicate IDs among conflicting records', () => {
        const occurrences = [rec(4, 5, T0 + 10 * H, T0 + 11 * H), rec(4, 5, T0 + 11 * H, T0 + 12 * H)];
        expectRejects(BASE_PROPOSAL, occurrences);
    });

    test('rejects a duplicated self record during a move', () => {
        const proposal = proposalAt(10, 12, 5, 10);
        const occurrences = [rec(10, 5, T0 + 10 * H, T0 + 12 * H), rec(10, 5, T0 + 20 * H, T0 + 21 * H)];
        expectRejects(proposal, occurrences);
    });

    test('a later invalid irrelevant record rejects the whole call', () => {
        const occurrences = [
            rec(1, 5, T0 + 10 * H, T0 + 11 * H),
            rec(2, 9, T0 + 40 * H, T0 + 41 * H),
            rec(3, 9, T0 + 41 * H, '1'),
        ];
        expectRejects(BASE_PROPOSAL, occurrences);
    });

    test('a later irrelevant record with an unknown field rejects the whole call', () => {
        const occurrences = [rec(1, 5, T0 + 10 * H, T0 + 11 * H), { ...rec(2, 9, T0, T0 + H), extra: 1 }];
        expectRejects(BASE_PROPOSAL, occurrences);
    });
});

describe('collection size cap', () => {
    function irrelevantOccurrences(count) {
        const occurrences = [];
        for (let i = 1; i <= count; i++) {
            occurrences.push(rec(i, 9, T0 + i * H, T0 + i * H + 1));
        }
        return occurrences;
    }

    test('accepts exactly 10000 occurrences and scans all of them', () => {
        const occurrences = irrelevantOccurrences(MAX_CAP - 1);
        occurrences.push(rec(MAX_CAP, 5, T0 + 10 * H, T0 + 11 * H));
        expect(occurrences).toHaveLength(MAX_CAP);
        expect(detectBookingConflicts(BASE_PROPOSAL, occurrences)).toEqual([MAX_CAP]);
    });

    test('rejects 10001 occurrences', () => {
        const occurrences = irrelevantOccurrences(MAX_CAP + 1);
        expect(occurrences).toHaveLength(MAX_CAP + 1);
        expectRejects(BASE_PROPOSAL, occurrences);
    });
});
