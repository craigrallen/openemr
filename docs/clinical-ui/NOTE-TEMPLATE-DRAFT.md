# OPEMR-61: Visit-note template draft helpers

Status: **unintegrated transformation foundation, run 1 of max 2, awaiting
ordinary review.** This change adds three files: a small, pure JavaScript
module, its Jest tests, and this document. It does not merge, deploy, or change
any running screen.

- Module: `interface/clinical-workspace/note-template-draft.js`
- Tests: `tests/js/note-template-draft.test.js` (committed first, in the
  tests-only commit `dd9f9884`)

Verification (targeted and full Jest, lint), independent review, commit, push,
the draft PR and CI belong to the controller. This document does not record any
test or CI result. Look for those in the PR and the controller's verification
log.

## Why it exists

Clinicians asked for visit-note templates whose section headings they can edit,
inserted into a draft without overwriting anything they have already typed.
This module covers only the text transformation:

1. render an ordered list of `{ heading, body }` sections to plain text;
2. append that text to an existing draft so the existing text is never
   altered (append-only);
3. rename one section heading, returning new copies.

Validation is strict and bounded. What a later integration may rely on is
narrow: at the moment a call returns, its result has the documented shape and
fits the documented UTF-16 limits. That is all. Arrays and objects returned by
`renameHeading` are ordinary mutable values, so the guarantee does not survive
later mutation by any code holding them. An integration must revalidate the
current data before using it, and must apply its own storage limits,
authorisation and clinical-context checks. Nothing here replaces those.

## Scope and non-claims

The foundation is deliberately narrow. It has:

- **No UI, asset or loader integration.** Nothing loads the module in a
  browser. It registers no globals and touches no DOM, storage, network or
  clock. Loading it has no application side effects: it only allocates its
  constants and functions and sets `module.exports`.
- **No save integration.** It does not read or write the database, session,
  encounter or patient. It does not call PHP, and no PHP, native or browser
  code calls it.
- **No clinical claims.** It has not been tested with clinicians or live data,
  and nothing here validates clinical content.
- **Not the accepted "feature 3".** This is a building block, not the
  delivered feature. Shared acceptance and status documents owned by parked PRs
  are deliberately left untouched.
- **Existing source unchanged.** The SOAP form and every other existing file
  stay as they were. The only additions are the module, its tests
  (`tests/js/note-template-draft.test.js`) and this document.

### Constraints for a future integration

The existing SOAP form has **four fixed fields with fixed labels**
(Subjective, Objective, Assessment, Plan). It sits behind OpenEMR's existing
save path, dirty tracking, form locking, e-signature, session, CSRF, and
patient/encounter checks. Any integration must:

- define an explicit mapping from template sections to storage fields. It must
  not, for example, pour freely named sections into four fixed columns without
  saying so;
- store user-edited headings as data in their own right, and **must not
  silently relabel clinical schema**. A heading renamed to "Assessment &
  Differential" does not rename the stored `assessment` field;
- go through, and not bypass, the existing save, dirty-tracking, lock,
  e-signature, session, CSRF and patient/encounter gates;
- escape the output for its display context (see below).

The wider programme (the all-22 / researched UI work, the demo, the exhaustive
popup work, and the Swedish localisation) remains open and is not affected by
this change.

## API

```js
const {
    renderTemplate, appendTemplate, renameHeading, LIMITS,
} = require('./interface/clinical-workspace/note-template-draft.js');
```

All examples use synthetic strings only.

### `LIMITS` (frozen)

| Name               | Value     | Applies to                              |
|--------------------|-----------|-----------------------------------------|
| `maxSections`      | 64        | entries in a sections array             |
| `maxHeadingLength` | 200       | each heading, including a new heading   |
| `maxBodyLength`    | 100000    | each body                               |
| `maxDraftLength`   | 1000000   | an existing draft, rendered text, and appended result |

All lengths are **UTF-16 code units** (`String.prototype.length`), not bytes,
code points or grapheme clusters. An astral character such as `🩺` counts as 2.
A decomposed `e` + U+0301 counts as 2. Exactly the limit is accepted; one more
code unit is rejected. `LIMITS` is frozen, so mutating it fails and the
enforced bounds stay the same.

### `renderTemplate(sections) → string`

Each section becomes `heading + "\n" + body`. Sections are joined with
`"\n\n"`. Nothing else is added: no trailing newline, trimming or
normalisation.

```js
renderTemplate([
    { heading: 'Subjective', body: 'Synthetic complaint text.' },
    { heading: 'Plan', body: '' },
]);
// 'Subjective\nSynthetic complaint text.\n\nPlan\n'

renderTemplate([]); // ''
```

Rendered length = sum of `heading.length + 1 + body.length` over all sections,
plus `2 × (n − 1)` separator units. It must not exceed `maxDraftLength`.

### `appendTemplate(existingDraft, sections) → string`

Returns `existingDraft + separator + renderTemplate(sections)`:

- every existing character is kept exactly, including leading or trailing
  whitespace, CRLF, trailing newlines and any NUL already in the draft. The
  draft is never trimmed or rewritten;
- `separator` is `"\n\n"` only when the draft is non-empty **and** the rendered
  template is non-empty. A whitespace-only draft such as `"\n"` counts as
  non-empty;
- an empty `sections` list returns `existingDraft` unchanged, but only after
  the draft's type and length have been checked.

```js
appendTemplate('', [{ heading: 'A', body: 'b' }]);         // 'A\nb'
appendTemplate('Prior text', [{ heading: 'A', body: 'b' }]); // 'Prior text\n\nA\nb'
appendTemplate('Keep\r\n\n', []);                            // 'Keep\r\n\n'
```

`existingDraft.length` must not exceed `maxDraftLength`, and neither may the
full result. Both are checked before the result string is built.

### `renameHeading(sections, index, newHeading) → Array`

Returns a **new array of new section objects**. Every object is a fresh plain
object with exactly the own data properties `heading` and `body`, even when the
heading is unchanged. Only `result[index].heading` differs from the input.
Every input section is validated, including sections other than the target,
and the resulting list must still render within `maxDraftLength`.

```js
renameHeading(
    [{ heading: 'S', body: 'synthetic' }, { heading: 'P', body: '' }],
    0,
    'Subjective',
);
// [{ heading: 'Subjective', body: 'synthetic' }, { heading: 'P', body: '' }]
```

## Input rules

A **sections** argument must be a real array (`Array.isArray`). Array-likes
are rejected. Its `length` is checked against `maxSections` before any element
is read. Each index must be an own data property, so holes, indexes filled
from the prototype, and accessor elements are rejected.

Each **section record** must:

- be a non-null, non-array object whose prototype is `Object.prototype` or
  `null`. Class instances and other prototype chains are rejected;
- have exactly two own keys, `heading` and `body`, both data properties.
  Missing keys, extra keys (including an own `__proto__`, `constructor`,
  `prototype` or symbol key) and accessors are rejected;
- have a **heading** that is a primitive string (boxed `String` is rejected),
  is not blank after `trim()`, is a single line with no CR, LF, U+2028 or
  U+2029, contains no NUL, and is at most `maxHeadingLength` long;
- have a **body** that is a primitive string with no NUL and at most
  `maxBodyLength` long. Bodies may be empty and may contain any newlines.

**`existingDraft`** must be a primitive string. Its content is not otherwise
checked.

**`index`** must be a primitive `number`. Strings, `null`, `undefined`, boxed
`Number` and `bigint` are rejected with `TypeError`. It must be an integer in
`[0, sections.length)`; any other primitive number, including `NaN`,
`Infinity`, fractional and negative values, is rejected with `RangeError`.

**`newHeading`** follows the same rules as any heading.

Property descriptors are read with `Object.getOwnPropertyDescriptor`, so an
ordinary getter is rejected **without being called**. Inputs are copied into
fresh objects once, and caller objects are not read again after validation.
Inputs, including frozen and null-prototype ones, are never mutated.

## Errors

- `TypeError` for a wrong type, wrong shape or forbidden content.
- `RangeError` for any exceeded limit, and for any primitive-number `index`
  that is not a valid position: an integer outside the array, or `NaN`,
  `±Infinity` or a fractional value.

Validation is all-or-nothing. An invalid record anywhere in the list, even
after valid records or in an otherwise empty-looking call, throws before any
output is produced, and nothing is partially returned. Error messages name the
offending field (for example `sections[1].heading`) but never echo the
supplied text.

## Output is plain text, not safe HTML

Text such as `<script>`, `&amp;` or `__proto__` passes through **unchanged as
literal text**. The module does no escaping or sanitisation and makes no claim
that its output is safe markup. Any consumer that puts the output into HTML
must escape it for that context, for example by assigning it as text rather
than markup.

## Limitations

- Limits count UTF-16 code units. They are not byte limits for storage
  columns, and a future integration must check its own storage limits.
- Unicode is not normalised. Precomposed and decomposed forms are kept as
  supplied and count differently.
- Descriptor-based validation defends against ordinary accessors and
  prototype tricks. It is **not a sandbox**. A hostile `Proxy` can run code in
  its traps (`getPrototypeOf`, `ownKeys`, `getOwnPropertyDescriptor`) or report
  inconsistent results. The module does not claim to prevent untrusted code
  from running when it is passed arbitrary JavaScript values. Pass it data
  from trusted code paths.
- Prototype checks compare against the current realm's `Object.prototype`, so
  plain objects created in another realm (an iframe, for example) are
  rejected.
- No persistence, undo history, concurrency handling or field mapping.
  Those belong to a future integration.
