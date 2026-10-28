# AfterCare Planning editor presentation

## Scope

OPEMR-150 adds a screen-only presentation to `interface/forms/aftercare_plan/new.php` when the form opens in the clinical workbench. It supports the natural-spacing, document-style part of [requirement 2](ACCEPTANCE.md). It does not complete requirement 2, establish fidelity to the full research set, or satisfy clinical acceptance. The other 21 feature rows remain separate. This form gains no editable headings, reference pane, spell-check or autocorrect acceptance.

The only production additions are the exact CSS export from `tests/clinical-ui/aftercare-plan-editor-contract.cjs`, immediately before the existing sole `</head>`, and `oe-aftercare-plan-editor` on the existing `body_top` body. The CSS is gated by `html.oe-workbench-context` and `@media screen`. There is no new markup, script, PHP variable, import, or form behavior. The original 7,156 bytes must be recoverable exactly by removing those two additions; their SHA-256 is `1ec81f59a42fa5132cbdc81125596089086f3ca5163f5af13c249b33b796d3d3`. Form field names, values, CSRF, Save, Print, Cancel, and the save/view files retain their original behavior.

## Layout and compatibility

The form sheet has an 860px maximum width and a viewport-relative width of `calc(100% - 2rem)`. Seven original narrative fields fill the form's inner width. Each has a 12rem minimum height, 1.7 line height, and native vertical resizing. The original Goal A/B/C headings, patient metadata, two native date inputs, and Save, Print, and Cancel controls receive spacing and explicit foreground/background palettes. Action hover, focus, active, and disabled states have paired colors; focus also has a visible outline. The screen rules leave legacy print styling to the existing application.

The layout uses modern CSS `:has()` selectors to identify the original table rows and cells. An older browser without `:has()` support needs a separate browser compatibility gate; this slice does not claim an equivalent older-engine layout. `formHeader()` emits an outer HTML/body before this file's original HTML/body, and the original table has malformed rows/cells. Browsers repair that structure. The source markup remains untouched, so a native browser check must confirm that the workbench/body selector and repaired table produce the intended layout.

## Evidence and remaining gates

The controller's preproduction RED evidence is anchored to clean tests-only head `ddc641e425365969d25cfa09768f37c7d0d0c2da`: portable contract 9 tests, 8 passed and 1 missing-source failure; direct history contract 10 tests, 9 passed and 1 missing-source failure. The positive synthetic proposal and presentation/semantic mutants passed their contract checks. The proposed CSS had zero nonignored Stylelint warnings. Initial test-setup and lint failures were preserved in the controller record and corrected before this production edit; they are not product failures. No post-edit test, PHP, runtime, or browser pass is claimed in this document.

Portable command, for a source checkout or hosted adapter that does not expose Git history:

```sh
node --test --test-reporter=tap tests/clinical-ui/aftercare-plan-editor-contract.cjs
```

Direct history command, separately, for the original four-path test scope on a checkout with its baseline history:

```sh
node tests/clinical-ui/aftercare-plan-editor-contract.cjs --history
```

The direct history check enforces a four-path changed-file boundary and intentionally rejects this documentation path. It therefore cannot be treated as a passing gate for the combined production and documentation delivery. A hosted adapter must use the portable command and avoid `--history`.

Native template-body synthetic browser proof and independent review are pending the controller. Its browser gate should cover five themes, widths, RTL, legacy print, every action state, label contrast, and disabled-state sampling. The source contract and synthetic proposal do not prove authenticated Save or Print, security, persistence, date widgets, or accessibility. This work remains unmerged and undeployed. Run 1/max 2 denotes scheduled delivery runs, not internal implementation phases; ordinary approval applies with no standing bypass.
