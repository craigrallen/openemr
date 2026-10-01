# Clinical UI — feature acceptance register

Date: 2026-10-02. Branch `feat/clinical-menu-launcher` (draft PR #4).

This register lists **all 22 features** from the original requirement document,
word for word in meaning, with their current evidence status. Nothing here is
deferred silently: each row says what exists, what is missing and what
acceptance test will close it. "Evidence" means an executed test or a verified
live check, not a mock, mockup or design reference.

Status values: **Not started** (no production code), **Partial** (some
production code with executed tests, acceptance not met), **Accepted**
(acceptance test executed and passed against a running OpenEMR). Today no row
is Accepted.

A separate standing requirement applies to every row: **no existing feature
may be dropped**. Old surfaces stay reachable until runtime parity (roles,
ACLs, facilities, configuration, module menu hooks, LBF and visit forms,
patient and encounter menus, in-page actions, CSRF, sessions, locked
encounters) is verified. Slice 1 (the "All menus" launcher) is additive and
does not establish parity; see [STATUS.md](STATUS.md).

## Patient records and clinical notes

| # | Feature | Status | Existing evidence | Acceptance test to close |
|---|---|---|---|---|
| 1 | Faster access to patient records | Not started | Slice 1 speeds up the **global menu** only; it does not index patients or patient menus, so it is not evidence for this row | E2E: from any screen, open a synthetic patient's record by name/DOB/ID in ≤ 2 interactions, ACL-filtered, identity banner shown |
| 2 | Document-style note editor with natural spacing, spell-check and autocorrect | Not started | — | E2E: compose and save an encounter note; browser spell-check active; lock/ESign respected; CSRF enforced |
| 3 | Visit-note templates with editable headings | Not started | — | E2E: insert template, rename a heading, save; template insertion only appends; stored note matches |
| 4 | Side-by-side access to notes or records while writing, without losing the draft | Not started | — | E2E: open reference pane for the same patient while drafting; draft intact after switching panes; no cross-patient content |
| 5 | Copy text from an existing record or note into a new note, source unchanged | Not started | — | E2E + DB check: copy from a signed note into a new draft; source row and audit unchanged |
| 6 | Patient-linked internal notes/messages between medical staff | Not started (core has patient notes/messages to build on) | — | E2E: staff A sends patient-linked message, staff B (permitted role) sees it, restricted role does not |

## Certificates

| # | Feature | Status | Existing evidence | Acceptance test to close |
|---|---|---|---|---|
| 7 | Create certificates for Swedish authorities within OpenEMR | Not started | Official-template collection area exists outside the repo (`certificates/official`), provenance not yet validated | Service test: certificate draft generated from patient/encounter data; never shown as submitted |
| 8 | Import and use Försäkringskassan certificate templates | Not started | — | Import test with an official template (source URL, retrieval date, document ID, version, SHA256 recorded); fields map and render |
| 9 | Digital handwritten-style signature using a method that meets the authority's requirements | Not started; **external gate** for signing | — | A drawn image is **not** accepted as electronic signing. Acceptance requires the authority-approved method; until onboarding, only unsigned drafts may be produced |

## Calendar, consultations and bookings

| # | Feature | Status | Existing evidence | Acceptance test to close |
|---|---|---|---|---|
| 10 | Offer video consultations from calendar bookings | Not started; provider contract needed for live calls | — | E2E: booking of type video exposes a join action; no live provider call in tests |
| 11 | View records and update notes during a video call | Not started | — | E2E: with a video session view open, record and note editor remain usable without losing either |
| 12 | Block patient-bookable time (meetings, lunch, admin, other) | Not started (core has non-patient categories to build on) | — | E2E: create block; portal/online booking cannot book inside it |
| 13 | Indefinitely recurring calendar blocks | Not started | — | Service test: recurrence with no end date expands correctly across a year boundary; edits by scope (this/future/all) |
| 14 | Detect and resolve booking conflicts | Not started | — | Service + E2E: overlapping booking is flagged with resolution options; audit kept |
| 15 | Make appointments easier to move | Not started | — | E2E: drag or "move" action reschedules with conflict check and audit |
| 16 | Configurable calendar colours by appointment type | Not started (core category colours to build on) | — | E2E: admin sets colour per type; calendar renders it; colour never the only signal |
| 17 | Mark no-shows directly in the calendar with a distinct colour | Not started | — | E2E: mark no-show from the calendar; status persisted; distinct colour plus text/icon |

## Payments and communication

| # | Feature | Status | Existing evidence | Acceptance test to close |
|---|---|---|---|---|
| 18 | Link every booking to its payment information and show amount paid | Not started | — | Service + E2E: booking shows linked payment total from existing billing data; no live gateway |
| 19 | Booking confirmations by SMS, email or both | Not started; **live sending is externally gated** | Railway test server blocks all outbound sends (see `docker/railway/README.md`) | Service test with a recording transport: channel choice honoured, consent checked; no message leaves the test server |
| 20 | Patient-to-booking-staff chat | Not started (portal messaging to build on) | — | E2E: portal patient message reaches booking staff queue; reply visible to patient |

## Documentation assistance

| # | Feature | Status | Existing evidence | Acceptance test to close |
|---|---|---|---|---|
| 21 | Speech to text during consultations | Not started; provider/consent contract needed for live audio | — | E2E with a synthetic audio fixture and a local test engine; no real recordings transmitted |
| 22 | AI-drafted consultation notes from transcriptions, clinician review and approval before entering the record | Not started; model-provider contract needed; no real records may be transmitted | — | E2E: draft is clearly marked, cannot enter the record without explicit clinician approval; approval audited |

## Supporting infrastructure (not one of the 22)

| Item | Status | Evidence |
|---|---|---|
| Railway test server built from this fork | In progress | Isolated tests and container acceptance (`docker/railway/acceptance-test.sh`); live deployment not yet verified — see [STATUS.md](STATUS.md) |
| Slice 1 "All menus" launcher | Partial (additive, CI pending) | Jest/jsdom tests; no live browser or parity check yet |
