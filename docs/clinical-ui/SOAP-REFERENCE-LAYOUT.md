# SOAP reference layout: wider sheet while the reference is open

A small visible slice. It doesn't claim full fidelity to the researched design. The accepted research (`researched/index.html`) shows a central document with quiet reference context. In the actual workbench, `.oe-soap-document` is capped at `max-width: 860px` and split `col-lg-8` / `col-lg-4`. With the previous-SOAP reference open, both columns are cramped even in a 1196px frame.

## Change

- `interface/clinical-workspace/soap-reference.js`: `attach()` keeps an `oe-soap-document--reference-open` class on the panel's existing `.oe-soap-document` ancestor in step with the real toggle. The class is set only when `aria-expanded="true"` and the reference body isn't `hidden`. The class is synced at initialization and after every open or collapse. It's presentation only. Fields, frames, draft values, the server payload, copy eligibility, dirty tracking, save, session, ACL, locks and transport are untouched. Nothing is moved or recreated. If the container or toggle is missing, no class is set and nothing throws. Repeated `attach()` still binds one listener.
- `interface/clinical-workspace/soap-document.css`: one new rule, `body.oe-clinical-soap.oe-clinical-workspace .oe-soap-document.oe-soap-document--reference-open { max-width: 1200px; }`, inside `@media screen and (min-width: 992px)`. Collapsed, the sheet stays at the existing 860px. Legacy presentation, which lacks the `oe-clinical-workspace` body class, is unchanged, and so is print, which is outside `screen` and where the panel is already `display: none`. Below 992px the Bootstrap columns stack exactly as before.
- **Older engines:** the file's existing narrow query was rewritten from `(width <= 640px)` to `(max-width: 640px)`. Only the notation changed; its declarations are identical. `.stylelintrc.json` adds `soap-document.css` to the existing prefix override alongside `calendar.css` and `finder.css`, so lint now *rejects* range syntax in this file. All other files keep `context` notation.
- `interface/clinical-workspace/soap-document.js`: `createAutoHeight` now also uses its injected `observe` seam to watch the class attribute of the fields' `.oe-soap-document` ancestor, so opening or closing the reference refits fields even without `ResizeObserver`. The new observer is disconnected on dispose. If no container is found, only the body is observed. Fields are never recreated, and no resize event is synthesized.
- Cache: the existing `filemtime` versions on these assets change with the files.

## Evidence

Output is under `/Users/craig/.hermes/projects/openemr/verification/cron-reference-layout/`.

**Unit tests and lint (controller runs)**
- Red runs: `red.txt` (5 failed, 60 passed) and `red-round2.txt` (8 failed, 101 passed).
- Full Jest: 37 suites, **688 tests passed** (`green-round2-full.txt`).
- ESLint: 0 errors. There are 2 warnings, both inherited `__dirname` warnings.
- Stylelint passed. `lint-round2-abs.txt` shows the real CLI accepting prefix syntax in `soap-document.css` and rejecting range syntax there with `Expected "prefix"`. Sibling files still require `context` notation.
- An independent source review found no P1 or P2 issues.
- A final independent Codex GPT-6 Astra review covered the complete source and the external QA. It found no introduced P1 or P2 issues.

**Offline browser QA (`browser-qa.py`, synthetic fixture)**
- This is fixture evidence only, not live OpenEMR. It covers 8 widths, LTR and RTL, with and without `ResizeObserver`, opening by click, Enter and Space. It also covers legacy presentation and print. Every request, dialog and page error fails the run.
- The controller's final run (`browser-final/browser-qa.json`) reached `stage: complete` with `ok: true`. **1187 checks passed**, with zero requests, submits, dialogs and page errors.
- That run includes the dirty-flag checks: the raw top dirty flag is true after typing the draft and stays true after both toggles. It also checks that the toggle is the focused active element as expected around each key press and each open or close. There are no scroll assertions.

**Live overlay QA (`live-overlay.py`, output in `live-controller/`)**
- This is a candidate overlay on the live ba11545 deployment. It is **not deployed**. The original `soap-document.js` and `soap-reference.js` requests were aborted, and the candidate JS was injected and ran once. No HTTP responses were faked. All 4 SOAP assets the baseline served matched ba11545 exactly.
- The run reached `stage: complete`. **62 checks passed**, and fields, dirty flag, selection and container classes were restored. There were no unexpected or clinical-mutation attempts.
- **Whole run `ok: false`, `acceptance: false`.** The guard blocked 18 automatic POSTs, and there were 14 sanitized `TypeError` page errors. This failure stands. The run wasn't retried, and those requests weren't allowed or suppressed.
- Measured in the nested 1196px SOAP frame, the subjective field went from 514px collapsed to 738px with the reference open.
- `candidate-overlay-NOT-DEPLOYED-1440.png` comes from the actual authenticated page. It shows a readable central note with a quiet reference on the right. The earlier-notes list is empty, which is a data gap for acceptance. `research-reference-snapshot.png` is the separate accepted reference. Neither closes design fidelity.
- Two script changes are **not run yet**:
  - The final `ok` now also requires restoration booleans for every pass, no cleanup errors, and `kind: success` screenshots. The page-error and request guards are unchanged.
  - The research step now opens the reference's Encounter draft offline, with all requests blocked, and writes `research-encounter-reference.png`. It records only geometry that the reference actually renders. That comparison is visual and unfinished.

## Not verified

- The real candidate isn't deployed. There's no database, role/ACL, locked-note or save acceptance, and no earlier-notes seeding.
- No runtime observation in an older engine. The prefix-syntax claim rests on browser support.
- No PHP suites were run, because Docker was unavailable.
