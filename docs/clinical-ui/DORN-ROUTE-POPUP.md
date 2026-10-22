# DORN create-route popup: section-sheet presentation (OPEMR-51)

Status: **implemented in source; local GREEN and hosted final CI pending the
controller.** Partial, researched UI change, not full design acceptance. All
evidence is source-level, not native browser evidence. Ordinary GitHub review
is still required.

- Route: `interface/modules/custom_modules/oe-module-dorn/public/route_edit.php`
- Caller: `interface/modules/custom_modules/oe-module-dorn/public/lab_setup.php`
- Frozen original: `tests/fixtures/clinical-workspace/dorn-route.original.php.fixture`
  (master `18647270e0c799189d2dc10f801e8de2bff1a360`)
- Contract: `tests/fixtures/clinical-workspace/dorn-route-popup.contract.cjs`,
  Jest wrapper `tests/js/clinical-dorn-route-popup.test.js`

## Exact additions

Two additions only; every other byte of the route is the original.

1. `<body class="container-fluid">` became
   `<body class="container-fluid oe-dorn-route-popup">`.
2. A second style block, directly after the untouched original `<style>` block
   and directly before `</head>`:

```html
    <style media="screen">
      html.oe-workbench-context body.oe-dorn-route-popup {
        color: var(--oe-wb-ink);
        background-color: var(--oe-wb-canvas);
      }

      html.oe-workbench-context body.oe-dorn-route-popup > form > .form-section {
        color: var(--oe-wb-ink);
        background-color: var(--oe-wb-paper);
        border-color: var(--oe-wb-line);
      }
    </style>
```

Unchanged: the original style block (required `red`, section border
width/style, padding, margin, radius, unused `h5` rule), all PHP, controls, JS,
caller, helpers, assets and themes. Tokens come from the workbench scope of
`interface/clinical-workspace/popup.css`, autoloaded as `workbench-popup`
(`config/config.yaml`) via `Header::setupHeader(['opener'])`; both unchanged.

## What the rules do and do not reach

- Both rules apply only under `html.oe-workbench-context`, on screen only. The
  body rule changes the page backdrop and inherited ink; the section rule
  changes backdrop, inherited ink and edge colour of direct
  `form > .form-section` children.
- No selector targets `h2`, labels, help text, required markers, the alert,
  validation states, the checkbox or buttons. That does **not** mean they look
  unchanged: elements without their own colour rule (e.g. `h2`, labels) inherit
  the new ink, and everything, including red required markers, muted help text,
  the alert and `.is-invalid` borders, now sits on a different backdrop with
  different contrast.
- **Class in all media.** `media="screen"` limits the rules, but the body class
  is present in every medium, including print. Third-party or theme CSS that
  matches body classes has not been checked.

## Contract: exact preservation and full inverse

`restorePresentation()` removes exactly one approved seam, returning `null`
when that seam is missing or malformed. It does not itself authenticate the
remaining original content. `accepts()` and the surrounding assertions require
that restored content to equal the frozen original byte for byte, the shared
normalizer to restore it, and the live route to equal `applyPresentation(original)`. Line order, token inventories, mutants and the
verbatim caller are source comparisons; history mode also pins caller,
connector, writers, models, `Header`, assets, popup CSS/JS, helpers and themes
to base, and the change to the five-file scope.

## Evidence

**RED (historical, before production):** hosted RED at `c511ae6c`, job
JS39218641667: 2 intended missing-production failures, 1443 passed, 7 optional
history skipped, 61 other suites PASS. Local portable: 184 passed, 2 failed.
Local mandatory history: 190 passed, 3 failed (missing production).

**Implementation:** the two additions above, exactly the contract's
`STYLE_BLOCK` and `BODY_APPROVED`. No test was modified.

**GREEN:** local GREEN and hosted final CI are pending the controller; no GREEN
result is reported here.

## Caller and frame

`createRouteClickEdit` calls `dlgopen(scriptTitle, '_blank', 800, 750, false,
addTitle, { sizeHeight: 'auto', allowResize: true, allowDrag: false })`, after
`doLabEULA` resolves `'accepted'` only when the lab requires a EULA. The initial
800x750 request is auto-height, capped by the viewport; the frame is unseen.

## Inherited risks (unchanged, not endorsed)

- Every render calls `ConnectorApi::getPrimaryInfos('')`; POST calls
  `createRoute`, `getLab`, then writes address book, procedure provider and DORN
  route with no transaction.
- CSRF checked only when `$_REQUEST` is non-empty; `labGuid` unchecked; vendor
  `responseMessage` shown (escaped); no closing `</form>`; customer label `for`
  mismatches its input `id` (preserved on purpose).
- Prechecked EULA, server-time "UTC" timestamp and default version are not
  consent; this change neither fixes nor approves the EULA flow.

## Native gates still open

All themes with/without workbench context; open, resized, narrow, short frames;
RTL; keyboard order and focus; ACL pass/deny; required/invalid states and
contrast on the new backdrops; Create and Cancel in `dlgopen`; EULA shown and
hidden; legacy print.

## Boundaries

No requests to the route, bootstrap, vendor, database or patient data; Save,
EULA and print not exercised. Denied PR112 review, six unpublished files and the
blocked Swedish clone are unchanged and not resolved here.
