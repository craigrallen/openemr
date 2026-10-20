/**
 * OPEMR-61: dependency-free plain-text helpers for visit-note template drafts
 * with editable headings and append-only insertion.
 *
 * Pure CommonJS functions with no imports, no globals and no side effects on
 * load. Output is plain text: it is NOT sanitised HTML and must be escaped by
 * whatever eventually displays it. See docs/clinical-ui/NOTE-TEMPLATE-DRAFT.md.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

'use strict';

// Lengths are measured in UTF-16 code units (String.prototype.length).
const LIMITS = Object.freeze({
    maxSections: 64,
    maxHeadingLength: 200,
    maxBodyLength: 100000,
    maxDraftLength: 1000000,
});

const HEADING_BODY_SEPARATOR = '\n';
const SECTION_SEPARATOR = '\n\n';
const APPEND_SEPARATOR = '\n\n';

// NUL, CR, LF, LINE SEPARATOR, PARAGRAPH SEPARATOR.
const FORBIDDEN_HEADING_CHARS = ['\u0000', '\r', '\n', ' ', ' '];

/**
 * Read an own data property through its descriptor so accessors are rejected
 * without being invoked. Error messages name the field, never its contents.
 */
function ownDataValue(target, key, label) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (descriptor === undefined) {
        throw new TypeError(`${label} must be an own property`);
    }
    if (!('value' in descriptor)) {
        throw new TypeError(`${label} must be a data property, not an accessor`);
    }
    return descriptor.value;
}

function checkHeading(value, label) {
    if (typeof value !== 'string') {
        throw new TypeError(`${label} must be a primitive string`);
    }
    if (value.length > LIMITS.maxHeadingLength) {
        throw new RangeError(`${label} exceeds maxHeadingLength`);
    }
    if (value.trim() === '') {
        throw new TypeError(`${label} must not be blank`);
    }
    for (const ch of FORBIDDEN_HEADING_CHARS) {
        if (value.indexOf(ch) !== -1) {
            throw new TypeError(`${label} must be a single line without NUL`);
        }
    }
    return value;
}

function checkBody(value, label) {
    if (typeof value !== 'string') {
        throw new TypeError(`${label} must be a primitive string`);
    }
    if (value.length > LIMITS.maxBodyLength) {
        throw new RangeError(`${label} exceeds maxBodyLength`);
    }
    if (value.indexOf('\u0000') !== -1) {
        throw new TypeError(`${label} must not contain NUL`);
    }
    return value;
}

/**
 * Validate one caller record and copy it into a fresh plain object.
 * Accepted records are ordinary or null-prototype objects whose only own
 * keys are the data properties `heading` and `body`.
 */
function snapshotSection(record, label) {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
        throw new TypeError(`${label} must be a plain object`);
    }
    const proto = Object.getPrototypeOf(record);
    if (proto !== Object.prototype && proto !== null) {
        throw new TypeError(`${label} must have an ordinary or null prototype`);
    }
    if (Reflect.ownKeys(record).length !== 2) {
        throw new TypeError(`${label} must have exactly the own keys heading and body`);
    }
    const heading = ownDataValue(record, 'heading', `${label}.heading`);
    const body = ownDataValue(record, 'body', `${label}.body`);
    return {
        heading: checkHeading(heading, `${label}.heading`),
        body: checkBody(body, `${label}.body`),
    };
}

/**
 * Validate every supplied section (count first, then each index) and return
 * fresh copies. Callers' objects are never read again after this returns.
 */
function snapshotSections(sections) {
    if (!Array.isArray(sections)) {
        throw new TypeError('sections must be an array');
    }
    const length = ownDataValue(sections, 'length', 'sections.length');
    if (length > LIMITS.maxSections) {
        throw new RangeError('sections exceeds maxSections');
    }
    const snapshot = [];
    for (let i = 0; i < length; i++) {
        const label = `sections[${i}]`;
        snapshot.push(snapshotSection(ownDataValue(sections, i, label), label));
    }
    return snapshot;
}

/** Length of the rendered text, checked against maxDraftLength before any concatenation. */
function renderedLength(snapshot) {
    let total = 0;
    snapshot.forEach((section, i) => {
        if (i > 0) {
            total += SECTION_SEPARATOR.length;
        }
        total += section.heading.length + HEADING_BODY_SEPARATOR.length + section.body.length;
    });
    if (total > LIMITS.maxDraftLength) {
        throw new RangeError('rendered template exceeds maxDraftLength');
    }
    return total;
}

function renderSnapshot(snapshot) {
    return snapshot
        .map((section) => section.heading + HEADING_BODY_SEPARATOR + section.body)
        .join(SECTION_SEPARATOR);
}

/**
 * Render sections as "heading\nbody" blocks joined by a blank line.
 *
 * @param {Array<{heading: string, body: string}>} sections
 * @returns {string}
 */
function renderTemplate(sections) {
    const snapshot = snapshotSections(sections);
    renderedLength(snapshot);
    return renderSnapshot(snapshot);
}

/**
 * Append a rendered template to an existing draft without altering any of
 * the draft's existing characters. A blank-line separator is inserted only
 * when both the draft and the rendered template are non-empty.
 *
 * @param {string} existingDraft
 * @param {Array<{heading: string, body: string}>} sections
 * @returns {string}
 */
function appendTemplate(existingDraft, sections) {
    if (typeof existingDraft !== 'string') {
        throw new TypeError('existingDraft must be a primitive string');
    }
    if (existingDraft.length > LIMITS.maxDraftLength) {
        throw new RangeError('existingDraft exceeds maxDraftLength');
    }
    const snapshot = snapshotSections(sections);
    const templateLength = renderedLength(snapshot);
    if (templateLength === 0) {
        return existingDraft;
    }
    const separator = existingDraft.length > 0 ? APPEND_SEPARATOR : '';
    if (existingDraft.length + separator.length + templateLength > LIMITS.maxDraftLength) {
        throw new RangeError('appended draft exceeds maxDraftLength');
    }
    return existingDraft + separator + renderSnapshot(snapshot);
}

/**
 * Return a new array of new section objects with one heading replaced.
 * Every section is validated first; the result is validated as a whole.
 *
 * @param {Array<{heading: string, body: string}>} sections
 * @param {number} index
 * @param {string} newHeading
 * @returns {Array<{heading: string, body: string}>}
 */
function renameHeading(sections, index, newHeading) {
    const snapshot = snapshotSections(sections);
    if (typeof index !== 'number') {
        throw new TypeError('index must be a primitive number');
    }
    if (!Number.isInteger(index) || index < 0 || index >= snapshot.length) {
        throw new RangeError('index is out of range');
    }
    const heading = checkHeading(newHeading, 'newHeading');
    const result = snapshot.map((section, i) => ({
        heading: i === index ? heading : section.heading,
        body: section.body,
    }));
    renderedLength(result);
    return result;
}

module.exports = Object.freeze({
    LIMITS,
    renderTemplate,
    appendTemplate,
    renameHeading,
});
