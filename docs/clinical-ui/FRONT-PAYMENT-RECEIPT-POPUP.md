# Front payment receipt popup: source-only presentation slice

## Scope and rationale

This branch adds a screen-only stylesheet to the receipt branch of `interface/patient_file/front_payment.php`. That branch is reached both from the receipts report and after a successful payment save. The route links the stylesheet through the existing asset version helper and marks its existing container. The helper gains one supported basename. The stylesheet applies only under `html.oe-workbench-context` and the receipt marker: it pairs the existing workbench ink and paper tokens on `.section-2`, then supplies separate `:focus` and `:focus-visible` outline fallbacks for buttons and button inputs. This is partial presentation work, not full researched fidelity, native fit, security acceptance, or clinical acceptance.

The `.section-2` paper and ink belong together. Its existing `.bg-color` child retains its theme foreground/background pair. This slice does not paint the body, title, tables, native controls, or the dark canvas; it does not change wrappers, geometry, fonts, JavaScript, backend behavior, payment entry, gateways, the report caller, or print. The existing receipt Header call remains duplicated. The report opens the receipt with an initial 850 × 550 dialog in `front_receipts_report.php` lines 62–71, and auto height still depends on the viewport. The inherited 208 px `.section-1` left padding and 50%/auto grid widths are retained, with no claim that they fit the dialog.

## Evidence and limits

Before production edits, Hermes verified a genuine hosted RED at tests-only `ecee0b81388a28faec761353046618faad2c4d7c`, JavaScript run `39065848751`: exactly three intended missing-production failures, 1,264 passes, and 62 suites. The synthetic forward/inverse, AST, negative, and caller checks passed. The controller independently compared the complete original 1,887-line route and full helper baseline byte for byte against `origin/master` at `18647270`. The production edits follow the exact `ROUTE_EDITS`, `HELPER_EDITS`, and `RULES` contract in `tests/js/front-payment-receipt-popup.test.js`. This document records source evidence only; no local test, PHP, browser, application, or payment run is claimed for the production edit. Hermes still owns complete exact-head CI on the final state. Draft PR #104 remains unmerged and undeployed.

## Open acceptance and inherited risks

- Actual PHP execution, workbench context, compiled default/dark/solar themes, native controls, keyboard focus, narrow widths, RTL, print, role behavior, and ordinary approval remain open. The new outline can overlay native glow and may clip or contrast poorly against the unchanged dark canvas. The generated payment-method display field and theme contrast have not been proven in a native browser.
- The pre-branch `BillingUtilities::updateInvoiceRefNumber()` call and mixed session PID, query patient, and encounter itemization remain inherited risks. A native application GET may mutate state, so it is not authorized for this slice. No application request, payment, printing, database, patient, credential, or outbound provider exercise was performed.
- Real Print, Delete, Open Today Visit, Exit, and opener interactions require safety-gated acceptance. Payment entry and gateway branches retain their existing behavior and require their own review.
- All prior per-PR QA, coverage and ordinary-approval gates remain parked; PR #55 has exhausted its consecutive-run budget and PR #47 is settled. The original 22 features, exhaustive synthetic demo coverage and exhaustive popup acceptance are distinct unfinished commitments. Swedish specification checkout/publication remains blocked by the specifically denied fresh-clone boundary; this does not block unrelated authorized work.

Hermes will verify the final exact head and publish through its own process. Merge, deployment, and broader acceptance are not established here.

## Maintenance note

The full-byte route and helper guards intentionally require reviewed reconciliation when independent source edits land. Hosted intermediate `683b8776` / JS `39066622247` reported exactly one internal selector whitespace failure with 1,266 passes. That failure was a formatting-only disagreement between the strict test oracle and stylesheet: the oracle serialized the second scoped selector after a newline with zero indentation, while the existing Stylelint rule requires two spaces. Controller Stylelint rejected the dedented candidate with two `@stylistic/indentation` errors before publication. The strict oracle now requires the mandatory two-space indentation, and both CSS selector lines use it. No mutants or assertions were removed or weakened; final GREEN remains pending controller verification.
