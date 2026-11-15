# OPEMR-250: ERA overwrite popup

## Scope

The future product change is one `style` element with id `oe-era-overwrite-layout`, inserted immediately before the unique `<!-- Overwrite Confirmation Modal -->` comment in `interface/billing/era_payments.php`. Its screen rules wrap the title and body text, wrap the footer, and bound and wrap its buttons under `html.oe-workbench-context #overwriteConfirmModal`. All other native bytes, Bootstrap styling, warning and info colors, focus behavior, markup, PHP, JavaScript, routes, actions, and access controls stay intact. This is context-scoped overflow containment, not a complete body redesign.

The existing `showOverwriteConfirm` caller remains the launcher. Both `confirmOverwrite()` and `cancelOverwrite()` submit financial forms; source checks must never execute either action or the route. The reference document-dialog wrapping pattern informs the scope only. This work does not claim complete UI, 22-case, Swedish, or browser coverage.

## Allocation and evidence

Use one scheduled run for implementation and QA if feasible, with a maximum of two consecutive scheduled runs including both. Internal phases do not create additional scheduled allocations. The controller copies the original source to `tests/clinical-ui/fixtures/era-overwrite-popup-original.php.txt` before genuine RED, checks its SHA-256 against `ee867364a11fa9636acd2e2071730b2856470bd333350bf4fab2d5cf7ce5a03b`, and owns Git, execution, and materialization. The source contract reads files only. Its original route should fail the live layout and inverse cases at RED while synthetic addition and mutant cases pass.

After the minimal insertion, ordinary source contract and Jest adapter results can establish exact addition and unchanged native bytes. Native QA must separately inspect the real modal in relevant screen sizes, long localized text and filenames, processed and unprocessed messages, keyboard and focus behavior, and both action paths in a safe authorized environment. Record original, RED, native QA, coverage, and ordinary approval boundaries distinctly. No test or browser result is asserted here.
