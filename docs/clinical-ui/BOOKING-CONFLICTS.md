# Booking conflict detector (OPEMR-65)

| Item | Value |
|------|-------|
| Ticket | OPEMR-65 |
| Owner | Hermes, run 1 of max 2 |
| Scope | Feature 14: **partial, UNINTEGRATED foundation** |
| Production file | `interface/clinical-workspace/booking-conflicts.js` |
| Tests | `tests/js/booking-conflicts.test.js` (Jest) |

This adds one pure function, `detectBookingConflicts`. Nothing calls it yet. No UI, service,
network, DOM, storage, clock, PHP or database code was added or changed.

## Verification evidence

Controller-reported evidence. The tests are controller-owned.

- **RED (test-first):** tests-only commit `04be6c23` ("OPEMR-65 Add booking conflict foundation tests first"). Local Jest failed with a missing-module error before any production code existed: zero tests executed, one suite failed.
- **GREEN (focused):** 190/190 tests pass.
- **Complete suite:** 62/62 suites, 1449 tests pass.
- **Lint and diff:** rooted ESLint over the production file and the test file reports zero warnings, and the diffcheck passes.
- **Focused source coverage:** 98.52% statements, 96.92% branches, 100% functions, 98.5% lines. The one uncovered line is the comparator equality return, which is unreachable for validated unique IDs. No coverage oracle or exclusion was changed.
- **Evidence location:** outside the repo, in `/Users/craig/.hermes/projects/openemr/verification/booking-conflicts-20261020`.
- **Setup note:** the initial full-suite run failed because ESM dependencies were absent. 13 temporary links to existing sibling dependencies resolved that, and all 13 were removed. There was no install and no config change.
- **Independent review:** a Codex gpt-6-astra static review found no introduced P1 or P2 issues.

Hosted CI has not yet run and is pending. Nothing is merged or deployed. This document makes no native or runtime acceptance claim.

## Contract

```js
const { detectBookingConflicts } = require('./interface/clinical-workspace/booking-conflicts.js');
detectBookingConflicts(proposal, occurrences); // -> number[] of occurrence IDs
```

Records have exactly four own data properties: `id`, `providerId`, `startMs`, `endMs`.

| Field | Proposal | Occurrence |
|-------|----------|------------|
| `id` | `null` (new booking) or a positive safe integer (the occurrence being moved) | positive safe integer, unique in the array |
| `providerId` | non-negative safe integer; `0` means clinic-wide | same |
| `startMs`, `endMs` | integer UTC epoch milliseconds within the ECMAScript Date range (±8.64e15), with `startMs < endMs` | same |

- `occurrences` must be a dense array with at most 10,000 entries and no extra keys.
- A record must be a plain object (its prototype is `Object.prototype` or `null`). Accessor
  properties, symbol keys, unknown keys, boxed numbers, BigInts, strings and `Date`s are rejected.
- Each record and the array are read with `Reflect.ownKeys` and
  `Object.getOwnPropertyDescriptors`. The array cap and key count are checked first. Each index must
  be an own data property before its record is parsed. All entries are validated before any
  conflicts are calculated. Ordinary getters are never invoked, but Proxy limitations remain (see
  "Not handled here").
- Validation is all-or-nothing. If any entry is invalid or duplicated, the call throws a `TypeError`
  before computing anything, even when that entry is the self record or belongs to an unrelated
  provider. Error messages are fixed and never echo input values or key names.
- Inputs are not mutated. The result is a new array of IDs, not input records.

## Conflict semantics

- **Overlap:** half-open intervals, `a.startMs < b.endMs && b.startMs < a.endMs`. Intervals that
  only touch do not conflict.
- **Provider:** two bookings can conflict if their providers are equal, or if either one is `0`.
  This provider-0 rule comes from how the existing calendar layout treats provider 0. As conflict
  semantics it is **proposed only, pending product acceptance**.
- **Self-exclusion:** when moving a booking, the occurrence whose `id` equals `proposal.id` is
  skipped, but it is still validated. IDs identify individual **occurrences, not recurring
  series**. Self-exclusion is only meaningful if the caller has authenticated that the user may act
  on that occurrence. The function cannot check this.
- **Ordering:** results are sorted by `startMs` ascending, then `id` ascending. The comparison is
  relational rather than subtraction, so values at the extremes of the range sort correctly.
- **No inferred filtering:** there is no filtering by facility, room, resource, patient, recurrence
  or cancelled/status. Callers pass only the occurrences that should count.

## Not handled here

- Epoch times must be resolved correctly upstream. This function does not handle DST, recurrence
  expansion or date parsing.
- There is no automatic save, rejection or rescheduling, and no conflict-resolution UI.
- It is not an authoritative backend check and has no transaction or race guard, ACL, CSRF
  protection or audit. Clinicians have not accepted this behaviour.
- It is not a security boundary against hostile proxies, monkey-patched built-ins or mutable
  external realms. The input checks are for correctness, not hardening.

## Why `CalendarViewModel.detectEventOverlap` is unchanged

That existing helper deals with layout geometry only: placing visually overlapping events
side by side on the calendar. Booking conflicts are a different question, and they need provider
matching, self-exclusion and strict input rejection. Changing the layout helper would risk calendar
rendering regressions for no benefit. The new detector is kept separate, and the layout code is
untouched.

## Still open

- All 22 features, UI integration, the demo and the Swedish items remain **OPEN**.
- Product acceptance of the provider-0 conflict rule.
- Hosted CI, not yet run and pending.
- Native OpenEMR integration, plus the clinician, authority, transaction, race, ACL, CSRF, audit,
  recurrence, timezone, facility and provider-policy gates, all still open.
- No production data, application bootstrap, database writes, live national or vendor calls,
  merge, deploy, master, policy or cron changes were part of this work.
