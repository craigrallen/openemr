# Selected-day workday summary

A bounded slice of the researched schedule workspace, not the complete calendar programme.

- Reads the already-authorized rendered Day grid; displays booking/provider counts and the first booking when slot timing is available.
- Appointment and no-show nodes with an existing patient/group link are counted; non-booking blocks and duplicate provider/event nodes are not copied into the count.
- Existing appointment, patient/group, New Appointment and Today controls own every action. No new clinical write endpoint or booking rule is introduced.
- Does not claim a current-time next booking: calendar timezone/server-clock metadata is not established.
- Missing timing, labels or grid data produces unknown/unavailable states rather than invented counts.
- Workbench-only presentation; original calendar remains usable. New assets receive independent filesystem versions from the existing helper.

## Verification

Independent Codex source review found no introduced P1/P2 blocker. Controller initially ran 467 JavaScript tests successfully and found a stylesheet notation error; the media query was then aligned with the existing lint policy. PHP/full integrated gates and real rendered-booking/AJAX browser acceptance must be recorded separately before delivery is called complete.

This does not implement follow-up cards, conflict resolution, indefinite recurrence, payment, telehealth or messaging integrations. Original requirements remain tracked separately.
