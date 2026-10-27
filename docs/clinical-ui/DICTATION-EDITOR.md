# Dictation editor — OPEMR-141

## Scope and state

The original two Dictation routes (`new.php` and `view.php`) now add a writing sheet on screen when the registered workbench popup controller marks the page with `html.oe-workbench-context`. Outside that context, and in print, the added rules do not apply. The sheet has a bounded paper width, document heading, plain section legends, full-width writing fields, and an aligned Save/Cancel area. The existing PHP, fields, values, handlers, and source markup remain intact except for the three presentation classes and inline style block on each route. No voice engine or medical spelling behavior is introduced.

The source contract is in `tests/clinical-ui/dictation-editor-contract.cjs`. It pins the original route fixtures to base `09b29da7771aea334ed5745e058751157af980d7`, checks the complete diff since that base plus untracked files against the seven-file scope, and requires an exact inverse of every source addition. Its negative mutations cover PHP, form semantics, values, CSS, and extra markup. The Jest file is an adapter for the same portable contract.

## Evidence from this implementation pass

- Before production edits, the revised portable contract reported **4 pass, 2 fail** and history mode reported **5 pass, 2 fail**. Both failures were the missing approved additions in `new.php` and `view.php`.
- After production edits, direct portable mode reported **6 pass, 0 fail** and direct `--history` mode reported **7 pass, 0 fail**.
- The registered popup context and local theme source were inspected. The local rules account for the theme's important fieldset and legend colors, the important Cancel link styling, the `mt-3` top margin, and the view route's offset action column.

## Correction evidence

- Independent controller review found that actual stylelint on the extracted inline CSS rejected `@media screen and (max-width: 640px)` under `media-feature-range-notation`. The optional breakpoint block was removed from both routes. The primary sheet already uses `width: 100%`, `max-width: 860px`, and fluid inline padding; no replacement media query or rule override was added. The corrected CSS still needs the controller's actual stylelint rerun.
- Independent review also found that the view route's `offset-sm-1` can remain when an older CSS engine drops `margin-inline` and `padding-inline`. Both field columns and the action column now set physical left/right margins and padding to zero before the logical declarations. A source-level test drops the logical declarations and checks the resulting physical values against inherited offset and padding values. This is a declaration-level simulation, not an old-engine runtime result.
- Tests were updated before the route CSS. Against the then-current sources, direct portable mode reported **4 pass, 4 fail** and `--history` reported **5 pass, 4 fail**. Both routes failed the revised exact CSS inverse and the new physical-fallback/breakpoint assertions. After the CSS corrections, portable mode reported **8 pass, 0 fail** and `--history` reported **9 pass, 0 fail**. The original inverse and negative mutation checks remain in place.
- The controller's completed `browser-current.json` reports 120 passing checks for a source-derived synthetic DOM with compiled themes and no browser failures. That evidence predates these CSS corrections; it does not verify the corrected source or a native authenticated workflow.

## Acceptance still open

This is **original2Partial** implementation evidence, not clinical acceptance. The corrected inline CSS still needs the controller's stylelint and browser checks. Native authenticated create, save, reopen, and update persistence; role behavior; and clinical review remain open. The prior synthetic browser record cannot stand in for those gates or for verification of the corrected CSS.

No live PHP, database, or browser workflow was run in this correction pass.
