# Telehealth participant activity parsing (OPEMR-103)

## Rationale and scope

The Comlink sparse participant list reports whether the provider and any present patient participants are in the room. Its `last_update` value comes from session data. PHP's date parser can normalize invalid calendar values, return `false`, or throw on a NUL byte. Passing those values into the activity comparison can incorrectly report `Y` or interrupt polling.

This change is limited to `ParticipantListService::sessionUserInRoom` and isolated tests of the real sparse public API. A truthy start time and truthy last update remain the entry gate. A nonempty last update must be a string without a NUL byte or zero year. Parsing with `DateTime::createFromFormat("Y-m-d H:i:s", ...)` must produce a date without warnings or errors, and formatting it back must exactly equal the stored string. Otherwise the result is `N`. Valid values retain the existing default timezone interpretation, strict `currentDateTime < parsedTime + 15 seconds` comparison, and `Y`/`N` response. Valid future timestamps continue to report `Y` under that comparison.

The public participant list retains provider, patient, related patient order, roles, IDs, and omission of missing optional patients. Provisioning, invitations, and callers are outside this change. CalendarUtils has separate work under PR150/OPEMR-78 and is not changed here.

## Evidence and acceptance

The controller recorded a genuine native RED run at the tests-only `cac84e2b` revision in `/Users/craig/.hermes/projects/openemr/verification/participant-activity-20261022/RED.log`: 13 tests, 116 assertions, 8 errors, and 2 failures. Malformed types and NUL bytes raised errors, and overflowing day and month values returned `Y`. The expanded isolated cases cover malformed format, padding, overflow, zero dates and year, and whitespace across all three participant keys. They also exercise valid future and stale dates away from the activity boundary. Controller GREEN native completed with 26 tests and 360 assertions, followed by two syntax and diff passes. Full hosted static and CI checks, ordinary approval, and native authenticated clinical acceptance remain pending.

Acceptance for this slice requires malformed values to produce `N` without PHP warnings or exceptions, while valid timestamps keep the existing wire shape, participant ordering, local timezone behavior, and activity comparison. Clinical acceptance still needs authorized real session polling with the provider and patient roles, including related patients and missing participants; verification of role access, session lifecycle, and provider provisioning behavior; and review of activity display during real calls. This slice does not complete video consultation or record-during-call functionality.
