/**
 * Pure booking-conflict detector for the clinical workspace (OPEMR-65).
 *
 * detectBookingConflicts(proposal, occurrences) compares one proposed
 * provider interval against already-expanded occurrences using half-open
 * integer UTC-millisecond intervals and returns the IDs of conflicting
 * occurrences. It performs no I/O and is not a scheduling authority or a
 * live booking guard; time zone resolution and recurrence expansion belong
 * to the caller.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    Craig Allen <craig@interconnected.au>
 * @copyright Copyright (c) 2026 Craig Allen
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

'use strict';

const MAX_OCCURRENCES = 10000;
// ECMAScript Date range limit, in milliseconds either side of the epoch.
const MAX_ABS_EPOCH_MS = 8640000000000000;
// Provider 0 is a clinic-wide booking that conflicts with every provider.
const CLINIC_WIDE_PROVIDER = 0;
const RECORD_KEYS = ['id', 'providerId', 'startMs', 'endMs'];

const PROPOSAL_ERROR = 'Invalid booking proposal.';
const COLLECTION_ERROR = 'Invalid occurrences collection.';
const OCCURRENCE_ERROR = 'Invalid occurrence record.';
const DUPLICATE_ERROR = 'Duplicate occurrence id.';

function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function isPlainObject(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function isPositiveId(value) {
    return Number.isSafeInteger(value) && value > 0;
}

function isEpochMs(value) {
    return Number.isSafeInteger(value) && value >= -MAX_ABS_EPOCH_MS && value <= MAX_ABS_EPOCH_MS;
}

/**
 * Snapshot a record's own data properties without invoking any accessor,
 * then validate the snapshot. Exactly the four record keys are allowed.
 */
function parseRecord(value, allowNullId, errorMessage) {
    if (!isPlainObject(value)) {
        throw new TypeError(errorMessage);
    }
    const keys = Reflect.ownKeys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (keys.length !== RECORD_KEYS.length) {
        throw new TypeError(errorMessage);
    }

    const snapshot = {};
    for (const key of RECORD_KEYS) {
        if (!hasOwn(descriptors, key) || !hasOwn(descriptors[key], 'value')) {
            throw new TypeError(errorMessage);
        }
        snapshot[key] = descriptors[key].value;
    }

    const idIsValid = isPositiveId(snapshot.id) || (allowNullId && snapshot.id === null);
    const providerIsValid = Number.isSafeInteger(snapshot.providerId) && snapshot.providerId >= 0;
    const rangeIsValid = isEpochMs(snapshot.startMs) && isEpochMs(snapshot.endMs)
        && snapshot.startMs < snapshot.endMs;
    if (!idIsValid || !providerIsValid || !rangeIsValid) {
        throw new TypeError(errorMessage);
    }
    return snapshot;
}

/**
 * Validate the collection as a dense array of data entries with no extra
 * keys, within the size cap, then parse every entry and reject duplicate IDs.
 */
function parseOccurrences(occurrences) {
    if (!Array.isArray(occurrences)) {
        throw new TypeError(COLLECTION_ERROR);
    }
    const length = Object.getOwnPropertyDescriptor(occurrences, 'length').value;
    if (length > MAX_OCCURRENCES) {
        throw new TypeError(COLLECTION_ERROR);
    }
    const keys = Reflect.ownKeys(occurrences);
    const descriptors = Object.getOwnPropertyDescriptors(occurrences);
    // Every index plus 'length', and nothing else.
    if (keys.length !== length + 1) {
        throw new TypeError(COLLECTION_ERROR);
    }

    const records = [];
    const seenIds = new Set();
    for (let index = 0; index < length; index++) {
        const key = String(index);
        if (!hasOwn(descriptors, key) || !hasOwn(descriptors[key], 'value')) {
            throw new TypeError(COLLECTION_ERROR);
        }
        const record = parseRecord(descriptors[key].value, false, OCCURRENCE_ERROR);
        if (seenIds.has(record.id)) {
            throw new TypeError(DUPLICATE_ERROR);
        }
        seenIds.add(record.id);
        records.push(record);
    }
    return records;
}

function providersCanConflict(a, b) {
    return a === b || a === CLINIC_WIDE_PROVIDER || b === CLINIC_WIDE_PROVIDER;
}

function intervalsOverlap(a, b) {
    return a.startMs < b.endMs && b.startMs < a.endMs;
}

function compareByStartThenId(a, b) {
    if (a.startMs !== b.startMs) {
        return a.startMs < b.startMs ? -1 : 1;
    }
    if (a.id !== b.id) {
        return a.id < b.id ? -1 : 1;
    }
    return 0;
}

/**
 * @param {{id: ?number, providerId: number, startMs: number, endMs: number}} proposal
 *        id is null for a new booking, or the occurrence ID being moved.
 * @param {Array<{id: number, providerId: number, startMs: number, endMs: number}>} occurrences
 * @returns {number[]} conflicting occurrence IDs, ordered by startMs then id
 * @throws {TypeError} on any malformed input; nothing is computed in that case
 */
function detectBookingConflicts(proposal, occurrences) {
    const target = parseRecord(proposal, true, PROPOSAL_ERROR);
    const existing = parseOccurrences(occurrences);

    return existing
        .filter((occurrence) => occurrence.id !== target.id
            && providersCanConflict(target.providerId, occurrence.providerId)
            && intervalsOverlap(target, occurrence))
        .sort(compareByStartThenId)
        .map((occurrence) => occurrence.id);
}

if (typeof module === 'object' && module !== null && module.exports) {
    module.exports = { detectBookingConflicts };
}
