# OPEMR-35 calendar no-show status visibility

## Scope

The day, week, and month screen event builders now append one localized, HTML-escaped `No show` badge after the existing patient link when the event has the exact string status `?`, a positive integer PID or canonical positive decimal string PID, no group ID under the source's group-branch rule, and a category outside 2, 3, 4, 6, 7, 8, 11, and 99. The emitted markup is `<span class="badge badge-danger oe-calendar-no-show">No show</span>` with a leading space; its text comes from `xlt('No show')`. The private helper receives the full event and is called only from the patient branch of each screen builder.

Other statuses return an empty string, leaving their content byte-identical. Category 1 keeps its existing class and strikethrough behavior. Raw status output, event backgrounds, patient and time links, route arguments, tooltips, the `eventViewClass` override, facility dispatch, and print content are unchanged. Existing Bootstrap `badge badge-danger` supplies the badge appearance; this slice adds no CSS, font, geometry, shared script, asset, endpoint, or status write.

## Evidence and pending gates

PR 109 at tests-only commit `16151e38395f337b5171e70f533640f17cd31690` had a genuine hosted RED run: Actual Isolated Tests `39099410147` completed across PHP 8.3, 8.4, and 8.5 with 6,612 tests, 15 intended missing-badge failures, and no new test errors. The baseline negative and print contracts passed. A later tests-only hosted PHPStan run, `39099410258`, reported 10 test typing errors. The test file has since gained PHPUnit assertion narrowing for optional and nested render-data offsets and string content, plus tighter badge placement, invalid PID, numeric-string excluded-category, and category-1 status coverage. These additions have not yet been verified by a hosted rerun; the 6,612/15 RED result describes the earlier test version.

The controller already passed syntax verification and independent review for the original 31-line production diff. That production diff remains unchanged. Final hosted tests, PHPStan, syntax, and review gates for the corrected test/docs version remain pending. No local execution was performed for this correction.

The existing render-data tests also assert that a facility-mismatched event retains its visible facility-only content without a patient badge. Its inherited tooltip remains patient-bearing, so that check is not a security acceptance claim. Native-theme contrast and clipping in small event text need visual review before claiming visual fidelity.

The existing editor entry ACL for `patients` / `appt` `write` or `wsome` is preserved. Explicit CSRF and per-event authorization remain unresolved; this change provides no new editor shortcut or write path. The full feature 17 direct mark/save persistence remains open. This is only a status-driven visibility slice for status already equal to `?`.

No live application, database, patient, credential, provider, production, or national integration action was taken. The recorded local Node, Jest, PHPUnit, bootstrap, hash, cache, install, and link denial boundaries remain in force. No Swedish checkout or publication was attempted.
