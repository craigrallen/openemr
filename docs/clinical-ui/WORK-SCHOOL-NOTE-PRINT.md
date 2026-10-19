# Work/School Note print view — workbench screen seam (OPEMR-59)

Route: `interface/forms/note/print.php`, opened by `PrintForm()` in
`interface/forms/note/view.php` as `window.open(url, "mywin")`. No dimensions
are passed.

## Status

This covers **presentation only, and only part of it**. The tests prove one
narrow source-level fact: the production route equals the frozen original plus
two exact additions. They do not provide reference parity, native-theme
acceptance, accessibility, print, audit or security acceptance. Nothing in these
tests executes the route, bootstraps OpenEMR or sends a request.

The route must never be executed as part of this work. On load it calls
`printLogPrint(window)` on `top`, or on `opener.top` when `top` lacks it. That
can open the OS print dialog and POST a print-audit entry.

## Intended production seam

There are exactly two additions. Everything else stays byte-for-byte the
original.

1. One inline style block, placed directly after `<?php Header::setupHeader(); ?>`
   and its blank line and before `</head>`. A blank line separates it from
   `</head>`. The whole block sits inside `@media screen`:

   ```html
   <style>
   @media screen {
     html.oe-workbench-context body.oe-work-school-note-print {
       color: var(--oe-wb-ink);
       background-color: var(--oe-wb-canvas);
     }

     html.oe-workbench-context body.oe-work-school-note-print > form {
       color: var(--oe-wb-ink);
       background-color: var(--oe-wb-paper);
       box-shadow: inset 0 0 0 1px var(--oe-wb-line);
     }

     html.oe-workbench-context body.oe-work-school-note-print > form .title,
     html.oe-workbench-context body.oe-work-school-note-print > form .text {
       color: var(--oe-wb-ink);
       background-color: var(--oe-wb-paper);
     }
   }
   </style>
   ```

   Indentation follows the repo stylelint `@stylistic/indentation` rule:
   selectors inside `@media` at 2 spaces, declarations at 4. The contract checks
   this exact text.

2. The marker is appended to the existing body class:
   `<body class="body_top">` → `<body class="body_top oe-work-school-note-print">`.

Constraints the contract enforces:

- **Allowed:** `color`, `background-color` and a single inset `box-shadow`.
- **Not allowed:** `!important`, geometry, padding, margin, font, radius,
  outline, border, wrappers, control styling, print rules, unscoped selectors,
  and any change to shared CSS.
- **Token scope:** `--oe-wb-*` tokens are defined only under
  `html.oe-workbench-context` (by `interface/clinical-workspace/popup.css`,
  screen only). `popup.js` sets that class only when a same-origin chain reaches
  an active workbench shell. Outside the workbench, every rule above is inert.
- **Message box:** the message `<div>` keeps its inline
  `border: 1px solid black; padding: 5px; margin: 5px;` unchanged. The form's
  paper colour sits behind it.
- **The marker class is a DOM change in every media.** Only its paint is
  screen-only. In print and print preview, the class is present but no rule
  matches.

## Frozen original

`tests/fixtures/work-school-note-print.original.txt` is a byte-for-byte copy of
`interface/forms/note/print.php` at fork base
`18647270e0c799189d2dc10f801e8de2bff1a360`. Its expected SHA-256 is
`9ec620366f8aea787705a241aff57e23277d446342a79bfd952de90663189e66`. The
fixture is plain text and is never served or executed.

## Tests

- `tests/source-contracts/work-school-note-print.test.cjs`: dependency-free
  `node:test` contracts.
  - **Portable:** checks the fixture SHA-256 and that the fixture is the
    complete pre-seam route. It runs a positive synthetic production fixture
    built independently from the verifier constants. It checks that undoing the
    two additions is an exact inverse, and that the unmodified original is
    rejected. It restores the current `print.php` and compares the result with
    every fixture byte. It also runs anchored negative mutants. Each mutant
    asserts that its anchor is unique and that the mutated source differs,
    outside the rejection assertion. The mutants cover:
    - CSS media, scope, context and ink/paper pairing
    - no geometry, font, border, outline or `!important`
    - no control selectors, and one selector per line
    - the superseded 4/8-space indentation (semantically identical CSS that
      only the exact-text check rejects)
    - duplicate or misplaced style blocks, and marker placement
    - the original ACL gate, form-id parsing, provider query, session and record
      fetch
    - escaping, title and translations, the message border
    - the select, doctor and date fields, and the `printLogPrint` callback
    - wrappers, and arbitrary byte drift (trailing whitespace, EOF newline, BOM,
      comment edit, CRLF)
  - **History (`--history`):** checks that the fork base exists and is an
    ancestor of `HEAD`, and that the fixture equals the base route byte for
    byte. It checks that `view.php`, `src/Core/Header.php`, `config/config.yaml`,
    `popup.js` and `popup.css` are unchanged from base. It also checks that
    changed and untracked paths stay within the allowlist: `print.php` plus the
    four new files, and all four new files must be present. A missing or
    shallow base fails the run; it is never skipped.
- `tests/js/work-school-note-print.test.js`: a small Jest wrapper that runs the
  portable cases only. It is meant for hosted shallow clones.

Commands (controller-run):

```bash
node --test tests/source-contracts/work-school-note-print.test.cjs            # portable
node tests/source-contracts/work-school-note-print.test.cjs --history         # mandatory locally
OE_SOURCE_CONTRACT_HISTORY=1 node --test tests/source-contracts/work-school-note-print.test.cjs
npx jest tests/js/work-school-note-print.test.js                              # hosted wrapper
shasum -a 256 tests/fixtures/work-school-note-print.original.txt
git show 18647270e0c799189d2dc10f801e8de2bff1a360:interface/forms/note/print.php | cmp - tests/fixtures/work-school-note-print.original.txt
```

## RED / GREEN

- **RED, verified locally by the controller before the production edit:**
  - The fixture SHA-256 matched
    `9ec620366f8aea787705a241aff57e23277d446342a79bfd952de90663189e66`, and
    `git show <base>:interface/forms/note/print.php` was byte-identical to the
    fixture.
  - Portable: 53 passed, 1 failed. The single failure was `current print.php
    is the original plus the exact seam`, with the intended style-contract
    error (no inline `<style>`).
  - Mandatory history (`--history`): 57 passed, 1 failed, with the same single
    failure.
- **First GREEN was against a wrong oracle.** After the production edit, the
  mandatory history run passed 58/58. The controller then ran stylelint on the
  exact extracted CSS. It failed only on `@stylistic/indentation`: selectors
  must be indented 2 spaces and declarations 4. The oracle had encoded 4 and 8.
  Evidence:
  `/Users/craig/.hermes/projects/openemr/verification/work-school-note-20261019/css-lint-initial.json`.
- **Oracle corrected (tests and this document only; `print.php` not edited).**
  The exact `STYLE_BLOCK`, the independent positive synthetic fixture and every
  CSS mutant anchor now use 2/4 spaces. One new style mutant rejects the old
  4/8 layout. No assertion was weakened or removed; the frozen fixture, its
  digest and the fork base are unchanged.
- **Fresh RED, verified by the controller before the production correction.**
  `print.php` still carried the 4/8 block at the time.
  - Mandatory history (`--history`): 58 passed, 1 failed (59 cases).
  - The only failure was the intended exact-style-text failure, at offset 26
    of the style block (the first indented selector line).
  - Every negative mutant passed, including the new 4/8-layout mutant. The fork
    base, fixture and caller/shared-asset checks all passed.
- **Production correction (this change).** Only the inline style block in
  `print.php` was re-indented from 4/8 to 2/4 spaces, to match `STYLE_BLOCK`
  exactly. Selectors, declarations, values, blank lines, block placement, the
  marker class and every original byte are unchanged. The tests and the fixture
  were not edited.
- **GREEN after the correction, controller verified:** 59/59 mandatory history
  cases and 55/55 portable cases pass with no skips. PHP syntax and whitespace
  checks pass. Stylelint passes on the actual extracted inline CSS, nonignored,
  with no warnings or parse errors. Independent Codex Astra review found no
  introduced P1/P2 and independently passed both contract modes and PHP syntax.
  Hosted CI remains pending publication; source tests do not prove native UI.
- **Known cascade limitation:** `interface/themes/color_base.scss` assigns an
  `!important` background to `.body_top`; themes importing it can retain that
  background rather than the proposed canvas. The form paper/ink seam remains
  separately scoped. Native default/dark/solar acceptance is not established.
- **Audit distinction:** the default `printLogPrint` fallback reads
  `body.innerHTML`, excluding body attributes and head CSS. The marker is a real
  DOM delta, but these additions alone do not establish an audit-payload change.

## Still open

None of the following is claimed or covered:

- Ordinary approval and review.
- Native themes (default, dark, solar) with and without the workbench.
- Window behaviour: `window.open(..., "mywin")` with no explicit dimensions,
  opener retention and reuse of the named window, and back/forward cache restore.
- Narrow and short opened windows, and a desktop window after resizing.
- Keyboard use, RTL layout, roles and semantics.
- OS print output, and compatibility with `printLogPrint` and its print-audit
  POST.

## Security and scope notes

- The existing `EncounterFormAccess::assertFormBelongsToSessionPatient` identity
  gate is preserved byte for byte. This is a no-regression check, not a security
  clearance.
- This view has no equivalence to a Swedish medical certificate or signature
  (intyg/underskrift), and none is claimed.
- The broader original22, demo and Swedish acceptance gates remain in force and
  are not affected by this partial seam.
- No commit, push, merge, deploy, policy or cron action is part of this change.
