# OPEMR-64 — DORN receive-results screen (partial canvas)

| Field | Value |
|-------|-------|
| Owner | Hermes controller |
| Run | 1 of max 2 (rotated from PR137) |
| Branch | `OPEMR-64-dorn-receive-results-screen` |
| Base | `18647270e0c799189d2dc10f801e8de2bff1a360` |
| Phase | Pre-publication: local controller verification and independent static review complete; implementation uncommitted, not yet published |
| Status | **Local evidence recorded; hosted CI pending; no PR and no implementation SHA yet.** RED evidence/tests-only commit remains `8dcfb0c8`. Native/rendered/runtime behaviour is unverified. Not accepted; no merge or deploy authorized. |

This is a **partial canvas presentation** on one popup body. It is **not** the
researched layout and not completion of the researched UI.
`/Users/craig/artifacts/OpenEMR-Research/researched/index.html` is a design
reference only.

## Actual scope

Route: `interface/modules/custom_modules/oe-module-dorn/public/get_lab_results.php`
(original 76 lines). Frozen copy: `tests/fixtures/dorn-receive-original.php.txt`,
expected SHA-256 `e0910b5fa6fce3c9f11871f35f237b0e56ab0058570b2030a034f344644fa7b7`
(the fixture was written by file edit; its digest is checked by the suite, which
passed in the controller's local runs recorded under Evidence).

Production delta (written in the route, locally verified, not yet committed or
published), and nothing else:

1. `<body>` becomes `<body class="oe-dorn-receive-results">`.
2. One inline `<style>` directly after the original `<title>` line, inside `<head>`:

```css
@media screen {
  html.oe-workbench-context body.oe-dorn-receive-results {
    background-color: var(--oe-wb-canvas);
    color: var(--oe-wb-ink);
  }
}
```

Embedded with `<style>`/`</style>` at the head's 8-space level and each CSS line a
further 4 (12 spaces). No `!important`, no rule on `.alert`/`alert-*`/`role`, no
geometry, typography, wrappers, print rules, JavaScript, PHP or imports, and no
shared-file changes. The existing `alert-info`/`alert-success`/`alert-danger`/
`alert-warning` palettes are unchanged by this delta; this change adds no alert
rule. The shared `popup.css` already overrides warning colors, so the alert
palettes are not claimed to be pristine Bootstrap, and their contrast on the new
canvas remains an open gate (see below).

Preserved byte for byte (enforced by the full inverse, which removes exactly the
declared style and body marker and compares against the whole frozen original):
session bootstrap, GET and POST CSRF checks, `admin/users` ACL and denial
template, `$_REQUEST` parameters and `rejectResults` default,
`new ReceiveHl7Results()` and `receiveResults($resultsGuid, $rejectResults)`,
`Header::setupHeader(['opener'])`, title, the split/success/error/no-results
branches, `xlt()`/`text()` escaping, the four semantic alert classes, all three
`role="alert"` attributes and all text.

The context-specific canvas is a bounded incremental surface. It is **not**
clinical, security or accessibility clearance.

## Activation chain (read as text, not executed)

1. Caller `results.php` `getResults()` (lines 51–57) opens the route with
   `dlgopen(scriptTitle, '_blank', 800, 750, false, addTitle)` carrying
   `csrf_token_form`, after `top.restoreSession()`.
2. Route calls `Header::setupHeader(['opener'])`; `setupHeader` calls
   `setupAssets(..., true)`, so `autoload: true` assets load unless a `no_<asset>`
   token is passed.
3. `config/config.yaml` `workbench-popup` (`popup.js`, `popup.css`) is
   `autoload: true`; the route passes no `no_workbench-popup`.
4. `popup.js` adds `oe-workbench-context` to `<html>` only when a same-origin
   parent/opener chain reaches a `workbench-active` shell body, and removes it on
   legacy mode or `pagehide`. The suite checks this with a **synthetic** `vm`
   sandbox against stub windows only — not runtime evidence.
5. `popup.css` defines `--oe-wb-canvas` and `--oe-wb-ink` under `@media screen`
   for `html.oe-workbench-context`. Without the context class (legacy,
   standalone) or in print, the new selector matches nothing. The body class
   attribute itself is present in all media; it is inert because nothing outside
   the screen block targets it (source reading only; no print output produced).

## Mutating GET prohibition

The route's GET calls `ReceiveHl7Results::receiveResults`, which fetches and
acknowledges results against the external DORN connector and performs clinical
writes. It must not be loaded, bootstrapped, curl'd, driven through Selenium or
otherwise requested as verification. All checks here are text/fixture based.
Any rendered verification needs a sandboxed/stubbed connector and explicit
authorization.

## Tests

- `tests/dorn-receive.contract.test.cjs` (dependency-free `node:test`)
  - fixture digest, 76-line count and anchors;
  - synthetic planned candidate passes and inverts to the original byte for byte;
    untouched original rejected;
  - 62 independently anchored mutants, each asserted to actually change the
    candidate before rejection: seam missing/duplicated/relocated, body marker,
    print/all media and extra print block, global/context-less/popup-only/
    descendant selectors, palette missing/different/unknown, status and
    hard-coded colour, geometry, typography, font family, reorder, `!important`,
    `.alert`/`alert-success`/global alert/`[role]`/wrapper rules, indentation,
    JavaScript, wrapper markup, alert classes/roles/text/branches, `text()` and
    `xlt()` escaping, ACL, CSRF, session, parameters, reject default,
    `receiveResults` arguments/removal, receiver import, popup opt-out, PHP
    import, title;
  - activation chain text checks (Header, config, popup.css tokens, caller) and
    the synthetic `popup.js` check;
  - `live route contains exactly the approved presentation delta` — failed
    against the unchanged route in the recorded RED run; passes with the delta
    written (controller local run, see Evidence).
  - `--history` (run directly with node): base commit present (missing history is
    a failure) and a HEAD ancestor; fixture and inverse-restored route equal the
    base blob; caller/Header/config/popup.js/popup.css/dialog.js equal their base
    blobs; exactly the five files (route, fixture, contract, Jest adapter, this
    doc) changed including untracked. The portable suite never reads historic Git
    blobs, so a shallow hosted checkout can run it.
- `tests/js/dorn-receive.test.js` — Jest adapter running the portable suite with
  `process.execPath`.

Counts: portable 72 tests, `--history` 76. In the tests-only RED phase the
live-route test failed, and in `--history` the presentation, inverse-restored
route and five-file allowlist checks failed (see Evidence). With the delta
written the controller's local runs passed 72/72 and 76/76.

### Local commands

```bash
# Portable
node tests/dorn-receive.contract.test.cjs
# Git provenance — run directly
node tests/dorn-receive.contract.test.cjs --history
```

Do **not** use `node --test tests/dorn-receive.contract.test.cjs --history`; the
test runner does not forward `--history` and would run only the portable tests.

## Evidence

Recorded by the controller, before any production change:

- Tests-only commit: `8dcfb0c8` ("OPEMR-64 Specify receive lab results
  presentation contracts") on `OPEMR-64-dorn-receive-results-screen`.
- Local portable RED: 71 pass, 1 fail — the missing route-specific body marker
  (live-route presentation test).
- Local `--history` RED: 73 pass, 3 fail — the expected missing presentation,
  inverse-restored route and five-file allowlist checks.
- Fixture digest and the positive synthetic candidate / mutant checks passed.

After RED, the production delta above was written to the route by file edit only
(no PHP execution, no route request, no bootstrap).

Controller local verification (actual local runs, pre-publication):

- Portable suite: 72/72 pass.
- Direct `--history`: 76/76 pass. This covers the fixture, the full actual Git
  inverse of the route against the base blob, caller/Header/config/popup dialog
  files unchanged, and exactly the five expected files changed.
- Full Jest: 62 suites, 1260 tests pass.
- `php -l` syntax check: PASS.
- Rooted adapter ESLint: PASS.
- Stylelint on the actual, non-ignored, dedented inline CSS: zero warnings, PASS.
- Diff check: PASS.
- 13 individual existing sibling dependency links were created temporarily to
  run these checks and have been removed. No install, no config change and no
  gate change was made.

Independent review: Codex gpt-6-astra reviewed the complete five-file change and
the activation context, and reran the portable and `--history` suites. It found
no introduced P1/P2. This was a static/source review; native and runtime
behaviour were not exercised and remain unverified.

Not yet done, and not claimed:

- Hosted CI — pending.
- Implementation commit, implementation SHA and PR — none exist yet.
- Native/rendered gates (below) — open.

The final controller evidence path is
`/Users/craig/.hermes/projects/openemr/verification/dorn-receive-20261020/DELIVERY.md`.
It supersedes any timestamped in-repo note. Not accepted.

## Gates not passed (all OPEN)

- Native PHP rendering, session and authority (roles/ACL with real users)
- Themes and status contrast (each alert palette on canvas)
- 800×750 modal: opened, resized, narrow and short viewports
- RTL, keyboard/focus order and screen-reader roles
- Legacy (non-workbench) and print output
- Connector sandbox success and error paths

## Still open

Each is a separate gate; none is closed by this change:

- Original 22-feature programme: **OPEN**.
- Demo: **OPEN**.
- Exhaustive popup coverage: **OPEN**.
- Full researched UI: **OPEN**.
- Swedish acceptance: **OPEN**.
- Native contrast, roles, resize, keyboard, RTL, print and connector acceptance
  (the gates listed above): **OPEN**.
- Needs ordinary approval; no merge or deploy is claimed or authorized.
- Denied-action boundaries stand: Swedish checkout/publication denied; PR112
  unpublished and its review denied. None were inspected, retried or touched.
