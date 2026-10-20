# OPEMR-63 — DORN acknowledge-result screen (partial palette)

| Field | Value |
|-------|-------|
| Owner | Hermes |
| Run | 1 of max 2 |
| Branch | `OPEMR-63-dorn-ack-result-screen` |
| Base | `18647270e0c799189d2dc10f801e8de2bff1a360` |
| Phase | Route presentation delta written after tests-only commit `1d32dfd0`; uncommitted |
| Status | Local controller checks pass: portable 52/52, history 56/56, PHP syntax, `git diff --check`, full local Jest (62 suites / 1260 tests), rooted adapter ESLint (zero warnings) and inline-CSS stylelint (zero warnings). Independent static dependency review found no introduced P1/P2. Hosted CI: **pending — no numerical hosted claim**. Not blanket GREEN. |

This is a **partial palette/sheet** on one popup. It is **not** completion of the
researched UI. `/Users/craig/artifacts/OpenEMR-Research/researched/index.html` was
used as design reference only.

## Actual scope

Route: `interface/modules/custom_modules/oe-module-dorn/public/ack_lab_results.php`
(original 66 lines; current 80 lines with the presentation delta). Frozen copy:
`tests/fixtures/dorn-ack-original.php.txt`,
SHA-256 `7ec2c52b05b9822d6af41d842bf5d2e78cd2551899c43bd6fa0747972bc222fb`.

Production delta (now written in the route), and nothing else:

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

Media scope, stated precisely: the inline style is `@media screen` only, so its two
rules do not apply when printing. The `class="oe-dorn-ack-result"` attribute on
`<body>` is a markup change and is present in the DOM for all media, including
print; it is inert only because no rule outside the screen block targets it. That
is a source-reading conclusion — no actual print output has been produced or
inspected.

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
  - `live route contains exactly the approved presentation delta` — failed at RED
    by design (source unchanged); passes in the controller's portable run against
    the actual source.
  - `--history`: base commit ancestry, fixture and inverse-restored route equal the
    base blob, caller/Header/config/popup/dialog unchanged, and exactly the five
    files (route, fixture, contract, Jest adapter, this doc) changed including
    untracked. Not required for the portable/shallow suite. Adds 4 tests (56 total).
- `tests/js/dorn-ack.test.js` — Jest adapter that runs the portable suite with
  `process.execPath`.

### Exact commands

```bash
# Portable (52 tests)
node tests/dorn-ack.contract.test.cjs
# Mandatory Git provenance (56 tests) — run directly
node tests/dorn-ack.contract.test.cjs --history
# PHP syntax and whitespace
php -l interface/modules/custom_modules/oe-module-dorn/public/ack_lab_results.php
git diff --check
```

Do **not** use `node --test tests/dorn-ack.contract.test.cjs --history`: this Node
test runner does not forward `--history`, so it runs only the 52 portable tests and
gives false confidence about provenance. (Corrected in the contract header comment.)
## Evidence

| Stage | Where | Result |
|-------|-------|--------|
| Local RED (portable suite, run by the controller before the route change) | `/Users/craig/.hermes/projects/openemr/verification/dorn-ack-20261020/red.log` | 52 tests: 51 pass, 1 fail, exit 1. The single failure is the intended one: `live route contains exactly the approved presentation delta` → `AssertionError: route-specific body marker` (0 !== 1). The frozen fixture's actual SHA-256 matched the original digest. |
| Local portable | `.../dorn-ack-20261020/green-history.log` | **PASS 52/52** against the actual source (controller-run). |
| Local `--history` provenance | `.../dorn-ack-20261020/green-history-explicit.log` | **PASS 56/56** via `node tests/dorn-ack.contract.test.cjs --history` (controller-run). |
| PHP syntax | controller-run | **PASS** (`php -l` on the route). |
| `git diff --check` | controller-run | **PASS**. |
| Full local Jest (includes adapter `tests/js/dorn-ack.test.js`) | `.../dorn-ack-20261020/jest.log` | **PASS — 62 suites, 1260 tests** (controller-run, local only). |
| Jest setup failures (retained) | `.../dorn-ack-20261020/jest-initial-setup-failure.log`, `jest-second-setup-failure.log` | Initial config/ESM dependency-resolution failures, kept as evidence. Resolved by 13 temporary individual sibling installed-package links, since **removed**; no config, lockfile, dependency or gate changes. |
| Adapter ESLint (rooted) | controller-run | **PASS — zero warnings.** |
| Inline CSS stylelint | `.../dorn-ack-20261020/stylelint.stdout`, `stylelint.stderr` | **PASS — actual dedented inline CSS, non-ignored, zero warnings.** Supersedes the earlier "CSS lint pending" status. |
| Independent review | `.../dorn-ack-20261020/review.md` | Codex CLI gpt-6-astra, complete five-file/static dependency review: **no introduced P1/P2**; confirmed the actual base inverse itself. `review.md` is evidence. Its P3 (stale CSS-lint status; original 66 vs current 80 lines) is corrected in this document. |
| Hosted CI | — | **Pending.** No hosted RED or GREEN and no numerical hosted claim. Current changes will be committed and published by the controller later; no PR or SHA is stated here. |

### RED chronology

The RED run happened **before** the tests-only commit `1d32dfd0` was created; it
was not run against that commit. The test bytes were captured in `1d32dfd0`, and
the original production route was unchanged at RED. The route delta was written
afterwards and is still uncommitted.

The route change was written with file edits only. The controller ran the checks
above (evidence directory `/Users/craig/.hermes/projects/openemr/verification/dorn-ack-20261020`)
and owns execution, independent review, commit and publication. These are local
results only; no native PHP output, print output or connector runtime was produced
or inspected.

## Gates not passed

- Native themes (light/dark/solar/compact) rendering
- Status contrast (Rejected/Accepted headings on paper/canvas)
- Modal resize at and away from 800×750
- RTL
- Keyboard and focus order
- Roles/ACL behaviour with real users
- Print (no actual print evidence; see media scope above)
- Connector success and connector error paths

## Still open

Each of these is a separate gate; none is closed by this change:

- Original 22-feature programme: **OPEN**.
- Exhaustive popup coverage (every popup, not only this route): **OPEN**.
- Demo: **OPEN**.
- Full researched UI: **OPEN**.
- Swedish acceptance: **OPEN**.
- No ordinary approval, merge or deploy is claimed.
- Denied-action boundaries stand: Swedish checkout/publication and PR112
  unpublished work were not inspected, retried or touched.
