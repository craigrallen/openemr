# Shot record HTML popup (OPEMR-47)

Scope: a bounded, screen-only presentation of the original **HTML** shot record
(`interface/patient_file/summary/shot_record.php?output=html`). This is a partial
sheet presentation inside an active clinical workbench, not a redesign, not a
native/clinical acceptance, and not a PDF or backend change.

## What changes

Two presentation edits, checked by source tests (no wrappers, no JS, no shared asset edits):

1. Directly after the existing `Header::setupAssets(['workbench-popup'])` opt-in,
   an inline `<style media="screen">` block with two rules:

   ```css
   html.oe-workbench-context body.oe-shot-record-popup {
     color: var(--oe-wb-ink, #17343b);
     background-color: var(--oe-wb-canvas, #f3f7f5);
   }
   html.oe-workbench-context body.oe-shot-record-popup div.paddingdiv {
     color: var(--oe-wb-ink, #17343b);
     background-color: var(--oe-wb-paper, #fff);
     box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);
   }
   ```

2. The body marker `<body class="oe-shot-record-popup">` (was `<body>`). This edit
   is not screen-only: the class is part of the generated HTML in every context,
   including printed output and whatever the print/audit callback captures.

The scope is `html.oe-workbench-context …`, not `body.oe-workbench-context`:
`interface/clinical-workspace/popup.js` toggles its classes on `<html>` only and
never touches body attributes, so a body-scoped context selector would be inert.
Fallbacks equal the established `popup.css` token values, so foreground and
background stay paired even if the token block is absent. The quiet edge is an
inset `box-shadow`, so the 524pt × 668pt sheet geometry is unchanged.

Outside an active workbench (no `oe-workbench-context` on `<html>`), the two new
rules do not match. That is a selector argument, not an observed rendering.

The new block carries `media="screen"`. In the `popup.css` source, every rule sits
inside one `@media screen { … }` block; the `<link>` that `Header::setupAssets`
emits for it (and any `media` attribute on that tag) has not been checked here.
Note that `popup.css` already applies screen-only styles to this page, including
`html.oe-workbench-popup body { font-family: Arial, sans-serif; }`, which predates
this change. Source preservation and screen-scoped CSS do **not** prove that
native legacy or print computed output is identical: the body class is present
in print, and no browser, print preview or OS print output has been compared.

## What does not change

Source-level only (the tests compare source, not executed output): with the two
edits removed, the file is byte-identical to the frozen master source.

- All other original PHP and markup: legacy inline `<style>`, table borders,
  `td.odd` stripes, legacy typography rules, 15-rows-per-page pagination,
  `page-break-after`, signature line, page numbers, escaping (`text()`/`xlt()`).
- The PDF branch source (`printPDF`, Cezpdf margins/fonts/stream) is byte-preserved.
  Runtime PDF output has not been generated or compared.
- The `opener.top.printLogPrint(window)` print/audit callback.
- The caller (`immunizations.php` `PrintForm`), which still opens
  `shot_record.php?output=…&sortby=…` in a resizable 600×450 window.
- Shared `popup.css` / `popup.js`.

## Tests

- `tests/fixtures/clinical-workspace/shot-record-popup.contract.cjs` — dependency-free
  `node --test` source contract with the frozen master source
  (`shot_record.master-18647270.txt`), a synthetic approved candidate, and mutation
  negatives (scope, media, extra CSS/rules/classes, placement, token values,
  print callback, patient filter, pagination, PDF, escaping, wrappers).
  Historical Git comparison is opt-in: `OPENEMR_SHOT_RECORD_GIT_HISTORY=1`.
- `tests/js/clinical-workspace/shot-record-popup-contract.test.js` — Jest wrapper so
  hosted JS CI runs the same contract.
- `WorkbenchPopupHeaderfreeTest` — keeps the original whole-file pin; the shot record
  alone strips the exact approved addition before hashing, and malformed or extra
  additions break the pin.

## Limitations (not verified, no claims)

- **Evidence scope:** the frozen source tests check source bytes and CSS text. They
  are not proof of native output, and no application requests were made.
- **Still open (not verified):** the actual PHP-generated HTML; real workbench
  context detection (`oe-workbench-context` on `<html>`); native default/dark/solar
  theme rendering; keyboard use; window resize; RTL; roles/ACL behaviour; OS print
  and print preview; and whether the print/audit capture behaves the same with the
  new body class present.
- **Native/OS rendering:** not verified in real browsers, OS print dialogs, or
  print preview. Unchanged print output is not claimed.
- **Themes:** colours are fixed light palette values; the default, dark and solar
  themes are not adapted (dark/solar shells will show a light sheet). No theme matrix
  has been run.
- **Window size:** the 524pt sheet is wider than the 600×450 window; horizontal
  scrolling and resize behaviour are unchanged and not improved.
- **RTL:** no direction-specific rules; RTL layout is whatever the legacy page does.
- **Keyboard/accessibility:** no focus, landmark or keyboard changes; contrast of
  ink on canvas/paper is ≥ 4.5:1 by calculation only.
- **Audit:** the page calls `opener.top.printLogPrint(window)`, which can print and
  write the print audit entry from the opener on load. The callback source is
  preserved; its behaviour is not reviewed, and the HTML it captures now includes
  the body class. The page fails if the opener is gone or cross-origin.
- **ACL:** `shot_record.php` has no route-local ACL check. `getImmunizationList()`
  binds the query to the session `pid` (`where i1.patient_id = ?`), which scopes rows
  to the current patient but is not authorization proof. The caller's
  `patients/med` check does not protect a direct request. Out of scope here.
- **Clinical acceptance:** none claimed; this is presentation only.
