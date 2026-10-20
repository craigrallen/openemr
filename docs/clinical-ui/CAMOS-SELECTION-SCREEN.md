# CAMOS entry-selection screen (OPEMR-66)

## Status

**Implemented locally; local GREEN evidence complete; hosted CI and all
native/clinical gates still pending.** The work was tests-first. The
source-contract test (`tests/camos-selection.contract.test.cjs`) and the
synthetic controller test (`tests/js/camos-selection.test.js`) were committed
before any production change (tests-first commit `5f8645a6`). Production
`rx_print.php` stayed byte-identical to the original until that RED run
completed.

Completed local RED, run by the controller:

- Portable: 122 tests, 121 pass, 1 fail. The only failure was the live-route
  check for the missing html selection marker in `rx_print.php`.
- `--history`: 123 pass, 3 expected failures (live presentation delta, inverse
  of the live route, and the five-file scope check), all caused by production
  not yet being edited.

RED provenance: an initial Opus tests run hit its 420 s timeout after writing
complete files but without a final JSON result. A bounded Sonnet tests-only
correction then fixed eight `root.classList.list` typos before the genuine
corrected RED (121 pass, 1 fail on the missing marker). No assertions or
mutants were weakened and no permissions were denied.

The production change described below has since been made in `rx_print.php`.

Completed local GREEN, independently executed by the controller:

- Portable `node:test`: 122/122 pass.
- Explicit direct-node `--history`: 126/126 pass.
- Full rooted Jest: 62 suites, 1260 tests pass.
- Wrapper ESLint: 0 problems.
- Stylelint over the actual extracted non-ignored inline CSS: 0 problems, with
  a non-empty report containing no warnings.
- `php -l` on the route: pass.
- `git diff --check`: pass.
- The 13 temporary individual sibling dependency links were removed and
  verified absent. No dependency, config or gate changes.

Source inverse and the frozen Git provenance were verified by both the
controller and the reviewer.

Independent review: a Codex gpt-6-astra read-only review of the five files plus
the full source, caller, shared-engine and helper paths found no introduced P1
or P2 and no concrete P3. That review was static only: it did not run tests. It
is separate from, and does not replace, the mandatory ordinary GitHub approval.

Hosted CI is still pending publication. The canonical controller evidence at
`/Users/craig/.hermes/projects/openemr/verification/camos-selection-20261020/DELIVERY.md`
will supersede this prepublication note. There is no new native, clinical,
print or live evidence. Nothing here claims any of the gates listed under
Acceptance has passed.

This is a partial palette change, not a full researched UI, not a full
reference implementation, not the all-22 programme, and not Swedish readiness.
It is not clinical acceptance. It needs ordinary approval; nothing here is
merged or deployed.

## Scope: selection only

The selection screen is the `else` branch of `interface/forms/CAMOS/rx_print.php`
that renders "Select CAMOS Entries for Printing". The print, letterhead, signature
and PDF paths in the same file are out of scope.

### Real callers

`interface/forms/CAMOS/report.php` opens the route through four named
`target=_new` links, all unchanged:

- `rx_print.php?sigline=embossed`
- `rx_print.php?sigline=signed`
- `rx_print.php?letterhead=true&signer=patient`
- `rx_print.php?letterhead=true&signer=doctor`

`_new` is a named browsing context, not the implicit-noopener `_blank`. The
source therefore supports an opener path back to the workbench shell, but it
does **not** prove runtime opener retention. COOP, user, browser and
reused-window policies remain gates.

### Exact files

Change set, five files:

1. `interface/forms/CAMOS/rx_print.php` (production, selection branch only)
2. `tests/camos-selection.contract.test.cjs`
3. `tests/js/camos-selection.test.js`
4. `tests/fixtures/camos-selection-original.php.txt` (frozen base copy)
5. `docs/clinical-ui/CAMOS-SELECTION-SCREEN.md` (this file)

Unchanged and asserted unchanged: `report.php`, `rx.css`,
`interface/clinical-workspace/popup.js`, `popup.css`.

## Implementation

The change in `rx_print.php` is exactly the synthetic candidate the contract
test builds (`buildCandidate`), and nothing else:

- **Marker:** the selection branch root is `<html class='oe-camos-selection'>`
  (single quotes). The print and letterhead `<html>` tags are untouched.
  `popup.js` adds the workbench context class when the shell is in workbench
  mode, discovered through the opener.
- **One script only:** the unchanged `popup.js`, placed immediately after the
  existing `rx.css` link in the selection head:
  `attr(OEGlobalsBag::getInstance()->getWebRoot() . '/interface/clinical-workspace/popup.js?v=' . urlencode(OEGlobalsBag::getInstance()->getString('v_js_includes')))`.
  `attr()` escapes the whole URL and `urlencode()` the cache token;
  `attr_url()` over the whole URL would percent-encode its slashes, so it is
  not used there. No `defer`, `async` or module type.
- **Header-free selection.** No `Header::` asset loader, no `popup.css`, no
  `workspace.css`, no fonts, no stylesheet link added, no `$GLOBALS`.
- **Screen-only fallback CSS:** one inline `<style>` directly after the script,
  last in the head, holding one `@media screen` block scoped to
  `html.oe-workbench-context.oe-camos-selection` with two rules:
  - `body`: canvas background, ink text.
  - `form`: paper background, ink text, inset form-edge
    (`box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2)`).

  Every token carries a literal fallback equal to its `popup.css` value, since
  `popup.css` is not loaded here. No geometry, typography, sizing, hiding,
  wrappers, `!important`, print or font rules. No explicit `<body>` is added.
- **Reversibility:** removing the marker and the script+style addition (the
  test's `inverse`) reproduces the original byte for byte. Local provenance
  against the base commit is checked with the explicit
  `node tests/camos-selection.contract.test.cjs --history` flag. Note that
  `node --test ... --history` does not forward the flag.

## Unchanged behaviour

Existing SQL, patient and prescription selection, the update-user POST with
CSRF, form targets and callbacks, the cycle/select engines, the letterhead
HTML `printLogPrint` path, the signature image and the PDF stream are
unchanged. Every byte through the selection-branch marker is asserted
preserved. No opener restoration and no new dependencies were added.

## Acceptance

What the tests establish (local GREEN confirmed by the controller, see Status;
hosted CI still pending):

- Source-contract checks over unchanged files, including a mutant list
  (rejects marker, script, style, scope, palette, form, SQL, CSRF, PID, print,
  signature and PDF mutations).
- The real `popup.js` run in a vm sandbox against window doubles, as CLI and
  controller synthetic discovery.

What they do **not** establish; each is a separate gate and all remain open:

- Hosted CI result (pending publication).
- Native opener retention, opening modes or named-window reuse.
- Roles, permissions and security review.
- Selection, update and save behaviour in a live system, and legacy mode.
- Print audit, print output, letterhead, PDF and legacy-mode fidelity.
- Default, dark and solar theme rendering.
- Keyboard, RTL and geometry/screenshot acceptance, visual contrast.
- Clinical review and signing.
- The all-22 programme, the full researched UI, and Swedish readiness.
- Ordinary GitHub approval.

There is no actual clinical, print or live use. Nothing here supports any claim
of compliant signing, full acceptance, or completion of the all-22 programme.
