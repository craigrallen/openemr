# CAMOS entry-selection screen (OPEMR-66)

## Status

**No implementation yet.** This work is tests-first. The source-contract test
(`tests/camos-selection.contract.test.cjs`) and the synthetic controller test
(`tests/js/camos-selection.test.js`) are written, but the corrected RED run is
still pending; the controller will execute it before any production change.
The expected RED is the missing production marker in `rx_print.php`. The earlier
synthetic-controller failures (`TypeError: w.root.list is not a function`) were
a test bug, now fixed to `w.root.classList.list()`, with no assertion or mutant
weakened or removed.

This is a partial palette change, not a full researched UI, not the all-22
programme, and not Swedish readiness. It needs ordinary approval; nothing here
is merged or deployed.

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

Intended change set, five files:

1. `interface/forms/CAMOS/rx_print.php` (production, not yet edited)
2. `tests/camos-selection.contract.test.cjs`
3. `tests/js/camos-selection.test.js`
4. `tests/fixtures/camos-selection-original.php.txt` (frozen base copy)
5. `docs/clinical-ui/CAMOS-SELECTION-SCREEN.md` (this file)

Unchanged and asserted unchanged: `report.php`, `rx.css`,
`interface/clinical-workspace/popup.js`, `popup.css`.

## Planned design

- **Header-free selection.** No `Header::` asset loader, no `popup.css`, no
  `workspace.css`, no fonts, no stylesheet link added.
- **One script only:** the unchanged `popup.js`, referenced once in the
  selection head after the existing `rx.css` link. The URL is
  `attr(getWebRoot() . path . '?v=' . urlencode(token))`. `attr_url()` over the
  whole URL would percent-encode its slashes, so it is not used there.
- **Marker:** `<html class='oe-camos-selection'>` on the selection branch only.
  `popup.js` adds the workbench context class when the shell is in workbench
  mode, discovered through the opener.
- **Screen-only fallback CSS:** one inline `@media screen` block, scoped to
  `html.oe-workbench-context.oe-camos-selection`, with two rules:
  - `body`: canvas background, ink text.
  - `form`: paper background, ink text, inset form-edge
    (`box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2)`).

  Every token carries a literal fallback equal to its `popup.css` value, since
  `popup.css` is not loaded here. No geometry, typography, `!important`, print
  or font rules.
- **Reversibility:** the exact original is recoverable by removing the marker
  and the script+style addition (the test's `inverse`). Local provenance
  against the base commit is checked with the explicit
  `node tests/camos-selection.contract.test.cjs --history` flag. Note that
  `node --test ... --history` does not forward the flag.

## Unchanged behaviour

Existing SQL, patient and prescription selection, the update-user POST with
CSRF, the letterhead HTML `printLogPrint` path, the signature image and the
PDF stream are unchanged. Every byte through the selection-branch marker is
asserted preserved.

## Acceptance

What the tests do establish:

- Source-contract checks over unchanged files, including a mutant list
  (rejects marker, script, style, scope, palette, form, SQL, CSRF, PID, print,
  signature and PDF mutations).
- The real `popup.js` run in a vm sandbox against window doubles, as CLI and
  controller synthetic discovery.

What they do **not** establish:

- Native opener retention or named-window reuse.
- Visual rendering, contrast or screenshot acceptance.
- Role or permission behaviour.
- Security review.
- Print output, letterhead or PDF fidelity.

There is no actual clinical, print or live use. Nothing here supports any claim
of compliant signing.
