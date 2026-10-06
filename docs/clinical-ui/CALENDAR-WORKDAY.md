# Selected-day workday summary

A bounded slice of the researched schedule workspace, not the complete calendar programme.

- Reads the already-authorized rendered Day grid; displays booking/provider counts and the first booking when slot timing is available.
- Appointment and no-show nodes with an existing patient/group link are counted; non-booking blocks and duplicate provider/event nodes are not copied into the count.
- Existing appointment, patient/group, New Appointment and Today controls own every action. No new clinical write endpoint or booking rule is introduced.
- Does not claim a current-time next booking: calendar timezone/server-clock metadata is not established.
- Missing timing, labels or grid data produces unknown/unavailable states rather than invented counts.
- Workbench-only presentation; original calendar remains usable. New assets receive independent filesystem versions from the existing helper.

## Live refresh of the rendered grid

- The `#bigCal` observer now also watches attribute (`class`, `style`, `id`, `data-eid`, `data-pid`, `href`, `date`, `provider`, `title`) and text changes. Before this, it only noticed event nodes being added or removed, so a moved event (`style.top`), edited time/patient text, a changed booking class, or a changed column date/provider header left a stale count, first booking, time or patient label.
- Direct-select `a.apptMarker` churn on mousemove is ignored. The marker carries the `event`/`event_appointment` classes, so the old filter also re-rendered on its first append. Unrelated nodes outside event nodes, provider headers and `td.schedule` `provider`/`date`/`title` attributes are ignored too. Rendering writes only inside the surface, which sits outside `#bigCal`, so a refresh cannot re-trigger itself. `destroy()` disconnects the single observer.
- Hover: the production calendar handler toggles `event_highlight` on every event mouseover/mouseout. A class change whose only added/removed classes are `event_highlight` is ignored, so hovering does not re-read the grid. Any other class change on an event (for example `event_appointment` → `event_out`, or gaining `groups`) still refreshes, including when it lands in the same batch as a hover toggle.
- Columns: removing a column's `provider` attribute, and replacing a `.providerheader` element (reported on its column, not the header), now refresh.
- Clicks that arrive before observer delivery: Open booking, Open patient and Show in calendar first re-read the grid. They delegate only when the shown first booking is still the same node and each of these values is unchanged: `data-eid`, full event `id` (date-eid-category, which `EditEvent` splits into the editor arguments), the `groups` class (which selects the group editor), provider id and name, start, time text, patient text, and the patient/group link's `data-pid` and `href` (each compared on its own). Otherwise this click does nothing except re-render the summary, and the clinician clicks again on what is now shown. Tests check the real arguments that the production `event_time_click`/`EditEvent`/`oldEvt`/`oldGroupEvt`/`goPid`/`goGid` functions receive, taken from `_calendar_screen_js.html.twig`, in jsdom.
- Limitations:
  - The observer is attached to the `#bigCal` element present at start-up. If `#bigCal` itself were replaced, the new grid would not be observed and the summary would stay stale. No root observer was added for this. The production date, provider and view controls reviewed, and the editor's `refreshme()`, navigate or submit the form and so reload the page; no in-page replacement of the root grid was found.
  - The surface's own `data-date`/slot metadata is not observed.
  - `onclick` and other attributes outside the observed list are not observed and not compared at click time. If an event's `a.event_time` `onclick` changed without any compared value changing, the summary would not refresh and Open booking would run the changed handler.
  - The check only covers the fields above, read at click time. It does not prove where the original controls will route beyond those fields.
  - Unknown timing still withholds the first booking. Comment text is still stripped. Labels are still required, and print/legacy views are unchanged.

## Verification

Independent Codex source review found no introduced P1/P2 blocker. Controller initially ran 467 JavaScript tests successfully and found a stylesheet notation error; the media query was then aligned with the existing lint policy. PHP/full integrated gates and real rendered-booking/AJAX browser acceptance must be recorded separately before delivery is called complete.

Live-refresh slice, in jsdom with the real page bootstrap and `MutationObserver`, plus one isolated native-browser run (below). Logs are in `~/.hermes/projects/openemr/verification/cron-workday-refresh/`:
- RED (`red-final.log`): the final test file run against unmodified HEAD production gave 14 failed, 22 passed, 36 total.
- GREEN: `green-focused.log` gave 36/36 passed. `green-full-js.log` gave 37 suites and 687 tests passed. `green-eslint.log` gave 0 errors, with one existing `__dirname` warning on line 9 of the test file.
- Review follow-up for hover noise, routing snapshot, and column/header detection:
  - RED (`red2-focused.log`): the new tests were run against the pre-follow-up source and gave 7 failed, 42 passed, 49 total. The failures were hover re-render, provider removal, header replacement, both event-id changes, gaining `groups`, and a changed `href` behind the same `data-pid`.
  - GREEN: `green2-focused.log` gave 49/49 passed. `green2-full-js.log` gave 37 suites and 700 tests passed. `green2-eslint.log` gave 0 errors and the same single warning. The controller re-ran these and confirmed the 37 suites / 700 tests and the 0-error, 1-warning ESLint result.
- Native browser QA (`native-qa.json`): `stage` `complete`, `ok` `true`, in native headless Chrome. The page was an isolated synthetic fixture built from the checked-in Jest helpers. It is labelled in the file as not a deployment and not full acceptance. All recorded checks passed:
  - initial render (3 bookings, 2 providers, first booking 8:30);
  - the hover targets and the summary are each the topmost element at their own point;
  - hover noise: 6 `event_highlight` toggles produced 0 observer records and 0 cloned nodes;
  - event geometry unchanged by hover, and the same event nodes stayed in place;
  - a real change re-renders once;
  - a `style.top`/time reorder moves the first booking to 9:00;
  - comment text is stripped from the patient label;
  - provider removal and provider-header replacement refresh the summary;
  - a stale click is suppressed (0 booking/patient calls);
  - the explicit actions (open booking, open patient, scroll, New Appointment, Today) each delegate once;
  - the source event nodes are kept as the same nodes in the same parent;
  - 0 network requests, 0 page errors and 0 dialogs.
  - The first run failed the pointer check: in the fixture's layout another element covered an event at the probe point. The fix was to the fixture's geometry. The hover was not forced and the assertion was not weakened.
- An independent final Astra review raised no findings.
- Not established: LIVE clinical acceptance against a running OpenEMR with real rendered bookings and AJAX, browser hover latency, wider roles/ACL coverage, or full-fidelity production calendar markup and styles. The `#bigCal` root-replacement and `onclick` limitations above are unchanged.

This does not implement follow-up cards, conflict resolution, indefinite recurrence, payment, telehealth or messaging integrations. Original requirements remain tracked separately.
