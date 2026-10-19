# DORN primary config edit popup (OPEMR-50)

Route: `interface/modules/custom_modules/oe-module-dorn/public/primary_config_edit.php`
Caller: `interface/modules/custom_modules/oe-module-dorn/public/primary_config.php`
(`doedclick_edit` / `doedclick_add`, both `dlgopen(..., 600, 750, ...)` with an
external secondary **Close** button).

Base: `master` at `18647270e0c799189d2dc10f801e8de2bff1a360`. Run 1 of a
maximum of 2, rotated from OPEMR-49.

## Status

**Production candidate.** The approved presentation below has been applied to
the production route: the second screen-only `<style>` block and the
`<body class="oe-dorn-primary-popup">` marker, and nothing else. The source
contract, Jest wrapper and frozen original are unchanged from the tests-only
phase.

Final GREEN is **pending**: controller-owned verification and independent
review of this candidate have not yet been run or claimed. No local test run is
asserted by this change.

### Historical RED (tests-only phase)

Hosted RED was verified by the controller on the tests-only commit
`581bf99aeded8f1afe88f752c3c1239ccbb4ce65` (job `39208543143`, completed
FAILURE): exactly two missing-production failures, 1390 passing, 6 optional
history checks skipped, and the 61 other suites passing. The synthetic positive
candidate and every mutant passed; the historical baseline fixture, caller and
context equality checks passed; only the missing-production inverse failed.

## Approved change (exact additions, nothing else)

1. `<body>` becomes `<body class="oe-dorn-primary-popup">`.
2. A second, screen-only `<style>` block is inserted directly after the
   existing `.required-field` `<style>` block and before `</head>`:

```html
    <style media="screen">
      html.oe-workbench-context body.oe-dorn-primary-popup {
        background-color: var(--oe-wb-canvas);
      }

      html.oe-workbench-context body.oe-dorn-primary-popup > .container-fluid > form.form {
        background-color: var(--oe-wb-paper);
        color: var(--oe-wb-ink);
        box-shadow: inset 0 0 0 1px var(--oe-wb-line);
      }
    </style>
```

Everything else in the route must stay byte-identical to the frozen original
(`tests/fixtures/clinical-workspace/dorn-primary.original.php.fixture`). The
tokens come from `interface/clinical-workspace/popup.css`, which the
autoloaded `workbench-popup` asset in `config/config.yaml` already delivers via
the route's existing `Header::setupHeader(['opener'])`. No new asset, link,
script, wrapper, control, padding, margin, font, width, focus, required,
validation or print rule is added, and no fallback colours or `!important`.

## Original inverse

The contract defines a strict inverse (`restorePresentation`): it removes the
declared seam exactly once and returns `null` if the block is missing,
relocated, duplicated, malformed, or if any residue (`oe-dorn-primary-popup`,
`media=`, `oe-workbench`, a second `<style>`) remains. Production acceptance
requires the restored route to equal the frozen original byte for byte and the
candidate to equal `applyPresentation(original)` exactly. The untouched
original normalizes to itself but does **not** satisfy acceptance.

## Danger: no route execution or bootstrap

The route talks to the DORN vendor:

- `GET ?npi=` calls `ConnectorApi::getPrimaryInfoByNpi()` (vendor lookup);
- a Save `POST` calls `ConnectorApi::savePrimaryInfo()` (vendor write).

Nothing in this slice requests, executes or bootstraps the route
(no `globals.php`, no HTTP, no Selenium). Every check is a byte-level source
comparison.

## Inherited issues — preserved, NOT cleared

The contract deliberately pins these as-is; a mutant that silently fixes them
is rejected. They need their own approved work:

- `attr_url($data->npi)` in the form action dereferences `$data` when it is
  `null` (Add mode / no NPI).
- `text($response->message)` assumes a non-`true` save response carries
  `message`; failure shapes are not handled.
- CSRF is verified on any non-empty `$_REQUEST`, with the token also carried
  in the action query string.
- ACL is `admin/users` only, denied via `AccessDeniedHelper::denyWithTemplate`.

## Tests

- `tests/fixtures/clinical-workspace/dorn-primary-popup.contract.cjs` —
  dependency-free Node contract (`node --test <file>`); opt-in history mode via
  `--history` or `OPEMR50_DORN_HISTORY=1` (fails, never skips, without Git or
  the base commit).
- `tests/js/clinical-dorn-primary-popup.test.js` — Jest wrapper; history
  suite skipped unless opted in.

Portable checks cover the frozen original's security/connector/control/
validation lines and counts, the approved block shape, token availability, the
shared normalizer, a synthetic adapted candidate, the caller's 600x750 opens,
and a mutation corpus of unapproved edits.

Tests-only phase, controller-run portable result (local): the synthetic positive
checks and all mutation guards pass; **exactly two** checks fail, both the
intended missing-production failures:

- `live route equals the approved presentation candidate`
- `live route passes production acceptance (restores byte-for-byte to the frozen original)`

These are source-only tests. They are **not** native acceptance and do not
show how the popup renders.

## Native acceptance — still open

Each gate needs real-browser evidence in the workbench before this can be
called done:

- light, dark and other native themes; workbench context on and off;
- 600x750 dialog, resized, narrow and short viewports;
- RTL;
- keyboard order and focus; roles and labels;
- required markers, invalid state, readonly Primary ID;
- Save, the external dialog footer/Close, success and error alerts;
- legacy (non-workbench) rendering unchanged;
- print unaffected.

## Governance

The production edit was made on controller instruction after the verified
hosted RED above. No merge, deploy, policy or cron change is part of this
phase. Hosted GREEN for the production candidate has not been run or claimed.
