# ICD10 installation details fragment (OPEMR-14)

Bounded palette pass on `interface/code_systems/icd10_howto.php`, the ICD10
"Installation Details" fragment opened from `interface/code_systems/dataloads_ajax.php`.

## What changed

- `interface/code_systems/icd10_howto.php`
  - Imports are now exactly, and sorted:
    `OpenEMR\Common\Assets\ClinicalWorkspaceAssets`, `OpenEMR\Core\Header`,
    `OpenEMR\Core\OEGlobalsBag`.
  - One `media="screen"` stylesheet link immediately after
    `Header::setupHeader()`. The web root is escaped with `attr()` and the
    cache version with `attr_url()`; the version comes from
    `ClinicalWorkspaceAssets::version('icd10-howto-popup.css')`.
  - The existing `<div class="container">` gains the hook class
    `oe-icd10-howto-document`. No wrapper, `<html>`/`<head>`/`<body>`,
    `<script>`, `<style>` or PHP variable is introduced.
  - Everything else is byte-for-byte original: the translated steps, the CMS
    link (`target="_blank" rel="noopener"`, `font-weight-bold`), the
    `contrib/icd10` path, the global bootstrap, and the original malformed
    markup (`<ol>` nested inside `<p>`).
- `interface/clinical-workspace/icd10-howto-popup.css` (new): exactly four
  rules, all scoped to `html.oe-workbench-context .oe-icd10-howto-document`:
  1. container: `background-color` paper, `color` ink;
  2. `a`: `background-color: transparent`, `color` petrol;
  3. `a:focus`: 2px solid petrol outline, 2px offset;
  4. `a:focus-visible`: the same outline, as a separate rule (not grouped).

  Fallbacks restate the `popup.css` workbench tokens: paper `#fff`, ink
  `#17343b`, petrol `#086878`. No geometry, typography, `!important`,
  at-rules or nested rules.
- `src/Common/Assets/ClinicalWorkspaceAssets.php`: one additive, sorted
  `SUPPORTED` entry, `icd10-howto-popup.css`. No behaviour change.

No caller, `Header`, `dialog.js`, shared workbench asset, backend, config or
theme file is changed. No security fixes are mixed into this change.

## Evidence and its limits

`tests/js/icd10-howto-popup.test.js` is a source-only contract. It reads files
as text and proves:

- source preservation: undoing exactly the permitted route edits restores the
  original 44-line fragment fixture byte for byte;
- the helper equals its master `18647270` baseline plus one sorted line;
- the stylesheet's PostCSS AST is exactly the four allowlisted rules and
  declarations;
- negative controls (changed content, escaping, cache key, media, imports,
  hook placement, stray markup, unscoped/grouped/extra CSS) are rejected.

It does **not** execute PHP, `Header::setupHeader()`, `dialog.js` or a
browser, so it establishes nothing about the effective cascade. All of the
following remain **awaiting QA**:

- actual PHP/`Header` rendered-document and stylesheet activation QA (whether
  `html.oe-workbench-context` is present when this fragment renders);
- effective cascade against the compiled theme, and resulting text and link
  contrast;
- dialog fit at initial and resized, including narrow, sizes;
- keyboard focus visibility on the CMS link;
- translations, RTL and legacy print;
- behaviour under each role, and the real dialog Close control;
- fidelity to any researched design direction.

## Verification record

Results reported by the controller. They were not re-run for this
documentation-only edit.

- `php -l` on the route and helper: PASS.
- `stylelint` on the actual, non-ignored
  `interface/clinical-workspace/icd10-howto-popup.css`: PASS, no warnings.
- `git diff --check`: PASS.
- RED, before any production change: tests-only commit `310a74b8`, hosted JS
  job `38930808000`. A genuine RED with 4 intended failures, 1271 passing and
  62 suites.
- Baseline: the controller independently byte-compared the source fixture and
  the full embedded helper baseline against actual master `18647270`.
- GREEN, source-only, at `505c4dea`: hosted JS job `38931717754` PASS, 62
  suites and 1275 tests.
- Styling job `38931717693` at `505c4dea` **failed** ESLint
  `no-extra-boolean-cast` at `tests/js/icd10-howto-popup.test.js:359:17`
  (`if (Boolean(node.important))`).
- Repair: that one conditional is now `if (node.important)`. The truthiness
  is identical, the `!important` rejection and the negative controls are
  preserved, and no lint suppression was added and no test was dropped. This
  is a semantic-equivalent repair, not a behaviour change.
- Final CI on the repaired head is **pending**. No native PHP execution claim
  is made.

## Review and process status

- Independent review rotation: run 1 of a maximum of 2. It is a rotation
  starting from PR #87, not a continuation of PR #87.
- Roles: owner Hermes; implementer Claude Opus 5.5; reviewer Codex Astra.
- Independent review by Codex Astra is complete over the 6 files and found no
  introduced P1 or P2. This is not browser-runtime or native UI acceptance.
- All gates are kept; the lint repair does not waive or reduce any of them.
- Jira OPEMR-14: In Progress.
- PR #88: draft. No merge bypass.

## Caller, dialog and access facts (source reading, not audited)

- The actual caller `dataloads_ajax.php` is gated by
  `AclMain::aclCheckCore('admin', 'super')` and opens the fragment with
  `dlgopen(..., 800, 250, ...)` and no `type` override.
- `dlgopen` therefore defaults to an iframe. Its initial height is clamped to
  300px, then auto-sized with a `94vh` cap. 800x250 is a request, not a proven
  fixed content fit.
- The fragment itself has no explicit ACL check and no CSRF handling; it
  relies on the global bootstrap's authentication, which this change has not
  audited.

## Not done

- No installation endpoint, terminology-loading request, CMS link, live
  application GET/POST or database was visited or exercised.
- No new body paint: only the existing fragment container is painted.
- The other original 22 requested features, demo, exhaustive-popup and
  Swedish work remain open; they are requested features, not audit items.
  Previously denied actions stay denied.
- No merge, merge bypass, deploy or cron change.
