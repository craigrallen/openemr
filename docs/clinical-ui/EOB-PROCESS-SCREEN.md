# OPEMR-69 — ERA posting result (`sl_eob_process.php`) presentation

Status: **source edit made, partial palette presentation only. NOT accepted.**
This is not the full researched UI and has no native/browser acceptance. GREEN is
not claimed here; the controller runs the tests and gates.

## Scope of the route edit

Exactly two changes to `interface/billing/sl_eob_process.php`, both the frozen
constants in `tests/eob-process.contract.test.cjs`:

1. `BLOCK` inserted immediately after the unique `<?php Header::setupHeader(); ?>\n`
   (before the existing `<style>`): one inline bootstrap `<script>` and one `<style>`
   holding only `@media screen` palette rules (canvas/paper/ink/line tokens with
   literal fallbacks, plus one inset line on the form).
2. `<body class='m-0'>` → `<body class='m-0 oe-eob-process'>`.

Every other byte is the base route (`18647270`, fixture
`tests/fixtures/eob-process-original.php.txt`, sha256 `b6159de4…c5af`, 36223 bytes).
Untouched: ACL, CSRF, `$_GET` handling, ERA name/path containment, parsing,
`SLEOB::arPost*`, `UPDATE form_encounter`, `ob_start`/`fwrite`/`fclose`/`ob_end_flush`,
existing `.errdetail/.newdetail/.infdetail/.dehead` CSS, inline `bgcolor` rows,
`checkAll`, hidden inputs. No fonts, geometry, controls, callers
(`sl_eob_search.php`, `era_payments.php`) or shared assets (`popup.js`, `popup.css`)
changed. No PHP added.

## Bootstrap behaviour (as designed and VM-modelled)

- Owns only `oe-eob-process-standalone` on `<html>`; never touches body, shared
  classes, storage writes, timers, network, `location` or opener.
- Applies only in a top-level window with no opener and
  `localStorage['openemr.navigation.mode'] !== 'legacy'`; any accessor/storage
  exception fails closed (no class).
- Real opener or framed parent: does nothing and reads no storage; the shared,
  unchanged `popup.js` owns `oe-workbench-context` in that case.
- Re-evaluates on local-area `storage` events for the key or `clear()`;
  `pagehide` detaches and drops its own class; `pageshow` re-attaches and re-syncs.
  A preexisting class is never removed.

## Archived report

The route archives its own output (`ob_get_contents()` → `<era>.html`). Archived
HTML now **includes the block and marker**. No archive byte equivalence with
pre-change reports is claimed. A later reopen of a saved report would run the
inline bootstrap against that viewer's localStorage preference at that time —
**not evaluated**.

## Test commands (controller runs)

```
node --test tests/eob-process.contract.test.cjs
node tests/eob-process.contract.test.cjs --history
```

## Observed chronology

- Tests-only commit `829e0c31`: corrected live-source RED — 52 tests, 51 pass,
  1 fail (`live route candidate acceptance`: missing presentation block).
- This change: the two route edits above plus this document. Genuine corrected RED
  (52 tests, 51 pass, 1 missing-block fail) was captured locally BEFORE the source
  change, from tests-only `829e0c31` afterward; it is NOT a hosted RED.
- Observed local verification, all passed: portable 52/52, history 56/56, full Jest
  62 suites / 1260 tests, rooted ESLint adapter, `node --check` on the bootstrap,
  stylelint (actual non-ignored file, 3 rules, empty warnings), `php -l`,
  `git diff --check`. Temporary 13 individual sibling-dependency links were removed.
- Process: initial Opus test invocation timed out with no edits; Sonnet then returned
  an incomplete-path result with no edits; with exact paths Sonnet wrote the
  meaningful tests. A synthetic NodeVM getter harness fix preceded the corrected RED.
  Production edit by canonical Opus 5.5. No permission denials or nested agents.
- Independent Codex Astra review of all 5 files and the full base-inverse: PASS, no
  P1/P2; one P3 (implicit-noopener wording) corrected here and in the test header.
- Hosted CI is still PENDING (not executed). No merge, no deployment.

## Pending — none executed

- Contrast/focus in default, dark and solar themes for semantic rows
  (`.errdetail/.newdetail/.infdetail`, `table-light`, `table-danger`, inline
  `bgcolor` rows), links and controls.
- Legacy mode and print output.
- Native opener retention and COOP behaviour for `window.open(url, '_blank')` (no
  noopener feature, so it does not itself suppress the opener), and BFCache restore.
  Retained openers delegate to the shared `popup.js`; openerless/COOP contexts use
  the route bootstrap.
- Narrow, short-viewport and RTL layouts.
- Archived saved-report rendering, including localStorage preference on later reopen.
- Live QA: the route mutates financial and file state on GET (including before HTML
  output and on debug paths). Any live run needs a separately approved backup/sandbox
  preflight. No PHP, app, DB, debug GET or ERA parsing was run for this change.

## Still open

All of the following remain OPEN, and this change closes none of them:

- The original 22-feature programme.
- Demo coverage.
- Exhaustive popup-body coverage.
- The full researched UI.
- The Swedish programme (broader than localisation alone).

No native, clinical, financial or archive acceptance is recorded. No merge, deploy
or cron.
