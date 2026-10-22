/** @jest-environment node */

// OPEMR-40: client-side review boundary only. All fixture content is synthetic.
const { createAiNoteReview } = require('../../interface/clinical-workspace/ai-note-review');

const context = (overrides = {}) => ({
    patientId: '123',
    encounterId: '456',
    draftRevision: 'draft-v1',
    transcriptRevision: 'transcript-v1',
    ...overrides,
});

const approved = (review, ticket, currentContext = context(), revision = 1) =>
    review.approve(ticket, currentContext, revision, true);

describe('AI note review boundary', () => {
    test('exports independent review instances with the specified operations', () => {
        expect(typeof createAiNoteReview).toBe('function');
        const first = createAiNoteReview();
        const second = createAiNoteReview();
        expect(first).not.toBe(second);
        for (const name of ['propose', 'revise', 'approve', 'reject', 'dispose']) {
            expect(typeof first[name]).toBe('function');
        }
        expect(first.commit).toBeUndefined();
        expect(first.save).toBeUndefined();
        expect(first.sign).toBeUndefined();
    });

    test('propose, revise and explicit approval release the exact reviewed plaintext once', () => {
        const review = createAiNoteReview();
        const ticket = review.propose(context(), 'Synthetic draft');
        expect(ticket).not.toBeNull();
        expect(typeof ticket).toBe('object');
        expect(ticket.text).toBeUndefined();
        expect(approved(review, ticket, context(), 0)).toBeNull();
        expect(review.revise(ticket, 'Revised synthetic draft')).toBe(2);
        expect(approved(review, ticket, context(), 1)).toBeNull();
        const result = approved(review, ticket, context(), 2);
        expect(result).toEqual({
            text: 'Revised synthetic draft',
            patientId: '123',
            encounterId: '456',
            draftRevision: 'draft-v1',
            transcriptRevision: 'transcript-v1',
            origin: 'ai-draft',
            reviewed: true,
        });
        expect(Object.isFrozen(result)).toBe(true);
        expect(approved(review, ticket, context(), 2)).toBeNull();
        expect(review.revise(ticket, 'Too late')).toBe(false);
    });

    test('approval requires literal true and the exact positive integer revision', () => {
        const review = createAiNoteReview();
        const ticket = review.propose(context(), 'Synthetic draft');
        for (const flag of [undefined, false, 1, 'true', new Boolean(true)]) {
            expect(review.approve(ticket, context(), 1, flag)).toBeNull();
        }
        for (const revision of [undefined, null, 0, 1.5, '1', 2, NaN, Infinity]) {
            expect(review.approve(ticket, context(), revision, true)).toBeNull();
        }
        expect(approved(review, ticket)).not.toBeNull();
    });

    test('accepts only canonical positive string IDs and bounded opaque revision strings', () => {
        const invalidIds = ['', '0', '00', '01', '-1', '+1', '1.0', ' 1', '1 ', '1e2', 1, new String('1'), null];
        for (const field of ['patientId', 'encounterId']) {
            for (const value of invalidIds) {
                const review = createAiNoteReview();
                expect(review.propose(context({ [field]: value }), 'Synthetic draft')).toBeNull();
            }
        }
        const invalidRevisions = ['', ' ', '\n\t', ' revision', 'revision ', 'a b', 1, new String('v1'), null, 'x'.repeat(257)];
        for (const field of ['draftRevision', 'transcriptRevision']) {
            for (const value of invalidRevisions) {
                const review = createAiNoteReview();
                expect(review.propose(context({ [field]: value }), 'Synthetic draft')).toBeNull();
            }
        }
        const review = createAiNoteReview();
        const exact = context({ draftRevision: 'a'.repeat(256), transcriptRevision: 'β-2/etag' });
        const ticket = review.propose(exact, 'Synthetic draft');
        expect(ticket).not.toBeNull();
        expect(approved(review, ticket, { ...exact })).toMatchObject(exact);
    });

    test('invalid propose clears the previous candidate, including malformed and throwing snapshots', () => {
        const throwingProxy = new Proxy(context(), {
            get() { throw new Error('synthetic get trap'); },
            getPrototypeOf() { throw new Error('synthetic prototype trap'); },
            ownKeys() { throw new Error('synthetic keys trap'); },
            getOwnPropertyDescriptor() { throw new Error('synthetic descriptor trap'); },
        });
        const invalid = [null, undefined, [], new Date(), {}, context({ patientId: '0' }), throwingProxy];
        for (const badContext of invalid) {
            const review = createAiNoteReview();
            const old = review.propose(context(), 'Old synthetic draft');
            let result;
            expect(() => { result = review.propose(badContext, 'New synthetic draft'); }).not.toThrow();
            expect(result).toBeNull();
            expect(approved(review, old)).toBeNull();
        }
        const review = createAiNoteReview();
        const old = review.propose(context(), 'Old synthetic draft');
        const throwing = { ...context(), get encounterId() { throw new Error('synthetic getter'); } };
        expect(() => review.propose(throwing, 'New synthetic draft')).not.toThrow();
        expect(approved(review, old)).toBeNull();
    });

    test('invalid text fails closed and invalid revision of the current ticket cancels it', () => {
        const invalidText = [undefined, null, '', ' \n\t', 42, new String('text'), {}, 'x'.repeat(100001)];
        for (const value of invalidText) {
            const review = createAiNoteReview();
            const old = review.propose(context(), 'Old synthetic draft');
            let proposed;
            expect(() => { proposed = review.propose(context(), value); }).not.toThrow();
            expect(proposed).toBeNull();
            expect(approved(review, old)).toBeNull();
            const ticket = review.propose(context(), 'New synthetic draft');
            let result;
            expect(() => { result = review.revise(ticket, value); }).not.toThrow();
            expect(result).toBe(false);
            expect(approved(review, ticket)).toBeNull();
        }
        const review = createAiNoteReview();
        const ticket = review.propose(context(), 'x'.repeat(100000));
        expect(ticket).not.toBeNull();
        expect(review.revise(ticket, 'y'.repeat(100000))).toBe(2);
        expect(approved(review, ticket, context(), 2).text).toHaveLength(100000);
    });

    test('Unicode, markup and control characters remain exact inert plaintext', () => {
        const review = createAiNoteReview();
        const text = '患者 🩺\n<script>alert("synthetic")</script>\u0000 & <b>literal</b>';
        const ticket = review.propose(context(), text);
        expect(approved(review, ticket).text).toBe(text);
    });

    test('replacement and rejection cancel the current candidate without reviving stale tickets', () => {
        const review = createAiNoteReview();
        const old = review.propose(context(), 'Old synthetic draft');
        const current = review.propose(context(), 'Current synthetic draft');
        expect(current).not.toBe(old);
        expect(review.revise(old, 'Stale edit')).toBe(false);
        expect(approved(review, old)).toBeNull();
        review.reject(old);
        expect(approved(review, current).text).toBe('Current synthetic draft');

        const cancelled = review.propose(context(), 'Cancelled synthetic draft');
        review.reject(cancelled);
        expect(approved(review, cancelled)).toBeNull();
        expect(review.revise(cancelled, 'After rejection')).toBe(false);
    });

    test('tickets are unforgeable identities local to their instance', () => {
        const first = createAiNoteReview();
        const second = createAiNoteReview();
        const ticket = first.propose(context(), 'Synthetic draft');
        const copy = { ...ticket };
        const clone = Object.assign(Object.create(Object.getPrototypeOf(ticket)), ticket);
        for (const foreign of [copy, clone, {}, null, second.propose(context(), 'Other draft')]) {
            expect(first.revise(foreign, 'Forged edit')).toBe(false);
            expect(approved(first, foreign)).toBeNull();
            first.reject(foreign);
        }
        expect(approved(first, ticket).text).toBe('Synthetic draft');
        expect(approved(second, ticket)).toBeNull();
    });

    test('any context change or malformed current snapshot invalidates pending approval', () => {
        const changes = [
            { patientId: '124' }, { encounterId: '457' },
            { draftRevision: 'draft-v2' }, { transcriptRevision: 'transcript-v2' },
            { patientId: 123 }, { encounterId: '01' }, { draftRevision: ' ' },
        ];
        for (const change of changes) {
            const review = createAiNoteReview();
            const ticket = review.propose(context(), 'Synthetic draft');
            expect(approved(review, ticket, context(change))).toBeNull();
            expect(approved(review, ticket, context())).toBeNull();
        }
        const throwingProxy = new Proxy(context(), {
            get() { throw new Error('synthetic get trap'); },
            getPrototypeOf() { throw new Error('synthetic prototype trap'); },
            ownKeys() { throw new Error('synthetic keys trap'); },
            getOwnPropertyDescriptor() { throw new Error('synthetic descriptor trap'); },
        });
        for (const bad of [null, {}, [], { ...context(), get draftRevision() { throw Error('synthetic'); } }, throwingProxy]) {
            const review = createAiNoteReview();
            const ticket = review.propose(context(), 'Synthetic draft');
            expect(() => approved(review, ticket, bad)).not.toThrow();
            expect(approved(review, ticket, context())).toBeNull();
        }
    });

    test('snapshots and released values are isolated from caller mutation', () => {
        const review = createAiNoteReview();
        const input = context();
        const ticket = review.propose(input, 'Synthetic draft');
        input.patientId = '999';
        input.draftRevision = 'draft-v2';
        const output = approved(review, ticket, context());
        expect(output.patientId).toBe('123');
        expect(output.draftRevision).toBe('draft-v1');
        expect(Reflect.set(output, 'text', 'Mutated')).toBe(false);
        expect(output.text).toBe('Synthetic draft');
    });

    test('getter reentrancy cannot approve a candidate replaced, revised or disposed during context read', () => {
        for (const action of ['replace', 'revise', 'dispose']) {
            const review = createAiNoteReview();
            const ticket = review.propose(context(), 'Original synthetic draft');
            let reads = 0;
            const reentrant = { ...context(), get patientId() {
                reads += 1;
                if (action === 'replace') review.propose(context(), 'Replacement draft');
                if (action === 'revise') review.revise(ticket, 'Revised draft');
                if (action === 'dispose') review.dispose();
                return '123';
            } };
            let outerResult;
            expect(() => { outerResult = approved(review, ticket, reentrant); }).not.toThrow();
            expect(outerResult).toBeNull();
            expect(reads).toBeGreaterThan(0);
            expect(approved(review, ticket)).toBeNull();
        }
    });

    test('nested approval during a context getter releases once and leaves the outer approval stale', () => {
        const review = createAiNoteReview();
        const ticket = review.propose(context(), 'Synthetic draft');
        const releases = [];
        const reentrant = { ...context(), get patientId() {
            releases.push(approved(review, ticket, context()));
            return '123';
        } };
        let outerResult;
        expect(() => { outerResult = approved(review, ticket, reentrant); }).not.toThrow();
        expect(releases).toHaveLength(1);
        expect(releases[0].text).toBe('Synthetic draft');
        expect(outerResult).toBeNull();
        expect(approved(review, ticket)).toBeNull();
    });

    test('getter-reentrant proposal disposal or replacement cannot be overwritten by the outer proposal', () => {
        for (const action of ['dispose', 'replace']) {
            const review = createAiNoteReview();
            const old = review.propose(context(), 'Old synthetic draft');
            let firstReentrantApproval;
            let nestedTicket;
            let reads = 0;
            const reentrant = { ...context(), get patientId() {
                reads += 1;
                if (reads === 1) {
                    firstReentrantApproval = approved(review, old);
                    if (action === 'dispose') review.dispose();
                    if (action === 'replace') nestedTicket = review.propose(context(), 'Nested synthetic draft');
                }
                return '123';
            } };
            let outerTicket;
            expect(() => { outerTicket = review.propose(reentrant, 'Outer synthetic draft'); }).not.toThrow();
            expect(reads).toBeGreaterThan(0);
            expect(firstReentrantApproval).toBeNull();
            expect(outerTicket).toBeNull();
            expect(approved(review, old)).toBeNull();
            if (action === 'replace') {
                expect(nestedTicket).not.toBeNull();
                expect(approved(review, nestedTicket).text).toBe('Nested synthetic draft');
            } else {
                expect(review.propose(context(), 'After disposal')).toBeNull();
            }
        }
    });

    test('dispose is idempotent, clears pending text and permanently disables operations', () => {
        const review = createAiNoteReview();
        const ticket = review.propose(context(), 'Synthetic draft');
        review.dispose();
        review.dispose();
        expect(approved(review, ticket)).toBeNull();
        expect(review.revise(ticket, 'New text')).toBe(false);
        expect(review.propose(context(), 'New text')).toBeNull();
        review.reject(ticket);
        expect(review.propose(context(), 'Still disabled')).toBeNull();
    });
});
