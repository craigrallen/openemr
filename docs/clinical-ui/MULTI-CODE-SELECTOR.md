# Multi-code selector popup (OPEMR-70)

Status: **presentation-only change; acceptance NOT complete.** Native, clinical and hosted gates below are open. Nothing here is merged or deployed.

## Scope

- Source of truth: the actual `select_codes.php` popup.
- Actual callers: the issue and prescription `985x800` `dlgopen` modal callers.
- Route styling is an inline palette plus a body marker. Header's existing autoload supplies the context engine and tokens; it is not the new inline palette.
- Exact 2-screen-context pair: body canvas plus neutral table paper, with paired ink. The original route gets the full inverse.
- Unchanged: all original PHP, JS, CSRF, session, callbacks, AJAX, code filters, controls, geometry, fonts, callers and shared assets. No wrappers.
- Style plus body marker alter all-media DOM, but the added CSS is screen-only. No native print equivalence is claimed.

## Files

1. `interface/patient_file/encounter/select_codes.php` (production)
2. `tests/isolated/multi-code-selector-contract.cjs` (portable node:test contract)
3. `tests/js/multi-code-selector.test.js` (Jest adapter; spawns the contract with `--test-reporter=tap`)
4. `docs/clinical-ui/MULTI-CODE-SELECTOR.md` (this file)
5. `tests/fixtures/multi-code-selector-original.php.txt` (complete nonexecuting original fixture). Shared `popup.js` is read by the tests, not modified.

## Commands

- Portable: `node tests/isolated/multi-code-selector-contract.cjs`
- History (needs git and the full base commit): `node tests/isolated/multi-code-selector-contract.cjs --history`
- Full Jest and actual inline CSS/rooted adapter lint: `python3 /Users/craig/.hermes/projects/openemr/verification/multi-code-selector-20261020/verify_local.py`. It invokes the existing sibling toolchain with this checkout's config, runs all suites, and removes its temporary individual dependency links. `MULTI_CODE_SELECTOR_HISTORY=1` adds the adapter history leg; direct history above is the authoritative local check.

## Evidence

- Controller verified a genuine RED before production: 56 tests, 55 PASS, 1 missing presentation (tests-only commit `7742ff97`).
- Current: portable 56/56 PASS; history 59/59 PASS; PHP syntax, diff check, rooted ESLint, and stylelint of the non-ignored actual CSS PASS.
- Full Jest initially failed only on the adapter reporter mismatch; all 56 child contracts passed. Explicit `--test-reporter=tap` fixed deterministic reporting. Final full rerun: **62 suites passed, 1,260 tests passed, 1 optional history test skipped**. Direct mandatory history execution separately passed 59/59; no history acceptance is inferred from the skip.
- Review: canonical Opus 5.5 (production), Sonnet (tests, completion), independent Codex gpt-6-astra complete 5-file review. No introduced P1/P2; 56+59 independent PASS.

## Synthetic, not native

The contract runs `popup.js` in `node:vm` against hand-built windows. Actual issue and prescription callers use modal iframes via `dlgopen`; the synthetic VM is not native. The opener-window case ("synthetic opener-window chain from a tab frame") is additional synthetic evidence, not proof of the native fallback.

## Not cleared / OPEN

- Contrast: descendants, controls, semantic rows, alerts, paging. NOT cleared.
- Native: PHP, session, roles, security, clinical.
- Native: DataTables search, selection callbacks.
- Native: keyboard, RTL, default/dark/solar themes, open and resize, print.
- All 22 FEATURES (full programme, not 22 callers), researched UI, demo, exhaustive popups, Swedish: OPEN.
- Hosted CI: PENDING.

## Release

Not merged, not deployed. No approval bypass.
