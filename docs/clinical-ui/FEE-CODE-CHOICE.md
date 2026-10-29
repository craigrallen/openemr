# Fee code choice presentation (OPEMR-171)

Owner: Hermes. Scheduled allocation 1/max2 for this surface, counting both
implementation and QA delivery runs. Internal worker phases do not consume
additional scheduled-run allocations.
The slice is a partial researched UI treatment of the existing fee sheet code
chooser. The exhaustive popup body remains backlog. This does not complete the
full reference or any of the 22 clinical features in `ACCEPTANCE.md`.

## Source scope

Exact five changed paths: `interface/forms/fee_sheet/code_choice/css/code_choices.css`,
`tests/clinical-ui/fee-code-choice-contract.cjs`,
`tests/clinical-ui/fixtures/fee-code-choices-original.css.txt`,
`tests/js/fee-code-choice.test.js`, and `docs/clinical-ui/FEE-CODE-CHOICE.md`.

The only production change is an appended `@media screen` block in
`interface/forms/fee_sheet/code_choice/css/code_choices.css`. It applies when
`html.oe-workbench-context` contains the existing `div.code-choices` root. The
original stylesheet remains before the block. No selector or script was added
to the template, and no clinical behavior or data path was changed.

The five supporting paths pinned by the source contract are:

1. `interface/forms/fee_sheet/code_choice/templates/code_choices.php`
2. `interface/forms/fee_sheet/code_choice/js/view_model.js`
3. `interface/forms/fee_sheet/code_choice/initialize_code_choice.php`
4. `interface/forms/fee_sheet/new.php`
5. `interface/clinical-workspace/popup.css`

All five are preserved. The native Knockout template, view model, initializer,
fee sheet caller and popup framing remain responsible for selection and display.
In particular, Cancel only hides the choices and retains selections; it does
not roll them back. Native checkbox and mouseup sequencing is unchanged.

The appended CSS gives the chooser a centered paper surface up to 1000px wide,
uses the surviving category and code collections as responsive grids, and
places the active panel in relative flow. Native button, checkbox and hover
palette remain in place apart from inherited color on the new paper surfaces.
Buttons and checkboxes receive visible focus outlines. The rule is screen-only;
print styling is outside this slice.

## Evidence and remaining gates

The controller's actual RED ran before the production edit against the
tests-only commit `8dad595d5e358f9d906b306b955d14167d6ef035`:
`node tests/clinical-ui/fee-code-choice-contract.cjs --history` reported
7 tests, 6 passed and 1 failed for missing presentation. The corrected
tests-only history check allows descendants of the bound base. Its five source
digests and complete 1082-byte original CSS fixture passed. The RED record is
`/Users/craig/.hermes/projects/openemr/verification/fee-code-choice-20261029/red.tap`.

Native Knockout browser, theme, keyboard, print and authenticated billing
acceptance have not run. The CSS change therefore has no runtime or clinical
acceptance claim. Ordinary approval, complete final exact-head CI and
independent review are still required. The prior denials remain in effect,
including Swedish publication, installed124, local Jest/cache/combined ESLint
and reviewer byte comparison. The related ledger remains 55 parked and 47
settled. There are no merge, deployment, database or cron changes in this slice.

After this allocation, the default next scheduled implementation is a
different eligible actual body after fresh ownership confirmation, not
unchanged CI polling.
