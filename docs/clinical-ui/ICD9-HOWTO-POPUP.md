# ICD9 how-to popup (OPEMR-53)

Status: **tests only**. Production (`interface/code_systems/icd9_howto.php`) has not
been changed. The production source check in the contract fails on purpose until the
seam below lands.

## Scope

One route: `interface/code_systems/icd9_howto.php`, the 44-line instructions fragment
the External Data Loads page opens for ICD9. This is a **partial source adaptation** of a
legacy fragment so it reads as paper-and-ink inside the clinical workbench popup. It is
not a native or researched redesign of the route, its copy, its structure or its flow.

Out of scope and unchanged: the caller (`interface/code_systems/dataloads_ajax.php`),
`library/dialog.js`, `interface/clinical-workspace/popup.js`, `popup.css`,
`workspace.css`, `ClinicalWorkspaceAssets`, `Header`, the compiled themes, the other
`*_howto.php` routes, and every other popup. The All22, demo, exhaustive-popup and
Swedish scopes, and all previously denied boundaries, stay as they were. Nothing here
renews consent to any denied operation.

## Source facts the design rests on

- The route has no `<html>`, `<head>` or `<body>`: it prints `Header::setupHeader()`
  output followed by one `<div class="container">`.
- The original nests `<ol>` inside `<p>`. Browsers close the `<p>` before the `<ol>` and
  turn the trailing `</p>` into an empty paragraph. That repaired structure is the
  shipped behaviour and is preserved, not "fixed".
- The only link is the CMS download page:
  `https://www.cms.gov/Medicare/Coding/ICD9ProviderDiagnosticCodes/codes.html`,
  `target="_blank" rel="noopener"`, class `font-weight-bold`.
- Activation: `config/config.yaml` autoloads `workbench-popup` (`popup.js` + `popup.css`)
  on every `Header::setupHeader()` page. `popup.js` adds `oe-workbench-context` to
  `<html>` only when a same-origin parent/opener chain reaches an active workbench, and
  `oe-workbench-popup` when the frame sits in a `.dialogModal`. `dlgopen` with the
  default `iframe` type mounts the frame inside `.dialogModal` on `top`, so this route gets
  both classes inside the workbench and neither outside it.
- Palette: the shared token defaults in `popup.css` — ink `#17343b`, paper `#fff`,
  line `#d9e4e2`, petrol `#086878`.
- Dark theme sets `$link-color: #f0f0f0`, which is near-invisible on paper. Solar takes its
  link colour from bootswatch variables, which were not inspected here. The link therefore gets its own paired
  colour and transparent background.

## Intended production seam

Exactly two edits, nothing else:

```php
<?php Header::setupHeader(); ?>
<style media="screen">
    html.oe-workbench-context .container.oe-icd9-howto-document {
        color: var(--oe-wb-ink, #17343b);
        background-color: var(--oe-wb-paper, #fff);
        box-shadow: inset 0 0 0 1px var(--oe-wb-line, #d9e4e2);
    }

    html.oe-workbench-context .container.oe-icd9-howto-document a {
        color: var(--oe-wb-petrol, #086878);
        background-color: transparent;
    }
</style>

<div class="container oe-icd9-howto-document">
```

No wrapper, body, fonts, padding, margins, width, geometry, controls, JS, PHP or link
changes. The inset shadow draws the neutral edge without changing layout.

## What the tests prove

`tests/fixtures/clinical-workspace/icd9-howto-popup.contract.cjs` (node:test, no
dependencies) with `tests/fixtures/clinical-workspace/icd9-howto.original.php.fixture`:

- The fixture digest is pinned (`FIXTURE_SHA256`), and with `CHECK_ICD9_HISTORY=1` the
  fixture must equal `git show 18647270…:interface/code_systems/icd9_howto.php`
  (a Git failure fails the test; it does not skip).
- The activation facts above are still true in source (config, `popup.js`, caller,
  `dialog.js`, token defaults). If any changes, the test fails instead of the seam
  inventing activation.
- A synthetic candidate built from the single Header/container anchor passes, and its
  exact inverse equals the frozen original byte for byte. That inverse is the broad
  preservation check: every PHP byte, string, link URL/rel/target, list and the original
  structure.
- Mutants are rejected: text, PHP escaping, link URL/rel/target, list type and items,
  "repaired" nesting, unrelated edit, geometry declaration, extra unscoped selector,
  dropped context scope, `!important`, wrong or missing media, duplicated or moved
  style, missing or wrapped marker, `<body>` wrapper, shared asset link, missing or
  unpaired link colours.
- Production: the inverse already equals the original (passes now); the presentation
  check fails now with "missing screen presentation" and passes only once the seam lands.

Contrast checks are arithmetic on token values (ink on paper ≥ 7:1, petrol on paper
≥ 4.5:1). They are not a measurement of effective rendered contrast.

## Commands

```bash
node --test tests/fixtures/clinical-workspace/icd9-howto-popup.contract.cjs
CHECK_ICD9_HISTORY=1 node --test tests/fixtures/clinical-workspace/icd9-howto-popup.contract.cjs
npx jest tests/js/clinical-icd9-howto-popup.test.js
```

## Open acceptance (not covered by these tests)

- **Auth/bootstrap:** the route requires `globals.php` and a session; no live request was
  made. Rendering under a real login is unverified.
- **Effective contrast in compiled default, dark and solar themes:** must be checked in a
  browser with the compiled CSS, including the bold link and hover state.
- **Link affordance:** petrol vs ink is about 2:1, so the link is distinguished from body
  text by colour plus the original bold weight, not by underline. Whether that is enough
  is a QA decision.
- **Size:** the caller passes 800×250. `dlgopen` clamps an iframe height ≤ 300 to 300,
  then sizes to content + 60 within the viewport; width 800 becomes a percentage of the
  top window, or `modal-full` (97%) when the top window is ≤ 1080px wide. Open, then
  resize narrow and short; check scrolling and that nothing is clipped.
- **RTL, keyboard and roles:** RTL rendering, focus order, visible focus on the link,
  Escape/Close behaviour and the dialog role are unverified.
- **Print:** the style is `media="screen"`, so print paint is unchanged, but the
  `oe-icd9-howto-document` class is in the DOM for all media. Legacy print QA is open.
- **Outside the workbench:** with no `oe-workbench-context` the selectors do not match,
  so the legacy view should be unchanged; unverified in a browser.
- **Route-local authority:** whether a route-local inline style is the accepted home for
  this presentation (versus a shared asset) has not been cleared.

## Not done

No live application, bootstrap, caller, install, download, database, real-patient,
vendor, national or print requests; no merge, deploy, policy or cron actions.
