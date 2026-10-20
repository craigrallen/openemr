# Multi-code selector popup (OPEMR-70)

Status: **presentation-only change; acceptance NOT complete.** No check below has been run by this document's author. All actual checks are PENDING the controller. Nothing here is a pass claim.

## Scope

Presentation-only palette rules: exact 2-neutral palette plus a body marker.

- Source of truth: the actual `select_codes.php` popup.
- Callers: the issue and prescription `985x800` `dlgopen` callers.
- Styling is delivered through Header autoload.

## Palette and body marker

- Two neutrals only, applied as exact values. No extra tints.
- A body marker class scopes the rules to this popup so other popups are unaffected.
- Body canvas and table paper use paired ink for readable contrast.

## Explicitly unchanged

- Fonts and geometry.
- Wrappers and shared assets.
- Controls and semantic rows.
- PHP and JS behaviour.

## Not proven

Theme contrast has not been demonstrated for:

- descendants and table cells
- controls
- alerts
- paging

Only body canvas and table paper with paired ink are covered by the rules.

## Verification

- Full source inverse and portable/history commands are listed by the controller. Actual runs: **PENDING controller**.
- The isolated contract harness (`tests/isolated/multi-code-selector-contract.cjs`) runs the real `popup.js` inside a synthetic VM, **not a native browser**. The harness result says nothing about real rendering.
- The adapter test is `tests/js/multi-code-selector.test.js`.

## Still open (no claim made)

Actual opened-popup checks:

- resized narrow and short
- default, dark and solar themes
- keyboard and RTL
- paging, search, selection callback
- roles
- print
- security
- clinical acceptance

Wider scope, also open:

- All 22 callers
- researched UI
- demo data
- Swedish locale

## Release

No merge, no deploy, no bypass of any gate.
