# OPEMR-17: CQM VALUESET installation details fragment

Route: `interface/code_systems/cqm_valueset_howto.php`

## Rationale

The CQM_VALUESET "Installation Details" dialog in the code-systems loader is a
small instruction fragment. When the workbench context is active it currently
inherits only whatever the surrounding stylesheets give it. This change gives the
fragment the workbench paper/ink/link palette through one scoped stylesheet. It
changes no content, behaviour, backend code or callers.

This is a source-only, partial-palette change. It does not deliver researched
visual fidelity or a native fit with the workbench, and it makes no claim to.

## Exact scope

Production files changed (and nothing else):

1. `interface/code_systems/cqm_valueset_howto.php`: exactly the three additions
   frozen as `ROUTE_EDITS` in `tests/js/cqm-valueset-howto-popup.test.js`:
   - imports become `ClinicalWorkspaceAssets`, `Header`, `OEGlobalsBag` (sorted);
   - one escaped, versioned `media="screen"` stylesheet link placed directly after
     `Header::setupHeader()`, with no blank line between them;
   - the single-quoted container gains the hook class:
     `<div class='container oe-cqm-valueset-howto-document'>`.
2. `interface/clinical-workspace/cqm-valueset-howto-popup.css` (new). It holds
   exactly four single-selector rules, all scoped under
   `html.oe-workbench-context .oe-cqm-valueset-howto-document`:
   - container: `background-color` paper, `color` ink;
   - `a`: transparent background, petrol colour;
   - `a:focus` and, separately, `a:focus-visible`: `2px solid` petrol outline with
     a `2px` offset.
   The stylesheet adds no variables, fonts, geometry, wrappers, `html`/`body`
   rules, at-rules or `!important`, and no selector that targets `h5`,
   `.text-danger` or the warning.
3. `src/Common/Assets/ClinicalWorkspaceAssets.php`: one supported basename,
   `cqm-valueset-howto-popup.css`, inserted in sorted order between
   `calendar-workday.js` and `encounter-document.css`.
4. This document.

These are kept as they were in the original fragment: all five `xlt()`
translations; the PHP-concatenated, untranslated official VSAC link
(`https://vsac.nlm.nih.gov/#download-tab`, `target='_blank' rel='noopener'`);
the `contrib/cqm_valueset` path; the single `h5.text-danger` warning; the
inherited `VALUSET` typo; the single-quoted container; the inherited malformed
`</dvi>` closing tag as the last line; and the lack of a blank line after the
Header call.

Not changed: JavaScript, backend, `dataloads_ajax.php` or any other caller,
`library/dialog.js`, shared workbench `workspace.css`/`popup.css`/`popup.js`, the
tests and the fixture.

## Test history

- Tests-only commit `320e6fe6` ("OPEMR-17 Add VALUESET fragment preservation
  contracts") added `tests/js/cqm-valueset-howto-popup.test.js` and the original
  route fixture. It contained no production change. Before RED, the controller
  byte-compared the fixture and the full helper baseline against fetched master
  `18647270`.
- Actual hosted RED at `320e6fe6`, job JS38968256945: completed FAILURE with
  exactly the 5 intended missing-production failures, alongside 1273 passing
  tests across 62 suites.
- This production phase does not modify the tests: they are byte-identical to
  the tests-only commit.
- GREEN and review: still to come. The controller will supply them; none are
  claimed here. No tests, PHP, linters or builds were run while writing this
  change.

## Source-only limitations and known risks

- **Actual caller.** `interface/code_systems/dataloads_ajax.php` is gated by
  `admin`/`super` (line 29). Its generic `dlgopen` (around line 213) opens the
  fragment at 800×250 with the default iframe type and auto sizing, a 300px
  initial minimum height clamp and a 94vh cap. All of this is checked from source
  only.
- **Authorization.** The fragment itself relies only on global session auth via
  `globals.php`. It has no explicit ACL or CSRF check of its own. This change
  neither adds nor removes any, and it is not a security clearance.
- **Warning backdrop.** The new paper background changes the backdrop behind the
  inherited `h5.text-danger` warning when the workbench context is active. No new
  selector targets the warning, but its compiled contrast and the link contrast
  under the default, dark and solar themes have not been verified.
- **Malformed markup.** How browsers parse the inherited `</dvi>` (and the
  `<ol>`/`<h5>` inside `<p>`), and how that interacts with the hook container's
  extent, has not been verified. It is not fixed here.
- **Awaiting QA** (none performed): real PHP execution and `Header` output and
  parsing; workbench context activation inside the dialog iframe; keyboard
  focus visibility and focus-ring clipping; initial, resized and narrow dialog
  sizing; RTL and translated strings; legacy and print rendering; roles other
  than admin/super; real dialog Close behaviour.

## Boundaries

Ordinary review and approval apply, with no standing bypass. Writing this change
involved no application GET/POST, link visits, downloads, installs, account, DB,
deployment, merge, master, cron, national or vendor changes. Local
Node/Jest/history-GATE/hash/cache/PHPUnit/bootstrap runs and Swedish-clone
publication were out of bounds and not attempted. Every later branch, commit and
PR keeps the exact uppercase `OPEMR-17` key; syncing fork master is the only
exception.
