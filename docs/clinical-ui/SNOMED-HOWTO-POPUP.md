# OPEMR-16: SNOMED installation details fragment

Branch: `OPEMR-16-snomed-instructions-fragment`. Contract:
`tests/js/snomed-howto-popup.test.js` (frozen at `37eecd86`). Fixture:
`tests/clinical-ui/fixtures/snomed-howto-popup-original.txt` (the original
47-line `interface/code_systems/snomed_howto.php`).

## Rationale

The External Data Loads page opens `snomed_howto.php` in a dialog. The intent
of OPEMR-16 is a conditional palette: when the dialog document carries the
workbench context class, the instruction text and the official SNOMED link use
the workbench paper/ink/petrol palette that neighbouring workbench popups use.
This describes the intended behaviour from the source; it has not been observed
in a running workbench. OPEMR-16 adds that palette and nothing else. It does
not change wording, structure, layout, the warnings, or the installation
procedure.

## Exact scope

Three production files change, plus this document:

1. `interface/code_systems/snomed_howto.php` gets exactly the three additions
   frozen in `ROUTE_EDITS`:
   - sorted imports: `ClinicalWorkspaceAssets`, `Header`, `OEGlobalsBag`
     (only `Header` was imported before);
   - one `<link rel="stylesheet" media="screen">` right after
     `Header::setupHeader()`. Its href is the web root escaped with `attr()`,
     plus `/interface/clinical-workspace/snomed-howto-popup.css`, plus
     `?v=` and the per-file version escaped with `attr_url()`;
   - the hook class `oe-snomed-howto-document` on the existing
     `<div class="container">`.

   Undoing those three additions gives back the original fixture byte for
   byte. Everything else stays as it was: all 47 original lines, all eight
   `xlt()` calls, the three translated steps, the PHP-concatenated official
   link `https://www.snomed.org/snomed-ct/get-snomed` with
   `target='_blank' rel='noopener'`, the `contrib/snomed` path, both
   `h5.text-danger` warnings in their original order, and the English/Spanish
   language list. The change adds no PHP variables (the fragment runs in the
   includer's scope) and no `<html>`, `<head>`, `<body>`, `<script>` or
   `<style>` element.
2. `interface/clinical-workspace/snomed-howto-popup.css` is new. It has exactly
   four rules, each with a single selector, all scoped to
   `html.oe-workbench-context .oe-snomed-howto-document`:
   - container: `background-color: var(--oe-wb-paper, #fff)` and
     `color: var(--oe-wb-ink, #17343b)`;
   - `a`: `background-color: transparent` and
     `color: var(--oe-wb-petrol, #086878)`;
   - `a:focus` and `a:focus-visible` are separate rules, each with
     `outline: 2px solid var(--oe-wb-petrol, #086878)` and
     `outline-offset: 2px`.

   The file adds no custom properties, wrapper selectors, `html`/`body` rules,
   at-rules, `!important`, fonts, geometry (padding, margin or width), or any
   selector that could reach the warnings. The fallbacks repeat the tokens that
   `popup.css` sets on `html.oe-workbench-context`.
3. `src/Common/Assets/ClinicalWorkspaceAssets.php` gets one new `SUPPORTED`
   entry, `snomed-howto-popup.css`. It goes between `patient-search.css` and
   `soap-document.css` to keep the list sorted. The rest of the file is
   unchanged.

These are not changed by this production phase: the caller
`dataloads_ajax.php`, `library/dialog.js`, `workspace.css`, `popup.css`,
`popup.js`, configs, dependencies, sibling `*_howto.php` fragments, and any
download, install, database, deploy, national or vendor behaviour. The test
(`tests/js/snomed-howto-popup.test.js`) and fixture were added in the earlier
tests-only commit `37eecd86` and are unchanged by the production phase; this
does not claim they are unchanged across the whole PR.

## Source-only limitations

No native (running-application) observations exist for this change. The only
executed evidence is the hosted source-contract RED described under Evidence;
everything else below comes from reading source text and has not been observed
running.

- **Caller.** The caller found in source is the generic `dlgopen()` call in
  `interface/code_systems/dataloads_ajax.php` line 213. This is not an
  exhaustive census of callers. It sits behind the
  page's `admin`/`super` ACL check (line 29) and opens
  `${dbName.toLowerCase()}_howto.php` at 800×250 with no `type` and no
  `sizeHeight`. In `library/dialog.js` those defaults mean an iframe
  (`type: 'iframe'`) with `sizeHeight: 'auto'`, an initial height clamp of
  300px for iframes, and a `max-height: 94vh` cap. These are source anchors,
  not a measured native fit. The dialog has not been shown to fit, clip or
  resize correctly.
- **Authorization.** The fragment includes `interface/globals.php`, so it gets
  the standard session authentication. It has no endpoint-specific ACL or CSRF
  check of its own; the `admin`/`super` check lives on the caller page. This
  change does not alter that, and it is not a security review or clearance of
  the endpoint.
- **Link.** The SNOMED link is informational. Nobody visited it as part of this
  work, and nothing here says anything about SNOMED download, installation or
  licensing terms.
- **Warnings and contrast.** There is no direct warning selector: no new rule
  targets the two `h5.text-danger` warnings. They are still descendants of the
  container, so when the workbench context is active the ancestor paper
  background paints behind them (changing their backdrop) and the ancestor ink
  colour is inherited wherever the warnings do not set their own. Their
  contrast against that paper, and the petrol link's contrast, have not been
  measured. Acceptance requires measuring warning and link contrast in the
  compiled default, dark and solar themes.

## Awaiting QA (not yet done)

- running the real PHP and checking how `Header::setupHeader()` and the
  stylesheet link come out in the rendered page;
- workbench-context activation in the dialog iframe (the rules only apply under
  `html.oe-workbench-context`);
- keyboard focus order and visible focus outlines, and whether the dialog
  clips the 2px outline offset;
- the dialog at its initial size and after a resize, at narrow widths;
- RTL layouts and translated strings longer than English;
- legacy print (the stylesheet is `media="screen"` only);
- different user roles reaching the caller;
- the real Close button behaviour.

This is a partial palette alignment. It is not a finished, researched visual
fidelity pass.

## Evidence

**RED** (actual hosted source-contract run, supplied by the controller and not
re-run here): a hosted run at `37eecd86`, job `38956767010`, was executed and
reported 5 failures, all intended missing-production failures, with 1273 tests
passing across 62 suites. The production files did not yet exist or were
unchanged when it ran.

**GREEN and review**: the controller will add these after this change. Nothing
is recorded here yet.

## Process

- An ordinary PR with normal approval is required. There is no standing
  bypass.
- The boundaries already set for this work still apply, and denied actions are
  not retried: local Node/Jest execution, history-GATE execution, hash or cache
  manipulation, PHPUnit/bootstrap runs, and Swedish clone/publication remain
  blocked. This is not a blanket ban on legitimate Git history reads.
- No live GET/POST, downloads, installs, database writes, deploys, cron jobs,
  or national/vendor changes.
- Branch, commit and PR identifiers must use the exact uppercase key
  `OPEMR-16`. The canonical base for the fork is `master`; nothing is written
  directly to `master`.
