# OPEMR-46 patient note print popup

Status: source-implemented; native QA open. Hosted GREEN and independent
review are pending (controller).
Owner: Hermes, run 1 of max 2. Independent rotation: PR119.

## Scope

The target is the real print popup
`interface/patient_file/summary/pnotes_print.php`, 75 lines at base
`18647270e0c799189d2dc10f801e8de2bff1a360`. Three callers each open it with an
explicit `window.open(..., '_blank', 'resizable=1,scrollbars=1,width=600,height=500')`:

- `interface/main/messages/messages.php`
- `interface/patient_file/summary/pnotes_full.php`
- `interface/patient_file/summary/pnotes_full_add.php`

The callers are not changed.

## Implemented additions (exact, and nothing else)

Route `pnotes_print.php`:

1. `use OpenEMR\Common\Assets\ClinicalWorkspaceAssets;` between the existing
   `AclMain` and `Header` imports.
2. One `<link rel="stylesheet" media="screen" ...pnotes-print-popup.css?v=...>`
   directly after `<?php Header::setupHeader(); ?>`, with the web root escaped
   by `attr()` and the version by `attr_url()`.
3. `oe-pnotes-print` appended to the existing `body_top` body class.
4. One `<div class="oe-pnotes-print-sheet">` wrapping exactly the four original
   paragraphs, closed before the print script.

Helper `src/Common/Assets/ClinicalWorkspaceAssets.php`: `pnotes-print-popup.css`
inserted into `SUPPORTED` after `patient-search.css` and before
`soap-document.css`. The base list has 24 entries and no `popup.js` entry, so
that position keeps the list sorted.

New sheet `interface/clinical-workspace/pnotes-print-popup.css`: one
`@media screen` block with two rules scoped to `html.oe-workbench-context`
(page canvas and paper sheet: paired colour tokens with fallbacks, plus
`margin`, `padding`, `border`, `border-radius` and `overflow-wrap: anywhere`
on the sheet). Margin, padding and border are real on-screen geometry deltas
in workbench context. The sheet sets no fonts, no width or height, no
`display`, no `!important`, no print media and no nested at-rules, and adds no
controls or JS. Callers, `Header`, shared assets and themes are unchanged.

All other original PHP, escaping, ACL checks, session PID handling, note lookup,
output paragraphs and the `opener.top.printLogPrint(window);` script stay
byte-identical; the portable contract enforces this against frozen fixtures.

## What this does and does not change

- The CSS is screen-only, but the added class and wrapper `div` are in the DOM.
  The legacy/print markup therefore changes, and so does the body that the print
  log captures. This is **not** unchanged markup and **not** a byte-identical
  printed DOM.
- `printLogPrint` (library/restoreSession.php) calls native `win.print()` and may
  POST `win.printlogdata || win.document.body.innerHTML` to
  `/library/ajax/log_print_action_ajax.php`. That inherited path is preserved,
  not accepted.
- `getPnoteById` (library/pnotes.inc.php) selects by note id only and is not
  bound to the session patient. This inherited security gate is unresolved and
  out of scope; nothing here clears it.

No live request, print, app session, patient, log or database access was
authorised or performed.

## Open (native QA, not proven by any source contract)

No source contract proves security or native fidelity. Open items:
native PHP-rendered output, native print output and print-log audit
compatibility with the wrapper, workbench vs legacy (non-workbench) context,
compiled default, dark and solar themes, keyboard use, the 600x500 window and
narrower widths, RTL, OS print dialogs, role coverage, and authoritative
ACL / identity / note-to-patient ownership security.

## Evidence

| Gate | State |
| --- | --- |
| Local portable RED (controller, node) | 11 pass, 1 expected missing-production FAIL, 3 optional history SKIP; with `PNOTES_PRINT_HISTORY=1`, 14 pass, 1 expected missing-production FAIL |
| Hosted RED | completed on `661c4a254ed28d0ada94b9200b2f5f766f015896`, run 39176472610: JS job 1 expected missing-production FAIL, 61 other suites / 1259 tests pass, before any production edit |
| Production source | implemented (route, helper, new sheet) |
| Production GREEN | pending (controller) |
| Independent review | pending (controller) |

Contract: `tests/clinical-ui/pnotes-print-popup.test.cjs` (Jest wrapper
`tests/js/pnotes-print-popup.test.js`). `PNOTES_PRINT_HISTORY=1` enables the
local-history checks.

## Gates retained

Ordinary approval only: no standing bypass, no merge, no deploy. The original
22, demo, exhaustive-popup, researched, Swedish and denial gates remain in
force and are not touched by this slice.
