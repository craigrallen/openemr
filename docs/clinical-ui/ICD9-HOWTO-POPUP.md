# ICD9 how-to popup (OPEMR-53)

Status: **source-adapted; local verification GREEN, hosted CI pending.** The route uses
canonical CSS indentation (2-space selectors, 4-space declarations). Mandatory-history
contracts pass 8/8; full local Jest passes 1260 tests in 62 suites; PHP syntax and actual
nonignored extracted-CSS stylelint pass. Native acceptance remains open. Final external
evidence supersedes any pending hosted-CI snapshot in this document.

## Scope

One route: `interface/code_systems/icd9_howto.php`, the 44-line instructions fragment
the External Data Loads page opens for ICD9. This is a **partial source adaptation** of a
legacy fragment so it reads as paper-and-ink inside the clinical workbench popup. It is
not a native or researched redesign of the route, its copy, its structure or its flow.
The paper/ink paint on the container must not be read as evidence that a complete,
researched design for this route exists.

Out of scope and unchanged: the caller (`interface/code_systems/dataloads_ajax.php`),
`library/dialog.js`, `interface/clinical-workspace/popup.js`, `popup.css`,
`workspace.css`, `ClinicalWorkspaceAssets`, `Header`, the compiled themes, the other
`*_howto.php` routes, and every other popup. The All22, demo, exhaustive-popup and
Swedish scopes, and all previously denied boundaries, stay as they were. Nothing here
renews consent to any denied operation.

## Source facts the design rests on

These are read from source only. No request was made to the application, so none of them
is a statement about literal rendered output.

- The route has no `<html>`, `<head>` or `<body>`: in source it calls
  `Header::setupHeader()` and then prints one `<div class="container">`. What
  `setupHeader()` actually emits at runtime, and what session or bootstrap state it needs
  to do so, was not exercised.
- The original nests `<ol>` inside `<p>`. Browsers close the `<p>` before the `<ol>` and
  turn the trailing `</p>` into an empty paragraph. That repaired structure is the
  shipped behaviour and is preserved, not "fixed".
- The only link is the CMS download page:
  `https://www.cms.gov/Medicare/Coding/ICD9ProviderDiagnosticCodes/codes.html`,
  `target="_blank" rel="noopener"`, class `font-weight-bold`.
- Activation (from source): `config/config.yaml` autoloads `workbench-popup`
  (`popup.js` + `popup.css`) for `Header::setupHeader()` pages. The `popup.js` controller
  sets `oe-workbench-context` on `<html>` in more than one situation, not only via a
  same-origin parent/opener chain that reaches an active workbench body: a top-level page
  that is itself the workbench shell (shell-local modals and overlays) also gets it, and
  the controller leaves a class that was already present on `<html>` (set by the server or
  the page) in place rather than owning or removing it. It sets `oe-workbench-popup` only
  when the host was reached through a `.dialogModal` frame or an opener. `dlgopen` with the
  default `iframe` type mounts the frame inside `.dialogModal` on `top`, so in source terms
  this route would get both classes when opened from the active workbench, and would match
  the scoped selectors in any context where `oe-workbench-context` is already on its own
  `<html>`. None of this has been observed in a browser.
- Palette: the shared token defaults in `popup.css` — ink `#17343b`, paper `#fff`,
  line `#d9e4e2`, petrol `#086878`.
- Dark theme sets `$link-color: #f0f0f0`, which is near-invisible on paper. Solar takes its
  link colour from bootswatch variables, which were not inspected here. The link therefore
  gets its own paired colour and transparent background.

## Production seam (applied)

Exactly two edits to the route, nothing else. The canonical form the contract now
requires:

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

The route now uses 2-space selectors and 4-space declarations. The controller extracts
the inline CSS and removes only its common 2-space embedding prefix, leaving the
repository-required 2-space property indentation. This formatting-only correction changes
no selector, declaration, value, palette or stylelint configuration.

Placing this presentation in a route-local inline style, rather than a shared asset, is a
deliberate bounded implementation choice for this one route, not an open approval item.

1. An inline `<style media="screen">` directly after the `Header::setupHeader()` line,
   with exactly two rules and five declarations, both scoped to
   `html.oe-workbench-context`.
2. The route-specific class `oe-icd9-howto-document` added to the existing
   `.container`.

No wrapper, body, fonts, padding, margins, width, geometry, controls, shared assets,
helpers, caller, PHP logic, JS or link changes. The inset shadow draws the neutral edge
without changing layout.

Note the two edits differ in reach. The style is screen-only and context-scoped, so its
paint applies only on screen inside the workbench context. The class is **not** scoped: it
is a real DOM change present in every context and every medium (screen and print, inside
and outside the workbench). Anything that selects on `.container` class lists, or prints
the DOM, sees it.

## What the tests prove

`tests/fixtures/clinical-workspace/icd9-howto-popup.contract.cjs` (node:test, no
dependencies) with `tests/fixtures/clinical-workspace/icd9-howto.original.php.fixture`,
also run under Jest by `tests/js/clinical-icd9-howto-popup.test.js`:

- The fixture digest is pinned (`FIXTURE_SHA256`), and with `CHECK_ICD9_HISTORY=1` the
  fixture must equal `git show 18647270…:interface/code_systems/icd9_howto.php`
  (a Git failure fails the test; it does not skip).
- Selected source strings the activation reading depends on are still present (the
  `config.yaml` autoload entry, the `CONTEXT_CLASS` constant and `.dialogModal` lookup in
  `popup.js`, the caller's `dlgopen` line, the `dialog.js` height clamp and modal class,
  and the token defaults in `popup.css`). This is a tripwire for those exact strings only.
  It does **not** prove that activation semantics are unchanged: logic around those
  strings (for example how the controller resolves its host, or when it adds or keeps
  classes) could change without failing the test.
- A synthetic candidate built from the single Header/container anchor passes, and its
  exact inverse equals the frozen original byte for byte.
- Mutants are rejected: text, PHP escaping, link URL/rel/target, list type and items,
  "repaired" nesting, unrelated edit, geometry declaration, extra unscoped selector,
  dropped context scope, `!important`, wrong or missing media, duplicated or moved
  style, missing or wrapped marker, `<body>` wrapper, shared asset link, missing or
  unpaired link colours, and the same rules re-indented 4-space selector / 8-space
  declaration (which the test also requires to be rejected by the format guard alone).
- Production: the inverse must equal the original, and the presentation check must pass.

**The inverse is not the validator.** `invert()` only removes the first style block that
directly follows the Header line and restores the first marked container; on its own it
would accept nothing and reject nothing about the CSS. Acceptance is decided by
`validate()`, which enforces the exact allowlist (two selectors, five declarations,
values equal to `EXPECTED_RULES`, canonical indentation with every line blank, a 2-space
selector, a 4-space declaration or a 2-space closing brace, `media="screen"`, single
placement directly after the
Header line and directly before the container, marker count, no comments, at-rules,
`!important` or escapes) **and** requires that the inverse of the source equals the
frozen original. Both conditions must hold.

Contrast checks are arithmetic on token values (ink on paper ≥ 7:1, petrol on paper
≥ 4.5:1). They are not a measurement of effective rendered contrast.

## Verification record

RED, before any production change (tests-only commit `67576861`, draft PR 127):

- `CHECK_ICD9_HISTORY=1 node --test` on the contract: 7 tests passed and 1 failed, the
  intended "production route carries the screen-only presentation seam" check with
  "missing screen presentation". Git fixture, base and digest equality were verified.
- Hosted JS run `39242666472` at exact commit `67576861`: the only failure was the new
  presentation contract Jest suite (1 failed); the 61 other suites passed, with 1259
  tests passing.
- An initial unpinned digest setup was corrected, before publication, with an
  independently calculated hash of the Git-base route. That correction was test
  plumbing; it is not a production RED claim.

After the source adaptation, before the formatting refinement (reported by the
controller; not re-run in this change):

- Local `CHECK_ICD9_HISTORY=1 node --test` on the contract: 8/8 passed (GREEN), including
  the mandatory Git-history check.
- PHP syntax check on the adapted route: passed.
- An independent five-file review found no introduced P1/P2 issues. It did find the
  documentation inaccuracies corrected here (activation conditions, what the source-string
  checks prove, and a mis-stated placement blocker).
- Stylelint fails on the route's inline CSS indentation (4-space declarations after
  dedent; 2 required).
- Hosted CI on the source change: **pending**.

Formatting refinement: all 23 original mutants were retained, a 24th indentation mutant
and strict format guard were added FIRST, then the controller recorded genuine RED
(7 passed, 1 production-format failure) in `format-red.txt`. Claude then changed only
production indentation to 2/4. Mandatory-history contracts passed 8/8; full local Jest
passed 1260 tests across 62 suites; PHP syntax and nonignored extracted-CSS stylelint
passed. Initial missing local ESM/config dependencies were recovered through temporary
individual sibling package links, all removed; initial failure logs are preserved.
Independent controller-owned Codex Astra full and final-delta reviews found no introduced
P1/P2 defects; P3 documentation corrections are incorporated. An ambiguous no-nested-CLI
brief produced no file reads or review; the corrected explicit read-only-shell brief
completed substantive independent verification without any denied read. Hosted final CI
remains pending; external `verification/icd9-howto-20261019/DELIVERY.md` and
`ci-current.json` provide the final exact-head outcome.

## Commands

```bash
node --test tests/fixtures/clinical-workspace/icd9-howto-popup.contract.cjs
CHECK_ICD9_HISTORY=1 node --test tests/fixtures/clinical-workspace/icd9-howto-popup.contract.cjs
npx jest tests/js/clinical-icd9-howto-popup.test.js
```

## Open acceptance (not covered by these tests)

All of the following remain open. None is closed by the source change or by the
contract.

- **Native auth, bootstrap and context:** the route requires `globals.php` in source. Its
  actual access behaviour (whether a login or particular session state is needed, and
  what happens without it) was not exercised and is not asserted here. Rendering under a
  real session, and whether `Header::setupHeader()` emits what the source reading
  assumes, are unverified. Whether `oe-workbench-context` is actually applied inside the
  workbench popup is unverified.
- **Themes, hover and effective contrast:** default, dark and solar compiled themes must
  be checked in a browser, including the bold link, its hover and visited states, and
  effective rendered contrast.
- **Link affordance:** petrol vs ink is about 2:1, so the link is distinguished from body
  text by colour plus the original bold weight, not by underline. Whether that is enough
  is a QA decision.
- **Size:** the caller passes 800×250. `dlgopen` clamps an iframe height ≤ 300 to 300,
  then sizes to content + 60 within the viewport; width 800 becomes a percentage of the
  top window, or `modal-full` (97%) when the top window is ≤ 1080px wide. Open, then
  resize narrow and short; check scrolling and that nothing is clipped. Unverified.
- **RTL, keyboard and roles:** RTL rendering, focus order, visible focus on the link,
  Escape/Close behaviour and the dialog role are unverified.
- **Link behaviour:** that the CMS link still opens in a new browsing context with
  `noopener` from inside the popup is unverified at runtime (source is unchanged).
- **Legacy and print:** the style is `media="screen"`, so in source terms print paint is
  unchanged, but the `oe-icd9-howto-document` class is in the DOM for all media and all
  contexts. Outside the workbench the selectors should not match, so the legacy view
  should be unchanged. Both legacy rendering and print are unverified.
- **Application access:** authorization and access control for this route (who may load
  it and under what checks) remain unverified. (CSS placement is not an open item; see
  the production seam section.)

## Not done

No live application, bootstrap, caller, install, download, database, real-patient,
vendor, national or print requests; no auth probes; no merge, deploy, policy or cron
actions.
