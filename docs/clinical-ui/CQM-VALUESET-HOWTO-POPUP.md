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

Production phase changes exactly three production files (items 1-3) plus this
document (item 4). This document is documentation, not a production file.

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
4. This document (documentation only; not a production file).

These are kept as they were in the original fragment: all five `xlt()`
translations; the PHP-concatenated, untranslated official VSAC link
(`https://vsac.nlm.nih.gov/#download-tab`, `target='_blank' rel='noopener'`);
the `contrib/cqm_valueset` path; the single `h5.text-danger` warning; the
inherited `VALUSET` typo; the single-quoted container; the inherited malformed
`</dvi>` closing tag as the last line; and the lack of a blank line after the
Header call.

Not changed: JavaScript, backend, `dataloads_ajax.php` or any other caller,
`library/dialog.js`, shared workbench `workspace.css`/`popup.css`/`popup.js`.

The tests and the fixture are unchanged by this production phase: they are
byte-identical to the tests-only commit `320e6fe6`. They are nevertheless ADDED
across the whole PR, by that earlier tests-only commit, so the PR as a whole
contains the test file and the fixture in addition to the three production files
and this document.

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

### Controller-supplied evidence (executed by the controller, not by the writing agent)

All results below were run and reported by the controller. The agent that wrote
this change did not run, reproduce or independently verify any of them.

- RED at `320e6fe6`: JS job 38968256945, 5 intended missing-production failures,
  1273 tests passing across 62 suites.
- GREEN at production commit `f3bef416`: JS job 38968903763, 62 suites, 1278
  tests, PASS.
- Controller local checks: two PHP syntax checks, non-ignored CSS lint and diff
  check all PASS. The first stylelint attempt failed on missing config
  resolution. It was recovered by running with the sibling config basedir, which
  gave an actual one-non-ignored-file, warning-free result. No config files were
  changed.
- Independent Codex Astra review: complete, captured, covering the 6 changed
  files plus a caller review. It reported no introduced P1/P2 findings and used no
  tools. Native QA and security clearance are NOT accepted on the strength of this
  review.
- Hosted Styling job 38968903884: all PHP, JS and CSS checks succeeded.
- Still pending: the full hosted matrix, the isolated suite and the Codecov final
  gate. No all-green claim is made.

### Agent writing phase

Only Read, Edit and Write were used. No shell, network, git or test runs, and no
tests, PHP, linters or builds, were run while writing this document. Production
code, tests and fixture were left unchanged by this edit.

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
publication were out of bounds and not attempted. All denied boundaries were
respected and none was retried: no merge, deploy, DB, application HTTP or cron.

Every later branch, commit and PR keeps the exact uppercase `OPEMR-17` key. The
one exception is naming the canonical base branch `master` rather than generic
`main`. There are no direct writes to `master`, and no authorization is given to
sync `master`.
