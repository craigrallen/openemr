# EOB patient billing-note popup: partial canvas/sheet presentation (OPEMR-52)

Status: **partial source implementation; local source gates and independent
review complete, final hosted CI and native acceptance pending.** The route
carries only the two approved additions below. This is not full researched
design acceptance, native acceptance or security clearance.

- Route: `interface/billing/sl_eob_patient_note.php`
- Caller: `interface/billing/sl_eob_search.php` (`npopup`)
- Frozen original: `tests/fixtures/clinical-workspace/eob-patient-note.original.php.fixture`
  (master `18647270e0c799189d2dc10f801e8de2bff1a360`)
- Contract: `tests/fixtures/clinical-workspace/eob-patient-note-popup.contract.cjs`,
  Jest wrapper `tests/js/clinical-eob-patient-note-popup.test.js`

This is distinct from the general billing-note editor `edit_billnote.php`
(PR77); that route is not touched.

## Exact changes (implemented in source)

Two additions only; every other byte of the route stays the original.

1. `<body>` becomes `<body class="oe-eob-patient-note-popup">`.
2. One style block, directly after the `<title>` line and directly before
   `</head>`:

```html
    <style media="screen">
      html.oe-workbench-context body.oe-eob-patient-note-popup {
        color: var(--oe-wb-ink);
        background-color: var(--oe-wb-canvas);
      }

      html.oe-workbench-context body.oe-eob-patient-note-popup > .container {
        color: var(--oe-wb-ink);
        background-color: var(--oe-wb-paper);
        box-shadow: inset 0 0 0 1px var(--oe-wb-line);
      }
    </style>
```

Unchanged: all PHP (acct/eob write gate, session, `patient_id`, `patient_data`
reads, POST update, `checkCsrfInput`), the hidden CSRF token, form action and
method, escaping, title, heading, the textarea (`rows="3"`, `maxlength="255"`,
placeholder, its own theme palette, focus, placeholder and validation styling),
label, buttons (Save submit; Cancel is still submit plus `dlgclose()`), the
post-save `dlgclose()`/alert script, the direct-access error, the caller,
`Header`, assets, helpers, `popup.css`/`popup.js` and themes. No font,
geometry, gutter, padding, margin, control palette, button or wrapper change.
The container edge is an inset 1px box-shadow so the box model is not changed.
Tokens come from the workbench scope of `interface/clinical-workspace/popup.css`,
autoloaded as `workbench-popup` (`config/config.yaml`) via
`Header::setupHeader(['opener'])`.

## Source-only limitations

- Both rules apply only under `html.oe-workbench-context`, on screen. Elements
  without their own colour rule (heading, label) inherit the new ink; the
  textarea and buttons keep their existing cascade (including the shared popup
  overrides), but sit on a new backdrop with unverified effective contrast.
- **The body class is a markup change in all media,** including print, even
  though the CSS is screen-only. Theme or third-party CSS matching body classes
  has not been checked.
- The original markup (`row` without wrapping `col` for the heading, the
  submit-type Cancel, the `type='text'` attribute on the textarea) is preserved
  as-is, not endorsed.

## Contract

`violations()` restores the complete candidate through the strict inverse and
compares it byte for byte with the frozen original; it also requires the
candidate to equal `applyPresentation(original)` and the shared normalizer to
yield the original. `accepts()` is "no violations". Portable checks (no Git, no
process) cover: preserved original lines in order and pinned counts; the exact
block (two gated rules, approved declarations, nothing forbidden); tokens in
`popup.css`; the synthetic adaptation passing first; exact addition count and
positions; every single-line edit, deletion or duplication rejected; grouped
anchored mutants (presentation shape, media/print/`!important`, geometry,
tokens, selectors and extra control rules, ACL/session/CSRF, patient id/SQL,
escaping/action/hidden token, textarea/buttons/close/error/title, arbitrary
bytes), each asserting a unique anchor and a changed source before the
rejection assertion; the verbatim `npopup` caller; then the live route.

History mode (`--history` or `OPEMR52_EOB_NOTE_HISTORY=1`) is separate and
fails, never skips, without Git or the base commit. It compares the fixture and
the restored live route to `git show 18647270e0c799189d2dc10f801e8de2bff1a360:<route>`,
pins caller, `Header`, asset config, popup CSS/JS, `dialog.js`,
`include_opener.js`, themes and `interface/clinical-workspace` to base, allows
no other `interface/billing` change, and restricts changed and untracked files
to the five-file scope (route, fixture, contract, Jest wrapper, this doc).

## Recorded RED (tests-only commit, before production)

Reported by the controller, not re-run by the author of this production step:

- Hosted: tests-only commit `2110a057df056fe8d09ac94e89836a6794297a80`, run
  `39230827824`. Two intended portable failures caused by the missing
  presentation; the other 61 suites (1259 tests) passed.
- Local portable: 21 passed, 2 intended failures ("live route has no
  violations", "live route equals the approved presentation candidate").
- Local history: 27 passed, 3 intended failures (the two above plus "complete
  restored live route equals the base route"), including the frozen original
  matching the exact Git base.

## Controller verification

After production, controller executed portable 23/23 and mandatory Git-base
history 30/30 checks, PHP syntax and `git diff --check`: PASS. Extracted actual
inline CSS passed nonignored stylelint with no warnings or parse errors.
Controller-owned Codex `gpt-6-astra` independently reviewed the complete five-file
diff and relevant caller/cascade context: no introduced P1/P2 findings. Its
nonblocking documentation corrections are incorporated here. Full hosted CI
is pending at publication; final evidence supersedes this checkpoint in
`verification/eob-patient-note-20261019/DELIVERY.md` in the project coordination
workspace. None of these source checks executes the route or proves native QA.

## Native gates still OPEN

PHP execution and bootstrap; session; per-patient authority and ACL pass/deny;
security and error paths; compiled default, dark and solar themes with and
without workbench context; textarea focus, placeholder and validation
contrast; keyboard order and roles; the `modal-sm` frame (caller height argument
275; `dialog.js` clamps iframe height arguments ≤300 to 300) as opened,
and desktop then resized narrow and short; RTL; Save and opener behaviour;
legacy print.

## Boundaries

No requests to the route or caller, no bootstrap, database, financial data,
save or print, no provider, master, merge, deploy, policy, cron or national
actions. Prior parked gates remain parked; PR112 stays unpublished with its
denied review; the Swedish clone denial and the completed audit reviewers are
unchanged and not resolved here.
