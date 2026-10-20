/**
 * OPEMR-61: behaviour tests for the dependency-free visit-note template draft
 * helpers (editable headings, append-only plain-text transformation).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

const fs = require('fs');
const path = require('path');

const MODULE_PATH = path.join(__dirname, '../../interface/clinical-workspace/note-template-draft.js');

// Intentionally fails until the production module exists (controller RED phase).
const draft = require(MODULE_PATH);

const { renderTemplate, appendTemplate, renameHeading, LIMITS } = draft;

function section(heading, body) {
    return { heading, body };
}

function soapSections() {
    return [
        section('Subjective', 'Pain 3/10 since Monday.'),
        section('Objective', 'BP 120/80'),
        section('Assessment', ''),
        section('Plan', 'Follow up in 2 weeks.'),
    ];
}

function deepFreeze(sections) {
    sections.forEach((s) => Object.freeze(s));
    return Object.freeze(sections);
}

function snapshot(sections) {
    return sections.map((s) => ({ heading: s.heading, body: s.body }));
}

function validSections(count) {
    return Array.from({ length: count }, (_, i) => section(`Heading ${i}`, `Body ${i}`));
}

/**
 * Invalid section records shared by every API that accepts sections.
 * Each factory returns a fresh value so getter spies stay isolated.
 */
function invalidSectionCases() {
    return [
        ['null record', () => null],
        ['string record', () => 'Subjective'],
        ['array record', () => ['Subjective', 'body']],
        ['class instance record', () => new (class Section {
            constructor() {
                this.heading = 'A';
                this.body = 'b';
            }
        })()],
        ['inherited heading/body data', () => Object.create({ heading: 'A', body: 'b' })],
        ['non-plain prototype with own data', () => Object.assign(Object.create(Object.create(null)), { heading: 'A', body: 'b' })],
        ['missing body', () => ({ heading: 'A' })],
        ['missing heading', () => ({ body: 'b' })],
        ['unknown own key', () => ({ heading: 'A', body: 'b', extra: 'x' })],
        ['own __proto__ key', () => JSON.parse('{"heading":"A","body":"b","__proto__":{"polluted":true}}')],
        ['own constructor key', () => ({ heading: 'A', body: 'b', constructor: 'x' })],
        ['own prototype key', () => ({ heading: 'A', body: 'b', prototype: 'x' })],
        ['own symbol key', () => ({ heading: 'A', body: 'b', [Symbol('extra')]: 'x' })],
        ['numeric heading', () => ({ heading: 1, body: 'b' })],
        ['null heading', () => ({ heading: null, body: 'b' })],
        ['boxed String heading', () => ({ heading: new String('A'), body: 'b' })],
        ['numeric body', () => ({ heading: 'A', body: 0 })],
        ['undefined body', () => ({ heading: 'A', body: undefined })],
        ['boxed String body', () => ({ heading: 'A', body: new String('b') })],
        ['empty heading', () => ({ heading: '', body: 'b' })],
        ['whitespace-only heading', () => ({ heading: ' \t ', body: 'b' })],
        ['heading with LF', () => ({ heading: 'A\nB', body: 'b' })],
        ['heading with CR', () => ({ heading: 'A\rB', body: 'b' })],
        ['heading with CRLF', () => ({ heading: 'A\r\nB', body: 'b' })],
        ['heading with NUL', () => ({ heading: 'A\u0000B', body: 'b' })],
        ['body with NUL', () => ({ heading: 'A', body: 'b\u0000c' })],
        ['heading with U+2028 line separator', () => ({ heading: 'A B', body: 'b' })],
        ['heading with U+2029 paragraph separator', () => ({ heading: 'A B', body: 'b' })],
    ];
}

function accessorSection(prop) {
    const getter = jest.fn(() => 'value');
    const record = prop === 'heading' ? { body: 'b' } : { heading: 'A' };
    Object.defineProperty(record, prop, { get: getter, enumerable: true, configurable: true });
    return { record, getter };
}

describe('OPEMR-61 note-template-draft module surface', () => {
    test('exports exactly the documented API', () => {
        expect(Object.keys(draft).sort()).toEqual(['LIMITS', 'appendTemplate', 'renameHeading', 'renderTemplate']);
        expect(typeof renderTemplate).toBe('function');
        expect(typeof appendTemplate).toBe('function');
        expect(typeof renameHeading).toBe('function');
    });

    test('LIMITS declares the explicit bounds', () => {
        expect(LIMITS).toEqual({
            maxSections: 64,
            maxHeadingLength: 200,
            maxBodyLength: 100000,
            maxDraftLength: 1000000,
        });
    });

    test('LIMITS is frozen and attempted mutation cannot change accepted size bounds', () => {
        expect(Object.isFrozen(LIMITS)).toBe(true);

        // Reflect.* reports failure without depending on strict/sloppy assignment semantics.
        expect(Reflect.set(LIMITS, 'maxHeadingLength', 1000000)).toBe(false);
        expect(Reflect.set(LIMITS, 'maxSections', 1000000)).toBe(false);
        expect(Reflect.set(LIMITS, 'maxBodyLength', 1000000000)).toBe(false);
        expect(Reflect.set(LIMITS, 'maxDraftLength', 1000000000)).toBe(false);
        expect(Reflect.deleteProperty(LIMITS, 'maxHeadingLength')).toBe(false);
        expect(Reflect.defineProperty(LIMITS, 'maxSections', { value: 1000000 })).toBe(false);
        expect(Reflect.set(LIMITS, 'extra', 1)).toBe(false);

        expect(LIMITS).toEqual({
            maxSections: 64,
            maxHeadingLength: 200,
            maxBodyLength: 100000,
            maxDraftLength: 1000000,
        });

        // Literal bounds, so a mutated LIMITS cannot also move the expectation.
        expect(() => renderTemplate([section('h'.repeat(200), '')])).not.toThrow();
        expect(() => renderTemplate([section('h'.repeat(201), '')])).toThrow(RangeError);
        expect(() => renameHeading([section('A', 'b')], 0, 'n'.repeat(201))).toThrow(RangeError);
        expect(() => renderTemplate(validSections(65))).toThrow(RangeError);
        expect(() => renderTemplate([section('H', 'b'.repeat(100001))])).toThrow(RangeError);
        expect(() => appendTemplate('d'.repeat(1000001), [])).toThrow(RangeError);
    });

    test('source has no DOM, network, storage, clock, random or module dependencies', () => {
        const source = fs.readFileSync(MODULE_PATH, 'utf8');
        const forbidden = [
            /\bdocument\s*\./,
            /\bwindow\s*\./,
            /\bfetch\s*\(/,
            /XMLHttpRequest/,
            /localStorage/,
            /sessionStorage/,
            /indexedDB/,
            /\bDate\b/,
            /Math\.random/,
            /\bcrypto\b/,
            /innerHTML/,
            /\beval\s*\(/,
            /new\s+Function/,
            /\brequire\s*\(/,
            /\bimport\s*\(/,
        ];
        forbidden.forEach((pattern) => {
            expect(source).not.toMatch(pattern);
        });
    });
});

describe('OPEMR-61 renderTemplate', () => {
    test('renders heading + newline + body joined by a blank line', () => {
        expect(renderTemplate(soapSections())).toBe(
            'Subjective\nPain 3/10 since Monday.\n\n'
            + 'Objective\nBP 120/80\n\n'
            + 'Assessment\n\n\n'
            + 'Plan\nFollow up in 2 weeks.'
        );
    });

    test('empty body still yields heading followed by a newline', () => {
        expect(renderTemplate([section('Plan', '')])).toBe('Plan\n');
    });

    test('empty section list renders an empty string', () => {
        expect(renderTemplate([])).toBe('');
    });

    test('is deterministic for identical input', () => {
        expect(renderTemplate(soapSections())).toBe(renderTemplate(soapSections()));
    });

    test('preserves CRLF, Unicode and untrimmed text byte-for-byte', () => {
        // Built from code points so editors/tools cannot silently NFC-normalise the fixture.
        const precomposed = String.fromCharCode(0x0063, 0x0061, 0x0066, 0x00e9);
        const decomposed = `cafe${String.fromCharCode(0x0301)}`;
        expect(decomposed).toHaveLength(5);
        expect(decomposed).not.toBe(precomposed);
        const out = renderTemplate([
            section('  Évaluation 🩺\t', `line1\r\nline2 — ${decomposed}\r\n\r\n`),
            section('Plan', '\n\n  indented\n'),
        ]);
        expect(out).toBe(`  Évaluation 🩺\t\nline1\r\nline2 — ${decomposed}\r\n\r\n\n\nPlan\n\n\n  indented\n`);
        expect(out).toContain(decomposed);
        expect(out).not.toContain(precomposed);
    });

    test('markup and prototype words remain literal text', () => {
        const out = renderTemplate([
            section('<script>alert(1)</script>', '<b>bold</b> &amp;'),
            section('__proto__', 'constructor prototype hasOwnProperty'),
        ]);
        expect(out).toBe(
            '<script>alert(1)</script>\n<b>bold</b> &amp;\n\n'
            + '__proto__\nconstructor prototype hasOwnProperty'
        );
        expect(Object.prototype).not.toHaveProperty('polluted');
    });

    test('accepts null-prototype and frozen sections without mutating them', () => {
        const nullProto = Object.assign(Object.create(null), { heading: 'A', body: 'b' });
        const sections = deepFreeze([nullProto, section('C', 'd')]);
        const before = snapshot(sections);
        expect(renderTemplate(sections)).toBe('A\nb\n\nC\nd');
        expect(snapshot(sections)).toEqual(before);
    });

    test.each([
        ['null', null],
        ['undefined', undefined],
        ['string', 'Subjective'],
        ['plain object', {}],
        ['array-like object', { length: 0 }],
    ])('rejects non-array sections (%s) with TypeError', (_label, value) => {
        expect(() => renderTemplate(value)).toThrow(TypeError);
    });

    test('rejects sparse arrays with TypeError', () => {
        const sparse = new Array(2);
        sparse[1] = section('A', 'b');
        expect(() => renderTemplate(sparse)).toThrow(TypeError);
    });

    test('rejects array holes filled by inherited prototype data with TypeError', () => {
        const arr = [section('A', 'b')];
        arr.length = 2;
        Object.setPrototypeOf(arr, Object.create(Array.prototype, {
            1: { value: section('C', 'd'), enumerable: true },
        }));
        expect(() => renderTemplate(arr)).toThrow(TypeError);
    });

    test('rejects accessor array elements without invoking the getter', () => {
        const getter = jest.fn(() => section('A', 'b'));
        const arr = [section('X', 'y'), section('Z', 'w')];
        Object.defineProperty(arr, 1, { get: getter, enumerable: true, configurable: true });
        expect(() => renderTemplate(arr)).toThrow(TypeError);
        expect(getter).not.toHaveBeenCalled();
    });

    test.each(invalidSectionCases())('rejects %s with TypeError, even after valid sections', (_label, make) => {
        expect(() => renderTemplate([section('Valid', 'ok'), make()])).toThrow(TypeError);
    });

    test.each(['heading', 'body'])('rejects %s accessor without invoking the getter', (prop) => {
        const { record, getter } = accessorSection(prop);
        expect(() => renderTemplate([section('Valid', 'ok'), record])).toThrow(TypeError);
        expect(getter).not.toHaveBeenCalled();
    });

    test('rejects a setter-only heading accessor with TypeError', () => {
        const record = { body: 'b' };
        Object.defineProperty(record, 'heading', { set() {}, enumerable: true, configurable: true });
        expect(() => renderTemplate([record])).toThrow(TypeError);
    });

    test('section count boundary: maxSections accepted, one more is RangeError', () => {
        expect(() => renderTemplate(validSections(LIMITS.maxSections))).not.toThrow();
        expect(() => renderTemplate(validSections(LIMITS.maxSections + 1))).toThrow(RangeError);
    });

    test('heading length boundary is measured in UTF-16 code units', () => {
        const atLimit = 'h'.repeat(LIMITS.maxHeadingLength);
        expect(renderTemplate([section(atLimit, '')])).toBe(`${atLimit}\n`);
        expect(() => renderTemplate([section(`${atLimit}h`, '')])).toThrow(RangeError);

        const astralAtLimit = '🩺'.repeat(LIMITS.maxHeadingLength / 2);
        expect(astralAtLimit.length).toBe(LIMITS.maxHeadingLength);
        expect(() => renderTemplate([section(astralAtLimit, '')])).not.toThrow();
        expect(() => renderTemplate([section(`${astralAtLimit}a`, '')])).toThrow(RangeError);
    });

    test('body length boundary: maxBodyLength accepted, one more is RangeError', () => {
        const atLimit = 'b'.repeat(LIMITS.maxBodyLength);
        expect(renderTemplate([section('H', atLimit)])).toBe(`H\n${atLimit}`);
        expect(() => renderTemplate([section('H', `${atLimit}b`)])).toThrow(RangeError);
    });

    test('rendered length boundary: maxDraftLength accepted, one more is RangeError', () => {
        // 10 sections of "H\n<body>" joined by "\n\n": 10 * 2 + 9 * 2 = 38 fixed chars.
        const bodies = Array.from({ length: 10 }, () => LIMITS.maxBodyLength);
        bodies[9] = LIMITS.maxDraftLength - 38 - (9 * LIMITS.maxBodyLength);
        const make = (extra) => bodies.map((len, i) => section('H', 'x'.repeat(len + (i === 9 ? extra : 0))));

        expect(renderTemplate(make(0))).toHaveLength(LIMITS.maxDraftLength);
        expect(() => renderTemplate(make(1))).toThrow(RangeError);
    });
});

describe('OPEMR-61 appendTemplate', () => {
    const tpl = () => [section('Subjective', 'Pain'), section('Plan', '')];
    const rendered = 'Subjective\nPain\n\nPlan\n';

    test('appending to an empty draft returns the rendered template', () => {
        expect(appendTemplate('', tpl())).toBe(rendered);
    });

    test('appending to a non-empty draft adds one blank-line separator', () => {
        expect(appendTemplate('Existing note', tpl())).toBe(`Existing note\n\n${rendered}`);
    });

    test('never strips or rewrites pre-existing bytes, including trailing newlines and CRLF', () => {
        const existing = '  Prior visit\r\n<b>kept</b>\n\n\n';
        const out = appendTemplate(existing, tpl());
        expect(out).toBe(`${existing}\n\n${rendered}`);
        expect(out.startsWith(existing)).toBe(true);
    });

    test('a whitespace-only existing draft is non-empty and kept verbatim', () => {
        expect(appendTemplate('\n', tpl())).toBe(`\n\n\n${rendered}`);
    });

    test('appending an empty section list returns the original draft unchanged', () => {
        expect(appendTemplate('', [])).toBe('');
        expect(appendTemplate('Keep me\r\n\n', [])).toBe('Keep me\r\n\n');
    });

    test('does not mutate frozen section inputs', () => {
        const sections = deepFreeze(tpl());
        const before = snapshot(sections);
        appendTemplate('Draft', sections);
        expect(snapshot(sections)).toEqual(before);
    });

    test.each([
        ['null', null],
        ['undefined', undefined],
        ['number', 5],
        ['boxed String', new String('x')],
        ['array', ['x']],
    ])('rejects non-string existing draft (%s) with TypeError, even with []', (_label, value) => {
        expect(() => appendTemplate(value, [])).toThrow(TypeError);
        expect(() => appendTemplate(value, tpl())).toThrow(TypeError);
    });

    test('rejects non-array sections with TypeError', () => {
        expect(() => appendTemplate('Draft', null)).toThrow(TypeError);
        expect(() => appendTemplate('Draft', { heading: 'A', body: 'b' })).toThrow(TypeError);
    });

    test.each(invalidSectionCases())('rejects %s in a later section with TypeError (all-or-nothing)', (_label, make) => {
        expect(() => appendTemplate('Draft', [section('Valid', 'ok'), make()])).toThrow(TypeError);
    });

    test('rejects accessor section fields without invoking the getter', () => {
        const { record, getter } = accessorSection('body');
        expect(() => appendTemplate('Draft', [record])).toThrow(TypeError);
        expect(getter).not.toHaveBeenCalled();
    });

    test('existing draft length boundary applies even when appending []', () => {
        const atLimit = 'd'.repeat(LIMITS.maxDraftLength);
        expect(appendTemplate(atLimit, [])).toBe(atLimit);
        expect(() => appendTemplate(`${atLimit}d`, [])).toThrow(RangeError);
    });

    test('combined result boundary: maxDraftLength accepted, one more is RangeError', () => {
        const small = [section('A', 'b')]; // renders "A\nb" (3 chars), separator adds 2
        const fits = 'd'.repeat(LIMITS.maxDraftLength - 5);
        expect(appendTemplate(fits, small)).toHaveLength(LIMITS.maxDraftLength);
        expect(() => appendTemplate(`${fits}d`, small)).toThrow(RangeError);
    });

    test('section count overflow is RangeError', () => {
        expect(() => appendTemplate('Draft', validSections(LIMITS.maxSections + 1))).toThrow(RangeError);
    });
});

describe('OPEMR-61 renameHeading', () => {
    test('returns a fresh array of fresh own-data sections with only the target heading changed', () => {
        const input = soapSections();
        const before = snapshot(input);
        const out = renameHeading(input, 2, 'Assessment & Differential');

        expect(Array.isArray(out)).toBe(true);
        expect(out).not.toBe(input);
        expect(out).toHaveLength(input.length);
        out.forEach((s, i) => {
            expect(s).not.toBe(input[i]);
            expect(Reflect.ownKeys(s).sort()).toEqual(['body', 'heading']);
            ['heading', 'body'].forEach((key) => {
                const desc = Object.getOwnPropertyDescriptor(s, key);
                expect(desc).toHaveProperty('value');
                expect(desc.get).toBeUndefined();
            });
            expect([Object.prototype, null]).toContain(Object.getPrototypeOf(s));
        });

        const expected = snapshot(input);
        expected[2].heading = 'Assessment & Differential';
        expect(snapshot(out)).toEqual(expected);
        expect(snapshot(input)).toEqual(before);
    });

    test('works on frozen and null-prototype inputs without mutating them', () => {
        const nullProto = Object.assign(Object.create(null), { heading: 'Old', body: 'kept\r\nbody' });
        const input = deepFreeze([section('First', 'one'), nullProto]);
        const before = snapshot(input);

        const out = renameHeading(input, 1, '  Néw 🩺 ');
        expect(snapshot(out)).toEqual([
            { heading: 'First', body: 'one' },
            { heading: '  Néw 🩺 ', body: 'kept\r\nbody' },
        ]);
        expect(snapshot(input)).toEqual(before);
        expect(Object.isFrozen(input)).toBe(true);
    });

    test('output round-trips through renderTemplate', () => {
        const out = renameHeading([section('S', 'pain'), section('P', '')], 0, 'Subjective');
        expect(renderTemplate(out)).toBe('Subjective\npain\n\nP\n');
    });

    test('renaming to the same heading still returns fresh copies', () => {
        const input = [section('Same', 'body')];
        const out = renameHeading(input, 0, 'Same');
        expect(out).not.toBe(input);
        expect(out[0]).not.toBe(input[0]);
        expect(snapshot(out)).toEqual(snapshot(input));
    });

    test('literal prototype words and markup are accepted as headings', () => {
        expect(renameHeading([section('A', 'b')], 0, '__proto__')[0].heading).toBe('__proto__');
        expect(renameHeading([section('A', 'b')], 0, '<img src=x onerror=alert(1)>')[0].heading)
            .toBe('<img src=x onerror=alert(1)>');
        expect(Object.prototype).not.toHaveProperty('polluted');
    });

    test.each([
        ['negative', -1],
        ['equal to length', 2],
        ['beyond length', 99],
        ['fractional', 0.5],
        ['NaN', NaN],
        ['Infinity', Infinity],
    ])('rejects %s integer index with RangeError', (_label, index) => {
        expect(() => renameHeading([section('A', 'b'), section('C', 'd')], index, 'New')).toThrow(RangeError);
    });

    test('rejects any index into an empty section list with RangeError', () => {
        expect(() => renameHeading([], 0, 'New')).toThrow(RangeError);
    });

    test.each([
        ['numeric string', '0'],
        ['null', null],
        ['undefined', undefined],
        ['boxed Number', new Number(0)],
        ['bigint', 0n],
    ])('rejects non-number index (%s) with TypeError', (_label, index) => {
        expect(() => renameHeading([section('A', 'b')], index, 'New')).toThrow(TypeError);
    });

    test.each([
        ['empty', ''],
        ['whitespace-only', '   '],
        ['LF', 'New\nHeading'],
        ['CR', 'New\rHeading'],
        ['NUL', 'New\u0000Heading'],
        ['U+2028 line separator', 'New Heading'],
        ['U+2029 paragraph separator', 'New Heading'],
        ['number', 7],
        ['null', null],
        ['boxed String', new String('New')],
    ])('rejects invalid new heading (%s) with TypeError', (_label, heading) => {
        expect(() => renameHeading([section('A', 'b')], 0, heading)).toThrow(TypeError);
    });

    test('new heading length boundary: maxHeadingLength accepted, one more is RangeError', () => {
        const atLimit = 'n'.repeat(LIMITS.maxHeadingLength);
        expect(renameHeading([section('A', 'b')], 0, atLimit)[0].heading).toBe(atLimit);
        expect(() => renameHeading([section('A', 'b')], 0, `${atLimit}n`)).toThrow(RangeError);
    });

    test.each(invalidSectionCases())('validates every section first: rejects %s elsewhere with TypeError', (_label, make) => {
        expect(() => renameHeading([section('Target', 'ok'), make()], 0, 'New')).toThrow(TypeError);
    });

    test('rejects accessor fields on non-target sections without invoking the getter', () => {
        const { record, getter } = accessorSection('heading');
        expect(() => renameHeading([section('Target', 'ok'), record], 0, 'New')).toThrow(TypeError);
        expect(getter).not.toHaveBeenCalled();
    });

    test('rejects sparse arrays and non-array sections with TypeError', () => {
        const sparse = new Array(2);
        sparse[0] = section('A', 'b');
        expect(() => renameHeading(sparse, 0, 'New')).toThrow(TypeError);
        expect(() => renameHeading(null, 0, 'New')).toThrow(TypeError);
        expect(() => renameHeading({ 0: section('A', 'b'), length: 1 }, 0, 'New')).toThrow(TypeError);
    });

    test('section count boundary: maxSections accepted, one more is RangeError', () => {
        const atLimit = validSections(LIMITS.maxSections);
        expect(renameHeading(atLimit, LIMITS.maxSections - 1, 'Last')).toHaveLength(LIMITS.maxSections);
        expect(() => renameHeading(validSections(LIMITS.maxSections + 1), 0, 'New')).toThrow(RangeError);
    });

    test('revalidates oversized fields in other sections with RangeError', () => {
        const oversizedBody = section('Other', 'b'.repeat(LIMITS.maxBodyLength + 1));
        expect(() => renameHeading([section('Target', 'ok'), oversizedBody], 0, 'New')).toThrow(RangeError);
    });
});

describe('OPEMR-61 hardening: aggregate rename boundary, NUL in draft, error text', () => {
    // 10 sections of "H\n<body>" joined by "\n\n": 10 * 2 + 9 * 2 = 38 fixed chars.
    function sectionsAtDraftLimit() {
        const bodies = Array.from({ length: 10 }, () => LIMITS.maxBodyLength);
        bodies[9] = LIMITS.maxDraftLength - 38 - (9 * LIMITS.maxBodyLength);
        return bodies.map((len) => section('H', 'x'.repeat(len)));
    }

    function captureError(fn) {
        try {
            fn();
        } catch (error) {
            return error;
        }
        throw new Error('expected function to throw');
    }

    test('renameHeading aggregate boundary: same-length rename at maxDraftLength accepted, one more is RangeError', () => {
        const atLimit = sectionsAtDraftLimit();
        atLimit.forEach((s) => expect(s.body.length).toBeLessThanOrEqual(LIMITS.maxBodyLength));
        expect(renderTemplate(atLimit)).toHaveLength(LIMITS.maxDraftLength);

        const same = renameHeading(atLimit, 0, 'H');
        expect(same[0].heading).toBe('H');
        expect(renderTemplate(same)).toHaveLength(LIMITS.maxDraftLength);

        expect(() => renameHeading(sectionsAtDraftLimit(), 0, 'HH')).toThrow(RangeError);
    });

    test('an existing draft containing NUL is preserved exactly when appending []', () => {
        const existing = 'before\u0000after\u0000';
        expect(appendTemplate(existing, [])).toBe(existing);
    });

    test('an existing draft containing NUL is preserved exactly when appending a non-empty template', () => {
        const existing = 'before\u0000after\u0000';
        const out = appendTemplate(existing, [section('A', 'b')]);
        expect(out).toBe(`${existing}\n\nA\nb`);
        expect(out.startsWith(existing)).toBe(true);
    });

    test('thrown messages never quote supplied values', () => {
        const marker = 'ZZ_PRIVATE_MARKER_7Q3';
        const cases = [
            ['oversized heading', RangeError,
                () => renderTemplate([section(`${marker}${'h'.repeat(LIMITS.maxHeadingLength)}`, 'b')])],
            ['oversized body', RangeError,
                () => renderTemplate([section('H', `${marker}${'b'.repeat(LIMITS.maxBodyLength)}`)])],
            ['oversized body via appendTemplate', RangeError,
                () => appendTemplate('Draft', [section('H', `${marker}${'b'.repeat(LIMITS.maxBodyLength)}`)])],
            ['oversized new heading', RangeError,
                () => renameHeading([section('A', 'b')], 0, `${marker}${'n'.repeat(LIMITS.maxHeadingLength)}`)],
            ['unexpected extra field value', TypeError,
                () => renderTemplate([{ heading: 'A', body: 'b', extra: marker }])],
            ['unexpected extra field key', TypeError,
                () => renderTemplate([{ heading: 'A', body: 'b', [marker]: marker }])],
        ];
        cases.forEach(([label, ErrorType, fn]) => {
            const error = captureError(fn);
            expect({ label, isExpectedType: error instanceof ErrorType }).toEqual({ label, isExpectedType: true });
            expect(error.message).not.toContain(marker);
            expect(String(error)).not.toContain(marker);
        });
    });
});
