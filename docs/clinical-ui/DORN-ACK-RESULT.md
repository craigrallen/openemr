# OPEMR-63 — DORN acknowledge-result screen (partial palette)

| Field | Value |
|-------|-------|
| Owner | Hermes |
| Run | 1 of max 2 |
| Branch | `OPEMR-63-dorn-ack-result-screen` |
| Base | `18647270e0c799189d2dc10f801e8de2bff1a360` |
| Phase | Tests and documentation only; route not yet modified |
| Status | Tests pending — production presentation test is expected to fail until the route change lands |

This is a **partial palette/sheet** on one popup. It is **not** completion of the
researched UI. `/Users/craig/artifacts/OpenEMR-Research/researched/index.html` was
used as design reference only.

## Actual scope

Route: `interface/modules/custom_modules/oe-module-dorn/public/ack_lab_results.php`
(66 lines). Frozen copy: `tests/fixtures/dorn-ack-original.php.txt`,
SHA-256 `7ec2c52b05b9822d6af41d842bf5d2e78cd2551899c43bd6fa0747972bc222fb`.

Planned production delta, and nothing else:

1. `<body>` becomes `<body class="oe-dorn-ack-result">`.
2. One inline `<style>` directly after the original `<title>` line, inside `<head>`:

```css
@media screen {
  html.oe-workbench-context body.oe-dorn-ack-result {
    background-color: var(--oe-wb-canvas);
    color: var(--oe-wb-ink);
  }

  html.oe-workbench-context body.oe-dorn-ack-result > h3 {
    background-color: var(--oe-wb-paper);
    color: var(--oe-wb-ink);
    box-shadow: inset 0 0 0 1px var(--oe-wb-line);
  }
}
```

Embedded with `<style>`/`</style>` at the head's 8-space level and each CSS line
indented a further 4 (12 spaces). No `!important`, geometry, typography, new
wrappers, PHP or imports, semantic status colour, JavaScript, or shared-file
changes.

Preserved byte for byte (enforced by the full inverse): session bootstrap, GET and
POST CSRF checks, `admin/users` ACL and denial template, `$_REQUEST` parameters,
`"true"` parsing, `ConnectorApi::sendAck($resultsGuid, $rejectResults, null)`,
`Header::setupHeader(['opener'])`, title, and both status strings
("Results Rejected" / "Results Accepted") with their branch.

## Activation chain (read as text, not executed)

1. Caller `results.php` `ackResults()` opens the route with
   `dlgopen(scriptTitle, '_blank', 800, 750, false, addTitle)` carrying
   `csrf_token_form`.
2. Route calls `Header::setupHeader(['opener'])`; `setupHeader` calls
   `setupAssets(..., true)`, so `autoload: true` assets load unless a `no_<asset>`
   token is passed.
3. `config/config.yaml` `workbench-popup` (`popup.js`, `popup.css`) is
   `autoload: true`; the route passes no `no_workbench-popup`.
4. `popup.js` adds `oe-workbench-context` to `<html>` only when a same-origin
   parent/opener chain reaches a `workbench-active` shell body, and removes it on
   legacy mode or `pagehide`.
5. `popup.css` defines `--oe-wb-canvas/ink/paper/line` under `@media screen` for
   `html.oe-workbench-context`. Without the context class (legacy, standalone) or in
   print, the new selectors match nothing.

## Mutating GET prohibition

The route's GET performs `ConnectorApi::sendAck` against the external DORN
connector. It must not be loaded, bootstrapped, curl'd, driven through Selenium or
otherwise requested as verification. All checks here are text/fixture based.
Any rendered verification needs a stubbed connector and explicit authorization.

## Tests

- `tests/dorn-ack.contract.test.cjs` (dependency-free `node:test`)
  - fixture digest and anchors; synthetic planned candidate passes and inverts to
    the original byte for byte;
  - untouched original rejected; 40+ independently anchored mutations rejected
    (seam missing/duplicated/relocated, body marker, print/all media, global or
    context-less or popup-only selectors, palette missing/different/unknown,
    status colours, geometry, typography, reorder, `!important`, extra rule,
    indentation, JS, wrapper, status/branch/title, ACL, CSRF, session, parameters,
    sendAck, popup opt-out, PHP import);
  - activation chain text checks for Header, config, popup.css tokens, caller and
    real `popup.js` controller in `vm`;
  - `live route contains exactly the approved presentation delta` — **fails now by
    design** (source unchanged).
  - `--history`: base commit ancestry, fixture and inverse-restored route equal the
    base blob, caller/Header/config/popup/dialog unchanged, and exactly the five
    files (route, fixture, contract, Jest adapter, this doc) changed including
    untracked. Not required for the portable/shallow suite.
- `tests/js/dorn-ack.test.js` — Jest adapter that runs the portable suite with
  `process.execPath`.

Result: **pending**. Nothing was executed in this phase; the controller owns
execution and independent review.

## Gates not passed

- Native themes (light/dark/solar/compact) rendering
- Status contrast (Rejected/Accepted headings on paper/canvas)
- Modal resize at and away from 800×750
- RTL
- Keyboard and focus order
- Roles/ACL behaviour with real users
- Print
- Connector success and connector error paths

## Still open

- All22 popup set, demo, full researched UI, Swedish localisation: **OPEN**.
- No ordinary approval, merge or deploy is claimed.
- Denied-action boundaries stand: Swedish checkout/publication and PR112
  unpublished work were not inspected, retried or touched.
