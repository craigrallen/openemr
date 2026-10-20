# CAMOS note format chooser: screen palette (OPEMR-67)

Run: run1max2. Owner: Hermes.
Base: `18647270e0c799189d2dc10f801e8de2bff1a360`.
Full original `notegen.php` hash: `daecd758053f8657088fc4f6b7a3bec4b3214d9ddaf4278bfc6ea42e8503e43b`.

## Rationale

The first format-choice branch of `interface/forms/CAMOS/notegen.php` (the "Choose print format for this encounter report" page) loaded no workbench styling. This change lets it pick up the clinical workbench palette on screen, using the same route marker and popup script pattern as the other popup surfaces.

## Scope: exactly five paths

1. `interface/forms/CAMOS/notegen.php`
2. `tests/camos-note-format.contract.test.cjs`
3. `tests/js/camos-note-format.test.js`
4. `tests/fixtures/camos-note-format-original.php.txt`
5. `docs/clinical-ui/CAMOS-NOTE-FORMAT-SCREEN.md` (this file)

Paths 2 to 4 were committed first as tests-only (`bb1f0f3b`); this change adds the production edit and this document.

## What changed

- In the first format-choice branch only, `<html>` becomes `<html class='oe-camos-note-format'>`.
- Before that branch's first `</head>`, after `</title>`, a `popup.js` script tag and a `<style>` block are added.
- The CSS is wrapped in `@media screen` and sets only colours (body and form background and ink, plus a form inset border), using `--oe-wb-*` tokens with the `popup.css` values as fallbacks. `popup.css` is not loaded on this route.

## What is preserved

- All original route bytes outside the marker and the head addition are unchanged.
- This includes the second chooser, the generated HTML and PDF output, `printLogPrint`, and signatures (the source-inverse preserves the entire original).
- No change to `Header`, `popup.css`, `workspace.css`, wrappers, sizing, typography, form markup, print or PDF, queries, CSRF, or callers.
- The generated print/PDF branch has no additions.
- The real caller is `report.php:34`, a named `target=_new` link carrying pid and encounter. No caller was manufactured.

## Limits of the change

- The marker class and head script are an all-media DOM change; the CSS itself is screen only.
- The unchanged `popup.js` VM is only synthetic discovery. There is no native opener or COOP guarantee.
- This is a partial palette presentation. It is not the full researched UI, all 22 requested features, the demo, exhaustive popups, or Swedish acceptance.

## Status

- Local RED, captured before production on the tests-only commit `bb1f0f3b`: 144 tests, 143 pass, 1 missing marker. There is no hosted RED claim.
- Controller evidence: portable contract 144/144; mandatory history contract 148/148; full Jest 62 suites, 1260 tests. Stylelint on the actually added CSS (non-ignored) and ESLint on the rooted Jest adapter passed. PHP syntax check and diff check passed. The full Git-base inverse passed.
- Independent review: Codex gpt-6-astra reviewed the complete five-file diff plus source context and independently reran the 144 and 148 contracts, the PHP syntax check and the diff check. It found no introduced P1, P2 or P3 issues.
- Process: Opus 5.5 wrote the tests. The first Opus production attempt (max 10 turns) made no edits, so Sonnet 5.5 did a bounded, exact implementation recovery. There were no permission denials and no nested agents. The 13 temporary individual sibling dependency links were removed. No installs, config or gate changes were made.
- Hosted exact-head CI remains PENDING until the controller publishes and reads back the head.

## Still open

Native permissions and bootstrap, `content_parser` effects, compiled theme controls and contrast, keyboard and RTL, narrow and short windows, window reuse, OS print and PDF, and clinician review.

## Approvals and boundaries

- No merge or deploy. Ordinary approval is needed; there is no standing bypass.
- The denied Swedish checkout and publication, and all other denied boundaries, are preserved.
