# OPEMR-64 — DORN receive-results screen (partial canvas)

| Field | Value |
|-------|-------|
| Owner | Hermes controller |
| Run | 1 of max 2 (rotated from PR137) |
| Branch | `OPEMR-64-dorn-receive-results-screen` |
| Base | `18647270e0c799189d2dc10f801e8de2bff1a360` |
| Phase | Tests and documentation only; production route **not** changed |
| Status | **Tests pending until controller evidence.** No local, hosted, review or rendering result is claimed here. Not GREEN. |

This is a **partial canvas presentation** on one popup body. It is **not** the
researched layout and not completion of the researched UI.
`/Users/craig/artifacts/OpenEMR-Research/researched/index.html` is a design
reference only.

## Actual scope

Route: `interface/modules/custom_modules/oe-module-dorn/public/get_lab_results.php`
(original 76 lines). Frozen copy: `tests/fixtures/dorn-receive-original.php.txt`,
expected SHA-256 `e0910b5fa6fce3c9f11871f35f237b0e56ab0058570b2030a034f344644fa7b7`
(the fixture was written by file edit; its digest is checked by the suite and must
be confirmed by the controller run).

Planned production delta (not yet written), and nothing else:

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
shared-file changes. Bootstrap's `alert-info`/`alert-success`/`alert-danger`/
`alert-warning` palettes and all descendants are left untouched.

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
  - `live route contains exactly the approved presentation delta` — expected to
    **fail** against the current unchanged production route (no presentation),
    and to pass only once the planned delta is written.
  - `--history` (run directly with node): base commit present (missing history is
    a failure) and a HEAD ancestor; fixture and inverse-restored route equal the
    base blob; caller/Header/config/popup.js/popup.css/dialog.js equal their base
    blobs; exactly the five files (route, fixture, contract, Jest adapter, this
    doc) changed including untracked. The portable suite never reads historic Git
    blobs, so a shallow hosted checkout can run it.
- `tests/js/dorn-receive.test.js` — Jest adapter running the portable suite with
  `process.execPath`.

Expected counts (to be confirmed by the controller): portable 72 tests, `--history`
76. In this tests-only phase the live-route test fails, and in `--history` the
five-file allowlist also fails because the route is not yet changed.

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

None yet. The controller owns execution, independent review, commit and
publication. No PR, SHA, local run, hosted run or review is claimed.

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
- Needs ordinary approval; no merge or deploy is claimed or authorized.
- Denied-action boundaries stand: Swedish checkout/publication denied; PR112
  unpublished and its review denied. None were inspected, retried or touched.
